import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ORBITS, ROCKETS } from '../../../game/data'
import { evaluate } from '../../../game/engine/evaluate'
import { failureChance, launchRisk, missionOutlook, rollLaunch, type LaunchOutcome } from '../../../game/engine/launch'
import { useMission } from '../../../store/missionStore'
import Dashboard, { MiniStatus } from '../design/components/Dashboard'
import OptionCard, { CardRow, CardSlot } from '../design/components/OptionCard'
import PhaseSteps from '../design/components/PhaseSteps'

const LaunchScene = lazy(() => import('./components/LaunchScene'))

const EASE_OUT = [0.23, 1, 0.32, 1] as const

const km = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M km` : `${n.toLocaleString()} km`)
const pct = (n: number) => `${Math.round(n * 100)}%`

/** Phase 2: pick an orbit and a rocket, check the fit, and watch it launch in 3D. */
export default function LaunchPage() {
  const { design, launch, setOrbit, setRocket, setLaunch } = useMission()
  const navigate = useNavigate()
  const ev = useMemo(() => evaluate(design), [design])
  const outlook = useMemo(() => missionOutlook(design, launch?.extraCostM ?? 0), [design, launch])
  /** 3, 2, 1 before liftoff; null when not counting */
  const [count, setCount] = useState<number | null>(null)
  /** The rolled result, shown only after the animation finishes */
  const [flight, setFlight] = useState<LaunchOutcome | null>(null)

  const orbit = ev.orbit
  const rocket = ROCKETS.find((r) => r.id === design.comms.launchVehicleId)
  const scenario = ev.scenario
  const difficulty = design.planner.difficulty

  useEffect(() => {
    if (count === null) return
    const t = setTimeout(() => {
      if (count === 1 && rocket && orbit) {
        // Liftoff: decide what happens, then let the 3D scene play it
        setFlight(rollLaunch(rocket, orbit, difficulty, Math.random(), Math.random()))
      }
      setCount(count > 0 ? count - 1 : null)
    }, 800)
    return () => clearTimeout(t)
  }, [count, rocket, orbit, difficulty])

  if (!ev.designReady) return <Navigate to="/mission/design" replace />

  const blockers = ev.warnings.filter((w) => w.blocking).length
  const busy = count !== null || (flight !== null && !launch)
  const canLaunch = ev.launchReady && !launch && !busy
  const sceneTone = flight?.tone ?? launch?.tone ?? 'good'

  const tryAgain = () => {
    setFlight(null)
    setLaunch(null)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-20 sm:px-6 sm:pt-24 lg:pb-16">
      <header className="mb-8">
        <PhaseSteps current="Launch" />
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Choose your orbit and rocket</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          The orbit decides your sunlight, contact time and view of the target. The rocket must carry your{' '}
          <strong className="text-white">{ev.massKg} kg</strong> spacecraft all the way there, and no rocket is 100% reliable.
        </p>
        <Link to="/mission/design" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-cyan-300 hover:text-cyan-200">
          ← Back to design
        </Link>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0">
          <section>
            <h2 className="text-xl font-bold">
              <span className="text-cyan-300">1.</span> Orbit
            </h2>
            <p className="mb-4 mt-1 text-sm text-slate-400">Higher orbits see more and last longer, but are harder to reach and talk to.</p>
            <div role="radiogroup" aria-label="Orbit">
              <CardRow>
                {ORBITS.map((o) => {
                  const allowed = scenario?.allowedOrbits.includes(o.id) ?? true
                  const view = scenario ? Math.round((o.coverage[scenario.id] ?? 0) * 100) : null
                  return (
                    <CardSlot key={o.id}>
                      <OptionCard
                        name={o.name}
                        selected={design.comms.orbitId === o.id}
                        disabled={!allowed || busy || Boolean(launch)}
                        note={allowed ? undefined : 'Not possible for this mission.'}
                        onSelect={() => setOrbit(o.id)}
                        stats={[
                          { label: 'Distance', value: km(o.altitudeKm) },
                          { label: 'In shadow', value: `${Math.round(o.shadowFraction * 100)}%` },
                          { label: 'Contact', value: o.contactMinPerDay >= 1440 ? 'All day' : `${o.contactMinPerDay} min/day` },
                          { label: 'Lasts', value: `${o.maxLifetimeMonths} months` },
                          ...(view !== null ? [{ label: 'View of target', value: `${view}%` }] : []),
                        ]}
                        explain={o.explain}
                        source={o.source}
                      />
                    </CardSlot>
                  )
                })}
              </CardRow>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-bold">
              <span className="text-cyan-300">2.</span> Rocket
            </h2>
            <p className="mb-4 mt-1 text-sm text-slate-400">
              {orbit
                ? `Cheaper rockets carry less, and newer ones fail more often. ${difficulty === 'cadet' ? 'On Cadet no launch can fail.' : ''}`
                : 'Pick an orbit first.'}
            </p>
            <div role="radiogroup" aria-label="Rocket">
              <CardRow>
                {ROCKETS.map((r) => {
                  const cap = orbit ? r.capacityKg[orbit.id] : undefined
                  const reaches = cap !== undefined
                  const fits = reaches && ev.massKg <= cap
                  const reliability = 1 - failureChance(r, difficulty)
                  return (
                    <CardSlot key={r.id}>
                      <OptionCard
                        name={r.name}
                        selected={design.comms.launchVehicleId === r.id}
                        disabled={!orbit || !reaches || busy || Boolean(launch)}
                        note={orbit && !reaches ? `Can’t reach ${orbit.name}.` : undefined}
                        onSelect={() => setRocket(r.id)}
                        badge={
                          orbit &&
                          reaches && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] ${fits ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'}`}
                            >
                              {fits ? `Fits: ${ev.massKg} of ${cap} kg` : `Too heavy: ${ev.massKg} kg > ${cap} kg`}
                            </span>
                          )
                        }
                        stats={[
                          { label: 'Cost', value: `$${r.costM} M` },
                          { label: 'Carries', value: reaches ? `${cap!.toLocaleString()} kg` : '—' },
                          { label: 'Reliability', value: pct(reliability) },
                          { label: 'Delay risk', value: pct(launchRisk(r, difficulty)) },
                        ]}
                        explain={r.explain}
                        source={r.source}
                      />
                    </CardSlot>
                  )
                })}
              </CardRow>
            </div>
          </section>

          {/* 3D launch stage */}
          <section className="mt-10" aria-label="Launch">
            <h2 className="text-xl font-bold">
              <span className="text-cyan-300">3.</span> Launch
            </h2>
            <div className="card relative mt-4 h-80 overflow-hidden sm:h-[26rem]">
              {rocket && orbit ? (
                <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Loading 3D…</div>}>
                  <LaunchScene
                    rocketId={rocket.id}
                    design={design}
                    tone={sceneTone}
                    flying={flight !== null}
                    onDone={() => flight && setLaunch(flight)}
                  />
                </Suspense>
              ) : (
                <p className="flex h-full items-center justify-center p-6 text-center text-slate-400">Pick an orbit and a rocket to roll it out to the pad.</p>
              )}
              <AnimatePresence>
                {count !== null && (
                  <motion.p
                    key={count}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    role="status"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-8xl font-bold tabular-nums text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
                  >
                    {count > 0 ? count : 'Liftoff!'}
                  </motion.p>
                )}
              </AnimatePresence>
              {rocket && !launch && !busy && (
                <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
                  {rocket.name} · {pct(1 - failureChance(rocket, difficulty))} reliable
                </p>
              )}
            </div>

            <div className="mt-4" aria-live="polite">
              <AnimatePresence mode="wait">
                {launch ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                    className={`card p-6 ${launch.tone === 'good' ? 'border-emerald-400/40' : launch.tone === 'bad' ? 'border-amber-300/40' : 'border-rose-400/50'}`}
                  >
                    <p className="text-sm font-semibold uppercase tracking-wider text-cyan-300">Launch report</p>
                    <h3 className="mt-1 text-2xl font-bold">
                      {launch.tone === 'good' ? '🚀 ' : launch.tone === 'bad' ? '⚠️ ' : '💥 '}
                      {launch.title}
                    </h3>
                    <p className="mt-2 text-slate-300">{launch.text}</p>

                    {launch.tone === 'fail' ? (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={tryAgain}
                          className="min-h-12 rounded-full bg-cyan-400 px-6 font-semibold text-space-950 transition hover:bg-cyan-300 active:scale-[0.98]"
                        >
                          Build another and try again
                        </button>
                        <Link to="/mission/design" onClick={tryAgain} className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-6 font-semibold hover:bg-white/10">
                          Change the design
                        </Link>
                      </div>
                    ) : (
                      <>
                        <OutlookCard outlook={outlook} />
                        <button
                          type="button"
                          onClick={() => navigate('/mission/operate')}
                          className="glow-violet mt-5 min-h-14 rounded-full bg-violet-500 px-8 text-lg font-semibold transition hover:bg-violet-400 active:scale-[0.98]"
                        >
                          Start flying →
                        </button>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="go" exit={{ opacity: 0 }}>
                    {ev.launchReady && <OutlookCard outlook={outlook} preview />}
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        disabled={!canLaunch}
                        onClick={() => setCount(3)}
                        className="glow-cyan min-h-14 rounded-full bg-cyan-400 px-10 text-lg font-semibold text-space-950 transition hover:bg-cyan-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 disabled:shadow-none"
                      >
                        {busy ? 'Launching…' : 'Launch 🚀'}
                      </button>
                      {!ev.launchReady && (
                        <p className="text-sm text-slate-400">
                          Fix the {blockers} “Must fix” item{blockers === 1 ? '' : 's'} on the dashboard first.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          <div className="mt-10 lg:hidden">
            <Dashboard ev={ev} phase="launch" anchorId="dashboard" />
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100svh-6rem)] overflow-y-auto pb-4">
            <Dashboard ev={ev} phase="launch" />
          </div>
        </aside>
      </div>

      {/* Phone: status bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-space-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <a href="#dashboard" className="mx-auto flex max-w-6xl items-center justify-between gap-3" aria-label="Show the full dashboard">
          <MiniStatus ev={ev} />
          <span className="text-right text-xs text-slate-400">{ev.launchReady ? 'Ready to launch' : `${blockers} to fix · tap for why`}</span>
        </a>
      </div>
    </div>
  )
}

const VERDICT = {
  likely: { icon: '✅', className: 'text-emerald-200' },
  'at-risk': { icon: '⚠️', className: 'text-amber-200' },
  unlikely: { icon: '❌', className: 'text-rose-200' },
}

/** "Will it complete the mission?" with a reason for each check */
function OutlookCard({ outlook, preview = false }: { outlook: ReturnType<typeof missionOutlook>; preview?: boolean }) {
  const v = VERDICT[outlook.verdict]
  return (
    <div className={preview ? 'card p-5' : 'mt-4 rounded-xl bg-white/5 p-4'}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{preview ? 'Mission outlook before launch' : 'Mission outlook'}</p>
      <p className={`mt-1 font-semibold ${v.className}`}>
        {v.icon} {outlook.headline}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {outlook.checks.map((c) => (
          <li key={c.text} className="flex gap-2">
            <span aria-hidden="true">{c.ok ? '✅' : '⚠️'}</span>
            <span className={c.ok ? 'text-slate-300' : 'text-amber-100'}>{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
