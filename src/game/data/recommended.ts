/**
 * Starter builds that win each mission on Engineer difficulty. They are flown
 * through the real game in tests (recommended.test.ts), so if the game's
 * numbers change and a build stops winning, the tests say so.
 */

import type { MissionDesign } from '../types'

export interface Recommended {
  scenarioId: string
  design: MissionDesign
  /** Why this build works, one line per choice */
  why: string[]
}

const build = (
  scenarioId: string,
  months: number,
  engineer: MissionDesign['engineer'],
  instrumentIds: string[],
  radioId: string,
  orbitId: MissionDesign['comms']['orbitId'],
  launchVehicleId: string,
): MissionDesign => ({
  planner: { scenarioId, difficulty: 'engineer', targetLifetimeMonths: months, targetCoverage: 0.5 },
  engineer,
  science: { instrumentIds },
  comms: { radioId, orbitId, launchVehicleId },
})

export const RECOMMENDED: Recommended[] = [
  {
    scenarioId: 'earth-watch',
    design: build(
      'earth-watch',
      12,
      { structureId: 'frame-12u', solarId: 'solar-large', batteryId: 'battery-80', computerId: 'obc', attitudeId: 'wheels' },
      ['thermal-ir', 'spectro'],
      'xband',
      'sso',
      'rideshare-leo',
    ),
    why: [
      'Infrared camera + haze spectrometer: both made for spotting fires and smoke.',
      'Large solar array: enough power to run both instruments all the time.',
      'X-band radio: sends home every picture, so no data is lost.',
      'Sun-synchronous orbit: the best view of Malaysia, at the same time every day.',
      'Rideshare: cheap, and a 12U spacecraft fits easily.',
    ],
  },
  {
    scenarioId: 'solar-storm',
    design: build(
      'solar-storm',
      12,
      { structureId: 'frame-12u', solarId: 'solar-large', batteryId: 'battery-20', computerId: 'obc', attitudeId: 'star-tracker' },
      ['magnetometer', 'particle', 'euv-imager'],
      'xband',
      'l1',
      'deep-rideshare',
    ),
    why: [
      'Three Sun instruments: the EUV imager does most of the science.',
      'Star tracker: the EUV imager must aim within 0.05°.',
      'L1 point: the Sun is never hidden, so the smallest battery is enough.',
      'X-band radio: strong enough to be heard from 1.5 million km.',
      'Deep-space rideshare: the cheap way to reach L1.',
    ],
  },
  {
    scenarioId: 'asteroid-scout',
    design: build(
      'asteroid-scout',
      9,
      { structureId: 'frame-12u', solarId: 'solar-large', batteryId: 'battery-20', computerId: 'obc', attitudeId: 'wheels' },
      ['nav-camera', 'nir-spectro'],
      'deep-transponder',
      'deep-space',
      'deep-rideshare',
    ),
    why: [
      'Navigation camera + infrared spectrometer: light, and both made for asteroids.',
      'Deep-space transponder: the only radio Earth can hear from 20 million km.',
      'Large solar array: the transponder alone needs 35 W.',
      'No shadow in deep space, so the smallest battery is fine.',
      'Kept under 25 kg so the deep-space rideshare can carry it.',
    ],
  },
]
