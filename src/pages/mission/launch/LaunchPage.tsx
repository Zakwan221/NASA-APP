import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, CircleCheck, CircleX, Flame, Orbit, Rocket, Rotate3d, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { orbitById, rocketById } from '../../../game/data'
import {
  holdLabel,
  launchOdds,
  missionOutlook,
  rollLaunch,
  withLaunchDefaults,
  type LaunchOdds,
  type LaunchOutcome,
  type Outlook,
} from '../../../game/engine/launch'
import { useMission } from '../../../store/missionStore'
import { BUILD_STEPS } from '../design/buildSteps'

const LaunchScene = lazy(() => import('./components/LaunchScene'))

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const pct = (n: number) => `${Math.round(n * 100)}%`
const LAST_STEP = `/mission/design?build=${BUILD_STEPS.length - 1}`

interface Beat {
  label: string
  sub?: string
  ms: number
  hold?: boolean
  liftoff?: boolean
}

/**
 * Phase 2: the launch pad, full screen. One number (chance of success), one
 * button (Launch), then the 3D launch plays what happened.
 */
export default function LaunchPage() {
  const { design, launch, setOrbit, setRocket, setLaunch } = useMission()
  const navigate = useNavigate()
  // If the orbit or rocket was skipped, fly with sensible ones
  const flying = useMemo(() => withLaunchDefaults(design), [design])
  const odds = useMemo(() => launchOdds(flying), [flying])
  const outlook = useMemo(() => missionOutlook(flying, launch?.extraCostM ?? 0), [flying, launch])
  /** The countdown in progress (3, 2, [HOLD], 1, Liftoff); null when not counting */
  const [countdown, setCountdown] = useState<{ beats: Beat[]; i: number; outcome: LaunchOutcome } | null>(null)
  /** The rolled result while its animation plays; saved to the store when it ends */
  const [flight, setFlight] = useState<LaunchOutcome | null>(null)

  // Full screen: stop the page behind from scrolling
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (!countdown) return
    const t = setTimeout(() => {
      const next = countdown.i + 1
      if (next >= countdown.beats.length) return setCountdown(null)
      // Liftoff: the 3D scene plays what was rolled
      if (countdown.beats[next].liftoff) setFlight(countdown.outcome)
      setCountdown({ ...countdown, i: next })
    }, countdown.beats[countdown.i].ms)
    return () => clearTimeout(t)
  }, [countdown])

  const rocket = rocketById(flying.comms.launchVehicleId)
  const orbit = orbitById(flying.comms.orbitId)
  if (!design.planner.scenarioId || !rocket || !orbit) return <Navigate to="/mission/design" replace />

  /** Roll what happens now, so the countdown can show a HOLD before liftoff */
  const startLaunch = () => {
    if (flying !== design) {
      setOrbit(orbit.id)
      setRocket(rocket.id)
    }
    const outcome = rollLaunch(flying, Math.random(), Math.random())
    const hold = holdLabel(outcome.kind)
    const beats: Beat[] = [
      { label: '3', ms: 800 },
      { label: '2', ms: 800 },
      ...(hold ? [{ label: 'HOLD', sub: hold.replace('HOLD · ', ''), ms: 2200, hold: true }] : []),
      { label: '1', ms: 800 },
      { label: 'Liftoff!', ms: 700, liftoff: true },
    ]
    setCountdown({ beats, i: 0, outcome })
  }
  const tryAgain = () => {
    setFlight(null)
    setLaunch(null)
  }

  const beat = countdown ? countdown.beats[countdown.i] : null
  const busy = countdown !== null || (flight !== null && !launch)
  const waiting = !launch && !busy

  return (
    <div className="fixed inset-0 z-[60] bg-space-950" role="dialog" aria-label="Launch">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-400">Rolling out to the pad…</div>}>
        <LaunchScene
          rocketId={rocket.id}
          design={flying}
          kind={flight?.kind ?? launch?.kind ?? null}
          roughness={odds.roughness}
          flying={flight !== null}
          onDone={() => flight && setLaunch(flight)}
        />
      </Suspense>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pb-10">
        <button
          type="button"
          onClick={() => navigate(LAST_STEP)}
          disabled={busy}
          className="pointer-events-auto min-h-11 rounded-full bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/25 disabled:opacity-0"
        >
          <ChevronLeft aria-hidden="true" className="-ml-1 mr-1 inline size-4" />
          Design
        </button>
        <p className="text-right text-sm text-white">
          <span className="block font-semibold">{rocket.name}</span>
          <span className="text-slate-300">To {orbit.name}</span>
        </p>
      </div>

      {waiting && (
        <p className="pointer-events-none absolute left-1/2 top-16 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/45 px-3 py-1 text-xs text-slate-100 backdrop-blur">
          <Rotate3d aria-hidden="true" className="size-3.5" /> Hold and drag to look around
        </p>
      )}

      {/* Countdown */}
      <AnimatePresence>
        {beat && (
          <motion.div
            key={`${countdown?.i}-${beat.label}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={beat.hold ? { scale: [1, 1.06, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={beat.hold ? { duration: 0.8, repeat: Infinity } : { duration: 0.3, ease: EASE_OUT }}
            role="status"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)]"
          >
            <span className={`font-display font-bold tabular-nums ${beat.hold ? 'text-7xl text-amber-300 sm:text-8xl' : 'text-8xl text-white sm:text-9xl'}`}>
              {beat.label}
            </span>
            {beat.sub && (
              <span className="mt-2 flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5 text-base font-semibold text-amber-200">
                <TriangleAlert aria-hidden="true" className="size-4" /> {beat.sub}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom panel: before launch the odds, after launch the report */}
      <AnimatePresence mode="wait">
        {(waiting || launch) && (
          <motion.div
            key={launch ? 'report' : 'ready'}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="absolute inset-x-0 bottom-0 max-h-[62svh] overflow-y-auto p-3 sm:mx-auto sm:max-w-xl sm:p-4"
            aria-live="polite"
          >
            {launch ? (
              <LaunchReport launch={launch} outlook={outlook} onFly={() => navigate('/mission/operate')} onRetry={tryAgain} onChange={() => navigate(LAST_STEP)} />
            ) : (
              <ReadyPanel odds={odds} outlook={outlook} onLaunch={startLaunch} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const PANEL = 'card bg-space-900/90 p-4 backdrop-blur-md sm:p-5'

/** Before launch: one big number, why, and the Launch button */
function ReadyPanel({ odds, outlook, onLaunch }: { odds: LaunchOdds; outlook: Outlook; onLaunch: () => void }) {
  const color = odds.chance >= 0.9 ? 'text-emerald-300' : odds.chance >= 0.5 ? 'text-amber-300' : 'text-rose-300'
  // A rocket that works 94–99% of the time is normal, not a warning
  const risks = odds.factors.filter((f) => f.chance < 0.9)
  const worries = outlook.checks.filter((c) => !c.ok)
  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Chance of a good launch</p>
          <p className={`font-display text-5xl font-bold tabular-nums ${color}`}>{pct(odds.chance)}</p>
        </div>
        <button
          type="button"
          onClick={onLaunch}
          className="glow-cyan min-h-16 shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-8 text-xl font-bold text-white transition hover:brightness-110 active:scale-[0.97]"
        >
          Launch <Rocket aria-hidden="true" className="ml-1 inline size-5" />
        </button>
      </div>
      {risks.length + worries.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {risks.map((f) => (
            <li key={f.label} className="flex gap-2 text-amber-100">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-300" /> {f.text}
            </li>
          ))}
          {worries.slice(0, 2).map((c) => (
            <li key={c.text} className="flex gap-2 text-slate-300">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" /> After launch: {c.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex gap-2 text-sm text-emerald-200">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> Everything checks out. Ready when you are.
        </p>
      )}
    </div>
  )
}

const VERDICT: Record<Outlook['verdict'], { icon: LucideIcon; className: string }> = {
  likely: { icon: CircleCheck, className: 'text-emerald-200' },
  'at-risk': { icon: TriangleAlert, className: 'text-amber-200' },
  unlikely: { icon: CircleX, className: 'text-rose-200' },
}

/** After launch: what happened and why, then fly it or try again */
function LaunchReport({
  launch,
  outlook,
  onFly,
  onRetry,
  onChange,
}: {
  launch: LaunchOutcome
  outlook: Outlook
  onFly: () => void
  onRetry: () => void
  onChange: () => void
}) {
  const { tone, kind } = launch
  const Icon = kind === 'lost-signal' ? WifiOff : kind === 'wrong-orbit' ? Orbit : tone === 'good' ? Rocket : tone === 'bad' ? TriangleAlert : Flame
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-amber-300' : 'text-rose-400'
  const border = tone === 'good' ? 'border-emerald-400/50' : tone === 'bad' ? 'border-amber-300/50' : 'border-rose-400/60'
  const v = VERDICT[outlook.verdict]
  return (
    <div className={`${PANEL} ${border}`}>
      <h2 className="text-2xl font-bold">
        <Icon aria-hidden="true" className={`mr-2 inline size-6 -translate-y-0.5 ${color}`} />
        {launch.title}
      </h2>
      <p className="mt-2 text-slate-300">{launch.text}</p>

      {tone === 'fail' ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="min-h-12 rounded-full bg-cyan-400 px-6 font-semibold text-space-950 transition hover:bg-cyan-300 active:scale-[0.98]"
          >
            Try again
          </button>
          <button type="button" onClick={onChange} className="min-h-12 rounded-full border border-white/20 px-6 font-semibold hover:bg-white/10">
            Change the design
          </button>
        </div>
      ) : (
        <>
          <p className={`mt-3 flex items-start gap-2 text-sm font-semibold ${v.className}`}>
            <v.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {outlook.headline}
          </p>
          <button
            type="button"
            onClick={onFly}
            className="glow-violet mt-4 min-h-14 rounded-full bg-violet-500 px-8 text-lg font-semibold transition hover:bg-violet-400 active:scale-[0.98]"
          >
            Start flying →
          </button>
        </>
      )}
    </div>
  )
}
