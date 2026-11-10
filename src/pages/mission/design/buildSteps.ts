import type { MissionDesign, PartCategory, ResourceKey } from '../../../game/types'

/** The builder's steps, in order: six parts, instruments, then a review */

export type Slot = keyof MissionDesign['engineer'] | 'radio'

export interface BuildStep {
  id: string
  title: string
  icon: string
  hint: string
  slot?: Slot
  category?: PartCategory
  /** Which warnings belong on this step */
  resources: (ResourceKey | 'compatibility')[]
}

export const BUILD_STEPS: BuildStep[] = [
  { id: 'frame', title: 'Frame', icon: '📦', hint: 'The body. It decides how much everything can weigh.', slot: 'structureId', category: 'structure', resources: ['mass'] },
  { id: 'solar', title: 'Solar panels', icon: '☀️', hint: 'Make power in sunlight. Instruments and radios need it.', slot: 'solarId', category: 'power', resources: ['power'] },
  { id: 'battery', title: 'Battery', icon: '🔋', hint: 'Keeps everything running while Earth blocks the Sun.', slot: 'batteryId', category: 'battery', resources: ['power'] },
  { id: 'computer', title: 'Flight computer', icon: '🖥️', hint: 'Runs the spacecraft and stores data until it can be sent home.', slot: 'computerId', category: 'computer', resources: ['data'] },
  { id: 'attitude', title: 'Pointing', icon: '🎯', hint: 'Turns the spacecraft so instruments aim at the target.', slot: 'attitudeId', category: 'attitude', resources: ['compatibility'] },
  { id: 'radio', title: 'Radio', icon: '📡', hint: 'Sends data home. Faster radios use more power.', slot: 'radio', category: 'comms', resources: ['data', 'comms'] },
  { id: 'instruments', title: 'Instruments', icon: '🔭', hint: 'The reason for the mission. More science, but more mass, power, money and data.', resources: ['compatibility', 'power', 'data', 'budget', 'mass'] },
  { id: 'review', title: 'Review', icon: '✅', hint: 'Check the dashboard. Fix anything marked “Must fix”, then launch.', resources: [] },
]
