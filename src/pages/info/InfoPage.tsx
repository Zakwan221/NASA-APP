import { Navigate, Route, Routes } from 'react-router-dom'
import GuideStory from './components/GuideStory'
import InfoNav from './components/InfoNav'
import ItemsPage from './items/ItemsPage'
import TipsPage from './tips/TipsPage'

/**
 * Module 2: everything about the mission game.
 * /info        How to play (3D scroll guide)
 * /info/items  Every item explained, with a 3D view
 * /info/tips   How to win each mission, with tested builds
 */
export default function InfoPage() {
  return (
    <>
      <InfoNav />
      <Routes>
        <Route index element={<GuideStory />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="tips" element={<TipsPage />} />
        <Route path="*" element={<Navigate to="/info" replace />} />
      </Routes>
    </>
  )
}
