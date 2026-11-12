/**
 * Planet surfaces drawn in code (no downloads), cached. Colours follow NASA
 * imagery: grey cratered Mercury, cloudy Venus, rusty Mars, banded giants.
 */

import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

const cache = new Map<string, Texture>()

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

function canvas(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number) => void) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h, rng(key.length * 7919 + w))
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  cache.set(key, tex)
  return tex
}

/** Rocky planet: base colour, darker and lighter patches, a few craters */
function rocky(key: string, base: string, dark: string, light: string, craters: number) {
  return canvas(key, 512, 256, (ctx, w, h, r) => {
    ctx.fillStyle = base
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = r() > 0.5 ? dark : light
      ctx.globalAlpha = 0.08 + r() * 0.18
      ctx.beginPath()
      ctx.ellipse(r() * w, r() * h, 6 + r() * 50, 4 + r() * 22, r() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < craters; i++) {
      const x = r() * w
      const y = r() * h
      const rad = 1.5 + r() * 7
      ctx.globalAlpha = 0.35
      ctx.fillStyle = dark
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.25
      ctx.strokeStyle = light
      ctx.beginPath()
      ctx.arc(x - rad * 0.2, y - rad * 0.2, rad, Math.PI, Math.PI * 1.6)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  })
}

/** Gas giant: horizontal bands with soft wobbly edges and the odd storm */
function banded(key: string, colours: string[], storm?: string) {
  return canvas(key, 512, 256, (ctx, w, h, r) => {
    let y = 0
    while (y < h) {
      const band = 6 + r() * 22
      ctx.fillStyle = colours[Math.floor(r() * colours.length)]
      ctx.fillRect(0, y, w, band + 2)
      y += band
    }
    // Turbulence along the band edges
    for (let i = 0; i < 500; i++) {
      ctx.globalAlpha = 0.12
      ctx.fillStyle = colours[Math.floor(r() * colours.length)]
      ctx.fillRect(r() * w, r() * h, 10 + r() * 60, 1 + r() * 3)
    }
    if (storm) {
      ctx.globalAlpha = 0.9
      ctx.fillStyle = storm
      ctx.beginPath()
      ctx.ellipse(w * 0.62, h * 0.66, 26, 13, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  })
}

export const PLANET_TEXTURES = {
  mercury: () => rocky('mercury', '#8c8782', '#5e5a56', '#b9b4ad', 160),
  venus: () => banded('venus', ['#e8c27a', '#d9ad62', '#f0d39a', '#caa05a']),
  mars: () => rocky('mars', '#b5532c', '#7a3218', '#d98a5b', 60),
  jupiter: () => banded('jupiter', ['#d8c3a5', '#b3895f', '#e9dccb', '#a0714d', '#c9a27a'], '#b5523b'),
  saturn: () => banded('saturn', ['#e3d0a1', '#cdb27a', '#efe1bd', '#bfa06a']),
  uranus: () => banded('uranus', ['#9fdbe3', '#93d1da', '#a9e3ea']),
  neptune: () => banded('neptune', ['#3d63d6', '#3557c2', '#4b74e6', '#2c4aa8'], '#22337d'),
}

/** Saturn's rings: concentric bands with the Cassini gap (drawn on a square, mapped flat) */
export const ringTexture = () =>
  canvas('ring', 512, 512, (ctx, w) => {
    const c = w / 2
    for (let rad = c; rad > c * 0.55; rad -= 1) {
      const t = (rad - c * 0.55) / (c * 0.45) // 0 inner … 1 outer
      const gap = t > 0.62 && t < 0.68
      const shade = 170 + Math.sin(t * 90) * 30 + Math.sin(t * 23) * 20
      ctx.strokeStyle = `rgba(${shade + 30}, ${shade + 10}, ${shade - 20}, ${gap ? 0.05 : 0.35 + Math.sin(t * 40) * 0.2 + (1 - t) * 0.2})`
      ctx.beginPath()
      ctx.arc(c, c, rad, 0, Math.PI * 2)
      ctx.stroke()
    }
  })
