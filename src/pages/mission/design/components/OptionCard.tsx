import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { DragHandle, type DragItem } from './dnd'

/** A pickable part, instrument, orbit or rocket with its numbers and a "What is this?" note */
export default function OptionCard({
  name,
  selected,
  disabled,
  onSelect,
  stats,
  explain,
  source,
  badge,
  multi = false,
  note,
  dragItem,
}: {
  name: string
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  stats: { label: string; value: string }[]
  explain: string
  source?: string
  badge?: ReactNode
  /** Checkbox style (instruments) instead of radio style */
  multi?: boolean
  /** Shown when disabled, e.g. why it can't be picked */
  note?: string
  /** Makes the card draggable onto the spacecraft */
  dragItem?: DragItem
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`card flex h-full flex-col p-4 transition ${
        selected ? 'border-cyan-300/70 bg-cyan-300/5' : disabled ? 'opacity-50' : 'hover:border-white/25'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        role={multi ? 'checkbox' : 'radio'}
        aria-checked={selected}
        className="flex min-h-11 w-full items-start gap-3 text-left disabled:cursor-not-allowed"
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 text-xs ${
            multi ? 'rounded-md' : 'rounded-full'
          } ${selected ? 'border-cyan-300 bg-cyan-300 text-space-950' : 'border-white/30'}`}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="flex-1">
          <span className="block font-semibold leading-snug">{name}</span>
          {badge && <span className="mt-1 block">{badge}</span>}
        </span>
      </button>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {stats.map((s) => (
          <div key={s.label} className="flex justify-between gap-2">
            <dt className="text-slate-400">{s.label}</dt>
            <dd className="font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {disabled && note && <p className="mt-2 text-xs text-rose-200">{note}</p>}

      <div className="mt-auto pt-2">
        <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-h-9 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
        >
          {open ? 'Hide' : 'What is this?'}
        </button>
        {dragItem && !disabled && <DragHandle item={dragItem} />}
        </div>
        {open && (
          <p className="text-xs leading-relaxed text-slate-300">
            {explain}
            {source && <span className="mt-1 block text-slate-500">Source: {source}</span>}
          </p>
        )}
      </div>
    </div>
  )
}

/** Horizontal, swipeable row of cards on phones; a grid on bigger screens */
export function CardRow({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
      {children}
    </div>
  )
}

/** Wrapper that gives each card a fixed width inside CardRow on phones */
export function CardSlot({ children }: { children: ReactNode }) {
  return <div className="w-64 shrink-0 snap-start sm:w-auto">{children}</div>
}
