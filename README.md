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
│   └── nasa.ts              # shared NASA API calls (APOD, asteroids) + 1h cache
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
    │   └── components/      # Hero, EarthScene, AsteroidStat, ApodSection, HowItWorks
    ├── info/                # Module 2 – NASA stories ("/info")
    │   ├── InfoPage.tsx
    │   └── components/
    └── games/               # Module 3 – multiplayer quiz ("/games")
        ├── GamesPage.tsx
        └── components/
```

Add a page: create `src/pages/<name>/`, add a route in `App.tsx`, add a link in `components/navbar/navLinks.ts`.

## Tech

React + Vite + TypeScript · Tailwind CSS v4 · React Router · React Three Fiber · Framer Motion
