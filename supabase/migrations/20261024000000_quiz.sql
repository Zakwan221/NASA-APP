-- Orbitly Module 3: live multiplayer quiz
--
-- Design: Postgres is the referee. The browser never writes tables directly.
-- Every game move is a function called with supabase.rpc(), and the functions
-- broadcast game events to the room channel with realtime.send().
--
-- Realtime topic per room: 'room:<code>' (private channel)
-- Events: question, answer_count, reveal, finished

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  story text,                       -- 'solar-system', 'asteroids', 'dart', 'exoplanets'
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes on delete cascade,
  position int not null,            -- play order, starting at 0
  prompt text not null,
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 4),
  correct_index int not null,       -- never sent to players before reveal
  fact text,                        -- shown after reveal
  image_url text,
  time_limit_s int not null default 20 check (time_limit_s between 5 and 120),
  unique (quiz_id, position),
  check (correct_index >= 0 and correct_index < jsonb_array_length(choices))
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  quiz_id uuid not null references public.quizzes,
  host_id uuid not null default auth.uid(),
  status text not null default 'lobby' check (status in ('lobby', 'question', 'reveal', 'finished')),
  current_index int not null default -1,
  current_question_id uuid references public.questions,
  question_started_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.players (
  room_id uuid not null references public.rooms on delete cascade,
  user_id uuid not null default auth.uid(),
  nickname text not null check (char_length(nickname) between 1 and 16),
  score int not null default 0,
  streak int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, nickname)
);

create table public.answers (
  room_id uuid not null references public.rooms on delete cascade,
  question_id uuid not null references public.questions on delete cascade,
  user_id uuid not null,
  choice_index int not null,
  is_correct boolean not null,
  points int not null,
  answered_at timestamptz not null default now(),
  primary key (room_id, question_id, user_id)   -- one answer per question
);

create index on public.questions (quiz_id, position);
create index on public.answers (room_id, question_id);

/* ------------------------------------------------------------------ */
/* Private helpers (schema is not exposed through the API)            */
/* ------------------------------------------------------------------ */

create schema if not exists quiz_private;
revoke all on schema quiz_private from public, anon, authenticated;

-- Is the signed-in user the host or a player of this room?
create or replace function quiz_private.is_room_member(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.rooms r where r.id = p_room_id and r.host_id = (select auth.uid()))
      or exists (select 1 from public.players p where p.room_id = p_room_id and p.user_id = (select auth.uid()));
$$;

-- Same check by Realtime topic, used by the realtime.messages policies
create or replace function quiz_private.is_topic_member(p_topic text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.rooms r
     where 'room:' || r.code = p_topic
       and quiz_private.is_room_member(r.id)
  );
$$;

-- Every player with score and rank, best first
create or replace function quiz_private.scores(p_room_id uuid, p_question_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(s) order by s.rank, s.nickname), '[]'::jsonb)
    from (
      select p.user_id,
             p.nickname,
             p.score,
             p.streak,
             rank() over (order by p.score desc)::int as rank,
             coalesce(a.points, 0) as last_points,
             coalesce(a.is_correct, false) as last_correct
        from public.players p
        left join public.answers a
          on a.room_id = p.room_id and a.user_id = p.user_id and a.question_id = p_question_id
       where p.room_id = p_room_id
    ) s;
$$;

-- A question as players may see it: no correct_index, no fact
create or replace function quiz_private.public_question(q public.questions, p_index int, p_total int, p_started_at timestamptz)
returns jsonb
language sql immutable
as $$
  select jsonb_build_object(
    'question_id', q.id,
    'index', p_index,
    'total', p_total,
    'prompt', q.prompt,
    'choices', q.choices,
    'image_url', q.image_url,
    'time_limit_s', q.time_limit_s,
    'started_at', p_started_at
  );
$$;

-- What everyone sees at reveal: the answer, the fact, how many picked each choice
create or replace function quiz_private.reveal_payload(p_room_id uuid, q public.questions, p_is_last boolean)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'question_id', q.id,
    'correct_index', q.correct_index,
    'fact', q.fact,
    'counts', (
      select coalesce(jsonb_agg(c.n order by c.i), '[]'::jsonb)
        from (
          select i, (select count(*) from public.answers a
                      where a.room_id = p_room_id and a.question_id = q.id and a.choice_index = i)::int as n
            from generate_series(0, jsonb_array_length(q.choices) - 1) as i
        ) c
    ),
    'is_last', p_is_last,
    'scores', quiz_private.scores(p_room_id, q.id)
  );
$$;

-- Delete rooms older than a day (and their players and answers). Run by hand or with pg_cron.
create or replace function quiz_private.cleanup_old_rooms()
returns int
language sql security definer set search_path = ''
as $$
  with gone as (delete from public.rooms where created_at < now() - interval '1 day' returning 1)
  select count(*)::int from gone;
$$;

/* ------------------------------------------------------------------ */
/* Row Level Security: read only where harmless, never write          */
/* ------------------------------------------------------------------ */

alter table public.quizzes   enable row level security;
alter table public.questions enable row level security;  -- no policies: answers stay secret
alter table public.rooms     enable row level security;
alter table public.players   enable row level security;
alter table public.answers   enable row level security;  -- no policies: read through functions

create policy "signed-in users can list quizzes"
  on public.quizzes for select to authenticated
  using (true);

create policy "members can read their room"
  on public.rooms for select to authenticated
  using (quiz_private.is_room_member(id));

create policy "members can read players in their room"
  on public.players for select to authenticated
  using (quiz_private.is_room_member(room_id));

-- Private Realtime channel 'room:<code>': members receive broadcasts and presence ...
create policy "orbitly room members can receive"
  on realtime.messages for select to authenticated
  using (quiz_private.is_topic_member((select realtime.topic())));

-- ... and may send presence (lobby), but not broadcasts: only the functions below broadcast
create policy "orbitly room members can track presence"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and quiz_private.is_topic_member((select realtime.topic()))
  );

/* ------------------------------------------------------------------ */
/* Game functions (call with supabase.rpc)                             */
/* ------------------------------------------------------------------ */

-- Host: make a room with a fresh 6-digit code
create or replace function public.create_room(p_quiz_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
  v_room_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.questions where quiz_id = p_quiz_id) then
    raise exception 'That quiz has no questions';
  end if;

  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;

  insert into public.rooms (code, quiz_id, host_id)
  values (v_code, p_quiz_id, auth.uid())
  returning id into v_room_id;

  return jsonb_build_object('room_id', v_room_id, 'code', v_code);
end $$;

-- Player: join a room in the lobby. Calling it again from the same user rejoins.
create or replace function public.join_room(p_code text, p_nickname text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.rooms;
  v_nickname text := btrim(p_nickname);
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;

  select * into r from public.rooms where code = btrim(p_code);
  if not found then raise exception 'No room with that code'; end if;

  if exists (select 1 from public.players where room_id = r.id and user_id = auth.uid()) then
    return jsonb_build_object('room_id', r.id, 'code', r.code, 'rejoined', true);
  end if;

  if r.status <> 'lobby' then raise exception 'This game has already started'; end if;
  if char_length(v_nickname) not between 1 and 16 then
    raise exception 'Nickname must be 1 to 16 characters';
  end if;

  begin
    insert into public.players (room_id, user_id, nickname) values (r.id, auth.uid(), v_nickname);
  exception when unique_violation then
    raise exception 'That nickname is taken, try another';
  end;

  return jsonb_build_object('room_id', r.id, 'code', r.code, 'rejoined', false);
end $$;

-- Host: open the next question, or finish after the last one
create or replace function public.start_question(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.rooms;
  q public.questions;
  v_total int;
  v_next int;
  v_payload jsonb;
begin
  select * into r from public.rooms where id = p_room_id for update;
  if not found or r.host_id is distinct from auth.uid() then
    raise exception 'Only the host can do that';
  end if;
  if r.status not in ('lobby', 'reveal') then
    raise exception 'Cannot move on right now';
  end if;

  select count(*) into v_total from public.questions where quiz_id = r.quiz_id;
  v_next := r.current_index + 1;

  if v_next >= v_total then
    update public.rooms set status = 'finished' where id = r.id;
    v_payload := jsonb_build_object('scores', quiz_private.scores(r.id, r.current_question_id));
    perform realtime.send(v_payload, 'finished', 'room:' || r.code, true);
    return v_payload || jsonb_build_object('status', 'finished');
  end if;

  select * into q from public.questions
   where quiz_id = r.quiz_id
   order by position
   offset v_next limit 1;

  update public.rooms
     set status = 'question',
         current_index = v_next,
         current_question_id = q.id,
         question_started_at = now()
   where id = r.id;

  v_payload := quiz_private.public_question(q, v_next, v_total, now());
  perform realtime.send(v_payload, 'question', 'room:' || r.code, true);
  return v_payload || jsonb_build_object('status', 'question');
end $$;

-- Player: answer the open question. Scored here with the server clock.
-- Kahoot formula: round(1000 * (1 - (t / limit) / 2)), plus +100 per streak step (max +500).
-- Points are only stored here; reveal() adds them to the scores, so nobody learns early.
create or replace function public.submit_answer(p_room_id uuid, p_choice int)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.rooms;
  q public.questions;
  p public.players;
  v_elapsed numeric;
  v_correct boolean;
  v_points int := 0;
  v_answered int;
begin
  select * into r from public.rooms where id = p_room_id;
  if not found or r.status is distinct from 'question' then
    raise exception 'This question is closed';
  end if;

  select * into p from public.players where room_id = p_room_id and user_id = auth.uid();
  if not found then raise exception 'You are not in this room'; end if;

  select * into q from public.questions where id = r.current_question_id;
  if p_choice < 0 or p_choice >= jsonb_array_length(q.choices) then
    raise exception 'Invalid choice';
  end if;

  v_elapsed := extract(epoch from clock_timestamp() - r.question_started_at);
  if v_elapsed > q.time_limit_s + 1 then           -- 1 s grace for slow networks
    raise exception 'Too late!';
  end if;

  v_correct := p_choice = q.correct_index;
  if v_correct then
    -- p.streak counts correct answers in a row before this question
    v_points := round(1000 * (1 - least(v_elapsed / q.time_limit_s, 1) / 2))::int
              + least(p.streak, 5) * 100;
  end if;

  begin
    insert into public.answers (room_id, question_id, user_id, choice_index, is_correct, points)
    values (p_room_id, q.id, auth.uid(), p_choice, v_correct, v_points);
  exception when unique_violation then
    raise exception 'You already answered';
  end;

  select count(*) into v_answered from public.answers
   where room_id = p_room_id and question_id = q.id;
  perform realtime.send(
    jsonb_build_object('question_id', q.id, 'answered', v_answered,
                       'players', (select count(*) from public.players where room_id = p_room_id)),
    'answer_count', 'room:' || r.code, true);

  -- the result stays secret until reveal, for everyone at once
  return jsonb_build_object('received', true);
end $$;

-- Host: close the question and show the answer, the fact and the scores
create or replace function public.reveal(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.rooms;
  q public.questions;
  v_total int;
  v_payload jsonb;
begin
  select * into r from public.rooms where id = p_room_id for update;
  if not found or r.host_id is distinct from auth.uid() then
    raise exception 'Only the host can do that';
  end if;
  if r.status <> 'question' then raise exception 'No open question'; end if;

  select * into q from public.questions where id = r.current_question_id;
  select count(*) into v_total from public.questions where quiz_id = r.quiz_id;

  update public.rooms set status = 'reveal' where id = r.id;

  -- add this round's points; a wrong or missing answer breaks the streak
  update public.players pl
     set score = pl.score + coalesce(a.points, 0),
         streak = case when a.is_correct then pl.streak + 1 else 0 end
    from public.players me
    left join public.answers a
      on a.room_id = me.room_id and a.question_id = q.id and a.user_id = me.user_id
   where pl.room_id = r.id
     and me.room_id = pl.room_id and me.user_id = pl.user_id;

  v_payload := quiz_private.reveal_payload(r.id, q, r.current_index >= v_total - 1);
  perform realtime.send(v_payload, 'reveal', 'room:' || r.code, true);
  return v_payload;
end $$;

-- Anyone in the room: everything needed to draw the right screen after a load or reconnect
create or replace function public.get_room_state(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.rooms;
  q public.questions;
  v_total int;
  v_me public.players;
  v_my_choice int;
  v_state jsonb;
begin
  select * into r from public.rooms where code = btrim(p_code);
  if not found or not quiz_private.is_room_member(r.id) then
    raise exception 'No room with that code';
  end if;

  select count(*) into v_total from public.questions where quiz_id = r.quiz_id;
  select * into v_me from public.players where room_id = r.id and user_id = auth.uid();

  v_state := jsonb_build_object(
    'room_id', r.id,
    'code', r.code,
    'quiz_title', (select title from public.quizzes where id = r.quiz_id),
    'status', r.status,
    'is_host', r.host_id = auth.uid(),
    'total', v_total,
    'current_index', r.current_index,
    'server_now', clock_timestamp(),
    'me', case when v_me.user_id is null then null
               else jsonb_build_object('nickname', v_me.nickname, 'score', v_me.score, 'streak', v_me.streak) end,
    -- while a question is open, show scores from before it
    'scores', quiz_private.scores(r.id, case when r.status = 'question' then null else r.current_question_id end)
  );

  if r.status in ('question', 'reveal') then
    select * into q from public.questions where id = r.current_question_id;
    select choice_index into v_my_choice from public.answers
     where room_id = r.id and question_id = q.id and user_id = auth.uid();
    v_state := v_state || jsonb_build_object(
      'question', quiz_private.public_question(q, r.current_index, v_total, r.question_started_at),
      'my_choice', v_my_choice,
      'answered', (select count(*) from public.answers where room_id = r.id and question_id = q.id)
    );
  end if;

  if r.status = 'reveal' then
    v_state := v_state || jsonb_build_object(
      'reveal', quiz_private.reveal_payload(r.id, q, r.current_index >= v_total - 1));
  end if;

  return v_state;
end $$;

/* ------------------------------------------------------------------ */
/* Permissions: signed-in users (anonymous included) may call the     */
/* game functions; the logged-out anon key may not                    */
/* ------------------------------------------------------------------ */

revoke execute on all functions in schema quiz_private from public, anon, authenticated;

-- RLS policies run as the signed-in user, so they need these two checks.
-- quiz_private is not an API schema, so this does not expose them as RPC.
grant usage on schema quiz_private to authenticated;
grant execute on function
  quiz_private.is_room_member(uuid),
  quiz_private.is_topic_member(text)
to authenticated;

revoke execute on function
  public.create_room(uuid),
  public.join_room(text, text),
  public.start_question(uuid),
  public.submit_answer(uuid, int),
  public.reveal(uuid),
  public.get_room_state(text)
from public, anon;

grant execute on function
  public.create_room(uuid),
  public.join_room(text, text),
  public.start_question(uuid),
  public.submit_answer(uuid, int),
  public.reveal(uuid),
  public.get_room_state(text)
to authenticated;
