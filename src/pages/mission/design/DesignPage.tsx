import { useEffect, useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { INSTRUMENTS, partsIn, SCENARIOS } from '../../../game/data'
import { evaluate, limitsFor } from '../../../game/engine/evaluate'
import type { Difficulty, MissionDesign, Part, PartCategory, ResourceKey } from '../../../game/types'
import { useMission } from '../../../store/missionStore'
import Dashboard, { MiniStatus } from './components/Dashboard'
import OptionCard, { CardRow, CardSlot } from './components/OptionCard'
import PhaseSteps from './components/PhaseSteps'

const DIFFICULTIES: { id: Difficulty; label: string; text: string }[] = [
  { id: 'cadet', label: 'Cadet', text: 'Simple parts, a big budget and hints.' },
  { id: 'engineer', label: 'Engineer', text: 'All parts, a normal budget, a year in space.' },
  { id: 'director', label: 'Director', text: 'Tight budget, longer mission, more trouble in flight.' },
  { id: 'sandbox', label: 'Sandbox', text: 'No budget limit. Try anything.' },
]

const RESOURCE_WORD: Record<ResourceKey, string> = {
  mass: 'mass',
  power: 'power',
  budget: 'budget',
  data: 'data',
  comms: 'communications',
  lifetime: 'lifetime',
}

const SLOTS: { slot: keyof MissionDesign['engineer'] | 'radio'; category: PartCategory; title: string; hint: string }[] = [
  { slot: 'structureId', category: 'structure', title: 'Frame', hint: 'Decides how much everything can weigh.' },
  { slot: 'solarId', category: 'power', title: 'Solar panels', hint: 'Make power in sunlight.' },
  { slot: 'batteryId', category: 'battery', title: 'Battery', hint: 'Keeps things running in Earth’s shadow.' },
  { slot: 'computerId', category: 'computer', title: 'Flight computer', hint: 'Runs the spacecraft and stores data.' },
  { slot: 'attitudeId', category: 'attitude', title: 'Attitude control', hint: 'Points the instruments.' },
  { slot: 'radio', category: 'comms', title: 'Radio', hint: 'Sends data home. Further orbits need stronger radios.' },
]

const fmtStorage = (mbit: number) => (mbit >= 8000 ? `${Math.round(mbit / 8000)} GB` : `${Math.round(mbit / 8)} MB`)
const fmtRange = (km: number) =>
  km >= 100_000_000 ? 'Deep space' : km >= 1_000_000 ? `${(km / 1_000_000).toFixed(1)}M km` : `${km.toLocaleString()} km`
const fmtRate = (kbps: number) => (kbps >= 1000 ? `${kbps / 1000} Mbps` : `${kbps} kbps`)

/** The numbers worth showing for each kind of part */
function partStats(p: Part) {
  const stats = [
    { label: 'Mass', value: `${p.massKg} kg` },
    { label: 'Cost', value: `$${p.costM} M` },
  ]
  if (p.powerDrawW) stats.push({ label: 'Uses', value: `${p.powerDrawW} W` })
  if (p.maxLoadKg) stats.push({ label: 'Carries', value: `${p.maxLoadKg} kg` })
  if (p.powerGenW) stats.push({ label: 'Makes', value: `${p.powerGenW} W` })
  if (p.capacityWh) stats.push({ label: 'Stores', value: `${p.capacityWh} Wh` })
  if (p.storageMbit) stats.push({ label: 'Storage', value: fmtStorage(p.storageMbit) })
  if (p.dataRateKbps) stats.push({ label: 'Speed', value: fmtRate(p.dataRateKbps) })
  if (p.maxRangeKm) stats.push({ label: 'Range', value: fmtRange(p.maxRangeKm) })
  if (p.pointingDeg !== undefined) stats.push({ label: 'Aims within', value: `${p.pointingDeg}°` })
  return stats
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-xl font-bold">
        <span className="text-cyan-300">{n}.</span> {title}
      </h2>
      <p className="mb-4 mt-1 text-sm text-slate-400">{hint}</p>
      {children}
    </section>
  )
}

/** Phase 1: pick a mission, build the spacecraft, watch the live dashboard. */
export default function DesignPage() {
  const store = useMission()
  const { design } = store
  const navigate = useNavigate()
  const location = useLocation()
  const ev = useMemo(() => evaluate(design), [design])

  // Coming from the Report's Redesign button: the next flight needs a new launch
  const redesign = (location.state as { redesign?: boolean } | null)?.redesign
  const { setLaunch } = store
  useEffect(() => {
    if (redesign) setLaunch(null)
  }, [redesign, setLaunch])
  const scenarioId = design.planner.scenarioId
  const difficulty = design.planner.difficulty
  const showAdvanced = difficulty !== 'cadet'
  const visible = <T extends { tier: string }>(items: T[]) => items.filter((i) => showAdvanced || i.tier === 'simple')
  const limits = limitsFor(ev.scenario, difficulty)
  const lifetime = design.planner.targetLifetimeMonths

  const selectedId = (slot: (typeof SLOTS)[number]['slot']) =>
    slot === 'radio' ? design.comms.radioId : design.engineer[slot]
  const select = (slot: (typeof SLOTS)[number]['slot'], id: string) =>
    slot === 'radio' ? store.setRadio(id) : store.setPart(slot, id)

  const instruments = visible(INSTRUMENTS).sort(
    (a, b) => Number(b.goodFor.includes(scenarioId ?? '')) - Number(a.goodFor.includes(scenarioId ?? '')),
  )
  const blockers = ev.warnings.filter((w) => w.blocking && w.phase === 'design').length

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-20 sm:px-6 sm:pt-24 lg:pb-16">
      <header className="mb-8">
        <PhaseSteps current="Design" />
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Design your spacecraft</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Every part adds mass, uses power and costs money. Watch the dashboard: it explains what each choice does.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0">
          <Step n={1} title="Choose a mission" hint="What should your spacecraft do? This decides which instruments and orbits make sense.">
            <div className="grid gap-3 sm:grid-cols-3">
              {SCENARIOS.map((s) => {
                const selected = s.id === scenarioId
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      store.setScenario(s.id)
                      const min = limitsFor(s, difficulty).minLifetimeMonths
                      if (lifetime < min) store.setLifetime(min)
                    }}
                    className={`card min-h-11 p-4 text-left transition active:scale-[0.98] ${
                      selected ? 'border-cyan-300/70 bg-cyan-300/5' : 'hover:border-white/25'
                    }`}
                  >
                    <span className="block font-semibold">{s.title}</span>
                    <span className="mt-1 block text-sm text-slate-300">{s.objective}</span>
                    <span className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                      {s.criticalResources.map((r) => (
                        <span key={r} className="rounded-full bg-amber-300/15 px-2 py-0.5 text-amber-200">
                          Key: {RESOURCE_WORD[r]}
                        </span>
                      ))}
                      {s.nasaData.map((d) => (
                        <span key={d.api} className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">
                          NASA {d.api}
                        </span>
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Difficulty</legend>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={difficulty === d.id}
                      onClick={() => {
                        store.setDifficulty(d.id)
                        const min = limitsFor(ev.scenario, d.id).minLifetimeMonths
                        if (lifetime < min) store.setLifetime(min)
                      }}
                      className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
                        difficulty === d.id ? 'bg-cyan-300 text-space-950' : 'bg-white/10 hover:bg-white/15'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {DIFFICULTIES.find((d) => d.id === difficulty)?.text}{' '}
                  {ev.scenario && difficulty !== 'sandbox' && `Budget $${limits.budgetM} M.`}
                </p>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Planned time in space</legend>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Fewer months"
                    onClick={() => store.setLifetime(Math.max(limits.minLifetimeMonths, lifetime - 3))}
                    disabled={lifetime <= limits.minLifetimeMonths}
                    className="size-11 rounded-full bg-white/10 text-xl font-bold hover:bg-white/15 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="min-w-28 text-center font-display text-2xl font-bold tabular-nums">{lifetime} months</span>
                  <button
                    type="button"
                    aria-label="More months"
                    onClick={() => store.setLifetime(Math.min(60, lifetime + 3))}
                    disabled={lifetime >= 60}
                    className="size-11 rounded-full bg-white/10 text-xl font-bold hover:bg-white/15 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Longer missions return more science but cost more to run. At least {limits.minLifetimeMonths} months on this
                  difficulty.
                </p>
              </fieldset>
            </div>
          </Step>

          <Step n={2} title="Build the spacecraft" hint="Pick one of each. Swipe sideways on a phone to see every option.">
            <div className="space-y-6">
              {SLOTS.map(({ slot, category, title, hint }) => (
                <div key={slot} role="radiogroup" aria-label={title}>
                  <h3 className="font-semibold">
                    {title} <span className="text-sm font-normal text-slate-400">· {hint}</span>
                  </h3>
                  <div className="mt-2">
                    <CardRow>
                      {visible(partsIn(category)).map((p) => (
                        <CardSlot key={p.id}>
                          <OptionCard
                            name={p.name}
                            selected={selectedId(slot) === p.id}
                            onSelect={() => select(slot, p.id)}
                            stats={partStats(p)}
                            explain={p.explain}
                            source={p.source}
                            badge={
                              p.tier === 'advanced' && (
                                <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-[11px] text-violet-200">Advanced</span>
                              )
                            }
                          />
                        </CardSlot>
                      ))}
                    </CardRow>
                  </div>
                </div>
              ))}
            </div>
          </Step>

          <Step n={3} title="Pick instruments" hint="More instruments mean more science, but also more mass, power, money and data.">
            {!scenarioId && <p className="mb-3 text-sm text-amber-200">Choose a mission first to see which instruments fit it.</p>}
            <CardRow>
              {instruments.map((i) => {
                const fits = scenarioId ? i.goodFor.includes(scenarioId) : false
                return (
                  <CardSlot key={i.id}>
                    <OptionCard
                      multi
                      name={i.name}
                      selected={design.science.instrumentIds.includes(i.id)}
                      onSelect={() => store.toggleInstrument(i.id)}
                      stats={[
                        { label: 'Mass', value: `${i.massKg} kg` },
                        { label: 'Cost', value: `$${i.costM} M` },
                        { label: 'Uses', value: `${i.powerDrawW} W` },
                        { label: 'Data/day', value: `${(i.dataPerDayMbit / 1000).toFixed(1)} Gbit` },
                        { label: 'Science', value: `${i.scienceValue}/day` },
                        { label: 'Aim within', value: `${i.needsPointingDeg}°` },
                      ]}
                      explain={i.explain}
                      source={i.source}
                      badge={
                        <span className="flex flex-wrap gap-1">
                          {fits && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] text-emerald-200">Fits this mission</span>}
                          {i.tier === 'advanced' && (
                            <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-[11px] text-violet-200">Advanced</span>
                          )}
                        </span>
                      }
                    />
                  </CardSlot>
                )
              })}
            </CardRow>
          </Step>

          <div className="mt-10 lg:hidden">
            <Dashboard ev={ev} phase="design" anchorId="dashboard" />
          </div>

          <div className="mt-8 hidden flex-wrap items-center gap-4 lg:flex">
            <NextButton ready={ev.designReady} onClick={() => navigate('/mission/launch')} />
            <ResetButton onReset={store.reset} />
            {!ev.designReady && <p className="text-sm text-slate-400">Fix the {blockers} “Must fix” item{blockers === 1 ? '' : 's'} first.</p>}
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100svh-6rem)] overflow-y-auto pb-4">
            <Dashboard ev={ev} phase="design" />
          </div>
        </aside>
      </div>

      {/* Phone: always-visible status and Next */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-space-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <a href="#dashboard" className="min-w-0" aria-label="Show the full dashboard">
            <MiniStatus ev={ev} />
            <span className="mt-1 block text-xs text-slate-400">
              {ev.designReady ? 'Ready for launch' : `${blockers} to fix · tap for why`}
            </span>
          </a>
          <NextButton ready={ev.designReady} onClick={() => navigate('/mission/launch')} />
        </div>
      </div>
    </div>
  )
}

function NextButton({ ready, onClick }: { ready: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready}
      className="glow-cyan min-h-12 shrink-0 rounded-full bg-cyan-400 px-6 font-semibold text-space-950 transition hover:bg-cyan-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 disabled:shadow-none"
    >
      Next: Launch →
    </button>
  )
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button type="button" onClick={onReset} className="min-h-11 text-sm font-semibold text-slate-400 hover:text-slate-200">
      Start over
    </button>
  )
}

