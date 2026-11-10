import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Skeleton from '../../../components/ui/Skeleton'
import { searchImages, type NasaImage } from '../api/images'
import Chip from '../components/Chip'
import DataSource from '../components/DataSource'
import TabHeader from '../components/TabHeader'
import { formatDate } from '../utils/format'

/** NASA's search API stops at 10,000 results */
const MAX_RESULTS = 10_000

const PRESETS = ['Artemis', 'James Webb', 'Hubble', 'Apollo 11', 'Space station', 'Mars', 'Malaysia']

interface Results {
  query: string
  page: number
  total: number
  items: NasaImage[]
}

function Lightbox({ image, onClose }: { image: NasaImage; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={image.title}
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92svh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-space-900 sm:rounded-3xl"
      >
        <div className="relative bg-black">
          <img src={image.largeUrl} alt={image.title} className="max-h-[55svh] w-full object-contain" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-black/70 text-xl text-white hover:bg-black"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
            {formatDate(image.date)}
            {image.center ? ` · NASA ${image.center}` : ''}
          </p>
          <h3 className="mt-1 text-xl font-bold">{image.title}</h3>
          {image.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">{image.description}</p>}
          <a
            href={`https://images.nasa.gov/details/${encodeURIComponent(image.nasaId)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold hover:bg-white/10"
          >
            View on images.nasa.gov ↗
          </a>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function GalleryTab() {
  const [input, setInput] = useState(PRESETS[0])
  const [query, setQuery] = useState(PRESETS[0])
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [results, setResults] = useState<Results | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [open, setOpen] = useState<NasaImage | null>(null)

  const requestKey = `${query}|${page}|${attempt}`

  useEffect(() => {
    let cancelled = false
    searchImages(query, page).then((res) => {
      if (cancelled) return
      if (!res) {
        setFailed(requestKey)
        return
      }
      setResults((prev) => ({
        query,
        page,
        total: res.total,
        items: page > 1 && prev?.query === query ? [...prev.items, ...res.items] : res.items,
      }))
    })
    return () => {
      cancelled = true
    }
  }, [query, page, requestKey])

  const search = (q: string) => {
    const clean = q.trim()
    if (!clean) return
    setInput(clean)
    setQuery(clean)
    setPage(1)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    search(input)
  }

  const isError = failed === requestKey
  const showingQuery = results?.query === query
  const loadingMore = showingQuery && results.page !== page && !isError
  const items = showingQuery ? results.items : []

  return (
    <>
      <TabHeader
        mission="NASA Image and Video Library"
        title="Search NASA's photo archive"
        intro="Over 60 years of missions — rockets, astronauts, galaxies and even photos of Malaysia taken from space. Search anything and tap a photo to read its story."
        why="These are NASA's real mission photos, free for everyone to learn from."
      />

      <form onSubmit={onSubmit} className="mb-4 flex gap-2" role="search">
        <label htmlFor="gallery-search" className="sr-only">
          Search NASA images
        </label>
        <input
          id="gallery-search"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Try 'nebula' or 'moon landing'"
          className="min-h-12 min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-5 text-base text-white placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none"
        />
        <button type="submit" className="min-h-12 rounded-full bg-cyan-400 px-6 font-semibold text-space-950 hover:bg-cyan-300">
          Search
        </button>
      </form>

      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {PRESETS.map((p) => (
          <Chip key={p} active={query.toLowerCase() === p.toLowerCase()} onClick={() => search(p)}>
            {p}
          </Chip>
        ))}
      </div>

      {isError && !loadingMore && items.length === 0 ? (
        <div role="status" className="card flex flex-col items-start gap-3 p-6 text-sm text-slate-300">
          <p>🛰️ We couldn't reach NASA's image library right now.</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="min-h-11 rounded-full border border-white/15 px-5 font-semibold text-white hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      ) : !showingQuery ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-slate-400">No photos found for “{query}”. Try another word.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-400">
            {results.total.toLocaleString('en-MY')} photos for “{query}”
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((img) => (
              <li key={img.nasaId}>
                <button
                  type="button"
                  onClick={() => setOpen(img)}
                  className="group relative block aspect-square w-full overflow-hidden rounded-2xl bg-space-800"
                >
                  <img
                    src={img.thumbUrl}
                    alt={img.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-8 text-left text-xs font-semibold text-white">
                    <span className="line-clamp-2">{img.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {items.length < Math.min(results.total, MAX_RESULTS) && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => (isError ? setAttempt((n) => n + 1) : setPage((p) => p + 1))}
              className="mt-6 min-h-11 w-full rounded-full border border-white/15 font-semibold hover:bg-white/10 disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : isError ? 'Try again' : 'Load more photos'}
            </button>
          )}
        </>
      )}

      <AnimatePresence>{open && <Lightbox image={open} onClose={() => setOpen(null)} />}</AnimatePresence>

      <DataSource
        sources={[
          { name: 'NASA Image and Video Library API', url: 'https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf' },
          { name: 'NASA Images and Media Usage Guidelines', url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/' },
        ]}
        note="NASA photos are generally free to use for education. Credit: NASA."
      />
    </>
  )
}
