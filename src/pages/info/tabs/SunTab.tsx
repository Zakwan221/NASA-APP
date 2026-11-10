import { useState } from 'react'
import Skeleton from '../../../components/ui/Skeleton'
import { getSpaceWeather, type SpaceWeather } from '../api/donki'
import Chip from '../components/Chip'
import DataSource from '../components/DataSource'
import LoadState from '../components/LoadState'
import Stat from '../components/Stat'
import TabHeader from '../components/TabHeader'
import { useInfoData } from '../hooks/useInfoData'
import { fmt, formatDate } from '../utils/format'

/** NASA SDO "latest" images — refreshed by NASA every few minutes, no key needed */
const SDO_VIEWS = [
  { id: '0193', label: 'Corona', text: "The Sun's super-hot outer atmosphere. Dark patches are coronal holes, where fast solar wind escapes." },
  { id: '0171', label: 'Magnetic loops', text: 'Glowing loops of plasma that trace magnetic fields arching above active regions.' },
  { id: '0304', label: 'Chromosphere', text: 'The layer just above the surface — look for filaments and prominences on the edge.' },
  { id: '0131', label: 'Flare view', text: 'Shows the very hottest plasma, so flaring regions shine brightest here.' },
  { id: 'HMIIC', label: 'Visible light', text: 'The Sun as your eyes would see it through a safe filter. Dark spots are sunspots.' },
] as const

const sdoUrl = (id: string) => `https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_${id}.jpg`

const FLARE_CLASSES = [
  { letter: 'X', color: 'bg-rose-400', text: 'Strongest — can cause radio blackouts worldwide' },
  { letter: 'M', color: 'bg-amber-400', text: 'Medium — brief radio blackouts near the poles' },
  { letter: 'C', color: 'bg-cyan-400', text: 'Small — little effect on Earth' },
  { letter: 'B', color: 'bg-slate-400', text: 'Tiny — background level' },
]

const SUN_EARTH_KM = 149_600_000

function SunViewer() {
  const [view, setView] = useState<(typeof SDO_VIEWS)[number]>(SDO_VIEWS[0])

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px] md:items-center">
      <figure className="relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-full bg-black shadow-[0_0_80px_-10px_rgba(251,146,60,0.45)]">
        <img
          key={view.id}
          src={sdoUrl(view.id)}
          alt={`Latest image of the Sun from NASA's Solar Dynamics Observatory, ${view.label} view`}
          className="h-full w-full object-cover"
        />
      </figure>
      <div>
        <p className="mb-3 text-sm text-slate-400">Live from NASA's Solar Dynamics Observatory. Pick a view:</p>
        <div className="flex flex-wrap gap-2">
          {SDO_VIEWS.map((v) => (
            <Chip key={v.id} active={v.id === view.id} onClick={() => setView(v)}>
              {v.label}
            </Chip>
          ))}
        </div>
        <p className="mt-4 text-slate-300">{view.text}</p>
      </div>
    </div>
  )
}

function WeatherReport({ data }: { data: SpaceWeather }) {
  const counts = FLARE_CLASSES.map((c) => ({
    ...c,
    count: data.flares.filter((f) => f.classType.startsWith(c.letter)).length,
  }))
  const maxCount = Math.max(1, ...counts.map((c) => c.count))

  const strongest = [...data.flares].sort((a, b) => {
    const rank = (s: string) => 'ABCMX'.indexOf(s[0]) * 100 + Number.parseFloat(s.slice(1) || '0')
    return rank(b.classType) - rank(a.classType)
  })[0]

  const fastest = [...data.cmes].sort((a, b) => b.speed - a.speed)[0]
  const maxKp = Math.max(0, ...data.storms.map((s) => s.maxKp))
  const recent = [...data.flares].sort((a, b) => b.peakTime.localeCompare(a.peakTime)).slice(0, 6)

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Last 30 days · {formatDate(data.from)} – {formatDate(data.to)}
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Solar flares" value={data.flares.length} hint={strongest ? `Strongest: ${strongest.classType}` : undefined} accent="amber" />
        <Stat label="Solar eruptions (CMEs)" value={data.cmes.length} accent="violet" />
        <Stat
          label="Fastest eruption"
          value={fastest ? `${fmt(fastest.speed)} km/s` : '—'}
          hint={fastest ? `Could reach Earth in ~${Math.round(SUN_EARTH_KM / fastest.speed / 3600)} hours` : undefined}
          accent="rose"
        />
        <Stat
          label="Geomagnetic storms"
          value={data.storms.length}
          hint={data.storms.length ? `Max Kp ${maxKp} of 9` : 'Quiet — no storms'}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-bold">Flares by class</h3>
          <p className="mb-4 text-sm text-slate-400">Each letter is 10× stronger than the one below it.</p>
          <ul className="space-y-3">
            {counts.map((c) => (
              <li key={c.letter}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>
                    <span className="font-display font-bold">{c.letter}</span>
                    <span className="text-slate-400"> — {c.text}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{c.count}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className={`h-2 rounded-full ${c.color}`} style={{ width: `${(c.count / maxCount) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-bold">Latest flares</h3>
          {recent.length === 0 ? (
            <p className="text-slate-400">No flares recorded — a calm month.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {recent.map((f) => (
                <li key={f.id}>
                  <a
                    href={f.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-between gap-3 py-2 hover:text-cyan-200"
                  >
                    <span className="font-display text-lg font-bold">{f.classType}</span>
                    <span className="flex-1 text-sm text-slate-400">
                      {formatDate(f.peakTime, true)}
                      {f.region ? ` · Region ${f.region}` : ''}
                    </span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SunTab() {
  const state = useInfoData(getSpaceWeather)

  return (
    <>
      <TabHeader
        mission="NASA SDO · DONKI space weather"
        title="Our star, right now"
        intro="The Sun isn't calm. It throws out flares (flashes of energy) and CMEs (huge clouds of charged gas). NASA watches it nonstop and logs every event."
        why="Strong solar storms can disrupt GPS, radio, satellites and power grids — and create auroras."
      />

      <SunViewer />

      <h3 className="mb-4 mt-12 text-2xl font-bold">Space weather report</h3>
      <LoadState
        state={state}
        what="NASA's space weather data"
        needsKey
        skeleton={
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        }
      >
        {(data) => <WeatherReport data={data} />}
      </LoadState>

      <DataSource
        sources={[
          { name: 'NASA Solar Dynamics Observatory (SDO) — latest images', url: 'https://sdo.gsfc.nasa.gov/data/' },
          { name: 'NASA DONKI — Space Weather Database (via api.nasa.gov)', url: 'https://api.nasa.gov/' },
          { name: 'DONKI at NASA CCMC', url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/' },
        ]}
        note="Images courtesy of NASA/SDO and the AIA, EVE, and HMI science teams."
      />
    </>
  )
}
