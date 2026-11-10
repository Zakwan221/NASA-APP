import { cached, getJson, isoDay, NASA_KEY } from './cache'

/** NASA DONKI — Space Weather Database (CCMC, NASA Goddard). Needs api.nasa.gov key. */
const BASE = 'https://api.nasa.gov/DONKI'

export interface Flare {
  id: string
  classType: string // e.g. "M1.2"
  peakTime: string
  region?: number
  link: string
}

export interface Cme {
  time: string
  speed: number // km/s
  link: string
}

export interface Storm {
  id: string
  startTime: string
  maxKp: number
  link: string
}

export interface SpaceWeather {
  from: string
  to: string
  flares: Flare[]
  cmes: Cme[]
  storms: Storm[]
}

interface FlrResponse {
  flrID: string
  peakTime: string
  classType: string
  activeRegionNum: number | null
  link: string
}
interface CmeResponse {
  time21_5: string
  speed: number | null
  link: string
}
interface GstResponse {
  gstID: string
  startTime: string
  allKpIndex: Array<{ kpIndex: number }>
  link: string
}

export function getSpaceWeather() {
  const from = isoDay(-30)
  const to = isoDay(0)
  const q = `startDate=${from}&endDate=${to}&api_key=${NASA_KEY}`

  return cached<SpaceWeather>(`donki:${to}`, async () => {
    const [flr, cme, gst] = await Promise.all([
      getJson<FlrResponse[]>(`${BASE}/FLR?${q}`),
      getJson<CmeResponse[]>(`${BASE}/CMEAnalysis?${q}&mostAccurateOnly=true`),
      getJson<GstResponse[]>(`${BASE}/GST?${q}`),
    ])
    // Flares are the core of the tab — fail only if that call failed
    if (!flr) return null

    return {
      from,
      to,
      flares: flr
        .filter((f) => f.classType)
        .map((f) => ({
          id: f.flrID,
          classType: f.classType,
          peakTime: f.peakTime,
          region: f.activeRegionNum ?? undefined,
          link: f.link,
        })),
      cmes: (cme ?? [])
        .filter((c) => c.speed)
        .map((c) => ({ time: c.time21_5, speed: c.speed as number, link: c.link })),
      storms: (gst ?? []).map((g) => ({
        id: g.gstID,
        startTime: g.startTime,
        maxKp: Math.max(0, ...g.allKpIndex.map((k) => k.kpIndex)),
        link: g.link,
      })),
    }
  })
}
