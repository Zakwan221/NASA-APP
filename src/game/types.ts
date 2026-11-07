/**
 * Shared contract for the Space Mission Design Game (docs/PLAN.md, section 4).
 *
 * DRAFT by Adaam's side so work can start in parallel. Zakwan owns this file:
 * change it freely, but tell Adaam and Ibad, because
 *   - Ibad fills src/game/data/ with objects of these shapes,
 *   - Zakwan's engine reads them,
 *   - Adaam's mission rooms store MissionDesign as JSON in Supabase.
 *
 * Units: mass kg, power W, cost USD millions (M), data Mbit, lifetime months,
 * altitude km, data rate kbps.
 */

/* ---------------- catalog (Ibad fills src/game/data/) ---------------- */

export type Difficulty = 'cadet' | 'engineer' | 'director' | 'sandbox'

/** Simple parts unlock first; advanced parts appear on Engineer and Director. */
export type Tier = 'simple' | 'advanced'

export type PartCategory = 'structure' | 'power' | 'battery' | 'comms' | 'computer' | 'attitude'

interface CatalogItem {
  id: string
  name: string
  tier: Tier
  massKg: number
  costM: number
  /** One plain-language sentence for the "What is this?" card */
  explain: string
  /** Where the numbers come from, e.g. "NASA SmallSat SOA 2024, ch. 3" */
  source: string
}

export interface Part extends CatalogItem {
  category: PartCategory
  /** Power used while running (W). Solar panels use 0. */
  powerDrawW: number
  /** Power made in sunlight (W). Only solar panels. */
  powerGenW?: number
  /** Stored energy (Wh). Only batteries. */
  capacityWh?: number
  /** Downlink speed (kbps). Only radios. */
  dataRateKbps?: number
  /** Onboard storage (Mbit). Only computers. */
  storageMbit?: number
  /** Pointing accuracy (degrees). Only attitude control. */
  pointingDeg?: number
  /** Max total mass this structure can carry (kg). Only structures. */
  maxLoadKg?: number
}

export interface Instrument extends CatalogItem {
  kind: 'camera' | 'spectrometer' | 'radar' | 'magnetometer' | 'particle' | 'other'
  powerDrawW: number
  /** Data made per day of operation (Mbit) */
  dataPerDayMbit: number
  /** Points of science per day when it can observe its target */
  scienceValue: number
  /** Pointing it needs (degrees); attitude control must be at least this good */
  needsPointingDeg: number
  /** Scenario ids this instrument helps with */
  goodFor: string[]
}

export type OrbitId = 'leo' | 'sso' | 'geo' | 'l1' | 'deep-space'

export interface Orbit {
  id: OrbitId
  name: string
  altitudeKm: number
  /** Share of each orbit spent in Earth's shadow, 0..1 (0 for L1 and deep space) */
  shadowFraction: number
  /** Minutes of ground-station contact per day */
  contactMinPerDay: number
  /** How long a spacecraft can stay before drag or fuel ends it (months) */
  maxLifetimeMonths: number
  /** 0..1, how well it sees each scenario's target */
  coverage: Record<string, number>
  explain: string
  source: string
}

export interface LaunchVehicle {
  id: string
  name: string
  costM: number
  /** Max payload mass (kg) to each orbit it can reach. Missing orbit = can't reach it. */
  capacityKg: Partial<Record<OrbitId, number>>
  /** 0..1 chance of a launch-day problem (used by random events) */
  riskOfIssue: number
  explain: string
  source: string
}

/** The resources the challenge asks us to show on the dashboard */
export type ResourceKey = 'mass' | 'power' | 'budget' | 'data' | 'comms' | 'lifetime'

export interface Scenario {
  id: string // 'earth-watch' | 'solar-storm' | 'asteroid-scout'
  title: string
  objective: string
  /** The 1–2 resources that matter most here, highlighted at the start */
  criticalResources: ResourceKey[]
  /** Limits per difficulty */
  limits: Record<Exclude<Difficulty, 'sandbox'>, { budgetM: number; minLifetimeMonths: number }>
  /** Science points needed for full mission success */
  scienceTarget: number
  allowedOrbits: OrbitId[]
  /** Which NASA API feeds this scenario, and the saved fallback file */
  nasaData: { api: 'EONET' | 'EPIC' | 'DONKI' | 'SDO' | 'NeoWs'; snapshot: string }[]
}

/* ---------------- a mission design (stored in Supabase rooms) ---------------- */

/** The four team roles. Each role edits only its own section of the design. */
export type Role = 'planner' | 'engineer' | 'science' | 'comms'

export interface MissionDesign {
  planner: {
    scenarioId: string | null
    difficulty: Difficulty
    /** Requirements the team commits to */
    targetLifetimeMonths: number
    targetCoverage: number // 0..1
  }
  engineer: {
    structureId: string | null
    solarId: string | null
    batteryId: string | null
    computerId: string | null
    attitudeId: string | null
  }
  science: {
    instrumentIds: string[]
  }
  comms: {
    radioId: string | null
    orbitId: OrbitId | null
    launchVehicleId: string | null
  }
}

export const EMPTY_DESIGN: MissionDesign = {
  planner: { scenarioId: null, difficulty: 'cadet', targetLifetimeMonths: 12, targetCoverage: 0.5 },
  engineer: { structureId: null, solarId: null, batteryId: null, computerId: null, attitudeId: null },
  science: { instrumentIds: [] },
  comms: { radioId: null, orbitId: null, launchVehicleId: null },
}

/* ---------------- engine output (Zakwan) ---------------- */

export interface ResourceStatus {
  key: ResourceKey
  used: number
  available: number
  unit: string
  /** used <= available */
  ok: boolean
}

export interface Warning {
  resource: ResourceKey | 'compatibility'
  /** One sentence that says WHY, e.g. "Camera needs 40 W but panels give 25 W in shadow." */
  message: string
  blocking: boolean
}

export interface ScoreBreakdown {
  missionSuccess: number // of 40
  science: number // of 25
  efficiency: number // of 20
  teamwork: number // of 15 (decision quality in solo)
  total: number // of 100
  /** Plain-language reasons shown on the Report screen */
  reasons: string[]
}
