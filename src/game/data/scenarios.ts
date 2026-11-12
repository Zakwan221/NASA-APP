/**
 * STARTER scenarios (Ibad owns this folder). Science targets are tuned so a
 * sensible design meets the objective and a great one gets full points.
 */

import type { Scenario } from '../types'

export const SCENARIOS: Scenario[] = [
  {
    id: 'earth-watch',
    title: 'Earth watch: haze and wildfires',
    objective: 'Watch haze and wildfires around Malaysia, so people can be warned before the air turns unhealthy.',
    criticalResources: ['power', 'data'],
    limits: {
      cadet: { budgetM: 20, minLifetimeMonths: 6 },
      engineer: { budgetM: 15, minLifetimeMonths: 12 },
      director: { budgetM: 10, minLifetimeMonths: 18 },
    },
    scienceTarget: 30_000,
    allowedOrbits: ['leo', 'sso', 'geo', 'l1'],
    nasaData: [
      { api: 'EONET', snapshot: 'eonet-fires.json' },
      { api: 'EPIC', snapshot: 'epic-latest.json' },
    ],
  },
  {
    id: 'solar-storm',
    title: 'Solar storm watch',
    objective: 'Spot storms leaving the Sun and warn Earth before they hit power grids and satellites.',
    criticalResources: ['power', 'comms'],
    limits: {
      cadet: { budgetM: 20, minLifetimeMonths: 6 },
      engineer: { budgetM: 15, minLifetimeMonths: 12 },
      director: { budgetM: 12, minLifetimeMonths: 18 },
    },
    scienceTarget: 40_000,
    allowedOrbits: ['sso', 'geo', 'l1'],
    nasaData: [
      { api: 'DONKI', snapshot: 'donki-cme.json' },
      { api: 'SDO', snapshot: 'sdo-latest.json' },
    ],
  },
  {
    id: 'asteroid-scout',
    title: 'Asteroid scout',
    objective: 'Fly past a near-Earth asteroid and find out what it is made of.',
    criticalResources: ['mass', 'comms'],
    limits: {
      cadet: { budgetM: 25, minLifetimeMonths: 6 },
      engineer: { budgetM: 20, minLifetimeMonths: 9 },
      director: { budgetM: 15, minLifetimeMonths: 12 },
    },
    scienceTarget: 35_000,
    allowedOrbits: ['deep-space'],
    nasaData: [{ api: 'NeoWs', snapshot: 'neows-feed.json' }],
  },
]
