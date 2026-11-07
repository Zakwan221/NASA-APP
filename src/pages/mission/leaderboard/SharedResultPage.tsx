import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { grade } from '../../../game/scoring/score'
import { getSharedResult, type SharedResult } from '../../../multiplayer/missionApi'
import { errorText } from '../../../multiplayer/useMissionRoom'
import { Shell } from '../operate/OperatePage'
import { loadAttempts } from '../report/attempts'
import { DIFFICULTY_NAMES, loadMine, scenarioName } from './shared'

const PART_MAX = { missionSuccess: 40, science: 25, efficiency: 20, teamwork: 15 } as const
const PART_LABEL = {
  missionSuccess: 'Mission success',
  science: 'Science value',
  efficiency: 'Resource efficiency',
  teamwork: 'Teamwork / decisions',
} as const

/** /mission/r/:id: one posted mission, compared with your own best */
export default function SharedResultPage() {
  const { id = '' } = useParams()
  const [result, setResult] = useState<SharedResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const validId = /^[0-9a-f-]{36}$/i.test(id)
  const error = validId ? loadError : 'This link is not complete. Check that you copied all of it.'

  useEffect(() => {
    if (!validId) return
    getSharedResult(id)
      .then(setResult)
      .catch((e) => setLoadError(errorText(e)))
  }, [id, validId])

  if (error) {
    return (
      <Shell>
        <div className="card p-8 text-center">
          <h1 className="text-xl font-bold">Couldn’t open this mission</h1>
          <p className="mt-2 text-slate-300">{error}</p>
          <Link to="/mission/leaderboard" className="mt-4 inline-block text-cyan-300 underline-offset-4 hover:underline">
            See the leaderboard
          </Link>
        </div>
      </Shell>
    )
  }

  if (!result) {
    return (
      <Shell>
        <div className="mx-auto h-24 w-48 animate-pulse rounded-2xl bg-white/5" />
        <div className="mt-8 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      </Shell>
    )
  }

  const g = grade(result.total)
  const isMine = loadMine().includes(result.id)
  const parts =
    result.score.parts ??
    (Object.keys(PART_MAX) as (keyof typeof PART_MAX)[]).map((k) => ({
      key: k,
      label: PART_LABEL[k],
      points: result.score[k],
      max: PART_MAX[k],
      reason: '',
    }))
  // Compare with this browser's best solo attempt on the same scenario
  const myBest = isMine ? null : Math.max(-1, ...loadAttempts(result.scenario_id).map((a) => a.total))
  const gap = myBest !== null && myBest >= 0 ? result.total - myBest : null

  return (
    <Shell>
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-cyan-300">
        {scenarioName(result.scenario_id)} · {DIFFICULTY_NAMES[result.difficulty] ?? result.difficulty}
      </p>
      <h1 className="mt-2 text-center text-2xl font-bold">
        {result.team_name}
        <span className="block text-sm font-normal text-slate-400">
          {result.crew_size > 1 ? `Team of ${result.crew_size}` : 'Solo'} ·{' '}
          {new Date(result.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </span>
      </h1>
      <p className="mt-4 text-center font-display text-7xl font-bold tabular-nums">
        {result.total}
        <span className="text-3xl text-slate-400">/100</span>
      </p>
      <p
        className={`mt-1 text-center text-lg font-semibold ${g.tone === 'good' ? 'text-emerald-300' : g.tone === 'ok' ? 'text-amber-300' : 'text-rose-300'}`}
      >
        {g.label} · #{result.rank} on the board
      </p>

      {gap !== null && (
        <p className="mx-auto mt-4 w-fit rounded-full bg-white/10 px-4 py-1.5 text-sm">
          Your best here: {myBest} ·{' '}
          {gap > 0 ? (
            <span className="text-amber-200">{gap} points to beat them</span>
          ) : (
            <span className="text-emerald-300">you’re ahead by {-gap}</span>
          )}
        </p>
      )}

      <ul className="mt-8 space-y-3">
        {parts.map((p) => (
          <li key={p.key} className="card p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-semibold">{p.label}</h2>
              <p className="font-display text-xl font-bold tabular-nums">
                {p.points}
                <span className="text-sm text-slate-400">/{p.max}</span>
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${p.points / p.max >= 0.8 ? 'bg-emerald-400' : p.points / p.max >= 0.5 ? 'bg-amber-300' : 'bg-rose-400'}`}
                style={{ width: `${(p.points / p.max) * 100}%` }}
              />
            </div>
            {p.reason && <p className="mt-3 text-sm text-slate-300">{p.reason}</p>}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          to="/mission"
          className="glow-violet flex min-h-14 items-center rounded-full bg-violet-500 px-10 text-lg font-semibold transition hover:bg-violet-400 active:scale-[0.98]"
        >
          {isMine ? 'Fly again' : `Try to beat ${result.total}`}
        </Link>
        <Link to="/mission/leaderboard" className="text-sm text-cyan-300 underline-offset-4 hover:underline">
          See the full leaderboard
        </Link>
      </div>
    </Shell>
  )
}
