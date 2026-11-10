import { useEffect } from 'react'
import { ensureSignedIn } from '../../../lib/supabase'
import { clockOffset, connectToRoom, getRoomState } from '../api/quizApi'
import { useQuizStore } from '../store/useQuizStore'

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Try again.'
}

/** Reload the room from the database (after a refresh, reconnect or screen unlock). */
export async function refreshRoom(code: string): Promise<void> {
  const store = useQuizStore.getState()
  try {
    const started = Date.now()
    const state = await getRoomState(code)
    store.hydrate(state, clockOffset(state, started))
  } catch (e) {
    store.setError(errorMessage(e))
  }
}

/**
 * Connects this screen to a room: signs in, loads the room state,
 * subscribes to live events, and resyncs whenever the connection
 * comes back or the phone wakes up.
 * Pass a nickname to appear in the lobby (players). The host passes none.
 */
export function useRoom(code: string, nickname?: string) {
  useEffect(() => {
    let cancelled = false
    let leave: (() => void) | null = null
    const store = useQuizStore.getState()
    store.reset()

    const refresh = () => {
      if (!cancelled) void refreshRoom(code)
    }

    ;(async () => {
      try {
        const userId = await ensureSignedIn()
        if (cancelled) return
        store.setUserId(userId)
        await refreshRoom(code)
        if (cancelled) return

        leave = connectToRoom(
          code,
          userId,
          {
            onQuestion: (q) => useQuizStore.getState().onQuestion(q),
            onAnswerCount: (c) => useQuizStore.getState().onAnswerCount(c),
            onReveal: (r) => useQuizStore.getState().onReveal(r),
            onFinished: (f) => useQuizStore.getState().onFinished(f),
            onLobby: (players) => {
              useQuizStore.getState().setLobby(players)
              // the player list on screen comes from the database
              if (useQuizStore.getState().status === 'lobby') refresh()
            },
            onConnected: () => {
              useQuizStore.getState().setConnected(true)
              refresh()
            },
            onDisconnected: () => useQuizStore.getState().setConnected(false),
          },
          nickname,
        )
      } catch (e) {
        if (!cancelled) store.setError(errorMessage(e))
      }
    })()

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      leave?.()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [code, nickname])
}
