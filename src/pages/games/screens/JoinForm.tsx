import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { joinRoom } from '../api/quizApi'
import GameShell from '../components/GameShell'
import { errorMessage } from '../hooks/useRoom'
import { saveNickname } from '../storage'

/** Player step 1: room code + nickname. `?code=123456` pre-fills the code. */
export default function JoinForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = /^\d{6}$/.test(code) && nickname.trim().length > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await joinRoom(code, nickname)
      saveNickname(code, nickname.trim())
      navigate(`/games/room/${code}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <GameShell error={error}>
      <h1 className="mb-6 text-3xl font-bold">Join a game</h1>
      <form onSubmit={submit} className="card space-y-5 p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-300">Game code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="123456"
            className="w-full rounded-xl border border-white/15 bg-space-800 px-4 py-3 text-center font-display text-3xl font-bold tracking-[0.4em] text-white outline-none focus:border-cyan-300"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-300">Nickname</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 16))}
            autoComplete="nickname"
            maxLength={16}
            className="w-full rounded-xl border border-white/15 bg-space-800 px-4 py-3 text-lg text-white outline-none focus:border-cyan-300"
          />
        </label>
        <button
          type="submit"
          disabled={!ready || busy}
          className="glow-cyan min-h-12 w-full rounded-full bg-cyan-400 px-6 text-lg font-semibold text-space-950 transition hover:bg-cyan-300 disabled:opacity-50 disabled:shadow-none"
        >
          {busy ? 'Joining…' : 'Join game'}
        </button>
      </form>
    </GameShell>
  )
}
