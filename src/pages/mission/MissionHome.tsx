import { Link } from 'react-router-dom'
import { Shell } from './operate/OperatePage'

const OPTIONS = [
  {
    to: '/mission/operate',
    icon: '🧑‍🚀',
    title: 'Fly solo',
    text: 'Run the whole mission yourself, on this device.',
  },
  {
    to: '/mission/team/host',
    icon: '🛰️',
    title: 'Host a team mission',
    text: 'Open a room for up to 4 people. Each takes a role and you vote on big decisions.',
  },
  {
    to: '/mission/team/join',
    icon: '📱',
    title: 'Join a team',
    text: 'Enter the 6-digit code on the host’s screen.',
  },
]

/** /mission: pick solo or team play */
export default function MissionHome() {
  return (
    <Shell>
      <p className="text-sm font-semibold uppercase tracking-wider text-cyan-300">Space Mission Design Game</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Fly your own space mission</h1>
      <p className="mt-2 text-slate-300">
        Manage power, data, budget and risk for a year in orbit, and see how every choice changes the result.
      </p>
      <ul className="mt-8 space-y-3">
        {OPTIONS.map((o) => (
          <li key={o.to}>
            <Link
              to={o.to}
              className="card flex min-h-20 items-center gap-4 p-5 transition hover:border-white/25 active:scale-[0.98]"
            >
              <span className="text-3xl" aria-hidden="true">
                {o.icon}
              </span>
              <span>
                <span className="block text-lg font-semibold">{o.title}</span>
                <span className="text-sm text-slate-400">{o.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  )
}
