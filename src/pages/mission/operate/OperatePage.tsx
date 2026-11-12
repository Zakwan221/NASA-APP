import { motion } from 'framer-motion'
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
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
import type { MissionDesign } from '../../../game/types'

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
  /** Extra panel under the header (e.g. your role and goal) */
  banner?: ReactNode
  /** The design, for drawing the spacecraft in orbit (no 3D without it) */
  design?: MissionDesign
}

/** The Operate screen without its state, so solo and team mode share it. */
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
  design,
}: OperateViewProps) {
  const storage = craft.parts.find((p) => p.category === 'computer')?.storageMbit ?? 0
  const solarW = craft.parts.find((p) => p.category === 'power')?.powerGenW ?? 0
  const busW = craft.parts.reduce((s, p) => s + p.powerDrawW, 0)
  const instrumentW = activeInstruments(craft, state).reduce((s, i) => s + i.powerDrawW, 0)
  const avgGenW = solarW * (1 - craft.orbit.shadowFraction) * (0.5 + state.health / 200)
  const downlink = useMemo(() => downlinkPerMonthMbit(craft), [craft])
  const monthsLeft = state.totalMonths - state.month
  // Science pace: what the mission will bring home if every month goes like the average so far
  const pace = state.month > 0 ? Math.round((state.scienceReturned / state.month) * state.totalMonths) : null

  return (
    <>
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-cyan-300">Phase 3 · Operate</p>
        <h1 className="mt-1 text-3xl font-bold">{craft.scenario.title}</h1>
        <p className="mt-1 text-slate-300">{craft.scenario.objective}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-cyan-300"
              animate={{ width: `${(state.month / state.totalMonths) * 100}%` }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            />
          </div>
          <span className="text-sm text-slate-300 tabular-nums">
            Month {state.month} of {state.totalMonths}
          </span>
        </div>
      </header>

      {design && <OrbitView design={design} craft={craft} month={state.month} />}

      <div className="mb-6">
        <NasaPanel scenarioId={craft.scenario.id} compact />
      </div>

      {banner}

      {/* Resources */}
      <section aria-label="Resources" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Gauge
          label="Power"
          value={`${Math.round(avgGenW)} W made`}
          sub={`${busW} W systems + ${instrumentW} W instruments`}
          fill={Math.min(1, avgGenW / Math.max(1, busW + instrumentW))}
          warn={avgGenW < busW + instrumentW}
          critical={craft.scenario.criticalResources.includes('power')}
        />
        <Gauge
          label="Data storage"
          value={`${Math.round(state.dataStoredMbit / 1000)} / ${Math.round(storage / 1000)} Gbit`}
          sub={`Radio sends ${Math.round(downlink / 1000)} Gbit a month`}
          fill={storage ? state.dataStoredMbit / storage : 0}
          warn={state.dataStoredMbit > storage * 0.8}
          critical={craft.scenario.criticalResources.includes('data')}
        />
        <Gauge
          label="Budget"
          value={`$${state.budgetLeftM.toFixed(2)} M`}
          sub="Ground team and antenna time each month"
          fill={Math.min(1, state.budgetLeftM / Math.max(0.01, craft.budgetLeftM))}
          warn={state.budgetLeftM < 0.5}
          critical={craft.scenario.criticalResources.includes('budget')}
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
            pace === null ? '' : pace >= craft.scenario.scienceTarget ? ' · on track' : ` · on pace for ${pace.toLocaleString()}`
          }`}
          fill={Math.min(1, state.scienceReturned / craft.scenario.scienceTarget)}
          good={pace === null || pace >= craft.scenario.scienceTarget}
          warn={pace !== null && pace < craft.scenario.scienceTarget * 0.6}
        />
        <Gauge
          label="Lifetime"
          value={`${monthsLeft} ${monthsLeft === 1 ? 'month' : 'months'} left`}
          sub={craft.orbit.name}
          fill={1 - state.month / state.totalMonths}
          critical={craft.scenario.criticalResources.includes('lifetime')}
        />
      </section>

      {/* Instruments */}
      <section className="card mt-6 p-5">
        <h2 className="text-lg font-semibold">Instruments</h2>
        <p className="mb-4 text-sm text-slate-400">
          Switching one off saves power and data, but it stops collecting science.
        </p>
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

      {/* A surprise must be answered before the next month can fly */}
      {state.pending ? (
        <EventCard craft={craft} state={state} onChoose={onChoose} control={eventControl} />
      ) : (
        <>
          <FocusPicker month={state.month + 1} focus={state.focus} onFocus={onFocus} disabled={!canFocus} />
          <div className="mt-6 text-center">
            {flyControl ?? (
              <button
                type="button"
                onClick={onFly}
                className="glow-violet min-h-14 rounded-full bg-violet-500 px-10 text-lg font-semibold transition hover:bg-violet-400 active:scale-[0.98]"
              >
                Fly month {state.month + 1} →
              </button>
            )}
          </div>
        </>
      )}

      {/* Last month */}
      {state.lastReport && (
        <section className="card mt-6 p-5">
          <h2 className="text-lg font-semibold">Month {state.lastReport.month} report</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <Stat label="Instruments ran" value={`${Math.round(state.lastReport.instrumentUptime * 100)}%`} />
            <Stat label="Data made" value={`${(state.lastReport.dataMadeMbit / 1000).toFixed(1)} Gbit`} />
            <Stat label="Data sent" value={`${(state.lastReport.dataSentMbit / 1000).toFixed(1)} Gbit`} />
            <Stat label="Science" value={`+${state.lastReport.scienceReturned.toLocaleString()}`} />
          </dl>
          {state.lastReport.notes.length > 0 && (
            <ul className="mt-4 space-y-2">
              {state.lastReport.notes.map((n) => (
                <li key={n} className="rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <MissionLog state={state} />
    </>
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
      className="card mt-6 border-amber-300/40 p-5"
    >
      <p className="text-sm font-semibold uppercase tracking-wider text-amber-200">
        Surprise before month {state.month + 1}
      </p>
      <h2 className="mt-1 text-2xl font-bold">
        <span aria-hidden="true">{event.icon}</span> {event.title}
      </h2>
      <p className="mt-2 text-slate-200">{event.describe(craft, pending)}</p>
      {pending.detail && <p className="mt-2 text-sm text-cyan-200/90">{pending.detail}</p>}
      <p className="mt-1 text-xs text-slate-400">Real missions face this too: {event.source}.</p>
      {control ?? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {event.choices.map((c, i) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onChoose(i)}
              className="min-h-14 rounded-2xl border border-white/15 bg-white/5 p-4 text-left transition hover:border-cyan-300/60 hover:bg-white/10 active:scale-[0.98]"
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
    <section className="card mt-6 p-5">
      <h2 className="text-lg font-semibold">Plan for month {month}</h2>
      <div role="radiogroup" aria-label={`Plan for month ${month}`} className="mt-3 grid gap-2 sm:grid-cols-3">
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
              className={`min-h-12 rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed ${
                on ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/10 hover:bg-white/5'
              } ${disabled && !on ? 'opacity-50' : ''}`}
            >
              <span className="block font-semibold">{FOCUS[f].label}</span>
              <span className="mt-0.5 block text-xs text-slate-400">{FOCUS[f].hint}</span>
            </button>
          )
        })}
      </div>
      {disabled && <p className="mt-3 text-sm text-slate-400">The Flight Director picks the plan.</p>}
    </section>
  )
}

/** The spacecraft in its orbit, with what it is doing right now */
function OrbitView({ design, craft, month }: { design: MissionDesign; craft: FlightSpacecraft; month: number }) {
  const [status, setStatus] = useState<Status>({ light: 'sun', sending: false })
  const far = craft.orbit.shadowFraction === 0
  return (
    <section aria-label={`Your spacecraft in ${craft.orbit.name}`} className="card relative mb-6 h-56 overflow-hidden sm:h-72">
      <Suspense fallback={<div className="h-full w-full animate-pulse bg-white/5" />}>
        <OrbitScene design={design} orbitId={craft.orbit.id} month={month} onStatus={setStatus} />
      </Suspense>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span
          className={`rounded-full px-3 py-1 backdrop-blur ${status.light === 'shadow' ? 'bg-indigo-500/30 text-indigo-100' : 'bg-amber-300/20 text-amber-100'}`}
        >
          {status.light === 'shadow' ? 'In Earth’s shadow: running on battery' : far ? 'Always in sunlight' : 'In sunlight: charging'}
        </span>
        {status.sending && <span className="rounded-full bg-cyan-300/25 px-3 py-1 text-cyan-50 backdrop-blur">Over the ground station: sending data</span>}
      </div>
      <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/40 px-3 py-1 text-xs text-slate-200 backdrop-blur">
        {craft.orbit.name}
      </p>
    </section>
  )
}
