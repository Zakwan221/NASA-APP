import { MotionConfig } from 'framer-motion'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Footer from '../footer/Footer'
import Navbar from '../navbar/Navbar'

/** Shared shell for every page: navbar on top, footer at the bottom. */
export default function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-svh flex-col">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  )
}
