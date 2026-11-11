import { motion } from 'framer-motion'
import { BookOpen, Rocket, Trophy, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import Section from '../../../components/ui/Section'

const STEPS: { icon: LucideIcon; title: string; text: string; to: string; accent: string }[] = [
  {
    icon: BookOpen,
    title: 'Learn',
    text: 'See every spacecraft part in 3D and learn how to win each mission.',
    to: '/info',
    accent: 'text-cyan-300',
  },
  {
    icon: Rocket,
    title: 'Play',
    text: 'Build a spacecraft, launch it and fly a real NASA-style mission, solo or with a team.',
    to: '/mission',
    accent: 'text-violet-300',
  },
  {
    icon: Trophy,
    title: 'Compete',
    text: 'Post your score and climb the leaderboard against other players.',
    to: '/mission/leaderboard',
    accent: 'text-amber-300',
  },
]

export default function HowItWorks() {
  return (
    <Section eyebrow="How it works" title="Learn it. Fly it. Own the leaderboard.">
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
                <span className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06]">
                  <step.icon aria-hidden="true" className={`size-6 ${step.accent}`} />
                </span>
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
