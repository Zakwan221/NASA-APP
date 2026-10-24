import ErrorMessage from '../../../components/ui/ErrorMessage'
import Section from '../../../components/ui/Section'
import Skeleton from '../../../components/ui/Skeleton'
import { useAsync } from '../../../hooks/useAsync'
import { getTodayAsteroids } from '../../../lib/nasa'
import CountUp from './CountUp'

const MOON_DISTANCE_KM = 384_400

export default function AsteroidStat() {
  const state = useAsync(getTodayAsteroids)

  return (
    <Section id="asteroids" eyebrow="Right now" title="Today's near-Earth traffic">
      <div className="card glow-cyan relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-cyan-400/10 blur-3xl" />

        {state.status === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-14 w-32" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {state.status === 'error' && <ErrorMessage message="We couldn't reach NASA's asteroid tracker." />}

        {state.status === 'success' && (() => {
          const { total, hazardous, asteroids } = state.data
          const closest = asteroids[0]
          return (
            <div className="relative">
              <p className="text-lg text-slate-200 sm:text-2xl">
                <span aria-hidden="true">🌍 </span>
                <CountUp
                  value={total}
                  className="block font-display text-6xl font-bold text-cyan-300 tabular-nums sm:inline sm:text-7xl"
                />{' '}
                asteroids pass near Earth today
              </p>

              <p className="mt-3 text-slate-300">
                <span className="font-semibold text-violet-300">{hazardous}</span>{' '}
                {hazardous === 1 ? 'is' : 'are'} potentially hazardous
              </p>

              {closest && (
                <p className="mt-6 border-t border-white/10 pt-4 text-sm text-slate-400">
                  Closest pass: <span className="text-slate-200">{closest.name}</span>, about{' '}
                  {closest.missDistanceKm.toLocaleString()} km away (
                  {(closest.missDistanceKm / MOON_DISTANCE_KM).toFixed(1)}× the Moon's distance), ~
                  {closest.diameterMeters.toLocaleString()} m wide.
                </p>
              )}
            </div>
          )
        })()}
      </div>
    </Section>
  )
}
