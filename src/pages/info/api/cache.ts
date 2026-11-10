/**
 * Small fetch + cache helper for the Info page (Module 2).
 * - Caches the *mapped* result in sessionStorage (default 1 hour)
 * - Never throws: returns null on any failure
 */

export const NASA_KEY = import.meta.env.VITE_NASA_KEY || 'DEMO_KEY'
const ONE_HOUR = 60 * 60 * 1000
const PREFIX = 'orbitly:info:'

export async function cached<T>(key: string, load: () => Promise<T | null>, ttl = ONE_HOUR): Promise<T | null> {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (raw) {
      const entry = JSON.parse(raw) as { savedAt: number; data: T }
      if (Date.now() - entry.savedAt < ttl) return entry.data
    }
  } catch {
    /* blocked storage — just fetch */
  }

  const data = await load()
  if (data !== null) {
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), data }))
    } catch {
      /* storage full — ignore */
    }
  }
  return data
}

export async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** YYYY-MM-DD (UTC) for a date offset by `days` from today */
export function isoDay(days = 0): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

/* ---------- geo helpers (used by Earth + Events tabs) ---------- */

export const KUALA_LUMPUR = { lat: 3.139, lon: 101.687 }

/** Great-circle distance in km */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}
