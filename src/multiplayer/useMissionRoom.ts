import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureSignedIn } from '../lib/supabase'
import {
  connectToMission,
  getMissionOps,
  getMissionState,
  type MissionOps,
  type MissionState,
  type VotePayload,
} from './missionApi'

export interface MissionRoom {
  userId: string | null
  room: MissionState | null
  ops: MissionOps | null
  /** The open vote, kept live from broadcasts */
  vote: VotePayload | null
  online: string[]
  connected: boolean
  error: string | null
  setError: (e: string | null) => void
  reload: () => Promise<void>
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong, try again'
}

/** Live state of one team mission room: crew, phase, votes and Operate moves. */
export function useMissionRoom(code: string): MissionRoom {
  const [userId, setUserId] = useState<string | null>(null)
  const [room, setRoom] = useState<MissionState | null>(null)
  const [ops, setOps] = useState<MissionOps | null>(null)
  const [vote, setVote] = useState<VotePayload | null>(null)
  const [online, setOnline] = useState<string[]>([])
  const [connected, setConnected] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const roomId = useRef<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const state = await getMissionState(code)
      const moves = await getMissionOps(state.room_id)
      // set together, so a screen never sees the new phase with the old moves
      roomId.current = state.room_id
      setRoom(state)
      setVote(state.open_vote)
      setOps(moves)
    } catch (e) {
      setError(errorText(e))
    }
  }, [code])

  useEffect(() => {
    let leave: (() => void) | undefined
    let cancelled = false
    ensureSignedIn()
      .then((uid) => {
        if (cancelled) return
        setUserId(uid)
        leave = connectToMission(code, uid, {
          onConnected: () => {
            setConnected(true)
            void reload()
          },
          onDisconnected: () => setConnected(false),
          onCrew: (crew) => setRoom((r) => (r ? { ...r, crew } : r)),
          onDesign: () => void reload(),
          onPhase: () => void reload(),
          onResult: () => void reload(),
          onVote: (v) => setVote(v.status === 'open' ? v : null),
          onOp: (op) =>
            setOps((cur) =>
              cur && op.attempt === cur.attempt && !cur.ops.some((o) => o.id === op.id)
                ? { ...cur, ops: [...cur.ops, op] }
                : cur,
            ),
          onOnline: setOnline,
        })
      })
      .catch((e) => setError(errorText(e)))
    return () => {
      cancelled = true
      leave?.()
    }
  }, [code, reload])

  // If Realtime is down (e.g. a school network blocks websockets), keep the game
  // going by reloading every few seconds until it comes back
  useEffect(() => {
    if (connected) return
    const timer = setInterval(() => void reload(), 3000)
    return () => clearInterval(timer)
  }, [connected, reload])

  return { userId, room, ops, vote, online, connected, error, setError, reload }
}
