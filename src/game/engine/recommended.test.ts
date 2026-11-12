import { describe, expect, it } from 'vitest'
import { RECOMMENDED } from '../data/recommended'
import { evaluate } from './evaluate'
import { launchOdds } from './launch'
import { testFlights } from './simulate'

describe('recommended builds', () => {
  for (const rec of RECOMMENDED) {
    it(`${rec.scenarioId}: launches, fits, and wins`, () => {
      const ev = evaluate(rec.design)
      expect(ev.warnings.filter((w) => w.blocking)).toEqual([])
      expect(ev.budgetLeftM).toBeGreaterThan(ev.opsReserveM)
      expect(ev.projectedScience).toBeGreaterThanOrEqual(ev.scenario!.scienceTarget)
      expect(launchOdds(rec.design).chance).toBeGreaterThan(0.95)
      expect(testFlights(rec.design, 20)!.average).toBeGreaterThanOrEqual(85)
    })
  }
})
