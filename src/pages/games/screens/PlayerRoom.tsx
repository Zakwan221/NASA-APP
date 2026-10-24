import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import Skeleton from '../../../components/ui/Skeleton'
import { submitAnswer } from '../api/quizApi'
import AnswerGrid from '../components/AnswerGrid'
import CountdownRing from '../components/CountdownRing'
import GameShell from '../components/GameShell'
import Leaderboard from '../components/Leaderboard'
import Podium from '../components/Podium'
import { useCountdown } from '../hooks/useCountdown'
import { errorMessage, useRoom } from '../hooks/useRoom'
import { useWakeLock } from '../hooks/useWakeLock'
import { useQuizStore } from '../store/useQuizStore'
import { loadNickname } from '../storage'

/** The phone: wait in the lobby, answer, see how you did. */
export default function PlayerRoom() {
  const { code = '' } = useParams()
  useRoom(code, loadNickname(code))

  const s = useQuizStore()
  const secondsLeft = useCountdown(s.question, s.clockOffset)
  useWakeLock(s.status !== null && s.status !== 'finished')

  const answered = s.myChoice !== null
  const timeUp = secondsLeft <= 0
  const mine = s.scores.find((p) => p.user_id === s.userId)

  // A short buzz when a new question appears
  const buzzedFor = useRef<string | null>(null)
  useEffect(() => {
    const id = s.question?.question_id
    if (s.status === 'question' && id && buzzedFor.current !== id) {
      buzzedFor.current = id
      navigator.vibrate?.(60)
    }
  }, [s.status, s.question?.question_id])

  async function pick(choice: number) {
    if (answered || !s.roomId) return
    useQuizStore.getState().setMyChoice(choice) // lock the buttons right away
    try {
      await submitAnswer(s.roomId, choice)
    } catch (e) {
      const message = errorMessage(e)
      // the server didn't take it: unlock, unless it already has an answer from us
      if (message !== 'You already answered') useQuizStore.getState().setMyChoice(null)
      useQuizStore.getState().setError(message)
    }
  }

  return (
    <GameShell error={s.error} offline={!s.connected}>
      {s.status === null && !s.error && <Skeleton className="h-64" />}
      {s.status === null && s.error && (
        <Link to="/games/join" className="text-cyan-300 underline">
          ← Join another game
        </Link>
      )}

      {s.status === 'lobby' && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.span
            animate={{ y: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="text-6xl"
            aria-hidden="true"
          >
            🚀
          </motion.span>
          <h1 className="mt-6 text-3xl font-bold">You're in{s.me ? `, ${s.me.nickname}` : ''}!</h1>
          <p className="mt-2 text-slate-300">Look at the host's screen. The game starts soon.</p>
          <p className="mt-6 text-sm text-slate-400">
            {s.scores.length} {s.scores.length === 1 ? 'player' : 'players'} in room {code}
          </p>
        </section>
      )}

      {s.status === 'question' && s.question && (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              {s.question.index + 1} / {s.question.total}
            </p>
            <CountdownRing secondsLeft={secondsLeft} total={s.question.time_limit_s} size={60} />
          </div>
          <h1 className="mb-6 text-xl font-bold sm:text-2xl">{s.question.prompt}</h1>
          <AnswerGrid
            choices={s.question.choices}
            onPick={pick}
            myChoice={s.myChoice}
            disabled={answered || timeUp}
          />
          <p className="mt-6 text-center text-slate-300" role="status">
            {answered ? 'Answer locked in! Waiting for the others…' : timeUp ? "Time's up!" : ''}
          </p>
        </section>
      )}

      {s.status === 'reveal' && s.reveal && s.question && (
        <section className="text-center">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="mb-6"
          >
            {mine?.last_correct ? (
              <>
                <p className="text-6xl" aria-hidden="true">
                  ✅
                </p>
                <h1 className="mt-2 text-3xl font-bold text-emerald-300">Correct!</h1>
                <p className="mt-1 font-display text-2xl font-bold">+{mine.last_points}</p>
                {mine.streak >= 2 && <p className="mt-1 text-amber-300">🔥 {mine.streak} in a row</p>}
              </>
            ) : (
              <>
                <p className="text-6xl" aria-hidden="true">
                  {s.myChoice === null ? '⏰' : '❌'}
                </p>
                <h1 className="mt-2 text-3xl font-bold text-rose-300">
                  {s.myChoice === null ? 'No answer' : 'Not this time'}
                </h1>
              </>
            )}
            {mine && <p className="mt-3 text-slate-300">You're #{mine.rank} with {mine.score.toLocaleString()} points</p>}
          </motion.div>

          <div className="text-left">
            <AnswerGrid choices={s.question.choices} myChoice={s.myChoice} correctIndex={s.reveal.correct_index} />
            {s.reveal.fact && <p className="card mt-4 p-5 text-slate-200">🔭 {s.reveal.fact}</p>}
          </div>
        </section>
      )}

      {s.status === 'finished' && (
        <section className="text-center">
          <h1 className="text-3xl font-bold">Game over!</h1>
          {mine && (
            <p className="mt-2 text-lg text-slate-300">
              You finished <span className="font-bold text-white">#{mine.rank}</span> with{' '}
              {mine.score.toLocaleString()} points
            </p>
          )}
          <Podium scores={s.scores} />
          <div className="mt-8 text-left">
            <Leaderboard scores={s.scores} limit={5} highlightUserId={s.userId} />
          </div>
          <Link
            to="/info"
            className="mt-8 inline-flex min-h-12 items-center rounded-full border border-white/15 px-6 font-semibold hover:bg-white/10"
          >
            Learn more in the stories →
          </Link>
        </section>
      )}
    </GameShell>
  )
}
