import { describe, expect, it } from 'vitest'
import { orbitById, rocketById } from '../data'
import { launchRisk, rollLaunch } from './launch'

const rocket = rocketById('rideshare-leo')!
const orbit = orbitById('sso')!

describe('rollLaunch', () => {
  it('goes perfectly when the roll is above the risk', () => {
    const out = rollLaunch(rocket, orbit, 'engineer', 0.99, 0)
    expect(out.tone).toBe('good')
    expect(out.extraCostM).toBe(0)
  })

  it('costs money when something goes wrong, but still reaches orbit', () => {
    const out = rollLaunch(rocket, orbit, 'engineer', 0, 0.99)
    expect(out.tone).toBe('bad')
    expect(out.extraCostM).toBeGreaterThan(0)
    expect(out.text).toContain(orbit.name)
  })

  it('is riskier on Director than on Cadet', () => {
    expect(launchRisk(rocket, 'director')).toBeGreaterThan(launchRisk(rocket, 'cadet'))
  })
})
