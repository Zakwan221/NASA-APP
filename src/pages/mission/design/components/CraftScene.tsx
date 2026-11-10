import { OrbitControls, Stars } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import ErrorBoundary from '../../../../components/ui/ErrorBoundary'
import type { MissionDesign } from '../../../../game/types'
import CraftModel from './CraftModel'
import { useOnScreen } from './useOnScreen'

/** Slow spin, used instead of OrbitControls on touch screens */
function Spin({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.4
  })
  return <group ref={ref}>{children}</group>
}

/** Rotatable 3D view of the spacecraft being designed. Lazy-loaded (three.js is big). */
export default function CraftScene({ design, interactive = true }: { design: MissionDesign; interactive?: boolean }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(wrapper)
  const big = design.engineer.structureId === 'bus-micro' || design.comms.radioId === 'deep-transponder'

  return (
    <div ref={wrapper} className="h-full w-full">
      <ErrorBoundary
        fallback={<p className="flex h-full items-center justify-center p-4 text-center text-sm text-slate-400">3D view isn’t available on this device.</p>}
      >
        <Canvas
          dpr={[1, 1.5]}
          frameloop={visible ? 'always' : 'never'}
          camera={{ position: big ? [3.4, 1.9, 4] : [2.3, 1.3, 2.8], fov: 40 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[5, 4, 3]} intensity={2.2} />
          <directionalLight position={[-4, -2, -3]} intensity={0.4} color="#8b5cf6" />
          <Stars radius={40} depth={20} count={600} factor={2} fade speed={0.5} />
          <group rotation={[0.25, 0, 0]}>
            {interactive ? (
              <CraftModel design={design} />
            ) : (
              <Spin>
                <CraftModel design={design} />
              </Spin>
            )}
          </group>
          {/* OrbitControls blocks page scrolling on touch, so only with a mouse */}
          {interactive && <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.2} />}
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}
