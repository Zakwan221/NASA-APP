/**
 * STARTER orbits (Ibad owns this folder: check numbers and sources).
 * `altitudeKm` is the distance from Earth, which is what the radio must reach.
 */

import type { Orbit } from '../types'

export const ORBITS: Orbit[] = [
  {
    id: 'leo',
    name: 'Low Earth orbit',
    altitudeKm: 400,
    shadowFraction: 0.38,
    contactMinPerDay: 30,
    maxLifetimeMonths: 24,
    coverage: { 'earth-watch': 0.7, 'solar-storm': 0.3, 'asteroid-scout': 0 },
    explain:
      'Close to Earth like the Space Station: sharp pictures and cheap to reach, but air drag pulls you down within about 2 years.',
    source: 'NASA Catalog of Earth Satellite Orbits (Earth Observatory)',
  },
  {
    id: 'sso',
    name: 'Sun-synchronous orbit',
    altitudeKm: 550,
    shadowFraction: 0.35,
    contactMinPerDay: 40,
    maxLifetimeMonths: 60,
    coverage: { 'earth-watch': 0.9, 'solar-storm': 0.4, 'asteroid-scout': 0 },
    explain:
      'Passes over every place at the same local time each day, which is great for comparing images of the same area.',
    source: 'NASA Catalog of Earth Satellite Orbits (Earth Observatory)',
  },
  {
    id: 'geo',
    name: 'Geostationary orbit',
    altitudeKm: 35_786,
    shadowFraction: 0.01,
    contactMinPerDay: 1_440,
    maxLifetimeMonths: 180,
    coverage: { 'earth-watch': 0.6, 'solar-storm': 0.5, 'asteroid-scout': 0 },
    explain:
      'Turns with Earth, so it watches the same half of the planet all day and is always in contact, but it is 90× further away than low orbit.',
    source: 'NASA Catalog of Earth Satellite Orbits (Earth Observatory)',
  },
  {
    id: 'l1',
    name: 'Sun–Earth L1 point',
    altitudeKm: 1_500_000,
    shadowFraction: 0,
    contactMinPerDay: 480,
    maxLifetimeMonths: 120,
    coverage: { 'earth-watch': 0.4, 'solar-storm': 1, 'asteroid-scout': 0.2 },
    explain:
      'A balance point between Earth and Sun where NASA’s DSCOVR and SOHO sit. Always in sunlight, and sees solar storms about an hour before they hit Earth.',
    source: 'NASA DSCOVR mission (EPIC camera) and SOHO',
  },
  {
    id: 'deep-space',
    name: 'Deep space (asteroid flyby)',
    altitudeKm: 20_000_000,
    shadowFraction: 0,
    contactMinPerDay: 120,
    maxLifetimeMonths: 36,
    coverage: { 'earth-watch': 0, 'solar-storm': 0.3, 'asteroid-scout': 1 },
    explain:
      'Leaves Earth to fly past a near-Earth asteroid. Only big dishes on Earth can hear you, a few hours a day.',
    source: 'NASA NeoWs; Deep Space Network',
  },
]
