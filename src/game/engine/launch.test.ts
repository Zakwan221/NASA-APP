import { describe, expect, it } from 'vitest'
import { rocketById } from '../data'
import type { MissionDesign } from '../types'
import { failureChance, holdLabel, launchOdds, launchRisk, missionOutlook, rollLaunch } from './launch'

const GOOD: MissionDesign = {
  planner: { scenarioId: 'earth-watch', difficulty: 'engineer', targetLifetimeMonths: 12, targetCoverage: 0.5 },
  engineer: { structureId: 'frame-12u', solarId: 'solar-deploy', batteryId: 'battery-80', computerId: 'obc', attitudeId: 'wheels' },
  science: { instrumentIds: ['camera', 'spectro'] },
  comms: { radioId: 'sband', orbitId: 'sso', launchVehicleId: 'rideshare-leo' },
}
const withComms = (comms: Partial<MissionDesign['comms']>): MissionDesign => ({ ...GOOD, comms: { ...GOOD.comms, ...comms } })
/** A 27 kg microsat on the 25 kg rideshare slot */
const HEAVY: MissionDesign = {
  ...GOOD,
  engineer: { ...GOOD.engineer, structureId: 'bus-micro', solarId: 'solar-large', batteryId: 'battery-200' },
  science: { instrumentIds: ['camera', 'thermal-ir', 'spectro'] },
}

describe('launchOdds', () => {
  it('is high for a good design on a reliable rocket', () => {
    const odds = launchOdds(GOOD)
    expect(odds.chance).toBeGreaterThan(0.95)
    expect(odds.roughness).toBeLessThan(0.1)
    expect(odds.factors.map((f) => f.label)).toEqual(['Rocket reliability', 'Weight', 'Radio'])
  })

  it('drops when the spacecraft is too heavy, and the ride gets rougher', () => {
    const odds = launchOdds(HEAVY)
    expect(odds.chance).toBeLessThan(0.9)
    expect(odds.roughness).toBeGreaterThan(launchOdds(GOOD).roughness)
  })

  it('is zero when the radio cannot be heard or the rocket cannot reach the orbit', () => {
    expect(launchOdds(withComms({ orbitId: 'l1', launchVehicleId: 'deep-rideshare' })).chance).toBe(0)
    expect(launchOdds(withComms({ orbitId: 'geo' })).chance).toBe(0)
  })
})

describe('rollLaunch', () => {
  it('goes perfectly when the roll is high', () => {
    const out = rollLaunch(GOOD, 0.99, 0)
    expect(out.kind).toBe('perfect')
    expect(out.tone).toBe('good')
    expect(out.extraCostM).toBe(0)
  })

  it('explodes when the roll lands in the rocket failure band', () => {
    const out = rollLaunch(withComms({ launchVehicleId: 'small-launcher' }), 0, 0)
    expect(out.kind).toBe('explode')
    expect(out.tone).toBe('fail')
  })

  it('a too-heavy spacecraft can fall back', () => {
    const out = rollLaunch(HEAVY, 0, 0)
    expect(out.kind).toBe('underpowered')
    expect(out.text).toContain('more than')
  })

  it('a rocket that cannot reach the orbit leaves it in the wrong orbit', () => {
    expect(rollLaunch(withComms({ orbitId: 'geo' }), 0.99, 0).kind).toBe('wrong-orbit')
  })

  it('a radio that cannot be heard loses the signal after a good launch', () => {
    expect(rollLaunch(withComms({ orbitId: 'l1', launchVehicleId: 'deep-rideshare' }), 0.99, 0).kind).toBe('lost-signal')
  })

  it('a countdown hold costs money but still reaches orbit', () => {
    const d = withComms({ launchVehicleId: 'small-launcher' })
    const rocket = rocketById('small-launcher')!
    const roll = failureChance(rocket, 'engineer') + 0.001
    const out = rollLaunch(d, roll, 0.99)
    expect(out.tone).toBe('bad')
    expect(out.extraCostM).toBeGreaterThan(0)
    expect(holdLabel(out.kind)).toContain('HOLD')
  })

  it('never explodes on Cadet and is riskier on Director', () => {
    const rocket = rocketById('small-launcher')!
    const cadet: MissionDesign = { ...withComms({ launchVehicleId: 'small-launcher' }), planner: { ...GOOD.planner, difficulty: 'cadet' } }
    expect(rollLaunch(cadet, 0, 0).kind).not.toBe('explode')
    expect(launchRisk(rocket, 'director')).toBeGreaterThan(launchRisk(rocket, 'cadet'))
    expect(failureChance(rocket, 'director')).toBeGreaterThan(failureChance(rocket, 'engineer'))
  })
})

describe('missionOutlook', () => {
  it('flags a design whose money runs out', () => {
    const d: MissionDesign = { ...withComms({ launchVehicleId: 'small-launcher' }), planner: { ...GOOD.planner, targetLifetimeMonths: 60 } }
    const out = missionOutlook(d)
    expect(out.verdict).toBe('unlikely')
    expect(out.checks[0].ok).toBe(false)
  })

  it('explains every check in words', () => {
    const out = missionOutlook(GOOD)
    expect(out.checks).toHaveLength(5)
    expect(out.checks.every((c) => c.text.length > 10)).toBe(true)
  })
})
