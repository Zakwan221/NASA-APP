/**
 * Rebuild the Operate state from the room's seed and moves.
 * Every phone runs this on the same input, so every phone shows the same mission.
 * A move that no longer fits (e.g. a late vote for an event that was already
 * decided) is skipped, the same way on every phone.
 */

import {
  chooseEventOption,
  runMonth,
  startOperate,
  toggleInstrument,
  type FlightSpacecraft,
  type OperateState,
} from '../game/events/operate'
import type { MissionOp } from './missionApi'

export function replayOps(craft: FlightSpacecraft, seed: number, ops: MissionOp[]): OperateState {
  let state = startOperate(craft, seed)
  for (const op of [...ops].sort((a, b) => a.id - b.id)) {
    if (state.ended) break
    const p = op.payload
    if (op.kind === 'toggle' && p.instrumentId) {
      state = toggleInstrument(state, p.instrumentId, Boolean(p.on))
    } else if (op.kind === 'choice' && state.pending && p.month === state.month + 1 && typeof p.choice === 'number') {
      state = chooseEventOption(craft, state, p.choice)
    } else if (op.kind === 'fly' && !state.pending && p.month === state.month + 1) {
      state = runMonth(craft, state)
    }
  }
  return state
}
