import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeaderboard, type LeaderboardMode, type LeaderboardRow } from '../../../multiplayer/missionApi'
import { errorText } from '../../../multiplayer/useMissionRoom'
import { DIFFICULTY_NAMES, loadMine } from './shared'

/** Ranked rows for one scenario. Each row opens that mission's share page. */
export default function LeaderboardTable({
  scenarioId,
  mode = 'all',
  limit = 20,
  refreshKey,
  compact = false,
}: {
  scenarioId: string
  mode?: LeaderboardMode
  limit?: number
  /** Change it to load again, e.g. after posting a score */
  refreshKey?: unknown
  compact?: boolean
}) {
  // Answers are stored with the query they belong to, so a new filter shows loading, not old rows
  const [loaded, setLoaded] = useState<{ query: string; rows?: LeaderboardRow[]; error?: string } | null>(null)
  const [mine] = useState(loadMine)
  const query = JSON.stringify([scenarioId, mode, limit, refreshKey ?? null])

  useEffect(() => {
    let cancelled = false
    getLeaderboard(scenarioId, limit, mode)
      .then((rows) => !cancelled && setLoaded({ query, rows }))
      .catch((e) => !cancelled && setLoaded({ query, error: errorText(e) }))
    return () => {
      cancelled = true
    }
  }, [scenarioId, mode, limit, query])

  const current = loaded?.query === query ? loaded : null
  const rows = current?.rows ?? null
  const error = current?.error ?? null

  if (error) {
    return (
      <p role="alert" className="py-6 text-center text-sm text-rose-200">
        Couldn’t load the leaderboard. {error}
      </p>
    )
  }

  if (!rows) {
    return (
      <ol aria-label="Loading the leaderboard" className="space-y-2">
        {Array.from({ length: compact ? 3 : 5 }, (_, i) => (
          <li key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
        ))}
      </ol>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-semibold">No scores here yet</p>
        <p className="mt-1 text-sm text-slate-400">Fly a mission and post your score to be first.</p>
        {!compact && (
          <Link
            to="/mission"
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-violet-500 px-6 font-semibold transition hover:bg-violet-400 active:scale-[0.98]"
          >
            Fly a mission
          </Link>
        )}
      </div>
    )
  }

  return (
    <ol className="space-y-1.5">
      {rows.map((r, idx) => {
        const you = mine.includes(r.id)
        return (
          <li key={r.id}>
            <Link
              to={`/mission/r/${r.id}`}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-white/5 ${you ? 'bg-cyan-300/10 ring-1 ring-cyan-300/30' : ''}`}
            >
              <span
                className={`w-7 shrink-0 text-center font-display font-bold tabular-nums ${idx < 3 ? 'text-amber-200' : 'text-slate-400'}`}
              >
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {r.team_name}
                  {you && <span className="ml-2 rounded-full bg-cyan-300/20 px-2 py-0.5 text-xs text-cyan-200">You</span>}
                </span>
                {!compact && (
                  <span className="block text-xs text-slate-400">
                    {r.crew_size > 1 ? `Team of ${r.crew_size}` : 'Solo'} · {DIFFICULTY_NAMES[r.difficulty] ?? r.difficulty}
                  </span>
                )}
              </span>
              <span className="font-display text-lg font-bold tabular-nums">{r.total}</span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
