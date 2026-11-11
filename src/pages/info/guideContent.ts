/**
 * Everything the "How to play" guide says, in plain words. Kept apart from the
 * layout so it is easy to edit or translate.
 */

import {
  BatteryFull,
  Box,
  Cpu,
  Crosshair,
  Hourglass,
  HardDrive,
  RadioTower,
  Sun,
  Telescope,
  Wallet,
  Weight,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { CraftPart } from '../../components/space/CraftModel'
import type { PartCategory, ResourceKey } from '../../game/types'

export interface Effect {
  /** What changes, e.g. "Power" */
  label: string
  /** Does picking a bigger one raise or lower it? */
  up: boolean
  /** Is that change good for you? */
  good: boolean
}

export interface GuidePart {
  part: CraftPart
  title: string
  icon: LucideIcon
  /** Where its choices come from in the game data */
  category?: PartCategory
  what: string
  effects: Effect[]
  wrong: string
  tip: string
}

export const GUIDE_PARTS: GuidePart[] = [
  {
    part: 'frame',
    title: 'Frame',
    icon: Box,
    category: 'structure',
    what: 'The body. Every other part is bolted onto it.',
    effects: [
      { label: 'Carries more', up: true, good: true },
      { label: 'Mass', up: true, good: false },
      { label: 'Cost', up: true, good: false },
    ],
    wrong: 'Too small, and everything you add makes it too heavy for the frame.',
    tip: 'A 6U or 12U CubeSat frame fits most missions.',
  },
  {
    part: 'solar',
    title: 'Solar panels',
    icon: Sun,
    category: 'power',
    what: 'Turn sunlight into electricity for everything on board.',
    effects: [
      { label: 'Power', up: true, good: true },
      { label: 'Mass', up: true, good: false },
      { label: 'Cost', up: true, good: false },
    ],
    wrong: 'Not enough power, and your instruments can only run part of the time, so you collect less science.',
    tip: 'Fold-out wings make five times more power than cells on the body.',
  },
  {
    part: 'battery',
    title: 'Battery',
    icon: BatteryFull,
    category: 'battery',
    what: 'Stores energy for when Earth blocks the Sun.',
    effects: [
      { label: 'Power in shadow', up: true, good: true },
      { label: 'Mass', up: true, good: false },
    ],
    wrong: 'Too small, and the instruments switch off every time you fly through Earth’s shadow.',
    tip: 'Low orbits spend about a third of every lap in shadow.',
  },
  {
    part: 'computer',
    title: 'Computer',
    icon: Cpu,
    category: 'computer',
    what: 'Runs the spacecraft and keeps your data until it can be sent home.',
    effects: [
      { label: 'Storage', up: true, good: true },
      { label: 'Power used', up: true, good: false },
    ],
    wrong: 'When storage is full, new data is deleted, and that science is lost.',
    tip: 'Cameras make lots of data. Pair them with a big computer or a fast radio.',
  },
  {
    part: 'attitude',
    title: 'Pointing',
    icon: Crosshair,
    category: 'attitude',
    what: 'Turns the spacecraft so the instruments aim at the target.',
    effects: [
      { label: 'Sharper aim', up: true, good: true },
      { label: 'Power used', up: true, good: false },
      { label: 'Cost', up: true, good: false },
    ],
    wrong: 'If it can’t aim as precisely as an instrument needs, the pictures blur and you lose most of the science.',
    tip: 'Each instrument says how precisely it must be aimed. Match it.',
  },
  {
    part: 'radio',
    title: 'Radio',
    icon: RadioTower,
    category: 'comms',
    what: 'Sends your data and science home to Earth.',
    effects: [
      { label: 'Data sent home', up: true, good: true },
      { label: 'Range', up: true, good: true },
      { label: 'Power used', up: true, good: false },
    ],
    wrong: 'Too slow, and data piles up and gets lost. Too weak for a far orbit, and nobody hears it at all.',
    tip: 'Far orbits need strong radios: X-band reaches L1, deep space needs a transponder.',
  },
  {
    part: 'instruments',
    title: 'Instruments',
    icon: Telescope,
    what: 'The reason for the mission: cameras, spectrometers, radar and more.',
    effects: [
      { label: 'Science', up: true, good: true },
      { label: 'Data', up: true, good: false },
      { label: 'Power used', up: true, good: false },
      { label: 'Cost', up: true, good: false },
    ],
    wrong: 'Instruments made for a different mission only collect 20% of their science.',
    tip: 'Look for the green “Good for this mission” tag.',
  },
]

export interface GuideResource {
  key: ResourceKey
  icon: LucideIcon
  title: string
  text: string
  /** How full the example bar is (0..1) */
  fill: number
}

export const GUIDE_RESOURCES: GuideResource[] = [
  { key: 'mass', icon: Weight, title: 'Mass', text: 'Must fit the frame and the rocket.', fill: 0.62 },
  { key: 'power', icon: Zap, title: 'Power', text: 'Made by solar panels, used by everything.', fill: 0.8 },
  { key: 'budget', icon: Wallet, title: 'Budget', text: 'Parts, the launch and every month of flying.', fill: 0.55 },
  { key: 'data', icon: HardDrive, title: 'Data', text: 'Made by instruments, sent home by the radio.', fill: 0.9 },
  { key: 'comms', icon: RadioTower, title: 'Comms', text: 'Earth must be able to hear you.', fill: 0.4 },
  { key: 'lifetime', icon: Hourglass, title: 'Lifetime', text: 'How long the orbit lasts before it ends.', fill: 0.7 },
]

export const GUIDE_ORBITS = [
  { name: 'Low Earth orbit', text: 'Close, cheap and sharp, but drag pulls you down in about 2 years.', color: '#67e8f9' },
  { name: 'Sun-synchronous', text: 'Passes over every place at the same time each day. Great for Earth photos.', color: '#a78bfa' },
  { name: 'Geostationary', text: 'Far away, watching the same half of Earth all day.', color: '#fbbf24' },
  { name: 'L1 and deep space', text: 'For watching the Sun or visiting an asteroid. Needs a strong radio.', color: '#f472b6' },
]

export const GUIDE_SCORE = [
  { label: 'Mission success', points: 40, text: 'Did it fly long enough and do its job?' },
  { label: 'Science', points: 25, text: 'How much science reached Earth.' },
  { label: 'Efficiency', points: 20, text: 'Data sent home, money left, a healthy spacecraft.' },
  { label: 'Handling surprises', points: 15, text: 'How well your spacecraft rides out storms, junk and glitches.' },
]
