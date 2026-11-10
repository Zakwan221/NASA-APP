/**
 * STARTER launch options (Ibad owns this folder: check numbers and sources).
 * Small satellites usually buy a slot on someone else's rocket (rideshare),
 * or pay for a whole small rocket to choose their own orbit.
 * failureRate: rough share of failed launches for that class of rocket
 * (big proven rockets about 1–2%, newer small launchers about 6%).
 */

import type { LaunchVehicle } from '../types'

const SOA = 'NASA Small Spacecraft Technology State of the Art (2024), ch. 10 Launch'

export const ROCKETS: LaunchVehicle[] = [
  {
    id: 'rideshare-leo',
    name: 'Rideshare slot (low orbit)',
    costM: 0.8,
    capacityKg: { leo: 25, sso: 25 },
    riskOfIssue: 0.05,
    failureRate: 0.01,
    explain: 'Share a big rocket with dozens of other satellites. Cheap, but only small spacecraft and only low orbits.',
    source: SOA,
  },
  {
    id: 'small-launcher',
    name: 'Dedicated small launcher',
    costM: 7.5,
    capacityKg: { leo: 300, sso: 200 },
    riskOfIssue: 0.08,
    failureRate: 0.06,
    explain: 'A whole small rocket just for you (like Rocket Lab Electron): heavier spacecraft, but it costs much more.',
    source: SOA,
  },
  {
    id: 'rideshare-geo',
    name: 'GEO rideshare slot',
    costM: 3,
    capacityKg: { geo: 30 },
    riskOfIssue: 0.06,
    failureRate: 0.02,
    explain: 'A spare slot on a rocket carrying a big communications satellite out to geostationary orbit.',
    source: SOA,
  },
  {
    id: 'deep-rideshare',
    name: 'Deep-space rideshare',
    costM: 4,
    capacityKg: { l1: 30, 'deep-space': 25 },
    riskOfIssue: 0.1,
    failureRate: 0.03,
    explain: 'Ride along with a big NASA mission leaving Earth, like the 10 CubeSats on Artemis I.',
    source: `${SOA}; NASA Artemis I secondary payloads`,
  },
  {
    id: 'medium-launcher',
    name: 'Medium rocket',
    costM: 18,
    capacityKg: { leo: 2_000, sso: 1_500, geo: 300, l1: 200, 'deep-space': 150 },
    riskOfIssue: 0.03,
    failureRate: 0.02,
    explain: 'Reaches every orbit with lots of spare room, but costs more than most small missions can afford.',
    source: SOA,
  },
]
