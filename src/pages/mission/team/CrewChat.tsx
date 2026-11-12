import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatMessage } from '../../../multiplayer/missionApi'

const EASE_OUT = [0.23, 1, 0.32, 1] as const
/** One tap on a phone, for the things crews say most */
const QUICK = ['Ready!', 'Wait for me', 'Good idea', 'Check the power', 'Over budget?', 'Too heavy?']

/**
 * Live crew chat, floating over every team screen (lobby, builder, launch pad, flight).
 * New messages from others show as a short preview and an unread badge.
 */
export default function CrewChat({
  messages,
  userId,
  onSend,
}: {
  messages: ChatMessage[]
  userId: string | null
  onSend: (text: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const latestId = messages.at(-1)?.id ?? 0
  // Messages up to this id have been seen. The chat mounts with the room, after its
  // history has loaded, so the history counts as seen.
  const [seenId, setSeenId] = useState(latestId)
  if (open && latestId > seenId) setSeenId(latestId)

  // A short preview of the newest message from someone else while the chat is closed
  const [preview, setPreview] = useState<ChatMessage | null>(null)
  const [previewedId, setPreviewedId] = useState(0)
  const newest = messages.at(-1)
  if (!open && newest && newest.id > seenId && newest.id !== previewedId && newest.user_id !== userId) {
    setPreviewedId(newest.id)
    setPreview(newest)
  }
  useEffect(() => {
    if (!preview) return
    const t = setTimeout(() => setPreview(null), 4000)
    return () => clearTimeout(t)
  }, [preview])

  const unread = messages.filter((m) => m.id > seenId && m.user_id !== userId).length

  const list = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (open) list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [open, latestId])

  async function send(value: string) {
    const t = value.trim()
    if (!t || sending) return
    setSending(true)
    try {
      await onSend(t)
      setText('')
    } finally {
      setSending(false)
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void send(text)
  }

  return (
    // Phones: a button on the right edge (over the 3D view, clear of the cards) and the chat opens as a bottom sheet.
    // Bigger screens: bottom-left corner, opening upwards.
    <div className="pointer-events-none fixed right-3 top-[38svh] z-[85] flex flex-col items-end gap-2 sm:bottom-6 sm:left-6 sm:right-auto sm:top-auto sm:items-start">
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            aria-label="Crew chat"
            className="pointer-events-auto fixed inset-x-3 bottom-3 flex max-h-[60svh] flex-col overflow-hidden rounded-2xl border border-white/15 bg-space-900/95 shadow-2xl backdrop-blur-xl sm:static sm:max-h-[min(60svh,460px)] sm:w-[22rem]"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <MessageCircle aria-hidden="true" className="size-4 text-cyan-300" /> Crew chat
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="flex size-9 items-center justify-center rounded-full hover:bg-white/10"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </header>

            <ul ref={list} className="min-h-24 flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
              {messages.length === 0 && (
                <li className="py-6 text-center text-sm text-slate-400">No messages yet. Say hi to your crew!</li>
              )}
              {messages.map((m) => {
                const mine = m.user_id === userId
                return (
                  <li key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && <span className="px-1 text-[11px] font-semibold text-slate-400">{m.nickname}</span>}
                    <span
                      className={`max-w-[85%] break-words rounded-2xl px-3 py-1.5 text-sm ${
                        mine ? 'rounded-br-md bg-cyan-400 text-space-950' : 'rounded-bl-md bg-white/10 text-slate-100'
                      }`}
                    >
                      {m.text}
                    </span>
                  </li>
                )
              })}
            </ul>

            <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={sending}
                  onClick={() => void send(q)}
                  className="min-h-9 shrink-0 rounded-full bg-white/[0.07] px-3 text-xs font-semibold text-slate-200 hover:bg-white/15 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-2">
              <label className="sr-only" htmlFor="crew-chat-input">
                Message
              </label>
              <input
                id="crew-chat-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200}
                autoComplete="off"
                placeholder="Message your crew…"
                className="min-h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-space-800 px-4 text-sm text-white outline-none focus:border-cyan-300"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                aria-label="Send"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-space-950 transition hover:bg-cyan-300 disabled:opacity-40"
              >
                <Send aria-hidden="true" className="size-4" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {preview && !open && (
          <motion.button
            key={preview.id}
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="pointer-events-auto max-w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl rounded-bl-md border border-white/15 bg-space-900/95 px-3 py-2 text-left text-sm shadow-xl backdrop-blur"
          >
            <span className="block text-[11px] font-semibold text-cyan-300">{preview.nickname}</span>
            <span className="line-clamp-2 text-slate-100">{preview.text}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        hidden={open && typeof window !== 'undefined' && window.innerWidth < 640}
        aria-expanded={open}
        aria-label={open ? 'Close crew chat' : unread ? `Open crew chat, ${unread} new` : 'Open crew chat'}
        className="pointer-events-auto relative flex size-12 sm:size-14 items-center justify-center rounded-full border border-white/15 bg-space-900/90 text-cyan-200 shadow-xl backdrop-blur transition hover:bg-space-800 active:scale-95"
      >
        <MessageCircle aria-hidden="true" className="size-6" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}
