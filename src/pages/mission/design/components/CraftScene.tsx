import { Float, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import ErrorBoundary from '../../../../components/ui/ErrorBoundary'
import type { MissionDesign } from '../../../../game/types'
import CraftModel from './CraftModel'
import SpaceBackdrop from './SpaceBackdrop'
import { useOnScreen } from './useOnScreen'

/** Glides the camera to the given distance (works together with OrbitControls) */
function CameraDistance({ distance }: { distance: number }) {
  useFrame(({ camera }, delta) => {
    const len = camera.position.length()
    if (Math.abs(len - distance) > 0.01) camera.position.setLength(len + (distance - len) * Math.min(1, delta * 3))
  })
  return null
}

/**
 * The spacecraft floating above Earth. Lazy-loaded (three.js is big).
 * `interactive` adds mouse/finger rotation; turn it off where the page must scroll.
 */
export default function CraftScene({
  design,
  interactive = true,
  zoom = 1,
}: {
  design: MissionDesign
  interactive?: boolean
  /** >1 moves the camera closer */
  zoom?: number
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(wrapper)
  // Pull the camera back for wide spacecraft so the solar wings stay in view
  const wings = { 'solar-deploy': 1.45, 'solar-large': 2.1 }[design.engineer.solarId ?? ''] ?? 1
  const body = design.engineer.structureId === 'bus-micro' ? 1.4 : 1
  const dish = design.comms.radioId === 'deep-transponder' ? 1.2 : 1
  const d = (Math.max(wings, body, dish) * 1.1) / zoom

  return (
    <div ref={wrapper} className="h-full w-full">
      <ErrorBoundary
        fallback={<p className="flex h-full items-center justify-center p-4 text-center text-sm text-slate-400">3D view isn’t available on this device.</p>}
      >
        <Canvas
          dpr={[1, 1.5]}
          frameloop={visible ? 'always' : 'never'}
          camera={{ position: [2.4 * d, 1.2 * d, 3 * d], fov: 42 }}
          gl={{ antialias: true, powerPreference: 'low-power' }}
        >
          <SpaceBackdrop />
          <CameraDistance distance={Math.hypot(2.4, 1.2, 3) * d} />
          <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.4}>
            <group rotation={[0.2, 0, 0]}>
              <CraftModel design={design} />
            </group>
          </Float>
          {interactive && (
            <OrbitControls
              enablePan={false}
              enableZoom={false}
              autoRotate
              autoRotateSpeed={0.9}
              minPolarAngle={0.6}
              maxPolarAngle={2.2}
            />
          )}
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}
