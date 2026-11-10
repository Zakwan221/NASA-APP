const STEPS = ['Design', 'Launch', 'Operate', 'Report'] as const

/** "Design → Launch → Operate → Report" with the current phase highlighted */
export default function PhaseSteps({ current }: { current: (typeof STEPS)[number] }) {
  const idx = STEPS.indexOf(current)
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold" aria-label="Mission phases">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            aria-current={i === idx ? 'step' : undefined}
            className={`rounded-full px-2.5 py-1 ${
              i === idx ? 'bg-cyan-300 text-space-950' : i < idx ? 'bg-cyan-300/20 text-cyan-200' : 'bg-white/10 text-slate-400'
            }`}
          >
            {i + 1}. {s}
          </span>
          {i < STEPS.length - 1 && (
            <span aria-hidden="true" className="text-slate-600">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
