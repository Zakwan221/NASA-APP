export default function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="status" className="flex items-start gap-3 text-sm text-slate-300">
      <span aria-hidden="true" className="text-xl">🛰️</span>
      <p>
        {message}
        <br />
        <span className="text-slate-400">NASA's servers may be busy — try again in a minute.</span>
      </p>
    </div>
  )
}
