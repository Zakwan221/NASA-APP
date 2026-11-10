import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Rocket, Rotate3d } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import { INSTRUMENTS, partById, partsIn } from '../../../game/data'
import { evaluate } from '../../../game/engine/evaluate'
import type { Part, Warning } from '../../../game/types'
import { useMission } from '../../../store/missionStore'
import Dashboard, { MiniStatus, WarningList } from './components/Dashboard'
import { DndProvider, DropZone, type DragItem } from './components/dnd'
import OptionCard from './components/OptionCard'
import { BUILD_STEPS, type BuildStep, type Slot } from './buildSteps'

const CraftScene = lazy(() => import('./components/CraftScene'))

const EASE_OUT = [0.23, 1, 0.32, 1] as const

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

const Badge = ({ tone, children }: { tone: 'violet' | 'green'; children: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-[11px] ${tone === 'violet' ? 'bg-violet-400/15 text-violet-200' : 'bg-emerald-400/15 text-emerald-200'}`}>
    {children}
  </span>
)

/**
 * Full-screen builder: the 3D spacecraft fills the screen and the player picks
 * one kind of part per step (tap a card, or drag it onto the spacecraft).
 */
export default function Builder({
  step,
  onStep,
  onExit,
  onFinish,
}: {
  step: number
  onStep: (step: number) => void
  onExit: () => void
  onFinish: () => void
}) {
  const store = useMission()
  const { design } = store
  const ev = useMemo(() => evaluate(design), [design])
  const current = BUILD_STEPS[step]
  const scenarioId = design.planner.scenarioId
  const showAdvanced = design.planner.difficulty !== 'cadet'
  const visible = <T extends { tier: string }>(items: T[]) => items.filter((i) => showAdvanced || i.tier === 'simple')

  // Full screen: stop the page behind from scrolling
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const selectedId = (slot: Slot) => (slot === 'radio' ? design.comms.radioId : design.engineer[slot])
  const select = (slot: Slot, id: string) => (slot === 'radio' ? store.setRadio(id) : store.setPart(slot, id))

  /** A part or instrument dropped on the 3D spacecraft goes into its slot */
  const fit = (item: DragItem) => {
    if (item.kind === 'instrument') {
      if (!design.science.instrumentIds.includes(item.id)) store.toggleInstrument(item.id)
      return
    }
    const s = BUILD_STEPS.find((b) => b.category === partById(item.id)?.category)?.slot
    if (s) select(s, item.id)
  }

  const stepDone = (s: BuildStep) =>
    s.slot ? Boolean(selectedId(s.slot)) : s.id === 'instruments' ? design.science.instrumentIds.length > 0 : ev.designReady
  const canNext = current.id === 'review' ? ev.designReady : stepDone(current)
  const stepWarnings: Warning[] = ev.warnings.filter(
    (w) => w.phase === 'design' && current.resources.includes(w.resource) && !(w.blocking && w.message.startsWith('Pick')),
  )
  const blockers = ev.warnings.filter((w) => w.blocking && w.phase === 'design').length

  const instruments = visible(INSTRUMENTS).sort(
    (a, b) => Number(b.goodFor.includes(scenarioId ?? '')) - Number(a.goodFor.includes(scenarioId ?? '')),
  )

  return (
    <DndProvider>
      <div className="fixed inset-0 z-[60] flex flex-col bg-space-950 lg:flex-row" role="dialog" aria-label="Spacecraft builder">
        {/* 3D view */}
        <DropZone onDrop={fit} className="min-h-0 flex-1">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Loading 3D…</div>}>
            <CraftScene design={design} zoom={1.05} />
          </Suspense>

          {/* Top bar over the 3D view */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-space-950/90 to-transparent p-3 pb-8">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onExit}
                className="pointer-events-auto min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold backdrop-blur hover:bg-white/15"
              >
                <ChevronLeft aria-hidden="true" className="-ml-1 mr-1 inline size-4" />
                Mission
              </button>
              <p className="text-right text-xs text-slate-300">
                <span className="block font-semibold text-white">{ev.scenario?.title}</span>
                {ev.massKg} kg · ${ev.buildCostM} M built
              </p>
            </div>
            <ol className="pointer-events-auto mt-3 flex gap-1.5 overflow-x-auto" aria-label="Build steps">
              {BUILD_STEPS.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onStep(i)}
                    aria-current={i === step ? 'step' : undefined}
                    title={s.title}
                    className={`flex size-9 items-center justify-center rounded-full text-base transition ${
                      i === step
                        ? 'bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.7)]'
                        : stepDone(s)
                          ? 'bg-emerald-400/30'
                          : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <s.icon aria-hidden="true" className={`size-4 ${i === step ? 'text-space-950' : 'text-white'}`} />
                    <span className="sr-only">
                      {s.title} {stepDone(s) ? '(done)' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <p className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs text-slate-200 backdrop-blur">
            <Rotate3d aria-hidden="true" className="size-3.5" /> Hold and drag to turn it
          </p>
        </DropZone>

        {/* Choice panel: bottom sheet on phones, side panel on desktop */}
        <section className="flex max-h-[55svh] flex-col border-t border-white/10 bg-space-900/95 backdrop-blur lg:max-h-none lg:w-[440px] lg:border-l lg:border-t-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <header className="px-4 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  Step {step + 1} of {BUILD_STEPS.length}
                </p>
                <h2 className="mt-0.5 text-xl font-bold">
                  <current.icon aria-hidden="true" className="mr-2 inline size-5 -translate-y-0.5 text-cyan-300" />
                  {current.title}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {current.hint}
                  {current.id !== 'review' && <span className="hidden sm:inline"> Tap a card or drag it onto the spacecraft.</span>}
                </p>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {current.id === 'review' ? (
                  <Dashboard ev={ev} phase="design" />
                ) : (
                  <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:overflow-visible lg:px-0">
                    {current.category
                      ? visible(partsIn(current.category)).map((p) => (
                          <div key={p.id} className="w-60 shrink-0 snap-start lg:w-auto">
                            <OptionCard
                              name={p.name}
                              selected={selectedId(current.slot!) === p.id}
                              onSelect={() => select(current.slot!, p.id)}
                              stats={partStats(p)}
                              explain={p.explain}
                              source={p.source}
                              dragItem={{ kind: 'part', id: p.id, name: p.name }}
                              badge={p.tier === 'advanced' && <Badge tone="violet">Advanced</Badge>}
                            />
                          </div>
                        ))
                      : instruments.map((i) => {
                          const fits = scenarioId ? i.goodFor.includes(scenarioId) : false
                          return (
                            <div key={i.id} className="w-60 shrink-0 snap-start lg:w-auto">
                              <OptionCard
                                multi
                                name={i.name}
                                selected={design.science.instrumentIds.includes(i.id)}
                                onSelect={() => store.toggleInstrument(i.id)}
                                dragItem={{ kind: 'instrument', id: i.id, name: i.name }}
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
                                    {fits && <Badge tone="green">Fits this mission</Badge>}
                                    {i.tier === 'advanced' && <Badge tone="violet">Advanced</Badge>}
                                  </span>
                                }
                              />
                            </div>
                          )
                        })}
                  </div>
                )}

                {current.id !== 'review' && stepWarnings.length > 0 && (
                  <div className="mt-3">
                    <WarningList warnings={stepWarnings.slice(0, 2)} />
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
            <div className="hidden sm:block">
              <MiniStatus ev={ev} />
            </div>
            <div className="flex flex-1 justify-end gap-2">
              <button
                type="button"
                onClick={() => (step === 0 ? onExit() : onStep(step - 1))}
                className="min-h-12 rounded-full bg-white/10 px-5 font-semibold hover:bg-white/15"
              >
                Back
              </button>
              {current.id === 'review' ? (
                <button
                  type="button"
                  onClick={onFinish}
                  disabled={!canNext}
                  className="glow-cyan min-h-12 rounded-full bg-cyan-400 px-6 font-semibold text-space-950 transition hover:bg-cyan-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 disabled:shadow-none"
                >
                  {canNext ? (
                    <>
                      Go to launch <Rocket aria-hidden="true" className="ml-1 inline size-4" />
                    </>
                  ) : (
                    `${blockers} to fix`
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onStep(step + 1)}
                  disabled={!canNext}
                  className="min-h-12 rounded-full bg-cyan-400 px-6 font-semibold text-space-950 transition hover:bg-cyan-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400"
                >
                  {canNext ? 'Next →' : current.id === 'instruments' ? 'Pick at least one' : 'Pick one'}
                </button>
              )}
            </div>
          </footer>
        </section>
      </div>
    </DndProvider>
  )
}
