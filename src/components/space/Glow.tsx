import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing'
import { useState } from 'react'

/** Phones with few CPU cores start without glow; the rest switch it off if frames drop */
const startOn = () => typeof navigator === 'undefined' || (navigator.hardwareConcurrency ?? 8) > 4

/**
 * Film-like glow: anything brighter than white (flames, the Sun, explosions,
 * city lights, LEDs) blooms, plus a soft dark vignette at the edges.
 */
export default function Glow({ strength = 1 }: { strength?: number }) {
  const [on, setOn] = useState(startOn)
  return (
    <>
      <PerformanceMonitor onDecline={() => setOn(false)} />
      {on && (
        // MSAA here could briefly show a stale red buffer; SMAA smooths edges safely
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={strength} luminanceThreshold={1} luminanceSmoothing={0.25} />
          <Vignette offset={0.3} darkness={0.55} />
          <SMAA />
        </EffectComposer>
      )}
    </>
  )
}
