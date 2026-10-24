import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import Section from '../../../components/ui/Section'

const STEPS = [
  {
    icon: '🔭',
    title: 'Learn',
    text: 'Dive into interactive, animated stories built from real NASA data.',
    to: '/info',
    accent: 'text-cyan-300',
  },
  {
    icon: '🎮',
    title: 'Play',
    text: 'Join a live multiplayer space quiz with your friends in seconds.',
    to: '/games',
    accent: 'text-violet-300',
  },
  {
    icon: '🏆',
    title: 'Compete',
    text: 'Climb the leaderboard against friends and players worldwide.',
    to: '/games',
    accent: 'text-amber-300',
  },
]

export default function HowItWorks() {
  return (
    <Section eyebrow="How it works" title="Learn it. Play it. Own the leaderboard.">
      <ul className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <motion.li
            key={step.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <Link
              to={step.to}
              className="card group flex h-full flex-col p-6 transition hover:-translate-y-1 hover:border-white/25"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-3xl" aria-hidden="true">{step.icon}</span>
                <span className="font-display text-sm text-slate-500">0{i + 1}</span>
              </div>
              <h3 className={`text-xl font-bold ${step.accent}`}>{step.title}</h3>
              <p className="mt-2 text-slate-300">{step.text}</p>
              <span className="mt-4 text-sm font-semibold text-slate-400 transition group-hover:text-white">
                Go →
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </Section>
  )
}
