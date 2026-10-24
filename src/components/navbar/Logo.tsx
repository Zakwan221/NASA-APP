import { Link } from 'react-router-dom'

export default function Logo() {
  return (
    <Link to="/" className="flex min-h-11 items-center gap-2" aria-label="Orbitly home">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="6" fill="url(#logo-grad)" />
        <ellipse
          cx="16"
          cy="16"
          rx="14"
          ry="5.5"
          fill="none"
          stroke="#22d3ee"
          strokeWidth="1.6"
          transform="rotate(-25 16 16)"
        />
        <circle cx="28" cy="10.5" r="1.8" fill="#a78bfa" />
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="font-display text-xl font-bold tracking-tight">Orbitly</span>
    </Link>
  )
}
