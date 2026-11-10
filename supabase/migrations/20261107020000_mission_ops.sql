-- Orbitly: team play for the Operate phase (Adaam)
--
-- Every phone runs the same simulation (src/game/events/operate.ts). It is
-- deterministic: the same seed plus the same list of moves always gives the
-- same mission. So the server only stores the seed and the moves ("ops"),
-- checks who may make each move, and broadcasts them as 'op' events. Each phone
-- replays them and shows the same months, events and score.
--
-- Moves:
--   toggle  {instrumentId, on}  Science Lead (or the host when nobody is)
--   fly     {month}             host (Flight Director)
--   choice  {choice, month}     added by the server when an 'event' vote passes,
--                               or by the host to decide without a vote

alter table public.mission_rooms add column if not exists ops_seed int;

create table public.mission_ops (
  id bigint generated always as identity primary key,  -- replay order
  room_id uuid not null references public.mission_rooms on delete cascade,
  attempt int not null,
  kind text not null check (kind in ('toggle', 'fly', 'choice')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  by uuid not null,
  created_at timestamptz not null default now()
);
create index on public.mission_ops (room_id, attempt, id);

alter table public.mission_ops enable row level security;
create policy "members can read their mission moves"
  on public.mission_ops for select to authenticated
  using (mission_private.is_member(room_id));

/* ------------------------------------------------------------------ */

create or replace function mission_private.insert_op(p_room public.mission_rooms, p_kind text, p_payload jsonb, p_by uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_op jsonb;
begin
  insert into public.mission_ops (room_id, attempt, kind, payload, by)
  values (p_room.id, p_room.attempt, p_kind, p_payload, p_by)
  returning jsonb_build_object('id', id, 'attempt', attempt, 'kind', kind, 'payload', payload, 'by', by)
    into v_op;
  perform realtime.send(v_op, 'op', 'mission:' || p_room.code, true);
  return v_op;
end $$;

-- Host: start flying. Works from the lobby, design or launch (Design and Launch
-- screens are not built yet). Picks a fresh seed for this attempt.
create or replace function public.start_operate(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_payload jsonb;
begin
  select * into r from public.mission_rooms where id = p_room_id for update;
  if not found or r.host_id is distinct from auth.uid() then raise exception 'Only the host can do that'; end if;
  if r.phase not in ('lobby', 'design', 'launch') then raise exception 'The mission is already flying'; end if;

  update public.mission_votes set status = 'failed', closed_at = now() where room_id = r.id and status = 'open';
  update public.mission_rooms
     set phase = 'operate', ops_seed = floor(random() * 2147483647)::int
   where id = r.id
  returning jsonb_build_object('phase', phase, 'attempt', attempt, 'ops_seed', ops_seed) into v_payload;

  perform realtime.send(v_payload, 'phase', 'mission:' || r.code, true);
  return v_payload;
end $$;

-- Crew member: make a move during Operate
create or replace function public.add_mission_op(p_room_id uuid, p_kind text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_science uuid;
begin
  select * into r from public.mission_rooms where id = p_room_id for update;
  if not found or not exists (select 1 from public.mission_crew where room_id = p_room_id and user_id = auth.uid()) then
    raise exception 'You are not in this mission';
  end if;
  if r.phase <> 'operate' then raise exception 'The mission is not flying'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text) > 500 then
    raise exception 'Invalid move';
  end if;

  if p_kind = 'toggle' then
    select user_id into v_science from public.mission_crew where room_id = r.id and role = 'science';
    if v_science is distinct from auth.uid() and not (v_science is null and r.host_id = auth.uid()) then
      raise exception 'Only the Science Lead can switch instruments';
    end if;
  elsif p_kind in ('fly', 'choice') then
    if r.host_id is distinct from auth.uid() then raise exception 'Only the host can do that'; end if;
    if p_kind = 'fly' and exists (select 1 from public.mission_votes where room_id = r.id and status = 'open') then
      raise exception 'Finish the vote first';
    end if;
    if p_kind = 'choice' then
      update public.mission_votes set status = 'failed', closed_at = now() where room_id = r.id and status = 'open';
    end if;
  else
    raise exception 'Unknown move';
  end if;

  return mission_private.insert_op(r, p_kind, p_payload, auth.uid());
end $$;

-- Anyone in the room: the seed and all moves of the current attempt, to replay
create or replace function public.get_mission_ops(p_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
begin
  select * into r from public.mission_rooms where id = p_room_id;
  if not found or not mission_private.is_member(r.id) then raise exception 'You are not in this mission'; end if;
  return jsonb_build_object(
    'attempt', r.attempt,
    'ops_seed', r.ops_seed,
    'ops', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'attempt', o.attempt, 'kind', o.kind,
                                                         'payload', o.payload, 'by', o.by) order by o.id), '[]'::jsonb)
              from public.mission_ops o where o.room_id = r.id and o.attempt = r.attempt)
  );
end $$;

-- Same as before, plus: a passed 'event' vote during Operate becomes a 'choice' move
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
  elsif v_no * 2 >= v_crew then v_status := 'failed';
  else v_status := 'open';
  end if;

  if v_status <> 'open' then
    update public.mission_votes set status = v_status, closed_at = now() where id = v.id;
  end if;

  v_payload := mission_private.vote_payload(v.id);
  perform realtime.send(v_payload, 'vote', 'mission:' || r.code, true);

  if v_status = 'passed' and v.topic = 'advance' then
    perform mission_private.advance(r.id);
  elsif v_status = 'passed' and v.topic = 'event' and r.phase = 'operate' then
    perform mission_private.insert_op(r, 'choice', v.proposal, v.proposed_by);
  end if;
  return v_payload;
end $$;

revoke execute on function mission_private.insert_op(public.mission_rooms, text, jsonb, uuid) from public, anon, authenticated;

revoke execute on function
  public.start_operate(uuid),
  public.add_mission_op(uuid, text, jsonb),
  public.get_mission_ops(uuid)
from public, anon;

grant execute on function
  public.start_operate(uuid),
  public.add_mission_op(uuid, text, jsonb),
  public.get_mission_ops(uuid)
to authenticated;
