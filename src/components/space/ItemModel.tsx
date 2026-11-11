/**
 * One item of the game in 3D: a part (placed as it sits on a spacecraft), an
 * instrument (tipped so its lens faces you) or a whole rocket. Used for the
 * card pictures and the Items page viewer.
 */

import { partById } from '../../game/data'
import { EMPTY_DESIGN, type MissionDesign, type PartCategory } from '../../game/types'
import CraftModel, { type CraftPart } from './CraftModel'
import { RocketModel } from './Rocket'
import { ROCKET_LOOK } from './rocketLook'

export type ItemKind = 'part' | 'instrument' | 'rocket'

const SLOT: Record<PartCategory, { part: CraftPart; set: (d: MissionDesign, id: string) => MissionDesign }> = {
  structure: { part: 'frame', set: (d, id) => ({ ...d, engineer: { ...d.engineer, structureId: id } }) },
  power: { part: 'solar', set: (d, id) => ({ ...d, engineer: { ...d.engineer, solarId: id } }) },
  battery: { part: 'battery', set: (d, id) => ({ ...d, engineer: { ...d.engineer, batteryId: id } }) },
  computer: { part: 'computer', set: (d, id) => ({ ...d, engineer: { ...d.engineer, computerId: id } }) },
  attitude: { part: 'attitude', set: (d, id) => ({ ...d, engineer: { ...d.engineer, attitudeId: id } }) },
  comms: { part: 'radio', set: (d, id) => ({ ...d, comms: { ...d.comms, radioId: id } }) },
}

/** Parts are placed on a 12U frame (sizes depend on the frame), but only the part is drawn */
const BASE: MissionDesign = { ...EMPTY_DESIGN, engineer: { ...EMPTY_DESIGN.engineer, structureId: 'frame-12u' } }

export default function ItemModel({ kind, id }: { kind: ItemKind; id: string }) {
  if (kind === 'rocket') return <RocketModel look={ROCKET_LOOK[id] ?? ROCKET_LOOK['rideshare-leo']} />
  if (kind === 'instrument') {
    // Instruments look down at Earth; tip them up so the lens faces the picture
    return (
      <group rotation={[-Math.PI * 0.62, 0, 0]}>
        <CraftModel design={{ ...BASE, science: { instrumentIds: [id] } }} only="instruments" instant />
      </group>
    )
  }
  const part = partById(id)
  if (!part) return null
  const slot = SLOT[part.category]
  return <CraftModel design={slot.set(BASE, id)} only={slot.part} instant />
}

