# Orbitly: Space Mission Design Game plan

NASA Space Apps Challenge 2026, Kuala Lumpur. Hackathon **14–15 Nov 2026**, submit before 11:59 pm on 15 Nov.

Challenge page: https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/
Difficulty tags: Intermediate, Beginner/Youth. Subject: Games.

## 1. What the challenge asks for (summary)

Build an interactive game where players design, launch and run a **complete space mission**, make engineering decisions, manage limited resources, and see how each choice changes the result.

- **Players:** solo, or a team of **up to 4**. Each team member can have a role (mission planning, spacecraft design, science, communications, resource management). Teams decide together and sometimes have to negotiate.
- **Mission design:** pick an objective first. Every big decision has a consequence (more instruments = more science, but more mass, power, cost and data). There is rarely one perfect answer.
- **Spacecraft:** structure, power, batteries, comms, computer, attitude control, instruments. Simple or advanced parts depending on difficulty.
- **Orbit and launch:** several orbits with simple explanations. Rockets with different capacity, cost and reachable orbits. Check that the spacecraft fits the rocket for that orbit.
- **Resources to show clearly:** mass, power, budget, data, communications, time (lifetime). Say which ones matter most for the mission.
- **Learning:** simple words, concepts taught inside the game, explain *why* a choice worked or failed, not just right/wrong.
- **Replay:** let players change the design and simulate again.
- **Ideas they list:** several scenarios, random events, difficulty levels, spacecraft visuals, live resource dashboard, leaderboard, end-of-mission report, save/share/compare designs, co-op for 4, competitive teams, sandbox mode, post-mission analysis.

Judging (equal weight): Influence, Creativity, Validity, Relevance, Presentation. NASA data must be used and cited for global awards.

## 2. The game: one mission, three phases

We are **not** starting from zero. We keep the same repo, stack, Supabase project and Vercel setup. The quiz stays as a bonus "Mission briefing".

The core is **one connected mission** that carries the same spacecraft through three phases:

1. **Design** – choose a scenario and objective, set requirements, build the spacecraft from parts, pick instruments. A live dashboard shows mass, power, budget, data, comms and lifetime, with warnings that explain why.
2. **Launch** – choose an orbit (LEO, sun-synchronous, GEO, L1, deep space) and a rocket. The game checks that the spacecraft's mass fits the rocket for that orbit. Countdown with random launch events.
3. **Operate** – run the mission turn by turn. Power changes in sunlight and shadow, data fills up and is sent during ground station passes, and the budget runs down. Random events such as a solar storm (real DONKI data), a debris warning or an instrument failure.
4. **Report** – score plus a clear explanation of which earlier choice caused what. Then **Redesign and fly again**, keeping the old score so players can compare.

### Scenarios (live NASA data, with a saved snapshot as fallback)

| Scenario | Objective | NASA data |
|---|---|---|
| Earth watch (build first) | Track haze and wildfires near Malaysia | EONET, EPIC |
| Solar storm watch | Warn Earth about solar storms | SDO, DONKI |
| Asteroid scout | Visit a near-Earth asteroid | NeoWs |

### Team roles (up to 4)

| Role | Controls | Personal goal |
|---|---|---|
| Mission Planner | Objective, budget | Finish with budget ≥ 0 |
| Spacecraft Engineer | Structure, power, battery | Power margin ≥ 10% |
| Science Lead | Instruments, data | Science value ≥ target |
| Comms & Ops | Radio, orbit, ground passes | All data sent home |

Big decisions need a team vote. Modes: **Solo**, **Pass-and-play** (one device), **Online room** (code + QR, reusing the quiz's Supabase rooms).

### Scoring (out of 100)

| Part | Points | How |
|---|---|---|
| Mission success | 40 | Objective met for the planned lifetime |
| Science value | 25 | Sum of instrument science returned |
| Resource efficiency | 20 | Margins used well, not wasted or exceeded |
| Teamwork | 15 | Role goals met + votes followed. In solo, this becomes decision quality |

Difficulty: Cadet (simple parts, hints), Engineer, Director (tight budget, more events), plus Sandbox with no limits.

## 3. Stack and folders

React + Vite + TypeScript, Tailwind v4, Framer Motion, React Router, Zustand, Supabase (anon auth, Postgres RPCs, Realtime), Vitest for engine tests, React Three Fiber only if time allows. Deploy on Vercel.

```
src/
  game/            data/ (parts, instruments, orbits, rockets), engine/, scoring/, events/
  store/           missionStore.ts
  pages/
    home/          landing, rewritten for "Design your own space mission"
    mission/       design/, launch/, operate/, report/
    games/         existing quiz (bonus Mission briefing)
    info/          Learn page: collects the in-game explanations
supabase/migrations/  mission rooms, roles, votes
docs/            this plan
```

## 4. Who does what (7–15 Nov)

Three people, each owning their own folders so we don't step on each other.

| Person | Owns | Folders |
|---|---|---|
| **Zakwan** | Game engine (rules, resource maths, scoring, tests), Design and Launch phases, dashboard, Home text | `src/game/engine/`, `src/game/scoring/`, `src/store/`, `src/pages/mission/design/`, `src/pages/mission/launch/`, `src/pages/home/` |
| **Adaam** | Supabase mission rooms, roles, votes, Operate phase, random events, Report, online team mode, leaderboard, save/share | `supabase/migrations/`, `src/multiplayer/`, `src/game/events/`, `src/pages/mission/operate/`, `src/pages/mission/report/`, `src/pages/games/` |
| **Ibad** | Data tables from NASA sources, scenarios, NASA API snapshots, in-game "What is this?" explanations, Learn page, Sources page, video and slides lead | `src/game/data/`, `src/pages/info/`, `docs/` |

**Shared contract (agree on 7 Nov):** the shape of a part, instrument, orbit, rocket and scenario in `src/game/types.ts`. Zakwan writes it, Ibad fills the data, Adaam stores it in Supabase. Change it only with a heads-up to everyone.

| Dates | Zakwan | Adaam | Ibad |
|---|---|---|---|
| 7 Nov | Write `types.ts` with the team | Mission room tables + RLS | List parts, instruments, orbits, rockets with numbers from the NASA report |
| 8 Nov | Engine: mass, power, budget, data, lifetime + Vitest | Roles, votes, room join (reuse quiz code) | Earth watch scenario + EONET/EPIC snapshot JSON |
| 9–10 Nov | Design + Launch phases, live dashboard, rocket fit check | Operate phase (turns, sun/shadow, ground passes) + random events | Explanations for every part, orbit and resource; warning texts that say why |
| 11 Nov | Connect phases, redesign loop | Report + online team mode | Learn page + Sources page |
| 12 Nov | Home text, difficulty levels | Leaderboard, save/share/compare, mobile testing | 2nd scenario data (Solar storm, DONKI/SDO) + start video script |
| 13 Nov | Bug fixes | Bug fixes | Test full game as a new player, write bug list |
| 14–15 Nov | Demo walkthrough | Project page + submit | 30 s video, slides |

## 5. Rules for us

- Part and instrument numbers come from NASA's *Small Spacecraft Technology State of the Art* report. Cite it and every API on a Sources page.
- Keep a JSON snapshot of each live API response so the demo works offline or when rate-limited.
- Every warning explains **why** in one sentence.
- Each person edits their own folders; shared files (`lib/`, `components/`, `App.tsx`, `index.css`) need a heads-up.
- Never commit `.env` or the Supabase secret key.

## 6. Still open

- Read the challenge's **Resources** tab and add the suggested NASA datasets here.
- Confirm in writing with the KL organiser that code written before 14 Nov is allowed (team believes yes).
