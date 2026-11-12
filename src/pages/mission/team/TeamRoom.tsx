import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  CircleCheck,
  Circle,
  Map as MapIcon,
  Microscope,
  RadioTower,
  Rocket,
  ThumbsDown,
  ThumbsUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buildFlight } from '../../../game/engine/evaluate'
import { rollLaunch, withLaunchDefaults } from '../../../game/engine/launch'
import { EVENTS } from '../../../game/events/events'
import { summarize, type FlightSpacecraft, type MissionFocus, type OperateState } from '../../../game/events/operate'
import { nextRandom } from '../../../game/events/random'
import { scoreMission } from '../../../game/scoring/score'
import type { MissionDesign, Role } from '../../../game/types'
import {
  addMissionOp,
  advancePhase,
  backToDesign,
  castBallot,
  claimRole,
  launchMission,
  proposeVote,
  readyToLaunch,
  sendChat,
  startOperate,
  submitMissionResult,
  type CrewMember,
  type MissionState,
  type VotePayload,
} from '../../../multiplayer/missionApi'
import { replayOps } from '../../../multiplayer/replay'
import { errorText, useMissionRoom, type MissionRoom } from '../../../multiplayer/useMissionRoom'
import DesignPage from '../design/DesignPage'
import { DesignEditorContext } from '../design/editor'
import { LaunchStage } from '../launch/LaunchPage'
import LeaderboardTable from '../leaderboard/LeaderboardTable'
import { scenarioName } from '../leaderboard/shared'
import { OperateView, Shell } from '../operate/OperatePage'
import ReportScreen from '../report/ReportScreen'
import CrewChat from './CrewChat'
import { roomDesign, useTeamEditor } from './useTeamEditor'

const ROLES: { id: Role; name: string; icon: LucideIcon; job: string }[] = [
  { id: 'planner', name: 'Mission Planner', icon: MapIcon, job: 'Picks the mission, game mode and months. Watches the budget.' },
  { id: 'engineer', name: 'Spacecraft Engineer', icon: Wrench, job: 'Builds the spacecraft: frame, power, computer and pointing.' },
  { id: 'science', name: 'Science Lead', icon: Microscope, job: 'Chooses the instruments and switches them on in flight.' },
  { id: 'comms', name: 'Comms & Ops', icon: RadioTower, job: 'Picks the radio, orbit and rocket. Gets the data home.' },
]

const button =
  'min-h-12 rounded-full px-6 font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100'

/** Every phone turns the room's launch seed into the same launch day */
function launchFromSeed(design: MissionDesign, seed: number) {
  const [roll, next] = nextRandom(seed)
  const [pick] = nextRandom(next)
  return rollLaunch(design, roll, pick)
}

type Act = (fn: () => Promise<unknown>) => Promise<void>

/**
 * /mission/team/:code, the same mission on every phone in the crew (up to 4):
 * Lobby (roles) → Design together (each role builds its part, live)
 * → vote to go to the pad → Launch together (everyone taps Launch, everyone sees the same launch)
 * → Fly month by month (the crew votes on each surprise) → Report + leaderboard → redesign.
 * A live crew chat floats over every screen.
 */
export default function TeamRoom() {
  const { code = '' } = useParams()
  const m = useMissionRoom(code)

  if (!m.room) {
    return (
      <Shell>
        {m.error ? (
          <>
            <ErrorBox text={m.error} />
            <Link to="/mission/team/join" className="text-cyan-300 underline">
              ← Join another mission
            </Link>
          </>
        ) : (
          <p className="text-slate-400">Connecting to mission control…</p>
        )}
      </Shell>
    )
  }
  return <Room m={m} room={m.room} code={code} />
}

function Room({ m, room, code }: { m: MissionRoom; room: MissionState; code: string }) {
  const { ops, userId } = m
  const isHost = room.is_host
  const host = room.crew.find((c) => c.is_host)
  const hostName = host ? (host.user_id === userId ? 'you' : host.nickname) : 'the Flight Director'

  const editor = useTeamEditor(room, userId, m.reload, m.setError)
  const design = useMemo(() => roomDesign(room), [room])
  // Orbit or rocket skipped? Fly with sensible ones (the same on every phone)
  const flying = useMemo(() => withLaunchDefaults(design), [design])
  const launch = useMemo(() => (room.launch_seed != null ? launchFromSeed(flying, room.launch_seed) : null), [flying, room.launch_seed])
  const craft: FlightSpacecraft | null = useMemo(
    () => (room.phase === 'operate' || room.phase === 'report' ? buildFlight(flying, launch?.extraCostM ?? 0) : null),
    [room.phase, flying, launch],
  )
  const opState: OperateState | null = useMemo(
    () => (craft && ops?.ops_seed != null ? replayOps(craft, ops.ops_seed, ops.ops) : null),
    [craft, ops],
  )

  const scienceHolder = room.crew.find((c) => c.role === 'science')
  const canToggle = room.my_role === 'science' || (isHost && !scienceHolder)

  // When the replayed mission ends, the host records the score once; that moves everyone to Report
  const submitted = useRef<string | null>(null)
  useEffect(() => {
    if (!craft || !opState?.ended || !isHost || room.phase !== 'operate') return
    const key = `${room.room_id}:${ops?.attempt}`
    if (submitted.current === key) return
    submitted.current = key
    const score = scoreMission(summarize(craft, opState), { team: room.crew.length > 1 })
    submitMissionResult(room.room_id, `${host?.nickname ?? 'Team'}'s crew`, score).catch((e) => m.setError(errorText(e)))
  }, [room, craft, opState, isHost, ops?.attempt, m, host])

  // The Flight Director picks each month's plan; it travels with the Fly move
  const [planFocus, setPlanFocus] = useState<MissionFocus>('steady')

  // A surprise vote passed: the host's phone records the crew's choice (once)
  const sentChoice = useRef<string | null>(null)
  const sendChoice = (v: VotePayload) => {
    const month = Number(v.proposal.month)
    const choice = Number(v.proposal.choice)
    if (!isHost || !opState?.pending || month !== opState.month + 1 || !Number.isInteger(choice)) return
    if (sentChoice.current === v.vote_id) return
    sentChoice.current = v.vote_id
    addMissionOp(room.room_id, 'choice', { month, choice })
      .then(() => m.reload())
      .catch((e) => m.setError(errorText(e)))
  }
  useEffect(() => {
    if (m.closedVote?.topic === 'event' && m.closedVote.status === 'passed') sendChoice(m.closedVote)
  })

  const act: Act = async (fn) => {
    m.setError(null)
    try {
      await fn()
      // Our own move shows up at once, even if its broadcast is slow
      await m.reload()
    } catch (e) {
      m.setError(errorText(e))
    }
  }

  const banners = (
    <>
      {!m.connected && (
        <p role="status" className="mb-4 rounded-full bg-amber-400/15 px-4 py-2 text-center text-sm text-amber-200">
          Reconnecting…
        </p>
      )}
      {m.error && <ErrorBox text={m.error} onClose={() => m.setError(null)} />}
    </>
  )

  const chat = (
    <CrewChat
      messages={m.chat}
      userId={userId}
      onSend={async (text) => {
        try {
          await sendChat(room.room_id, text)
        } catch (e) {
          m.setError(errorText(e))
          throw e
        }
      }}
    />
  )

  /* ---------- Design: the crew builds one spacecraft together ---------- */
  if (room.phase === 'design') {
    const solo = room.crew.length === 1
    const toPad = () => {
      if (!design.planner.scenarioId) return m.setError('The Mission Planner has to choose a mission first.')
      void act(() => (solo ? advancePhase(room.room_id) : proposeVote(room.room_id, 'advance', { to: 'launch' })))
    }
    return (
      <DesignEditorContext.Provider value={editor}>
        <DesignPage
          onLaunchPad={toPad}
          launchLabel={solo ? 'To the launch pad' : 'Vote: to the launch pad'}
          intro={
            <div className="mb-8">
              {banners}
              <CrewStrip crew={room.crew} userId={userId} online={m.online} code={code} attempt={room.attempt} />
            </div>
          }
        />
        <AdvanceVote m={m} room={room} userId={userId} isHost={isHost} act={act} />
        {chat}
      </DesignEditorContext.Provider>
    )
  }

  /* ---------- Launch: the Flight Director launches, every phone plays it ---------- */
  if (room.phase === 'launch') {
    return (
      <>
        <TeamLaunch room={room} flying={flying} launch={launch} isHost={isHost} hostName={hostName} userId={userId} act={act} />
        {chat}
        {m.error && (
          <div className="fixed inset-x-0 top-20 z-[80] mx-auto max-w-md px-3">
            <ErrorBox text={m.error} onClose={() => m.setError(null)} />
          </div>
        )}
      </>
    )
  }

  return (
    <Shell>
      {banners}
      {chat}
      {room.phase === 'lobby' ? (
        <Lobby
          code={code}
          crew={room.crew}
          myRole={room.my_role}
          userId={userId}
          online={m.online}
          isHost={isHost}
          onRole={(role) => act(() => claimRole(room.room_id, role))}
          onStart={() => act(() => advancePhase(room.room_id))}
        />
      ) : room.phase === 'operate' && craft && opState ? (
        <OperateView
          craft={craft}
          canToggle={canToggle}
          toggleNote={
            canToggle ? undefined : `Only the Science Lead (${scienceHolder?.nickname ?? 'the host'}) can switch instruments.`
          }
          onToggle={(id, on) => act(() => addMissionOp(room.room_id, 'toggle', { instrumentId: id, on }))}
          onFly={() => {}}
          onChoose={() => {}}
          onFocus={setPlanFocus}
          canFocus={isHost}
          state={isHost ? { ...opState, focus: planFocus } : opState}
          eventControl={
            <EventVote
              m={m}
              room={room}
              userId={userId}
              isHost={isHost}
              state={opState}
              act={act}
              onPassed={sendChoice}
            />
          }
          banner={<RoleCard role={room.my_role} isHost={isHost} state={opState} craft={craft} />}
          flyControl={
            isHost ? (
              <button
                type="button"
                onClick={() => act(() => addMissionOp(room.room_id, 'fly', { month: opState.month + 1, focus: planFocus }))}
                className={`glow-violet min-h-14 bg-violet-500 px-10 text-lg hover:bg-violet-400 ${button}`}
              >
                Fly month {opState.month + 1} →
              </button>
            ) : (
              <p className="text-slate-300">
                Waiting for {hostName} (Flight Director) to fly month {opState.month + 1}…
              </p>
            )
          }
        />
      ) : room.phase === 'report' && craft && opState ? (
        <ReportScreen
          key={`${room.room_id}:${ops?.attempt}`}
          craft={craft}
          state={opState}
          team={room.crew.length > 1}
          previousTotal={room.results.filter((r) => r.attempt < room.attempt).at(-1)?.total ?? null}
          flyAgainLabel="Redesign together"
          // report → design: same crew, next attempt, the spacecraft is kept so the crew fixes what went wrong
          onFlyAgain={isHost ? () => act(() => advancePhase(room.room_id)) : undefined}
          footer={<TeamLeaderboard scenarioId={craft.scenario.id} attempt={room.attempt} />}
        />
      ) : (
        <p className="text-slate-400">Loading the mission…</p>
      )}
    </Shell>
  )
}

function ErrorBox({ text, onClose }: { text: string; onClose?: () => void }) {
  return (
    <p role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      <span>{text}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 font-semibold text-rose-100 underline-offset-4 hover:underline">
          OK
        </button>
      )}
    </p>
  )
}

/* ---------------- lobby ---------------- */

function Lobby(props: {
  code: string
  crew: CrewMember[]
  myRole: Role | null
  userId: string | null
  online: string[]
  isHost: boolean
  onRole: (role: Role | null) => void
  onStart: () => void
}) {
  const joinUrl = `${window.location.origin}/mission/team/join?code=${props.code}`
  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-wider text-cyan-300">Team mission · crew of up to 4</p>
      <div className="mt-4 flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-center sm:gap-10">
        <div className="rounded-2xl bg-white p-3">
          <QRCodeSVG value={joinUrl} size={140} marginSize={0} title="Scan to join" />
        </div>
        <div>
          <p className="text-slate-300">Scan, or open Mission → Join a team and enter</p>
          <p className="my-2 font-display text-6xl font-bold tracking-[0.2em] text-cyan-300">{props.code}</p>
        </div>
      </div>

      <div className="card mt-8 p-5">
        <h2 className="text-lg font-semibold">Crew ({props.crew.length}/4)</h2>
        <ul className="mt-3 space-y-2">
          {props.crew.map((c) => {
            const role = ROLES.find((r) => r.id === c.role)
            return (
              <motion.li
                key={c.user_id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3"
              >
                <span className="font-semibold">
                  <span
                    className={`mr-2 inline-block h-2 w-2 rounded-full ${props.online.includes(c.user_id) ? 'bg-emerald-400' : 'bg-slate-600'}`}
                    aria-label={props.online.includes(c.user_id) ? 'online' : 'offline'}
                  />
                  {c.nickname}
                  {c.user_id === props.userId && <span className="text-slate-400"> (you)</span>}
                  {c.is_host && <span className="ml-2 text-xs text-amber-300">Flight Director</span>}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-slate-300">
                  {role ? (
                    <>
                      <role.icon aria-hidden="true" className="size-4 text-cyan-300" /> {role.name}
                    </>
                  ) : (
                    'No role yet'
                  )}
                </span>
              </motion.li>
            )
          })}
        </ul>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Pick your role</h2>
        <p className="mt-1 text-sm text-slate-400">Each role designs one part of the spacecraft. Everyone sees every change live.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => {
            const holder = props.crew.find((c) => c.role === r.id)
            const mine = props.myRole === r.id
            return (
              <button
                key={r.id}
                type="button"
                disabled={Boolean(holder) && !mine}
                onClick={() => props.onRole(mine ? null : r.id)}
                className={`rounded-xl border p-4 text-left transition active:scale-[0.98] disabled:opacity-40 ${mine ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/15 hover:border-white/30'}`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <r.icon aria-hidden="true" className="size-5 text-cyan-300" /> {r.name}
                  {mine && <Check aria-hidden="true" className="size-4 text-cyan-300" />}
                </span>
                <span className="mt-1 block text-sm text-slate-400">{holder && !mine ? `Taken by ${holder.nickname}` : r.job}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-sm text-slate-400">Roles nobody takes are done by the Flight Director (host). Big decisions need a crew vote.</p>
      </div>

      <div className="mt-8 text-center">
        {props.isHost ? (
          <button type="button" onClick={props.onStart} className={`glow-violet min-h-14 bg-violet-500 px-10 text-lg hover:bg-violet-400 ${button}`}>
            <Wrench aria-hidden="true" className="mr-2 inline size-5" /> Start designing
          </button>
        ) : (
          <p className="text-slate-300">Waiting for the Flight Director to start designing…</p>
        )}
      </div>
    </section>
  )
}

/* ---------------- design: who is building what ---------------- */

function CrewStrip(props: { crew: CrewMember[]; userId: string | null; online: string[]; code: string; attempt: number }) {
  return (
    <section className="card p-4" aria-label="Crew">
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <Users aria-hidden="true" className="size-4 text-cyan-300" /> Team mission {props.code}
          {props.attempt > 1 && <span className="text-slate-400"> · attempt {props.attempt}</span>}
        </span>
        <span className="text-slate-400">Design together, then vote to go to the launch pad.</span>
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {ROLES.map((r) => {
          const c = props.crew.find((x) => x.role === r.id) ?? props.crew.find((x) => x.is_host)
          const byHost = !props.crew.some((x) => x.role === r.id)
          return (
            <li key={r.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
              <r.icon aria-hidden="true" className="size-4 shrink-0 text-cyan-300" />
              <span className="font-semibold">{r.name}</span>
              <span className="ml-auto truncate text-slate-300">
                {c && (
                  <span
                    className={`mr-1.5 inline-block h-2 w-2 rounded-full ${props.online.includes(c.user_id) ? 'bg-emerald-400' : 'bg-slate-600'}`}
                  />
                )}
                {c ? (c.user_id === props.userId ? 'You' : c.nickname) : '—'}
                {byHost && <span className="text-slate-500"> (host)</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The crew vote to leave Design for the launch pad, floating over the briefing and the builder */
function AdvanceVote({ m, room, userId, isHost, act }: { m: MissionRoom; room: MissionState; userId: string | null; isHost: boolean; act: Act }) {
  const vote = m.vote && m.vote.topic === 'advance' ? m.vote : null
  const iVoted = vote && userId ? vote.voted.includes(userId) : false
  const proposer = vote ? room.crew.find((c) => c.user_id === vote.proposed_by) : null
  return (
    <AnimatePresence>
      {vote && (
        <motion.div
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -24, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          role="status"
          className="fixed inset-x-3 top-3 z-[80] mx-auto max-w-md rounded-2xl border border-cyan-300/40 bg-space-900/95 p-4 shadow-2xl backdrop-blur"
        >
          <p className="flex items-center gap-2 font-semibold">
            <Rocket aria-hidden="true" className="size-4 text-cyan-300" />
            {proposer?.user_id === userId ? 'You want' : `${proposer?.nickname ?? 'Someone'} wants`} to go to the launch pad
          </p>
          <p className="mt-1 text-sm text-slate-300">The design locks once you leave. More than half the crew must agree.</p>
          <p className="mt-2 flex items-center gap-3 text-sm tabular-nums text-slate-300">
            <span className="flex items-center gap-1">
              <ThumbsUp aria-hidden="true" className="size-4 text-emerald-300" /> {vote.yes}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsDown aria-hidden="true" className="size-4 text-rose-300" /> {vote.no}
            </span>
            <span className="text-slate-400">of {vote.crew_size}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {iVoted ? (
              <span className="text-sm text-slate-400">You voted. Waiting for the others…</span>
            ) : (
              <>
                <button type="button" onClick={() => act(() => castBallot(vote.vote_id, true))} className={`bg-emerald-500 text-space-950 hover:bg-emerald-400 ${button}`}>
                  Ready
                </button>
                <button type="button" onClick={() => act(() => castBallot(vote.vote_id, false))} className={`bg-white/10 hover:bg-white/20 ${button}`}>
                  Not yet
                </button>
              </>
            )}
            {isHost && (
              <button
                type="button"
                onClick={() => act(() => advancePhase(room.room_id))}
                className="ml-auto min-h-11 text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline"
              >
                Go now
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------------- launch: the same launch on every phone ---------------- */

function TeamLaunch({
  room,
  flying,
  launch,
  isHost,
  hostName,
  userId,
  act,
}: {
  room: MissionState
  flying: MissionDesign
  launch: ReturnType<typeof launchFromSeed> | null
  isHost: boolean
  hostName: string
  userId: string | null
  act: Act
}) {
  const roll = useMemo(
    () => (launch ? { key: `${room.attempt}:${room.launch_count}`, outcome: launch } : null),
    [launch, room.attempt, room.launch_count],
  )
  // The launch report shows once this phone has played the animation
  const [playedKey, setPlayedKey] = useState<string | null>(null)
  const ready = room.launch_ready ?? []
  const iAmReady = userId ? ready.includes(userId) : false
  // After a failed launch, tapping "Try again" takes you back to the ready check
  const done = roll && playedKey === roll.key && !iAmReady ? roll.outcome : null
  const host = isHost ? (fn: () => Promise<unknown>) => () => void act(fn) : () => null
  const tapLaunch = () => void act(() => readyToLaunch(room.room_id, true))
  const waitingCount = room.crew.length - ready.length

  return (
    <LaunchStage
      design={flying}
      roll={roll}
      done={done}
      onPlayed={() => roll && setPlayedKey(roll.key)}
      onLaunch={iAmReady ? null : tapLaunch}
      onBack={host(() => backToDesign(room.room_id))}
      onFly={host(() => startOperate(room.room_id))}
      onRetry={tapLaunch}
      onChange={host(() => backToDesign(room.room_id))}
      waitingFor={
        iAmReady
          ? `${waitingCount} more crew member${waitingCount === 1 ? '' : 's'}`
          : hostName === 'you'
            ? 'the Flight Director'
            : `${hostName} (Flight Director)`
      }
      banner={
        room.crew.length > 1 && (!done || done.tone === 'fail') ? (
          <ReadyCheck crew={room.crew} ready={ready} userId={userId} isHost={isHost} onLaunchNow={() => void act(() => launchMission(room.room_id))} />
        ) : undefined
      }
    />
  )
}

/** Who has tapped Launch. The rocket goes when the whole crew is ready. */
function ReadyCheck({
  crew,
  ready,
  userId,
  isHost,
  onLaunchNow,
}: {
  crew: CrewMember[]
  ready: string[]
  userId: string | null
  isHost: boolean
  onLaunchNow: () => void
}) {
  return (
    <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-space-900/85 p-3 shadow-xl backdrop-blur-md">
      <p className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span className="flex items-center gap-1.5">
          <Rocket aria-hidden="true" className="size-4 text-cyan-300" /> Launch together: everyone taps Launch
        </span>
        <span className="tabular-nums text-cyan-200">
          {ready.length}/{crew.length}
        </span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {crew.map((c) => {
          const ok = ready.includes(c.user_id)
          return (
            <motion.li
              key={c.user_id}
              animate={ok ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                ok ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-slate-300'
              }`}
            >
              {ok ? <CircleCheck aria-hidden="true" className="size-3.5 text-emerald-300" /> : <Circle aria-hidden="true" className="size-3.5" />}
              {c.user_id === userId ? 'You' : c.nickname}
            </motion.li>
          )
        })}
      </ul>
      {isHost && ready.length < crew.length && (
        <button
          type="button"
          onClick={onLaunchNow}
          className="mt-2 min-h-9 text-xs font-semibold text-slate-400 underline-offset-4 hover:text-white hover:underline"
        >
          Someone away? Launch now without them
        </button>
      )}
    </div>
  )
}

/* ---------------- operate: role card ---------------- */

function RoleCard({ role, isHost, state, craft }: { role: Role | null; isHost: boolean; state: OperateState; craft: FlightSpacecraft }) {
  const r = ROLES.find((x) => x.id === role)
  const goal = (() => {
    switch (role) {
      case 'planner':
        return { text: 'Finish with money left in the budget.', ok: state.budgetLeftM >= 0.3, now: `$${state.budgetLeftM.toFixed(2)} M left` }
      case 'engineer':
        return { text: 'Keep the spacecraft above 70% health.', ok: state.health >= 70, now: `${state.health}% health` }
      case 'science':
        return {
          text: 'Reach the science goal. You control the instruments.',
          ok: state.scienceReturned >= craft.scenario.scienceTarget,
          now: `${Math.round(state.scienceReturned).toLocaleString()} / ${craft.scenario.scienceTarget.toLocaleString()}`,
        }
      case 'comms':
        return {
          text: 'Lose as little data as possible.',
          ok: state.dataLostMbit === 0,
          now: `${(state.dataLostMbit / 1000).toFixed(1)} Gbit lost`,
        }
      default:
        return null
    }
  })()

  return (
    <section className="card mb-6 flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p>
        <span className="flex items-center gap-1.5 font-semibold">
          {r && <r.icon aria-hidden="true" className="size-4 text-cyan-300" />}
          {r ? r.name : 'Crew member'}
          {isHost && <span className="text-amber-300"> · Flight Director</span>}
        </span>
        <span className="block text-sm text-slate-400">
          {goal ? `Your goal: ${goal.text}` : 'Vote on every decision.'} {isHost && 'You fly each month.'}
        </span>
      </p>
      {goal && (
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm tabular-nums ${goal.ok ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}
        >
          {goal.now}
        </span>
      )}
    </section>
  )
}

/* ---------------- report: leaderboard ---------------- */

function TeamLeaderboard({ scenarioId, attempt }: { scenarioId: string; attempt: number }) {
  return (
    <section className="card mt-6 p-3 sm:p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-semibold">Leaderboard · {scenarioName(scenarioId)}</h2>
        <Link to="/mission/leaderboard" className="text-sm text-cyan-300 underline-offset-4 hover:underline">
          See all
        </Link>
      </div>
      <LeaderboardTable scenarioId={scenarioId} limit={5} refreshKey={attempt} compact />
    </section>
  )
}

/**
 * A surprise in flight, team version: anyone proposes one of the two choices,
 * the crew votes, and when more than half agree the host's phone records it.
 * The Flight Director can also decide at once (e.g. if someone has gone quiet).
 */
function EventVote({
  m,
  room,
  userId,
  isHost,
  state,
  act,
  onPassed,
}: {
  m: MissionRoom
  room: MissionState
  userId: string | null
  isHost: boolean
  state: OperateState
  act: Act
  onPassed: (v: VotePayload) => void
}) {
  const event = state.pending ? EVENTS[state.pending.id] : null
  const month = state.month + 1
  const vote = m.vote && m.vote.topic === 'event' && Number(m.vote.proposal.month) === month ? m.vote : null
  const lastFailed =
    !vote && m.closedVote?.topic === 'event' && m.closedVote.status === 'failed' && Number(m.closedVote.proposal.month) === month
      ? m.closedVote
      : null
  if (!event) return null

  const alone = room.crew.length <= 1
  const decide = (i: number) => act(() => addMissionOp(room.room_id, 'choice', { month, choice: i }))
  const propose = (i: number) =>
    act(async () => {
      const v = await proposeVote(room.room_id, 'event', { month, choice: i })
      if (v.status === 'passed') onPassed(v)
    })
  const ballot = (yes: boolean) =>
    act(async () => {
      if (!vote) return
      const v = await castBallot(vote.vote_id, yes)
      if (v.status === 'passed') onPassed(v)
    })

  if (vote) {
    const choice = event.choices[Number(vote.proposal.choice)]
    const proposer = room.crew.find((c) => c.user_id === vote.proposed_by)
    const iVoted = userId ? vote.voted.includes(userId) : false
    return (
      <div role="status" className="mt-4 rounded-2xl border border-cyan-300/40 bg-cyan-300/5 p-4">
        <p className="font-semibold">
          {proposer?.user_id === userId ? 'You want' : `${proposer?.nickname ?? 'Someone'} wants`} to “{choice?.label}”
        </p>
        <p className="mt-1 text-sm text-slate-300">{choice?.hint}</p>
        <p className="mt-2 flex items-center gap-3 text-sm tabular-nums text-slate-300">
          <span className="flex items-center gap-1">
            <ThumbsUp aria-hidden="true" className="size-4 text-emerald-300" /> {vote.yes}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown aria-hidden="true" className="size-4 text-rose-300" /> {vote.no}
          </span>
          <span className="text-slate-400">of {vote.crew_size}. More than half must agree.</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {iVoted ? (
            <span className="text-sm text-slate-400">You voted. Waiting for the others…</span>
          ) : (
            <>
              <button type="button" onClick={() => ballot(true)} className={`bg-emerald-500 text-space-950 hover:bg-emerald-400 ${button}`}>
                Agree
              </button>
              <button type="button" onClick={() => ballot(false)} className={`bg-white/10 hover:bg-white/20 ${button}`}>
                Disagree
              </button>
            </>
          )}
          {isHost && (
            <button
              type="button"
              onClick={() => decide(Number(vote.proposal.choice))}
              className="ml-auto min-h-11 text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline"
            >
              Decide now
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <p className="mt-4 text-sm text-slate-300">
        {alone
          ? 'Pick what to do.'
          : 'Talk it over in the chat, then put one choice to the crew vote. Anyone can propose.'}
      </p>
      {lastFailed && (
        <p className="mt-2 rounded-xl bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
          The crew said no to “{event.choices[Number(lastFailed.proposal.choice)]?.label}”. Try the other choice, or talk it over.
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {event.choices.map((c, i) => (
          <button
            key={c.label}
            type="button"
            onClick={() => (alone ? decide(i) : propose(i))}
            className="min-h-14 rounded-2xl border border-white/15 bg-white/5 p-4 text-left transition hover:border-cyan-300/60 hover:bg-white/10 active:scale-[0.98]"
          >
            <span className="block font-semibold">{alone ? c.label : `Propose: ${c.label}`}</span>
            <span className="mt-1 block text-sm text-slate-300">{c.hint}</span>
          </button>
        ))}
      </div>
    </>
  )
}
