/**
 * Past solo attempts per scenario, kept in this browser only, so the Report can
 * say "Last attempt: 64 → +8 points". Team results go to Supabase instead
 * (submit_mission_result). Storage can be blocked (private mode), so every
 * access is wrapped and the game works without it.
 */

export interface Attempt {
  total: number
  science: number
  at: number
}

const key = (scenarioId: string) => `orbitly:attempts:${scenarioId}`

export function loadAttempts(scenarioId: string): Attempt[] {
  try {
    const raw = localStorage.getItem(key(scenarioId))
    const list = raw ? (JSON.parse(raw) as Attempt[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveAttempt(scenarioId: string, attempt: Attempt): void {
  try {
    const list = [...loadAttempts(scenarioId), attempt].slice(-10)
    localStorage.setItem(key(scenarioId), JSON.stringify(list))
  } catch {
    // storage unavailable: the comparison just won't show
  }
}
