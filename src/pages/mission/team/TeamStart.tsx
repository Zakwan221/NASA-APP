import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createMissionRoom, joinMissionRoom } from '../../../multiplayer/missionApi'
import { errorText } from '../../../multiplayer/useMissionRoom'
import { Shell } from '../operate/OperatePage'
import { PLACEHOLDER_CRAFT } from '../operate/placeholderCraft'

const inputClass =
  'w-full rounded-xl border border-white/15 bg-space-800 px-4 py-3 text-lg text-white outline-none focus:border-cyan-300'

/** Host: name yourself and open a room. Join: code + name. `?code=` pre-fills the code. */
export default function TeamStart({ mode }: { mode: 'host' | 'join' }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = nickname.trim().length > 0 && (mode === 'host' || /^\d{6}$/.test(code))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      const room =
        mode === 'host'
          ? await createMissionRoom(nickname, {
              // Until the Design screen exists, every team flies the placeholder mission
              planner: {
                scenarioId: PLACEHOLDER_CRAFT.scenario.id,
                difficulty: PLACEHOLDER_CRAFT.difficulty,
                targetLifetimeMonths: PLACEHOLDER_CRAFT.targetLifetimeMonths,
                targetCoverage: 0.5,
              },
            })
          : await joinMissionRoom(code, nickname)
      navigate(`/mission/team/${room.code}`)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-3xl font-bold">{mode === 'host' ? 'Host a team mission' : 'Join a team'}</h1>
      {error && (
        <p role="alert" className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="card space-y-5 p-6">
        {mode === 'join' && (
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">Mission code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="123456"
              className={`${inputClass} text-center font-display text-3xl font-bold tracking-[0.4em]`}
            />
          </label>
        )}
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-300">Your name</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 16))}
            autoComplete="nickname"
            maxLength={16}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={!ready || busy}
          className="glow-violet min-h-12 w-full rounded-full bg-violet-500 px-6 text-lg font-semibold transition hover:bg-violet-400 disabled:opacity-50 disabled:shadow-none"
        >
          {busy ? 'Please wait…' : mode === 'host' ? 'Open the room' : 'Join the crew'}
        </button>
      </form>
    </Shell>
  )
}
