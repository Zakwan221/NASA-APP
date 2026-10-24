import { Stars, useTexture } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { AdditiveBlending, BackSide, Group, SRGBColorSpace } from 'three'
import ErrorBoundary from '../../../components/ui/ErrorBoundary'

const EARTH_TEXTURE = '/textures/earth.jpg'
const FALLBACK_COLOR = '#1e4fd8'

function EarthMaterial() {
  const texture = useTexture(EARTH_TEXTURE, (t) => {
    t.colorSpace = SRGBColorSpace
  })
  return <meshStandardMaterial map={texture} roughness={0.9} metalness={0} />
}

function Earth() {
  const spin = useRef<Group>(null)

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.05
  })

  return (
    // Outer group = position + axial tilt, inner group = spin
    <group position={[0, -3, 0]} rotation={[-0.55, 0, 0.12]}>
      <group ref={spin}>
        <mesh>
          {/* low-poly: 48x48 segments is plenty at this size */}
          <sphereGeometry args={[2.3, 48, 48]} />
          <ErrorBoundary fallback={<meshStandardMaterial color={FALLBACK_COLOR} />}>
            <Suspense fallback={<meshStandardMaterial color={FALLBACK_COLOR} />}>
              <EarthMaterial />
            </Suspense>
          </ErrorBoundary>
        </mesh>
      </group>

      {/* Atmosphere glow */}
      <mesh scale={1.06}>
        <sphereGeometry args={[2.3, 32, 32]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.14}
          side={BackSide}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/** Full-bleed 3D background. Stops rendering when scrolled off-screen. */
export default function EarthScene() {
  const wrapper = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const el = wrapper.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapper} className="absolute inset-0" aria-hidden="true">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[-4, 3, 5]} intensity={2.4} />
        <Stars radius={80} depth={40} count={2000} factor={4} saturation={0} fade speed={0.6} />
        <Earth />
      </Canvas>
    </div>
  )
}
