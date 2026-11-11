import { motion } from 'framer-motion'
import { BookOpen, ChevronDown, Rocket, Sparkles } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Lazy so the text shows instantly while three.js loads
const SolarStoryScene = lazy(() => import('./SolarStoryScene'))

const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** A full-screen text panel that fades in as it scrolls into view */
function Panel({
  align = 'left',
  top = false,
  children,
}: {
  align?: 'left' | 'right' | 'center'
  /** Sit near the top instead of the middle (when the 3D view needs the lower part) */
  top?: boolean
  children: ReactNode
}) {
  const place = align === 'center' ? 'items-center text-center' : align === 'right' ? 'items-end text-right' : 'items-start text-left'
  return (
    <div
      className={`mx-auto flex h-svh max-w-6xl flex-col px-4 sm:px-6 ${top ? 'justify-start pt-24' : 'justify-end pb-24 sm:justify-center sm:pb-0'} ${place}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.6 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className="pointer-events-auto max-w-md rounded-3xl bg-space-950/55 p-6 backdrop-blur-sm sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
      >
        {children}
      </motion.div>
    </div>
  )
}

const eyebrow = 'mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300'
const heading = 'font-display text-3xl font-bold leading-tight sm:text-5xl [text-shadow:0_2px_24px_rgba(0,0,0,0.6)]'
const body = 'mt-3 text-base text-slate-300 sm:text-lg [text-shadow:0_1px_12px_rgba(0,0,0,0.8)]'

/**
 * The home page opening: a tall section whose scroll position drives the 3D
 * scene pinned behind it (Earth → spacecraft in orbit → the solar system).
 */
export default function SolarStory() {
  const section = useRef<HTMLElement>(null)
  // 0 at the top of the story, 1 at its end. Read by the 3D scene every frame.
  const progress = useRef(0)

  useEffect(() => {
    const update = () => {
      const el = section.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const range = el.offsetHeight - window.innerHeight
      progress.current = range > 0 ? Math.min(1, Math.max(0, -rect.top / range)) : 0
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <section ref={section} className="relative h-[500svh]" aria-label="Orbitly">
      {/* Pinned 3D view */}
      <div className="sticky top-0 h-svh overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(34,211,238,0.16),transparent_60%)]" />
        <Suspense fallback={null}>
          <SolarStoryScene progress={progress} />
        </Suspense>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-space-950 to-transparent" />
      </div>

      {/* Text that scrolls over it */}
      <div className="pointer-events-none absolute inset-0">
        {/* 1. Hero */}
        <div className="flex h-svh flex-col items-center px-4 pt-24 text-center sm:pt-28">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE_OUT }} className="pointer-events-auto">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200 backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-cyan-300" />
              Live NASA data
            </p>
            <h1 className="bg-gradient-to-r from-cyan-200 via-white to-violet-300 bg-clip-text font-display text-6xl font-bold tracking-tight text-transparent sm:text-8xl">
              Orbitly
            </h1>
            <p className="mt-3 text-lg text-slate-200 sm:text-xl [text-shadow:0_1px_12px_rgba(0,0,0,0.8)]">Design it. Launch it. Fly it.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                to="/mission"
                className="glow-cyan inline-flex min-h-12 items-center gap-2 rounded-full bg-cyan-400 px-6 font-semibold text-space-950 transition hover:bg-cyan-300"
              >
                <Rocket aria-hidden="true" className="size-4" /> Design a mission
              </Link>
              <Link
                to="/info"
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-violet-400/60 bg-violet-500/15 px-6 font-semibold text-violet-100 backdrop-blur transition hover:bg-violet-500/30"
              >
                <BookOpen aria-hidden="true" className="size-4" /> How to play
              </Link>
            </div>
          </motion.div>
          <p className="mt-auto mb-8 flex flex-col items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            Scroll to fly
            <ChevronDown aria-hidden="true" className="size-5 animate-bounce" />
          </p>
        </div>

        {/* 2. Spacecraft */}
        <Panel align="left">
          <p className={eyebrow}>Step 1 · Design</p>
          <h2 className={heading}>Build a spacecraft that really works</h2>
          <p className={body}>
            Pick a frame, solar panels, a radio and instruments. Every choice changes its mass, power and budget, just like at NASA.
          </p>
          <Link to="/mission" className="mt-5 inline-flex min-h-11 items-center font-semibold text-cyan-300 hover:text-cyan-200">
            Start designing →
          </Link>
        </Panel>

        {/* 3. Earth leaving the frame */}
        <Panel align="right" top>
          <p className={eyebrow}>Step 2 · Launch and fly</p>
          <h2 className={heading}>Put it in orbit</h2>
          <p className={body}>Launch it, keep it powered through Earth’s shadow and send your science home before the mission ends.</p>
        </Panel>

        {/* 4. Solar system */}
        <Panel align="center" top>
          <p className={eyebrow}>
            <Sparkles aria-hidden="true" className="mr-1 inline size-3.5 -translate-y-px" /> Our solar system
          </p>
          <h2 className={heading}>One star. Eight worlds.</h2>
          <p className={body}>Earth is the third planet from the Sun, about 150 million km away. Sizes and distances here are squeezed to fit.</p>
          <Link to="/info" className="mt-5 inline-flex min-h-11 items-center font-semibold text-cyan-300 hover:text-cyan-200">
            Explore NASA data →
          </Link>
        </Panel>

        {/* 5. Breathing room before the next section */}
        <div className="h-svh" />
      </div>
    </section>
  )
}
