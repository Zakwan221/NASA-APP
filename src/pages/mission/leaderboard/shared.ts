/**
 * Small helpers shared by the leaderboard, the share page and the Report.
 * Browser storage can be blocked (private mode), so every access is wrapped.
 */

import { SCENARIOS } from '../../../game/data/scenarios'

/** Scenario names for the leaderboard tabs: every scenario, short name before the colon */
export const SCENARIO_NAMES: Record<string, string> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s.title.split(':')[0].trim()]),
)

export const scenarioName = (id: string) => SCENARIO_NAMES[id] ?? id

export const DIFFICULTY_NAMES: Record<string, string> = {
  cadet: 'Cadet',
  engineer: 'Engineer',
  director: 'Director',
  sandbox: 'Sandbox',
}

export const shareUrl = (id: string) => `${window.location.origin}/mission/r/${id}`

const NAME_KEY = 'orbitly:leaderboard-name'
const MINE_KEY = 'orbitly:my-results'

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // fine: the name just isn't remembered
  }
}

/** Result ids this browser posted, so the leaderboard can mark them "You" */
export function loadMine(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(MINE_KEY) ?? '[]') as unknown
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function addMine(id: string): void {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify([...loadMine(), id].slice(-50)))
  } catch {
    // fine: rows just won't be marked
  }
}

/** Share with the phone's share sheet, or copy the link. Returns what happened, for the button label. */
export async function shareLink(url: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Orbitly mission', text, url })
      return 'shared'
    }
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch (e) {
    // closing the share sheet is not an error
    if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
    return 'failed'
  }
}
