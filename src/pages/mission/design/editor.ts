/**
 * Who the design screens are editing.
 *
 * Solo: the player's own spacecraft (the zustand store, saved on this phone).
 * Team: the crew's shared spacecraft in a mission room. Each role owns part of
 * the design (Planner: mission, Engineer: parts, Science: instruments,
 * Comms: radio, orbit, rocket) and everyone sees every change live.
 *
 * The Briefing and the 3D Builder only talk to this, so they work the same way
 * in both modes. TeamRoom provides a team editor with <DesignEditorContext.Provider>.
 */

import { createContext, useContext } from 'react'
import type { Difficulty, MissionDesign, OrbitId, Role } from '../../../game/types'
import { useMission } from '../../../store/missionStore'

export interface DesignEditor {
  design: MissionDesign
  setScenario: (id: string) => void
  setDifficulty: (d: Difficulty) => void
  setLifetime: (months: number) => void
  setPart: (slot: keyof MissionDesign['engineer'], id: string) => void
  setRadio: (id: string) => void
  toggleInstrument: (id: string) => void
  setOrbit: (id: OrbitId) => void
  setRocket: (id: string) => void
  /** May this player change that part of the design? Always true in solo. */
  canEdit: (section: Role) => boolean
  /** Team play: who chooses that part, e.g. "Aina (Spacecraft Engineer)". Null in solo. */
  owner: (section: Role) => string | null
  team: boolean
}

export const DesignEditorContext = createContext<DesignEditor | null>(null)

export const ROLE_NAMES: Record<Role, string> = {
  planner: 'Mission Planner',
  engineer: 'Spacecraft Engineer',
  science: 'Science Lead',
  comms: 'Comms & Ops',
}

/** The team editor when inside a mission room, otherwise the solo spacecraft */
export function useDesignEditor(): DesignEditor {
  const team = useContext(DesignEditorContext)
  const solo = useMission()
  if (team) return team
  return {
    design: solo.design,
    setScenario: solo.setScenario,
    setDifficulty: solo.setDifficulty,
    setLifetime: solo.setLifetime,
    setPart: solo.setPart,
    setRadio: solo.setRadio,
    toggleInstrument: solo.toggleInstrument,
    setOrbit: solo.setOrbit,
    setRocket: solo.setRocket,
    canEdit: () => true,
    owner: () => null,
    team: false,
  }
}
