import { AnimatePresence, motion } from 'framer-motion'
import { Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import Skeleton from '../../components/ui/Skeleton'
import InfoSubNav from './components/InfoSubNav'
import { DEFAULT_TAB, INFO_TABS, isInfoTab, type InfoTabId } from './infoTabs'

/**
 * Module 2 — Explore Space.
 * The active topic lives in the URL (/info?tab=sun) so every tab can be shared or bookmarked.
 */
export default function InfoPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const activeId: InfoTabId = isInfoTab(requested) ? requested : DEFAULT_TAB
  const active = INFO_TABS.find((t) => t.id === activeId) ?? INFO_TABS[0]

  const changeTab = (id: InfoTabId) => {
    setParams({ tab: id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="pt-16">
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(ellipse_at_90%_20%,rgba(139,92,246,0.18),transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Explore Space</p>
          <h1 className="text-4xl font-bold sm:text-5xl">NASA, live.</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Five windows into what NASA is watching right now — every number and picture here comes straight from
            NASA's open data.
          </p>
        </div>
      </header>

      <InfoSubNav tabs={INFO_TABS} active={activeId} onChange={changeTab} />

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          id="info-panel"
          role="tabpanel"
          aria-labelledby={`info-tab-${active.id}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mx-auto max-w-6xl px-4 py-10 sm:px-6"
        >
          <Suspense
            fallback={
              <div className="space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-64 w-full" />
              </div>
            }
          >
            <active.Component />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
