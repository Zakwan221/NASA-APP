import { useEffect } from 'react'

/** Keeps the phone screen on during a game (where the browser supports it). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let released = false

    const request = () => {
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (released) void l.release()
          else lock = l
        })
        .catch(() => {
          /* low battery mode or not allowed: ignore */
        })
    }
    // the lock drops when the tab is hidden, so take it again on return
    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }

    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      void lock?.release()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active])
}
