import { MotionConfig } from 'framer-motion'
import { Navigate, Route, Routes } from 'react-router-dom'
import LeaderboardPage from './leaderboard/LeaderboardPage'
import SharedResultPage from './leaderboard/SharedResultPage'
import MissionHome from './MissionHome'
import TeamRoom from './team/TeamRoom'
import TeamStart from './team/TeamStart'
import DesignPage from './design/DesignPage'
import LaunchPage from './launch/LaunchPage'
import SoloFlight from './launch/SoloFlight'

/**
 * The Space Mission Design Game: one mission, four phases (docs/PLAN.md).
 * /mission                choose solo or team
 * /mission/design         Zakwan: pick a mission, build the spacecraft, live dashboard
 * /mission/launch         Zakwan: orbit, rocket fit check, launch day
 * /mission/operate        Adaam's Operate + Report, flying the launched design (SoloFlight)
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
        <Route path="design" element={<DesignPage />} />
        <Route path="launch" element={<LaunchPage />} />
        <Route path="operate" element={<SoloFlight />} />
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
