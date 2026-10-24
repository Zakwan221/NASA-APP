import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured } from '../../../lib/supabase'
import GameShell from '../components/GameShell'

const OPTIONS = [
  {
    to: 'join',
    icon: '📱',
    title: 'Join a game',
    text: 'Got a 6-digit code? Jump in with a nickname.',
    className: 'glow-cyan border-cyan-300/30',
  },
  {
    to: 'host',
    icon: '🖥️',
    title: 'Host a game',
    text: 'Pick a quiz and show the code on a big screen.',
    className: 'glow-violet border-violet-300/30',
  },
]

export default function GamesHome() {
  return (
    <GameShell>
      <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Live multiplayer</p>
        <h1 className="text-4xl font-bold sm:text-5xl">Play Quiz</h1>
        <p className="mt-3 text-slate-300">Race your friends on real NASA facts. Faster right answers score more.</p>
      </motion.header>

      {!isSupabaseConfigured() ? (
        <p className="card p-6 text-slate-300">
          The quiz isn't connected yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code>.env</code> (see <code>supabase/README.md</code>), then restart <code>npm run dev</code>.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((o, i) => (
            <motion.li
              key={o.to}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1 }}
            >
              <Link to={o.to} className={`card flex h-full flex-col p-6 transition hover:-translate-y-1 ${o.className}`}>
                <span className="text-4xl" aria-hidden="true">
                  {o.icon}
                </span>
                <h2 className="mt-4 text-2xl font-bold">{o.title}</h2>
                <p className="mt-2 text-slate-300">{o.text}</p>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </GameShell>
  )
}
