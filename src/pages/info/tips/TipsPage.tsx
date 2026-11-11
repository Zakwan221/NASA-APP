import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, CircleCheck, Earth, FlaskConical, Lightbulb, Orbit, Rocket, Rotate3d, Sun, Target } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CraftModel from '../../../components/space/CraftModel'
import ItemPicture from '../../../components/space/ItemPicture'
import { instrumentById, orbitById, partById, rocketById, SCENARIOS } from '../../../game/data'
import { RECOMMENDED } from '../../../game/data/recommended'
import { testFlights } from '../../../game/engine/simulate'
import type { MissionDesign } from '../../../game/types'
import { useMission } from '../../../store/missionStore'
import { DIFFICULTY_TIPS, GENERAL_TIPS, MISSION_TIPS, SCORE_TIPS } from './tipsContent'

const Viewer3D = lazy(() => import('../components/Viewer3D'))
const ThumbnailStudio = lazy(() => import('../../../components/space/thumbnails'))

const EASE_OUT = [0.23, 1, 0.32, 1] as const

const MISSION_ICON = { 'earth-watch': Earth, 'solar-storm': Sun, 'asteroid-scout': Orbit } as const
const RESOURCE_WORD: Record<string, string> = { mass: 'Mass', power: 'Power', budget: 'Budget', data: 'Data', comms: 'Comms', lifetime: 'Lifetime' }

/** The builds never change, so fly each one once (20 flights take a few milliseconds) */
const flightCache = new Map<string, ReturnType<typeof testFlights>>()
function flightsFor(scenarioId: string, design: MissionDesign) {
  if (!flightCache.has(scenarioId)) flightCache.set(scenarioId, testFlights(design, 20))
  return flightCache.get(scenarioId) ?? null
}

/** Every choice in a build, with its picture, in the order you make them in the game */
function buildItems(d: MissionDesign) {
  const part = (id: string | null) => {
    const p = partById(id)
    return p ? [{ key: `part:${p.id}`, name: p.name }] : []
  }
  return [
    ...part(d.engineer.structureId),
    ...part(d.engineer.solarId),
    ...part(d.engineer.batteryId),
    ...part(d.engineer.computerId),
    ...part(d.engineer.attitudeId),
    ...part(d.comms.radioId),
    ...d.science.instrumentIds.map((id) => ({ key: `instrument:${id}`, name: instrumentById(id)?.name ?? id })),
  ]
}

/** /info/tips: how the score works, then a tested winning build and tips for each mission */
export default function TipsPage() {
  const [missionId, setMissionId] = useState(RECOMMENDED[0].scenarioId)
  const navigate = useNavigate()
  const { loadDesign } = useMission()
  const rec = RECOMMENDED.find((r) => r.scenarioId === missionId)!
  const scenario = SCENARIOS.find((s) => s.id === missionId)!
  const tips = MISSION_TIPS[missionId]
  const orbit = orbitById(rec.design.comms.orbitId)!
  const rocket = rocketById(rec.design.comms.launchVehicleId)!
  const flights = flightsFor(missionId, rec.design)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-32 sm:px-6">
      <Suspense fallback={null}>
        <ThumbnailStudio />
      </Suspense>

      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Tips to win</p>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-5xl">How to get a high score</h1>
        <p className="mt-3 text-slate-300 sm:text-lg">Four ways to earn points, then a tested winning build for each mission.</p>
      </header>

      {/* The four parts of the score */}
      <section aria-label="How the score works" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SCORE_TIPS.map((s, i) => (
          <motion.article
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.08 }}
            className="card p-5"
          >
            <p className="flex items-baseline justify-between">
              <span className="font-semibold">{s.label}</span>
              <span className="font-display text-2xl font-bold text-cyan-300">{s.points}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                initial={{ width: 0 }}
                whileInView={{ width: `${(s.points / 40) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 + i * 0.08 }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-300">{s.how}</p>
            <p className="mt-2 flex gap-2 text-sm text-cyan-100">
              <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-300" /> {s.tip}
            </p>
          </motion.article>
        ))}
      </section>

      {/* Mission tabs */}
      <section className="mt-14" aria-labelledby="missions-h">
        <h2 id="missions-h" className="text-2xl font-bold sm:text-3xl">
          Winning builds
        </h2>
        <p className="mt-1 text-slate-400">Each one is flown 20 times through the real game. Pick a mission:</p>
        <div role="tablist" aria-label="Mission" className="mt-4 flex flex-wrap gap-2">
          {RECOMMENDED.map((r) => {
            const s = SCENARIOS.find((x) => x.id === r.scenarioId)!
            const Icon = MISSION_ICON[r.scenarioId as keyof typeof MISSION_ICON] ?? Target
            const active = r.scenarioId === missionId
            return (
              <button
                key={r.scenarioId}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMissionId(r.scenarioId)}
                className={`flex min-h-12 items-center gap-2 rounded-full px-5 font-semibold transition ${
                  active ? 'bg-cyan-400 text-space-950 shadow-[0_0_24px_-6px_rgba(34,211,238,0.8)]' : 'bg-white/[0.07] text-slate-200 hover:bg-white/15'
                }`}
              >
                <Icon aria-hidden="true" className="size-5" />
                {s.title.split(':')[0]}
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={missionId}
            role="tabpanel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
          >
            {/* Left: the spacecraft in 3D + result */}
            <div className="card overflow-hidden">
              <div className="relative h-72 bg-[radial-gradient(ellipse_at_50%_40%,rgba(56,189,248,0.18),#020309_70%)] sm:h-96">
                <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Loading 3D…</div>}>
                  <Viewer3D margin={1.15}>
                    <CraftModel design={rec.design} instant />
                  </Viewer3D>
                </Suspense>
                <p className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/45 px-3 py-1 text-xs text-slate-200">
                  <Rotate3d aria-hidden="true" className="size-3.5" /> Drag to turn it
                </p>
              </div>
              <div className="p-5">
                <p className="text-sm text-slate-300">{scenario.objective}</p>
                <p className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {scenario.criticalResources.map((r) => (
                    <span key={r} className="rounded-full bg-amber-300/15 px-2.5 py-1 font-semibold text-amber-200">
                      Matters most: {RESOURCE_WORD[r]}
                    </span>
                  ))}
                </p>
                {flights && (
                  <div className="mt-4 rounded-2xl bg-emerald-400/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Tested in 20 flights (Engineer)</p>
                    <p className="mt-1 font-display text-4xl font-bold tabular-nums text-emerald-300">
                      {flights.average}
                      <span className="text-lg text-emerald-200/80"> / 100 on average</span>
                    </p>
                    <p className="text-sm text-emerald-100/80">
                      Best {flights.best}, worst {flights.worst}. Bad luck in flight is still possible.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    loadDesign(rec.design)
                    navigate('/mission/design?build=8')
                  }}
                  className="glow-cyan mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-cyan-400 px-6 font-semibold text-space-950 transition hover:bg-cyan-300 active:scale-[0.98]"
                >
                  <FlaskConical aria-hidden="true" className="size-4" /> Try this build
                </button>
              </div>
            </div>

            {/* Right: every choice and why, then tips */}
            <div className="space-y-5">
              <div className="card p-5">
                <h3 className="font-semibold">The build</h3>
                <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-4">
                  {buildItems(rec.design).map((it) => (
                    <li key={it.key} className="text-center">
                      <ItemPicture thumb={it.key} alt={it.name} />
                      <p className="mt-1 text-[10px] leading-tight text-slate-400 sm:text-[11px]">{it.name}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <ItemPicture orbit={orbit.id} alt={orbit.name} />
                    <p className="mt-1 text-[11px] text-slate-400">{orbit.name}</p>
                  </div>
                  <div className="text-center">
                    <ItemPicture thumb={`rocket:${rocket.id}`} alt={rocket.name} />
                    <p className="mt-1 text-[11px] text-slate-400">{rocket.name}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {rec.why.map((w) => (
                    <li key={w} className="flex gap-2 text-slate-300">
                      <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-300" /> {w}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-5">
                <h3 className="font-semibold">Tips</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {tips.tips.map((t) => (
                    <li key={t} className="flex gap-2 text-slate-300">
                      <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-300" /> {t}
                    </li>
                  ))}
                </ul>
                <h3 className="mt-5 font-semibold">Common mistakes</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {tips.mistakes.map((t) => (
                    <li key={t} className="flex gap-2 text-rose-100">
                      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-rose-300" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Difficulty + general */}
      <section className="mt-14 grid gap-5 lg:grid-cols-2" aria-label="More tips">
        <div className="card p-5">
          <h2 className="text-xl font-bold">Game modes</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {DIFFICULTY_TIPS.map((d) => (
              <li key={d.name}>
                <strong className="text-cyan-200">{d.name}:</strong> <span className="text-slate-300">{d.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="text-xl font-bold">Before you press Launch</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {GENERAL_TIPS.map((t) => (
              <li key={t} className="flex gap-2 text-slate-300">
                <Rocket aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-300" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
