import { BatteryFull, Box, Cpu, Crosshair, Orbit, RadioTower, Rocket, Sun, Telescope, type LucideIcon } from 'lucide-react'
import type { MissionDesign, PartCategory, ResourceKey } from '../../../game/types'

/** The builder's steps, in order: six parts, instruments, then where to fly and on what */

export type Slot = keyof MissionDesign['engineer'] | 'radio'

export interface BuildStep {
  id: string
  title: string
  icon: LucideIcon
  /** One plain sentence: what this is for */
  hint: string
  slot?: Slot
  category?: PartCategory
  /** Which warnings belong on this step */
  resources: (ResourceKey | 'compatibility')[]
}

export const BUILD_STEPS: BuildStep[] = [
  { id: 'frame', title: 'Frame', icon: Box, hint: 'The body. Bigger frames carry more, but weigh more.', slot: 'structureId', category: 'structure', resources: ['mass'] },
  { id: 'solar', title: 'Solar panels', icon: Sun, hint: 'Make power from sunlight.', slot: 'solarId', category: 'power', resources: ['power'] },
  { id: 'battery', title: 'Battery', icon: BatteryFull, hint: 'Keeps things running when Earth blocks the Sun.', slot: 'batteryId', category: 'battery', resources: ['power'] },
  { id: 'computer', title: 'Computer', icon: Cpu, hint: 'Runs the spacecraft and stores your data.', slot: 'computerId', category: 'computer', resources: ['data'] },
  { id: 'attitude', title: 'Pointing', icon: Crosshair, hint: 'Aims the instruments at the target.', slot: 'attitudeId', category: 'attitude', resources: ['compatibility'] },
  { id: 'radio', title: 'Radio', icon: RadioTower, hint: 'Sends your data home to Earth.', slot: 'radio', category: 'comms', resources: ['data', 'comms'] },
  { id: 'instruments', title: 'Instruments', icon: Telescope, hint: 'What does the science. Pick one or more.', resources: ['compatibility', 'power', 'data'] },
  { id: 'orbit', title: 'Orbit', icon: Orbit, hint: 'Where your spacecraft will fly.', resources: ['comms', 'lifetime', 'compatibility'] },
  { id: 'rocket', title: 'Rocket', icon: Rocket, hint: 'What carries it there. It must be strong enough.', resources: ['mass', 'budget'] },
]

/** Has the player made a choice on this step? */
export function stepDone(design: MissionDesign, step: BuildStep): boolean {
  if (step.slot) return Boolean(step.slot === 'radio' ? design.comms.radioId : design.engineer[step.slot])
  if (step.id === 'instruments') return design.science.instrumentIds.length > 0
  if (step.id === 'orbit') return Boolean(design.comms.orbitId)
  return Boolean(design.comms.launchVehicleId)
}
