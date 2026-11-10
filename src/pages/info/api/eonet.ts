import { cached, distanceKm, getJson, KUALA_LUMPUR } from './cache'

/** NASA EONET — Earth Observatory Natural Event Tracker. No API key needed. */
const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=60'

export interface NaturalEvent {
  id: string
  title: string
  categoryId: string
  categoryTitle: string
  date: string // latest observation
  lat: number
  lon: number
  track: [number, number][] // [lon, lat] history (storms move)
  magnitude?: string
  sourceUrl?: string
  kmFromKL: number
}

interface EonetResponse {
  events: Array<{
    id: string
    title: string
    categories: Array<{ id: string; title: string }>
    sources: Array<{ id: string; url: string }>
    geometry: Array<{
      date: string
      type: string
      coordinates: unknown
      magnitudeValue?: number | null
      magnitudeUnit?: string | null
    }>
  }>
}

/** Point → [lon, lat]; Polygon → its first vertex */
function firstPoint(coords: unknown): [number, number] | null {
  let c = coords
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0]
  if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') return [c[0], c[1]]
  return null
}

export function getOpenEvents() {
  return cached<NaturalEvent[]>('eonet', async () => {
    const data = await getJson<EonetResponse>(EONET_URL)
    if (!data) return null

    const events: NaturalEvent[] = []
    for (const e of data.events) {
      const track = e.geometry.map((g) => firstPoint(g.coordinates)).filter((p): p is [number, number] => p !== null)
      const last = e.geometry[e.geometry.length - 1]
      const point = track[track.length - 1]
      if (!last || !point) continue

      const [lon, lat] = point
      events.push({
        id: e.id,
        title: e.title,
        categoryId: e.categories[0]?.id ?? 'other',
        categoryTitle: e.categories[0]?.title ?? 'Other',
        date: last.date,
        lat,
        lon,
        track,
        magnitude: last.magnitudeValue != null ? `${last.magnitudeValue} ${last.magnitudeUnit ?? ''}`.trim() : undefined,
        sourceUrl: e.sources[0]?.url,
        kmFromKL: Math.round(distanceKm(KUALA_LUMPUR, { lat, lon })),
      })
    }
    return events.sort((a, b) => b.date.localeCompare(a.date))
  })
}
