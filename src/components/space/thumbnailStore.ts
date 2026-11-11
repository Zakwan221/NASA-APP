/**
 * The rendered item pictures (image data URLs), shared by every page. Plain
 * module state, so pictures made once are reused when the player moves between
 * the builder and the guide. No three.js here: cards can import this cheaply.
 */

import { useSyncExternalStore } from 'react'

const shots = new Map<string, string>()
const listeners = new Set<() => void>()

export const hasThumbnail = (key: string) => shots.has(key)
export const saveThumbnail = (key: string, url: string) => void shots.set(key, url)
export const emitThumbnails = () => listeners.forEach((l) => l())

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The picture for `key` (e.g. "part:solar-deploy"), or null while it is being drawn */
export function useThumbnail(key: string): string | null {
  return useSyncExternalStore(subscribe, () => shots.get(key) ?? null)
}
