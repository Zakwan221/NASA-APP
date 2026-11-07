-- Orbitly: public leaderboard, solo results and share links (Adaam)
--
-- Before this, only team rooms saved results. Now:
--   submit_solo_result   a solo player posts their score under a name
--   get_leaderboard      best score per name for a scenario, filter all / solo / team,
--                        and each row's id so it can link to its share page
--   get_shared_result    one result by id, for /mission/r/<id> (the id is a random
--                        uuid, so only people who get the link can open it)
--
-- The score is still worked out on the phone (src/game/scoring/score.ts). The
-- server checks it is a possible score: each part inside its maximum and the
-- parts adding up to the total. Good enough for a school hackathon.

alter table public.mission_results add column if not exists submitted_by uuid default auth.uid();
create index if not exists mission_results_by_idx on public.mission_results (submitted_by, created_at desc);

/* ------------------------------------------------------------------ */

-- The four parts of a score must fit their maximums (40/25/20/15) and add up
create or replace function mission_private.check_score(p_score jsonb)
returns int
language plpgsql immutable set search_path = ''
as $$
declare
  v_success int;
  v_science int;
  v_efficiency int;
  v_teamwork int;
  v_total int;
begin
  if jsonb_typeof(p_score) is distinct from 'object' or length(p_score::text) > 8000 then
    raise exception 'Invalid score';
  end if;
  begin
    v_success := (p_score ->> 'missionSuccess')::int;
    v_science := (p_score ->> 'science')::int;
    v_efficiency := (p_score ->> 'efficiency')::int;
    v_teamwork := (p_score ->> 'teamwork')::int;
    v_total := (p_score ->> 'total')::int;
  exception when others then
    raise exception 'Invalid score';
  end;
  if v_success not between 0 and 40 or v_science not between 0 and 25
     or v_efficiency not between 0 and 20 or v_teamwork not between 0 and 15
     or v_total is distinct from v_success + v_science + v_efficiency + v_teamwork then
    raise exception 'Invalid score';
  end if;
  return v_total;
end $$;

-- Solo player: post a finished mission to the leaderboard
create or replace function public.submit_solo_result(
  p_name text, p_scenario_id text, p_difficulty text, p_score jsonb, p_design jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_total int;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 24 then
    raise exception 'Use a name of 1 to 24 characters';
  end if;
  if coalesce(p_scenario_id, '') !~ '^[a-z0-9-]{1,40}$' then raise exception 'Unknown scenario'; end if;
  if p_difficulty not in ('cadet', 'engineer', 'director', 'sandbox') then raise exception 'Unknown difficulty'; end if;
  if jsonb_typeof(p_design) is distinct from 'object' or length(p_design::text) > 4000 then
    raise exception 'Invalid design';
  end if;
  if exists (select 1 from public.mission_results
              where submitted_by = auth.uid() and created_at > now() - interval '10 seconds') then
    raise exception 'You just posted a score. Wait a few seconds and try again';
  end if;

  v_total := mission_private.check_score(p_score);

  insert into public.mission_results (room_id, attempt, team_name, scenario_id, difficulty, crew_size, total, score, design)
  values (null, 1, btrim(p_name), p_scenario_id, p_difficulty, 1, v_total, p_score, p_design)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'total', v_total);
end $$;

-- Same as before, plus the score check
create or replace function public.submit_mission_result(p_room_id uuid, p_team_name text, p_score jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_total int;
  v_id uuid;
  v_payload jsonb;
begin
  select * into r from public.mission_rooms where id = p_room_id for update;
  if not found or r.host_id is distinct from auth.uid() then raise exception 'Only the host can do that'; end if;
  if r.phase <> 'operate' then raise exception 'Finish flying the mission first'; end if;
  if r.design #>> '{planner,scenarioId}' is null then raise exception 'Pick a scenario first'; end if;

  v_total := mission_private.check_score(p_score);

  insert into public.mission_results (room_id, attempt, team_name, scenario_id, difficulty, crew_size, total, score, design)
  values (r.id, r.attempt, btrim(p_team_name), r.design #>> '{planner,scenarioId}',
          coalesce(r.design #>> '{planner,difficulty}', 'cadet'),
          (select count(*) from public.mission_crew where room_id = r.id), v_total, p_score, r.design)
  returning id into v_id;

  v_payload := jsonb_build_object('attempt', r.attempt, 'total', v_total, 'score', p_score, 'result_id', v_id);
  perform realtime.send(v_payload, 'result', 'mission:' || r.code, true);
  perform mission_private.advance(r.id);
  return v_payload;
end $$;

-- Anyone signed in: best result per name for a scenario.
-- p_mode: 'all', 'solo' (one player) or 'team' (two or more)
drop function if exists public.get_leaderboard(text, int);
create or replace function public.get_leaderboard(p_scenario_id text, p_limit int default 10, p_mode text default 'all')
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(top) order by top.total desc, top.created_at), '[]'::jsonb)
    from (
      select * from (
        select distinct on (lower(m.team_name))
               m.id, m.team_name, m.total, m.difficulty, m.crew_size, m.created_at
          from public.mission_results m
         where m.scenario_id = p_scenario_id
           and (coalesce(p_mode, 'all') = 'all'
                or (p_mode = 'solo' and m.crew_size = 1)
                or (p_mode = 'team' and m.crew_size > 1))
         order by lower(m.team_name), m.total desc, m.created_at
      ) best
      order by best.total desc, best.created_at
      limit least(greatest(coalesce(p_limit, 10), 1), 50)
    ) top;
$$;

-- Anyone signed in with the link: one result, for its share page
create or replace function public.get_shared_result(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
           'id', m.id, 'team_name', m.team_name, 'scenario_id', m.scenario_id, 'difficulty', m.difficulty,
           'crew_size', m.crew_size, 'total', m.total, 'score', m.score, 'created_at', m.created_at,
           -- where this result ranks on its scenario's board (best score per name)
           'rank', (select count(*) + 1 from (
                      select distinct on (lower(o.team_name)) o.total, o.created_at
                        from public.mission_results o
                       where o.scenario_id = m.scenario_id
                       order by lower(o.team_name), o.total desc, o.created_at) best
                     where best.total > m.total))
    into v
    from public.mission_results m
   where m.id = p_id;
  if v is null then raise exception 'This result does not exist any more'; end if;
  return v;
end $$;

/* ------------------------------------------------------------------ */

revoke execute on function mission_private.check_score(jsonb) from public, anon, authenticated;

revoke execute on function
  public.submit_solo_result(text, text, text, jsonb, jsonb),
  public.get_leaderboard(text, int, text),
  public.get_shared_result(uuid)
from public, anon;

grant execute on function
  public.submit_solo_result(text, text, text, jsonb, jsonb),
  public.get_leaderboard(text, int, text),
  public.get_shared_result(uuid)
to authenticated;
