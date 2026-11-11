/**
 * Download today's NASA data for the three missions and save it as the game's
 * backup copy (src/game/data/nasa-snapshot.json). The game always tries NASA
 * live first and only uses this file when NASA can't be reached.
 *
 *   npm run nasa:snapshot
 *
 * Uses VITE_NASA_KEY from .env (falls back to NASA's shared DEMO_KEY, which is
 * rate limited). A source that fails keeps its previous saved value.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import {
  EONET_FIRES_URL,
  donkiCmeUrl,
  neoFeedUrl,
  pickAsteroid,
  summarizeFires,
  summarizeStorms,
  type MissionNasaData,
} from '../src/lib/nasaMission.ts'

const OUT = new URL('../src/game/data/nasa-snapshot.json', import.meta.url)

function nasaKey(): string {
  if (process.env.VITE_NASA_KEY) return process.env.VITE_NASA_KEY
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8').replace(/^﻿/, '')
    const line = env.split(/\r?\n/).find((l) => l.startsWith('VITE_NASA_KEY='))
    if (line) return line.slice('VITE_NASA_KEY='.length).trim()
  } catch {
    /* no .env */
  }
  return 'DEMO_KEY'
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

const day = (d: Date) => d.toISOString().slice(0, 10)
const key = nasaKey()
const today = new Date()
const from = day(new Date(today.getTime() - 30 * 24 * 3600 * 1000))
const to = day(today)

const previous: MissionNasaData | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null
const data: MissionNasaData = {
  fetchedAt: today.toISOString(),
  fires: previous?.fires ?? null,
  storms: previous?.storms ?? null,
  asteroid: previous?.asteroid ?? null,
}

const jobs: [string, () => Promise<void>][] = [
  ['EONET wildfires', async () => void (data.fires = summarizeFires((await getJson(EONET_FIRES_URL)) as never))],
  ['DONKI solar storms', async () => void (data.storms = summarizeStorms((await getJson(donkiCmeUrl(key, from, to))) as never, from, to))],
  ['NeoWs asteroids', async () => void (data.asteroid = pickAsteroid((await getJson(neoFeedUrl(key, to))) as never))],
]

for (const [name, job] of jobs) {
  try {
    await job()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.warn(`✗ ${name}: ${(e as Error).message} (kept the previous copy)`)
  }
}

writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n')
console.log(`Saved ${OUT.pathname}`)
