import ApodSection from './components/ApodSection'
import AsteroidStat from './components/AsteroidStat'
import HowItWorks from './components/HowItWorks'
import Hero from './components/Hero'

export default function HomePage() {
  return (
    <>
      <Hero />
      <AsteroidStat />
      <ApodSection />
      <HowItWorks />
    </>
  )
}
