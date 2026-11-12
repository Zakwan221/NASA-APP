-- Orbitly: team launch day (Zakwan)
--
-- In team play the crew designs one spacecraft together, then the Flight
-- Director (host) presses Launch. Every phone must see the SAME launch, so the
-- server picks a random seed and broadcasts it; each phone turns the seed into
-- the launch outcome with rollLaunch() (src/game/engine/launch.ts).
--
-- launch_seed / launch_attempt: the latest roll, and which attempt it belongs to
-- (a roll from an earlier attempt is ignored by the screens).
-- launch_count: how many times this crew has pressed Launch (a failed rocket
-- can be tried again).
--
-- New broadcast event on 'mission:<code>': launch {launch_seed, launch_attempt, launch_count}

alter table public.mission_rooms
  add column if not exists launch_seed int,
  add column if not exists launch_attempt int,
  add column if not exists launch_count int not null default 0;

-- Host (Flight Director): roll launch day. Only on the launch pad.
create or replace function public.launch_mission(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_payload jsonb;
begin
  select * into r from public.mission_rooms where id = p_room_id for update;
  if not found or r.host_id is distinct from auth.uid() then raise exception 'Only the Flight Director can launch'; end if;
  if r.phase <> 'launch' then raise exception 'Get to the launch pad first'; end if;

  update public.mission_rooms
     set launch_seed = floor(random() * 2147483647)::int,
         launch_attempt = r.attempt,
         launch_count = r.launch_count + 1
   where id = r.id
  returning jsonb_build_object('launch_seed', launch_seed, 'launch_attempt', launch_attempt, 'launch_count', launch_count)
    into v_payload;

  perform realtime.send(v_payload, 'launch', 'mission:' || r.code, true);
  return v_payload;
end $$;

-- Host: leave the launch pad and go back to Design (e.g. after a failed launch).
create or replace function public.back_to_design(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_payload jsonb;
begin
  select * into r from public.mission_rooms where id = p_room_id for update;
  if not found or r.host_id is distinct from auth.uid() then raise exception 'Only the host can do that'; end if;
  if r.phase <> 'launch' then raise exception 'You can only go back from the launch pad'; end if;

  update public.mission_votes set status = 'failed', closed_at = now() where room_id = r.id and status = 'open';
  update public.mission_rooms
     set phase = 'design', launch_seed = null, launch_attempt = null
   where id = r.id
  returning jsonb_build_object('phase', phase, 'attempt', attempt) into v_payload;

  perform realtime.send(v_payload, 'phase', 'mission:' || r.code, true);
  return v_payload;
end $$;

-- Same as before, plus the launch roll
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
                  from public.mission_results m where m.room_id = r.id),
    'launch_seed', case when r.launch_attempt = r.attempt then r.launch_seed end,
    'launch_count', r.launch_count
  );
end $$;

revoke execute on function public.launch_mission(uuid), public.back_to_design(uuid) from public, anon;
grant execute on function public.launch_mission(uuid), public.back_to_design(uuid) to authenticated;
