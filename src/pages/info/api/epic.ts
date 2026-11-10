import { cached, getJson } from './cache'

/** NASA EPIC — Earth Polychromatic Imaging Camera on DSCOVR. No API key needed. */
const EPIC_BASE = 'https://epic.gsfc.nasa.gov'

export interface EpicImage {
  id: string
  date: string // ISO, UTC
  imageUrl: string
  lat: number // point on Earth facing the camera
  lon: number
  distanceKm: number // DSCOVR → Earth
}

interface EpicResponse {
  identifier: string
  image: string
  date: string // "2026-10-22 00:03:42" (UTC)
  centroid_coordinates: { lat: number; lon: number }
  dscovr_j2000_position: { x: number; y: number; z: number }
}

export function getLatestEpic() {
  return cached<EpicImage[]>('epic', async () => {
    const list = await getJson<EpicResponse[]>(`${EPIC_BASE}/api/natural`)
    if (!list || list.length === 0) return null

    return list.map((item) => {
      const [day] = item.date.split(' ')
      const [y, m, d] = day.split('-')
      const p = item.dscovr_j2000_position
      return {
        id: item.identifier,
        date: item.date.replace(' ', 'T') + 'Z',
        imageUrl: `${EPIC_BASE}/archive/natural/${y}/${m}/${d}/jpg/${item.image}.jpg`,
        lat: item.centroid_coordinates.lat,
        lon: item.centroid_coordinates.lon,
        distanceKm: Math.round(Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2)),
      }
    })
  })
}
