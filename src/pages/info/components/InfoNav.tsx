import { BookOpen, Boxes, Trophy } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/info', end: true, label: 'How to play', icon: BookOpen },
  { to: '/info/items', end: false, label: 'Items', icon: Boxes },
  { to: '/info/tips', end: false, label: 'Tips to win', icon: Trophy },
]

/** The three Info pages, as tabs floating under the main menu */
export default function InfoNav() {
  return (
    <nav aria-label="Info pages" className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-40 flex justify-center px-3">
      <ul className="pointer-events-auto flex gap-1 rounded-full border border-white/10 bg-space-950/95 p-1 shadow-xl shadow-black/60 backdrop-blur-xl">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition sm:px-4 ${
                  isActive ? 'bg-cyan-400 text-space-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <t.icon aria-hidden="true" className="size-4" />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
