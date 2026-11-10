import { cached, getJson, isoDay, NASA_KEY } from './cache'

/** NASA NeoWs — Near Earth Object Web Service (data from JPL CNEOS). Needs api.nasa.gov key. */
export const LUNAR_DISTANCE_KM = 384_400

export interface WeekAsteroid {
  id: string
  name: string
  date: string
  diameterM: number // average of NASA's min/max estimate
  speedKms: number
  missKm: number
  missLunar: number // × Earth–Moon distance
  hazardous: boolean
  jplUrl: string
}

interface FeedResponse {
  near_earth_objects: Record<
    string,
    Array<{
      id: string
      name: string
      nasa_jpl_url: string
      is_potentially_hazardous_asteroid: boolean
      estimated_diameter: { meters: { estimated_diameter_min: number; estimated_diameter_max: number } }
      close_approach_data: Array<{
        close_approach_date: string
        relative_velocity: { kilometers_per_second: string }
        miss_distance: { kilometers: string; lunar: string }
      }>
    }>
  >
}

/** Asteroids passing Earth from today to 6 days ahead */
export function getWeekAsteroids() {
  const start = isoDay(0)
  const end = isoDay(6)

  return cached<WeekAsteroid[]>(`neows:${start}`, async () => {
    const data = await getJson<FeedResponse>(
      `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${NASA_KEY}`,
    )
    if (!data) return null

    return Object.values(data.near_earth_objects)
      .flat()
      .map((neo) => {
        const a = neo.close_approach_data[0]
        const d = neo.estimated_diameter.meters
        return {
          id: neo.id,
          name: neo.name.replace(/[()]/g, '').trim(),
          date: a?.close_approach_date ?? start,
          diameterM: Math.round((d.estimated_diameter_min + d.estimated_diameter_max) / 2),
          speedKms: Number(Number(a?.relative_velocity.kilometers_per_second ?? 0).toFixed(1)),
          missKm: Math.round(Number(a?.miss_distance.kilometers ?? 0)),
          missLunar: Number(Number(a?.miss_distance.lunar ?? 0).toFixed(1)),
          hazardous: neo.is_potentially_hazardous_asteroid,
          jplUrl: neo.nasa_jpl_url,
        }
      })
  })
}
