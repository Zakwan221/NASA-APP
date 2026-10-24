// Edit this to your team's name
const TEAM_CREDIT = 'Team Orbitly'
const YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-space-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Data from{' '}
          <a
            href="https://api.nasa.gov/"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300 underline-offset-4 hover:underline"
          >
            NASA Open APIs
          </a>
          . Not affiliated with NASA.
        </p>
        <p>
          © {YEAR} Built by {TEAM_CREDIT}
        </p>
      </div>
    </footer>
  )
}
