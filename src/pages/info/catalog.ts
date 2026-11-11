/**
 * Every item in the game in one shape for the Items page: what it is, its
 * numbers, and a few measures to compare it with the other choices.
 */

import { BatteryFull, Box, Cpu, Crosshair, Orbit, RadioTower, Rocket, Sun, Telescope, type LucideIcon } from 'lucide-react'
import { INSTRUMENTS, ORBITS, partsIn, ROCKETS } from '../../game/data'
import type { ItemKind } from '../../components/space/ItemModel'
import type { OrbitId, Part, PartCategory } from '../../game/types'

export interface Measure {
  label: string
  value: number
  /** How to show the number */
  text: string
  /** Bigger is better (green bar) or worse (amber bar) */
  higherIsBetter: boolean
  /** Use a log scale (for ranges like 9.6 kbps to 20,000 kbps) */
  log?: boolean
}

export interface CatalogItem {
  id: string
  name: string
  explain: string
  source: string
  advanced: boolean
  /** 3D model, or an orbit diagram */
  model?: { kind: ItemKind; id: string }
  orbit?: OrbitId
  measures: Measure[]
}

export interface CatalogGroup {
  id: string
  title: string
  icon: LucideIcon
  /** What this kind of item does, in one line */
  intro: string
  items: CatalogItem[]
}

const gb = (mbit: number) => (mbit >= 8000 ? `${Math.round(mbit / 8000)} GB` : `${Math.round(mbit / 8)} MB`)
const km = (n: number) => (n >= 100_000_000 ? 'Deep space' : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M km` : `${n.toLocaleString()} km`)
const speed = (kbps: number) => (kbps >= 1000 ? `${kbps / 1000} Mbps` : `${kbps} kbps`)

const mass = (kg: number): Measure => ({ label: 'Mass', value: kg, text: `${kg} kg`, higherIsBetter: false })
const cost = (m: number): Measure => ({ label: 'Cost', value: m, text: `$${m} M`, higherIsBetter: false })
const power = (w: number): Measure => ({ label: 'Power used', value: w, text: `${w} W`, higherIsBetter: false })

function partMeasures(p: Part): Measure[] {
  switch (p.category) {
    case 'structure':
      return [{ label: 'Carries', value: p.maxLoadKg ?? 0, text: `${p.maxLoadKg} kg`, higherIsBetter: true }, mass(p.massKg), cost(p.costM)]
    case 'power':
      return [{ label: 'Makes', value: p.powerGenW ?? 0, text: `${p.powerGenW} W`, higherIsBetter: true }, mass(p.massKg), cost(p.costM)]
    case 'battery':
      return [{ label: 'Stores', value: p.capacityWh ?? 0, text: `${p.capacityWh} Wh`, higherIsBetter: true }, mass(p.massKg), cost(p.costM)]
    case 'computer':
      return [{ label: 'Storage', value: p.storageMbit ?? 0, text: gb(p.storageMbit ?? 0), higherIsBetter: true, log: true }, power(p.powerDrawW), cost(p.costM)]
    case 'attitude':
      // Smaller angle = sharper aim, so show 1/angle as the bar
      return [
        { label: 'Sharp aim', value: 1 / (p.pointingDeg ?? 1), text: `within ${p.pointingDeg}°`, higherIsBetter: true, log: true },
        power(p.powerDrawW),
        cost(p.costM),
      ]
    case 'comms':
      return [
        { label: 'Speed', value: p.dataRateKbps ?? 0, text: speed(p.dataRateKbps ?? 0), higherIsBetter: true, log: true },
        { label: 'Range', value: p.maxRangeKm ?? 0, text: km(p.maxRangeKm ?? 0), higherIsBetter: true, log: true },
        power(p.powerDrawW),
        cost(p.costM),
      ]
  }
}

const partGroup = (id: string, title: string, icon: LucideIcon, category: PartCategory, intro: string): CatalogGroup => ({
  id,
  title,
  icon,
  intro,
  items: partsIn(category).map((p) => ({
    id: p.id,
    name: p.name,
    explain: p.explain,
    source: p.source,
    advanced: p.tier === 'advanced',
    model: { kind: 'part', id: p.id },
    measures: partMeasures(p),
  })),
})

export const CATALOG: CatalogGroup[] = [
  partGroup('frames', 'Frames', Box, 'structure', 'The body. It decides how much everything can weigh.'),
  partGroup('solar', 'Solar panels', Sun, 'power', 'Turn sunlight into power.'),
  partGroup('batteries', 'Batteries', BatteryFull, 'battery', 'Keep things running in Earth’s shadow.'),
  partGroup('computers', 'Computers', Cpu, 'computer', 'Run the spacecraft and store data.'),
  partGroup('pointing', 'Pointing', Crosshair, 'attitude', 'Aim the instruments at the target.'),
  partGroup('radios', 'Radios', RadioTower, 'comms', 'Send your data home.'),
  {
    id: 'instruments',
    title: 'Instruments',
    icon: Telescope,
    intro: 'Do the science. Each one is made for one kind of mission.',
    items: INSTRUMENTS.map((i) => ({
      id: i.id,
      name: i.name,
      explain: i.explain,
      source: i.source,
      advanced: i.tier === 'advanced',
      model: { kind: 'instrument' as const, id: i.id },
      measures: [
        { label: 'Science', value: i.scienceValue, text: `${i.scienceValue} / day`, higherIsBetter: true },
        { label: 'Data', value: i.dataPerDayMbit, text: `${(i.dataPerDayMbit / 1000).toFixed(1)} Gbit / day`, higherIsBetter: false },
        power(i.powerDrawW),
        cost(i.costM),
        mass(i.massKg),
      ],
    })),
  },
  {
    id: 'orbits',
    title: 'Orbits',
    icon: Orbit,
    intro: 'Where the spacecraft flies.',
    items: ORBITS.map((o) => ({
      id: o.id,
      name: o.name,
      explain: o.explain,
      source: o.source,
      advanced: false,
      orbit: o.id,
      measures: [
        { label: 'Lasts', value: o.maxLifetimeMonths, text: `${o.maxLifetimeMonths} months`, higherIsBetter: true },
        { label: 'Contact', value: o.contactMinPerDay, text: o.contactMinPerDay >= 1440 ? 'All day' : `${o.contactMinPerDay} min/day`, higherIsBetter: true, log: true },
        { label: 'In shadow', value: o.shadowFraction, text: `${Math.round(o.shadowFraction * 100)}%`, higherIsBetter: false },
        { label: 'Distance', value: o.altitudeKm, text: km(o.altitudeKm), higherIsBetter: false, log: true },
      ],
    })),
  },
  {
    id: 'rockets',
    title: 'Rockets',
    icon: Rocket,
    intro: 'Carry the spacecraft to its orbit.',
    items: ROCKETS.map((r) => {
      const most = Math.max(...Object.values(r.capacityKg).map((v) => v ?? 0))
      return {
        id: r.id,
        name: r.name,
        explain: r.explain,
        source: r.source,
        advanced: false,
        model: { kind: 'rocket' as const, id: r.id },
        measures: [
          { label: 'Carries up to', value: most, text: `${most.toLocaleString()} kg`, higherIsBetter: true, log: true },
          { label: 'Works', value: 1 - r.failureRate, text: `${Math.round((1 - r.failureRate) * 100)}% of launches`, higherIsBetter: true },
          cost(r.costM),
        ],
      }
    }),
  },
]

/** Bar length 0..1 for a measure, compared with the same measure on the other items */
export function barFill(group: CatalogGroup, m: Measure): number {
  const values = group.items.map((it) => it.measures.find((x) => x.label === m.label)?.value ?? 0).filter((v) => v > 0)
  const max = Math.max(...values)
  const min = Math.min(...values)
  if (max <= 0) return 0
  if (m.log) {
    const lo = Math.log10(Math.max(min, 1e-6)) - 0.3
    return Math.max(0.06, (Math.log10(Math.max(m.value, 1e-6)) - lo) / (Math.log10(max) - lo))
  }
  return Math.max(0.06, m.value / max)
}
