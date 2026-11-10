interface TabHeaderProps {
  mission: string
  title: string
  intro: string
  why: string
}

/** Title + plain-English intro + "why it matters" for each tab */
export default function TabHeader({ mission, title, intro, why }: TabHeaderProps) {
  return (
    <header className="mb-8 grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-end">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{mission}</p>
        <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
        <p className="mt-3 text-slate-300">{intro}</p>
      </div>
      <p className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4 text-sm text-violet-100">
        <span className="font-semibold text-violet-300">Why it matters: </span>
        {why}
      </p>
    </header>
  )
}
