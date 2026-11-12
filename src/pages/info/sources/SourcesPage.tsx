import { ExternalLink } from 'lucide-react'
import { CinematicHeader } from '../components/Cinematic'

interface Source {
  name: string
  url: string
  use: string
}

const GROUPS: { title: string; text: string; items: Source[] }[] = [
  {
    title: 'Live NASA data in the game',
    text: 'Read from NASA while you play. If NASA can’t be reached, the game uses a saved copy (src/game/data/nasa-snapshot.json).',
    items: [
      {
        name: 'NASA EONET (Earth Observatory Natural Event Tracker)',
        url: 'https://eonet.gsfc.nasa.gov/',
        use: 'Earth watch: wildfires in Southeast Asia in the last 90 days, and the one nearest to Malaysia.',
      },
      {
        name: 'NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)',
        url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
        use: 'Solar storm watch: solar storms (CMEs) of the last 30 days, the latest and the fastest.',
      },
      {
        name: 'NASA NeoWs (Near Earth Object Web Service)',
        url: 'https://api.nasa.gov/',
        use: 'Asteroid scout: today’s closest asteroid becomes the mission target. Also the asteroid count on Home.',
      },
      {
        name: 'NASA Astronomy Picture of the Day',
        url: 'https://science.nasa.gov/apod/',
        use: 'The picture of the day on the Home page.',
      },
    ],
  },
  {
    title: 'Numbers behind the spacecraft parts',
    text: 'Masses, power, battery size, radio speed and pointing sit inside the ranges these sources give, rounded so they are easy to add up. Prices are game estimates, because NASA does not publish part prices.',
    items: [
      {
        name: 'NASA State-of-the-Art of Small Spacecraft Technology (2026)',
        url: 'https://www.nasa.gov/smallsat-institute/sst-soa',
        use: 'Frame masses (Table 6-1), solar panels and batteries (ch. 3 Power), radios (Table 9-3), pointing (Table 5-2).',
      },
      {
        name: 'CubeSat Design Specification Rev 14.1 (Cal Poly, 2022)',
        url: 'https://www.nasa.gov/wp-content/uploads/2018/01/cubesatdesignspecificationrev14_12022-02-09.pdf',
        use: 'How much each frame can carry: 3U 6 kg, 6U 12 kg, 12U 24 kg (Table 1).',
      },
      {
        name: 'Rocket Lab Electron',
        url: 'https://en.wikipedia.org/wiki/Electron_rocket',
        use: 'The dedicated small launcher: 300 kg to low orbit, 200 kg to SSO, about US$7.5 M, 4 failures in 99 launches.',
      },
    ],
  },
  {
    title: 'Orbits and real missions',
    text: 'The places you can send your spacecraft, and the NASA missions the game compares you with.',
    items: [
      {
        name: 'NASA Earth Observatory: Catalog of Earth Satellite Orbits',
        url: 'https://earthobservatory.nasa.gov/features/OrbitsCatalog',
        use: 'Low Earth, Sun-synchronous and geostationary orbits.',
      },
      {
        name: 'NASA DSCOVR and its EPIC camera',
        url: 'https://epic.gsfc.nasa.gov/',
        use: 'The Sun–Earth L1 point, a million and a half km away, where storms are seen before they reach Earth.',
      },
      {
        name: 'NASA Solar Dynamics Observatory',
        url: 'https://sdo.gsfc.nasa.gov/',
        use: 'The real spacecraft behind the ultraviolet Sun imager.',
      },
      {
        name: 'NASA Artemis I CubeSats',
        url: 'https://www.nasa.gov/humans-in-space/artemis-i-cubesats/',
        use: 'Small spacecraft that rode to deep space with a big NASA rocket, like the deep-space rideshare.',
      },
      {
        name: 'NASA Deep Space Network',
        url: 'https://www.nasa.gov/communicating-with-missions/dsn/',
        use: 'The big dishes that hear spacecraft far from Earth, used by the deep-space radio.',
      },
    ],
  },
  {
    title: 'Pictures and 3D',
    text: 'Everything else in 3D (spacecraft, rockets, launch pad) is drawn by our team in code.',
    items: [
      {
        name: 'NASA Blue Marble and Earth at Night (via the three.js examples)',
        url: 'https://visibleearth.nasa.gov/collection/1484/blue-marble',
        use: 'Earth’s colours, oceans, mountains, clouds and city lights. Public domain.',
      },
      {
        name: 'Poly Haven: Studio Small 09',
        url: 'https://polyhaven.com/a/studio_small_09',
        use: 'Reflections on metal and foil. CC0.',
      },
    ],
  },
]

/** /info/sources: every NASA dataset, report and picture the game uses */
export default function SourcesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-40 sm:px-6">
      <CinematicHeader
        eyebrow="Sources"
        title="Where our data comes from"
        text="Every NASA dataset, report and picture used in Orbitly, and what it is used for."
      />

      <div className="mt-12 space-y-10">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="text-xl font-bold">{g.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{g.text}</p>
            <ul className="mt-4 space-y-3">
              {g.items.map((s) => (
                <li key={s.url} className="lg-card rounded-2xl p-4">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-1.5 font-semibold text-cyan-200 underline-offset-4 hover:underline"
                  >
                    {s.name}
                    <ExternalLink aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
                  </a>
                  <p className="mt-1 text-sm text-slate-300">{s.use}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="lg-card rounded-2xl p-5 text-sm text-slate-300">
          <h2 className="text-base font-bold text-white">About this project</h2>
          <p className="mt-2">
            Made by Adaam, Zakwan and Ibad for the NASA Space Apps Challenge 2026 (Kuala Lumpur), challenge “Space
            Mission Design Game”. Orbitly is not made or endorsed by NASA.
          </p>
          <p className="mt-2">
            Built with React, three.js and Supabase. We used Claude Code, an AI coding assistant, to help write and
            test the code.
          </p>
        </section>
      </div>
    </div>
  )
}
