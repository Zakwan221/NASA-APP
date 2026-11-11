import { motion } from 'framer-motion'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** Drifting nebula, slow stars, film grain and a vignette behind the Info pages */
export function InfoBackdrop() {
  return (
    <div className="lg-backdrop" aria-hidden="true">
      <div className="lg-stars far" />
      <div className="lg-stars" />
      <div className="lg-nebula a" />
      <div className="lg-nebula b" />
      <div className="lg-nebula c" />
      <div className="lg-vignette" />
      <div className="lg-grain" />
    </div>
  )
}

/** Page title that comes into focus word by word, with a lens-flare line under it */
export function CinematicHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  const words = title.split(' ')
  return (
    <header className="relative max-w-3xl">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="lg-glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(103,232,249,0.8)]" />
        {eyebrow}
      </motion.p>

      <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
        {words.map((w, i) => (
          <motion.span
            key={`${w}-${i}`}
            className="lg-title inline-block pr-[0.25em]"
            initial={{ opacity: 0, y: '0.45em', filter: 'blur(14px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              duration: 0.9,
              ease: EASE_OUT,
              delay: 0.1 + i * 0.07,
            }}
          >
            {w}
          </motion.span>
        ))}
      </h1>

      {/* Anamorphic lens flare */}
      <div className="relative mt-5 h-px w-full max-w-xl">
        <motion.div
          className="absolute inset-0 origin-left bg-gradient-to-r from-cyan-300 via-white to-transparent"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.35 }}
        />
        <motion.div
          className="absolute -inset-y-1 inset-x-0 origin-left bg-gradient-to-r from-cyan-400/60 via-cyan-200/30 to-transparent blur-md"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.35 }}
        />
      </div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.55 }}
        className="mt-5 max-w-2xl text-slate-300 sm:text-lg"
      >
        {text}
      </motion.p>
    </header>
  )
}
