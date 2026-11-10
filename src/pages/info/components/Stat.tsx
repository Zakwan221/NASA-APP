interface StatProps {
  label: string
  value: string | number
  hint?: string
  accent?: 'cyan' | 'violet' | 'amber' | 'rose'
}

const ACCENTS = {
  cyan: 'text-cyan-300',
  violet: 'text-violet-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
}

export default function Stat({ label, value, hint, accent = 'cyan' }: StatProps) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl ${ACCENTS[accent]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
