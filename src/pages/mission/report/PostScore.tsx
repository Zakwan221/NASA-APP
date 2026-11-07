import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { FlightSpacecraft } from '../../../game/events/operate'
import type { MissionScore } from '../../../game/scoring/score'
import { submitSoloResult } from '../../../multiplayer/missionApi'
import { errorText } from '../../../multiplayer/useMissionRoom'
import { addMine, loadName, saveName, shareLink, shareUrl } from '../leaderboard/shared'

/** Solo Report: post the score under a name, then share the link. */
export default function PostScore({ craft, score }: { craft: FlightSpacecraft; score: MissionScore }) {
  const [name, setName] = useState(loadName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [posted, setPosted] = useState<string | null>(null)

  async function post(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean || busy) return
    setBusy(true)
    setError(null)
    try {
      const { id } = await submitSoloResult(clean, craft.scenario.id, craft.difficulty, score, {
        orbitId: craft.orbit.id,
        launchVehicleId: craft.launchVehicle?.id ?? null,
        partIds: craft.parts.map((p) => p.id),
        instrumentIds: craft.instruments.map((i) => i.id),
        targetLifetimeMonths: craft.targetLifetimeMonths,
      })
      saveName(clean)
      addMine(id)
      setPosted(id)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (posted) return <ShareBox id={posted} total={score.total} />

  return (
    <form onSubmit={post} className="card mt-6 p-5">
      <h2 className="font-semibold">Post to the leaderboard</h2>
      <p className="mt-1 text-sm text-slate-400">Your best score counts. Anyone with the link can see how you did.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="mb-2 block text-sm font-semibold text-slate-300">Name on the board</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, 24))
              setError(null)
            }}
            maxLength={24}
            autoComplete="nickname"
            className="w-full rounded-xl border border-white/15 bg-space-800 px-4 py-3 text-lg text-white outline-none focus:border-cyan-300"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="min-h-13 rounded-full bg-cyan-300 px-6 font-semibold text-space-900 transition hover:bg-cyan-200 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Posting…' : `Post ${score.total} points`}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-200">
          {error}
        </p>
      )}
    </form>
  )
}

/** After posting: share the link or open the board */
export function ShareBox({ id, total }: { id: string; total: number }) {
  const [status, setStatus] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle')
  const url = shareUrl(id)

  return (
    <section className="card mt-6 border-emerald-300/30 p-5">
      <h2 className="font-semibold">Score posted</h2>
      <p className="mt-1 text-sm text-slate-300">Send the link to a friend and dare them to beat {total}.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={async () => setStatus(await shareLink(url, `I scored ${total}/100 on my Orbitly space mission. Can you beat it?`))}
          className="min-h-12 flex-1 rounded-full bg-cyan-300 px-6 font-semibold text-space-900 transition hover:bg-cyan-200 active:scale-[0.98]"
        >
          {status === 'copied' ? 'Link copied' : 'Share my mission'}
        </button>
        <Link
          to="/mission/leaderboard"
          className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-white/10 px-6 font-semibold transition hover:bg-white/15 active:scale-[0.98]"
        >
          See the leaderboard
        </Link>
      </div>
      {status === 'failed' && (
        <p className="mt-3 break-all text-sm text-slate-300">
          Copy this link: <span className="text-cyan-200">{url}</span>
        </p>
      )}
    </section>
  )
}
