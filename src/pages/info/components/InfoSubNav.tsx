import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { InfoTab, InfoTabId } from '../infoTabs'

interface InfoSubNavProps {
  tabs: InfoTab[]
  active: InfoTabId
  onChange: (id: InfoTabId) => void
}

/** Sticky sub-navbar under the main navbar. Scrolls sideways on small phones. */
export default function InfoSubNav({ tabs, active, onChange }: InfoSubNavProps) {
  const activeRef = useRef<HTMLButtonElement>(null)

  // Keep the active tab visible when it changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [active])

  return (
    <div className="sticky top-16 z-40 border-y border-white/10 bg-space-950/90 backdrop-blur-md">
      <div
        role="tablist"
        aria-label="NASA topics"
        className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:justify-center sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              ref={isActive ? activeRef : undefined}
              type="button"
              role="tab"
              id={`info-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls="info-panel"
              onClick={() => onChange(tab.id)}
              className={`relative flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                isActive ? 'text-space-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="info-subnav-pill"
                  className="absolute inset-0 rounded-full bg-cyan-300"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
              <span className="relative" aria-hidden="true">{tab.icon}</span>
              <span className="relative">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
