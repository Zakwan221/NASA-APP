import { describe, expect, it } from 'vitest'
import { orbitById, rocketById } from '../data'
import type { MissionDesign } from '../types'
import { failureChance, launchRisk, missionOutlook, rollLaunch } from './launch'

const rocket = rocketById('small-launcher')!
const orbit = orbitById('sso')!

const GOOD: MissionDesign = {
  planner: { scenarioId: 'earth-watch', difficulty: 'engineer', targetLifetimeMonths: 12, targetCoverage: 0.5 },
  engineer: { structureId: 'frame-12u', solarId: 'solar-deploy', batteryId: 'battery-80', computerId: 'obc', attitudeId: 'wheels' },
  science: { instrumentIds: ['camera', 'spectro'] },
  comms: { radioId: 'sband', orbitId: 'sso', launchVehicleId: 'rideshare-leo' },
}

describe('rollLaunch', () => {
  it('goes perfectly when the roll is high', () => {
    const out = rollLaunch(rocket, orbit, 'engineer', 0.99, 0)
    expect(out.tone).toBe('good')
    expect(out.extraCostM).toBe(0)
  })

  it('loses the spacecraft when the roll is below the failure rate', () => {
    const out = rollLaunch(rocket, orbit, 'engineer', 0, 0)
    expect(out.tone).toBe('fail')
    expect(out.text).toContain('lost')
  })

  it('costs money for a problem, but still reaches orbit', () => {
    const roll = failureChance(rocket, 'engineer') + 0.001
    const out = rollLaunch(rocket, orbit, 'engineer', roll, 0.99)
    expect(out.tone).toBe('bad')
    expect(out.extraCostM).toBeGreaterThan(0)
    expect(out.text).toContain(orbit.name)
  })

  it('never fails on Cadet and is riskier on Director', () => {
    expect(rollLaunch(rocket, orbit, 'cadet', 0, 0).tone).not.toBe('fail')
    expect(launchRisk(rocket, 'director')).toBeGreaterThan(launchRisk(rocket, 'cadet'))
    expect(failureChance(rocket, 'director')).toBeGreaterThan(failureChance(rocket, 'engineer'))
  })
})

describe('missionOutlook', () => {
  it('flags a design whose money runs out', () => {
    const d: MissionDesign = { ...GOOD, planner: { ...GOOD.planner, targetLifetimeMonths: 60 }, comms: { ...GOOD.comms, launchVehicleId: 'small-launcher' } }
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
