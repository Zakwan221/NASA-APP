import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

interface ComingSoonProps {
  icon: string
  title: string
  description: string
}

export default function ComingSoon({ icon, title, description }: ComingSoonProps) {
  return (
    <section className="mx-auto flex min-h-[80svh] max-w-xl flex-col items-center justify-center px-4 pt-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <span className="mb-4 text-5xl" aria-hidden="true">{icon}</span>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Coming soon</p>
        <h1 className="mb-3 text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mb-8 text-slate-300">{description}</p>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-6 font-semibold hover:bg-white/10"
        >
          ← Back home
        </Link>
      </motion.div>
    </section>
  )
}
