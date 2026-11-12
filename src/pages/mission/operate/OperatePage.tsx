import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { EVENTS } from '../../../game/events/events'
import {
  activeInstruments,
  chooseEventOption,
  downlinkPerMonthMbit,
  FOCUS,
  runMonth,
  setFocus,
  startOperate,
  toggleInstrument,
  type FlightSpacecraft,
  type MissionFocus,
  type OperateState,
} from '../../../game/events/operate'
import { newSeed } from '../../../game/events/random'
import NasaPanel from '../nasa/NasaPanel'
import ReportScreen from '../report/ReportScreen'
import { MissionLog, Stat } from './parts'
import type { Status } from './OrbitScene'
import { PLACEHOLDER_CRAFT } from './placeholderCraft'
import { EMPTY_DESIGN, type MissionDesign } from '../../../game/types'

const OrbitScene = lazy(() => import('./OrbitScene'))

const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** Phase 3, solo: fly the mission month by month in this browser. */
export default function OperatePage({
  craft = PLACEHOLDER_CRAFT,
  design,
  reportFooter,
}: {
  craft?: FlightSpacecraft
  /** The design, for drawing the spacecraft in orbit */
  design?: MissionDesign
  /** Extra content on the Report screen, e.g. the Redesign button */
  reportFooter?: ReactNode
}) {
  const [state, setState] = useState<OperateState>(() => startOperate(craft, newSeed()))

  if (state.ended) {
    return (
      <Shell>
        <ReportScreen
          craft={craft}
          state={state}
          onFlyAgain={() => setState(startOperate(craft, newSeed()))}
          footer={reportFooter}
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <OperateView
        craft={craft}
        state={state}
        onToggle={(id, on) => setState((s) => toggleInstrument(s, id, on))}
        onFly={() => setState((s) => (s.pending ? s : runMonth(craft, s)))}
        onChoose={(i) => setState((s) => chooseEventOption(craft, s, i))}
        onFocus={(f) => setState((s) => setFocus(s, f))}
        design={design}
      />
    </Shell>
  )
}

export interface OperateViewProps {
  craft: FlightSpacecraft
  state: OperateState
  onToggle: (instrumentId: string, on: boolean) => void
  onFly: () => void
  /** Answer the surprise event with this choice */
  onChoose: (choiceIndex: number) => void
  /** Pick the plan for the coming month */
  onFocus: (focus: MissionFocus) => void
  /** Team mode: false for players who don't pick the month's plan */
  canFocus?: boolean
  /** Team mode: replaces the event choice buttons (e.g. the crew vote) */
  eventControl?: ReactNode
  /** Team mode: false for players who don't control the instruments */
  canToggle?: boolean
  /** Shown under the instruments when switching is locked */
  toggleNote?: string
  /** Team mode: replaces the Fly button (e.g. "Waiting for the host") */
  flyControl?: ReactNode
  /** Extra panel at the top of Details (e.g. your role and goal) */
  banner?: ReactNode
  /** Messages over the dashboard (e.g. reconnecting, an error) */
  alert?: ReactNode
  /** The design, for drawing the spacecraft in orbit (no 3D without it) */
  design?: MissionDesign
}

/**
 * The Operate screen without its state, so solo and team mode share it.
 * Full screen like the launch pad: your spacecraft in 3D, a small dashboard on
 * top, and the month's plan and the Fly button at the bottom. Everything else
 * (instruments, NASA data, last month, the log) is one tap away in Details.
 */
export function OperateView({
  craft,
  state,
  onToggle,
  onFly,
  onChoose,
  onFocus,
  canFocus = true,
  eventControl,
  canToggle = true,
  toggleNote,
  flyControl,
  banner,
  alert,
  design,
}: OperateViewProps) {
  const [details, setDetails] = useState(false)
  const [status, setStatus] = useState<Status>({ light: 'sun', sending: false })
  const r = useResources(craft, state)
  const note = state.lastReport?.notes[0]

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-space-950" aria-label="Phase 3: Operate">
      <Suspense fallback={<div className="h-full w-full animate-pulse bg-white/[0.03]" />}>
        <OrbitScene
          design={design ?? EMPTY_DESIGN}
          orbitId={craft.orbit.id}
          month={state.month}
          effect={state.pending?.id ?? null}
          onStatus={setStatus}
        />
      </Suspense>

      {/* Top: mission, month, dashboard */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/50 to-transparent p-3 pb-10 sm:p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold text-white">
              <span className="text-cyan-300">Phase 3 · </span>
              {craft.scenario.title}
            </p>
            <p className="shrink-0 text-sm tabular-nums text-slate-200">
              Month {state.month} of {state.totalMonths}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
            <motion.div
              className="h-full rounded-full bg-cyan-300"
              animate={{ width: `${(state.month / state.totalMonths) * 100}%` }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            <Chip label="Power" value={`${Math.round(r.genW)} W`} fill={r.genW / Math.max(1, r.needW)} warn={r.genW < r.needW} keyRes={r.key.power} />
            <Chip label="Battery" value={`${Math.round(state.batteryFactor * 100)}%`} fill={state.batteryFactor} warn={state.batteryFactor < 0.6} />
            <Chip
              label="Storage"
              value={`${Math.round(state.dataStoredMbit / 1000)}/${Math.round(r.storage / 1000)} Gb`}
              fill={r.storage ? state.dataStoredMbit / r.storage : 0}
              warn={state.dataStoredMbit > r.storage * 0.8}
              keyRes={r.key.data}
            />
            <Chip label="Budget" value={`$${state.budgetLeftM.toFixed(1)} M`} fill={state.budgetLeftM / Math.max(0.01, craft.budgetLeftM)} warn={state.budgetLeftM < 0.5} keyRes={r.key.budget} />
            <Chip label="Health" value={`${state.health}%`} fill={state.health / 100} warn={state.health < 50} />
            <Chip
              label="Science"
              value={`${Math.round((state.scienceReturned / craft.scenario.scienceTarget) * 100)}%`}
              fill={state.scienceReturned / craft.scenario.scienceTarget}
              good={r.onTrack}
              warn={r.pace !== null && r.pace < craft.scenario.scienceTarget * 0.6}
            />
          </dl>
          {alert && <div className="pointer-events-auto mt-3">{alert}</div>}
        </div>
      </div>

      {/* What the spacecraft is doing right now */}
      <div className="pointer-events-none absolute left-3 top-[46%] flex flex-col items-start gap-1.5 text-xs font-semibold sm:left-6">
        <span className={`rounded-full px-3 py-1 backdrop-blur ${status.light === 'shadow' ? 'bg-indigo-500/35 text-indigo-50' : 'bg-amber-300/25 text-amber-50'}`}>
          {status.light === 'shadow' ? 'In Earth’s shadow: on battery' : r.far ? 'Always in sunlight' : 'In sunlight: charging'}
        </span>
        {status.sending && <span className="rounded-full bg-cyan-300/30 px-3 py-1 text-cyan-50 backdrop-blur">Over the ground station: sending data</span>}
        <span className="rounded-full bg-black/45 px-3 py-1 font-normal text-slate-200 backdrop-blur">{craft.orbit.name}</span>
        <button
          type="button"
          onClick={() => setDetails(true)}
          className="pointer-events-auto min-h-8 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-3 py-1 text-cyan-100 backdrop-blur hover:bg-cyan-400/25"
        >
          Real NASA data ›
        </button>
      </div>

      <MonthDeltas state={state} />

      {/* Bottom: the surprise, or the month's plan and Fly */}
      <div className="absolute inset-x-0 bottom-0 max-h-[62svh] overflow-y-auto p-3 sm:mx-auto sm:max-w-xl sm:p-4">
        <div className="rounded-3xl border border-white/10 bg-space-900/85 p-4 shadow-2xl backdrop-blur-md">
          {state.pending ? (
            <EventCard craft={craft} state={state} onChoose={onChoose} control={eventControl} />
          ) : (
            <>
              {note && (
                <p className="mb-3 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                  Month {state.lastReport?.month}: {note}
                </p>
              )}
              <FocusPicker month={state.month + 1} focus={state.focus} onFocus={onFocus} disabled={!canFocus} />
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDetails(true)}
                  className="min-h-14 shrink-0 rounded-full bg-white/10 px-5 text-sm font-semibold transition hover:bg-white/20 active:scale-[0.97]"
                >
                  Details
                </button>
                <div className="flex-1 text-center">
                  {flyControl ?? (
                    <button
                      type="button"
                      onClick={onFly}
                      className="glow-cyan min-h-14 w-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-6 text-lg font-bold text-white transition hover:brightness-110 active:scale-[0.97]"
                    >
                      Fly month {state.month + 1} →
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {details && (
          <DetailsSheet onClose={() => setDetails(false)}>
            {banner}
            <div className="mb-6">
              <NasaPanel scenarioId={craft.scenario.id} compact />
            </div>
            <Resources craft={craft} state={state} r={r} />
            <Instruments craft={craft} state={state} onToggle={onToggle} canToggle={canToggle} toggleNote={toggleNote} />
            <LastMonth state={state} />
            <MissionLog state={state} />
          </DetailsSheet>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Numbers the screen needs, worked out once per render */
function useResources(craft: FlightSpacecraft, state: OperateState) {
  const downlink = useMemo(() => downlinkPerMonthMbit(craft), [craft])
  const storage = craft.parts.find((p) => p.category === 'computer')?.storageMbit ?? 0
  const solarW = craft.parts.find((p) => p.category === 'power')?.powerGenW ?? 0
  const busW = craft.parts.reduce((s, p) => s + p.powerDrawW, 0)
  const instrumentW = activeInstruments(craft, state).reduce((s, i) => s + i.powerDrawW, 0)
  const genW = solarW * (1 - craft.orbit.shadowFraction) * (0.5 + state.health / 200)
  // Science pace: what the mission brings home if every month goes like the average so far
  const pace = state.month > 0 ? Math.round((state.scienceReturned / state.month) * state.totalMonths) : null
  const crit = craft.scenario.criticalResources
  return {
    downlink,
    storage,
    busW,
    instrumentW,
    genW,
    needW: busW + instrumentW,
    pace,
    onTrack: pace === null || pace >= craft.scenario.scienceTarget,
    far: craft.orbit.shadowFraction === 0,
    key: { power: crit.includes('power'), data: crit.includes('data'), budget: crit.includes('budget'), lifetime: crit.includes('lifetime') },
  }
}
type Res = ReturnType<typeof useResources>

/** A small dashboard number over the 3D view */
function Chip({ label, value, fill, warn, good, keyRes }: { label: string; value: string; fill: number; warn?: boolean; good?: boolean; keyRes?: boolean }) {
  const color = warn ? 'bg-rose-400' : good ? 'bg-emerald-400' : 'bg-cyan-300'
  return (
    <div className={`rounded-xl border px-2.5 py-1.5 backdrop-blur ${warn ? 'border-rose-400/50 bg-rose-950/40' : 'border-white/10 bg-black/40'}`}>
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
        {label}
        {keyRes && <span className="size-1.5 rounded-full bg-amber-300" title="Most important resource for this mission" />}
      </dt>
      <dd className="font-display text-sm font-bold tabular-nums text-white">{value}</dd>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
        <motion.div className={`h-full rounded-full ${color}`} animate={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }} transition={{ duration: 0.4, ease: EASE_OUT }} />
      </div>
    </div>
  )
}

/** After each month: what it brought, floating up from the spacecraft */
function MonthDeltas({ state }: { state: OperateState }) {
  const rep = state.lastReport
  const items = rep
    ? [
        rep.scienceReturned > 0 ? { text: `+${rep.scienceReturned.toLocaleString()} science`, cls: 'text-emerald-300' } : null,
        rep.dataLostMbit > 0 ? { text: `${(rep.dataLostMbit / 1000).toFixed(1)} Gbit lost`, cls: 'text-rose-300' } : null,
        { text: `−$${rep.costM.toFixed(2)} M`, cls: 'text-slate-200' },
      ].filter((x): x is { text: string; cls: string } => x !== null)
    : []
  return (
    <AnimatePresence>
      {rep && (
        <motion.div
          key={rep.month}
          aria-live="polite"
          className="pointer-events-none absolute inset-x-0 top-[30%] flex flex-col items-center gap-1 font-display text-base font-bold"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: [0, 1, 1, 0], y: -36 }}
          transition={{ duration: 2.4, ease: EASE_OUT, times: [0, 0.15, 0.7, 1] }}
        >
          {items.map((i) => (
            <span key={i.text} className={`rounded-full bg-black/60 px-3 py-0.5 backdrop-blur ${i.cls}`}>
              {i.text}
            </span>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Everything that doesn't need to be on screen all the time */
function DetailsSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Mission details"
      className="absolute inset-0 z-10 overflow-y-auto bg-space-950/95 backdrop-blur"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between bg-space-950/90 px-4 py-3 backdrop-blur">
        <h2 className="text-lg font-bold">Mission details</h2>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20"
        >
          Back to the spacecraft
        </button>
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-24">{children}</div>
    </motion.div>
  )
}

function Resources({ craft, state, r }: { craft: FlightSpacecraft; state: OperateState; r: Res }) {
  const monthsLeft = state.totalMonths - state.month
  return (
    <section aria-label="Resources" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Gauge
        label="Power"
        value={`${Math.round(r.genW)} W made`}
        sub={`${r.busW} W systems + ${r.instrumentW} W instruments`}
        fill={Math.min(1, r.genW / Math.max(1, r.needW))}
        warn={r.genW < r.needW}
        critical={r.key.power}
      />
      <Gauge
        label="Data storage"
        value={`${Math.round(state.dataStoredMbit / 1000)} / ${Math.round(r.storage / 1000)} Gbit`}
        sub={`Radio sends ${Math.round(r.downlink / 1000)} Gbit a month`}
        fill={r.storage ? state.dataStoredMbit / r.storage : 0}
        warn={state.dataStoredMbit > r.storage * 0.8}
        critical={r.key.data}
      />
      <Gauge
        label="Budget"
        value={`$${state.budgetLeftM.toFixed(2)} M`}
        sub="Ground team and antenna time each month"
        fill={Math.min(1, state.budgetLeftM / Math.max(0.01, craft.budgetLeftM))}
        warn={state.budgetLeftM < 0.5}
        critical={r.key.budget}
      />
      <Gauge
        label="Health"
        value={`${state.health}%`}
        sub={`Battery holds ${Math.round(state.batteryFactor * 100)}% of its first charge`}
        fill={state.health / 100}
        warn={state.health < 50}
      />
      <Gauge
        label="Science sent home"
        value={`${Math.round(state.scienceReturned).toLocaleString()}`}
        sub={`Goal ${craft.scenario.scienceTarget.toLocaleString()}${
          r.pace === null ? '' : r.onTrack ? ' · on track' : ` · on pace for ${r.pace.toLocaleString()}`
        }`}
        fill={Math.min(1, state.scienceReturned / craft.scenario.scienceTarget)}
        good={r.onTrack}
        warn={r.pace !== null && r.pace < craft.scenario.scienceTarget * 0.6}
      />
      <Gauge
        label="Lifetime"
        value={`${monthsLeft} ${monthsLeft === 1 ? 'month' : 'months'} left`}
        sub={craft.orbit.name}
        fill={1 - state.month / state.totalMonths}
        critical={r.key.lifetime}
      />
    </section>
  )
}

function Instruments({
  craft,
  state,
  onToggle,
  canToggle,
  toggleNote,
}: {
  craft: FlightSpacecraft
  state: OperateState
  onToggle: (id: string, on: boolean) => void
  canToggle: boolean
  toggleNote?: string
}) {
  return (
    <section className="card mt-6 p-5">
      <h2 className="text-lg font-semibold">Instruments</h2>
      <p className="mb-4 text-sm text-slate-400">Switching one off saves power and data, but it stops collecting science.</p>
      <ul className="space-y-2">
        {craft.instruments.map((i) => {
          const broken = state.brokenInstruments.includes(i.id)
          const on = state.instrumentsOn[i.id] && !broken
          return (
            <li key={i.id}>
              <label
                className={`flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2 transition hover:bg-white/5 ${broken ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <span>
                  <span className="block font-semibold">
                    {i.name} {broken && <span className="text-sm text-rose-300">· broken</span>}
                  </span>
                  <span className="text-sm text-slate-400 tabular-nums">
                    {i.powerDrawW} W · {(i.dataPerDayMbit / 1000).toFixed(1)} Gbit/day · science {i.scienceValue}/day
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="h-6 w-6 accent-cyan-300"
                  checked={on}
                  disabled={broken || !canToggle}
                  onChange={(e) => onToggle(i.id, e.target.checked)}
                />
              </label>
            </li>
          )
        })}
      </ul>
      {toggleNote && <p className="mt-3 text-sm text-slate-400">{toggleNote}</p>}
    </section>
  )
}

function LastMonth({ state }: { state: OperateState }) {
  const rep = state.lastReport
  if (!rep) return null
  return (
    <section className="card mt-6 p-5">
      <h2 className="text-lg font-semibold">Month {rep.month} report</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="Instruments ran" value={`${Math.round(rep.instrumentUptime * 100)}%`} />
        <Stat label="Data made" value={`${(rep.dataMadeMbit / 1000).toFixed(1)} Gbit`} />
        <Stat label="Data sent" value={`${(rep.dataSentMbit / 1000).toFixed(1)} Gbit`} />
        <Stat label="Science" value={`+${rep.scienceReturned.toLocaleString()}`} />
      </dl>
      {rep.notes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rep.notes.map((n) => (
            <li key={n} className="rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              {n}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-20 sm:px-6 sm:pt-24">{children}</div>
}

function Gauge(props: {
  label: string
  value: string
  sub: string
  fill: number
  warn?: boolean
  good?: boolean
  critical?: boolean
}) {
  const color = props.warn ? 'bg-rose-400' : props.good ? 'bg-emerald-400' : 'bg-cyan-300'
  return (
    <div className={`card p-4 ${props.warn ? 'border-rose-400/40' : ''}`}>
      <p className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {props.label}
        {props.critical && (
          <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] text-amber-200" title="Most important resource for this mission">
            Key
          </span>
        )}
      </p>
      <p className="mt-1 font-display text-lg font-bold tabular-nums">{props.value}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${color}`}
          animate={{ width: `${Math.max(0, Math.min(1, props.fill)) * 100}%` }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">{props.sub}</p>
    </div>
  )
}


/** A surprise in flight: what is happening, and two choices with their cost */
function EventCard({
  craft,
  state,
  onChoose,
  control,
}: {
  craft: FlightSpacecraft
  state: OperateState
  onChoose: (choiceIndex: number) => void
  control?: ReactNode
}) {
  const pending = state.pending!
  const event = EVENTS[pending.id]
  return (
    <motion.section
      key={`${state.month}-${pending.id}`}
      aria-live="polite"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
    >
      <p className="text-sm font-semibold uppercase tracking-wider text-amber-200">
        Surprise before month {state.month + 1}
      </p>
      <h2 className="mt-1 text-xl font-bold">
        <span aria-hidden="true">{event.icon}</span> {event.title}
      </h2>
      <p className="mt-2 text-sm text-slate-200">{event.describe(craft, pending)}</p>
      {pending.detail && <p className="mt-2 text-sm text-cyan-200/90">{pending.detail}</p>}
      <p className="mt-1 text-xs text-slate-400">Real missions face this too: {event.source}.</p>
      {control ?? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {event.choices.map((c, i) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onChoose(i)}
              className="min-h-14 rounded-2xl border border-white/15 bg-white/5 p-3 text-left transition hover:border-cyan-300/60 hover:bg-white/10 active:scale-[0.98]"
            >
              <span className="block font-semibold">{c.label}</span>
              <span className="mt-1 block text-sm text-slate-300">{c.hint}</span>
            </button>
          ))}
        </div>
      )}
    </motion.section>
  )
}

/** The plan for the coming month: steady, push for science, or look after the spacecraft */
function FocusPicker({
  month,
  focus,
  onFocus,
  disabled,
}: {
  month: number
  focus: MissionFocus
  onFocus: (f: MissionFocus) => void
  disabled: boolean
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Plan for month {month}</h2>
      <div role="radiogroup" aria-label={`Plan for month ${month}`} className="mt-2 grid grid-cols-3 gap-1.5">
        {(Object.keys(FOCUS) as MissionFocus[]).map((f) => {
          const on = f === focus
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onFocus(f)}
              className={`min-h-11 rounded-xl border px-2 py-1.5 text-sm font-semibold leading-tight transition disabled:cursor-not-allowed ${
                on ? 'border-cyan-300 bg-cyan-300/15 text-white' : 'border-white/10 text-slate-300 hover:bg-white/5'
              } ${disabled && !on ? 'opacity-50' : ''}`}
            >
              {FOCUS[f].label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-slate-300">
        {disabled ? 'The Flight Director picks the plan. ' : ''}
        {FOCUS[focus].hint}
      </p>
    </section>
  )
}
