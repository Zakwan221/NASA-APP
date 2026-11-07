# Orbitly progress: who has done what

Last updated 7 Nov 2026. Plan and full split: [PLAN.md](PLAN.md). Hackathon: 14–15 Nov.

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
| #10 | Team mode: up to 4 phones fly one mission, lobby with QR, role cards, event votes, shared score, team leaderboard | `supabase/migrations/20261107020000_mission_ops.sql`, `src/multiplayer/`, `src/pages/mission/team/` |

**Supabase:** run both `20261107…` files in the SQL Editor (mission rooms, then mission ops). Team mode needs both.

### Still to do

- Connect Operate and team mode to Zakwan's real spacecraft once Design and Launch exist (replace `PLACEHOLDER_CRAFT`).
- Team mode for Design and Launch: each role edits its own section live, the team votes to move on.
- Save, share and compare missions; public leaderboard page.
- Mobile testing and bug fixes (13 Nov). Project page and submission (14–15 Nov).

### Drafts Adaam made in other people's folders

These were written so Adaam's screens could run. The owner can change or replace them.

- `src/game/types.ts` (Zakwan): the shared shapes for parts, instruments, orbits, rockets, scenarios and the design.
- `src/game/scoring/score.ts` (Zakwan): score 40/25/20/15 with reasons.
- `src/pages/mission/operate/placeholderCraft.ts`: rough numbers until Ibad's data exists.

## Zakwan

### Done

- Started the repo: Vite + React + TypeScript + Tailwind, layout, navbar, footer, Home page (Earth scene, APOD, asteroid stats, How it works), Games and Info page shells, NASA API helper, Vercel config.

### Still to do

- Check and own `src/game/types.ts` and `src/game/scoring/score.ts`.
- Engine: mass, power, budget, data, comms and lifetime checks, with warnings that say why (`src/game/engine/`), plus tests.
- Design screen with a live resource dashboard (`src/pages/mission/design/`).
- Launch screen: rocket and orbit fit check, launch-day risk (`src/pages/mission/launch/`).
- Hand the designed spacecraft to Operate, and the Redesign loop from the Report.
- Difficulty levels, Home text, Vercel deploy.

## Ibad

### Done

- Nothing in the repo yet.

### Still to do

- Data tables with sourced numbers in `src/game/data/`: parts, instruments, orbits, rockets (NASA *Small Spacecraft Technology State of the Art*).
- Scenarios: Earth watch (Malaysia haze, EONET/EPIC) first, then Solar storm (DONKI/SDO). Saved JSON snapshots for offline demos.
- "What is this?" text for every part, orbit and resource.
- Learn page and Sources page (`src/pages/info/`).
- 30-second video and slides.

## How to check what's new

```
git checkout main
git pull origin main
```

Then open `/mission` in the app.
