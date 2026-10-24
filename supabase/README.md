# Supabase (Module 3 quiz)

The quiz runs on Supabase: anonymous sign-in for players, Postgres for the game state and scoring, and Realtime for live events.

## One-time setup

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor**: paste and run `migrations/20261024000000_quiz.sql`, then `seed.sql`.
3. **Authentication > Sign In / Providers**: turn on **Allow anonymous sign-ins**.
4. **Authentication > Rate Limits**: raise **anonymous sign-ins** (default is 30 per hour per IP; players on one Wi-Fi share an IP). A few hundred is fine.
5. **Realtime > Settings**: make sure private channels are allowed (turn off "Allow public access" if you see it).
6. **Project Settings > API**: copy the project URL and the anon/publishable key into your `.env`:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```

   Never put the `service_role` / secret key in the app.

## How the game works

The browser never writes tables. Every move is a Postgres function called with `supabase.rpc()` (see `src/pages/games/api/quizApi.ts`):

| Function | Who | What |
|---|---|---|
| `create_room(p_quiz_id)` | Host | New room with a 6-digit code |
| `join_room(p_code, p_nickname)` | Player | Join while in the lobby (calling again rejoins) |
| `start_question(p_room_id)` | Host | Next question, or `finished` after the last |
| `submit_answer(p_room_id, p_choice)` | Player | Scored with the server clock, one answer per question |
| `reveal(p_room_id)` | Host | Correct answer, fact, counts, scores |
| `get_room_state(p_code)` | Anyone in the room | Everything needed to redraw after a refresh or reconnect |

The functions broadcast to the private channel `room:<code>` with events `question`, `answer_count`, `reveal` and `finished`. Presence on the same channel shows who is in the lobby.

Room states: `lobby` → `question` → `reveal` → `question` … → `finished`.

Scoring (Kahoot formula): a correct answer earns `round(1000 × (1 − (seconds ÷ limit) ÷ 2))`, so 500 to 1000 points, plus +100 for each correct answer in a row before it (max +500). Points are added to the scores at reveal, so nobody learns their result early.

## Housekeeping

- Delete old rooms: `select quiz_private.cleanup_old_rooms();`
- Free projects pause after about a week with no activity. Open the app every few days, especially during judging (16–21 Nov).
