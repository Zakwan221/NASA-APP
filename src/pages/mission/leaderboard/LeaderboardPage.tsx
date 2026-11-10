import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { LeaderboardMode } from '../../../multiplayer/missionApi'
import { Shell } from '../operate/OperatePage'
import LeaderboardTable from './LeaderboardTable'
import { SCENARIO_NAMES } from './shared'

const MODES: { id: LeaderboardMode; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'solo', label: 'Solo' },
  { id: 'team', label: 'Teams' },
]

/** /mission/leaderboard: best score per name, per scenario */
export default function LeaderboardPage() {
  const scenarios = Object.entries(SCENARIO_NAMES)
  const [scenarioId, setScenarioId] = useState(scenarios[0][0])
  const [mode, setMode] = useState<LeaderboardMode>('all')

  return (
    <Shell>
      <p className="text-sm font-semibold uppercase tracking-wider text-cyan-300">Leaderboard</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Best missions</h1>
      <p className="mt-2 text-slate-300">Each name’s best score. Tap a mission to see why it scored what it did.</p>

      {scenarios.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Scenario">
          {scenarios.map(([id, name]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={scenarioId === id}
              onClick={() => setScenarioId(id)}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${scenarioId === id ? 'bg-white text-space-900' : 'bg-white/10 hover:bg-white/15'}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <section className="card mt-6 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <h2 className="font-semibold">{SCENARIO_NAMES[scenarioId]}</h2>
          <div className="flex rounded-full bg-white/5 p-1" role="group" aria-label="Show">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`min-h-9 rounded-full px-3 text-sm transition ${mode === m.id ? 'bg-white/15 font-semibold' : 'text-slate-400 hover:text-white'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <LeaderboardTable scenarioId={scenarioId} mode={mode} />
      </section>

      <p className="mt-6 text-center">
        <Link to="/mission" className="text-sm text-cyan-300 underline-offset-4 hover:underline">
          ← Back to missions
        </Link>
      </p>
    </Shell>
  )
}
