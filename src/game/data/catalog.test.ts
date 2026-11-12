import { describe, expect, it } from 'vitest'
import { evaluate } from '../engine/evaluate'
import type { MissionDesign } from '../types'
import { INSTRUMENTS, ORBITS, ROCKETS, SCENARIOS, partsIn } from '.'

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

describe('a good Cadet build exists for every mission', () => {
  const simple = (c: Parameters<typeof partsIn>[0]) => partsIn(c).filter((p) => p.tier === 'simple').map((p) => p.id)

  for (const s of SCENARIOS) {
    it(s.title, () => {
      const instrument = INSTRUMENTS.find((i) => i.tier === 'simple' && i.goodFor.includes(s.id))!
      let found = false
      search: for (const orbitId of s.allowedOrbits)
        for (const launchVehicleId of ROCKETS.map((r) => r.id))
          for (const structureId of simple('structure'))
            for (const solarId of simple('power'))
              for (const batteryId of simple('battery'))
                for (const computerId of simple('computer'))
                  for (const attitudeId of simple('attitude'))
                    for (const radioId of simple('comms')) {
                      const d: MissionDesign = {
                        planner: { scenarioId: s.id, difficulty: 'cadet', targetLifetimeMonths: s.limits.cadet.minLifetimeMonths, targetCoverage: 0.5 },
                        engineer: { structureId, solarId, batteryId, computerId, attitudeId },
                        science: { instrumentIds: [instrument.id] },
                        comms: { radioId, orbitId, launchVehicleId },
                      }
                      const ev = evaluate(d)
                      // launchable, and no warning at all about power, comms or mass
                      if (ev.launchReady && !ev.warnings.some((w) => w.blocking || ['power', 'comms', 'mass'].includes(w.resource))) {
                        found = true
                        break search
                      }
                    }
      expect(found).toBe(true)
    })
  }
})
