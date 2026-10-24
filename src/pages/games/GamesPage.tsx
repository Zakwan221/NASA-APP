import { Navigate, Route, Routes } from 'react-router-dom'
import GamesHome from './screens/GamesHome'
import HostRoom from './screens/HostRoom'
import HostSetup from './screens/HostSetup'
import JoinForm from './screens/JoinForm'
import PlayerRoom from './screens/PlayerRoom'

/**
 * Module 3 — live multiplayer quiz.
 * /games              choose host or join
 * /games/host         host picks a quiz
 * /games/host/:code   host's big screen
 * /games/join         player enters code + nickname (?code= pre-fills)
 * /games/room/:code   player's phone
 */
export default function GamesPage() {
  return (
    <Routes>
      <Route index element={<GamesHome />} />
      <Route path="host" element={<HostSetup />} />
      <Route path="host/:code" element={<HostRoom />} />
      <Route path="join" element={<JoinForm />} />
      <Route path="room/:code" element={<PlayerRoom />} />
      <Route path="*" element={<Navigate to="/games" replace />} />
    </Routes>
  )
}
