/**
 * The solo mission being designed: Design → Launch → Operate → Report → Redesign.
 * Saved in localStorage so a refresh (or the Redesign button) keeps the spacecraft.
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { EMPTY_DESIGN, type Difficulty, type MissionDesign, type OrbitId } from '../game/types'

/** What happened on launch day, decided once per launch */
export interface LaunchResult {
  /** Money lost on launch day (USD M), taken from the operations budget */
  extraCostM: number
  title: string
  text: string
  tone: 'good' | 'bad' | 'fail'
}

interface MissionStore {
  design: MissionDesign
  launch: LaunchResult | null
  setScenario: (id: string) => void
  setDifficulty: (d: Difficulty) => void
  setLifetime: (months: number) => void
  setPart: (slot: keyof MissionDesign['engineer'], id: string) => void
  setRadio: (id: string) => void
  toggleInstrument: (id: string) => void
  setOrbit: (id: OrbitId) => void
  setRocket: (id: string) => void
  setLaunch: (result: LaunchResult | null) => void
  /** Start over with an empty design */
  reset: () => void
}

/** Any change to the design means it has to launch again */
const edit = (design: MissionDesign) => ({ design, launch: null })

export const useMission = create<MissionStore>()(
  persist(
    (set) => ({
      design: EMPTY_DESIGN,
      launch: null,
      setScenario: (id) =>
        set((s) =>
          edit({
            ...s.design,
            planner: { ...s.design.planner, scenarioId: id },
            // Instruments and orbit depend on the mission, so pick them again
            science: { instrumentIds: [] },
            comms: { ...s.design.comms, orbitId: null, launchVehicleId: null },
          }),
        ),
      setDifficulty: (difficulty) => set((s) => edit({ ...s.design, planner: { ...s.design.planner, difficulty } })),
      setLifetime: (months) =>
        set((s) => edit({ ...s.design, planner: { ...s.design.planner, targetLifetimeMonths: months } })),
      setPart: (slot, id) => set((s) => edit({ ...s.design, engineer: { ...s.design.engineer, [slot]: id } })),
      setRadio: (id) => set((s) => edit({ ...s.design, comms: { ...s.design.comms, radioId: id } })),
      toggleInstrument: (id) =>
        set((s) => {
          const ids = s.design.science.instrumentIds
          const instrumentIds = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
          return edit({ ...s.design, science: { instrumentIds } })
        }),
      setOrbit: (orbitId) => set((s) => edit({ ...s.design, comms: { ...s.design.comms, orbitId } })),
      setRocket: (launchVehicleId) => set((s) => edit({ ...s.design, comms: { ...s.design.comms, launchVehicleId } })),
      setLaunch: (launch) => set({ launch }),
      reset: () => set({ design: EMPTY_DESIGN, launch: null }),
    }),
    {
      name: 'orbitly:mission',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
