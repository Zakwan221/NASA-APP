/**
 * Test flights: fly a design through the real Operate phase several times
 * (different random events each time) and average the score. Used to check
 * the recommended builds really win, and to show their expected score.
 */

import { chooseEventOption, runMonth, startOperate, summarize } from '../events/operate'
import { scoreMission } from '../scoring/score'
import type { MissionDesign } from '../types'
import { buildFlight } from './evaluate'

export interface TestFlights {
  /** Average score out of 100 */
  average: number
  worst: number
  best: number
  /** Share of flights that completed their mission (0..1) */
  completed: number
}

/** Flies `flights` missions (events answered with the first, safer choice). Null if it can't launch. */
export function testFlights(design: MissionDesign, flights = 20): TestFlights | null {
  const craft = buildFlight(design)
  if (!craft) return null
  const scores: number[] = []
  let completed = 0
  for (let n = 0; n < flights; n++) {
    let state = startOperate(craft, 1000 + n * 7919)
    for (let guard = 0; guard < 120 && !state.ended; guard++) {
      state = state.pending ? chooseEventOption(craft, state, 0) : runMonth(craft, state)
    }
    const summary = summarize(craft, state)
    if (summary.success && summary.monthsFlown >= summary.plannedMonths) completed++
    scores.push(scoreMission(summary).total)
  }
  return {
    average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    worst: Math.min(...scores),
    best: Math.max(...scores),
    completed: completed / flights,
  }
}
