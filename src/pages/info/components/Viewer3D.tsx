import { Bounds, Center, OrbitControls, Stars } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import ErrorBoundary from '../../../components/ui/ErrorBoundary'
import { Reflections } from '../../../components/space/SpaceBackdrop'
import { useOnScreen } from '../../../components/space/useOnScreen'

/**
 * A small 3D stage: centres and frames whatever it is given, turns slowly,
 * and the player can hold and drag to look around. Lazy-load it (three.js).
 */
export default function Viewer3D({ children, margin = 1.25 }: { children: ReactNode; margin?: number }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(wrapper)
  return (
    <div ref={wrapper} className="h-full w-full">
      <ErrorBoundary fallback={<p className="flex h-full items-center justify-center text-sm text-slate-400">3D isn’t available on this device.</p>}>
        <Canvas dpr={[1, 1.5]} frameloop={visible ? 'always' : 'never'} camera={{ position: [2.5, 1.6, 3.5], fov: 38 }} gl={{ antialias: true }}>
          <Reflections intensity={0.45} />
          <ambientLight intensity={0.3} />
          <directionalLight position={[4, 6, 5]} intensity={2.4} color="#fff4e0" />
          <directionalLight position={[-5, 2, -3]} intensity={0.7} color="#93c5fd" />
          <Stars radius={40} depth={20} count={800} factor={2} fade speed={0.3} />
          <Bounds fit clip observe margin={margin}>
            <Center>{children}</Center>
          </Bounds>
          <OrbitControls makeDefault enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.4} />
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}
