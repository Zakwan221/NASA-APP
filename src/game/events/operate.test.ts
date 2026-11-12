import { describe, expect, it } from 'vitest'
import { replayOps } from '../../multiplayer/replay'
import type { MissionOp } from '../../multiplayer/missionApi'
import { buildFlight } from '../engine/evaluate'
import type { MissionDesign } from '../types'
import { chooseEventOption, flyMonth, runMonth, setFocus, startOperate, type OperateState } from './operate'

const GOOD: MissionDesign = {
  planner: { scenarioId: 'earth-watch', difficulty: 'engineer', targetLifetimeMonths: 12, targetCoverage: 0.5 },
  engineer: { structureId: 'frame-12u', solarId: 'solar-deploy', batteryId: 'battery-80', computerId: 'obc', attitudeId: 'wheels' },
  science: { instrumentIds: ['camera'] },
  comms: { radioId: 'sband', orbitId: 'sso', launchVehicleId: 'rideshare-leo' },
}
const craft = buildFlight(GOOD)!

/** First seed whose mission starts with no surprise, so one month compares cleanly */
function calmStart(): OperateState {
  for (let seed = 1; seed < 500; seed++) {
    const s = startOperate(craft, seed)
    if (!s.pending) return s
  }
  throw new Error('no calm seed')
}

describe('month plan', () => {
  it('push science brings more science but wears the battery and health', () => {
    const start = calmStart()
    const steady = runMonth(craft, start)
    const push = runMonth(craft, setFocus(start, 'push'))
    // collected science (some may wait on board until the radio can send it)
    expect(push.scienceReturned + push.scienceStored).toBeGreaterThan(steady.scienceReturned + steady.scienceStored)
    expect(push.batteryFactor).toBeLessThan(steady.batteryFactor)
    expect(push.health).toBeLessThan(steady.health)
  })

  it('look after it brings less science but repairs health', () => {
    const start = { ...calmStart(), health: 80 }
    const care = runMonth(craft, setFocus(start, 'care'))
    const steady = runMonth(craft, start)
    expect(care.scienceReturned).toBeLessThan(steady.scienceReturned)
    expect(care.health).toBe(85)
  })
})

describe('surprises', () => {
  it('waits for the player to answer before the next month', () => {
    let s = startOperate(craft, 3)
    for (let i = 0; i < 40 && !s.pending && !s.ended; i++) s = runMonth(craft, s)
    expect(s.pending).not.toBeNull()
    expect(() => runMonth(craft, s)).toThrow()
    const answered = chooseEventOption(craft, s, 1)
    expect(answered.pending).toBeNull()
    expect(answered.log.at(-1)?.decision).toBe(true)
  })

  it('team replay follows the crew choice and the month plan', () => {
    let s = startOperate(craft, 3)
    const ops: MissionOp[] = []
    let id = 1
    const op = (kind: MissionOp['kind'], payload: MissionOp['payload']) => ops.push({ id: id++, attempt: 1, kind, payload, by: 'u' })
    for (let i = 0; i < 40 && !s.ended; i++) {
      if (s.pending) {
        op('choice', { month: s.month + 1, choice: 1 })
        s = chooseEventOption(craft, s, 1)
        continue
      }
      op('fly', { month: s.month + 1, focus: 'push' })
      s = runMonth(craft, setFocus(s, 'push'))
    }
    const replayed = replayOps(craft, 3, ops)
    expect(replayed.scienceReturned).toBe(s.scienceReturned)
    expect(replayed.log).toEqual(s.log)
  })

  it('old team moves without choices still fly like before', () => {
    let s = startOperate(craft, 9)
    const ops: MissionOp[] = []
    for (let i = 0; i < 40 && !s.ended; i++) {
      ops.push({ id: i + 1, attempt: 1, kind: 'fly', payload: { month: s.month + 1 }, by: 'u' })
      s = flyMonth(craft, s)
    }
    expect(replayOps(craft, 9, ops).ended).not.toBeNull()
  })
})
