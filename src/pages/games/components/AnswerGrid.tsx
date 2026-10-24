import { motion } from 'framer-motion'
import { ANSWER_STYLES } from './answerStyles'

interface AnswerGridProps {
  choices: string[]
  /** Players tap; the host screen passes nothing */
  onPick?: (index: number) => void
  myChoice?: number | null
  /** Set after reveal */
  correctIndex?: number
  counts?: number[]
  disabled?: boolean
}

export default function AnswerGrid({ choices, onPick, myChoice, correctIndex, counts, disabled }: AnswerGridProps) {
  const revealed = correctIndex !== undefined
  const maxCount = Math.max(1, ...(counts ?? [0]))

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {choices.map((choice, i) => {
        const style = ANSWER_STYLES[i % ANSWER_STYLES.length]
        const isCorrect = revealed && i === correctIndex
        const dimmed = revealed ? !isCorrect : myChoice != null && myChoice !== i
        const picked = myChoice === i

        return (
          <li key={i}>
            <motion.button
              type="button"
              disabled={disabled || !onPick}
              onClick={() => onPick?.(i)}
              whileTap={onPick && !disabled ? { scale: 0.96 } : undefined}
              animate={{ opacity: dimmed ? 0.35 : 1 }}
              className={`relative flex min-h-20 w-full items-center gap-3 overflow-hidden rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold text-white shadow-lg ${style.bg} ${
                picked || isCorrect ? 'border-white' : 'border-transparent'
              } ${onPick && !disabled ? 'cursor-pointer' : 'cursor-default'}`}
              aria-label={`${style.name}: ${choice}`}
              aria-pressed={picked}
            >
              {counts && (
                <span
                  className="absolute inset-y-0 left-0 bg-black/20"
                  style={{ width: `${((counts[i] ?? 0) / maxCount) * 100}%` }}
                  aria-hidden="true"
                />
              )}
              <svg viewBox="0 0 24 24" className="relative size-7 shrink-0 fill-white/90" aria-hidden="true">
                <path d={style.shape} />
              </svg>
              <span className="relative flex-1">{choice}</span>
              {counts && <span className="relative font-display text-xl tabular-nums">{counts[i] ?? 0}</span>}
              {isCorrect && (
                <span className="relative text-2xl" aria-label="correct answer">
                  ✓
                </span>
              )}
            </motion.button>
          </li>
        )
      })}
    </ul>
  )
}
