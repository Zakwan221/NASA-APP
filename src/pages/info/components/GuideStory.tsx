import { motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleAlert,
  Flame,
  Lightbulb,
  Orbit,
  PauseCircle,
  Rocket,
  Satellite,
  Trophy,
  Users,
  WifiOff,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ItemPicture from '../../../components/space/ItemPicture'
import { INSTRUMENTS, partsIn } from '../../../game/data'
import { GUIDE_ORBITS, GUIDE_PARTS, GUIDE_RESOURCES, GUIDE_SCORE, type GuidePart } from '../guideContent'

// three.js is big: load the 3D (and the part pictures) after the text
const GuideScene = lazy(() => import('./GuideScene'))
const ThumbnailStudio = lazy(() => import('../../../components/space/thumbnails'))

const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** One screen of the guide. The 3D sits right (desktop) or above (phone). */
function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-svh max-w-6xl flex-col justify-end px-3 pb-4 pt-20 sm:px-6 lg:justify-center lg:pb-0">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.55 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="pointer-events-auto max-h-[58svh] w-full overflow-y-auto rounded-3xl border border-white/10 bg-space-950/75 p-5 shadow-2xl backdrop-blur-md sm:p-6 lg:max-h-none lg:max-w-md lg:overflow-visible"
      >
        {children}
      </motion.div>
    </div>
  )
}

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{children}</p>
)
const Title = ({ children }: { children: ReactNode }) => <h2 className="font-display text-2xl font-bold leading-tight sm:text-4xl">{children}</h2>
const Body = ({ children }: { children: ReactNode }) => <p className="mt-2 text-slate-300 sm:text-lg">{children}</p>

/* ---------------- screens ---------------- */

const PHASES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Wrench, title: 'Design', text: 'Choose a mission and build a spacecraft from parts.' },
  { icon: Rocket, title: 'Launch', text: 'Pick an orbit and a rocket strong enough to get there.' },
  { icon: Orbit, title: 'Fly', text: 'Fly month by month and deal with surprises.' },
  { icon: Trophy, title: 'Report', text: 'Get a score out of 100, learn why, and try again.' },
]

function PartPanel({ gp, index }: { gp: GuidePart; index: number }) {
  // A few real options, with their pictures, so players recognise them in the game
  const choices = gp.category
    ? partsIn(gp.category).slice(0, 4).map((p) => ({ key: `part:${p.id}`, name: p.name }))
    : INSTRUMENTS.filter((i) => i.goodFor.includes('earth-watch')).map((i) => ({ key: `instrument:${i.id}`, name: i.name }))
  return (
    <Panel>
      <Eyebrow>
        Part {index + 1} of {GUIDE_PARTS.length}
      </Eyebrow>
      <Title>
        <gp.icon aria-hidden="true" className="mr-2 inline size-7 -translate-y-0.5 text-cyan-300" />
        {gp.title}
      </Title>
      <Body>{gp.what}</Body>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Pick a bigger one and…</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {gp.effects.map((e) => (
          <li
            key={e.label}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${
              e.good ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-300/15 text-amber-200'
            }`}
          >
            {e.up ? <ArrowUp aria-hidden="true" className="size-3.5" /> : <ArrowDown aria-hidden="true" className="size-3.5" />}
            {e.label}
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-4 gap-2" aria-label={`${gp.title} options in the game`}>
        {choices.map((c) => (
          <figure key={c.key} className="text-center">
            <ItemPicture thumb={c.key} alt={c.name} />
            <figcaption className="mt-1 text-[10px] leading-tight text-slate-400 sm:text-[11px]">{c.name}</figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-4 flex gap-2 text-sm text-rose-100">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-rose-300" />
        <span>
          <strong>Get it wrong:</strong> {gp.wrong}
        </span>
      </p>
      <p className="mt-2 flex gap-2 text-sm text-cyan-100">
        <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-300" />
        <span>
          <strong>Tip:</strong> {gp.tip}
        </span>
      </p>
    </Panel>
  )
}

/** A bar that fills when it scrolls into view */
function Bar({ fill, color = 'bg-cyan-300' }: { fill: number; color?: string }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        whileInView={{ width: `${fill * 100}%` }}
        viewport={{ once: false, amount: 0.8 }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
      />
    </div>
  )
}

const OUTCOMES: { icon: LucideIcon; title: string; text: string; tone: string }[] = [
  { icon: Rocket, title: 'Perfect launch', text: 'Straight to orbit.', tone: 'text-emerald-300' },
  { icon: PauseCircle, title: 'Countdown hold', text: 'Wind or a fault: it still flies, but costs money.', tone: 'text-amber-300' },
  { icon: Flame, title: 'Too heavy or unlucky', text: 'The rocket fails. Build another.', tone: 'text-rose-300' },
  { icon: WifiOff, title: 'Signal lost', text: 'It reached orbit, but the radio can’t be heard.', tone: 'text-rose-300' },
]

/** Number of screens: intro, apart, 7 parts, resources, orbits, launch, fly, score, start */
export const GUIDE_SCREENS = 15

/**
 * "How to play": a tall section whose scroll position drives the 3D scene
 * pinned behind it. One idea per screen.
 */
export default function GuideStory() {
  const section = useRef<HTMLElement>(null)
  // Which screen the reader is on (fractional between screens). Read by the 3D every frame.
  const step = useRef(0)

  useEffect(() => {
    const update = () => {
      const el = section.current
      if (!el) return
      step.current = Math.min(GUIDE_SCREENS - 1, Math.max(0, -el.getBoundingClientRect().top / window.innerHeight))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <section ref={section} className="relative" style={{ height: `${GUIDE_SCREENS * 100}svh` }} aria-label="How to play">
      <Suspense fallback={null}>
        <ThumbnailStudio />
      </Suspense>

      <div className="sticky top-0 h-svh overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,rgba(34,211,238,0.12),transparent_60%)]" />
        <Suspense fallback={null}>
          <GuideScene step={step} />
        </Suspense>
      </div>

      <div className="pointer-events-none absolute inset-0">
        {/* 0. Intro */}
        <Panel>
          <Eyebrow>How to play</Eyebrow>
          <h1 className="bg-gradient-to-r from-cyan-200 via-white to-violet-300 bg-clip-text font-display text-3xl font-bold leading-tight text-transparent sm:text-5xl">
            Build it. Launch it. Fly it.
          </h1>
          <Body>The Orbitly mission game in four steps:</Body>
          <ol className="mt-4 space-y-2">
            {PHASES.map((ph, i) => (
              <motion.li
                key={ph.title}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: EASE_OUT }}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/15">
                  <ph.icon aria-hidden="true" className="size-5 text-cyan-300" />
                </span>
                <span>
                  <span className="block font-semibold">
                    {i + 1}. {ph.title}
                  </span>
                  <span className="text-sm text-slate-400">{ph.text}</span>
                </span>
              </motion.li>
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Scroll to take a spacecraft apart <ChevronDown aria-hidden="true" className="size-4 animate-bounce" />
          </p>
        </Panel>

        {/* 1. Apart */}
        <Panel>
          <Eyebrow>Inside a spacecraft</Eyebrow>
          <Title>7 kinds of parts, one balance</Title>
          <Body>
            Every part helps your mission, but every part also <strong className="text-white">adds weight</strong>,{' '}
            <strong className="text-white">uses power</strong> and <strong className="text-white">costs money</strong>. Your job is to find the
            right mix.
          </Body>
          <p className="mt-3 text-sm text-slate-400">Scroll on to meet each part.</p>
        </Panel>

        {/* 2–8. Parts */}
        {GUIDE_PARTS.map((gp, i) => (
          <PartPanel key={gp.part} gp={gp} index={i} />
        ))}

        {/* 9. Resources */}
        <Panel>
          <Eyebrow>Your dashboard</Eyebrow>
          <Title>Six things to balance</Title>
          <Body>The game watches these while you build. A red bar means trouble ahead.</Body>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {GUIDE_RESOURCES.map((r) => (
              <li key={r.key} className="rounded-2xl bg-white/[0.06] p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <r.icon aria-hidden="true" className="size-4 text-cyan-300" /> {r.title}
                </p>
                <Bar fill={r.fill} color={r.fill > 0.85 ? 'bg-amber-300' : 'bg-cyan-300'} />
                <p className="mt-1.5 text-xs text-slate-400">{r.text}</p>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 10. Orbits */}
        <Panel>
          <Eyebrow>Where to fly</Eyebrow>
          <Title>Pick an orbit</Title>
          <Body>Each orbit sees your target differently, lasts a different time and needs a different radio.</Body>
          <ul className="mt-4 space-y-2">
            {GUIDE_ORBITS.map((o) => (
              <li key={o.name} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
                <span>
                  <strong>{o.name}:</strong> <span className="text-slate-300">{o.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 11. Launch */}
        <Panel>
          <Eyebrow>Launch day</Eyebrow>
          <Title>Pick a rocket strong enough</Title>
          <Body>
            Your <strong className="text-white">chance of success</strong> comes from how reliable the rocket is, whether it can lift your
            spacecraft, and whether Earth can hear your radio. You can always launch: problems show up as what happens next.
          </Body>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <li key={o.title} className="rounded-2xl bg-white/[0.06] p-3 text-sm">
                <p className={`flex items-center gap-1.5 font-semibold ${o.tone}`}>
                  <o.icon aria-hidden="true" className="size-4" /> {o.title}
                </p>
                <p className="mt-1 text-xs text-slate-400">{o.text}</p>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 12. Fly */}
        <Panel>
          <Eyebrow>In orbit</Eyebrow>
          <Title>Fly it month by month</Title>
          <Body>Each month your panels make power, instruments collect data, the radio sends it home, and money is spent.</Body>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              'Surprises happen: solar storms, space junk, a broken instrument.',
              'You choose what to do. Each choice has a cost and a risk.',
              'Science only counts once its data reaches Earth.',
            ].map((line) => (
              <li key={line} className="flex gap-2 text-slate-300">
                <Satellite aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-300" /> {line}
              </li>
            ))}
          </ul>
        </Panel>

        {/* 13. Score */}
        <Panel>
          <Eyebrow>Mission report</Eyebrow>
          <Title>Your score out of 100</Title>
          <Body>And the report explains why, with a tip for each part you can improve.</Body>
          <ul className="mt-4 space-y-3">
            {GUIDE_SCORE.map((sc) => (
              <li key={sc.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{sc.label}</span>
                  <span className="tabular-nums text-cyan-200">{sc.points} pts</span>
                </div>
                <Bar fill={sc.points / 40} color="bg-gradient-to-r from-cyan-400 to-violet-400" />
                <p className="mt-1 text-xs text-slate-400">{sc.text}</p>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 14. Start */}
        <Panel>
          <Eyebrow>Your turn</Eyebrow>
          <Title>Ready for your first mission?</Title>
          <Body>Build a spacecraft, launch it and see how far it gets. Then redesign and beat your score.</Body>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/mission/design"
              className="glow-cyan inline-flex min-h-12 items-center gap-2 rounded-full bg-cyan-400 px-6 font-semibold text-space-950 transition hover:bg-cyan-300"
            >
              <Rocket aria-hidden="true" className="size-4" /> Start a mission
            </Link>
            <Link
              to="/mission/team/host"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-violet-400/60 bg-violet-500/15 px-6 font-semibold text-violet-100 transition hover:bg-violet-500/30"
            >
              <Users aria-hidden="true" className="size-4" /> Play with friends
            </Link>
          </div>
        </Panel>
      </div>
    </section>
  )
}
