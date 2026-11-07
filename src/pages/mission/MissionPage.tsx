import { MotionConfig } from 'framer-motion'
import { Navigate, Route, Routes } from 'react-router-dom'
import LeaderboardPage from './leaderboard/LeaderboardPage'
import SharedResultPage from './leaderboard/SharedResultPage'
import MissionHome from './MissionHome'
import OperatePage from './operate/OperatePage'
import TeamRoom from './team/TeamRoom'
import TeamStart from './team/TeamStart'

/**
 * The Space Mission Design Game: one mission, four phases (docs/PLAN.md).
 * /mission                choose solo or team
 * /mission/design         Zakwan (todo)
 * /mission/launch         Zakwan (todo)
 * /mission/operate        Adaam: solo flight, then the Report (placeholder spacecraft for now)
 * /mission/team/host      Adaam: open a team room
 * /mission/team/join      Adaam: join with a code (?code= pre-fills)
 * /mission/team/:code     Adaam: lobby → operate → report, shared by up to 4 phones
 * /mission/leaderboard    Adaam: best score per name, solo and teams
 * /mission/r/:id          Adaam: one posted mission, to share and compare
 */
export default function MissionPage() {
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route index element={<MissionHome />} />
        <Route path="operate" element={<OperatePage />} />
        <Route path="team/host" element={<TeamStart mode="host" />} />
        <Route path="team/join" element={<TeamStart mode="join" />} />
        <Route path="team/:code" element={<TeamRoom />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="r/:id" element={<SharedResultPage />} />
        <Route path="*" element={<Navigate to="/mission" replace />} />
      </Routes>
    </MotionConfig>
  )
}
