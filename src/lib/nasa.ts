/**
 * Shared NASA Open API helpers.
 * Used by Home, Info and Games pages — keep this file framework-free.
 * Every function returns `null` on failure so pages never crash.
 */

const API_KEY = import.meta.env.VITE_NASA_KEY || 'DEMO_KEY'
const BASE_URL = 'https://api.nasa.gov'
// APOD moved to NASA Science's WordPress API (legacy /planetary/apod goes offline 1 Dec 2026)
const APOD_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic/'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/* ---------------- cache (sessionStorage, 1h) ---------------- */

interface CacheEntry<T> {
  savedAt: number
  data: T
}

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null
    return entry.data
  } catch {
    return null
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { savedAt: Date.now(), data }
    sessionStorage.setItem(key, JSON.stringify(entry))
  } catch {
    /* storage full or blocked — ignore */
  }
}

/** `path` is relative to api.nasa.gov, or a full URL */
async function fetchJson<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  try {
    const query = new URLSearchParams({ ...params, api_key: API_KEY })
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
    const res = await fetch(`${url}?${query}`)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** Local date as YYYY-MM-DD */
export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/* ---------------- APOD ---------------- */

export interface Apod {
  title: string
  imageUrl?: string // for videos this is a still frame
  pageUrl: string // full APOD article on science.nasa.gov
  mediaType: 'image' | 'video' | 'other'
  explanation: string
  alt?: string
  date: string
  copyright?: string
}

interface ApodResponse {
  title: string
  permalink?: string
  url?: string
  hdurl?: string
  media_type: string
  explanation: string // HTML
  alt?: string
  date: string
  copyright?: string // HTML
}

/** HTML → plain text */
function toText(html: string): string {
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, ' '), 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Ask the image CDN for a phone-friendly size */
function resizeImage(url: string, width = 1200): string {
  try {
    const u = new URL(url)
    if (!u.searchParams.has('w')) return url
    u.searchParams.set('w', String(width))
    u.searchParams.delete('h')
    return u.toString()
  } catch {
    return url
  }
}

export async function getAPOD(): Promise<Apod | null> {
  const cacheKey = `orbitly:apod-v2:${todayISO()}`
  const cached = readCache<Apod>(cacheKey)
  if (cached) return cached

  const list = await fetchJson<ApodResponse[]>(APOD_URL)
  const data = list?.[0]
  if (!data) return null

  const explanation = toText(data.explanation)
    .replace(/^Explanation:\s*/i, '')
    .replace(/\s*Tomorrow's picture:.*$/i, '')

  const apod: Apod = {
    title: data.title,
    imageUrl: data.hdurl ? resizeImage(data.hdurl) : undefined,
    pageUrl: data.permalink ?? data.url ?? 'https://science.nasa.gov/apod/',
    mediaType: data.media_type === 'image' || data.media_type === 'video' ? data.media_type : 'other',
    explanation,
    alt: data.alt,
    date: data.date,
    copyright: data.copyright ? toText(data.copyright) || undefined : undefined,
  }
  writeCache(cacheKey, apod)
  return apod
}

/* ---------------- Asteroids (NeoWs) ---------------- */

export interface Asteroid {
  name: string
  diameterMeters: number
  velocityKmh: number
  missDistanceKm: number
  isHazardous: boolean
}

export interface AsteroidSummary {
  date: string
  total: number
  hazardous: number
  asteroids: Asteroid[] // sorted by closest miss distance
}

interface NeoFeedResponse {
  element_count: number
  near_earth_objects: Record<
    string,
    Array<{
      name: string
      is_potentially_hazardous_asteroid: boolean
      estimated_diameter: { meters: { estimated_diameter_min: number; estimated_diameter_max: number } }
      close_approach_data: Array<{
        relative_velocity: { kilometers_per_hour: string }
        miss_distance: { kilometers: string }
      }>
    }>
  >
}

export async function getTodayAsteroids(): Promise<AsteroidSummary | null> {
  const date = todayISO()
  const cacheKey = `orbitly:neo:${date}`
  const cached = readCache<AsteroidSummary>(cacheKey)
  if (cached) return cached

  const data = await fetchJson<NeoFeedResponse>('/neo/rest/v1/feed', {
    start_date: date,
    end_date: date,
  })
  if (!data) return null

  const raw = data.near_earth_objects[date] ?? Object.values(data.near_earth_objects).flat()

  const asteroids: Asteroid[] = raw
    .map((neo) => {
      const approach = neo.close_approach_data[0]
      const d = neo.estimated_diameter.meters
      return {
        name: neo.name.replace(/[()]/g, '').trim(),
        diameterMeters: Math.round((d.estimated_diameter_min + d.estimated_diameter_max) / 2),
        velocityKmh: Math.round(Number(approach?.relative_velocity.kilometers_per_hour ?? 0)),
        missDistanceKm: Math.round(Number(approach?.miss_distance.kilometers ?? 0)),
        isHazardous: neo.is_potentially_hazardous_asteroid,
      }
    })
    .sort((a, b) => a.missDistanceKm - b.missDistanceKm)

  const summary: AsteroidSummary = {
    date,
    total: asteroids.length,
    hazardous: asteroids.filter((a) => a.isHazardous).length,
    asteroids,
  }
  writeCache(cacheKey, summary)
  return summary
}
