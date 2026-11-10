/**
 * Launch day. Every design can launch; how good it is decides the odds.
 *
 *   launchOdds(design)  → chance of success (0..1) and why, from rocket
 *                          reliability, weight vs rocket capacity, and radio range
 *   rollLaunch(design)  → what happened. Each `kind` has its own animation:
 *     perfect       smooth climb (lower odds = more shaking on the way up)
 *     weather/hold/cable   countdown HOLD, then a good launch that cost money
 *     explode       the rocket breaks apart in the air
 *     underpowered  too heavy: engines struggle, cut out, the rocket falls back
 *     wrong-orbit   the rocket can't reach the orbit; spacecraft left too low
 *     lost-signal   perfect launch, but the radio can't be heard from there
 * Plus an outlook: will this spacecraft be able to finish its mission?
 */

import { orbitById, rocketById } from '../data'
import { OPS } from '../events/operate'
import type { Difficulty, LaunchVehicle, MissionDesign } from '../types'
import { evaluate } from './evaluate'

export type LaunchKind = 'perfect' | 'weather' | 'hold' | 'cable' | 'explode' | 'underpowered' | 'wrong-orbit' | 'lost-signal'

export interface LaunchOutcome {
  kind: LaunchKind
  extraCostM: number
  title: string
  text: string
  /** good: perfect · bad: delayed but fine · fail: the mission is lost */
  tone: 'good' | 'bad' | 'fail'
}

const ISSUES: { kind: LaunchKind; title: string; text: (r: LaunchVehicle) => string; costM: number; hold: string }[] = [
  {
    kind: 'weather',
    title: 'Weather delay',
    hold: 'HOLD · high winds',
    text: () =>
      'High winds over the launch site stopped the countdown. The team waited for calm weather, which cost $0.2 M from your operations budget.',
    costM: 0.2,
  },
  {
    kind: 'hold',
    title: 'Countdown stopped at T−30 s',
    hold: 'HOLD · sensor fault',
    text: (r) => `A faulty sensor on the ${r.name} stopped the countdown. Engineers swapped it and launched later, which cost $0.3 M.`,
    costM: 0.3,
  },
  {
    kind: 'cable',
    title: 'Late spacecraft check',
    hold: 'HOLD · spacecraft check',
    text: () => 'The launch team found a loose cable during the final checks. Fixing it safely cost $0.4 M.',
    costM: 0.4,
  },
]

/** The words shown during a countdown HOLD, for the animation */
export function holdLabel(kind: LaunchKind): string | null {
  return ISSUES.find((i) => i.kind === kind)?.hold ?? null
}

const EXPLOSIONS = [
  'The second stage engine shut down too early and the rocket broke apart.',
  'A valve on the rocket stuck open and the vehicle broke apart two minutes after liftoff.',
  'A crack in a fuel tank grew under the pressure and the rocket exploded.',
]

/** Cadet is forgiving; Director missions face more risk, like real first-time missions */
const RISK_FACTOR: Record<Difficulty, number> = { cadet: 0.5, engineer: 1, director: 1.5, sandbox: 1 }

export function launchRisk(rocket: LaunchVehicle, difficulty: Difficulty): number {
  return Math.min(0.5, rocket.riskOfIssue * RISK_FACTOR[difficulty])
}

/** Chance the rocket itself fails; Cadet rockets never explode */
export function failureChance(rocket: LaunchVehicle, difficulty: Difficulty): number {
  return difficulty === 'cadet' ? 0 : Math.min(0.5, rocket.failureRate * RISK_FACTOR[difficulty])
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/* ---------------- odds ---------------- */

export interface OddsFactor {
  label: string
  /** 0..1 chance this part goes right */
  chance: number
  text: string
}

export interface LaunchOdds {
  /** 0..1 chance the spacecraft ends up working in the right orbit */
  chance: number
  /** 0..1 how rough the ride looks (shaking, wobble); grows as the odds drop */
  roughness: number
  factors: OddsFactor[]
}

/** Weight over the rocket's limit: each 1% over costs 3% of the chance to reach orbit */
function weightChance(massKg: number, capKg: number) {
  return massKg <= capKg ? 1 : Math.max(0.05, 1 - ((massKg - capKg) / capKg) * 3)
}

export function launchOdds(design: MissionDesign): LaunchOdds {
  const ev = evaluate(design)
  const rocket = rocketById(design.comms.launchVehicleId)
  const orbit = orbitById(design.comms.orbitId)
  if (!rocket || !orbit) return { chance: 0, roughness: 1, factors: [] }

  const factors: OddsFactor[] = []
  const rel = 1 - failureChance(rocket, design.planner.difficulty)
  factors.push({ label: 'Rocket reliability', chance: rel, text: `The ${rocket.name} works ${pct(rel)} of the time.` })

  const cap = rocket.capacityKg[orbit.id]
  if (cap === undefined) {
    factors.push({ label: 'Reach', chance: 0, text: `The ${rocket.name} can’t reach ${orbit.name}: it will leave your spacecraft in the wrong orbit.` })
  } else {
    const w = weightChance(ev.massKg, cap)
    factors.push({
      label: 'Weight',
      chance: w,
      text:
        w === 1
          ? `${ev.massKg} kg of the ${cap} kg it can lift: plenty of margin.`
          : `${ev.massKg} kg is ${pct((ev.massKg - cap) / cap)} more than it can lift to ${orbit.name}. The engines may not be strong enough.`,
    })
  }

  const radio = ev.resources.comms
  const heard = radio.available >= orbit.altitudeKm
  factors.push({
    label: 'Radio',
    chance: heard ? 1 : 0,
    text: heard
      ? 'Earth can hear your radio from that orbit.'
      : design.comms.radioId
        ? 'Your radio is too weak to be heard from that far: the spacecraft will go silent.'
        : 'There is no radio, so Earth will never hear from the spacecraft.',
  })

  const chance = factors.reduce((p, f) => p * f.chance, 1)
  return { chance, roughness: clamp01((1 - chance) * 2.5), factors }
}

/* ---------------- roll ---------------- */

/** `roll` and `pick` are random numbers in 0..1, passed in so tests can choose them */
export function rollLaunch(design: MissionDesign, roll: number, pick: number): LaunchOutcome {
  const ev = evaluate(design)
  const rocket = rocketById(design.comms.launchVehicleId)!
  const orbit = orbitById(design.comms.orbitId)!
  const difficulty = design.planner.difficulty
  const cap = rocket.capacityKg[orbit.id]

  if (cap === undefined) {
    return {
      kind: 'wrong-orbit',
      extraCostM: 0,
      tone: 'fail',
      title: 'Wrong orbit',
      text: `The ${rocket.name} flew perfectly, but it can’t reach ${orbit.name}. Your spacecraft was left in a much lower orbit where it can’t do the mission. Pick a rocket that lists ${orbit.name}.`,
    }
  }

  // One roll, split into bands: too heavy → explosion → delay → perfect
  const pUnder = 1 - weightChance(ev.massKg, cap)
  const pExplode = failureChance(rocket, difficulty) * (1 - pUnder)
  const pIssue = launchRisk(rocket, difficulty) * (1 - pUnder - pExplode)

  if (roll < pUnder) {
    return {
      kind: 'underpowered',
      extraCostM: 0,
      tone: 'fail',
      title: 'Too heavy to reach orbit',
      text: `Your ${ev.massKg} kg spacecraft was more than the ${rocket.name} can lift (${cap} kg). The engines strained, ran out of fuel too early and the rocket fell back. Pick a bigger rocket or a lighter design.`,
    }
  }
  if (roll < pUnder + pExplode) {
    return {
      kind: 'explode',
      extraCostM: 0,
      tone: 'fail',
      title: 'Launch failure',
      text: `${EXPLOSIONS[Math.min(EXPLOSIONS.length - 1, Math.floor(pick * EXPLOSIONS.length))]} The spacecraft was lost. The ${rocket.name} works ${pct(1 - rocket.failureRate)} of the time; this was the unlucky ${pct(rocket.failureRate)}.`,
    }
  }

  // The rocket made it. Can anyone hear the spacecraft?
  if (ev.resources.comms.available < orbit.altitudeKm) {
    return {
      kind: 'lost-signal',
      extraCostM: 0,
      tone: 'fail',
      title: 'Signal lost',
      text: design.comms.radioId
        ? `The launch was perfect and the spacecraft reached ${orbit.name}, but its radio is too weak to be heard from ${orbit.altitudeKm.toLocaleString()} km away. Without contact it can’t send any science home. Pick a stronger radio.`
        : `The launch was perfect and the spacecraft reached ${orbit.name}, but it has no radio, so it can never send anything home. Add a radio in Design.`,
    }
  }

  if (roll < pUnder + pExplode + pIssue) {
    const issue = ISSUES[Math.min(ISSUES.length - 1, Math.floor(pick * ISSUES.length))]
    return {
      kind: issue.kind,
      extraCostM: issue.costM,
      tone: 'bad',
      title: issue.title,
      text: `${issue.text(rocket)} The spacecraft still reached ${orbit.name} safely.`,
    }
  }
  return {
    kind: 'perfect',
    extraCostM: 0,
    tone: 'good',
    title: 'Perfect launch',
    text: `The ${rocket.name} put your spacecraft into ${orbit.name}. The solar panels unfolded and the first signal reached the ground station.`,
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
