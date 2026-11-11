import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, Rotate3d, Sparkles, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import ItemModel from '../../../components/space/ItemModel'
import ItemPicture from '../../../components/space/ItemPicture'
import { barFill, CATALOG, type CatalogGroup, type CatalogItem } from '../catalog'
import { ITEM_NOTES } from '../itemNotes'

const Viewer3D = lazy(() => import('../components/Viewer3D'))
const ThumbnailStudio = lazy(() => import('../../../components/space/thumbnails'))

const EASE_OUT = [0.23, 1, 0.32, 1] as const

function Card({ item, onOpen }: { item: CatalogItem; onOpen: () => void }) {
  const main = item.measures[0]
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="card group flex h-full flex-col p-3 text-left transition hover:border-cyan-300/50"
    >
      <ItemPicture thumb={item.model ? `${item.model.kind}:${item.model.id}` : undefined} orbit={item.orbit} alt={item.name} />
      <span className="mt-2 block font-semibold leading-snug">{item.name}</span>
      {item.advanced && <span className="mt-1 w-fit rounded-full bg-violet-400/15 px-2 py-0.5 text-[11px] text-violet-200">Advanced</span>}
      <span className="mt-1 line-clamp-2 text-xs text-slate-400">{item.explain}</span>
      <span className="mt-auto pt-2 text-xs">
        <span className="text-slate-400">{main.label} </span>
        <span className="font-semibold text-cyan-200">{main.text}</span>
      </span>
    </motion.button>
  )
}

/** Close-up: 3D model, when to pick it, what to watch out for, and how it compares */
function Detail({ group, item, onClose }: { group: CatalogGroup; item: CatalogItem; onClose: () => void }) {
  const note = ITEM_NOTES[item.id]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        initial={{ y: 60, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92svh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-space-900 shadow-2xl sm:flex-row sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
        >
          <X aria-hidden="true" className="size-5" />
        </button>

        {/* 3D or diagram */}
        <div className="relative h-60 shrink-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(56,189,248,0.18),#020309_70%)] sm:h-auto sm:w-1/2">
          {item.model ? (
            <>
              <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Loading 3D…</div>}>
                <Viewer3D margin={item.model.kind === 'rocket' ? 1.1 : 1.35}>
                  <ItemModel kind={item.model.kind} id={item.model.id} />
                </Viewer3D>
              </Suspense>
              <p className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/45 px-3 py-1 text-xs text-slate-200">
                <Rotate3d aria-hidden="true" className="size-3.5" /> Drag to turn it
              </p>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="w-full max-w-sm">
                <ItemPicture orbit={item.orbit} alt={item.name} />
              </div>
            </div>
          )}
        </div>

        {/* Words and numbers */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            <group.icon aria-hidden="true" className="mr-1 inline size-3.5 -translate-y-px" /> {group.title}
          </p>
          <h2 className="mt-1 pr-10 font-display text-2xl font-bold sm:text-3xl">{item.name}</h2>
          <p className="mt-2 text-slate-300">{item.explain}</p>

          {note && (
            <div className="mt-4 space-y-2 text-sm">
              <p className="flex gap-2 rounded-xl bg-emerald-400/10 p-3 text-emerald-100">
                <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <span>
                  <strong>Best when:</strong> {note.best}
                </span>
              </p>
              <p className="flex gap-2 rounded-xl bg-amber-300/10 p-3 text-amber-100">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <span>
                  <strong>Watch out:</strong> {note.watch}
                </span>
              </p>
            </div>
          )}

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">Compared with the other {group.title.toLowerCase()}</h3>
          <ul className="mt-2 space-y-3">
            {item.measures.map((m) => (
              <li key={m.label}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-slate-300">{m.label}</span>
                  <span className="font-semibold tabular-nums">{m.text}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className={`h-full rounded-full ${m.higherIsBetter ? 'bg-emerald-400' : 'bg-amber-300'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${barFill(group, m) * 100}%` }}
                    transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.15 }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">Green: more is better. Amber: more costs you.</p>
          <p className="mt-4 text-xs text-slate-500">Source: {item.source}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

/** /info/items: every item in the game, grouped, with pictures and a 3D close-up */
export default function ItemsPage() {
  const [open, setOpen] = useState<{ group: CatalogGroup; item: CatalogItem } | null>(null)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-32 sm:px-6">
      <Suspense fallback={null}>
        <ThumbnailStudio />
      </Suspense>

      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Items</p>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-5xl">Every item, explained</h1>
        <p className="mt-3 text-slate-300 sm:text-lg">
          Tap any item to see it in 3D, when it is the best pick, what to watch out for, and how it compares with the others.
        </p>
      </header>

      {/* Jump to a group */}
      <nav aria-label="Item groups" className="sticky top-[7.75rem] z-30 -mx-4 mt-6 overflow-x-auto bg-space-950/85 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-full sm:px-2">
        <ul className="flex gap-1.5">
          {CATALOG.map((g) => (
            <li key={g.id}>
              <a
                href={`#${g.id}`}
                className="flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.06] px-3 text-sm font-semibold text-slate-200 hover:bg-white/15"
              >
                <g.icon aria-hidden="true" className="size-4 text-cyan-300" /> {g.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {CATALOG.map((g) => (
        <section key={g.id} id={g.id} className="mt-12 scroll-mt-44" aria-labelledby={`${g.id}-h`}>
          <motion.header
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="flex items-center gap-3"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-cyan-300/10">
              <g.icon aria-hidden="true" className="size-6 text-cyan-300" />
            </span>
            <span>
              <h2 id={`${g.id}-h`} className="text-xl font-bold sm:text-2xl">
                {g.title}
              </h2>
              <span className="text-sm text-slate-400">{g.intro}</span>
            </span>
          </motion.header>
          <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {g.items.map((it, i) => (
              <motion.li
                key={it.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, ease: EASE_OUT, delay: i * 0.05 }}
              >
                <Card item={it} onOpen={() => setOpen({ group: g, item: it })} />
              </motion.li>
            ))}
          </ul>
        </section>
      ))}

      <AnimatePresence>{open && <Detail key={open.item.id} group={open.group} item={open.item} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  )
}
