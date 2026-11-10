import { BatteryFull, Box, ClipboardCheck, Cpu, Crosshair, RadioTower, Sun, Telescope, type LucideIcon } from 'lucide-react'
import type { MissionDesign, PartCategory, ResourceKey } from '../../../game/types'

/** The builder's steps, in order: six parts, instruments, then a review */

export type Slot = keyof MissionDesign['engineer'] | 'radio'

export interface BuildStep {
  id: string
  title: string
  icon: LucideIcon
  hint: string
  slot?: Slot
  category?: PartCategory
  /** Which warnings belong on this step */
  resources: (ResourceKey | 'compatibility')[]
}

export const BUILD_STEPS: BuildStep[] = [
  { id: 'frame', title: 'Frame', icon: Box, hint: 'The body. It decides how much everything can weigh.', slot: 'structureId', category: 'structure', resources: ['mass'] },
  { id: 'solar', title: 'Solar panels', icon: Sun, hint: 'Make power in sunlight. Instruments and radios need it.', slot: 'solarId', category: 'power', resources: ['power'] },
  { id: 'battery', title: 'Battery', icon: BatteryFull, hint: 'Keeps everything running while Earth blocks the Sun.', slot: 'batteryId', category: 'battery', resources: ['power'] },
  { id: 'computer', title: 'Flight computer', icon: Cpu, hint: 'Runs the spacecraft and stores data until it can be sent home.', slot: 'computerId', category: 'computer', resources: ['data'] },
  { id: 'attitude', title: 'Pointing', icon: Crosshair, hint: 'Turns the spacecraft so instruments aim at the target.', slot: 'attitudeId', category: 'attitude', resources: ['compatibility'] },
  { id: 'radio', title: 'Radio', icon: RadioTower, hint: 'Sends data home. Faster radios use more power.', slot: 'radio', category: 'comms', resources: ['data', 'comms'] },
  { id: 'instruments', title: 'Instruments', icon: Telescope, hint: 'The reason for the mission. More science, but more mass, power, money and data.', resources: ['compatibility', 'power', 'data', 'budget', 'mass'] },
  { id: 'review', title: 'Review', icon: ClipboardCheck, hint: 'Check the dashboard. You can launch with problems, but they will show up in flight.', resources: [] },
]
