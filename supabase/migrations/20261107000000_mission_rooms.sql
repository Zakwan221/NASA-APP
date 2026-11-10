-- Orbitly: Space Mission Design Game, team rooms (Adaam)
--
-- Same idea as the quiz: Postgres is the referee. The browser never writes
-- tables; every move is a function called with supabase.rpc(), and the
-- functions broadcast to the room channel with realtime.send().
--
-- Realtime topic per room: 'mission:<code>' (private channel)
-- Events: crew, design, phase, vote, result
--
-- A room holds one shared MissionDesign (src/game/types.ts) as JSON with four
-- sections: planner, engineer, science, comms. A player may edit a section if
-- they hold that role, or if nobody holds it and they are the host. So solo
-- play is just a room with one person who holds no role.

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

create table public.mission_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  host_id uuid not null default auth.uid(),
  phase text not null default 'lobby'
    check (phase in ('lobby', 'design', 'launch', 'operate', 'report')),
  design jsonb not null default '{}'::jsonb check (jsonb_typeof(design) = 'object'),
  design_version int not null default 0,  -- goes up on every design change
  attempt int not null default 1,         -- goes up on every "redesign and fly again"
  created_at timestamptz not null default now()
);

create table public.mission_crew (
  room_id uuid not null references public.mission_rooms on delete cascade,
  user_id uuid not null default auth.uid(),
  nickname text not null check (char_length(nickname) between 1 and 16),
  role text check (role in ('planner', 'engineer', 'science', 'comms')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, nickname)
);
-- one person per role in a room
create unique index mission_crew_one_per_role on public.mission_crew (room_id, role) where role is not null;

create table public.mission_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mission_rooms on delete cascade,
  topic text not null check (char_length(topic) between 1 and 40),  -- e.g. 'advance', 'orbit'
  proposal jsonb not null default '{}'::jsonb,
  proposed_by uuid not null,
  status text not null default 'open' check (status in ('open', 'passed', 'failed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
-- one open vote per room at a time keeps the screens simple
create unique index mission_votes_one_open on public.mission_votes (room_id) where status = 'open';

create table public.mission_ballots (
  vote_id uuid not null references public.mission_votes on delete cascade,
  user_id uuid not null,
  yes boolean not null,
  primary key (vote_id, user_id)
);

-- Finished missions, for the leaderboard and "compare with last attempt"
create table public.mission_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.mission_rooms on delete set null,
  attempt int not null,
  team_name text not null check (char_length(team_name) between 1 and 24),
  scenario_id text not null,
  difficulty text not null,
  crew_size int not null,
  total int not null check (total between 0 and 100),
  score jsonb not null,   -- ScoreBreakdown
  design jsonb not null,  -- the MissionDesign that flew
  created_at timestamptz not null default now()
);

create index on public.mission_votes (room_id, created_at);
create index on public.mission_results (scenario_id, total desc);

/* ------------------------------------------------------------------ */
/* Private helpers                                                     */
/* ------------------------------------------------------------------ */

create schema if not exists mission_private;
revoke all on schema mission_private from public, anon, authenticated;

create or replace function mission_private.is_member(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.mission_rooms r where r.id = p_room_id and r.host_id = (select auth.uid()))
      or exists (select 1 from public.mission_crew c where c.room_id = p_room_id and c.user_id = (select auth.uid()));
$$;

create or replace function mission_private.is_topic_member(p_topic text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.mission_rooms r
     where 'mission:' || r.code = p_topic
       and mission_private.is_member(r.id)
  );
$$;

create or replace function mission_private.crew(p_room_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', c.user_id, 'nickname', c.nickname, 'role', c.role,
           'is_host', c.user_id = r.host_id)
         order by c.joined_at), '[]'::jsonb)
    from public.mission_crew c
    join public.mission_rooms r on r.id = c.room_id
   where c.room_id = p_room_id;
$$;

create or replace function mission_private.vote_payload(p_vote_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'vote_id', v.id,
    'topic', v.topic,
    'proposal', v.proposal,
    'proposed_by', v.proposed_by,
    'status', v.status,
    'yes', (select count(*) from public.mission_ballots b where b.vote_id = v.id and b.yes)::int,
    'no', (select count(*) from public.mission_ballots b where b.vote_id = v.id and not b.yes)::int,
    'voted', (select coalesce(jsonb_agg(b.user_id), '[]'::jsonb) from public.mission_ballots b where b.vote_id = v.id),
    'crew_size', (select count(*) from public.mission_crew c where c.room_id = v.room_id)::int
  )
  from public.mission_votes v where v.id = p_vote_id;
$$;

-- The next phase after this one; report loops back to design (redesign and fly again)
create or replace function mission_private.next_phase(p_phase text)
returns text
language sql immutable
as $$
  select case p_phase
    when 'lobby' then 'design'
    when 'design' then 'launch'
    when 'launch' then 'operate'
    when 'operate' then 'report'
    when 'report' then 'design'
  end;
$$;

-- Move the room to the next phase and tell everyone
create or replace function mission_private.advance(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_payload jsonb;
begin
  select * into r from public.mission_rooms where id = p_room_id for update;
  update public.mission_rooms
     set phase = mission_private.next_phase(r.phase),
         attempt = case when r.phase = 'report' then r.attempt + 1 else r.attempt end
   where id = r.id
  returning jsonb_build_object('phase', phase, 'attempt', attempt) into v_payload;
  perform realtime.send(v_payload, 'phase', 'mission:' || r.code, true);
  return v_payload;
end $$;

-- Delete rooms older than a day. Results are kept for the leaderboard.
create or replace function mission_private.cleanup_old_rooms()
returns int
language sql security definer set search_path = ''
as $$
  with gone as (delete from public.mission_rooms where created_at < now() - interval '1 day' returning 1)
  select count(*)::int from gone;
$$;

/* ------------------------------------------------------------------ */
/* Row Level Security                                                  */
/* ------------------------------------------------------------------ */

alter table public.mission_rooms   enable row level security;
alter table public.mission_crew    enable row level security;
alter table public.mission_votes   enable row level security;
alter table public.mission_ballots enable row level security;
alter table public.mission_results enable row level security;  -- read through get_leaderboard()

create policy "members can read their mission room"
  on public.mission_rooms for select to authenticated
  using (mission_private.is_member(id));

create policy "members can read their crew"
  on public.mission_crew for select to authenticated
  using (mission_private.is_member(room_id));

create policy "members can read their votes"
  on public.mission_votes for select to authenticated
  using (mission_private.is_member(room_id));

create policy "members can read ballots in their room"
  on public.mission_ballots for select to authenticated
  using (mission_private.is_member((select v.room_id from public.mission_votes v where v.id = vote_id)));

create policy "mission room members can receive"
  on realtime.messages for select to authenticated
  using (mission_private.is_topic_member((select realtime.topic())));

create policy "mission room members can track presence"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and mission_private.is_topic_member((select realtime.topic()))
  );

/* ------------------------------------------------------------------ */
/* Game functions (call with supabase.rpc)                             */
/* ------------------------------------------------------------------ */

-- Host: open a room. The host joins the crew too, with no role yet.
create or replace function public.create_mission_room(p_nickname text, p_design jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
  v_room_id uuid;
  v_nickname text := btrim(p_nickname);
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if char_length(v_nickname) not between 1 and 16 then
    raise exception 'Nickname must be 1 to 16 characters';
  end if;
  if jsonb_typeof(p_design) is distinct from 'object' then raise exception 'Design must be an object'; end if;

  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.mission_rooms where code = v_code);
  end loop;

  insert into public.mission_rooms (code, host_id, design)
  values (v_code, auth.uid(), p_design)
  returning id into v_room_id;

  insert into public.mission_crew (room_id, user_id, nickname) values (v_room_id, auth.uid(), v_nickname);

  return jsonb_build_object('room_id', v_room_id, 'code', v_code);
end $$;

-- Player: join in the lobby (max 4 people). Calling again from the same user rejoins.
create or replace function public.join_mission_room(p_code text, p_nickname text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_nickname text := btrim(p_nickname);
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;

  select * into r from public.mission_rooms where code = btrim(p_code) for update;
  if not found then raise exception 'No mission with that code'; end if;

  if exists (select 1 from public.mission_crew where room_id = r.id and user_id = auth.uid()) then
    return jsonb_build_object('room_id', r.id, 'code', r.code, 'rejoined', true);
  end if;

  if r.phase <> 'lobby' then raise exception 'This mission has already started'; end if;
  if (select count(*) from public.mission_crew where room_id = r.id) >= 4 then
    raise exception 'This crew is full (4 people max)';
  end if;
  if char_length(v_nickname) not between 1 and 16 then
    raise exception 'Nickname must be 1 to 16 characters';
  end if;

  begin
    insert into public.mission_crew (room_id, user_id, nickname) values (r.id, auth.uid(), v_nickname);
  exception when unique_violation then
    raise exception 'That nickname is taken, try another';
  end;

  perform realtime.send(jsonb_build_object('crew', mission_private.crew(r.id)), 'crew', 'mission:' || r.code, true);
  return jsonb_build_object('room_id', r.id, 'code', r.code, 'rejoined', false);
end $$;

-- Crew member: take a free role, or pass null to let go of yours. Lobby only.
create or replace function public.claim_role(p_room_id uuid, p_role text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_crew jsonb;
begin
  select * into r from public.mission_rooms where id = p_room_id;
  if not found or not exists (select 1 from public.mission_crew where room_id = p_room_id and user_id = auth.uid()) then
    raise exception 'You are not in this mission';
  end if;
  if r.phase <> 'lobby' then raise exception 'Roles are locked once the mission starts'; end if;
  if p_role is not null and p_role not in ('planner', 'engineer', 'science', 'comms') then
    raise exception 'Unknown role';
  end if;

  begin
    update public.mission_crew set role = p_role where room_id = p_room_id and user_id = auth.uid();
  exception when unique_violation then
    raise exception 'Someone already has that role';
  end;

  v_crew := mission_private.crew(p_room_id);
  perform realtime.send(jsonb_build_object('crew', v_crew), 'crew', 'mission:' || r.code, true);
  return jsonb_build_object('crew', v_crew);
end $$;

-- Crew member: replace one section of the shared design.
-- Allowed if you hold that role, or nobody does and you are the host (solo play).
-- p_expected_version guards against two people saving at once: send the
-- design_version you last saw, or null to skip the check.
create or replace function public.update_design(
  p_room_id uuid, p_section text, p_value jsonb, p_expected_version int default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_holder uuid;
  v_payload jsonb;
begin
  select * into r from public.mission_rooms where id = p_room_id for update;
  if not found or not mission_private.is_member(p_room_id) then
    raise exception 'You are not in this mission';
  end if;
  if p_section not in ('planner', 'engineer', 'science', 'comms') then raise exception 'Unknown section'; end if;
  if jsonb_typeof(p_value) is distinct from 'object' then raise exception 'Section must be an object'; end if;
  if r.phase not in ('lobby', 'design', 'launch') then
    raise exception 'The design is locked while the mission flies';
  end if;

  select user_id into v_holder from public.mission_crew where room_id = r.id and role = p_section;
  if v_holder is distinct from auth.uid() and not (v_holder is null and r.host_id = auth.uid()) then
    raise exception 'Only the % can change that', p_section;
  end if;

  if p_expected_version is not null and p_expected_version <> r.design_version then
    raise exception 'Someone else changed the design first, reload and try again';
  end if;

  update public.mission_rooms
     set design = jsonb_set(design, array[p_section], p_value, true),
         design_version = design_version + 1
   where id = r.id
  returning jsonb_build_object('section', p_section, 'value', p_value, 'version', design_version,
                               'by', auth.uid())
    into v_payload;

  perform realtime.send(v_payload, 'design', 'mission:' || r.code, true);
  return v_payload;
end $$;

-- Close a vote if everyone has voted or the result can no longer change.
-- Passes with more than half the crew. A passed 'advance' vote moves the phase.
create or replace function mission_private.settle_vote(p_vote_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.mission_votes;
  r public.mission_rooms;
  v_crew int;
  v_yes int;
  v_no int;
  v_status text;
  v_payload jsonb;
begin
  select * into v from public.mission_votes where id = p_vote_id for update;
  select * into r from public.mission_rooms where id = v.room_id;
  select count(*) into v_crew from public.mission_crew where room_id = v.room_id;
  select count(*) filter (where yes), count(*) filter (where not yes)
    into v_yes, v_no from public.mission_ballots where vote_id = v.id;

  if v_yes * 2 > v_crew then v_status := 'passed';
  elsif v_no * 2 >= v_crew then v_status := 'failed';   -- yes can no longer reach a majority
  else v_status := 'open';
  end if;

  if v_status <> 'open' then
    update public.mission_votes set status = v_status, closed_at = now() where id = v.id;
  end if;

  v_payload := mission_private.vote_payload(v.id);
  perform realtime.send(v_payload, 'vote', 'mission:' || r.code, true);

  if v_status = 'passed' and v.topic = 'advance' then
    perform mission_private.advance(r.id);
  end if;
  return v_payload;
end $$;

-- Crew member: put a decision to the team. The proposer's yes is counted at once.
-- topic 'advance' moves to the next phase when it passes; other topics are just
-- recorded and the screens act on the result (e.g. 'orbit' with {"orbitId":"sso"}).
create or replace function public.propose_vote(p_room_id uuid, p_topic text, p_proposal jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_id uuid;
begin
  select * into r from public.mission_rooms where id = p_room_id;
  if not found or not exists (select 1 from public.mission_crew where room_id = p_room_id and user_id = auth.uid()) then
    raise exception 'You are not in this mission';
  end if;
  if p_topic = 'advance' and r.phase = 'lobby' and r.host_id <> auth.uid() then
    raise exception 'Only the host can start the mission';
  end if;
  if p_topic = 'advance' and r.phase = 'operate' then
    raise exception 'Submit the mission result to finish Operate';
  end if;

  begin
    insert into public.mission_votes (room_id, topic, proposal, proposed_by)
    values (r.id, btrim(p_topic), coalesce(p_proposal, '{}'::jsonb), auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Finish the open vote first';
  end;

  insert into public.mission_ballots (vote_id, user_id, yes) values (v_id, auth.uid(), true);
  return mission_private.settle_vote(v_id);
end $$;

-- Crew member: vote yes or no. You can change your mind while the vote is open.
create or replace function public.cast_ballot(p_vote_id uuid, p_yes boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.mission_votes;
begin
  select * into v from public.mission_votes where id = p_vote_id;
  if not found or not exists (select 1 from public.mission_crew where room_id = v.room_id and user_id = auth.uid()) then
    raise exception 'You are not in this mission';
  end if;
  if v.status <> 'open' then raise exception 'This vote is closed'; end if;

  insert into public.mission_ballots (vote_id, user_id, yes) values (v.id, auth.uid(), p_yes)
  on conflict (vote_id, user_id) do update set yes = excluded.yes;

  return mission_private.settle_vote(v.id);
end $$;

-- Host: record the score at the end of Operate and move to Report.
-- The score is worked out by the game engine in the browser (src/game/scoring).
create or replace function public.submit_mission_result(p_room_id uuid, p_team_name text, p_score jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_total int;
  v_payload jsonb;
begin
  select * into r from public.mission_rooms where id = p_room_id for update;
  if not found or r.host_id is distinct from auth.uid() then raise exception 'Only the host can do that'; end if;
  if r.phase <> 'operate' then raise exception 'Finish flying the mission first'; end if;
  if r.design #>> '{planner,scenarioId}' is null then raise exception 'Pick a scenario first'; end if;

  v_total := (p_score ->> 'total')::int;
  if v_total is null or v_total not between 0 and 100 then raise exception 'Score total must be 0 to 100'; end if;

  insert into public.mission_results (room_id, attempt, team_name, scenario_id, difficulty, crew_size, total, score, design)
  values (r.id, r.attempt, btrim(p_team_name), r.design #>> '{planner,scenarioId}',
          coalesce(r.design #>> '{planner,difficulty}', 'cadet'),
          (select count(*) from public.mission_crew where room_id = r.id), v_total, p_score, r.design);

  v_payload := jsonb_build_object('attempt', r.attempt, 'total', v_total, 'score', p_score);
  perform realtime.send(v_payload, 'result', 'mission:' || r.code, true);
  perform mission_private.advance(r.id);
  return v_payload;
end $$;

-- Host: skip the vote and move on (solo play, or a stuck team).
create or replace function public.advance_phase(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
begin
  select * into r from public.mission_rooms where id = p_room_id;
  if not found or r.host_id is distinct from auth.uid() then raise exception 'Only the host can do that'; end if;
  if r.phase = 'operate' then raise exception 'Submit the mission result to finish Operate'; end if;
  update public.mission_votes set status = 'failed', closed_at = now() where room_id = r.id and status = 'open';
  return mission_private.advance(r.id);
end $$;

-- Anyone in the room: everything needed to draw the screen after a load or reconnect
create or replace function public.get_mission_state(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_open uuid;
begin
  select * into r from public.mission_rooms where code = btrim(p_code);
  if not found or not mission_private.is_member(r.id) then raise exception 'No mission with that code'; end if;

  select id into v_open from public.mission_votes where room_id = r.id and status = 'open';

  return jsonb_build_object(
    'room_id', r.id,
    'code', r.code,
    'phase', r.phase,
    'attempt', r.attempt,
    'is_host', r.host_id = auth.uid(),
    'my_role', (select role from public.mission_crew where room_id = r.id and user_id = auth.uid()),
    'design', r.design,
    'design_version', r.design_version,
    'crew', mission_private.crew(r.id),
    'open_vote', case when v_open is null then null else mission_private.vote_payload(v_open) end,
    'results', (select coalesce(jsonb_agg(jsonb_build_object('attempt', m.attempt, 'total', m.total, 'score', m.score)
                                          order by m.attempt), '[]'::jsonb)
                  from public.mission_results m where m.room_id = r.id)
  );
end $$;

-- Anyone signed in: best results for a scenario (one row per team name)
create or replace function public.get_leaderboard(p_scenario_id text, p_limit int default 10)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(top) order by top.total desc, top.created_at), '[]'::jsonb)
    from (
      select * from (
        select distinct on (lower(m.team_name))
               m.team_name, m.total, m.difficulty, m.crew_size, m.created_at
          from public.mission_results m
         where m.scenario_id = p_scenario_id
         order by lower(m.team_name), m.total desc, m.created_at
      ) best
      order by best.total desc, best.created_at
      limit least(greatest(coalesce(p_limit, 10), 1), 50)
    ) top;
$$;

/* ------------------------------------------------------------------ */
/* Permissions                                                         */
/* ------------------------------------------------------------------ */

revoke execute on all functions in schema mission_private from public, anon, authenticated;

grant usage on schema mission_private to authenticated;
grant execute on function
  mission_private.is_member(uuid),
  mission_private.is_topic_member(text)
to authenticated;

revoke execute on function
  public.create_mission_room(text, jsonb),
  public.join_mission_room(text, text),
  public.claim_role(uuid, text),
  public.update_design(uuid, text, jsonb, int),
  public.propose_vote(uuid, text, jsonb),
  public.cast_ballot(uuid, boolean),
  public.submit_mission_result(uuid, text, jsonb),
  public.advance_phase(uuid),
  public.get_mission_state(text),
  public.get_leaderboard(text, int)
from public, anon;

grant execute on function
  public.create_mission_room(text, jsonb),
  public.join_mission_room(text, text),
  public.claim_role(uuid, text),
  public.update_design(uuid, text, jsonb, int),
  public.propose_vote(uuid, text, jsonb),
  public.cast_ballot(uuid, boolean),
  public.submit_mission_result(uuid, text, jsonb),
  public.advance_phase(uuid),
  public.get_mission_state(text),
  public.get_leaderboard(text, int)
to authenticated;
