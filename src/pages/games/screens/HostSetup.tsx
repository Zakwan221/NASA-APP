import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Skeleton from '../../../components/ui/Skeleton'
import { createRoom, listQuizzes, type Quiz } from '../api/quizApi'
import GameShell from '../components/GameShell'
import { errorMessage } from '../hooks/useRoom'

/** One line per Module 2 story, shown under the quiz title. */
const STORY_BLURBS: Record<string, string> = {
  'solar-system': 'Planets, rings, storms and the tallest volcano around',
  asteroids: 'Space rocks, near misses and how NASA tracks them',
  dart: 'The day NASA crashed into an asteroid on purpose',
  exoplanets: 'Planets around other stars, and where life could be',
}

/** Host step 1: choose a quiz and open a room. `?story=dart` lists that story's quiz first. */
export default function HostSetup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const story = params.get('story')
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listQuizzes()
      .then((list) => setQuizzes(story ? [...list].sort((a, b) => Number(b.story === story) - Number(a.story === story)) : list))
      .catch((e) => setError(errorMessage(e)))
  }, [story])

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
              className={`card flex min-h-20 w-full items-center justify-between gap-4 p-5 text-left transition hover:border-white/25 active:scale-[0.98] disabled:opacity-60 ${
                story && q.story === story ? 'border-cyan-300/60' : ''
              }`}
            >
              <span>
                <span className="block text-lg font-semibold">{q.title}</span>
                {q.story && (
                  <span className="text-sm text-slate-400">
                    {STORY_BLURBS[q.story] ?? `Story: ${q.story.replace(/-/g, ' ')}`}
                  </span>
                )}
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
