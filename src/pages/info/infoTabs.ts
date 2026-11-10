import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/** The 5 sub-navbar topics. Add / reorder tabs here only. */
export type InfoTabId = 'earth' | 'events' | 'sun' | 'asteroids' | 'gallery'

export interface InfoTab {
  id: InfoTabId
  label: string
  icon: string
  Component: LazyExoticComponent<ComponentType>
}

export const INFO_TABS: InfoTab[] = [
  { id: 'earth', label: 'Earth', icon: '🌍', Component: lazy(() => import('./tabs/EarthTab')) },
  { id: 'events', label: 'Live Events', icon: '🔥', Component: lazy(() => import('./tabs/EventsTab')) },
  { id: 'sun', label: 'The Sun', icon: '☀️', Component: lazy(() => import('./tabs/SunTab')) },
  { id: 'asteroids', label: 'Asteroids', icon: '☄️', Component: lazy(() => import('./tabs/AsteroidsTab')) },
  { id: 'gallery', label: 'Gallery', icon: '🔭', Component: lazy(() => import('./tabs/GalleryTab')) },
]

export const DEFAULT_TAB: InfoTabId = 'earth'

export function isInfoTab(value: string | null): value is InfoTabId {
  return INFO_TABS.some((t) => t.id === value)
}
