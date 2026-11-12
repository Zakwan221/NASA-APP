import { Wrench } from 'lucide-react'
import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { buildFlight } from '../../../game/engine/evaluate'
import { useMission } from '../../../store/missionStore'
import OperatePage from '../operate/OperatePage'

/**
 * /mission/operate for solo play: flies the spacecraft from Design and Launch.
 * Sends the player back a step if the design isn't finished or hasn't launched.
 */
export default function SoloFlight() {
  const { design, launch } = useMission()
  const craft = useMemo(
    () => (launch && launch.tone !== 'fail' ? buildFlight(design, launch.extraCostM) : null),
    [design, launch],
  )

  if (!craft) return <Navigate to={launch && launch.tone !== 'fail' ? '/mission/design' : '/mission/launch'} replace />

  return (
    <OperatePage
      craft={craft}
      reportFooter={
        <div className="card mt-6 p-5 text-center">
          <p className="font-semibold">Want to fix what went wrong?</p>
          <p className="mt-1 text-sm text-slate-400">
            Change the parts, orbit or rocket, then launch and fly again. Your score is kept so you can compare.
          </p>
          <Link
            to="/mission/design"
            state={{ redesign: true }}
            className="mt-4 inline-flex min-h-12 items-center rounded-full border border-cyan-300/50 px-6 font-semibold text-cyan-200 transition hover:bg-cyan-300/10"
          >
            <Wrench aria-hidden="true" className="mr-2 size-4" /> Redesign spacecraft
          </Link>
        </div>
      }
    />
  )
}
