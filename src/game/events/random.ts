/**
 * Seeded random numbers (mulberry32). The seed lives in the game state, so the
 * same seed and the same choices always give the same mission. That lets every
 * phone in a team room replay the host's decisions and see the same result.
 */
export function nextRandom(seed: number): [value: number, nextSeed: number] {
  let t = (seed + 0x6d2b79f5) | 0
  const nextSeed = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, nextSeed]
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}
