import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { DragHandle, type DragItem } from './dnd'

/**
 * A pickable part, instrument, orbit or rocket. Kept simple on purpose: the
 * name, one plain sentence, and the three numbers that matter most. The rest
 * (and the source) hide behind "More numbers".
 */
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
  dragItem,
  picture,
}: {
  name: string
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  /** Most important first: the first three are always shown */
  stats: { label: string; value: string }[]
  explain: string
  source?: string
  badge?: ReactNode
  /** Checkbox style (instruments) instead of radio style */
  multi?: boolean
  /** Makes the card draggable onto the spacecraft */
  dragItem?: DragItem
  /** A picture of the item, shown at the top so players know what it is */
  picture?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const main = stats.slice(0, 3)
  const rest = stats.slice(3)
  return (
    <div
      className={`card flex h-full flex-col p-4 transition ${
        selected ? 'border-cyan-300/70 bg-cyan-300/5' : disabled ? 'opacity-50' : 'hover:border-white/25'
      }`}
    >
      {picture && (
        <button type="button" onClick={onSelect} disabled={disabled} tabIndex={-1} aria-hidden="true" className="mb-3 block w-full">
          {picture}
        </button>
      )}
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
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 ${multi ? 'rounded-md' : 'rounded-full'} ${
            selected ? 'border-cyan-300 bg-cyan-300 text-space-950' : 'border-white/30'
          }`}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="flex-1">
          <span className="block font-semibold leading-snug">{name}</span>
          {badge && <span className="mt-1 block">{badge}</span>}
          <span className="mt-1.5 block text-sm leading-snug text-slate-300">{explain}</span>
        </span>
      </button>

      <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
        {main.map((s) => (
          <li key={s.label} className="rounded-lg bg-white/[0.07] px-2 py-1">
            <span className="text-slate-400">{s.label} </span>
            <span className="font-semibold tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        {rest.length > 0 || source ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="min-h-9 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            {open ? 'Hide numbers' : 'More numbers'}
          </button>
        ) : (
          <span />
        )}
        {dragItem && !disabled && <DragHandle item={dragItem} />}
      </div>
      {open && (
        <div className="text-xs text-slate-300">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {rest.map((s) => (
              <div key={s.label} className="flex justify-between gap-2">
                <dt className="text-slate-400">{s.label}</dt>
                <dd className="font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
          {source && <p className="mt-2 text-slate-500">Source: {source}</p>}
        </div>
      )}
    </div>
  )
}
