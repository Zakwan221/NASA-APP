-- Orbitly: launch together + crew chat (Zakwan)
--
-- Launch together: on the pad every crew member taps Launch. The rocket goes
-- when the whole crew is ready (the host can still "Launch now" if someone is away).
--   launch_ready: who has tapped Launch for the next roll
--   ready_to_launch(room, ready) → broadcasts 'launch_ready' {ready}, or rolls and broadcasts 'launch'
--
-- Chat: short messages for the crew, kept with the room (deleted with it after a day).
--   send_chat(room, text) → broadcasts 'chat' {id, user_id, nickname, text, created_at}
--   get_chat(room) → the last 50 messages

alter table public.mission_rooms
  add column if not exists launch_ready uuid[] not null default '{}';

-- Roll launch day and tell everyone (used by ready_to_launch and launch_mission)
create or replace function mission_private.roll_launch(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_payload jsonb;
begin
  select * into r from public.mission_rooms where id = p_room_id for update;
  update public.mission_rooms
     set launch_seed = floor(random() * 2147483647)::int,
         launch_attempt = r.attempt,
         launch_count = r.launch_count + 1,
         launch_ready = '{}'
   where id = r.id
  returning jsonb_build_object('launch_seed', launch_seed, 'launch_attempt', launch_attempt, 'launch_count', launch_count)
    into v_payload;
  perform realtime.send(v_payload, 'launch', 'mission:' || r.code, true);
  return v_payload;
end $$;

-- Any crew member on the pad: "I'm ready" (or take it back)
create or replace function public.ready_to_launch(p_room_id uuid, p_ready boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_ready uuid[];
  v_crew int;
begin
  select * into r from public.mission_rooms where id = p_room_id for update;
  if not found or not mission_private.is_member(r.id) then raise exception 'You are not in this mission'; end if;
  if r.phase <> 'launch' then raise exception 'Get to the launch pad first'; end if;

  v_ready := array_remove(r.launch_ready, auth.uid());
  if p_ready then v_ready := v_ready || auth.uid(); end if;
  -- only people still in the crew count
  select coalesce(array_agg(u), '{}') into v_ready
    from unnest(v_ready) u
   where exists (select 1 from public.mission_crew c where c.room_id = r.id and c.user_id = u);
  select count(*) into v_crew from public.mission_crew where room_id = r.id;

  if cardinality(v_ready) >= v_crew then
    return mission_private.roll_launch(r.id);
  end if;

  update public.mission_rooms set launch_ready = v_ready where id = r.id;
  perform realtime.send(jsonb_build_object('ready', to_jsonb(v_ready)), 'launch_ready', 'mission:' || r.code, true);
  return jsonb_build_object('ready', to_jsonb(v_ready));
end $$;

-- Host: launch now without waiting for everyone
create or replace function public.launch_mission(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
begin
  select * into r from public.mission_rooms where id = p_room_id;
  if not found or r.host_id is distinct from auth.uid() then raise exception 'Only the Flight Director can launch'; end if;
  if r.phase <> 'launch' then raise exception 'Get to the launch pad first'; end if;
  return mission_private.roll_launch(r.id);
end $$;

-- Host: back to Design (clears the ready list too)
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
     set phase = 'design', launch_seed = null, launch_attempt = null, launch_ready = '{}'
   where id = r.id
  returning jsonb_build_object('phase', phase, 'attempt', attempt) into v_payload;

  perform realtime.send(v_payload, 'phase', 'mission:' || r.code, true);
  return v_payload;
end $$;

/* ---------------- chat ---------------- */

create table if not exists public.mission_chat (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.mission_rooms on delete cascade,
  user_id uuid not null default auth.uid(),
  nickname text not null,
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists mission_chat_room on public.mission_chat (room_id, id);

alter table public.mission_chat enable row level security;
drop policy if exists "members can read their crew chat" on public.mission_chat;
create policy "members can read their crew chat"
  on public.mission_chat for select to authenticated
  using (mission_private.is_member(room_id));

create or replace function public.send_chat(p_room_id uuid, p_text text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.mission_rooms;
  v_nick text;
  v_text text := btrim(coalesce(p_text, ''));
  v_msg jsonb;
begin
  select * into r from public.mission_rooms where id = p_room_id;
  select nickname into v_nick from public.mission_crew where room_id = p_room_id and user_id = auth.uid();
  if r.id is null or v_nick is null then raise exception 'You are not in this mission'; end if;
  if char_length(v_text) not between 1 and 200 then raise exception 'Messages are 1 to 200 characters'; end if;
  if exists (select 1 from public.mission_chat
              where room_id = r.id and user_id = auth.uid() and created_at > now() - interval '700 milliseconds') then
    raise exception 'Slow down a little';
  end if;

  insert into public.mission_chat (room_id, user_id, nickname, text)
  values (r.id, auth.uid(), v_nick, v_text)
  returning jsonb_build_object('id', id, 'user_id', user_id, 'nickname', nickname, 'text', text, 'created_at', created_at)
    into v_msg;
  perform realtime.send(v_msg, 'chat', 'mission:' || r.code, true);
  return v_msg;
end $$;

create or replace function public.get_chat(p_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not mission_private.is_member(p_room_id) then raise exception 'You are not in this mission'; end if;
  return (
    select coalesce(jsonb_agg(m order by m.id), '[]'::jsonb)
      from (
        select id, user_id, nickname, text, created_at
          from public.mission_chat where room_id = p_room_id
         order by id desc limit 50
      ) m
  );
end $$;

/* ---------------- state: + who is ready to launch ---------------- */

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
    'launch_count', r.launch_count,
    'launch_ready', to_jsonb(r.launch_ready)
  );
end $$;

revoke execute on function mission_private.roll_launch(uuid) from public, anon, authenticated;
revoke execute on function public.ready_to_launch(uuid, boolean), public.send_chat(uuid, text), public.get_chat(uuid) from public, anon;
grant execute on function public.ready_to_launch(uuid, boolean), public.send_chat(uuid, text), public.get_chat(uuid) to authenticated;
