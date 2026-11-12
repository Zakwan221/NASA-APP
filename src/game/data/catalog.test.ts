import { describe, expect, it } from 'vitest'
import { INSTRUMENTS, ORBITS, SCENARIOS, partsIn } from '.'

/** Cadet only shows simple parts, so every mission must still be possible with them */
describe('catalog at Cadet difficulty', () => {
  const radios = partsIn('comms').filter((p) => p.tier === 'simple')

  for (const s of SCENARIOS) {
    it(`${s.title}: a Cadet radio reaches every allowed orbit`, () => {
      for (const id of s.allowedOrbits) {
        const orbit = ORBITS.find((o) => o.id === id)!
        expect(radios.some((r) => (r.maxRangeKm ?? 0) >= orbit.altitudeKm), `${orbit.name}`).toBe(true)
      }
    })

    it(`${s.title}: has a Cadet instrument built for it`, () => {
      expect(INSTRUMENTS.some((i) => i.tier === 'simple' && i.goodFor.includes(s.id))).toBe(true)
    })
  }
})
