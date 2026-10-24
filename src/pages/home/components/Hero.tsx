import { motion, type Variants } from 'framer-motion'
import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'

// Lazy so the text shows instantly while three.js loads
const EarthScene = lazy(() => import('./EarthScene'))

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

export default function Hero() {
  return (
    <section className="relative h-svh min-h-[600px] overflow-hidden">
      {/* Soft glow behind everything (also the fallback while 3D loads) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_110%,rgba(34,211,238,0.25),transparent_55%),radial-gradient(ellipse_at_80%_0%,rgba(139,92,246,0.18),transparent_50%)]" />

      <Suspense fallback={null}>
        <EarthScene />
      </Suspense>

      {/* Fade into the page below */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-space-950 to-transparent" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 pt-28 text-center sm:pt-36"
      >
        <motion.p
          variants={item}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-cyan-300" />
          Live NASA data
        </motion.p>

        <motion.h1
          variants={item}
          className="bg-gradient-to-r from-cyan-200 via-white to-violet-300 bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-8xl"
        >
          Orbitly
        </motion.h1>

        <motion.p variants={item} className="mt-4 text-lg text-slate-300 sm:text-xl">
          Explore space. Play with friends.
        </motion.p>

        <motion.div variants={item} className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/info"
            className="glow-cyan inline-flex min-h-12 items-center rounded-full bg-cyan-400 px-6 font-semibold text-space-950 transition hover:bg-cyan-300"
          >
            Explore Space
          </Link>
          <Link
            to="/games"
            className="inline-flex min-h-12 items-center rounded-full border border-violet-400/60 bg-violet-500/15 px-6 font-semibold text-violet-100 backdrop-blur transition hover:bg-violet-500/30"
          >
            Play Quiz
          </Link>
        </motion.div>
      </motion.div>

      {/* Scroll hint */}
      <a
        href="#asteroids"
        className="absolute bottom-6 left-1/2 z-10 flex size-11 -translate-x-1/2 items-center justify-center text-slate-300 hover:text-white"
        aria-label="Scroll to content"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-bounce">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </section>
  )
}
