/**
 * Small textures drawn in code (no downloads), cached so every scene shares them.
 * They make the low-poly models look like real hardware: gold foil, solar cells,
 * soft glows for flames and smoke.
 */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

const cache = new Map<string, Texture>()

function make(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, srgb = true): Texture {
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  draw(canvas.getContext('2d')!, size)
  const tex = new CanvasTexture(canvas)
  if (srgb) tex.colorSpace = SRGBColorSpace
  tex.wrapS = tex.wrapT = RepeatWrapping
  cache.set(key, tex)
  return tex
}

/** Seeded random so textures look the same every time */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

/** Crinkled gold insulation foil (MLI) */
export const foilTexture = () =>
  make('foil', 256, (ctx, s) => {
    const r = rng(7)
    ctx.fillStyle = '#c9971f'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 260; i++) {
      const x = r() * s
      const y = r() * s
      const w = 10 + r() * 50
      const h = 6 + r() * 30
      const light = r() > 0.5
      ctx.fillStyle = light ? `rgba(255, 228, 150, ${0.15 + r() * 0.35})` : `rgba(120, 75, 10, ${0.15 + r() * 0.3})`
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + w, y + r() * h)
      ctx.lineTo(x + w * r(), y + h)
      ctx.closePath()
      ctx.fill()
    }
  })

/** Rows of dark blue solar cells with silver contacts */
export const solarTexture = () =>
  make('solar', 256, (ctx, s) => {
    ctx.fillStyle = '#c0c7d0'
    ctx.fillRect(0, 0, s, s)
    const cells = 4
    const gap = 4
    const cell = s / cells
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const x = i * cell + gap / 2
        const y = j * cell + gap / 2
        const g = ctx.createLinearGradient(x, y, x + cell, y + cell)
        g.addColorStop(0, '#1e3a8a')
        g.addColorStop(0.5, '#172554')
        g.addColorStop(1, '#2547a8')
        ctx.fillStyle = g
        ctx.fillRect(x, y, cell - gap, cell - gap)
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)'
        ctx.lineWidth = 1
        for (let k = 1; k < 6; k++) {
          ctx.beginPath()
          ctx.moveTo(x, y + (k * (cell - gap)) / 6)
          ctx.lineTo(x + cell - gap, y + (k * (cell - gap)) / 6)
          ctx.stroke()
        }
      }
    }
  })

/** Soft round glow: white centre fading out. Tint it with the material colour. */
export const glowTexture = () =>
  make('glow', 128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.75)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  })

/** Puffy smoke blob */
export const smokeTexture = () =>
  make('smoke', 128, (ctx, s) => {
    const r = rng(3)
    for (let i = 0; i < 14; i++) {
      const x = s / 2 + (r() - 0.5) * s * 0.35
      const y = s / 2 + (r() - 0.5) * s * 0.35
      const rad = s * (0.18 + r() * 0.16)
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, 'rgba(255,255,255,0.35)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, s, s)
    }
  })

/** Grass and dirt around the launch pad (tiled 10×) */
export const groundTexture = () => {
  const tex = make('ground', 256, (ctx, s) => {
    const r = rng(11)
    ctx.fillStyle = '#4d6b2a'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() > 0.6 ? 'rgba(120, 100, 60, 0.35)' : 'rgba(40, 80, 30, 0.45)'
      ctx.fillRect(r() * s, r() * s, 2 + r() * 6, 2 + r() * 6)
    }
  })
  tex.repeat.set(60, 60)
  tex.anisotropy = 8
  return tex
}

/** Concrete pad with scorch marks */
export const concreteTexture = () =>
  make('concrete', 128, (ctx, s) => {
    const r = rng(5)
    ctx.fillStyle = '#8b8f96'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '30,30,30'}, ${r() * 0.12})`
      ctx.fillRect(r() * s, r() * s, 3, 3)
    }
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.35)
    g.addColorStop(0, 'rgba(20,20,20,0.6)')
    g.addColorStop(1, 'rgba(20,20,20,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  })
