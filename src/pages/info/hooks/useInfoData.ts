import { useCallback, useEffect, useRef, useState } from 'react'

export type InfoState<T> =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'success'; data: T }

/**
 * Loads data and re-loads whenever `key` changes (e.g. a search term).
 * `null` from the loader = error, with a retry() to try again.
 */
export function useInfoData<T>(load: () => Promise<T | null>, key = ''): InfoState<T> {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data: T | null } | null>(null)
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  const fullKey = `${key}#${attempt}`

  useEffect(() => {
    let cancelled = false
    loadRef.current().then((data) => {
      if (!cancelled) setResult({ key: fullKey, data })
    })
    return () => {
      cancelled = true
    }
  }, [fullKey])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (!result || result.key !== fullKey) return { status: 'loading' }
  if (result.data === null) return { status: 'error', retry }
  return { status: 'success', data: result.data }
}
