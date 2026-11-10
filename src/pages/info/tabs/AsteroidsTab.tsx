import { useMemo, useState } from 'react'
import Skeleton from '../../../components/ui/Skeleton'
import { getWeekAsteroids, type WeekAsteroid } from '../api/neows'
import Chip from '../components/Chip'
import DataSource from '../components/DataSource'
import LoadState from '../components/LoadState'
import Stat from '../components/Stat'
import TabHeader from '../components/TabHeader'
import { useInfoData } from '../hooks/useInfoData'
import { fmt, formatDate } from '../utils/format'

/** Familiar sizes for comparison (metres) */
const LANDMARKS = [
  { name: 'City bus', m: 12, icon: '🚌' },
  { name: 'Blue whale', m: 30, icon: '🐋' },
  { name: 'Boeing 747', m: 70, icon: '✈️' },
  { name: 'Football field', m: 105, icon: '🏟️' },
  { name: 'KL Tower', m: 421, icon: '🗼' },
  { name: 'Petronas Towers', m: 452, icon: '🏙️' },
  { name: 'Burj Khalifa', m: 828, icon: '🌆' },
]

type SortKey = 'closest' | 'biggest' | 'fastest'

const SORTS: Record<SortKey, (a: WeekAsteroid, b: WeekAsteroid) => number> = {
  closest: (a, b) => a.missKm - b.missKm,
  biggest: (a, b) => b.diameterM - a.diameterM,
  fastest: (a, b) => b.speedKms - a.speedKms,
}

function SizeCompare({ asteroid }: { asteroid: WeekAsteroid }) {
  const d = asteroid.diameterM
  const below = [...LANDMARKS].reverse().find((l) => l.m <= d)
  const above = LANDMARKS.find((l) => l.m > d)
  const rows = [
    { name: 'This asteroid', m: d, icon: '☄️', highlight: true },
    ...[below, above].filter((l): l is (typeof LANDMARKS)[number] => !!l).map((l) => ({ ...l, highlight: false })),
  ].sort((a, b) => a.m - b.m)
  const max = Math.max(...rows.map((r) => r.m))
  const closest = [...LANDMARKS].sort((a, b) => Math.abs(Math.log(a.m / d)) - Math.abs(Math.log(b.m / d)))[0]

  return (
    <div>
      <p className="mb-3 text-sm text-slate-300">
        About <strong className="text-white">{(d / closest.m).toFixed(1)}×</strong> the size of a {closest.name.toLowerCase()}{' '}
        {closest.icon}
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="mb-1 flex justify-between text-xs">
              <span className={r.highlight ? 'font-semibold text-cyan-200' : 'text-slate-400'}>
                {r.icon} {r.name}
              </span>
              <span className="tabular-nums text-slate-400">{fmt(r.m)} m</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className={`h-2 rounded-full ${r.highlight ? 'bg-cyan-400' : 'bg-slate-500'}`}
                style={{ width: `${Math.max(2, (r.m / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DistanceBar({ asteroid }: { asteroid: WeekAsteroid }) {
  const scale = Math.max(asteroid.missLunar, 1) * 1.1
  const pos = (ld: number) => `${Math.min(100, (ld / scale) * 100)}%`
  return (
    <div>
      <p className="mb-3 text-sm text-slate-300">
        Passes <strong className="text-white">{asteroid.missLunar}×</strong> the distance to the Moon ({fmt(asteroid.missKm)} km)
      </p>
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xl" title="Earth">🌍</span>
        <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-base" style={{ left: pos(1) }} title="Moon">
          🌕
        </span>
        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg"
          style={{ left: pos(asteroid.missLunar) }}
          title="Asteroid"
        >
          ☄️
        </span>
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>Earth</span>
        <span>{scale.toFixed(0)} Moon distances</span>
      </div>
    </div>
  )
}

function AsteroidDetail({ asteroid }: { asteroid: WeekAsteroid }) {
  // Kuala Lumpur → Penang is roughly 290 km
  const klPenangSec = Math.max(1, Math.round(290 / asteroid.speedKms))
  return (
    <div className="card space-y-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Closest approach {formatDate(asteroid.date)}</p>
          <h3 className="text-2xl font-bold">{asteroid.name}</h3>
        </div>
        {asteroid.hazardous && (
          <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-200">⚠️ Potentially hazardous</span>
        )}
      </div>
      <SizeCompare asteroid={asteroid} />
      <DistanceBar asteroid={asteroid} />
      <p className="text-sm text-slate-300">
        Speed <strong className="text-white">{asteroid.speedKms} km/s</strong> — it would cross from KL to Penang in about{' '}
        {klPenangSec} second{klPenangSec === 1 ? '' : 's'}.
      </p>
      <a
        href={asteroid.jplUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold hover:bg-white/10"
      >
        Orbit details at NASA JPL ↗
      </a>
    </div>
  )
}

function AsteroidExplorer({ asteroids }: { asteroids: WeekAsteroid[] }) {
  const [sort, setSort] = useState<SortKey>('closest')
  const [hazardOnly, setHazardOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string>()
  const [limit, setLimit] = useState(10)

  const list = useMemo(
    () => asteroids.filter((a) => !hazardOnly || a.hazardous).sort(SORTS[sort]),
    [asteroids, sort, hazardOnly],
  )
  const selected = list.find((a) => a.id === selectedId) ?? list[0]
  const closest = [...asteroids].sort(SORTS.closest)[0]
  const biggest = [...asteroids].sort(SORTS.biggest)[0]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Passing this week" value={asteroids.length} />
        <Stat label="Potentially hazardous" value={asteroids.filter((a) => a.hazardous).length} accent="rose" />
        <Stat label="Closest" value={closest ? `${closest.missLunar}× Moon` : '—'} hint={closest?.name} accent="amber" />
        <Stat label="Biggest" value={biggest ? `~${fmt(biggest.diameterM)} m` : '—'} hint={biggest?.name} accent="violet" />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip active={sort === 'closest'} onClick={() => setSort('closest')}>Closest</Chip>
        <Chip active={sort === 'biggest'} onClick={() => setSort('biggest')}>Biggest</Chip>
        <Chip active={sort === 'fastest'} onClick={() => setSort('fastest')}>Fastest</Chip>
        <Chip active={hazardOnly} onClick={() => setHazardOnly((v) => !v)}>⚠️ Hazardous only</Chip>
      </div>

      <div id="asteroid-focus" className="grid scroll-mt-36 gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        {selected ? <AsteroidDetail asteroid={selected} /> : <p className="text-slate-400">No asteroids match.</p>}

        <div>
          <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
            {list.slice(0, limit).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(a.id)
                    document.getElementById('asteroid-focus')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 ${
                    a.id === selected?.id ? 'bg-white/[0.06]' : ''
                  }`}
                >
                  <span aria-hidden="true" className="text-xl">{a.hazardous ? '⚠️' : '☄️'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.name}</span>
                    <span className="text-xs text-slate-400">
                      {formatDate(a.date)} · ~{fmt(a.diameterM)} m · {a.missLunar}× Moon · {a.speedKms} km/s
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {list.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + 10)}
              className="mt-3 min-h-11 w-full rounded-full border border-white/15 font-semibold hover:bg-white/10"
            >
              Show more ({list.length - limit} left)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AsteroidsTab() {
  const state = useInfoData(getWeekAsteroids)

  return (
    <>
      <TabHeader
        mission="NASA NeoWs · JPL CNEOS"
        title="Asteroids passing Earth"
        intro="Every week dozens of space rocks fly past Earth. NASA tracks their size, speed and how close they come. Pick one to compare it with things you know."
        why="Finding asteroids early is planetary defence — NASA's DART mission proved we can nudge one off course."
      />

      <LoadState
        state={state}
        what="NASA's asteroid data"
        needsKey
        skeleton={
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-72 w-full" />
          </div>
        }
      >
        {(asteroids) => <AsteroidExplorer asteroids={asteroids} />}
      </LoadState>

      <DataSource
        sources={[
          { name: 'NASA NeoWs — Near Earth Object Web Service (via api.nasa.gov)', url: 'https://api.nasa.gov/' },
          { name: 'NASA JPL Center for Near Earth Object Studies (CNEOS)', url: 'https://cneos.jpl.nasa.gov/' },
        ]}
        note="Sizes are NASA estimates based on brightness, so real sizes may differ."
      />
    </>
  )
}
