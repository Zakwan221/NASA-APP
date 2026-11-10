/**
 * Launch day. Three things can happen:
 *   fail  – the rocket fails (chance = failureRate) and the spacecraft is lost
 *   bad   – a problem delays the launch (chance = riskOfIssue) and costs money
 *   good  – a perfect launch
 * Plus an outlook: will this spacecraft be able to finish its mission?
 */

import { OPS } from '../events/operate'
import type { Difficulty, LaunchVehicle, MissionDesign, Orbit } from '../types'
import { evaluate } from './evaluate'

export interface LaunchOutcome {
  extraCostM: number
  title: string
  text: string
  tone: 'good' | 'bad' | 'fail'
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

const FAILURES = [
  'The second stage engine shut down too early, so the rocket never reached orbit.',
  'A valve on the rocket stuck open and the vehicle broke apart two minutes after liftoff.',
  'The payload fairing did not separate, so the rocket was too heavy to reach orbit.',
]

/** Cadet is forgiving; Director missions face more risk, like real first-time missions */
const RISK_FACTOR: Record<Difficulty, number> = { cadet: 0.5, engineer: 1, director: 1.5, sandbox: 1 }

export function launchRisk(rocket: LaunchVehicle, difficulty: Difficulty): number {
  return Math.min(0.5, rocket.riskOfIssue * RISK_FACTOR[difficulty])
}

/** Chance the launch fails completely; Cadet missions never lose the spacecraft */
export function failureChance(rocket: LaunchVehicle, difficulty: Difficulty): number {
  return difficulty === 'cadet' ? 0 : Math.min(0.5, rocket.failureRate * RISK_FACTOR[difficulty])
}

/** `roll` and `pick` are random numbers in 0..1, passed in so tests can choose them */
export function rollLaunch(rocket: LaunchVehicle, orbit: Orbit, difficulty: Difficulty, roll: number, pick: number): LaunchOutcome {
  const fail = failureChance(rocket, difficulty)
  if (roll < fail) {
    return {
      extraCostM: 0,
      title: 'Launch failure',
      text: `${FAILURES[Math.min(FAILURES.length - 1, Math.floor(pick * FAILURES.length))]} The spacecraft was lost. The ${rocket.name} works ${Math.round((1 - rocket.failureRate) * 100)}% of the time; this was the unlucky ${Math.round(rocket.failureRate * 100)}%. A more reliable rocket lowers the risk.`,
      tone: 'fail',
    }
  }
  // The same roll decides problems, using the part above the failure chance
  if (roll < fail + launchRisk(rocket, difficulty)) {
    const issue = ISSUES[Math.min(ISSUES.length - 1, Math.floor(pick * ISSUES.length))]
    return {
      extraCostM: issue.costM,
      title: issue.title,
      text: `${issue.text(rocket)} The spacecraft still reached ${orbit.name} safely.`,
      tone: 'bad',
    }
  }
  return {
    extraCostM: 0,
    title: 'Perfect launch',
    text: `The ${rocket.name} put your spacecraft into ${orbit.name}. The solar panels unfolded and the first signal reached the ground station.`,
    tone: 'good',
  }
}

/* ---------------- mission outlook ---------------- */

export interface OutlookCheck {
  ok: boolean
  text: string
}

export interface Outlook {
  verdict: 'likely' | 'at-risk' | 'unlikely'
  headline: string
  checks: OutlookCheck[]
}

/** Before flying: will this spacecraft be able to finish its mission, and why? */
export function missionOutlook(design: MissionDesign, extraCostM = 0): Outlook {
  const ev = evaluate(design)
  const target = ev.scenario?.scienceTarget ?? 1
  const planned = design.planner.targetLifetimeMonths
  const months = Math.min(planned, ev.orbit?.maxLifetimeMonths ?? planned)
  const monthlyCost = OPS.baseOpsCostM + OPS.opsCostPerInstrumentM * design.science.instrumentIds.length
  const affordable = Math.floor((ev.budgetLeftM - extraCostM) / monthlyCost)
  const sciShare = ev.projectedScience / target
  const data = ev.resources.data
  const lostShare = data.used > data.available && data.used > 0 ? 1 - data.available / data.used : 0

  const checks: OutlookCheck[] = [
    {
      ok: affordable >= months,
      text:
        affordable >= months
          ? `Money lasts the whole mission (enough for ${affordable} months, needs ${months}).`
          : `Money runs out after about ${Math.max(0, affordable)} of ${months} months.`,
    },
    {
      ok: months >= planned,
      text: months >= planned ? `The orbit lasts the planned ${planned} months.` : `The orbit only lasts ${months} of the planned ${planned} months.`,
    },
    {
      ok: ev.instrumentUptime >= 0.9,
      text: `Instruments can run ${Math.round(ev.instrumentUptime * 100)}% of the time on the power available.`,
    },
    {
      ok: lostShare < 0.1,
      text: lostShare < 0.1 ? 'The radio can send home almost all the data.' : `About ${Math.round(lostShare * 100)}% of the data won’t fit through the radio.`,
    },
    {
      ok: sciShare >= 0.6,
      text: `Expected science: ${Math.round(sciShare * 100)}% of the target (60% meets the objective).`,
    },
  ]

  const failed = checks.filter((c) => !c.ok).length
  const critical = !checks[0].ok || !checks[4].ok
  const verdict = critical ? 'unlikely' : failed > 0 ? 'at-risk' : 'likely'
  const headline =
    verdict === 'likely'
      ? 'Likely to complete the mission, if nothing goes wrong in flight.'
      : verdict === 'at-risk'
        ? 'Can complete the mission, but with weak spots.'
        : 'Unlikely to complete the mission as designed.'
  return { verdict, headline, checks }
}
