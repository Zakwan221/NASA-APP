import ApodSection from './components/ApodSection'
import AsteroidStat from './components/AsteroidStat'
import HowItWorks from './components/HowItWorks'
import SolarStory from './components/SolarStory'

export default function HomePage() {
  return (
    <>
      <SolarStory />
      <AsteroidStat />
      <ApodSection />
      <HowItWorks />
    </>
  )
}
