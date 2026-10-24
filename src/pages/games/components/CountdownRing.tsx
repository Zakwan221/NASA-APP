interface CountdownRingProps {
  secondsLeft: number
  total: number
  size?: number
}

/** Circular timer. Turns red for the last 5 seconds. */
export default function CountdownRing({ secondsLeft, total, size = 72 }: CountdownRingProps) {
  const left = Math.max(0, secondsLeft)
  const r = 28
  const circumference = 2 * Math.PI * r
  const progress = total > 0 ? left / total : 0
  const urgent = left <= 5

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={urgent ? '#fb7185' : '#22d3ee'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 100ms linear' }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-display text-2xl font-bold tabular-nums ${
          urgent ? 'text-rose-300' : 'text-white'
        }`}
      >
        {Math.ceil(left)}
      </span>
    </div>
  )
}
