/**
 * The 4 answer slots look the same on the host screen and every phone.
 * Each has a colour AND a shape, so colour-blind players can match them.
 */
export interface AnswerStyle {
  name: string
  bg: string
  border: string
  /** SVG path in a 24x24 box */
  shape: string
}

export const ANSWER_STYLES: AnswerStyle[] = [
  { name: 'triangle', bg: 'bg-rose-500', border: 'border-rose-300', shape: 'M12 3 22 20H2z' },
  { name: 'diamond', bg: 'bg-sky-500', border: 'border-sky-300', shape: 'M12 2 22 12 12 22 2 12z' },
  { name: 'circle', bg: 'bg-amber-500', border: 'border-amber-300', shape: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z' },
  { name: 'square', bg: 'bg-emerald-500', border: 'border-emerald-300', shape: 'M3 3h18v18H3z' },
]
