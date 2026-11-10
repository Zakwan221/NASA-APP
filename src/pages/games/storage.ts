/** Remembers the nickname per room, so a refresh rejoins the lobby with it. */
const key = (code: string) => `orbitly:nickname:${code}`

export function saveNickname(code: string, nickname: string): void {
  try {
    sessionStorage.setItem(key(code), nickname)
  } catch {
    /* storage blocked: the room still works */
  }
}

export function loadNickname(code: string): string | undefined {
  try {
    return sessionStorage.getItem(key(code)) ?? undefined
  } catch {
    return undefined
  }
}
