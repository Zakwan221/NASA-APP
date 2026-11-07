import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { summarize, type FlightSpacecraft, type OperateState } from '../../../game/events/operate'
import { grade, scoreMission, type MissionScore } from '../../../game/scoring/score'
import { MissionLog, Stat } from '../operate/parts'
import { loadAttempts, saveAttempt, type Attempt } from './attempts'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** Phase 4: score out of 100, why, what to try next, and how it compares with the last attempt. */
export default function ReportScreen({
  craft,
  state,
  onFlyAgain,
  team = false,
  previousTotal,
  footer,
}: {
  craft: FlightSpacecraft
  state: OperateState
  /** Missing for team players who are not the host: they wait for the host */
  onFlyAgain?: () => void
  team?: boolean
  /** Team mode: the room's last attempt. Leave out to use this browser's solo history. */
  previousTotal?: number | null
  /** Extra content under the stats, e.g. the team leaderboard */
  footer?: ReactNode
}) {
  const summary = useMemo(() => summarize(craft, state), [craft, state])
  // Recomputed if late moves arrive, so every phone shows the same score
  const score: MissionScore = useMemo(() => scoreMission(summary, { team }), [summary, team])
  const solo = previousTotal === undefined
  // The attempt before this one, read before this one is saved
  const [previous] = useState<Pick<Attempt, 'total'> | null>(() =>
    solo ? (loadAttempts(craft.scenario.id).at(-1) ?? null) : previousTotal === null ? null : { total: previousTotal },
  )

  // Save once per finished mission (the ref stops React's dev double-run saving twice)
  const saved = useRef(false)
  useEffect(() => {
    if (saved.current || !solo) return
    saved.current = true
    saveAttempt(craft.scenario.id, { total: score.total, science: summary.scienceReturned, at: Date.now() })
  }, [craft.scenario.id, score.total, summary.scienceReturned, solo])

  const g = grade(score.total)
  const diff = previous ? score.total - previous.total : null
  const tips = score.parts.filter((p) => p.tip)

  return (
    <section>
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-cyan-300">Mission report</p>
      <div className="mt-2 text-center">
        <motion.p
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="font-display text-7xl font-bold tabular-nums"
        >
          {score.total}
          <span className="text-3xl text-slate-400">/100</span>
        </motion.p>
        <h1
          className={`mt-2 text-2xl font-bold ${g.tone === 'good' ? 'text-emerald-300' : g.tone === 'ok' ? 'text-amber-300' : 'text-rose-300'}`}
        >
          {g.label}
        </h1>
        <p className="mt-1 text-slate-300">{summary.reason}</p>
        {diff !== null && (
          <p className="mt-3 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm">
            Last attempt: {previous!.total} →{' '}
            <span className={diff > 0 ? 'text-emerald-300' : diff < 0 ? 'text-rose-300' : 'text-slate-200'}>
              {diff > 0 ? `+${diff}` : diff} points
            </span>
          </p>
        )}
      </div>

      {/* Breakdown */}
      <ul className="mt-8 space-y-3">
        {score.parts.map((p, idx) => (
          <motion.li
            key={p.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + idx * 0.08, duration: 0.3, ease: EASE_OUT }}
            className="card p-5"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-semibold">{p.label}</h2>
              <p className="font-display text-xl font-bold tabular-nums">
                {p.points}
                <span className="text-sm text-slate-400">/{p.max}</span>
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={`h-full rounded-full ${p.points / p.max >= 0.8 ? 'bg-emerald-400' : p.points / p.max >= 0.5 ? 'bg-amber-300' : 'bg-rose-400'}`}
                initial={{ width: 0 }}
                animate={{ width: `${(p.points / p.max) * 100}%` }}
                transition={{ delay: 0.2 + idx * 0.08, duration: 0.5, ease: EASE_OUT }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-300">{p.reason}</p>
          </motion.li>
        ))}
      </ul>

      {/* What to try next */}
      {tips.length > 0 && (
        <section className="card mt-6 border-cyan-300/30 p-5">
          <h2 className="font-semibold">Try this next time</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-200">
            {tips.map((p) => (
              <li key={p.key}>{p.tip}</li>
            ))}
          </ul>
        </section>
      )}

      <dl className="card mt-6 grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-3">
        <Stat label="Months flown" value={`${summary.monthsFlown} / ${summary.plannedMonths}`} />
        <Stat label="Science sent home" value={summary.scienceReturned.toLocaleString()} />
        <Stat label="Instruments ran" value={`${Math.round(summary.averageUptime * 100)}% on average`} />
        <Stat label="Data lost" value={`${(summary.dataLostMbit / 1000).toFixed(1)} Gbit`} />
        <Stat label="Budget left" value={`$${summary.budgetLeftM.toFixed(2)} M`} />
        <Stat label="Health" value={`${summary.health}%`} />
      </dl>

      {footer}

      <MissionLog state={state} />

      <div className="mt-8 text-center">
        {onFlyAgain ? (
          <>
            <button
          type="button"
          onClick={onFlyAgain}
          className="glow-violet min-h-14 rounded-full bg-violet-500 px-10 text-lg font-semibold transition hover:bg-violet-400 active:scale-[0.98]"
        >
          Fly again
            </button>
            <p className="mt-2 text-sm text-slate-400">Change your strategy and try to beat {score.total}.</p>
          </>
        ) : (
          <p className="text-slate-400">Waiting for the host to start the next attempt…</p>
        )}
      </div>
    </section>
  )
}
