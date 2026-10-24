export interface NavItem {
  label: string
  to: string
}

/** Single source of truth for the top navbar. Add new pages here. */
export const NAV_LINKS: NavItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Info', to: '/info' },
  { label: 'Games', to: '/games' },
]
