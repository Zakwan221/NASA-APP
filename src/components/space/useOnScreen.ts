import { useEffect, useState, type RefObject } from 'react'

/** True while the element is on screen, so 3D scenes can stop rendering when scrolled away */
export function useOnScreen(ref: RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return visible
}
