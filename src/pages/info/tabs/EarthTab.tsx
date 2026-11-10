import { useEffect, useMemo, useState } from 'react'
import Skeleton from '../../../components/ui/Skeleton'
import { distanceKm, KUALA_LUMPUR } from '../api/cache'
import { getLatestEpic, type EpicImage } from '../api/epic'
import { LUNAR_DISTANCE_KM } from '../api/neows'
import DataSource from '../components/DataSource'
import LoadState from '../components/LoadState'
import Stat from '../components/Stat'
import TabHeader from '../components/TabHeader'
import { useInfoData } from '../hooks/useInfoData'
import { fmt, formatDate, formatLatLon } from '../utils/format'

/** Malaysia counts as "in view" when it's within ~7,000 km of the photo's centre point */
const IN_VIEW_KM = 7000

function EarthViewer({ images }: { images: EpicImage[] }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loaded, setLoaded] = useState(0)
  const current = images[index]

  // Preload every frame so scrubbing is instant
  useEffect(() => {
    let count = 0
    images.forEach((img) => {
      const el = new Image()
      el.onload = el.onerror = () => setLoaded(++count)
      el.src = img.imageUrl
    })
  }, [images])

  // Time-lapse playback
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % images.length), 650)
    return () => window.clearInterval(id)
  }, [playing, images.length])

  const kmFromKL = distanceKm(KUALA_LUMPUR, current)
  const malaysiaInView = kmFromKL < IN_VIEW_KM

  // Frame where Malaysia is closest to the centre
  const malaysiaFrame = useMemo(() => {
    let best = 0
    images.forEach((img, i) => {
      if (distanceKm(KUALA_LUMPUR, img) < distanceKm(KUALA_LUMPUR, images[best])) best = i
    })
    return best
  }, [images])

  const allLoaded = loaded >= images.length

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px] md:items-start">
      <figure className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-3xl bg-black">
        <img
          src={current.imageUrl}
          alt={`Earth photographed by NASA's EPIC camera at ${formatDate(current.date, true)} Malaysia time`}
          className="h-full w-full object-contain"
        />
        {!allLoaded && (
          <figcaption className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs text-slate-300">
            Loading photos {loaded}/{images.length}…
          </figcaption>
        )}
        {malaysiaInView && (
          <span className="absolute right-3 top-3 rounded-full bg-cyan-400/90 px-3 py-1 text-xs font-bold text-space-950">
            ● Malaysia in view
          </span>
        )}
      </figure>

      <div className="space-y-4">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Photo {index + 1} of {images.length}
          </p>
          <p className="mt-1 font-display text-xl font-bold">{formatDate(current.date, true)}</p>
          <p className="text-xs text-slate-400">Malaysia time</p>

          <label htmlFor="epic-scrub" className="sr-only">
            Choose photo time
          </label>
          <input
            id="epic-scrub"
            type="range"
            min={0}
            max={images.length - 1}
            value={index}
            onChange={(e) => {
              setPlaying(false)
              setIndex(Number(e.target.value))
            }}
            className="mt-4 h-11 w-full cursor-pointer accent-cyan-400"
          />

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="min-h-11 flex-1 rounded-full bg-cyan-400 px-5 font-semibold text-space-950 hover:bg-cyan-300"
            >
              {playing ? '⏸ Pause' : '▶ Watch Earth spin'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false)
                setIndex(malaysiaFrame)
              }}
              className="min-h-11 flex-1 rounded-full border border-white/15 px-5 font-semibold hover:bg-white/10"
            >
              Find Malaysia
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Facing camera" value={formatLatLon(current.lat, current.lon)} hint="Centre of this photo" />
          <Stat
            label="Camera distance"
            value={`${fmt(Math.round(current.distanceKm / 1000))}k km`}
            hint={`≈ ${(current.distanceKm / LUNAR_DISTANCE_KM).toFixed(1)}× Earth–Moon`}
            accent="violet"
          />
        </div>
      </div>
    </div>
  )
}

export default function EarthTab() {
  const state = useInfoData(getLatestEpic)

  return (
    <>
      <TabHeader
        mission="NASA EPIC · DSCOVR satellite"
        title="Earth, today"
        intro="NASA's EPIC camera sits on the DSCOVR satellite about 1.5 million km away, where it sees the whole sunlit side of Earth at once. It takes a new photo every couple of hours — drag the slider to watch our planet turn."
        why="Daily full-Earth photos help scientists track clouds, ozone, dust, smoke and how much sunlight Earth reflects."
      />

      <LoadState
        state={state}
        what="NASA's Earth photos"
        skeleton={
          <div className="grid gap-6 md:grid-cols-[1fr_340px]">
            <Skeleton className="aspect-square w-full rounded-3xl" />
            <Skeleton className="h-56 w-full" />
          </div>
        }
      >
        {(images) => <EarthViewer images={images} />}
      </LoadState>

      <DataSource
        sources={[
          { name: 'NASA EPIC API (Earth Polychromatic Imaging Camera)', url: 'https://epic.gsfc.nasa.gov/about/api' },
          { name: 'About DSCOVR: EPIC', url: 'https://epic.gsfc.nasa.gov/about' },
        ]}
        note="Images courtesy of NASA EPIC team / NOAA DSCOVR."
      />
    </>
  )
}
