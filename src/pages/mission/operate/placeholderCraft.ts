/**
 * PLACEHOLDER spacecraft so the Operate screen works before Design, Launch and
 * the real catalog exist. Numbers are rough small-satellite values, not sourced.
 * Replace with the design that flew (Zakwan) and Ibad's catalog in src/game/data/.
 */

import type { FlightSpacecraft } from '../../../game/events/operate'

const source = 'Placeholder, replace with src/game/data'

export const PLACEHOLDER_CRAFT: FlightSpacecraft = {
  difficulty: 'engineer',
  targetLifetimeMonths: 12,
  budgetLeftM: 4,
  launchVehicle: null,
  scenario: {
    id: 'earth-watch',
    title: 'Earth watch: haze and wildfires',
    objective: 'Watch haze and wildfires around Malaysia for a year.',
    criticalResources: ['power', 'data'],
    limits: {
      cadet: { budgetM: 20, minLifetimeMonths: 6 },
      engineer: { budgetM: 15, minLifetimeMonths: 12 },
      director: { budgetM: 10, minLifetimeMonths: 18 },
    },
    scienceTarget: 20000,
    allowedOrbits: ['leo', 'sso', 'geo'],
    nasaData: [{ api: 'EONET', snapshot: 'eonet-fires.json' }],
  },
  orbit: {
    id: 'sso',
    name: 'Sun-synchronous orbit',
    altitudeKm: 550,
    shadowFraction: 0.35,
    contactMinPerDay: 40,
    maxLifetimeMonths: 60,
    coverage: { 'earth-watch': 0.9, 'solar-storm': 0.3, 'asteroid-scout': 0 },
    explain: 'Passes over every place at the same local time each day, which is great for comparing images.',
    source,
  },
  parts: [
    { id: 'frame-12u', name: '12U frame', category: 'structure', tier: 'simple', massKg: 3, costM: 0.1, powerDrawW: 0, maxLoadKg: 24, explain: '', source },
    { id: 'solar-deploy', name: 'Fold-out solar panels', category: 'power', tier: 'simple', massKg: 1.5, costM: 0.4, powerDrawW: 0, powerGenW: 40, explain: '', source },
    { id: 'battery-80', name: '80 Wh battery', category: 'battery', tier: 'simple', massKg: 0.8, costM: 0.1, powerDrawW: 0, capacityWh: 80, explain: '', source },
    { id: 'obc', name: 'Flight computer', category: 'computer', tier: 'simple', massKg: 0.3, costM: 0.1, powerDrawW: 3, storageMbit: 64000, explain: '', source },
    { id: 'sband', name: 'S-band radio', category: 'comms', tier: 'simple', massKg: 0.4, costM: 0.2, powerDrawW: 6, dataRateKbps: 1000, explain: '', source },
    { id: 'wheels', name: 'Reaction wheels', category: 'attitude', tier: 'simple', massKg: 1, costM: 0.3, powerDrawW: 4, pointingDeg: 0.1, explain: '', source },
  ],
  instruments: [
    { id: 'camera', name: 'Colour camera', kind: 'camera', tier: 'simple', massKg: 1.2, costM: 0.5, powerDrawW: 8, dataPerDayMbit: 3000, scienceValue: 60, needsPointingDeg: 0.5, goodFor: ['earth-watch'], explain: '', source },
    { id: 'spectro', name: 'Haze spectrometer', kind: 'spectrometer', tier: 'advanced', massKg: 2, costM: 1.2, powerDrawW: 10, dataPerDayMbit: 1500, scienceValue: 90, needsPointingDeg: 0.2, goodFor: ['earth-watch'], explain: '', source },
  ],
}
