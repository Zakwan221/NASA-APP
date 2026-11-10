import type { ReactNode } from 'react'

interface GameShellProps {
  children: ReactNode
  error?: string | null
  /** Shows a small "Reconnecting…" bar */
  offline?: boolean
}

/** Page frame for every quiz screen: clears the fixed navbar, shows errors. */
export default function GameShell({ children, error, offline }: GameShellProps) {
  return (
    <div className="mx-auto flex min-h-[85svh] w-full max-w-3xl flex-col px-4 pb-10 pt-20 sm:px-6 sm:pt-24">
      {offline && (
        <p role="status" className="mb-4 rounded-full bg-amber-400/15 px-4 py-2 text-center text-sm text-amber-200">
          Reconnecting…
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      {children}
    </div>
  )
}
