import { MotionConfig } from 'framer-motion'
import { Navigate, Route, Routes } from 'react-router-dom'
import OperatePage from './operate/OperatePage'

/**
 * The Space Mission Design Game: one mission, four phases (docs/PLAN.md).
 * /mission/design   Zakwan (todo)
 * /mission/launch   Zakwan (todo)
 * /mission/operate  Adaam: fly month by month (uses a placeholder spacecraft for now)
 * /mission/report   Adaam: shown at the end of Operate (ReportScreen), no route of its own yet
 */
export default function MissionPage() {
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="operate" element={<OperatePage />} />
        <Route path="*" element={<Navigate to="/mission/operate" replace />} />
      </Routes>
    </MotionConfig>
  )
}
