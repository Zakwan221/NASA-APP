export interface SourceLink {
  name: string
  url: string
}

/** Citation box — Space Apps requires every NASA dataset to be cited. */
export default function DataSource({ sources, note }: { sources: SourceLink[]; note?: string }) {
  return (
    <aside className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
      <p className="mb-2 font-semibold text-slate-200">
        <span aria-hidden="true">📡 </span>Data source
      </p>
      <ul className="space-y-1">
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline-offset-4 hover:underline">
              {s.name} ↗
            </a>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2">{note}</p>}
    </aside>
  )
}
