import type { Instrument, LaunchVehicle, Orbit, OrbitId, Part, PartCategory, Scenario } from '../types'
import { INSTRUMENTS } from './instruments'
import { ORBITS } from './orbits'
import { PARTS } from './parts'
import { ROCKETS } from './rockets'
import { SCENARIOS } from './scenarios'

export { INSTRUMENTS, ORBITS, PARTS, ROCKETS, SCENARIOS }

export const partById = (id: string | null): Part | undefined => PARTS.find((p) => p.id === id)
export const instrumentById = (id: string): Instrument | undefined => INSTRUMENTS.find((i) => i.id === id)
export const orbitById = (id: OrbitId | null): Orbit | undefined => ORBITS.find((o) => o.id === id)
export const rocketById = (id: string | null): LaunchVehicle | undefined => ROCKETS.find((r) => r.id === id)
export const scenarioById = (id: string | null): Scenario | undefined => SCENARIOS.find((s) => s.id === id)
export const partsIn = (category: PartCategory): Part[] => PARTS.filter((p) => p.category === category)
