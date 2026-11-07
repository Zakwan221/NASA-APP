import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { MissionEvent } from '../../../game/events/events'
import { summarize, type OperateState } from '../../../game/events/operate'
import { scoreMission } from '../../../game/scoring/score'
import type { Role } from '../../../game/types'
import {
  addMissionOp,
  advancePhase,
  castBallot,
  claimRole,
  proposeVote,
  startOperate,
  submitMissionResult,
  type CrewMember,
  type VotePayload,
} from '../../../multiplayer/missionApi'
import { replayOps } from '../../../multiplayer/replay'
import { errorText, useMissionRoom } from '../../../multiplayer/useMissionRoom'
import { OperateView, Shell } from '../operate/OperatePage'
import { PLACEHOLDER_CRAFT } from '../operate/placeholderCraft'
import LeaderboardTable from '../leaderboard/LeaderboardTable'
import { scenarioName } from '../leaderboard/shared'
import ReportScreen from '../report/ReportScreen'

// Until Design and Launch exist, every team flies the placeholder spacecraft
const craft = PLACEHOLDER_CRAFT

const ROLES: { id: Role; name: string; icon: string; job: string }[] = [
  { id: 'planner', name: 'Mission Planner', icon: '🗺️', job: 'Keeps the mission on budget.' },
  { id: 'engineer', name: 'Spacecraft Engineer', icon: '🔧', job: 'Keeps the spacecraft healthy.' },
  { id: 'science', name: 'Science Lead', icon: '🔬', job: 'Switches the instruments on and off.' },
  { id: 'comms', name: 'Comms & Ops', icon: '📡', job: 'Gets the data home without losing it.' },
]

const button =
  'min-h-12 rounded-full px-6 font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100'

/** /mission/team/:code, the same screen on every phone in the crew */
export default function TeamRoom() {
  const { code = '' } = useParams()
  const m = useMissionRoom(code)
  const { room, ops, userId } = m

  const opState: OperateState | null = useMemo(
    () => (ops?.ops_seed != null ? replayOps(craft, ops.ops_seed, ops.ops) : null),
    [ops],
  )

  const isHost = room?.is_host ?? false
  const scienceHolder = room?.crew.find((c) => c.role === 'science')
  const canToggle = room?.my_role === 'science' || (isHost && !scienceHolder)

  // When the replayed mission ends, the host records the score once; that moves everyone to Report
  const submitted = useRef<string | null>(null)
  useEffect(() => {
    if (!room || !opState?.ended || !isHost || room.phase !== 'operate') return
    const key = `${room.room_id}:${ops?.attempt}`
    if (submitted.current === key) return
    submitted.current = key
    const host = room.crew.find((c) => c.is_host)
    const score = scoreMission(summarize(craft, opState), { team: room.crew.length > 1 })
    submitMissionResult(room.room_id, `${host?.nickname ?? 'Team'}'s crew`, score).catch((e) => m.setError(errorText(e)))
  }, [room, opState, isHost, ops?.attempt, m])

  async function act(fn: () => Promise<unknown>) {
    m.setError(null)
    try {
      await fn()
      // Our own move shows up at once, even if its broadcast is slow
      await m.reload()
    } catch (e) {
      m.setError(errorText(e))
    }
  }

  if (!room) {
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

  return (
    <Shell>
      {!m.connected && (
        <p role="status" className="mb-4 rounded-full bg-amber-400/15 px-4 py-2 text-center text-sm text-amber-200">
          Reconnecting…
        </p>
      )}
      {m.error && <ErrorBox text={m.error} />}

      {room.phase === 'lobby' || room.phase === 'design' || room.phase === 'launch' ? (
        <Lobby
          code={code}
          crew={room.crew}
          myRole={room.my_role}
          userId={userId}
          online={m.online}
          isHost={isHost}
          attempt={room.attempt}
          onRole={(role) => act(() => claimRole(room.room_id, role))}
          onStart={() => act(() => startOperate(room.room_id))}
          canPickRole={room.phase === 'lobby'}
        />
      ) : room.phase === 'operate' && opState ? (
        <OperateView
          craft={craft}
          state={opState}
          canToggle={canToggle}
          toggleNote={
            canToggle ? undefined : `Only the Science Lead (${scienceHolder?.nickname ?? 'the host'}) can switch instruments.`
          }
          onToggle={(id, on) => act(() => addMissionOp(room.room_id, 'toggle', { instrumentId: id, on }))}
          onChoose={() => {}}
          onFly={() => {}}
          banner={<RoleCard role={room.my_role} isHost={isHost} state={opState} />}
          renderChoices={(event) => (
            <EventVote
              event={event}
              vote={m.vote}
              month={opState.month + 1}
              userId={userId}
              isHost={isHost}
              crew={room.crew}
              onPropose={(choice) =>
                act(() => proposeVote(room.room_id, 'event', { choice, month: opState.month + 1 }))
              }
              onBallot={(yes) => m.vote && act(() => castBallot(m.vote!.vote_id, yes))}
              onDecide={(choice) =>
                act(() => addMissionOp(room.room_id, 'choice', { choice, month: opState.month + 1 }))
              }
            />
          )}
          flyControl={
            isHost ? (
              <button
                type="button"
                onClick={() => act(() => addMissionOp(room.room_id, 'fly', { month: opState.month + 1 }))}
                className={`glow-violet min-h-14 bg-violet-500 px-10 text-lg hover:bg-violet-400 ${button}`}
              >
                Fly month {opState.month + 1} →
              </button>
            ) : (
              <p className="text-slate-300">
                Waiting for {room.crew.find((c) => c.is_host)?.nickname ?? 'the host'} (Flight Director) to fly month{' '}
                {opState.month + 1}…
              </p>
            )
          }
        />
      ) : room.phase === 'report' && opState ? (
        <ReportScreen
          key={`${room.room_id}:${ops?.attempt}`}
          craft={craft}
          state={opState}
          team={room.crew.length > 1}
          previousTotal={room.results.filter((r) => r.attempt < room.attempt).at(-1)?.total ?? null}
          onFlyAgain={
            isHost
              ? () =>
                  act(async () => {
                    await advancePhase(room.room_id) // report → design, attempt + 1
                    await startOperate(room.room_id)
                  })
              : undefined
          }
          footer={<TeamLeaderboard scenarioId={craft.scenario.id} attempt={room.attempt} />}
        />
      ) : (
        <p className="text-slate-400">Loading the mission…</p>
      )}
    </Shell>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p role="alert" className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      {text}
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
  attempt: number
  canPickRole: boolean
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
                <span className="text-sm text-slate-300">{role ? `${role.icon} ${role.name}` : 'No role yet'}</span>
              </motion.li>
            )
          })}
        </ul>
      </div>

      {props.canPickRole && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Pick your role</h2>
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
                  <span className="block font-semibold">
                    {r.icon} {r.name} {mine && '✓'}
                  </span>
                  <span className="text-sm text-slate-400">
                    {holder && !mine ? `Taken by ${holder.nickname}` : r.job}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Roles nobody takes are run by the host. Everyone votes on big decisions.
          </p>
        </div>
      )}

      <div className="mt-8 text-center">
        {props.isHost ? (
          <button
            type="button"
            onClick={props.onStart}
            className={`glow-violet min-h-14 bg-violet-500 px-10 text-lg hover:bg-violet-400 ${button}`}
          >
            {props.attempt > 1 ? `Launch attempt ${props.attempt}` : 'Launch the mission 🚀'}
          </button>
        ) : (
          <p className="text-slate-300">Waiting for the Flight Director to launch…</p>
        )}
      </div>
    </section>
  )
}

/* ---------------- operate: role card ---------------- */

function RoleCard({ role, isHost, state }: { role: Role | null; isHost: boolean; state: OperateState }) {
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
        <span className="font-semibold">
          {r ? `${r.icon} ${r.name}` : 'Crew member'}
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

/* ---------------- operate: event vote ---------------- */

function EventVote(props: {
  event: MissionEvent
  vote: VotePayload | null
  month: number
  userId: string | null
  isHost: boolean
  crew: CrewMember[]
  onPropose: (choice: number) => void
  onBallot: (yes: boolean) => void
  onDecide: (choice: number) => void
}) {
  const { event, vote } = props
  const open = vote && vote.topic === 'event' && vote.proposal.month === props.month ? vote : null
  const proposed = open ? event.choices[Number(open.proposal.choice)] : null
  const iVoted = open && props.userId ? open.voted.includes(props.userId) : false
  const proposer = open ? props.crew.find((c) => c.user_id === open.proposed_by)?.nickname : null

  if (open && proposed) {
    return (
      <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-300/5 p-4">
        <p className="text-sm text-slate-300">{proposer ?? 'Someone'} proposes:</p>
        <p className="mt-1 text-lg font-semibold">{proposed.label}</p>
        <p className="text-sm text-slate-400">{proposed.hint}</p>
        <p className="mt-3 text-sm tabular-nums text-slate-300">
          👍 {open.yes} · 👎 {open.no} · needs more than half of {open.crew_size}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {iVoted ? (
            <p className="text-sm text-slate-400">You voted. Waiting for the others…</p>
          ) : (
            <>
              <button type="button" onClick={() => props.onBallot(true)} className={`bg-emerald-500 hover:bg-emerald-400 ${button}`}>
                Agree
              </button>
              <button type="button" onClick={() => props.onBallot(false)} className={`bg-white/10 hover:bg-white/20 ${button}`}>
                Disagree
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-slate-300">Propose a choice. The crew votes, and more than half must agree.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {event.choices.map((c, idx) => (
          <div key={c.label} className="rounded-xl border border-white/15 p-4">
            <span className="block font-semibold">{c.label}</span>
            <span className="text-sm text-slate-400">{c.hint}</span>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => props.onPropose(idx)} className={`bg-violet-500 hover:bg-violet-400 ${button}`}>
                Propose
              </button>
              {props.isHost && props.crew.length > 1 && (
                <button
                  type="button"
                  onClick={() => props.onDecide(idx)}
                  className="min-h-11 text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline"
                >
                  Decide now
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
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
