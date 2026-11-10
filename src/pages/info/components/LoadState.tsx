import type { ReactNode } from 'react'
import Skeleton from '../../../components/ui/Skeleton'
import type { InfoState } from '../hooks/useInfoData'

interface LoadStateProps<T> {
  state: InfoState<T>
  what: string // e.g. "NASA's Earth images"
  needsKey?: boolean // api.nasa.gov endpoints
  skeleton?: ReactNode
  children: (data: T) => ReactNode
}

/** Shows a skeleton while loading, a friendly retry box on error, else the content. */
export default function LoadState<T>({ state, what, needsKey, skeleton, children }: LoadStateProps<T>) {
  if (state.status === 'loading') {
    return (
      <div aria-busy="true" aria-label={`Loading ${what}`}>
        {skeleton ?? (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        )}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div role="status" className="card flex flex-col items-start gap-3 p-6 text-sm text-slate-300">
        <p>
          <span aria-hidden="true">🛰️ </span>
          We couldn't load {what} right now.
          {needsKey && (
            <span className="mt-1 block text-slate-400">
              NASA limits shared keys. Add your free key from api.nasa.gov to <code>.env</code> as VITE_NASA_KEY.
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={state.retry}
          className="min-h-11 rounded-full border border-white/15 px-5 font-semibold text-white hover:bg-white/10"
        >
          Try again
        </button>
      </div>
    )
  }

  return <>{children(state.data)}</>
}
