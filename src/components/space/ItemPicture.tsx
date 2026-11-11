import type { OrbitId } from '../../game/types'
import { useThumbnail } from './thumbnailStore'

/**
 * The picture at the top of an item card. Parts, instruments and rockets show
 * a render of their 3D model (made by ThumbnailStudio); orbits show a diagram.
 */
export default function ItemPicture({ thumb, orbit, alt }: { thumb?: string; orbit?: OrbitId; alt: string }) {
  return (
    <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_50%_35%,rgba(56,189,248,0.16),rgba(2,6,23,0.6)_70%)]">
      {orbit ? <OrbitPicture id={orbit} label={alt} /> : thumb ? <Render thumb={thumb} alt={alt} /> : null}
    </div>
  )
}

function Render({ thumb, alt }: { thumb: string; alt: string }) {
  const url = useThumbnail(thumb)
  if (!url) return <div className="size-16 animate-pulse rounded-full bg-white/10" aria-label={`Loading picture of ${alt}`} />
  return <img src={url} alt={alt} className="h-full w-full object-contain p-1 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]" draggable={false} />
}

/* ---------------- orbit diagrams ---------------- */

const EARTH = (cx: number, cy: number, r: number) => (
  <>
    <defs>
      <radialGradient id="earthFill" cx="35%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#7dd3fc" />
        <stop offset="45%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#0b1d4d" />
      </radialGradient>
    </defs>
    <circle cx={cx} cy={cy} r={r + 2} fill="#38bdf8" opacity="0.25" />
    <circle cx={cx} cy={cy} r={r} fill="url(#earthFill)" />
    <path d={`M${cx - r * 0.5} ${cy - r * 0.2} q ${r * 0.3} ${-r * 0.4} ${r * 0.6} ${-r * 0.1} t ${r * 0.4} ${r * 0.3}`} fill="none" stroke="#4ade80" strokeWidth="2" opacity="0.7" />
  </>
)

const SAT = (x: number, y: number) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="-9" y="-2" width="6" height="4" fill="#60a5fa" />
    <rect x="3" y="-2" width="6" height="4" fill="#60a5fa" />
    <rect x="-3" y="-3" width="6" height="6" rx="1" fill="#fbbf24" />
  </g>
)

/** A simple picture of where each orbit goes */
function OrbitPicture({ id, label }: { id: OrbitId; label: string }) {
  const ring = { fill: 'none', stroke: '#67e8f9', strokeWidth: 1.6, opacity: 0.9 }
  let art
  switch (id) {
    case 'leo':
      art = (
        <>
          {EARTH(80, 50, 26)}
          <ellipse cx="80" cy="50" rx="36" ry="12" {...ring} />
          {SAT(115, 52)}
        </>
      )
      break
    case 'sso':
      art = (
        <>
          {EARTH(80, 50, 26)}
          <ellipse cx="80" cy="50" rx="10" ry="38" {...ring} transform="rotate(12 80 50)" />
          {SAT(86, 13)}
          <circle cx="150" cy="18" r="6" fill="#fde047" />
        </>
      )
      break
    case 'geo':
      art = (
        <>
          <ellipse cx="80" cy="50" rx="70" ry="22" {...ring} strokeDasharray="0" />
          {EARTH(80, 50, 13)}
          {SAT(150, 52)}
        </>
      )
      break
    case 'l1':
      art = (
        <>
          <circle cx="16" cy="50" r="16" fill="#fbbf24" />
          <circle cx="16" cy="50" r="22" fill="#fbbf24" opacity="0.25" />
          <line x1="34" y1="50" x2="140" y2="50" stroke="#94a3b8" strokeDasharray="3 4" strokeWidth="1.2" />
          {EARTH(140, 50, 10)}
          {SAT(112, 50)}
          <text x="112" y="36" textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="600">L1</text>
        </>
      )
      break
    default:
      art = (
        <>
          {EARTH(22, 70, 12)}
          <path d="M34 64 C 70 30, 110 24, 140 30" fill="none" stroke="#67e8f9" strokeWidth="1.6" strokeDasharray="4 4" />
          <path d="M140 22 l6 4 -2 7 -7 2 -5 -5 2 -6 z" fill="#a8a29e" />
          {SAT(96, 33)}
        </>
      )
  }
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label={`Diagram of ${label}`} className="h-full w-full p-2">
      {art}
    </svg>
  )
}
