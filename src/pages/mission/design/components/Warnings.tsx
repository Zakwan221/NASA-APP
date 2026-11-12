import { AnimatePresence, motion } from 'framer-motion'
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import type { Warning } from '../../../../game/types'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** Problems with the design, each explained in one sentence. Serious ones first. */
export function WarningList({ warnings }: { warnings: Warning[] }) {
  const sorted = [...warnings].sort((a, b) => Number(b.blocking) - Number(a.blocking))
  if (sorted.length === 0) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> No problems found.
      </p>
    )
  }
  return (
    <ul className="space-y-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {sorted.map((w) => (
          <motion.li
            key={w.message}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className={`flex items-start gap-2 rounded-xl p-3 text-sm ${w.blocking ? 'bg-rose-400/10 text-rose-100' : 'bg-amber-300/10 text-amber-100'}`}
          >
            {w.blocking ? (
              <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-rose-300" />
            ) : (
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-300" />
            )}
            <span>{w.message}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
