import type { ReactNode } from 'react'

interface ChipProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

/** Toggle pill used for filters and sorting */
export default function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
        active
          ? 'border-cyan-300 bg-cyan-300/15 text-cyan-200'
          : 'border-white/15 text-slate-300 hover:border-white/30 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
