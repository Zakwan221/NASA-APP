import type { OperateState } from '../../../game/events/operate'

/** Small pieces shared by the Operate and Report screens */

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

const TONE = { good: 'text-emerald-300', bad: 'text-rose-300', info: 'text-slate-200' }

export function MissionLog({ state }: { state: OperateState }) {
  if (state.log.length === 0) return null
  return (
    <section className="mt-6 text-left">
      <h2 className="mb-3 text-lg font-semibold">Mission log</h2>
      <ol className="space-y-2">
        {[...state.log].reverse().map((l, idx) => (
          <li key={`${l.month}-${idx}`} className="card p-4 text-sm">
            <p className={`font-semibold ${TONE[l.tone]}`}>
              Month {l.month} · {l.title}
            </p>
            <p className="mt-1 text-slate-300">{l.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
