import { motion } from 'framer-motion'
import type { PlayerScore } from '../api/quizApi'

interface LeaderboardProps {
  scores: PlayerScore[]
  limit?: number
  highlightUserId?: string | null
}

/** Ranked list; rows slide to their new place when ranks change. */
export default function Leaderboard({ scores, limit = 5, highlightUserId }: LeaderboardProps) {
  const top = scores.slice(0, limit)
  const me = highlightUserId ? scores.find((s) => s.user_id === highlightUserId) : undefined
  const meOutsideTop = me && !top.includes(me)

  return (
    <ol className="space-y-2">
      {top.map((s) => (
        <Row key={s.user_id} score={s} highlight={s.user_id === highlightUserId} />
      ))}
      {meOutsideTop && (
        <>
          <li className="px-4 text-center text-slate-500" aria-hidden="true">
            ⋯
          </li>
          <Row score={me} highlight />
        </>
      )}
    </ol>
  )
}

function Row({ score, highlight }: { score: PlayerScore; highlight: boolean }) {
  return (
    <motion.li
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className={`card flex items-center gap-3 px-4 py-3 ${highlight ? 'border-cyan-300/60 glow-cyan' : ''}`}
    >
      <span className="w-8 font-display text-lg font-bold text-slate-400 tabular-nums">{score.rank}</span>
      <span className="flex-1 truncate font-semibold">{score.nickname}</span>
      {score.last_points > 0 && (
        <motion.span
          key={`${score.user_id}-${score.score}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-semibold text-emerald-300"
        >
          +{score.last_points}
        </motion.span>
      )}
      {score.streak >= 2 && (
        <span className="text-sm" title={`${score.streak} in a row`}>
          🔥{score.streak}
        </span>
      )}
      <span className="w-16 text-right font-display font-bold tabular-nums">{score.score.toLocaleString()}</span>
    </motion.li>
  )
}
