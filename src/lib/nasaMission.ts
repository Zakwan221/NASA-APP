/**
 * Real NASA data for the three missions, boiled down to what the game shows.
 * Pure functions with no browser or Vite code, so the app (src/lib/nasa.ts) and
 * the snapshot script (scripts/nasa-snapshot.ts) share them.
 *
 *   Earth watch     → NASA EONET: wildfires in Southeast Asia (the haze source) in the last 90 days
 *   Solar storm     → NASA DONKI: coronal mass ejections (CMEs) of the last 30 days
 *   Asteroid scout  → NASA NeoWs: today's closest near-Earth asteroid, the mission target
 */

/** Wildfires in Southeast Asia (bbox: west, north, east, south) over the last 90 days */
export const FIRE_DAYS = 90
export const EONET_FIRES_URL = `https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=all&days=${FIRE_DAYS}&bbox=90,25,130,-12`
export const donkiCmeUrl = (key: string, from: string, to: string) =>
  `https://api.nasa.gov/DONKI/CME?startDate=${from}&endDate=${to}&api_key=${key}`
export const neoFeedUrl = (key: string, date: string) =>
  `https://api.nasa.gov/neo/rest/v1/feed?start_date=${date}&end_date=${date}&api_key=${key}`

/* ---------------- Earth watch: wildfires (EONET) ---------------- */

/** Kuala Lumpur: the Earth watch mission watches haze around Malaysia */
const MALAYSIA = { lat: 3.14, lon: 101.69 }

export interface FireFact {
  title: string
  date: string
  lat: number
  lon: number
  /** Straight-line distance from Kuala Lumpur */
  distanceKm: number
  acres?: number
  link: string
}

export interface FiresSummary {
  /** Wildfires NASA tracked in Southeast Asia in the last FIRE_DAYS days */
  total: number
  /** Fires within 1,500 km of Kuala Lumpur (close enough for haze to drift in) */
  nearMalaysia: number
  nearest: FireFact[]
  newestDate: string | null
}

interface EonetEvent {
  id: string
  title: string
  link: string
  geometry: { date: string; type: string; coordinates: number[] | number[][][]; magnitudeValue?: number | null; magnitudeUnit?: string | null }[]
}

function distanceKm(lat: number, lon: number) {
  const rad = Math.PI / 180
  const dLat = (lat - MALAYSIA.lat) * rad
  const dLon = (lon - MALAYSIA.lon) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(MALAYSIA.lat * rad) * Math.cos(lat * rad) * Math.sin(dLon / 2) ** 2
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(a)))
}

export function summarizeFires(raw: { events?: EonetEvent[] }): FiresSummary {
  const fires: FireFact[] = []
  for (const e of raw.events ?? []) {
    const g = e.geometry.at(-1)
    if (!g || g.type !== 'Point') continue
    const [lon, lat] = g.coordinates as number[]
    fires.push({
      title: e.title.replace(/^Wildfire\s+/i, ''),
      date: g.date,
      lat,
      lon,
      distanceKm: distanceKm(lat, lon),
      acres: g.magnitudeUnit === 'acres' && g.magnitudeValue ? Math.round(g.magnitudeValue) : undefined,
      link: `https://eonet.gsfc.nasa.gov/api/v3/events/${e.id}`,
    })
  }
  fires.sort((a, b) => a.distanceKm - b.distanceKm)
  const newest = fires.map((f) => f.date).sort().at(-1) ?? null
  return {
    total: fires.length,
    nearMalaysia: fires.filter((f) => f.distanceKm <= 1500).length,
    nearest: fires.slice(0, 3),
    newestDate: newest,
  }
}

/* ---------------- Solar storm: CMEs (DONKI) ---------------- */

export interface CmeFact {
  id: string
  time: string
  /** Speed of the cloud leaving the Sun, from NASA's best analysis */
  speedKms: number | null
  link: string
}

export interface StormsSummary {
  from: string
  to: string
  total: number
  latest: CmeFact | null
  fastest: CmeFact | null
}

interface DonkiCme {
  activityID: string
  startTime: string
  link?: string
  cmeAnalyses?: { speed?: number | null; isMostAccurate?: boolean }[] | null
}

export function summarizeStorms(raw: DonkiCme[], from: string, to: string): StormsSummary {
  const cmes: CmeFact[] = (Array.isArray(raw) ? raw : []).map((c) => {
    const analyses = c.cmeAnalyses ?? []
    const best = analyses.find((a) => a.isMostAccurate) ?? analyses[0]
    return {
      id: c.activityID,
      time: c.startTime,
      speedKms: best?.speed ? Math.round(best.speed) : null,
      link: c.link ?? 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
    }
  })
  cmes.sort((a, b) => a.time.localeCompare(b.time))
  const withSpeed = cmes.filter((c) => c.speedKms !== null)
  return {
    from,
    to,
    total: cmes.length,
    latest: cmes.at(-1) ?? null,
    fastest: withSpeed.length ? withSpeed.reduce((a, b) => ((b.speedKms ?? 0) > (a.speedKms ?? 0) ? b : a)) : null,
  }
}

/* ---------------- Asteroid scout: the target (NeoWs) ---------------- */

export interface AsteroidTarget {
  name: string
  date: string
  diameterMeters: number
  missDistanceKm: number
  velocityKmh: number
  hazardous: boolean
  /** NASA JPL page for this asteroid */
  link: string
  /** How many asteroids pass Earth that day */
  passingToday: number
}

interface NeoFeed {
  near_earth_objects: Record<
    string,
    {
      name: string
      nasa_jpl_url?: string
      is_potentially_hazardous_asteroid: boolean
      estimated_diameter: { meters: { estimated_diameter_min: number; estimated_diameter_max: number } }
      close_approach_data: { close_approach_date: string; relative_velocity: { kilometers_per_hour: string }; miss_distance: { kilometers: string } }[]
    }[]
  >
}

/** Today's closest pass is the scout's target */
export function pickAsteroid(raw: NeoFeed): AsteroidTarget | null {
  const all = Object.values(raw.near_earth_objects ?? {}).flat()
  const list = all
    .map((n) => {
      const pass = n.close_approach_data[0]
      const d = n.estimated_diameter.meters
      return {
        name: n.name.replace(/[()]/g, '').trim(),
        date: pass?.close_approach_date ?? '',
        diameterMeters: Math.round((d.estimated_diameter_min + d.estimated_diameter_max) / 2),
        missDistanceKm: Math.round(Number(pass?.miss_distance.kilometers ?? 0)),
        velocityKmh: Math.round(Number(pass?.relative_velocity.kilometers_per_hour ?? 0)),
        hazardous: n.is_potentially_hazardous_asteroid,
        link: n.nasa_jpl_url ?? 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html',
        passingToday: all.length,
      }
    })
    .filter((a) => a.missDistanceKm > 0)
    .sort((a, b) => a.missDistanceKm - b.missDistanceKm)
  return list[0] ?? null
}

/* ---------------- all three ---------------- */

export interface MissionNasaData {
  /** When this data was downloaded from NASA */
  fetchedAt: string
  fires: FiresSummary | null
  storms: StormsSummary | null
  asteroid: AsteroidTarget | null
}
