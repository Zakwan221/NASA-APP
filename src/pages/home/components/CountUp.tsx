import { animate, useInView } from 'framer-motion'
import { useEffect, useRef } from 'react'

interface CountUpProps {
  value: number
  duration?: number
  className?: string
}

/** Animates from 0 to `value` the first time it scrolls into view. */
export default function CountUp({ value, duration = 1.6, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    const node = ref.current
    if (!inView || !node) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      node.textContent = value.toLocaleString()
      return
    }

    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => {
        node.textContent = Math.round(v).toLocaleString()
      },
    })
    return () => controls.stop()
  }, [inView, value, duration])

  return (
    <span ref={ref} className={className}>
      0
    </span>
  )
}
