import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Skeleton from '../../../components/ui/Skeleton'
import { reveal, startQuestion } from '../api/quizApi'
import AnswerGrid from '../components/AnswerGrid'
import CountdownRing from '../components/CountdownRing'
import GameShell from '../components/GameShell'
import Leaderboard from '../components/Leaderboard'
import Podium from '../components/Podium'
import { useCountdown } from '../hooks/useCountdown'
import { errorMessage, useRoom } from '../hooks/useRoom'
import { useWakeLock } from '../hooks/useWakeLock'
import { useQuizStore } from '../store/useQuizStore'

/** The big screen: lobby → question → reveal → … → podium. Only the host moves the game on. */
export default function HostRoom() {
  const { code = '' } = useParams()
  useRoom(code)

  const s = useQuizStore()
  const secondsLeft = useCountdown(s.question, s.clockOffset)
  const [busy, setBusy] = useState(false)
  const revealedFor = useRef<string | null>(null)
  useWakeLock(s.status !== null && s.status !== 'finished')

  const players = s.scores.length

  async function next() {
    setBusy(true)
    try {
      const result = await startQuestion(s.roomId!)
      if (result.status === 'question') useQuizStore.getState().onQuestion(result)
      else useQuizStore.getState().onFinished(result)
    } catch (e) {
      useQuizStore.getState().setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // Reveal once per question: when everyone has answered, or 1 s after time is up
  // (the server accepts answers for 1 s of grace).
  const questionId = s.question?.question_id ?? null
  const everyoneAnswered = players > 0 && s.answered >= players
  const timeUp = secondsLeft <= -1
  useEffect(() => {
    if (s.status !== 'question' || !questionId || !s.roomId) return
    if (!everyoneAnswered && !timeUp) return
    if (revealedFor.current === questionId) return
    revealedFor.current = questionId
    reveal(s.roomId)
      .then((r) => useQuizStore.getState().onReveal(r))
      .catch((e) => useQuizStore.getState().setError(errorMessage(e)))
  }, [s.status, s.roomId, questionId, everyoneAnswered, timeUp])

  const joinUrl = `${window.location.origin}/games/join?code=${code}`

  return (
    <GameShell error={s.error} offline={!s.connected}>
      {s.status === null && !s.error && <Skeleton className="h-64" />}
      {s.status === null && s.error && (
        <Link to="/games/host" className="text-cyan-300 underline">
          ← Back to quizzes
        </Link>
      )}

      {s.status === 'lobby' && (
        <section className="text-center">
          <p className="text-slate-300">
            Go to <span className="font-semibold text-white">{window.location.host}/games</span> and enter
          </p>
          <p className="my-4 font-display text-6xl font-bold tracking-[0.2em] text-cyan-300 sm:text-8xl">{code}</p>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(joinUrl)}
            className="min-h-11 text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline"
          >
            Copy join link
          </button>

          <div className="card mt-8 p-6">
            <p className="mb-4 text-left font-semibold">
              {players} {players === 1 ? 'player' : 'players'} in the lobby
            </p>
            <ul className="flex flex-wrap gap-2">
              <AnimatePresence>
                {s.scores.map((p) => (
                  <motion.li
                    key={p.user_id}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="rounded-full bg-white/10 px-4 py-2 font-semibold"
                  >
                    {p.nickname}
                  </motion.li>
                ))}
              </AnimatePresence>
              {players === 0 && <li className="text-slate-400">Waiting for players…</li>}
            </ul>
          </div>

          <button
            type="button"
            onClick={next}
            disabled={players === 0 || busy}
            className="glow-violet mt-8 min-h-14 rounded-full bg-violet-500 px-10 text-lg font-semibold transition hover:bg-violet-400 disabled:opacity-50 disabled:shadow-none"
          >
            Start game
          </button>
        </section>
      )}

      {(s.status === 'question' || s.status === 'reveal') && s.question && (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Question {s.question.index + 1} of {s.question.total}
            </p>
            {s.status === 'question' ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-300 tabular-nums">
                  {s.answered}/{players} answered
                </span>
                <CountdownRing secondsLeft={secondsLeft} total={s.question.time_limit_s} />
              </div>
            ) : (
              <span className="font-semibold text-emerald-300">Time's up!</span>
            )}
          </div>

          <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{s.question.prompt}</h1>
          {s.question.image_url && (
            <img src={s.question.image_url} alt="" className="mb-6 max-h-64 w-full rounded-2xl object-cover" />
          )}

          <AnswerGrid
            choices={s.question.choices}
            correctIndex={s.status === 'reveal' ? s.reveal?.correct_index : undefined}
            counts={s.status === 'reveal' ? s.reveal?.counts : undefined}
          />

          {s.status === 'question' && (
            <button
              type="button"
              onClick={() => {
                revealedFor.current = questionId
                reveal(s.roomId!)
                  .then((r) => useQuizStore.getState().onReveal(r))
                  .catch((e) => useQuizStore.getState().setError(errorMessage(e)))
              }}
              className="mt-6 min-h-11 text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline"
            >
              Skip timer and reveal
            </button>
          )}

          {s.status === 'reveal' && s.reveal && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-6">
              {s.reveal.fact && (
                <p className="card border-cyan-300/30 p-5 text-slate-200">
                  <span className="mr-2" aria-hidden="true">
                    🔭
                  </span>
                  {s.reveal.fact}
                </p>
              )}
              <Leaderboard scores={s.reveal.scores} limit={5} />
              <div className="text-center">
                <button
                  type="button"
                  onClick={next}
                  disabled={busy}
                  className="glow-violet min-h-14 rounded-full bg-violet-500 px-10 text-lg font-semibold transition hover:bg-violet-400 disabled:opacity-50"
                >
                  {s.reveal.is_last ? 'Show podium 🏆' : 'Next question →'}
                </button>
              </div>
            </motion.div>
          )}
        </section>
      )}

      {s.status === 'finished' && (
        <section className="text-center">
          <h1 className="text-4xl font-bold">Final results</h1>
          <Podium scores={s.scores} />
          <div className="mt-8 text-left">
            <Leaderboard scores={s.scores} limit={10} />
          </div>
          <Link
            to="/games/host"
            className="glow-violet mt-8 inline-flex min-h-14 items-center rounded-full bg-violet-500 px-10 text-lg font-semibold hover:bg-violet-400"
          >
            Play again
          </Link>
        </section>
      )}
    </GameShell>
  )
}
