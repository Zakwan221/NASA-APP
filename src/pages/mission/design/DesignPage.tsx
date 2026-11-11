import { motion } from 'framer-motion'
import { Check, Earth, FlaskConical, GraduationCap, Lock, Medal, Orbit, Rocket, Sun, Wrench, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { SCENARIOS } from '../../../game/data'
import { evaluate, limitsFor } from '../../../game/engine/evaluate'
import type { Difficulty, ResourceKey } from '../../../game/types'
import { useMission } from '../../../store/missionStore'
import Builder from './Builder'
import { BUILD_STEPS, stepDone } from './buildSteps'
import PhaseSteps from './components/PhaseSteps'
import { useDesignEditor } from './editor'

const DIFFICULTIES: { id: Difficulty; label: string; icon: LucideIcon; text: string }[] = [
  { id: 'cadet', label: 'Cadet', icon: GraduationCap, text: 'Simple parts, a big budget, and rockets never fail.' },
  { id: 'engineer', label: 'Engineer', icon: Wrench, text: 'All parts, a normal budget, a year in space.' },
  { id: 'director', label: 'Director', icon: Medal, text: 'Tight budget, longer mission, riskier launches.' },
  { id: 'sandbox', label: 'Sandbox', icon: FlaskConical, text: 'No budget limit. Try anything.' },
]

const RESOURCE_WORD: Record<ResourceKey, string> = {
  mass: 'mass',
  power: 'power',
  budget: 'budget',
  data: 'data',
  comms: 'communications',
  lifetime: 'lifetime',
}

const SCENARIO_ART: Record<string, { icon: LucideIcon; color: string; gradient: string }> = {
  'earth-watch': { icon: Earth, color: 'text-emerald-300', gradient: 'from-emerald-500/30 via-cyan-500/20 to-transparent' },
  'solar-storm': { icon: Sun, color: 'text-amber-300', gradient: 'from-amber-500/35 via-orange-500/20 to-transparent' },
  'asteroid-scout': { icon: Orbit, color: 'text-violet-300', gradient: 'from-violet-500/35 via-fuchsia-500/20 to-transparent' },
}

/**
 * Phase 1. First a short mission briefing (mission, mode, lifetime), then
 * "Start building" opens the full-screen 3D builder, one step at a time.
 * The builder step lives in the URL (?build=2) so the phone's Back button works.
 */
export default function DesignPage({
  onLaunchPad,
  launchLabel,
  intro,
}: {
  /** Team play: ask the crew to move to the launch pad (solo goes straight there) */
  onLaunchPad?: () => void
  launchLabel?: string
  /** Team play: shown above the briefing (crew and vote) */
  intro?: ReactNode
} = {}) {
  const store = useDesignEditor()
  const solo = useMission()
  const { design } = store
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const ev = useMemo(() => evaluate(design), [design])

  // Coming from the Report's Redesign button: the next flight needs a new launch
  const redesign = (location.state as { redesign?: boolean } | null)?.redesign
  const { setLaunch } = solo
  useEffect(() => {
    if (redesign && !store.team) setLaunch(null)
  }, [redesign, setLaunch, store.team])
  const toLaunchPad = onLaunchPad ?? (() => navigate('/mission/launch'))
  // Team play: only the Mission Planner (or the host, if nobody is) sets the mission
  const canPlan = store.canEdit('planner')
  const planner = store.owner('planner')

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
    const first = BUILD_STEPS.findIndex((s) => !stepDone(design, s))
    setParams({ build: String(first < 0 ? BUILD_STEPS.length - 1 : first) })
  }

  if (step !== null && scenarioId) {
    return <Builder step={step} onStep={goStep} onExit={() => setParams({})} onFinish={toLaunchPad} finishLabel={launchLabel} />
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-20 sm:px-6 sm:pt-24">
      <header className="mb-8">
        <PhaseSteps current="Design" />
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Mission briefing</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Choose what your spacecraft will do and how hard the game should be. Then build it piece by piece in 3D.
        </p>
        {planner && (
          <p
            className={`mt-3 flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
              canPlan ? 'bg-cyan-300/10 text-cyan-100' : 'bg-white/[0.06] text-slate-300'
            }`}
          >
            {canPlan ? <Check aria-hidden="true" className="size-4 text-cyan-300" /> : <Lock aria-hidden="true" className="size-4" />}
            {canPlan ? 'You set the mission. Everyone sees your choices live.' : `${planner} sets the mission. You can see it change live.`}
          </p>
        )}
      </header>
      {intro}

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
                disabled={!canPlan}
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
                <art.icon aria-hidden="true" className={`relative size-10 ${art.color}`} strokeWidth={1.5} />
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
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-cyan-300 px-2 py-0.5 text-xs font-bold text-space-950">
                    <Check aria-hidden="true" className="size-3" strokeWidth={3} /> Chosen
                  </span>
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
              disabled={!canPlan}
              onClick={() => {
                store.setDifficulty(d.id)
                const min = limitsFor(ev.scenario, d.id).minLifetimeMonths
                if (lifetime < min) store.setLifetime(min)
              }}
              className={`card min-h-11 p-4 text-left transition active:scale-[0.98] ${
                difficulty === d.id ? 'border-cyan-300/80 bg-cyan-300/10' : 'hover:border-white/25'
              }`}
            >
              <d.icon aria-hidden="true" className="size-6 text-cyan-300" strokeWidth={1.75} />
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
              disabled={!canPlan || lifetime <= limits.minLifetimeMonths}
              className="size-11 rounded-full bg-white/10 text-xl font-bold hover:bg-white/15 disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-28 text-center font-display text-2xl font-bold tabular-nums">{lifetime} months</span>
            <button
              type="button"
              aria-label="More months"
              onClick={() => store.setLifetime(Math.min(60, lifetime + 3))}
              disabled={!canPlan || lifetime >= 60}
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
          {started ? 'Continue building' : 'Start building'}
          {started ? (
            <Wrench aria-hidden="true" className="ml-2 inline size-5" />
          ) : (
            <Rocket aria-hidden="true" className="ml-2 inline size-5" />
          )}
        </motion.button>
        {!scenarioId && (
          <p className="text-sm text-slate-400">{canPlan ? 'Choose a mission first.' : `Waiting for ${planner ?? 'the planner'} to choose a mission.`}</p>
        )}
        {started && (
          <>
            {ev.designReady && (
              <button
                type="button"
                onClick={toLaunchPad}
                className="min-h-12 rounded-full border border-white/20 px-6 font-semibold hover:bg-white/10"
              >
                {launchLabel ?? 'Skip to launch'} →
              </button>
            )}
            {!store.team && (
            <button type="button" onClick={solo.reset} className="min-h-11 text-sm font-semibold text-slate-400 hover:text-slate-200">
              Start over
            </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
