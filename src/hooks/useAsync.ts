import { useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; data: T }

/**
 * Runs an async loader once on mount.
 * A `null` result is treated as an error (matches lib/nasa.ts).
 * Pass a stable function (e.g. getAPOD), not an inline arrow.
 */
export function useAsync<T>(loader: () => Promise<T | null>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    loader().then((data) => {
      if (cancelled) return
      setState(data === null ? { status: 'error' } : { status: 'success', data })
    })
    return () => {
      cancelled = true
    }
  }, [loader])

  return state
}
