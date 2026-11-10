import { lazy, Suspense, useCallback } from 'react'
import { instrumentById, partById } from '../../../../game/data'
import type { MissionDesign } from '../../../../game/types'
import { DropZone, type DragItem } from './dnd'

const CraftScene = lazy(() => import('./CraftScene'))

/**
 * The 3D spacecraft as a drop target: drag a part or instrument onto it to fit it.
 * `onFit` receives the dropped item; the page decides which slot it goes in.
 */
export default function AssemblyBay({
  design,
  massKg,
  onFit,
  interactive = true,
  className = '',
}: {
  design: MissionDesign
  massKg: number
  onFit: (item: DragItem) => void
  /** Rotate with the mouse (desktop); on phones it just spins */
  interactive?: boolean
  className?: string
}) {
  const drop = useCallback((item: DragItem) => onFit(item), [onFit])
  const frame = partById(design.engineer.structureId)
  const count =
    Object.values(design.engineer).filter(Boolean).length + (design.comms.radioId ? 1 : 0) + design.science.instrumentIds.length
  const lastInstrument = instrumentById(design.science.instrumentIds.at(-1) ?? '')

  return (
    <DropZone onDrop={drop} className={`card overflow-hidden bg-space-950/80 ${className}`}>
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Loading 3D…</div>}>
        <CraftScene design={design} interactive={interactive} />
      </Suspense>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-space-950 to-transparent p-3 text-xs">
        <span>
          <span className="block font-semibold text-slate-100">{frame ? frame.name : 'Empty assembly bay'}</span>
          <span className="text-slate-400">
            {count} part{count === 1 ? '' : 's'} · {massKg} kg{lastInstrument ? ` · last: ${lastInstrument.name}` : ''}
          </span>
        </span>
        <span className="text-right text-slate-400">Drag parts here ⬆</span>
      </div>
    </DropZone>
  )
}
