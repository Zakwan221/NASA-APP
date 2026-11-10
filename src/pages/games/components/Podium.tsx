import { motion } from 'framer-motion'
import type { PlayerScore } from '../api/quizApi'

const PLACES = [
  { place: 2, height: 'h-24', color: 'from-slate-300/30 to-slate-300/5', medal: '🥈', delay: 0.4 },
  { place: 1, height: 'h-36', color: 'from-amber-300/40 to-amber-300/5', medal: '🥇', delay: 0.9 },
  { place: 3, height: 'h-16', color: 'from-orange-400/30 to-orange-400/5', medal: '🥉', delay: 0 },
]

/** Top 3, revealed third → second → first. Places nobody reached are left out. */
export default function Podium({ scores }: { scores: PlayerScore[] }) {
  const places = PLACES.filter(({ place }) => scores[place - 1])

  return (
    <div className="flex items-end justify-center gap-3 pt-6">
      {places.map(({ place, height, color, medal, delay }) => {
        const player = scores[place - 1]
        return (
          <motion.div
            key={place}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="flex w-28 flex-col items-center text-center sm:w-36"
          >
            <span className="text-3xl" aria-hidden="true">
              {medal}
            </span>
            <span className="mt-1 w-full truncate font-semibold">{player.nickname}</span>
            <span className="text-sm text-slate-400 tabular-nums">{player.score.toLocaleString()}</span>
            <div className={`mt-2 w-full rounded-t-xl bg-gradient-to-b ${color} ${height}`}>
              <span className="block pt-2 font-display text-2xl font-bold text-white/80">{place}</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
