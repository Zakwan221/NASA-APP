import { motion } from 'framer-motion'
import { BookOpen, Boxes, Library, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/info', end: true, label: 'How to play', icon: BookOpen },
  { to: '/info/items', end: false, label: 'Items', icon: Boxes },
  { to: '/info/tips', end: false, label: 'Tips to win', icon: Trophy },
  { to: '/info/sources', end: false, label: 'Sources', icon: Library },
]

/**
 * The Info pages as a liquid-glass tab bar under the main menu.
 * Once the page scrolls, a frosted band joins it to the menu, so nothing shows around it.
 * Pages leave room for it at the top (pt-40), so it never covers content at rest.
 */
export default function InfoNav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav aria-label="Info pages" className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-3 pb-2.5 pt-2">
      {/* Frosted band (matches the menu bar above it) */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 border-b border-white/10 bg-space-950/85 backdrop-blur-md transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0'}`}
      />
      <motion.ul
        initial={{ opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="lg-glass pointer-events-auto flex gap-1 rounded-full p-1"
      >
        <li className="lg-sweep" aria-hidden="true" />
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `relative flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-semibold transition-colors sm:px-4 ${
                  isActive ? 'text-space-950' : 'text-slate-200 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="info-tab-drop"
                      className="lg-drop absolute inset-0 rounded-full"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 32,
                      }}
                    />
                  )}
                  {/* Icons hide on small phones so the four tabs fit on one line */}
                  <t.icon aria-hidden="true" className="relative hidden size-4 sm:block" />
                  <span className="relative">{t.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </motion.ul>
    </nav>
  )
}
