/**
 * Launch day: most launches go fine, but every rocket has a small chance of a
 * problem (`riskOfIssue`). Problems here delay the launch and cost money, which
 * comes out of the budget for running the mission.
 */

import type { LaunchVehicle, Orbit } from '../types'

export interface LaunchOutcome {
  extraCostM: number
  title: string
  text: string
  tone: 'good' | 'bad'
}

const ISSUES: { title: string; text: (r: LaunchVehicle) => string; costM: number }[] = [
  {
    title: 'Weather delay',
    text: () =>
      'High winds over the launch site pushed the launch back two days. Keeping the team and rocket ready cost $0.2 M from your operations budget.',
    costM: 0.2,
  },
  {
    title: 'Countdown stopped at T−30 s',
    text: (r) =>
      `A faulty sensor on the ${r.name} stopped the countdown. Engineers swapped it and launched the next day, which cost $0.3 M.`,
    costM: 0.3,
  },
  {
    title: 'Late spacecraft check',
    text: () =>
      'The launch team found a loose cable during the final checks. Fixing it safely took a week and cost $0.4 M.',
    costM: 0.4,
  },
]

/** Directors face a little more risk, like real first-time missions */
const RISK_FACTOR = { cadet: 0.5, engineer: 1, director: 1.5, sandbox: 1 } as const

/**
 * `roll` and `pick` are random numbers in 0..1 (passed in so tests can choose them).
 */
export function rollLaunch(
  rocket: LaunchVehicle,
  orbit: Orbit,
  difficulty: keyof typeof RISK_FACTOR,
  roll: number,
  pick: number,
): LaunchOutcome {
  if (roll >= launchRisk(rocket, difficulty)) {
    return {
      extraCostM: 0,
      title: 'Perfect launch',
      text: `The ${rocket.name} put your spacecraft into ${orbit.name}. The solar panels unfolded and the first signal reached the ground station.`,
      tone: 'good',
    }
  }
  const issue = ISSUES[Math.min(ISSUES.length - 1, Math.floor(pick * ISSUES.length))]
  return {
    extraCostM: issue.costM,
    title: issue.title,
    text: `${issue.text(rocket)} The spacecraft still reached ${orbit.name} safely.`,
    tone: 'bad',
  }
}

export function launchRisk(rocket: LaunchVehicle, difficulty: keyof typeof RISK_FACTOR): number {
  return Math.min(0.5, rocket.riskOfIssue * RISK_FACTOR[difficulty])
}
