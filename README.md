# Orbitly

Explore space. Play with friends. A mobile-first web app built on NASA Open APIs.

## Run it

```bash
npm install
cp .env.example .env      # then put your key from https://api.nasa.gov in .env
npm run dev               # desktop
npm run dev -- --host     # open the Network URL on your phone (same Wi-Fi)
```

## Folder structure

```
src/
├── App.tsx                  # routes
├── main.tsx
├── index.css                # Tailwind + theme colors/fonts
├── lib/
│   ├── nasa.ts              # shared NASA API calls (APOD, asteroids) + 1h cache
│   └── supabase.ts          # shared Supabase client + anonymous sign-in
├── hooks/
│   └── useAsync.ts          # loading / error / success state
├── components/              # shared across all pages
│   ├── navbar/              # top navbar (Navbar, Logo, navLinks)
│   ├── footer/
│   ├── layout/              # Navbar + page + Footer shell
│   └── ui/                  # Section, Skeleton, ComingSoon, ErrorMessage...
└── pages/
    ├── home/                # Module 1 – Home page  ("/")
    │   ├── HomePage.tsx
    │   ├── components/      # Hero, EarthScene, AsteroidStat, ApodSection, HowItWorks
    │   └── assets/          # earth.jpg (home-only images)
    ├── info/                # Module 2 – NASA stories ("/info")
    │   ├── InfoPage.tsx
    │   └── components/
    └── games/               # Module 3 – multiplayer quiz ("/games")
        ├── GamesPage.tsx
        ├── api/quizApi.ts   # typed calls to the quiz functions + realtime
        └── components/
supabase/                    # quiz database: migration, seed, setup steps (see supabase/README.md)
```

## Team split (3 people)

Each person owns one folder and only edits inside it:

| Module | Folder | Route |
|---|---|---|
| 1 – Home | `src/pages/home/` | `/` |
| 2 – Info | `src/pages/info/` | `/info` |
| 3 – Games | `src/pages/games/` | `/games` |

- Page-only components, images and data go in your page folder (`components/`, `assets/`). Import images, don't put them in `public/`.
- Shared files (`lib/`, `hooks/`, `components/`, `index.css`, `App.tsx`, `navLinks.ts`) affect everyone — tell the team before changing them.
- Need a new NASA call? Add it to `lib/nasa.ts` so other pages can reuse it.

Add a page: create `src/pages/<name>/`, add a route in `App.tsx`, add a link in `components/navbar/navLinks.ts`.

## Tech

React + Vite + TypeScript · Tailwind CSS v4 · React Router · React Three Fiber · Framer Motion
