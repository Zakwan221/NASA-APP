import { useEffect, useState } from 'react'
import snapshot from '../../../game/data/nasa-snapshot.json'
import { getMissionNasa } from '../../../lib/nasa'
import type { MissionNasaData } from '../../../lib/nasaMission'

/** The saved copy (npm run nasa:snapshot), used for any part NASA can't send right now */
const SAVED = snapshot as MissionNasaData

export interface MissionNasa {
  data: MissionNasaData
  /** Which parts came live from NASA just now (the rest are the saved copy) */
  live: { fires: boolean; storms: boolean; asteroid: boolean }
  loading: boolean
}

// One download per page load, shared by every screen that shows NASA data
let request: Promise<MissionNasaData> | null = null
let result: MissionNasa | null = null

function merge(live: MissionNasaData): MissionNasa {
  return {
    data: {
      fetchedAt: live.fetchedAt,
      fires: live.fires ?? SAVED.fires,
      storms: live.storms ?? SAVED.storms,
      asteroid: live.asteroid ?? SAVED.asteroid,
    },
    live: { fires: Boolean(live.fires), storms: Boolean(live.storms), asteroid: Boolean(live.asteroid) },
    loading: false,
  }
}

const STARTING: MissionNasa = { data: SAVED, live: { fires: false, storms: false, asteroid: false }, loading: true }

/** Real NASA data for the missions: live when NASA answers, the saved copy otherwise */
export function useMissionNasa(): MissionNasa {
  const [state, setState] = useState<MissionNasa>(() => result ?? STARTING)
  useEffect(() => {
    if (result) return
    request ??= getMissionNasa()
    let cancelled = false
    request
      .then((live) => {
        result = merge(live)
        if (!cancelled) setState(result)
      })
      .catch(() => {
        result = { ...STARTING, loading: false }
        if (!cancelled) setState(result)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

export const SAVED_NASA_DATE = SAVED.fetchedAt
