import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface SectionProps {
  id?: string
  eyebrow?: string
  title?: string
  children: ReactNode
  className?: string
}

/** Page section that fades/slides in when scrolled into view. */
export default function Section({ id, eyebrow, title, children, className = '' }: SectionProps) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 ${className}`}
    >
      {(eyebrow || title) && (
        <header className="mb-8">
          {eyebrow && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
          )}
          {title && <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>}
        </header>
      )}
      {children}
    </motion.section>
  )
}
