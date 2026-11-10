import { useMemo, useState } from 'react'
import Skeleton from '../../../components/ui/Skeleton'
import { KUALA_LUMPUR } from '../api/cache'
import { getOpenEvents, type NaturalEvent } from '../api/eonet'
import Chip from '../components/Chip'
import DataSource from '../components/DataSource'
import LoadState from '../components/LoadState'
import Stat from '../components/Stat'
import TabHeader from '../components/TabHeader'
import { useInfoData } from '../hooks/useInfoData'
import { fmt, formatDate, formatLatLon, timeAgo } from '../utils/format'

/** NASA GIBS Blue Marble — a real NASA satellite mosaic used as the map background */
const GIBS_MAP =
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&STYLES=&FORMAT=image/jpeg&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=1440&HEIGHT=720'

const STYLES: Record<string, { color: string; icon: string }> = {
  wildfires: { color: '#fb923c', icon: '🔥' },
  severeStorms: { color: '#22d3ee', icon: '🌀' },
  volcanoes: { color: '#f43f5e', icon: '🌋' },
  seaLakeIce: { color: '#e0f2fe', icon: '🧊' },
  earthquakes: { color: '#facc15', icon: '〰️' },
  floods: { color: '#60a5fa', icon: '🌊' },
  landslides: { color: '#a3e635', icon: '⛰️' },
  dustHaze: { color: '#d6d3d1', icon: '🌫️' },
  snow: { color: '#f8fafc', icon: '❄️' },
  drought: { color: '#fbbf24', icon: '🏜️' },
  tempExtremes: { color: '#f87171', icon: '🌡️' },
  waterColor: { color: '#2dd4bf', icon: '💧' },
  manmade: { color: '#c084fc', icon: '🏭' },
}
const styleOf = (id: string) => STYLES[id] ?? { color: '#a78bfa', icon: '📍' }

// Equirectangular projection into a 360×180 SVG
const px = (lon: number) => lon + 180
const py = (lat: number) => 90 - lat

function worldviewUrl(e: NaturalEvent) {
  const v = [e.lon - 10, e.lat - 6, e.lon + 10, e.lat + 6].map((n) => n.toFixed(2)).join(',')
  return `https://worldview.earthdata.nasa.gov/?v=${v}&t=${e.date.slice(0, 10)}-T00:00:00Z`
}

function EventMap({
  events,
  selectedId,
  onSelect,
}: {
  events: NaturalEvent[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="card overflow-hidden p-0">
      <svg
        viewBox="0 0 360 180"
        className="block h-auto w-full bg-space-800"
        role="img"
        aria-label={`World map showing ${events.length} active natural events`}
      >
        <image href={GIBS_MAP} x="0" y="0" width="360" height="180" preserveAspectRatio="none" opacity="0.85" />

        {/* Storm tracks */}
        {events
          .filter((e) => e.track.length > 1)
          .map((e) => (
            <polyline
              key={`${e.id}-track`}
              points={e.track.map(([lon, lat]) => `${px(lon)},${py(lat)}`).join(' ')}
              fill="none"
              stroke={styleOf(e.categoryId).color}
              strokeWidth="0.6"
              strokeOpacity="0.7"
              strokeDasharray="1.5 1"
            />
          ))}

        {/* Kuala Lumpur */}
        <g transform={`translate(${px(KUALA_LUMPUR.lon)} ${py(KUALA_LUMPUR.lat)})`}>
          <rect x="-1.6" y="-1.6" width="3.2" height="3.2" transform="rotate(45)" fill="#22d3ee" stroke="#050816" strokeWidth="0.5" />
          <text x="3" y="1.2" fontSize="4" fill="#ecfeff" fontWeight="700">KL</text>
        </g>

        {events.map((e) => {
          const selected = e.id === selectedId
          return (
            <g
              key={e.id}
              transform={`translate(${px(e.lon)} ${py(e.lat)})`}
              onClick={() => onSelect(e.id)}
              className="cursor-pointer"
            >
              <circle r="6" fill="transparent" />
              {selected && <circle r="5" fill="none" stroke="#fff" strokeWidth="0.6" className="animate-pulse" />}
              <circle
                r={selected ? 2.8 : 1.8}
                fill={styleOf(e.categoryId).color}
                stroke="#050816"
                strokeWidth="0.4"
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function EventDetail({ event }: { event: NaturalEvent }) {
  const s = styleOf(event.categoryId)
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: s.color }}>
        {s.icon} {event.categoryTitle}
      </p>
      <h3 className="mt-1 text-xl font-bold">{event.title}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-400">Last update</dt>
        <dd>{formatDate(event.date)}</dd>
        <dt className="text-slate-400">Location</dt>
        <dd>{formatLatLon(event.lat, event.lon)}</dd>
        <dt className="text-slate-400">From Kuala Lumpur</dt>
        <dd>{fmt(event.kmFromKL)} km</dd>
        {event.magnitude && (
          <>
            <dt className="text-slate-400">Strength</dt>
            <dd>{event.magnitude}</dd>
          </>
        )}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={worldviewUrl(event)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-full bg-cyan-400 px-5 text-sm font-semibold text-space-950 hover:bg-cyan-300"
        >
          See it from space ↗
        </a>
        {event.sourceUrl && (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold hover:bg-white/10"
          >
            Original report ↗
          </a>
        )}
      </div>
    </div>
  )
}

function EventsExplorer({ events }: { events: NaturalEvent[] }) {
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<'newest' | 'nearest'>('newest')
  const [selectedId, setSelectedId] = useState<string>()
  const [limit, setLimit] = useState(10)

  const categories = useMemo(() => {
    const counts = new Map<string, { title: string; count: number }>()
    events.forEach((e) => {
      const c = counts.get(e.categoryId) ?? { title: e.categoryTitle, count: 0 }
      counts.set(e.categoryId, { ...c, count: c.count + 1 })
    })
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [events])

  const visible = useMemo(() => {
    const list = category === 'all' ? events : events.filter((e) => e.categoryId === category)
    return sort === 'nearest' ? [...list].sort((a, b) => a.kmFromKL - b.kmFromKL) : list
  }, [events, category, sort])

  const nearest = useMemo(() => [...events].sort((a, b) => a.kmFromKL - b.kmFromKL)[0], [events])
  const selected = visible.find((e) => e.id === selectedId) ?? visible[0]
  const storms = events.filter((e) => e.categoryId === 'severeStorms').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Active events" value={events.length} hint="Last 60 days, still open" />
        <Stat label="Storms tracked" value={storms} accent="violet" />
        {nearest && (
          <div className="col-span-2 md:col-span-1">
            <Stat
              label="Closest to Malaysia"
              value={`${fmt(nearest.kmFromKL)} km`}
              hint={nearest.title}
              accent="amber"
            />
          </div>
        )}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip active={category === 'all'} onClick={() => setCategory('all')}>
          All ({events.length})
        </Chip>
        {categories.map(([id, c]) => (
          <Chip key={id} active={category === id} onClick={() => setCategory(id)}>
            {styleOf(id).icon} {c.title} ({c.count})
          </Chip>
        ))}
      </div>

      <div id="event-focus" className="grid scroll-mt-36 gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <EventMap events={visible} selectedId={selected?.id} onSelect={setSelectedId} />
        {selected ? <EventDetail event={selected} /> : <p className="text-slate-400">No events in this category.</p>}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Event list</h3>
          <div className="flex gap-2">
            <Chip active={sort === 'newest'} onClick={() => setSort('newest')}>Newest</Chip>
            <Chip active={sort === 'nearest'} onClick={() => setSort('nearest')}>Nearest to Malaysia</Chip>
          </div>
        </div>
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
          {visible.slice(0, limit).map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(e.id)
                  document.getElementById('event-focus')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 ${
                  e.id === selected?.id ? 'bg-white/[0.06]' : ''
                }`}
              >
                <span aria-hidden="true" className="text-xl">{styleOf(e.categoryId).icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{e.title}</span>
                  <span className="text-xs text-slate-400">
                    {timeAgo(e.date)} · {fmt(e.kmFromKL)} km from KL
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {visible.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + 10)}
            className="mt-3 min-h-11 w-full rounded-full border border-white/15 font-semibold hover:bg-white/10"
          >
            Show more ({visible.length - limit} left)
          </button>
        )}
      </div>
    </div>
  )
}

export default function EventsTab() {
  const state = useInfoData(getOpenEvents)

  return (
    <>
      <TabHeader
        mission="NASA EONET · Earth Observatory"
        title="Live events on Earth"
        intro="Wildfires, storms, volcanoes and drifting ice that NASA is tracking right now. Tap a dot on the map to see where it is and how far it is from Malaysia."
        why="Satellites spot fires and storms faster than people on the ground can, which helps send warnings and help sooner."
      />

      <LoadState
        state={state}
        what="NASA's live event tracker"
        skeleton={
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="col-span-2 h-24 md:col-span-1" />
            </div>
            <Skeleton className="aspect-[2/1] w-full" />
          </div>
        }
      >
        {(events) => <EventsExplorer events={events} />}
      </LoadState>

      <DataSource
        sources={[
          { name: 'NASA EONET v3 — Earth Observatory Natural Event Tracker', url: 'https://eonet.gsfc.nasa.gov/docs/v3' },
          { name: 'NASA GIBS — Blue Marble map imagery', url: 'https://nasa-gibs.github.io/gibs-api-docs/' },
          { name: 'NASA Worldview', url: 'https://worldview.earthdata.nasa.gov/' },
        ]}
        note="Event reports come from partner agencies listed on each event's original report."
      />
    </>
  )
}
