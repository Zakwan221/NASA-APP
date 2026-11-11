/**
 * Mission score out of 100 (docs/PLAN.md):
 *   Mission success 40 · Science 25 · Resource efficiency 20 · Handling surprises 15
 *
 * DRAFT from Adaam's side so the Report screen works. Zakwan owns scoring:
 * change the weights or rules here, the Report screen just shows what this returns.
 * Every part comes with a reason in plain words, because the challenge asks us to
 * explain WHY a mission did well or badly, not just give a number.
 */

import type { OperateSummary } from '../events/operate'
import type { ScoreBreakdown } from '../types'

export interface ScorePart {
  key: 'missionSuccess' | 'science' | 'efficiency' | 'teamwork'
  label: string
  points: number
  max: number
  reason: string
  /** One thing to try next time, if points were lost */
  tip?: string
}

export interface MissionScore extends ScoreBreakdown {
  parts: ScorePart[]
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function scoreMission(s: OperateSummary, opts: { team: boolean } = { team: false }): MissionScore {
  const parts: ScorePart[] = []

  // ---- Mission success (40): flew the planned time AND did its job ----
  // The objective counts as met at 60% of the science target; below that, points shrink.
  const flownShare = clamp01(s.monthsFlown / s.plannedMonths)
  const objectiveShare = clamp01(s.scienceReturned / (s.scienceTarget * 0.6))
  const success = Math.round(40 * flownShare * objectiveShare * (s.success ? 1 : 0.5))
  const successReasons = [
    s.success
      ? s.monthsFlown < s.plannedMonths
        ? `The spacecraft flew ${s.monthsFlown} of the ${s.plannedMonths} planned months.`
        : `The spacecraft flew all ${s.plannedMonths} planned months.`
      : `${s.reason} It flew ${s.monthsFlown} of ${s.plannedMonths} months, so only half points.`,
    objectiveShare >= 1
      ? 'It sent home enough science to meet the objective.'
      : `It sent home too little science to fully meet the objective (needs ${Math.round(s.scienceTarget * 0.6).toLocaleString()}).`,
  ]
  parts.push({
    key: 'missionSuccess',
    label: 'Mission success',
    points: success,
    max: 40,
    reason: successReasons.join(' '),
    tip:
      success < 40
        ? !s.success
          ? 'Keep a safety margin: more budget for operations, or play safer when events could damage the spacecraft.'
          : objectiveShare < 1
            ? 'A mission only succeeds if its data reaches Earth. Keep your instruments running and the radio able to send it.'
            : 'Dodging debris and short-lived orbits cost months. A higher orbit or more fuel keeps the mission going longer.'
        : undefined,
  })

  // ---- Science (25) ----
  const sciShare = clamp01(s.scienceReturned / s.scienceTarget)
  const science = Math.round(25 * sciShare)
  parts.push({
    key: 'science',
    label: 'Science value',
    points: science,
    max: 25,
    reason: `${s.scienceReturned.toLocaleString()} of the ${s.scienceTarget.toLocaleString()} science points the objective needed reached Earth (${Math.round((s.scienceReturned / s.scienceTarget) * 100)}%).`,
    tip:
      science < 25
        ? s.averageUptime < 0.9
          ? `Your instruments only ran ${Math.round(s.averageUptime * 100)}% of the time on average. More solar power, or fewer instruments switched on, lets them run all the time.`
          : 'Pick instruments with more science value, or an orbit with better coverage of your target.'
        : undefined,
  })

  // ---- Resource efficiency (20): data 10, budget 5, health 5 ----
  const totalData = s.dataSentMbit + s.dataLostMbit
  const dataShare = totalData > 0 ? s.dataSentMbit / totalData : 0
  const dataPts = 10 * dataShare
  const budgetPts = s.budgetLeftM >= 0 ? 5 : 0
  const healthPts = 5 * (s.health / 100)
  const efficiency = Math.round(dataPts + budgetPts + healthPts)
  const effReasons = [
    totalData > 0
      ? `${Math.round(dataShare * 100)}% of the data you collected was sent home${s.dataLostMbit > 0 ? `; ${(s.dataLostMbit / 1000).toFixed(0)} Gbit was deleted because storage was full` : ''}.`
      : 'No data was collected, so the power and money spent on the instruments did nothing.',
    s.budgetLeftM >= 0 ? `You stayed within budget ($${s.budgetLeftM.toFixed(2)} M left).` : 'You went over budget.',
    `The spacecraft ended at ${s.health}% health.`,
  ]
  parts.push({
    key: 'efficiency',
    label: 'Resource efficiency',
    points: efficiency,
    max: 20,
    reason: effReasons.join(' '),
    tip:
      efficiency < 20
        ? s.dataLostMbit > 0
          ? 'Lost data is wasted power and money. Match your instruments to what the radio can send, or add storage.'
          : 'Avoid damage and keep some budget in reserve.'
        : undefined,
  })

  // ---- Handling surprises (15): how well the spacecraft rode out events ----
  // Mission control answers every event with its standard response, so this
  // rewards a sturdy design: spare power, a reliable radio, money in reserve.
  const events = s.log.filter((l) => l.decision)
  const badOutcomes = events.filter((l) => l.tone === 'bad').length
  const teamwork = Math.round(15 * (events.length ? 1 - badOutcomes / events.length : 1))
  parts.push({
    key: 'teamwork',
    label: 'Handling surprises',
    points: teamwork,
    max: 15,
    reason: events.length
      ? `${events.length} surprise${events.length === 1 ? '' : 's'} in flight${opts.team ? ' for the crew' : ''}, ${badOutcomes} ended badly.`
      : 'No surprises this time: a smooth flight.',
    tip:
      teamwork < 15
        ? 'A sturdier spacecraft rides out surprises better: keep spare power and budget, and pick parts that work most of the time.'
        : undefined,
  })

  const total = parts.reduce((sum, p) => sum + p.points, 0)
  return {
    missionSuccess: success,
    science,
    efficiency,
    teamwork,
    total,
    reasons: parts.map((p) => p.reason),
    parts,
  }
}

/** A short label for the total */
export function grade(total: number): { label: string; tone: 'good' | 'ok' | 'bad' } {
  if (total >= 85) return { label: 'Outstanding mission', tone: 'good' }
  if (total >= 70) return { label: 'Successful mission', tone: 'good' }
  if (total >= 50) return { label: 'Partial success', tone: 'ok' }
  return { label: 'Mission failed', tone: 'bad' }
}
