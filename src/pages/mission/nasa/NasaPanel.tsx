import { motion } from 'framer-motion'
import { ExternalLink, Satellite } from 'lucide-react'
import { fmtDate, missionFacts, NASA_SOURCE } from './nasaText'
import { useMissionNasa } from './useMissionNasa'

/**
 * "Real NASA data" for one mission: wildfires near Malaysia (EONET), recent solar
 * storms (DONKI) or today's target asteroid (NeoWs). Live when NASA answers,
 * otherwise the saved copy, and it says which.
 */
export default function NasaPanel({ scenarioId, compact = false }: { scenarioId: string; compact?: boolean }) {
  const { data, live, loading } = useMissionNasa()
  const facts = missionFacts(scenarioId, data)
  const source = NASA_SOURCE[scenarioId]
  if (!source) return null
  const isLive = scenarioId === 'earth-watch' ? live.fires : scenarioId === 'solar-storm' ? live.storms : live.asteroid

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      aria-label="Real NASA data"
      className={`card border-cyan-300/25 bg-gradient-to-br from-cyan-400/10 to-transparent ${compact ? 'p-4' : 'p-5'}`}
    >
      <p className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-cyan-300">
          <Satellite aria-hidden="true" className="size-4" /> Real NASA data · {source.api}
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 normal-case tracking-normal ${
            loading ? 'bg-white/10 text-slate-300' : isLive ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-300/15 text-amber-200'
          }`}
        >
          {loading ? (
            'Asking NASA…'
          ) : isLive ? (
            <>
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" /> Live
            </>
          ) : (
            `Saved copy, ${fmtDate(data.fetchedAt)}`
          )}
        </span>
      </p>
      {facts ? (
        <>
          <p className={`mt-2 font-semibold ${compact ? 'text-sm' : ''}`}>{facts.headline}</p>
          <ul className={`mt-1 space-y-0.5 text-slate-300 ${compact ? 'text-xs' : 'text-sm'}`}>
            {facts.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-400">{loading ? 'Loading…' : 'NASA could not be reached right now. Try again later.'}</p>
      )}
      <a
        href={facts?.link ?? source.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs text-cyan-300 underline-offset-4 hover:underline"
      >
        Source: {source.name} <ExternalLink aria-hidden="true" className="size-3" />
      </a>
    </motion.section>
  )
}
