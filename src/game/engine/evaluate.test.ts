import { describe, expect, it } from 'vitest'
import { runMonth, startOperate } from '../events/operate'
import { EMPTY_DESIGN, type MissionDesign } from '../types'
import { buildFlight, evaluate } from './evaluate'

/** A sensible Earth-watch CubeSat that should launch with no blocking problems */
const GOOD: MissionDesign = {
  planner: { scenarioId: 'earth-watch', difficulty: 'engineer', targetLifetimeMonths: 12, targetCoverage: 0.5 },
  engineer: {
    structureId: 'frame-12u',
    solarId: 'solar-deploy',
    batteryId: 'battery-80',
    computerId: 'obc',
    attitudeId: 'wheels',
  },
  science: { instrumentIds: ['camera'] },
  comms: { radioId: 'sband', orbitId: 'sso', launchVehicleId: 'rideshare-leo' },
}

const blocking = (d: MissionDesign) => evaluate(d).warnings.filter((w) => w.blocking).map((w) => w.message)

describe('evaluate', () => {
  it('blocks an empty design and explains each missing piece', () => {
    const ev = evaluate(EMPTY_DESIGN)
    expect(ev.designReady).toBe(false)
    expect(ev.launchReady).toBe(false)
    expect(blocking(EMPTY_DESIGN).some((m) => m.includes('Pick a mission'))).toBe(true)
    expect(blocking(EMPTY_DESIGN).some((m) => m.includes('Pick a radio'))).toBe(true)
  })

  it('lets a sensible design launch', () => {
    expect(blocking(GOOD)).toEqual([])
    const ev = evaluate(GOOD)
    expect(ev.launchReady).toBe(true)
    expect(ev.massKg).toBeCloseTo(7.2, 1)
    expect(ev.budgetLeftM).toBeGreaterThan(ev.opsReserveM)
  })

  it('blocks a spacecraft too heavy for its frame', () => {
    const d = { ...GOOD, engineer: { ...GOOD.engineer, structureId: 'frame-3u' } }
    expect(blocking(d).some((m) => m.includes('Too heavy'))).toBe(true)
  })

  it('blocks a spacecraft too heavy for the rocket', () => {
    const d: MissionDesign = {
      ...GOOD,
      engineer: { ...GOOD.engineer, structureId: 'bus-micro', solarId: 'solar-large', batteryId: 'battery-200' },
      science: { instrumentIds: ['camera', 'thermal-ir', 'spectro'] },
    }
    expect(blocking(d).some((m) => m.includes('can only carry'))).toBe(true)
  })

  it('blocks a radio that cannot be heard from the orbit', () => {
    const d: MissionDesign = {
      ...GOOD,
      comms: { radioId: 'sband', orbitId: 'l1', launchVehicleId: 'deep-rideshare' },
    }
    expect(blocking(d).some((m) => m.includes('nobody on Earth would hear it'))).toBe(true)
  })

  it('blocks a rocket that cannot reach the orbit', () => {
    const d: MissionDesign = { ...GOOD, comms: { ...GOOD.comms, orbitId: 'geo' } }
    expect(blocking(d).some((m) => m.includes('can’t reach'))).toBe(true)
  })

  it('blocks going over budget', () => {
    const d: MissionDesign = {
      ...GOOD,
      planner: { ...GOOD.planner, difficulty: 'director', targetLifetimeMonths: 18 },
      comms: { ...GOOD.comms, launchVehicleId: 'small-launcher' },
      science: { instrumentIds: ['camera', 'thermal-ir', 'spectro'] },
    }
    expect(blocking(d).some((m) => m.startsWith('Over budget'))).toBe(true)
  })

  it('warns, without blocking, when power is short or data will be lost', () => {
    const d: MissionDesign = { ...GOOD, science: { instrumentIds: ['camera', 'thermal-ir'] } }
    const ev = evaluate(d)
    expect(ev.launchReady).toBe(true)
    expect(ev.instrumentUptime).toBeLessThan(1)
    expect(ev.warnings.some((w) => w.resource === 'power' && !w.blocking)).toBe(true)
  })

  it('warns when an instrument does not fit the mission', () => {
    const d: MissionDesign = { ...GOOD, science: { instrumentIds: ['camera', 'magnetometer'] } }
    expect(evaluate(d).warnings.some((w) => w.message.includes('isn’t built for this mission'))).toBe(true)
  })

  it('sandbox has no real budget limit', () => {
    const d: MissionDesign = {
      ...GOOD,
      planner: { ...GOOD.planner, difficulty: 'sandbox' },
      comms: { ...GOOD.comms, launchVehicleId: 'medium-launcher' },
    }
    expect(evaluate(d).launchReady).toBe(true)
  })
})

describe('buildFlight', () => {
  it('returns null until the design can launch', () => {
    expect(buildFlight(EMPTY_DESIGN)).toBeNull()
  })

  it('hands Operate a spacecraft that flies and returns science', () => {
    const craft = buildFlight(GOOD)!
    expect(craft.parts).toHaveLength(6)
    expect(craft.budgetLeftM).toBe(evaluate(GOOD).budgetLeftM)

    let state = startOperate(craft, 42)
    for (let i = 0; i < 40 && !state.ended; i++) {
      if (state.pending) state = { ...state, pending: null }
      state = runMonth(craft, state)
    }
    expect(state.ended).not.toBeNull()
    expect(state.scienceReturned).toBeGreaterThan(0)
  })

  it('reduces science for instruments the attitude control cannot aim', () => {
    const d: MissionDesign = { ...GOOD, engineer: { ...GOOD.engineer, attitudeId: 'magnetorquers' } }
    const craft = buildFlight(d)!
    expect(craft.instruments[0].scienceValue).toBeLessThan(60)
  })

  it('takes launch-day costs out of the budget', () => {
    expect(buildFlight(GOOD, 0.3)!.budgetLeftM).toBeCloseTo(evaluate(GOOD).budgetLeftM - 0.3, 2)
  })
})
