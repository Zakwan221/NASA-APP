import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, CircleCheck, Lock, Rocket, Rotate3d, TriangleAlert } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { INSTRUMENTS, ORBITS, partById, partsIn, ROCKETS } from '../../../game/data'
import { evaluate } from '../../../game/engine/evaluate'
import { failureChance } from '../../../game/engine/launch'
import type { Part } from '../../../game/types'
import { BUILD_STEPS, stepDone, type Slot } from './buildSteps'
import { DndProvider, DropZone, type DragItem } from './components/dnd'
import ItemPicture from '../../../components/space/ItemPicture'
import OptionCard from './components/OptionCard'
import { WarningList } from './components/Warnings'
import { ROLE_NAMES, useDesignEditor } from './editor'

const CraftScene = lazy(() => import('./components/CraftScene'))
// Renders a picture of every part in the background (pulls in three.js, so lazy)
const ThumbnailStudio = lazy(() => import('../../../components/space/thumbnails'))

const EASE_OUT = [0.23, 1, 0.32, 1] as const

const fmtStorage = (mbit: number) => (mbit >= 8000 ? `${Math.round(mbit / 8000)} GB` : `${Math.round(mbit / 8)} MB`)
const fmtRange = (km: number) =>
  km >= 100_000_000 ? 'Deep space' : km >= 1_000_000 ? `${(km / 1_000_000).toFixed(1)}M km` : `${km.toLocaleString()} km`
const fmtRate = (kbps: number) => (kbps >= 1000 ? `${kbps / 1000} Mbps` : `${kbps} kbps`)
const pct = (n: number) => `${Math.round(n * 100)}%`

/** A part's numbers, with the one that makes it special first */
function partStats(p: Part) {
  const stats: { label: string; value: string }[] = []
  if (p.maxLoadKg) stats.push({ label: 'Carries', value: `${p.maxLoadKg} kg` })
  if (p.powerGenW) stats.push({ label: 'Makes', value: `${p.powerGenW} W` })
  if (p.capacityWh) stats.push({ label: 'Stores', value: `${p.capacityWh} Wh` })
  if (p.storageMbit) stats.push({ label: 'Storage', value: fmtStorage(p.storageMbit) })
  if (p.dataRateKbps) stats.push({ label: 'Speed', value: fmtRate(p.dataRateKbps) })
  if (p.pointingDeg !== undefined) stats.push({ label: 'Aims within', value: `${p.pointingDeg}°` })
  stats.push({ label: 'Cost', value: `$${p.costM} M` }, { label: 'Mass', value: `${p.massKg} kg` })
  if (p.maxRangeKm) stats.push({ label: 'Range', value: fmtRange(p.maxRangeKm) })
  if (p.powerDrawW) stats.push({ label: 'Uses', value: `${p.powerDrawW} W` })
  return stats
}

const Badge = ({ tone, children }: { tone: 'violet' | 'green' | 'red'; children: string }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-[11px] ${
      tone === 'violet' ? 'bg-violet-400/15 text-violet-200' : tone === 'green' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'
    }`}
  >
    {children}
  </span>
)

/**
 * Full-screen builder: the 3D spacecraft fills the screen and the player makes
 * one choice per step (tap a card, or drag it onto the spacecraft). Nothing is
 * required: every step can be skipped, and problems show up later in flight.
 */
export default function Builder({
  step,
  onStep,
  onExit,
  onFinish,
  finishLabel = 'To the launch pad',
}: {
  step: number
  onStep: (step: number) => void
  onExit: () => void
  onFinish: () => void
  /** Team play: "Vote: launch pad" */
  finishLabel?: string
}) {
  const store = useDesignEditor()
  const { design } = store
  const ev = useMemo(() => evaluate(design), [design])
  const [showProblems, setShowProblems] = useState(false)
  const current = BUILD_STEPS[step]
  const last = step === BUILD_STEPS.length - 1
  const scenarioId = design.planner.scenarioId
  const difficulty = design.planner.difficulty
  const showAdvanced = difficulty !== 'cadet'
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
  // Team play: each step belongs to one role; the others watch it change live
  const editable = store.canEdit(current.section)
  const owner = store.owner(current.section)

  /** A part or instrument dropped on the 3D spacecraft goes into its slot */
  const fit = (item: DragItem) => {
    if (item.kind === 'instrument') {
      if (store.canEdit('science') && !design.science.instrumentIds.includes(item.id)) store.toggleInstrument(item.id)
      return
    }
    const target = BUILD_STEPS.find((b) => b.category === partById(item.id)?.category)
    if (target?.slot && store.canEdit(target.section)) select(target.slot, item.id)
  }

  // "Pick a …" reminders are not problems: skipped steps already show as not done
  const problems = ev.warnings.filter((w) => !w.message.startsWith('Pick'))
  const stepProblems = problems.filter((w) => current.resources.includes(w.resource))
  const instruments = visible(INSTRUMENTS).sort(
    (a, b) => Number(b.goodFor.includes(scenarioId ?? '')) - Number(a.goodFor.includes(scenarioId ?? '')),
  )
  const orbit = ev.orbit

  const cards = () => {
    if (current.category) {
      return visible(partsIn(current.category)).map((p) => (
        <OptionCard
          key={p.id}
          name={p.name}
          selected={selectedId(current.slot!) === p.id}
          onSelect={() => select(current.slot!, p.id)}
          disabled={!editable}
          stats={partStats(p)}
          explain={p.explain}
          source={p.source}
          picture={<ItemPicture thumb={`part:${p.id}`} alt={p.name} />}
          dragItem={{ kind: 'part', id: p.id, name: p.name }}
          badge={p.tier === 'advanced' && <Badge tone="violet">Advanced</Badge>}
        />
      ))
    }
    if (current.id === 'instruments') {
      return instruments.map((i) => (
        <OptionCard
          key={i.id}
          multi
          name={i.name}
          selected={design.science.instrumentIds.includes(i.id)}
          onSelect={() => store.toggleInstrument(i.id)}
          disabled={!editable}
          dragItem={{ kind: 'instrument', id: i.id, name: i.name }}
          picture={<ItemPicture thumb={`instrument:${i.id}`} alt={i.name} />}
          stats={[
            { label: 'Science', value: `${i.scienceValue}/day` },
            { label: 'Cost', value: `$${i.costM} M` },
            { label: 'Uses', value: `${i.powerDrawW} W` },
            { label: 'Mass', value: `${i.massKg} kg` },
            { label: 'Data/day', value: `${(i.dataPerDayMbit / 1000).toFixed(1)} Gbit` },
            { label: 'Aim within', value: `${i.needsPointingDeg}°` },
          ]}
          explain={i.explain}
          source={i.source}
          badge={
            scenarioId && i.goodFor.includes(scenarioId) ? (
              <Badge tone="green">Good for this mission</Badge>
            ) : (
              <Badge tone="red">Not made for this mission</Badge>
            )
          }
        />
      ))
    }
    if (current.id === 'orbit') {
      return ORBITS.map((o) => {
        const view = ev.scenario ? (o.coverage[ev.scenario.id] ?? 0) : 0
        return (
          <OptionCard
            key={o.id}
            name={o.name}
            selected={design.comms.orbitId === o.id}
            onSelect={() => store.setOrbit(o.id)}
            disabled={!editable}
            picture={<ItemPicture orbit={o.id} alt={o.name} />}
            stats={[
              { label: 'Sees target', value: pct(view) },
              { label: 'Contact', value: o.contactMinPerDay >= 1440 ? 'All day' : `${o.contactMinPerDay} min/day` },
              { label: 'Lasts', value: `${o.maxLifetimeMonths} months` },
              { label: 'Distance', value: fmtRange(o.altitudeKm) },
              { label: 'In shadow', value: pct(o.shadowFraction) },
            ]}
            explain={o.explain}
            source={o.source}
            badge={view >= 0.9 ? <Badge tone="green">Best view</Badge> : view === 0 ? <Badge tone="red">Can’t see the target</Badge> : undefined}
          />
        )
      })
    }
    return ROCKETS.map((r) => {
      const cap = orbit ? r.capacityKg[orbit.id] : undefined
      return (
        <OptionCard
          key={r.id}
          name={r.name}
          selected={design.comms.launchVehicleId === r.id}
          onSelect={() => store.setRocket(r.id)}
          disabled={!editable}
          picture={<ItemPicture thumb={`rocket:${r.id}`} alt={r.name} />}
          stats={[
            { label: 'Works', value: `${pct(1 - failureChance(r, difficulty))} of the time` },
            { label: 'Cost', value: `$${r.costM} M` },
            { label: 'Carries', value: cap !== undefined ? `${cap.toLocaleString()} kg` : '—' },
          ]}
          explain={r.explain}
          source={r.source}
          badge={
            !orbit ? undefined : cap === undefined ? (
              <Badge tone="red">{`Can’t reach ${orbit.name}`}</Badge>
            ) : ev.massKg <= cap ? (
              <Badge tone="green">Strong enough</Badge>
            ) : (
              <Badge tone="red">{`Too weak: yours is ${ev.massKg} kg`}</Badge>
            )
          }
        />
      )
    })
  }

  return (
    <DndProvider>
      <Suspense fallback={null}>
        <ThumbnailStudio />
      </Suspense>
      <div className="fixed inset-0 z-[60] flex flex-col bg-space-950 lg:flex-row" role="dialog" aria-label="Spacecraft builder">
        {/* 3D view */}
        <DropZone onDrop={fit} className="min-h-0 flex-1">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Loading 3D…</div>}>
            <CraftScene design={design} zoom={1.05} />
          </Suspense>

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
                {ev.massKg} kg · ${ev.buildCostM} M of ${ev.limits.budgetM} M
              </p>
            </div>
            <ol className="pointer-events-auto mt-3 flex gap-1" aria-label="Build steps">
              {BUILD_STEPS.map((s, i) => {
                const done = stepDone(design, s)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onStep(i)}
                      aria-current={i === step ? 'step' : undefined}
                      title={s.title}
                      className={`flex size-8 items-center justify-center rounded-full transition ${
                        i === step ? 'bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.7)]' : done ? 'bg-emerald-400/30' : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <s.icon aria-hidden="true" className={`size-4 ${i === step ? 'text-space-950' : 'text-white'}`} />
                      <span className="sr-only">
                        {s.title} {done ? '(done)' : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
          <p className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/40 px-3 py-1 text-xs text-slate-200 backdrop-blur">
            <Rotate3d aria-hidden="true" className="size-3.5" /> Hold and drag to turn it
          </p>
        </DropZone>

        {/* Choice panel: bottom sheet on phones, side panel on desktop */}
        <section className="relative flex max-h-[55svh] flex-col border-t border-white/10 bg-space-900/95 backdrop-blur lg:max-h-none lg:w-[440px] lg:border-l lg:border-t-0">
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
                <p className="mt-1 text-sm text-slate-300">{current.hint}</p>
                {owner && (
                  <p
                    className={`mt-2 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${
                      editable ? 'bg-cyan-300/10 text-cyan-100' : 'bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    {editable ? (
                      <>
                        <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-cyan-300" /> Your call, {ROLE_NAMES[current.section]}.
                        The crew sees every change.
                      </>
                    ) : (
                      <>
                        <Lock aria-hidden="true" className="size-4 shrink-0 text-slate-400" /> {owner} chooses this. Watch it change live,
                        and talk it through together.
                      </>
                    )}
                  </p>
                )}
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <div
                  role={current.id === 'instruments' ? 'group' : 'radiogroup'}
                  aria-label={current.title}
                  className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:overflow-visible lg:px-0"
                >
                  {cards().map((card) => (
                    <div key={card.key} className="w-64 shrink-0 snap-start lg:w-auto">
                      {card}
                    </div>
                  ))}
                </div>
                {stepProblems.length > 0 && (
                  <div className="mt-3">
                    <WarningList warnings={stepProblems.slice(0, 2)} />
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Every problem, on request */}
          {showProblems && (
            <div className="absolute inset-x-0 bottom-[72px] z-10 max-h-[60%] overflow-y-auto border-t border-white/10 bg-space-900 p-4 shadow-2xl">
              <p className="mb-2 text-sm font-semibold">Things to check</p>
              <WarningList warnings={problems} />
            </div>
          )}

          <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={() => setShowProblems((v) => !v)}
              aria-expanded={showProblems}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${
                problems.length ? 'bg-amber-300/15 text-amber-200' : 'bg-emerald-400/15 text-emerald-200'
              }`}
            >
              {problems.length ? <TriangleAlert aria-hidden="true" className="size-4" /> : <CircleCheck aria-hidden="true" className="size-4" />}
              {problems.length ? `${problems.length} to check` : 'All good'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => (step === 0 ? onExit() : onStep(step - 1))}
                className="min-h-12 rounded-full bg-white/10 px-5 font-semibold hover:bg-white/15"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => (last ? onFinish() : onStep(step + 1))}
                className="glow-cyan min-h-12 rounded-full bg-cyan-400 px-6 font-semibold text-space-950 transition hover:bg-cyan-300 active:scale-[0.98]"
              >
                {last ? (
                  <>
                    {finishLabel} <Rocket aria-hidden="true" className="ml-1 inline size-4" />
                  </>
                ) : stepDone(design, current) ? (
                  'Next →'
                ) : (
                  'Skip →'
                )}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </DndProvider>
  )
}
