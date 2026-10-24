import { useState } from 'react'
import ErrorMessage from '../../../components/ui/ErrorMessage'
import Section from '../../../components/ui/Section'
import Skeleton from '../../../components/ui/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { getAPOD, type Apod } from '../../../lib/nasa'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function ApodMedia({ apod }: { apod: Apod }) {
  // The API only gives a still image (a frame for videos) — the article has the full media
  return (
    <a
      href={apod.pageUrl}
      target="_blank"
      rel="noreferrer"
      className="relative flex aspect-[4/3] w-full items-center justify-center bg-space-800 text-sm text-cyan-300"
    >
      {apod.imageUrl ? (
        <img
          src={apod.imageUrl}
          alt={apod.alt ?? apod.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]"
        />
      ) : (
        "View today's picture on NASA ↗"
      )}
      {apod.imageUrl && apod.mediaType !== 'image' && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="rounded-full bg-black/60 px-4 py-2 font-semibold text-white">
            {apod.mediaType === 'video' ? '▶ Watch on NASA' : 'Open on NASA ↗'}
          </span>
        </span>
      )}
    </a>
  )
}

export default function ApodSection() {
  const state = useAsync(getAPOD)
  const [expanded, setExpanded] = useState(false)

  return (
    <Section eyebrow="NASA image of the day" title="Astronomy Picture of the Day">
      <div className="card overflow-hidden">
        {state.status === 'loading' && (
          <div className="grid gap-0 md:grid-cols-2">
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="space-y-3 p-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="p-6">
            <ErrorMessage message="Today's NASA picture didn't load." />
          </div>
        )}

        {state.status === 'success' && (
          <div className="grid md:grid-cols-2">
            <div className="overflow-hidden bg-black">
              <ApodMedia apod={state.data} />
            </div>

            <div className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                {formatDate(state.data.date)}
              </p>
              <h3 className="mt-2 text-xl font-bold sm:text-2xl">{state.data.title}</h3>
              <p className={`mt-4 leading-relaxed text-slate-300 ${expanded ? '' : 'line-clamp-4'}`}>
                {state.data.explanation}
              </p>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 min-h-11 font-semibold text-cyan-300 hover:text-cyan-200"
                aria-expanded={expanded}
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
              {state.data.copyright && (
                <p className="mt-2 text-xs text-slate-500">© {state.data.copyright}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}
