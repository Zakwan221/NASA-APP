/**
 * Game engine: checks a mission design and explains every problem in one sentence.
 *
 * Pure functions, no React. Uses the same constants as the Operate phase (OPS),
 * so what the dashboard promises is what happens in flight.
 *
 *   evaluate(design)    → resources for the dashboard + warnings that say WHY
 *   buildFlight(design) → the spacecraft Operate flies (null until it can launch)
 */

import { INSTRUMENTS, instrumentById, orbitById, partById, rocketById, scenarioById } from '../data'
import { OPS, type FlightSpacecraft } from '../events/operate'
import type {
  Difficulty,
  Instrument,
  MissionDesign,
  Orbit,
  Part,
  PartCategory,
  ResourceKey,
  ResourceStatus,
  Scenario,
  Warning,
} from '../types'

/* ---------------- constants ---------------- */

/** Instruments that don't fit the scenario still collect a little science */
export const OFF_TARGET_SCIENCE = 0.2
/** Instruments the attitude control can't aim well enough lose most of their science */
export const BAD_POINTING_SCIENCE = 0.3
/** Sandbox has no real limits */
const SANDBOX_LIMITS = { budgetM: 100, minLifetimeMonths: 1 }
/** Used for the power and data preview until an orbit is picked */
const PREVIEW_ORBIT_ID = 'sso'

const ENGINEER_SLOTS: { key: keyof MissionDesign['engineer']; category: PartCategory; why: string }[] = [
  { key: 'structureId', category: 'structure', why: 'Pick a frame: every other part has to be bolted to something.' },
  { key: 'solarId', category: 'power', why: 'Pick solar panels: without them the battery is empty within hours.' },
  { key: 'batteryId', category: 'battery', why: 'Pick a battery: it keeps the spacecraft alive in Earth’s shadow.' },
  { key: 'computerId', category: 'computer', why: 'Pick a flight computer: it runs the spacecraft and stores data until it can be sent home.' },
  { key: 'attitudeId', category: 'attitude', why: 'Pick attitude control: without it the spacecraft tumbles and can’t aim its instruments.' },
]

/* ---------------- helpers ---------------- */

const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const fmtKm = (km: number) => (km >= 1_000_000 ? `${round(km / 1_000_000, 1)} million km` : `${km.toLocaleString()} km`)

export function limitsFor(scenario: Scenario | undefined, difficulty: Difficulty) {
  if (!scenario || difficulty === 'sandbox') return SANDBOX_LIMITS
  return scenario.limits[difficulty]
}

/** Parts in the design, in a fixed order (structure, power, battery, computer, attitude, radio) */
export function chosenParts(design: MissionDesign): Part[] {
  const ids = [...ENGINEER_SLOTS.map((s) => design.engineer[s.key]), design.comms.radioId]
  return ids.map((id) => partById(id)).filter((p): p is Part => Boolean(p))
}

export function chosenInstruments(design: MissionDesign): Instrument[] {
  return design.science.instrumentIds.map(instrumentById).filter((i): i is Instrument => Boolean(i))
}

/** How much science an instrument really gives on this mission, and why it's less */
export function instrumentFit(instrument: Instrument, scenarioId: string | null, attitude: Part | undefined) {
  let factor = 1
  const reasons: string[] = []
  if (scenarioId && !instrument.goodFor.includes(scenarioId)) {
    factor *= OFF_TARGET_SCIENCE
    reasons.push(`${instrument.name} isn’t built for this mission, so it collects only ${OFF_TARGET_SCIENCE * 100}% of its science.`)
  }
  if (attitude?.pointingDeg !== undefined && attitude.pointingDeg > instrument.needsPointingDeg) {
    factor *= BAD_POINTING_SCIENCE
    reasons.push(
      `${instrument.name} must aim within ${instrument.needsPointingDeg}°, but ${attitude.name} only holds ${attitude.pointingDeg}°, so most images are blurred (${BAD_POINTING_SCIENCE * 100}% science).`,
    )
  }
  return { factor, reasons }
}

/** Minutes per orbit spent in Earth's shadow */
function shadowHours(orbit: Orbit) {
  return (orbit.shadowFraction * OPS.orbitPeriodMin) / 60
}

/* ---------------- evaluate ---------------- */

export interface Evaluation {
  scenario: Scenario | undefined
  orbit: Orbit | undefined
  limits: { budgetM: number; minLifetimeMonths: number }
  resources: Record<ResourceKey, ResourceStatus>
  warnings: Warning[]
  massKg: number
  buildCostM: number
  launchCostM: number
  /** Money needed to run the mission for its planned months */
  opsReserveM: number
  /** Budget left after building and launching (before operations) */
  budgetLeftM: number
  /** Share of the time the instruments can run on the power available, 0..1 */
  instrumentUptime: number
  /** Expected science reaching Earth over the planned lifetime */
  projectedScience: number
  /** A mission is chosen, so the player can go on to Launch (problems never block) */
  designReady: boolean
  /** A mission, orbit and rocket are chosen, so it can launch (whatever its problems) */
  launchReady: boolean
}

export function evaluate(design: MissionDesign): Evaluation {
  const warnings: Warning[] = []
  const warn = (resource: Warning['resource'], phase: Warning['phase'], blocking: boolean, message: string) =>
    warnings.push({ resource, phase, blocking, message })

  const scenario = scenarioById(design.planner.scenarioId)
  const difficulty = design.planner.difficulty
  const limits = limitsFor(scenario, difficulty)
  const chosenOrbit = orbitById(design.comms.orbitId)
  const orbit = chosenOrbit ?? orbitById(PREVIEW_ORBIT_ID)!
  const rocket = rocketById(design.comms.launchVehicleId)
  const parts = chosenParts(design)
  const instruments = chosenInstruments(design)
  const part = (c: PartCategory) => parts.find((p) => p.category === c)
  const structure = part('structure')
  const solar = part('power')
  const battery = part('battery')
  const computer = part('computer')
  const attitude = part('attitude')
  const radio = part('comms')

  /* ---- planner ---- */
  if (!scenario) warn('compatibility', 'design', true, 'Pick a mission first: the parts you need depend on what you want to do.')
  if (design.planner.targetLifetimeMonths < limits.minLifetimeMonths) {
    warn(
      'lifetime',
      'design',
      true,
      `This difficulty asks for at least ${limits.minLifetimeMonths} months in space; you planned ${design.planner.targetLifetimeMonths}.`,
    )
  }

  /* ---- missing parts ---- */
  for (const slot of ENGINEER_SLOTS) {
    if (!design.engineer[slot.key]) warn('compatibility', 'design', true, slot.why)
  }
  if (!radio) warn('comms', 'design', true, 'Pick a radio: science only counts once its data reaches Earth.')
  if (instruments.length === 0) warn('compatibility', 'design', true, 'Pick at least one instrument: it is the reason the mission exists.')

  /* ---- instrument fit ---- */
  let effectiveScience = 0
  for (const i of instruments) {
    const fit = instrumentFit(i, design.planner.scenarioId, attitude)
    fit.reasons.forEach((r) => warn('compatibility', 'design', false, r))
    effectiveScience += i.scienceValue * fit.factor
  }

  /* ---- mass ---- */
  const massKg = round([...parts, ...instruments].reduce((s, p) => s + p.massKg, 0), 2)
  const structureLoad = structure?.maxLoadKg ?? 0
  if (structure && massKg > structureLoad) {
    warn(
      'mass',
      'design',
      true,
      `Too heavy for the ${structure.name}: everything weighs ${massKg} kg but it carries at most ${structureLoad} kg. Pick a bigger frame or lighter parts.`,
    )
  }
  const rocketCap = chosenOrbit && rocket ? rocket.capacityKg[chosenOrbit.id] : undefined

  /* ---- power (orbit average) ---- */
  const busW = round(parts.reduce((s, p) => s + p.powerDrawW, 0))
  const instrumentW = round(instruments.reduce((s, i) => s + i.powerDrawW, 0))
  const genW = round((solar?.powerGenW ?? 0) * (1 - orbit.shadowFraction))
  let instrumentBudgetW = genW - busW
  const sh = shadowHours(orbit)
  if (sh > 0 && battery) {
    const batteryLimitW = ((battery.capacityWh ?? 0) * OPS.depthOfDischarge) / sh - busW
    if (batteryLimitW < instrumentBudgetW) {
      instrumentBudgetW = batteryLimitW
      if (instrumentW > batteryLimitW && instruments.length) {
        warn(
          'power',
          'design',
          false,
          `The ${battery.name} can only give the instruments ${Math.max(0, Math.round(batteryLimitW))} W during the ${Math.round(sh * 60)} min in shadow each orbit, but they need ${instrumentW} W. Pick a bigger battery.`,
        )
      }
    }
  }
  const instrumentUptime = instrumentW === 0 ? 0 : clamp01(instrumentBudgetW / instrumentW)
  const orbitNote = chosenOrbit ? '' : ' (until you pick an orbit, this assumes sun-synchronous)'
  if (solar && genW < busW) {
    warn(
      'power',
      'design',
      true,
      `Not enough power even for the basic systems: the panels average ${genW} W${orbitNote} but the spacecraft itself uses ${busW} W. It would freeze. Pick bigger panels.`,
    )
  } else if (solar && instruments.length && instrumentUptime < 1) {
    warn(
      'power',
      'design',
      false,
      `The panels average ${genW} W${orbitNote} and the spacecraft uses ${busW} W, so the instruments (${instrumentW} W) can only run ${Math.round(instrumentUptime * 100)}% of the time.`,
    )
  }

  /* ---- data ---- */
  const dataPerMonth = Math.round(instruments.reduce((s, i) => s + i.dataPerDayMbit, 0) * OPS.daysPerTurn * instrumentUptime)
  const downlinkPerMonth = Math.round(((radio?.dataRateKbps ?? 0) * orbit.contactMinPerDay * 60 * OPS.daysPerTurn) / 1000)
  if (radio && instruments.length && dataPerMonth > downlinkPerMonth) {
    const lostShare = 1 - downlinkPerMonth / dataPerMonth
    warn(
      'data',
      'design',
      false,
      `The instruments make ${dataPerMonth.toLocaleString()} Mbit a month but the ${radio.name} can send only ${downlinkPerMonth.toLocaleString()} Mbit${orbitNote}, so about ${Math.round(lostShare * 100)}% will be lost once the ${((computer?.storageMbit ?? 0) / 8000).toFixed(0)} GB storage is full. A faster radio or fewer instruments would fix it.`,
    )
  }

  /* ---- comms range ---- */
  const rangeKm = radio?.maxRangeKm ?? 0
  if (chosenOrbit && radio && rangeKm < chosenOrbit.altitudeKm) {
    warn(
      'comms',
      'launch',
      false,
      `The ${radio.name} can be heard up to ${fmtKm(rangeKm)}, but ${chosenOrbit.name} is ${fmtKm(chosenOrbit.altitudeKm)} away: after launch nobody on Earth would hear it and the mission is lost. Pick a stronger radio in Design, or a closer orbit.`,
    )
  }

  /* ---- orbit and rocket ---- */
  if (!chosenOrbit) warn('compatibility', 'launch', true, 'Pick an orbit: it decides how much sunlight, contact time and view of your target you get.')
  else if (scenario && !scenario.allowedOrbits.includes(chosenOrbit.id)) {
    warn(
      'compatibility',
      'launch',
      true,
      (chosenOrbit.coverage[scenario.id] ?? 0) === 0
        ? `From ${chosenOrbit.name} your instruments can’t see the target of “${scenario.title}” at all.`
        : `${chosenOrbit.name} isn’t an option for “${scenario.title}”: pick one of the orbits marked as possible.`,
    )
  }
  if (!rocket) warn('mass', 'launch', true, 'Pick a rocket to get to your orbit.')
  else if (chosenOrbit && rocketCap === undefined) {
    warn('mass', 'launch', false, `The ${rocket.name} can’t reach ${chosenOrbit.name}: it would leave your spacecraft in the wrong orbit. Pick another rocket.`)
  } else if (rocketCap !== undefined && massKg > rocketCap) {
    warn(
      'mass',
      'launch',
      false,
      `Your spacecraft weighs ${massKg} kg but the ${rocket.name} can only carry ${rocketCap} kg to ${chosenOrbit!.name}, so it may not reach orbit. Pick a bigger rocket or a lighter design.`,
    )
  }

  /* ---- lifetime ---- */
  const plannedMonths = design.planner.targetLifetimeMonths
  if (chosenOrbit && chosenOrbit.maxLifetimeMonths < plannedMonths) {
    warn(
      'lifetime',
      'launch',
      false,
      `${chosenOrbit.name} only lasts about ${chosenOrbit.maxLifetimeMonths} months before drag or fuel ends it, but you planned ${plannedMonths}. The mission will end early.`,
    )
  }

  /* ---- budget ---- */
  const buildCostM = round([...parts, ...instruments].reduce((s, p) => s + p.costM, 0), 2)
  const launchCostM = rocket?.costM ?? 0
  const flownMonths = Math.min(plannedMonths, chosenOrbit?.maxLifetimeMonths ?? plannedMonths)
  const opsReserveM = round((OPS.baseOpsCostM + OPS.opsCostPerInstrumentM * instruments.length) * flownMonths, 2)
  const budgetLeftM = round(limits.budgetM - buildCostM - launchCostM, 2)
  if (budgetLeftM < 0) {
    warn(
      'budget',
      rocket ? 'launch' : 'design',
      false,
      `Over budget: building costs $${buildCostM} M${rocket ? ` and the launch $${launchCostM} M` : ''}, but you only have ${limits.budgetM} M, so there is no money to run the mission. Cut instruments or pick cheaper parts${rocket ? ' or a cheaper rocket' : ''}.`,
    )
  } else if (budgetLeftM < opsReserveM) {
    warn(
      'budget',
      rocket ? 'launch' : 'design',
      false,
      `Only $${budgetLeftM} M left for operations, but running the mission for ${flownMonths} months costs about $${opsReserveM} M. You will run out of money before the end.`,
    )
  }

  /* ---- science projection ---- */
  const coverage = scenario ? (orbit.coverage[scenario.id] ?? 0.5) : 0
  const sciencePerMonth = effectiveScience * coverage * OPS.daysPerTurn * instrumentUptime
  const sentShare = dataPerMonth > 0 ? Math.min(1, downlinkPerMonth / dataPerMonth) : 1
  const projectedScience = Math.round(sciencePerMonth * sentShare * flownMonths)

  /* ---- dashboard ---- */
  const status = (key: ResourceKey, used: number, available: number, unit: string): ResourceStatus => ({
    key,
    used,
    available,
    unit,
    ok: used <= available,
  })
  const massLimit = Math.min(structureLoad || Infinity, rocketCap ?? Infinity)
  const resources: Record<ResourceKey, ResourceStatus> = {
    mass: status('mass', massKg, Number.isFinite(massLimit) ? massLimit : 0, 'kg'),
    power: status('power', round(busW + instrumentW), genW, 'W'),
    budget: status('budget', round(buildCostM + launchCostM + opsReserveM, 2), limits.budgetM, '$M'),
    data: status('data', dataPerMonth, downlinkPerMonth, 'Mbit/mo'),
    comms: status('comms', chosenOrbit?.altitudeKm ?? 0, rangeKm, 'km'),
    lifetime: status('lifetime', plannedMonths, chosenOrbit?.maxLifetimeMonths ?? plannedMonths, 'months'),
  }

  return {
    scenario,
    orbit: chosenOrbit,
    limits,
    resources,
    warnings,
    massKg,
    buildCostM,
    launchCostM,
    opsReserveM,
    budgetLeftM,
    instrumentUptime,
    projectedScience,
    // Problems never stop the game: they show up as what goes wrong in flight
    designReady: Boolean(scenario),
    launchReady: Boolean(scenario && chosenOrbit && rocket),
  }
}

/* ---------------- hand-over to Operate ---------------- */

/**
 * The spacecraft Operate flies. Instruments that don't fit the mission or can't
 * be aimed carry their reduced science value, so the flight matches the warnings.
 * `extraCostM` is money lost on launch day (e.g. a delay).
 */
export function buildFlight(design: MissionDesign, extraCostM = 0): FlightSpacecraft | null {
  const ev = evaluate(design)
  if (!ev.launchReady || !ev.scenario || !ev.orbit) return null
  const parts = chosenParts(design)
  const attitude = parts.find((p) => p.category === 'attitude')
  const instruments = chosenInstruments(design).map((i) => {
    const { factor } = instrumentFit(i, ev.scenario!.id, attitude)
    return factor === 1 ? i : { ...i, scienceValue: Math.round(i.scienceValue * factor) }
  })
  return {
    scenario: ev.scenario,
    difficulty: design.planner.difficulty,
    orbit: ev.orbit,
    launchVehicle: rocketById(design.comms.launchVehicleId) ?? null,
    parts,
    instruments,
    targetLifetimeMonths: design.planner.targetLifetimeMonths,
    budgetLeftM: round(ev.budgetLeftM - extraCostM, 2),
  }
}

/** Instruments that help a scenario, for the "recommended" badge */
export function recommendedInstruments(scenarioId: string | null): Set<string> {
  return new Set(INSTRUMENTS.filter((i) => scenarioId && i.goodFor.includes(scenarioId)).map((i) => i.id))
}
