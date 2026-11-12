/**
 * Random events in the Operate phase. Each one is a small decision for the team
 * (a good fit for a team vote), and every outcome explains why it happened.
 *
 * The flight log adds a real NASA example to solar storms (DONKI) and wildfires
 * (EONET): see src/pages/mission/nasa/. The events themselves stay random and
 * seeded, so every phone in a team room sees the same mission.
 */

import type { FlightSpacecraft, LogEntry, OperateState, PendingEvent } from './operate'
import { activeInstruments } from './operate'

export type EventId = 'solar-storm' | 'debris' | 'instrument-glitch' | 'station-outage' | 'fire-season'

interface ChoiceContext {
  craft: FlightSpacecraft
  state: OperateState
  pending: PendingEvent
  /** 0..1 random number for this choice, from the seeded generator */
  roll: number
}

interface ChoiceResult {
  state: OperateState
  message: string
  tone: LogEntry['tone']
}

export interface EventChoice {
  label: string
  /** Shown before choosing: what it costs and what it risks */
  hint: string
  apply: (ctx: ChoiceContext) => ChoiceResult
}

export interface MissionEvent {
  id: EventId
  title: string
  icon: string
  /** What is happening and why it matters, in simple words */
  describe: (craft: FlightSpacecraft, pending: PendingEvent) => string
  /** Where this kind of event comes from in real missions or NASA data */
  source: string
  weight: number
  canHappen: (craft: FlightSpacecraft, state: OperateState) => boolean
  start: (craft: FlightSpacecraft, state: OperateState, roll: number) => PendingEvent
  choices: EventChoice[]
}

const isNearEarth = (craft: FlightSpacecraft) => ['leo', 'sso'].includes(craft.orbit.id)
const name = (craft: FlightSpacecraft, id?: string) => craft.instruments.find((i) => i.id === id)?.name ?? 'An instrument'

export const EVENTS: Record<EventId, MissionEvent> = {
  'solar-storm': {
    id: 'solar-storm',
    title: 'Solar storm',
    icon: '☀️',
    describe: (craft) =>
      `The Sun has thrown out a cloud of charged particles (a coronal mass ejection). It reaches the spacecraft in about two days. ${
        isNearEarth(craft)
          ? "Earth's magnetic field gives some protection this low."
          : 'Out here there is no magnetic field to shield the spacecraft, so the risk is higher.'
      }`,
    source: 'Space weather alerts like NASA DONKI',
    weight: 3,
    canHappen: () => true,
    start: () => ({ id: 'solar-storm' }),
    choices: [
      {
        label: 'Go to safe mode',
        hint: 'Instruments off for a month. No damage, but no new science.',
        apply: ({ state }) => ({
          state: { ...state, modifiers: { ...state.modifiers, safeMode: true } },
          message:
            'The team switched to safe mode. Turning instruments off protects their electronics from the particle storm, at the cost of a month of science.',
          tone: 'info',
        }),
      },
      {
        label: 'Keep observing',
        hint: 'Keeps the science going, but the electronics might be hit.',
        apply: ({ craft, state, roll }) => {
          const chance = isNearEarth(craft) ? 0.3 : 0.55
          if (roll < chance) {
            return {
              state: { ...state, health: Math.max(0, state.health - 25), batteryFactor: state.batteryFactor * 0.9 },
              message: `The storm hit while everything was running. High-energy particles damaged the electronics and battery: health −25. (Chance of damage was ${Math.round(chance * 100)}%.)`,
              tone: 'bad',
            }
          }
          return {
            state,
            message: `The storm passed without damage. Lucky this time: the chance of damage was ${Math.round(chance * 100)}%.`,
            tone: 'good',
          }
        },
      },
    ],
  },

  debris: {
    id: 'debris',
    title: 'Debris warning',
    icon: '🛰️',
    describe: () =>
      'Tracking stations report a piece of old satellite passing within a few hundred metres. At about 10 km per second, even a small piece can break a spacecraft.',
    source: 'Conjunction warnings that low-orbit missions get every year',
    weight: 2,
    canHappen: (craft) => isNearEarth(craft),
    start: () => ({ id: 'debris' }),
    choices: [
      {
        label: 'Move out of the way',
        hint: 'Uses fuel: the mission ends one month earlier. Costs 0.1 M.',
        apply: ({ state }) => ({
          state: {
            ...state,
            totalMonths: Math.max(state.month + 1, state.totalMonths - 1),
            budgetLeftM: state.budgetLeftM - 0.1,
          },
          message:
            'The team fired the thrusters and dodged. Fuel used for dodging cannot be used later to stay in orbit, so the mission is one month shorter.',
          tone: 'info',
        }),
      },
      {
        label: 'Accept the risk',
        hint: 'Saves fuel, but a hit would be very bad.',
        apply: ({ state, roll }) => {
          if (roll < 0.15) {
            return {
              state: { ...state, health: Math.max(0, state.health - 60) },
              message: 'A small fragment hit a solar panel and the structure: health −60. (The chance was 15%.)',
              tone: 'bad',
            }
          }
          return {
            state,
            message: 'The debris passed by safely. Most close passes miss, but a hit can end a mission (15% chance here).',
            tone: 'good',
          }
        },
      },
    ],
  },

  'instrument-glitch': {
    id: 'instrument-glitch',
    title: 'Instrument glitch',
    icon: '⚠️',
    describe: (craft, pending) =>
      `${name(craft, pending.instrumentId)} stopped answering. Radiation can flip bits in its computer memory.`,
    source: 'Single-event upsets, a common problem for small spacecraft',
    weight: 2,
    canHappen: (craft, state) => activeInstruments(craft, state).length > 0,
    start: (craft, state, roll) => {
      const active = activeInstruments(craft, state)
      return { id: 'instrument-glitch', instrumentId: active[Math.floor(roll * active.length)]?.id }
    },
    choices: [
      {
        label: 'Reboot it from the ground',
        hint: 'Costs 0.3 M of engineer time. Works most of the time.',
        apply: ({ craft, state, pending, roll }) => {
          const fixed = roll < 0.7
          return {
            state: {
              ...state,
              budgetLeftM: state.budgetLeftM - 0.3,
              brokenInstruments: fixed ? state.brokenInstruments : [...state.brokenInstruments, pending.instrumentId!],
            },
            message: fixed
              ? `Engineers rebooted ${name(craft, pending.instrumentId)} and it works again.`
              : `The reboot failed and ${name(craft, pending.instrumentId)} is lost for good. Its science and power use are gone. (Reboots work about 70% of the time.)`,
            tone: fixed ? 'good' : 'bad',
          }
        },
      },
      {
        label: 'Switch it off for good',
        hint: 'Free, but you lose its science for the rest of the mission.',
        apply: ({ craft, state, pending }) => ({
          state: { ...state, brokenInstruments: [...state.brokenInstruments, pending.instrumentId!] },
          message: `${name(craft, pending.instrumentId)} was switched off. That frees its power for the other instruments.`,
          tone: 'info',
        }),
      },
    ],
  },

  'station-outage': {
    id: 'station-outage',
    title: 'Ground station down',
    icon: '📡',
    describe: () =>
      'Heavy rain and a broken antenna at your main ground station. Without it you only get half the usual time to send data home.',
    source: 'Antenna time is shared, e.g. through NASA’s Near Space and Deep Space Networks',
    weight: 2,
    canHappen: () => true,
    start: () => ({ id: 'station-outage' }),
    choices: [
      {
        label: 'Rent another antenna',
        hint: 'Costs 0.2 M. Data keeps flowing as normal.',
        apply: ({ state }) => ({
          state: { ...state, budgetLeftM: state.budgetLeftM - 0.2 },
          message: 'The team rented time on another antenna, so data kept flowing as normal.',
          tone: 'info',
        }),
      },
      {
        label: 'Wait it out',
        hint: 'Free, but you can only send half as much data this month.',
        apply: ({ state }) => ({
          state: { ...state, modifiers: { ...state.modifiers, downlinkFactor: 0.5 } },
          message: 'The team waited. With half the antenna time, more data has to sit in storage this month.',
          tone: 'info',
        }),
      },
    ],
  },

  'fire-season': {
    id: 'fire-season',
    title: 'Fire and haze season',
    icon: '🔥',
    describe: () =>
      'Fires are spreading in the region and haze is rising. This is exactly what the mission was built to watch.',
    source: 'Wildfire events tracked by NASA EONET',
    weight: 3,
    canHappen: (craft, state) => craft.scenario.id === 'earth-watch' && activeInstruments(craft, state).length > 0,
    start: () => ({ id: 'fire-season' }),
    choices: [
      {
        label: 'Point everything at the fires',
        hint: 'Double science this month, but the turns use 10 W more power.',
        apply: ({ state }) => ({
          state: { ...state, modifiers: { ...state.modifiers, scienceFactor: 2, extraPowerDrawW: 10 } },
          message:
            'The team turned the spacecraft towards the fires. Pointing more often uses extra power for the reaction wheels, but each image is worth twice as much.',
          tone: 'good',
        }),
      },
      {
        label: 'Keep the normal plan',
        hint: 'No extra power used.',
        apply: ({ state }) => ({
          state,
          message: 'The team kept the normal plan and saved power.',
          tone: 'info',
        }),
      },
    ],
  },
}
