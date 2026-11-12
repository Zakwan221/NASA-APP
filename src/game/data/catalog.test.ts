import { describe, expect, it } from 'vitest'
import { evaluate } from '../engine/evaluate'
import { testFlights } from '../engine/simulate'
import type { Difficulty, MissionDesign } from '../types'
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

describe('every mission can score well at every difficulty', () => {
  const pick = (diff: Difficulty) => (c: Parameters<typeof partsIn>[0]) =>
    partsIn(c).filter((p) => diff !== 'cadet' || p.tier === 'simple').map((p) => p.id)

  for (const diff of ['cadet', 'engineer', 'director'] as Difficulty[])
    for (const s of SCENARIOS) {
      it(`${s.title} at ${diff}: some build averages 85+`, () => {
        const ids = pick(diff)
        const insts = INSTRUMENTS.filter((i) => i.goodFor.includes(s.id) && (diff !== 'cadet' || i.tier === 'simple')).map((i) => i.id)
        const sets = [...insts.map((i) => [i]), ...insts.flatMap((a, n) => insts.slice(n + 1).map((b) => [a, b]))]
        const months = [s.limits[diff as 'cadet'].minLifetimeMonths, 12, 18]
        let best = 0
        search: for (const orbitId of s.allowedOrbits)
          for (const launchVehicleId of ROCKETS.map((r) => r.id))
            for (const structureId of ids('structure'))
              for (const solarId of ids('power'))
                for (const batteryId of ids('battery'))
                  for (const computerId of ids('computer'))
                    for (const attitudeId of ids('attitude'))
                      for (const radioId of ids('comms'))
                        for (const instrumentIds of sets)
                          for (const targetLifetimeMonths of months) {
                            const d: MissionDesign = {
                              planner: { scenarioId: s.id, difficulty: diff, targetLifetimeMonths, targetCoverage: 0.5 },
                              engineer: { structureId, solarId, batteryId, computerId, attitudeId },
                              science: { instrumentIds },
                              comms: { radioId, orbitId, launchVehicleId },
                            }
                            const ev = evaluate(d)
                            if (!ev.launchReady || ev.warnings.length) continue
                            best = Math.max(best, testFlights(d, 4)?.average ?? 0)
                            if (best >= 85) break search
                          }
        expect(best).toBeGreaterThanOrEqual(85)
      }, 120_000)
    }
})
