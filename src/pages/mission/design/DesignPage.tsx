import { motion } from 'framer-motion'
import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { SCENARIOS } from '../../../game/data'
import { evaluate, limitsFor } from '../../../game/engine/evaluate'
import type { Difficulty, ResourceKey } from '../../../game/types'
import { useMission } from '../../../store/missionStore'
import Builder from './Builder'
import { BUILD_STEPS } from './buildSteps'
import PhaseSteps from './components/PhaseSteps'

const DIFFICULTIES: { id: Difficulty; label: string; icon: string; text: string }[] = [
  { id: 'cadet', label: 'Cadet', icon: '🧑‍🚀', text: 'Simple parts, a big budget, and rockets never fail.' },
  { id: 'engineer', label: 'Engineer', icon: '🛠️', text: 'All parts, a normal budget, a year in space.' },
  { id: 'director', label: 'Director', icon: '🎖️', text: 'Tight budget, longer mission, riskier launches.' },
  { id: 'sandbox', label: 'Sandbox', icon: '🧪', text: 'No budget limit. Try anything.' },
]

const RESOURCE_WORD: Record<ResourceKey, string> = {
  mass: 'mass',
  power: 'power',
  budget: 'budget',
  data: 'data',
  comms: 'communications',
  lifetime: 'lifetime',
}

const SCENARIO_ART: Record<string, { icon: string; gradient: string }> = {
  'earth-watch': { icon: '🌏', gradient: 'from-emerald-500/30 via-cyan-500/20 to-transparent' },
  'solar-storm': { icon: '☀️', gradient: 'from-amber-500/35 via-orange-500/20 to-transparent' },
  'asteroid-scout': { icon: '☄️', gradient: 'from-violet-500/35 via-fuchsia-500/20 to-transparent' },
}

/**
 * Phase 1. First a short mission briefing (mission, mode, lifetime), then
 * "Start building" opens the full-screen 3D builder, one step at a time.
 * The builder step lives in the URL (?build=2) so the phone's Back button works.
 */
export default function DesignPage() {
  const store = useMission()
  const { design } = store
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const ev = useMemo(() => evaluate(design), [design])

  // Coming from the Report's Redesign button: the next flight needs a new launch
  const redesign = (location.state as { redesign?: boolean } | null)?.redesign
  const { setLaunch } = store
  useEffect(() => {
    if (redesign) setLaunch(null)
  }, [redesign, setLaunch])

  const scenarioId = design.planner.scenarioId
  const difficulty = design.planner.difficulty
  const limits = limitsFor(ev.scenario, difficulty)
  const lifetime = design.planner.targetLifetimeMonths
  const buildParam = params.get('build')
  const step = buildParam === null ? null : Math.min(BUILD_STEPS.length - 1, Math.max(0, Number(buildParam) || 0))
  const started = Boolean(design.engineer.structureId)

  const goStep = (n: number) => setParams({ build: String(n) }, { replace: true })
  const startBuilding = () => {
    // Continue where the player stopped: the first step that still needs a choice
    const first = BUILD_STEPS.findIndex((s) =>
      s.slot
        ? !(s.slot === 'radio' ? design.comms.radioId : design.engineer[s.slot])
        : s.id === 'instruments'
          ? design.science.instrumentIds.length === 0
          : true,
    )
    setParams({ build: String(Math.max(0, first)) })
  }

  if (step !== null && scenarioId) {
    return <Builder step={step} onStep={goStep} onExit={() => setParams({})} onFinish={() => navigate('/mission/launch')} />
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-20 sm:px-6 sm:pt-24">
      <header className="mb-8">
        <PhaseSteps current="Design" />
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Mission briefing</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Choose what your spacecraft will do and how hard the game should be. Then build it piece by piece in 3D.
        </p>
      </header>

      <section aria-labelledby="mission-h">
        <h2 id="mission-h" className="text-xl font-bold">
          <span className="text-cyan-300">1.</span> Mission
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Mission">
          {SCENARIOS.map((s) => {
            const selected = s.id === scenarioId
            const art = SCENARIO_ART[s.id] ?? SCENARIO_ART['earth-watch']
            return (
              <motion.button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={selected}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  store.setScenario(s.id)
                  const min = limitsFor(s, difficulty).minLifetimeMonths
                  if (lifetime < min) store.setLifetime(min)
                }}
                className={`card relative overflow-hidden p-5 text-left transition ${
                  selected ? 'border-cyan-300/80 shadow-[0_0_24px_-6px_rgba(103,232,249,0.6)]' : 'hover:border-white/25'
                }`}
              >
                <span aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${art.gradient}`} />
                <span className="relative block text-4xl" aria-hidden="true">
                  {art.icon}
                </span>
                <span className="relative mt-3 block text-lg font-semibold">{s.title}</span>
                <span className="relative mt-1 block text-sm text-slate-300">{s.objective}</span>
                <span className="relative mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  {s.criticalResources.map((r) => (
                    <span key={r} className="rounded-full bg-amber-300/15 px-2 py-0.5 text-amber-200">
                      Key: {RESOURCE_WORD[r]}
                    </span>
                  ))}
                  {s.nasaData.map((d) => (
                    <span key={d.api} className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">
                      NASA {d.api}
                    </span>
                  ))}
                </span>
                {selected && (
                  <span className="absolute right-3 top-3 rounded-full bg-cyan-300 px-2 py-0.5 text-xs font-bold text-space-950">✓ Chosen</span>
                )}
              </motion.button>
            )
          })}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="mode-h">
        <h2 id="mode-h" className="text-xl font-bold">
          <span className="text-cyan-300">2.</span> Game mode
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Game mode">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={difficulty === d.id}
              onClick={() => {
                store.setDifficulty(d.id)
                const min = limitsFor(ev.scenario, d.id).minLifetimeMonths
                if (lifetime < min) store.setLifetime(min)
              }}
              className={`card min-h-11 p-4 text-left transition active:scale-[0.98] ${
                difficulty === d.id ? 'border-cyan-300/80 bg-cyan-300/10' : 'hover:border-white/25'
              }`}
            >
              <span className="block text-2xl" aria-hidden="true">
                {d.icon}
              </span>
              <span className="mt-1 block font-semibold">{d.label}</span>
              <span className="mt-0.5 block text-xs text-slate-400">{d.text}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="time-h">
        <h2 id="time-h" className="text-xl font-bold">
          <span className="text-cyan-300">3.</span> Time in space
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Fewer months"
              onClick={() => store.setLifetime(Math.max(limits.minLifetimeMonths, lifetime - 3))}
              disabled={lifetime <= limits.minLifetimeMonths}
              className="size-11 rounded-full bg-white/10 text-xl font-bold hover:bg-white/15 disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-28 text-center font-display text-2xl font-bold tabular-nums">{lifetime} months</span>
            <button
              type="button"
              aria-label="More months"
              onClick={() => store.setLifetime(Math.min(60, lifetime + 3))}
              disabled={lifetime >= 60}
              className="size-11 rounded-full bg-white/10 text-xl font-bold hover:bg-white/15 disabled:opacity-40"
            >
              +
            </button>
          </div>
          <p className="max-w-md text-sm text-slate-400">
            Longer missions return more science but cost more to run. At least {limits.minLifetimeMonths} months on this mode
            {ev.scenario && difficulty !== 'sandbox' ? `, budget $${limits.budgetM} M.` : '.'}
          </p>
        </div>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-4">
        <motion.button
          type="button"
          disabled={!scenarioId}
          onClick={startBuilding}
          whileTap={{ scale: 0.97 }}
          className="glow-cyan min-h-16 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-10 text-xl font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-slate-400 disabled:shadow-none"
        >
          {started ? 'Continue building 🛠️' : 'Start building 🚀'}
        </motion.button>
        {!scenarioId && <p className="text-sm text-slate-400">Choose a mission first.</p>}
        {started && (
          <>
            {ev.designReady && (
              <button
                type="button"
                onClick={() => navigate('/mission/launch')}
                className="min-h-12 rounded-full border border-white/20 px-6 font-semibold hover:bg-white/10"
              >
                Skip to launch →
              </button>
            )}
            <button type="button" onClick={store.reset} className="min-h-11 text-sm font-semibold text-slate-400 hover:text-slate-200">
              Start over
            </button>
          </>
        )}
      </div>
    </div>
  )
}
