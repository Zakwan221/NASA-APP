import type { MissionNasaData } from '../../../lib/nasaMission'

/** Plain-words facts from real NASA data, for the mission panel and the flight log */

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const km = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} million km` : `${n.toLocaleString()} km`)

export const NASA_SOURCE: Record<string, { api: string; name: string; url: string }> = {
  'earth-watch': { api: 'EONET', name: 'NASA EONET (Earth Observatory Natural Event Tracker)', url: 'https://eonet.gsfc.nasa.gov/' },
  'solar-storm': { api: 'DONKI', name: 'NASA DONKI (Space Weather Database)', url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/' },
  'asteroid-scout': { api: 'NeoWs', name: 'NASA NeoWs (Near Earth Object Web Service)', url: 'https://api.nasa.gov/' },
}

/** The headline and detail lines for one mission, or null when NASA sent nothing for it */
export function missionFacts(scenarioId: string, d: MissionNasaData): { headline: string; lines: string[]; link?: string } | null {
  if (scenarioId === 'earth-watch' && d.fires) {
    const f = d.fires
    const near = f.nearest[0]
    return {
      headline: `${f.total} wildfires in Southeast Asia in the last 90 days, ${f.nearMalaysia} of them within 1,500 km of Malaysia.`,
      lines: [
        ...(near ? [`Nearest: ${near.title}, ${near.distanceKm.toLocaleString()} km from Kuala Lumpur (${fmtDate(near.date)}).`] : []),
        'Smoke from fires like these is the haze your spacecraft watches for.',
      ],
      link: near?.link,
    }
  }
  if (scenarioId === 'solar-storm' && d.storms) {
    const s = d.storms
    return {
      headline: `${s.total} solar storms (CMEs) left the Sun in the last 30 days.`,
      lines: [
        ...(s.latest ? [`Latest: ${fmtDate(s.latest.time)}${s.latest.speedKms ? `, ${s.latest.speedKms.toLocaleString()} km/s` : ''}.`] : []),
        ...(s.fastest?.speedKms ? [`Fastest: ${s.fastest.speedKms.toLocaleString()} km/s on ${fmtDate(s.fastest.time)}.`] : []),
        'Your spacecraft gives early warning before storms like these reach Earth.',
      ],
      link: s.latest?.link,
    }
  }
  if (scenarioId === 'asteroid-scout' && d.asteroid) {
    const a = d.asteroid
    return {
      headline: `Your target: asteroid ${a.name}, about ${a.diameterMeters} m wide.`,
      lines: [
        `It passes ${km(a.missDistanceKm)} from Earth on ${fmtDate(a.date)} at ${a.velocityKmh.toLocaleString()} km/h.`,
        a.hazardous ? 'NASA lists it as potentially hazardous, so knowing what it is made of matters.' : `One of ${a.passingToday} asteroids passing Earth that day.`,
      ],
      link: a.link,
    }
  }
  return null
}

/** A real NASA example for a flight-log event, or null */
export function eventNote(title: string, d: MissionNasaData): string | null {
  if (title.startsWith('Solar storm') && d.storms?.latest) {
    const c = d.storms.latest
    return `Real NASA example: a CME left the Sun on ${fmtDate(c.time)}${c.speedKms ? ` at ${c.speedKms.toLocaleString()} km/s` : ''} (DONKI).`
  }
  if (title.startsWith('Fire and haze season') && d.fires?.nearest[0]) {
    const f = d.fires.nearest[0]
    return `Real NASA example: ${f.title}, ${f.distanceKm.toLocaleString()} km from Kuala Lumpur, on ${fmtDate(f.date)} (EONET).`
  }
  return null
}
