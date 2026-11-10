import { AnimatePresence, motion } from 'framer-motion'
import { CircleCheck, Hourglass, HardDrive, Microscope, RadioTower, TriangleAlert, Wallet, Weight, Zap, CircleX, type LucideIcon } from 'lucide-react'
import type { Evaluation } from '../../../../game/engine/evaluate'
import type { ResourceKey, ResourceStatus, Warning } from '../../../../game/types'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

const LABEL: Record<ResourceKey, string> = {
  mass: 'Mass',
  power: 'Power',
  budget: 'Budget',
  data: 'Data',
  comms: 'Comms',
  lifetime: 'Lifetime',
}

const ICON: Record<ResourceKey, LucideIcon> = {
  mass: Weight,
  power: Zap,
  budget: Wallet,
  data: HardDrive,
  comms: RadioTower,
  lifetime: Hourglass,
}

const ORDER: ResourceKey[] = ['mass', 'power', 'budget', 'data', 'comms', 'lifetime']

const km = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M km` : `${Math.round(n).toLocaleString()} km`)
const gbit = (mbit: number) => `${(mbit / 1000).toFixed(mbit < 10_000 ? 1 : 0)} Gbit`

/** Main number and the line under it, in plain words */
function describe(r: ResourceStatus, ev: Evaluation): { value: string; sub: string; empty: boolean } {
  switch (r.key) {
    case 'mass':
      return r.available
        ? { value: `${r.used} / ${r.available} kg`, sub: 'Spacecraft weight vs what the frame (and rocket) can carry', empty: false }
        : { value: `${r.used} kg`, sub: 'Pick a frame to see how much it can carry', empty: true }
    case 'power':
      return { value: `${r.used} W / ${r.available} W`, sub: 'Used vs made on average over one orbit', empty: r.available === 0 }
    case 'budget':
      return {
        value: `$${r.used} M / $${r.available} M`,
        sub: `Build $${ev.buildCostM} M · launch $${ev.launchCostM} M · running it $${ev.opsReserveM} M`,
        empty: false,
      }
    case 'data':
      return {
        value: `${gbit(r.used)} / ${gbit(r.available)}`,
        sub: 'Made vs sent home each month',
        empty: r.available === 0,
      }
    case 'comms':
      return ev.orbit
        ? { value: `${km(r.available)} range`, sub: `Your orbit is ${km(r.used)} from Earth`, empty: r.available === 0 }
        : { value: r.available ? `${km(r.available)} range` : 'No radio', sub: 'How far away Earth can still hear you', empty: !r.available }
    case 'lifetime':
      return {
        value: `${r.used} months`,
        sub: ev.orbit ? `${ev.orbit.name} lasts about ${r.available} months` : 'Planned time in space',
        empty: false,
      }
  }
}

function Gauge({ r, ev }: { r: ResourceStatus; ev: Evaluation }) {
  const { value, sub, empty } = describe(r, ev)
  const critical = ev.scenario?.criticalResources.includes(r.key)
  const Icon = ICON[r.key]
  const fill = r.key === 'comms' ? (r.used && r.available ? Math.min(1, r.used / r.available) : 0) : r.available ? r.used / r.available : 0
  const bad = !empty && !r.ok
  return (
    <div className={`card p-3 ${bad ? 'border-rose-400/40' : ''}`}>
      <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span className="flex items-center gap-1.5">
          <Icon aria-hidden="true" className={`size-3.5 ${bad ? 'text-rose-300' : 'text-cyan-300'}`} />
          {LABEL[r.key]}
        </span>
        {critical && (
          <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] text-amber-200" title="Most important resource for this mission">
            Key
          </span>
        )}
      </p>
      <p className={`mt-1 font-display font-bold tabular-nums ${empty ? 'text-slate-500' : ''}`}>{value}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${bad ? 'bg-rose-400' : 'bg-cyan-300'}`}
          animate={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{sub}</p>
    </div>
  )
}

export function WarningList({ warnings }: { warnings: Warning[] }) {
  const sorted = [...warnings].sort((a, b) => Number(b.blocking) - Number(a.blocking))
  if (sorted.length === 0) {
    return <p className="flex items-start gap-2 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> No problems found. Every resource has room to spare.
      </p>
  }
  return (
    <ul className="space-y-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {sorted.map((w) => (
          <motion.li
            key={w.message}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className={`flex items-start gap-2 rounded-xl p-3 text-sm ${w.blocking ? 'bg-rose-400/10 text-rose-100' : 'bg-amber-300/10 text-amber-100'}`}
          >
            {w.blocking ? (
              <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-rose-300" />
            ) : (
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-300" />
            )}
            <span>
              <span className="mr-1 font-semibold">{w.blocking ? 'Problem:' : 'Heads-up:'}</span>
              {w.message}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

/** The live resource dashboard, shared by Design and Launch */
export default function Dashboard({
  ev,
  phase,
  anchorId,
}: {
  ev: Evaluation
  phase: 'design' | 'launch'
  /** Set on one copy only, for the phone status bar's "tap for why" link */
  anchorId?: string
}) {
  const warnings = phase === 'design' ? ev.warnings.filter((w) => w.phase === 'design') : ev.warnings
  const target = ev.scenario?.scienceTarget ?? 0
  const sciShare = target ? ev.projectedScience / target : 0

  return (
    <section id={anchorId} aria-label="Resource dashboard" className="scroll-mt-20">
      <h2 className="mb-3 text-lg font-semibold">Live dashboard</h2>
      <div className="grid grid-cols-2 gap-2">
        {ORDER.map((k) => (
          <Gauge key={k} r={ev.resources[k]} ev={ev} />
        ))}
      </div>

      {ev.scenario && (
        <div className="card mt-2 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Microscope aria-hidden="true" className="size-3.5 text-cyan-300" /> Expected science
          </p>
          <p className="mt-1 font-display font-bold tabular-nums">
            {ev.projectedScience.toLocaleString()} / {target.toLocaleString()}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className={`h-full rounded-full ${sciShare >= 0.6 ? 'bg-emerald-400' : 'bg-amber-300'}`}
              animate={{ width: `${Math.min(1, sciShare) * 100}%` }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            {sciShare >= 1
              ? 'On track for full science points, if nothing goes wrong.'
              : sciShare >= 0.6
                ? 'Enough to meet the objective. More would earn more science points.'
                : 'Not enough to meet the objective (60% of the target). Add instruments or power, or fly longer.'}
          </p>
        </div>
      )}

      <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wider text-slate-400">Why</h3>
      <WarningList warnings={warnings} />
    </section>
  )
}

/** Compact status for the sticky bottom bar on phones */
export function MiniStatus({ ev }: { ev: Evaluation }) {
  return (
    <div className="flex gap-1.5" aria-label="Resource status">
      {ORDER.map((k) => {
        const r = ev.resources[k]
        const bad = !describe(r, ev).empty && !r.ok
        const Icon = ICON[k]
        return (
          <span
            key={k}
            title={`${LABEL[k]}: ${bad ? 'problem' : 'ok'}`}
            className={`flex size-8 items-center justify-center rounded-lg text-sm ${bad ? 'bg-rose-400/25' : 'bg-white/10'}`}
          >
            <Icon aria-hidden="true" className={`size-4 ${bad ? 'text-rose-200' : 'text-slate-200'}`} />
            <span className="sr-only">
              {LABEL[k]} {bad ? 'problem' : 'ok'}
            </span>
          </span>
        )
      })}
    </div>
  )
}
