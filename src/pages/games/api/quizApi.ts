/**
 * Module 3 — typed wrappers around the quiz functions in
 * supabase/migrations/20261024000000_quiz.sql.
 * Screens call these; they never touch tables directly.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { ensureSignedIn, getSupabase } from '../../../lib/supabase'

/* ---------------- types (match the SQL payloads) ---------------- */

export type RoomStatus = 'lobby' | 'question' | 'reveal' | 'finished'

export interface Quiz {
  id: string
  title: string
  story: string | null
}

/** A question as players see it: no answer, no fact */
export interface QuestionPayload {
  question_id: string
  index: number
  total: number
  prompt: string
  choices: string[]
  image_url: string | null
  time_limit_s: number
  started_at: string // ISO, server clock
}

export interface PlayerScore {
  user_id: string
  nickname: string
  score: number
  streak: number
  rank: number
  last_points: number
  last_correct: boolean
}

export interface RevealPayload {
  question_id: string
  correct_index: number
  fact: string | null
  counts: number[] // how many players picked each choice
  is_last: boolean
  scores: PlayerScore[]
}

export interface AnswerCountPayload {
  question_id: string
  answered: number
  players: number
}

export interface FinishedPayload {
  scores: PlayerScore[]
}

export interface RoomState {
  room_id: string
  code: string
  quiz_title: string
  status: RoomStatus
  is_host: boolean
  total: number
  current_index: number
  server_now: string
  me: { nickname: string; score: number; streak: number } | null
  scores: PlayerScore[]
  question?: QuestionPayload
  my_choice?: number | null
  answered?: number
  reveal?: RevealPayload
}

export interface LobbyPlayer {
  nickname: string
}

/* ---------------- calls ---------------- */

/** Postgres error messages are written for players, so pass them through */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  await ensureSignedIn()
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export async function listQuizzes(): Promise<Quiz[]> {
  await ensureSignedIn()
  const { data, error } = await getSupabase().from('quizzes').select('id, title, story').order('title')
  if (error) throw new Error(error.message)
  return data
}

export const createRoom = (quizId: string) =>
  rpc<{ room_id: string; code: string }>('create_room', { p_quiz_id: quizId })

export const joinRoom = (code: string, nickname: string) =>
  rpc<{ room_id: string; code: string; rejoined: boolean }>('join_room', { p_code: code, p_nickname: nickname })

export const startQuestion = (roomId: string) =>
  rpc<(QuestionPayload & { status: 'question' }) | (FinishedPayload & { status: 'finished' })>('start_question', {
    p_room_id: roomId,
  })

export const submitAnswer = (roomId: string, choice: number) =>
  rpc<{ received: true }>('submit_answer', { p_room_id: roomId, p_choice: choice })

export const reveal = (roomId: string) => rpc<RevealPayload>('reveal', { p_room_id: roomId })

export const getRoomState = (code: string) => rpc<RoomState>('get_room_state', { p_code: code })

/* ---------------- timer ---------------- */

/** Milliseconds to add to Date.now() to get the server's clock */
export function clockOffset(state: RoomState, requestStartedAt: number): number {
  const roundTrip = Date.now() - requestStartedAt
  return Date.parse(state.server_now) + roundTrip / 2 - Date.now()
}

/** Seconds left on a question, using the server's start time */
export function secondsLeft(question: QuestionPayload, offsetMs: number): number {
  const elapsed = (Date.now() + offsetMs - Date.parse(question.started_at)) / 1000
  return Math.max(0, question.time_limit_s - elapsed)
}

/* ---------------- realtime ---------------- */

export interface RoomHandlers {
  onQuestion?: (q: QuestionPayload) => void
  onAnswerCount?: (c: AnswerCountPayload) => void
  onReveal?: (r: RevealPayload) => void
  onFinished?: (f: FinishedPayload) => void
  onLobby?: (players: LobbyPlayer[]) => void
  /** Called on every (re)connect: reload state with getRoomState() here */
  onConnected?: () => void
  onDisconnected?: () => void
}

/**
 * Subscribe to the private room channel. Call after createRoom/joinRoom.
 * Pass a nickname to show up in the lobby (players); the host passes none.
 * Returns a function that leaves the channel.
 */
export function connectToRoom(code: string, userId: string, handlers: RoomHandlers, nickname?: string): () => void {
  const supabase = getSupabase()
  const channel: RealtimeChannel = supabase.channel(`room:${code}`, {
    config: { private: true, presence: { key: userId } },
  })

  channel
    .on('broadcast', { event: 'question' }, ({ payload }) => handlers.onQuestion?.(payload as QuestionPayload))
    .on('broadcast', { event: 'answer_count' }, ({ payload }) =>
      handlers.onAnswerCount?.(payload as AnswerCountPayload),
    )
    .on('broadcast', { event: 'reveal' }, ({ payload }) => handlers.onReveal?.(payload as RevealPayload))
    .on('broadcast', { event: 'finished' }, ({ payload }) => handlers.onFinished?.(payload as FinishedPayload))
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<LobbyPlayer>()
      handlers.onLobby?.(Object.values(state).flatMap((entries) => entries.slice(0, 1)))
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        if (nickname) await channel.track({ nickname })
        handlers.onConnected?.()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handlers.onDisconnected?.()
      }
    })

  return () => {
    void supabase.removeChannel(channel)
  }
}
