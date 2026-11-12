/**
 * Team mission rooms: typed wrappers around the functions in
 * supabase/migrations/20261107000000_mission_rooms.sql.
 * Screens call these; they never touch tables directly.
 *
 * Flow: createMissionRoom / joinMissionRoom → claimRole (lobby) → connectToMission
 *   → updateDesign (each role edits its own section) → proposeVote('advance') / castBallot
 *   → launchMission (host, on the pad; every phone plays the same launch) → startOperate
 *   → submitMissionResult (end of Operate) → Report → advancePhase = redesign and fly again
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import type { MissionDesign, Role, ScoreBreakdown } from '../game/types'
import { ensureSignedIn, getSupabase } from '../lib/supabase'

/* ---------------- types (match the SQL payloads) ---------------- */

export type MissionPhase = 'lobby' | 'design' | 'launch' | 'operate' | 'report'

export interface CrewMember {
  user_id: string
  nickname: string
  role: Role | null
  is_host: boolean
}

export interface VotePayload {
  vote_id: string
  topic: string // 'advance' moves the phase; anything else is up to the screens
  proposal: Record<string, unknown>
  proposed_by: string
  status: 'open' | 'passed' | 'failed'
  yes: number
  no: number
  voted: string[] // user ids
  crew_size: number
}

export interface DesignChange<S extends Role = Role> {
  section: S
  value: MissionDesign[S]
  version: number
  by: string
}

export interface PhasePayload {
  phase: MissionPhase
  attempt: number
  /** Set when the phase becomes 'operate' */
  ops_seed?: number
}

export interface ResultPayload {
  attempt: number
  total: number
  score: ScoreBreakdown
  /** Id for the share page /mission/r/<id>. Only in the live broadcast, not after a reload. */
  result_id?: string
}

export type MissionOpKind = 'toggle' | 'fly' | 'choice'

/** One move in the Operate phase. Every phone replays these in id order. */
export interface MissionOp {
  id: number
  attempt: number
  kind: MissionOpKind
  payload: { instrumentId?: string; on?: boolean; month?: number; choice?: number }
  by: string
}

export interface MissionOps {
  attempt: number
  ops_seed: number | null
  ops: MissionOp[]
}

export interface MissionState {
  room_id: string
  code: string
  phase: MissionPhase
  attempt: number
  is_host: boolean
  my_role: Role | null
  /** Sections nobody has saved yet are missing: merge over EMPTY_DESIGN */
  design: Partial<MissionDesign>
  design_version: number
  crew: CrewMember[]
  open_vote: VotePayload | null
  results: ResultPayload[]
  /** The launch roll for this attempt, or null before the Flight Director presses Launch */
  launch_seed: number | null
  /** How many times this crew has launched (a new number = a new launch to play) */
  launch_count: number
  /** Who has tapped Launch on the pad (user ids). The rocket goes when everyone has. */
  launch_ready: string[]
}

export interface ChatMessage {
  id: number
  user_id: string
  nickname: string
  text: string
  created_at: string
}

export interface LaunchPayload {
  launch_seed: number
  launch_attempt: number
  launch_count: number
}

export type LeaderboardMode = 'all' | 'solo' | 'team'

export interface LeaderboardRow {
  /** Opens its share page: /mission/r/<id> */
  id: string
  team_name: string
  total: number
  difficulty: string
  crew_size: number
  created_at: string
}

/* ---------------- calls ---------------- */

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  await ensureSignedIn()
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) throw new Error(error.message) // messages are written for players
  return data as T
}

type RoomRef = { room_id: string; code: string }

export const createMissionRoom = (nickname: string, design?: Partial<MissionDesign>) =>
  rpc<RoomRef>('create_mission_room', { p_nickname: nickname, p_design: design ?? {} })

export const joinMissionRoom = (code: string, nickname: string) =>
  rpc<RoomRef & { rejoined: boolean }>('join_mission_room', { p_code: code, p_nickname: nickname })

/** Take a free role in the lobby, or pass null to let go of yours */
export const claimRole = (roomId: string, role: Role | null) =>
  rpc<{ crew: CrewMember[] }>('claim_role', { p_room_id: roomId, p_role: role })

/**
 * Save one section of the design. Allowed for the player holding that role,
 * or the host when nobody holds it (solo). Pass the last design_version you saw
 * to get "Someone else changed the design first" instead of overwriting.
 */
export const updateDesign = <S extends Role>(
  roomId: string,
  section: S,
  value: MissionDesign[S],
  expectedVersion?: number,
) =>
  rpc<DesignChange<S>>('update_design', {
    p_room_id: roomId,
    p_section: section,
    p_value: value,
    p_expected_version: expectedVersion ?? null,
  })

/** Start a team vote; your own yes counts at once. A solo player's vote passes straight away. */
export const proposeVote = (roomId: string, topic: string, proposal: Record<string, unknown> = {}) =>
  rpc<VotePayload>('propose_vote', { p_room_id: roomId, p_topic: topic, p_proposal: proposal })

export const castBallot = (voteId: string, yes: boolean) =>
  rpc<VotePayload>('cast_ballot', { p_vote_id: voteId, p_yes: yes })

/** Host only: move on without a vote (cancels any open vote) */
export const advancePhase = (roomId: string) => rpc<PhasePayload>('advance_phase', { p_room_id: roomId })

/** Host only, at the end of Operate: saves the score and moves to Report */
export const submitMissionResult = (roomId: string, teamName: string, score: ScoreBreakdown) =>
  rpc<ResultPayload>('submit_mission_result', { p_room_id: roomId, p_team_name: teamName, p_score: score })

/* ---------------- launch day (20261112000000_team_launch.sql) ---------------- */

/** Anyone on the pad: tap Launch (or take it back). When the whole crew is ready, the rocket goes. */
export const readyToLaunch = (roomId: string, ready = true) =>
  rpc<{ ready: string[] } | LaunchPayload>('ready_to_launch', { p_room_id: roomId, p_ready: ready })

/** Host, on the launch pad: launch now without waiting for everyone */
export const launchMission = (roomId: string) => rpc<LaunchPayload>('launch_mission', { p_room_id: roomId })

/** Host, on the launch pad: go back to Design (e.g. after a failed launch) */
export const backToDesign = (roomId: string) => rpc<PhasePayload>('back_to_design', { p_room_id: roomId })

/** Host, after a good launch: start flying. Picks the seed for the months in space. */
export const startOperate = (roomId: string) => rpc<PhasePayload>('start_operate', { p_room_id: roomId })

/** Make a move: toggle (Science Lead), fly or choice (host) */
export const addMissionOp = (roomId: string, kind: MissionOpKind, payload: MissionOp['payload']) =>
  rpc<MissionOp>('add_mission_op', { p_room_id: roomId, p_kind: kind, p_payload: payload })

export const getMissionOps = (roomId: string) => rpc<MissionOps>('get_mission_ops', { p_room_id: roomId })

/* ---------------- crew chat (20261112010000_team_ready_chat.sql) ---------------- */

export const sendChat = (roomId: string, text: string) => rpc<ChatMessage>('send_chat', { p_room_id: roomId, p_text: text })
/** The last 50 messages, oldest first */
export const getChat = (roomId: string) => rpc<ChatMessage[]>('get_chat', { p_room_id: roomId })

export const getMissionState = (code: string) => rpc<MissionState>('get_mission_state', { p_code: code })

export const getLeaderboard = (scenarioId: string, limit = 10, mode: LeaderboardMode = 'all') =>
  rpc<LeaderboardRow[]>('get_leaderboard', { p_scenario_id: scenarioId, p_limit: limit, p_mode: mode })

/* ---------------- solo results and share links (20261107040000_mission_leaderboard.sql) ---------------- */

/** Post a finished solo mission to the leaderboard. Returns the id for its share link. */
export const submitSoloResult = (
  name: string,
  scenarioId: string,
  difficulty: string,
  score: ScoreBreakdown,
  design: Record<string, unknown> = {},
) =>
  rpc<{ id: string; total: number }>('submit_solo_result', {
    p_name: name,
    p_scenario_id: scenarioId,
    p_difficulty: difficulty,
    p_score: score,
    p_design: design,
  })

export interface SharedResult extends Omit<LeaderboardRow, 'id'> {
  id: string
  scenario_id: string
  /** The full score, with `parts` (reasons and tips) when the phone sent them */
  score: ScoreBreakdown & { parts?: { key: string; label: string; points: number; max: number; reason: string }[] }
  /** Place on the scenario's board, 1 = best */
  rank: number
}

export const getSharedResult = (id: string) => rpc<SharedResult>('get_shared_result', { p_id: id })

/* ---------------- realtime ---------------- */

export interface MissionHandlers {
  onCrew?: (crew: CrewMember[]) => void
  onDesign?: (change: DesignChange) => void
  onPhase?: (p: PhasePayload) => void
  onVote?: (v: VotePayload) => void
  onResult?: (r: ResultPayload) => void
  onOp?: (op: MissionOp) => void
  onLaunch?: (l: LaunchPayload) => void
  onLaunchReady?: (ready: string[]) => void
  onChat?: (m: ChatMessage) => void
  /** Who has the screen open right now (presence), by user id */
  onOnline?: (userIds: string[]) => void
  /** Called on every (re)connect: reload with getMissionState() here */
  onConnected?: () => void
  onDisconnected?: () => void
}

/** Subscribe to the private 'mission:<code>' channel. Returns a function that leaves it. */
export function connectToMission(code: string, userId: string, handlers: MissionHandlers): () => void {
  const supabase = getSupabase()
  const channel: RealtimeChannel = supabase.channel(`mission:${code}`, {
    config: { private: true, presence: { key: userId } },
  })

  channel
    .on('broadcast', { event: 'crew' }, ({ payload }) => handlers.onCrew?.((payload as { crew: CrewMember[] }).crew))
    .on('broadcast', { event: 'design' }, ({ payload }) => handlers.onDesign?.(payload as DesignChange))
    .on('broadcast', { event: 'phase' }, ({ payload }) => handlers.onPhase?.(payload as PhasePayload))
    .on('broadcast', { event: 'vote' }, ({ payload }) => handlers.onVote?.(payload as VotePayload))
    .on('broadcast', { event: 'result' }, ({ payload }) => handlers.onResult?.(payload as ResultPayload))
    .on('broadcast', { event: 'launch' }, ({ payload }) => handlers.onLaunch?.(payload as LaunchPayload))
    .on('broadcast', { event: 'launch_ready' }, ({ payload }) => handlers.onLaunchReady?.((payload as { ready: string[] }).ready))
    .on('broadcast', { event: 'chat' }, ({ payload }) => handlers.onChat?.(payload as ChatMessage))
    .on('broadcast', { event: 'op' }, ({ payload }) => handlers.onOp?.(payload as MissionOp))
    .on('presence', { event: 'sync' }, () => handlers.onOnline?.(Object.keys(channel.presenceState())))
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() })
        handlers.onConnected?.()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handlers.onDisconnected?.()
      }
    })

  return () => {
    void supabase.removeChannel(channel)
  }
}
