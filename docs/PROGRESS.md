# Orbitly progress: who has done what

Last updated 12 Nov 2026. Plan and full split: [PLAN.md](PLAN.md). Hackathon: 14–15 Nov.

**Status in one line:** Adaam's part of the game (Operate, Report, team mode) works end to end with a placeholder spacecraft. It is waiting for Zakwan's Design and Launch screens and Ibad's real data, which are not started yet.

## Adaam

### Done (merged to `main`)

| PR | What | Where |
|---|---|---|
| #1, #3 | Module 3 quiz: 4 stories, 40 questions, QR join code, Supabase backend | `src/pages/games/`, `supabase/migrations/20261024000000_quiz.sql` |
| #2 | Team Claude Code skills and plugins, read-only Supabase MCP | `.claude/` |
| #4, #5 | Game plan and 3-person split | `docs/PLAN.md` |
| #6 | Team mission rooms: create/join (max 4), roles, votes, saving each role's design section, results, leaderboard | `supabase/migrations/20261107000000_mission_rooms.sql`, `src/multiplayer/missionApi.ts` |
| #7 | Operate phase: fly month by month (sun and shadow, battery, storage, downlink, budget, health), 5 random events with 2 choices each, mission log that says why | `src/game/events/`, `src/pages/mission/operate/` |
| #8 | Mission button in the navbar | `src/components/navbar/navLinks.ts` |
| #9 | Report: score out of 100 with a reason and a tip for each part, compared with the last attempt, Fly again | `src/pages/mission/report/` |
| #12 | Public leaderboard (solo and teams), post your solo score, share link with "Try to beat" compare | `supabase/migrations/20261107040000_mission_leaderboard.sql`, `src/pages/mission/leaderboard/` |
| #10 | Team mode: up to 4 phones fly one mission, lobby with QR, role cards, event votes, shared score, team leaderboard | `supabase/migrations/20261107020000_mission_ops.sql`, `src/multiplayer/`, `src/pages/mission/team/` |

**Supabase:** run the three `20261107…` files in the SQL Editor, in order (mission rooms, mission ops, mission leaderboard).

### Still to do

- Connect Operate and team mode to Zakwan's real spacecraft once Design and Launch exist (replace `PLACEHOLDER_CRAFT`).
- Team mode for Design and Launch: each role edits its own section live, the team votes to move on.
- Mobile testing and bug fixes (13 Nov). Project page and submission (14–15 Nov).

### Drafts Adaam made in other people's folders

These were written so Adaam's screens could run. The owner can change or replace them.

- `src/game/types.ts` (Zakwan): the shared shapes for parts, instruments, orbits, rockets, scenarios and the design.
- `src/game/scoring/score.ts` (Zakwan): score 40/25/20/15 with reasons.
- `src/pages/mission/operate/placeholderCraft.ts`: rough numbers until Ibad's data exists.

## Zakwan

### Done

- Started the repo: Vite + React + TypeScript + Tailwind, layout, navbar, footer, Home page (Earth scene, APOD, asteroid stats, How it works), Games and Info page shells, NASA API helper, Vercel config.
- Info page: NASA data tabs (DONKI, EONET, EPIC, images, asteroids).
- **Engine** (`src/game/engine/`): `evaluate()` checks mass, power (sun and shadow, battery), budget (build + launch + operations), data, comms range and lifetime, and explains every problem in one sentence. `buildFlight()` hands the finished design to Operate. `rollLaunch()` for launch-day problems. 17 Vitest tests (`npm test`).
- **Design** (`/mission/design`): mission, difficulty, lifetime, parts, instruments, live dashboard with expected science and "Why" warnings, "What is this?" on every card.
- **Launch** (`/mission/launch`): orbit and rocket with a fit check, launch risk, countdown, launch report.
- Solo flow now goes Design → Launch → Operate → Report → **Redesign** (`src/store/missionStore.ts`, saved in the browser).

### Still to do

- Team mode for Design and Launch (with Adaam): use `buildFlight()` instead of `PLACEHOLDER_CRAFT` in `team/`.
- Check `score.ts` weights: a mission with 70% science still scores about 90.
- Home text for the mission game, Vercel deploy.

### Notes for the team

- **Ibad:** `src/game/data/` numbers are now checked (see Ibad below).
- **Adaam:** `OperatePage` got one optional prop, `reportFooter` (for the Redesign button). `types.ts` got `Part.maxRangeKm` and `Warning.phase`.

## Ibad

### Done (by Adaam with Claude, in Ibad's folders, 12 Nov)

- `src/game/data/`: every number checked against NASA *State-of-the-Art of Small Spacecraft Technology* (2026), the CubeSat Design Specification Rev 14.1 and Rocket Lab Electron. Fixed: frame masses and how much each frame carries (3U 6 kg), solar panel masses, small rocket failure rate (4%). "STARTER" removed; each `source` names the table it comes from. Numbers NASA doesn't publish (prices, instruments) are labelled "Game estimate".
- Sources page: `/info/sources` (`src/pages/info/sources/`), every NASA dataset, report and picture we use.

### Still to do

- 30-second video and slides.
- Optional: a Solar storm scenario snapshot for offline demos.

## How to check what's new

```
git checkout main
git pull origin main
```

Then open `/mission` in the app.
