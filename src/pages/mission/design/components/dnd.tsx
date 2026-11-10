/**
 * Tiny drag-and-drop that works with mouse AND touch (HTML5 drag-and-drop
 * doesn't work on phones). Drag starts from a handle, a ghost follows the
 * finger, and dropping over a <DropZone> calls its onDrop.
 */

import { createContext, useCallback, useContext, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface DragItem {
  kind: 'part' | 'instrument'
  id: string
  name: string
}

interface DragState {
  item: DragItem
  x: number
  y: number
  overZone: boolean
}

interface DndApi {
  drag: DragState | null
  start: (item: DragItem, e: PointerEvent) => void
  registerZone: (el: HTMLElement, onDrop: (item: DragItem) => void) => () => void
}

const Ctx = createContext<DndApi | null>(null)

const ZONE_ATTR = 'data-dropzone'

export function DndProvider({ children }: { children: ReactNode }) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const zones = useRef(new Map<HTMLElement, (item: DragItem) => void>())

  const zoneAt = (x: number, y: number) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const zone = (el as HTMLElement).closest?.(`[${ZONE_ATTR}]`) as HTMLElement | null
      if (zone && zones.current.has(zone)) return zone
    }
    return null
  }

  const start = useCallback((item: DragItem, e: PointerEvent) => {
    e.preventDefault()
    setDrag({ item, x: e.clientX, y: e.clientY, overZone: false })
    const move = (ev: globalThis.PointerEvent) =>
      setDrag((d) => d && { ...d, x: ev.clientX, y: ev.clientY, overZone: Boolean(zoneAt(ev.clientX, ev.clientY)) })
    const end = (ev: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', cancel)
      const zone = zoneAt(ev.clientX, ev.clientY)
      if (zone) zones.current.get(zone)?.(item)
      setDrag(null)
    }
    const cancel = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', cancel)
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cancel)
  }, [])

  const registerZone = useCallback((el: HTMLElement, onDrop: (item: DragItem) => void) => {
    zones.current.set(el, onDrop)
    return () => {
      zones.current.delete(el)
    }
  }, [])

  return (
    <Ctx.Provider value={{ drag, start, registerZone }}>
      {children}
      {drag &&
        createPortal(
          <div
            aria-hidden="true"
            className={`pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-xl transition-colors ${
              drag.overZone ? 'bg-emerald-400 text-space-950' : 'bg-cyan-300 text-space-950'
            }`}
            style={{ left: drag.x, top: drag.y }}
          >
            {drag.overZone ? '⬇ Drop to fit ' : ''}
            {drag.item.name}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  )
}

function useDnd() {
  const api = useContext(Ctx)
  if (!api) throw new Error('Wrap the page in <DndProvider>')
  return api
}

/** The "grab here" handle on a card */
export function DragHandle({ item }: { item: DragItem }) {
  const { start } = useDnd()
  return (
    <button
      type="button"
      onPointerDown={(e) => start(item, e)}
      aria-label={`Drag ${item.name} onto the spacecraft`}
      title="Drag onto the spacecraft"
      className="flex min-h-9 cursor-grab touch-none select-none items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-semibold text-slate-200 hover:bg-white/15 active:cursor-grabbing"
    >
      <span aria-hidden="true">⠿</span> Drag
    </button>
  )
}

/** Where items can be dropped. Glows while something is dragged over it. */
export function DropZone({
  onDrop,
  className = '',
  children,
}: {
  onDrop: (item: DragItem) => void
  className?: string
  children: ReactNode
}) {
  const { drag, registerZone } = useDnd()
  // React 19 ref callback: the returned function unregisters the zone
  const ref = useCallback((el: HTMLDivElement | null) => (el ? registerZone(el, onDrop) : undefined), [registerZone, onDrop])
  return (
    <div
      ref={ref}
      {...{ [ZONE_ATTR]: '' }}
      className={`relative transition ${drag ? (drag.overZone ? 'ring-2 ring-emerald-400' : 'ring-2 ring-cyan-300/50') : ''} ${className}`}
    >
      {children}
      {drag && (
        <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs font-semibold text-cyan-200">
          Drop here to fit it
        </div>
      )}
    </div>
  )
}
