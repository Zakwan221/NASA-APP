import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Skeleton from '../../../components/ui/Skeleton'
import { createRoom, listQuizzes, type Quiz } from '../api/quizApi'
import GameShell from '../components/GameShell'
import { errorMessage } from '../hooks/useRoom'

/** Host step 1: choose a quiz and open a room. */
export default function HostSetup() {
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listQuizzes()
      .then(setQuizzes)
      .catch((e) => setError(errorMessage(e)))
  }, [])

  async function host(quizId: string) {
    setBusyId(quizId)
    setError(null)
    try {
      const room = await createRoom(quizId)
      navigate(`/games/host/${room.code}`)
    } catch (e) {
      setError(errorMessage(e))
      setBusyId(null)
    }
  }

  return (
    <GameShell error={error}>
      <h1 className="mb-2 text-3xl font-bold">Host a game</h1>
      <p className="mb-6 text-slate-300">Choose a quiz. Players join with the code on your screen.</p>

      {quizzes === null && !error && (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}

      {quizzes?.length === 0 && (
        <p className="card p-6 text-slate-300">
          No quizzes yet. Run <code>supabase/seed.sql</code> in the Supabase SQL Editor.
        </p>
      )}

      <ul className="space-y-3">
        {quizzes?.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => host(q.id)}
              disabled={busyId !== null}
              className="card flex min-h-20 w-full items-center justify-between gap-4 p-5 text-left transition hover:border-white/25 disabled:opacity-60"
            >
              <span>
                <span className="block text-lg font-semibold">{q.title}</span>
                {q.story && <span className="text-sm text-slate-400">Story: {q.story.replace(/-/g, ' ')}</span>}
              </span>
              <span className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold">
                {busyId === q.id ? 'Opening…' : 'Host'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </GameShell>
  )
}
