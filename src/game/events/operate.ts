/**
 * Operate phase: fly the mission one month at a time.
 *
 * Pure functions, no React. Each month:
 *   power  → how much of the month the instruments can run (sunlight vs shadow, battery)
 *   data   → instruments fill storage; ground-station passes empty it; overflow is lost
 *   science→ only counts once its data reaches Earth
 *   budget → operations cost every month
 *   health → random events can damage the spacecraft
 *
 * Every number that changes gets a plain-language reason in `report.notes`,
 * because the challenge asks us to explain WHY, not just show a result.
 */

import type { Difficulty, Instrument, LaunchVehicle, Orbit, Part, Scenario } from '../types'
import { EVENTS, type EventId } from './events'
import { nextRandom } from './random'

/* ---------------- input: the spacecraft that was designed and launched ---------------- */

export interface FlightSpacecraft {
  scenario: Scenario
  difficulty: Difficulty
  orbit: Orbit
  launchVehicle: LaunchVehicle | null
  parts: Part[]
  instruments: Instrument[]
  /** Planned lifetime from the Mission Planner */
  targetLifetimeMonths: number
  /** What is left after building and launching (USD M) */
  budgetLeftM: number
}

/** Tunable constants. Kept in one place so Zakwan's engine can share them. */
export const OPS = {
  daysPerTurn: 30,
  /** Minutes per orbit for orbits with shadow (LEO-like) */
  orbitPeriodMin: 95,
  /** Share of the battery we allow to be used each orbit (protects battery life) */
  depthOfDischarge: 0.6,
  /** Ground team + antenna time per month (USD M) */
  baseOpsCostM: 0.15,
  opsCostPerInstrumentM: 0.04,
  eventChance: { cadet: 0.25, engineer: 0.35, director: 0.5, sandbox: 0.3 } as Record<Difficulty, number>,
}

/* ---------------- state ---------------- */

export interface MonthReport {
  month: number
  powerGenW: number
  powerDrawW: number
  /** 0..1 share of the month the instruments could run */
  instrumentUptime: number
  dataMadeMbit: number
  dataSentMbit: number
  dataLostMbit: number
  scienceReturned: number
  costM: number
  notes: string[]
}

export interface LogEntry {
  month: number
  title: string
  text: string
  tone: 'good' | 'bad' | 'info'
  /** true when it records a choice the team made */
  decision?: boolean
}

export interface PendingEvent {
  id: EventId
  /** Instrument the event is about, if any */
  instrumentId?: string
  /** Extra detail shown on the card, e.g. the real CME date */
  detail?: string
}

/** Effects a choice puts on the coming month only */
export interface MonthModifiers {
  safeMode: boolean
  downlinkFactor: number
  scienceFactor: number
  extraPowerDrawW: number
}

export interface OperateState {
  month: number // months flown so far
  totalMonths: number
  health: number // 0..100
  budgetLeftM: number
  /** Battery capacity left, 0..1 (ages and can be damaged) */
  batteryFactor: number
  dataStoredMbit: number
  scienceStored: number // collected but not yet sent home
  scienceReturned: number
  dataSentMbit: number
  dataLostMbit: number
  /** Sum of each month's instrument uptime (0..1), for the average */
  uptimeSum: number
  /** Instrument id → switched on */
  instrumentsOn: Record<string, boolean>
  brokenInstruments: string[]
  pending: PendingEvent | null
  modifiers: MonthModifiers
  log: LogEntry[]
  lastReport: MonthReport | null
  ended: { success: boolean; reason: string } | null
  seed: number
}

const NO_MODIFIERS: MonthModifiers = { safeMode: false, downlinkFactor: 1, scienceFactor: 1, extraPowerDrawW: 0 }

/* ---------------- helpers ---------------- */

const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function partOf(craft: FlightSpacecraft, category: Part['category']): Part | undefined {
  return craft.parts.find((p) => p.category === category)
}

function storageMbit(craft: FlightSpacecraft): number {
  return partOf(craft, 'computer')?.storageMbit ?? 0
}

/** Data the radio can send home in one month (Mbit) */
export function downlinkPerMonthMbit(craft: FlightSpacecraft): number {
  const kbps = partOf(craft, 'comms')?.dataRateKbps ?? 0
  return (kbps * craft.orbit.contactMinPerDay * 60 * OPS.daysPerTurn) / 1000
}

export function activeInstruments(craft: FlightSpacecraft, state: OperateState): Instrument[] {
  return craft.instruments.filter(
    (i) => state.instrumentsOn[i.id] && !state.brokenInstruments.includes(i.id),
  )
}

/* ---------------- start ---------------- */

export function startOperate(craft: FlightSpacecraft, seed: number): OperateState {
  const totalMonths = Math.min(craft.targetLifetimeMonths, craft.orbit.maxLifetimeMonths)
  const state: OperateState = {
    month: 0,
    totalMonths,
    health: 100,
    budgetLeftM: craft.budgetLeftM,
    batteryFactor: 1,
    dataStoredMbit: 0,
    scienceStored: 0,
    scienceReturned: 0,
    dataSentMbit: 0,
    dataLostMbit: 0,
    uptimeSum: 0,
    instrumentsOn: Object.fromEntries(craft.instruments.map((i) => [i.id, true])),
    brokenInstruments: [],
    pending: null,
    modifiers: { ...NO_MODIFIERS },
    log: [],
    lastReport: null,
    ended: null,
    seed,
  }
  if (totalMonths < craft.targetLifetimeMonths) {
    state.log.push({
      month: 0,
      title: 'Short orbit life',
      text: `${craft.orbit.name} only lasts about ${craft.orbit.maxLifetimeMonths} months before drag or fuel ends it, so the mission is planned for ${totalMonths} months instead of ${craft.targetLifetimeMonths}.`,
      tone: 'bad',
    })
  }
  return rollEvent(craft, state)
}

/* ---------------- player actions ---------------- */

/** Switch an instrument on or off (saves power and data, loses its science). */
export function toggleInstrument(state: OperateState, instrumentId: string, on: boolean): OperateState {
  if (state.ended || state.brokenInstruments.includes(instrumentId)) return state
  return { ...state, instrumentsOn: { ...state.instrumentsOn, [instrumentId]: on } }
}

/** Answer the event card. Must happen before the next month can run. */
export function chooseEventOption(craft: FlightSpacecraft, state: OperateState, choiceIndex: number): OperateState {
  if (!state.pending) return state
  const event = EVENTS[state.pending.id]
  const choice = event.choices[choiceIndex]
  if (!choice) throw new Error('Unknown choice')

  const [roll, seed] = nextRandom(state.seed)
  const result = choice.apply({ craft, state: { ...state, seed }, pending: state.pending, roll })
  return {
    ...result.state,
    pending: null,
    log: [
      ...result.state.log,
      {
        month: state.month + 1,
        title: `${event.title}: mission control chose “${choice.label}”`,
        text: result.message,
        tone: result.tone,
        decision: true,
      },
    ],
  }
}

/**
 * Fly one month. If a surprise event starts, mission control answers it at once
 * with its standard response (the first choice: safe mode, move out of the way,
 * reboot…), so the game never stops for a question. The outcome goes in the log.
 */
export function flyMonth(craft: FlightSpacecraft, state: OperateState): OperateState {
  const next = runMonth(craft, state.pending ? chooseEventOption(craft, state, 0) : state)
  return next.pending && !next.ended ? chooseEventOption(craft, next, 0) : next
}

/* ---------------- the month ---------------- */

export function runMonth(craft: FlightSpacecraft, state: OperateState): OperateState {
  if (state.ended) return state
  if (state.pending) throw new Error('Answer the event first')

  const m = state.modifiers
  const month = state.month + 1
  const notes: string[] = []

  // ---- power ----
  const solar = partOf(craft, 'power')
  const battery = partOf(craft, 'battery')
  const healthFactor = 0.5 + state.health / 200 // a damaged craft makes less power
  const powerGenW = (solar?.powerGenW ?? 0) * (1 - craft.orbit.shadowFraction) * healthFactor
  const busW = craft.parts.reduce((sum, p) => sum + p.powerDrawW, 0) + m.extraPowerDrawW
  const active = m.safeMode ? [] : activeInstruments(craft, state)
  const instrumentW = active.reduce((sum, i) => sum + i.powerDrawW, 0)

  // Orbit-average power left for instruments
  let budgetForInstrumentsW = powerGenW - busW
  // In shadow, the battery must carry everything
  const shadowHours = (craft.orbit.shadowFraction * OPS.orbitPeriodMin) / 60
  if (shadowHours > 0) {
    const usableWh = (battery?.capacityWh ?? 0) * OPS.depthOfDischarge * state.batteryFactor
    const batteryLimitW = usableWh / shadowHours - busW
    if (batteryLimitW < budgetForInstrumentsW) {
      budgetForInstrumentsW = batteryLimitW
      if (instrumentW > batteryLimitW) {
        notes.push(
          `Battery limit: in shadow (${Math.round(shadowHours * 60)} min each orbit) the battery can only give the instruments ${Math.max(0, Math.round(batteryLimitW))} W, but they need ${instrumentW} W.`,
        )
      }
    }
  }
  const instrumentUptime = instrumentW === 0 ? 0 : clamp01(budgetForInstrumentsW / instrumentW)
  if (instrumentW > 0 && instrumentUptime < 1 && powerGenW - busW < instrumentW) {
    notes.push(
      `Power short: the solar panels average ${Math.round(powerGenW)} W, the spacecraft itself uses ${busW} W, so the instruments (${instrumentW} W) could only run ${Math.round(instrumentUptime * 100)}% of the time.`,
    )
  }

  let health = state.health
  if (powerGenW < busW) {
    health -= 15
    notes.push(
      `Not enough power even for the basic systems (${Math.round(powerGenW)} W made, ${busW} W needed). The battery is draining and the spacecraft is getting colder: health −15.`,
    )
  }
  if (m.safeMode) notes.push('Safe mode: instruments were off this month, so no new science.')

  // ---- data and science ----
  const days = OPS.daysPerTurn
  const dataMadeMbit = active.reduce((sum, i) => sum + i.dataPerDayMbit, 0) * days * instrumentUptime
  const scienceMade =
    active.reduce((sum, i) => sum + i.scienceValue * (craft.orbit.coverage[craft.scenario.id] ?? 0.5), 0) *
    days *
    instrumentUptime *
    m.scienceFactor

  let stored = state.dataStoredMbit + dataMadeMbit
  let sciStored = state.scienceStored + scienceMade
  const canSend = downlinkPerMonthMbit(craft) * m.downlinkFactor
  const sent = Math.min(stored, canSend)
  const sentShare = stored > 0 ? sent / stored : 0
  const scienceReturned = sciStored * sentShare
  stored -= sent
  sciStored -= scienceReturned

  let lost = 0
  const maxStore = storageMbit(craft)
  if (stored > maxStore) {
    lost = stored - maxStore
    const lostShare = lost / stored
    sciStored -= sciStored * lostShare
    stored = maxStore
    notes.push(
      `Data lost: the radio could only send ${Math.round(canSend)} Mbit home this month and storage holds ${maxStore} Mbit, so ${Math.round(lost)} Mbit was deleted. A faster radio, more storage, or an orbit with more ground-station passes would help.`,
    )
  }
  if (m.downlinkFactor < 1) notes.push('Ground station problems cut the time to send data home.')

  // ---- budget ----
  const costM = OPS.baseOpsCostM + OPS.opsCostPerInstrumentM * craft.instruments.length
  const budgetLeftM = state.budgetLeftM - costM

  // ---- battery ageing ----
  const batteryFactor = Math.max(0.3, state.batteryFactor - 0.01)

  const report: MonthReport = {
    month,
    powerGenW: round(powerGenW),
    powerDrawW: round(busW + instrumentW * instrumentUptime),
    instrumentUptime: round(instrumentUptime, 2),
    dataMadeMbit: Math.round(dataMadeMbit),
    dataSentMbit: Math.round(sent),
    dataLostMbit: Math.round(lost),
    scienceReturned: Math.round(scienceReturned),
    costM: round(costM, 2),
    notes,
  }

  let next: OperateState = {
    ...state,
    month,
    health: Math.max(0, health),
    budgetLeftM: round(budgetLeftM, 2),
    batteryFactor,
    dataStoredMbit: stored,
    scienceStored: sciStored,
    scienceReturned: state.scienceReturned + scienceReturned,
    dataSentMbit: state.dataSentMbit + sent,
    dataLostMbit: state.dataLostMbit + lost,
    uptimeSum: state.uptimeSum + (m.safeMode ? 0 : instrumentUptime),
    modifiers: { ...NO_MODIFIERS },
    lastReport: report,
  }

  next = checkEnd(next)
  return next.ended ? next : rollEvent(craft, next)
}

function checkEnd(state: OperateState): OperateState {
  if (state.health <= 0) {
    return { ...state, ended: { success: false, reason: 'The spacecraft was lost: its health reached zero.' } }
  }
  if (state.budgetLeftM < 0) {
    return {
      ...state,
      ended: {
        success: false,
        reason: 'The mission ran out of money for the ground team and antenna time, so it had to stop early.',
      },
    }
  }
  if (state.month >= state.totalMonths) {
    return { ...state, ended: { success: true, reason: `The spacecraft finished its ${state.totalMonths}-month mission.` } }
  }
  return state
}

/** Maybe start a random event for the coming month. */
function rollEvent(craft: FlightSpacecraft, state: OperateState): OperateState {
  let seed = state.seed
  let roll: number
  ;[roll, seed] = nextRandom(seed)
  if (roll >= OPS.eventChance[craft.difficulty]) return { ...state, seed }

  const possible = Object.values(EVENTS).filter((e) => e.canHappen(craft, state))
  if (possible.length === 0) return { ...state, seed }

  // weighted pick
  const total = possible.reduce((sum, e) => sum + e.weight, 0)
  ;[roll, seed] = nextRandom(seed)
  let pick = roll * total
  const event = possible.find((e) => (pick -= e.weight) < 0) ?? possible[possible.length - 1]

  const [detailRoll, seed2] = nextRandom(seed)
  return { ...state, seed: seed2, pending: event.start(craft, state, detailRoll) }
}

/* ---------------- summary for the Report screen and scoring ---------------- */

export interface OperateSummary {
  success: boolean
  reason: string
  monthsFlown: number
  totalMonths: number
  /** What the Mission Planner asked for, before any months were lost */
  plannedMonths: number
  scienceReturned: number
  scienceTarget: number
  dataSentMbit: number
  dataLostMbit: number
  budgetLeftM: number
  startBudgetM: number
  health: number
  /** Average share of each month the instruments ran, 0..1 */
  averageUptime: number
  log: LogEntry[]
}

export function summarize(craft: FlightSpacecraft, state: OperateState): OperateSummary {
  return {
    success: state.ended?.success ?? false,
    reason: state.ended?.reason ?? 'The mission is still flying.',
    monthsFlown: state.month,
    totalMonths: state.totalMonths,
    plannedMonths: craft.targetLifetimeMonths,
    scienceReturned: Math.round(state.scienceReturned),
    scienceTarget: craft.scenario.scienceTarget,
    dataSentMbit: Math.round(state.dataSentMbit),
    dataLostMbit: Math.round(state.dataLostMbit),
    budgetLeftM: state.budgetLeftM,
    startBudgetM: craft.budgetLeftM,
    health: state.health,
    averageUptime: state.month > 0 ? state.uptimeSum / state.month : 0,
    log: state.log,
  }
}
