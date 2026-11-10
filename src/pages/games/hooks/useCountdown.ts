import { useEffect, useState } from 'react'
import type { QuestionPayload } from '../api/quizApi'

/**
 * Seconds left on the question, counted from the server's start time,
 * so every phone shows the same number. Goes negative once time is up.
 */
export function useCountdown(question: QuestionPayload | null, clockOffset: number): number {
  const compute = () =>
    question
      ? question.time_limit_s - (Date.now() + clockOffset - Date.parse(question.started_at)) / 1000
      : 0
  const [left, setLeft] = useState(compute)

  useEffect(() => {
    if (!question) return
    const tick = () =>
      setLeft(question.time_limit_s - (Date.now() + clockOffset - Date.parse(question.started_at)) / 1000)
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [question, clockOffset])

  return left
}
