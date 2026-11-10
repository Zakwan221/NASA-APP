/**
 * Shared space look: a textured Earth with a glowing atmosphere, the Sun,
 * stars, and soft reflections so metal and foil shine. No files downloaded
 * except the Earth photo that ships with the app.
 */

import { Environment, Lightformer, Stars, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { AdditiveBlending, BackSide, SRGBColorSpace, type Mesh } from 'three'
import ErrorBoundary from '../../../../components/ui/ErrorBoundary'
import EARTH_PHOTO from '../../assets/earth.jpg'
import { glowTexture } from './textures'

function EarthSurface() {
  const map = useTexture(EARTH_PHOTO, (t) => {
    t.colorSpace = SRGBColorSpace
  })
  return <meshStandardMaterial map={map} roughness={0.85} metalness={0} emissive="#0b2a55" emissiveIntensity={0.15} />
}

export function Earth({ radius, position, spin = 0.02 }: { radius: number; position: [number, number, number]; spin?: number }) {
  const ref = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * spin
  })
  return (
    <group position={position}>
      <mesh ref={ref} rotation={[0.35, 0, 0.1]}>
        <sphereGeometry args={[radius, 64, 48]} />
        <ErrorBoundary fallback={<meshStandardMaterial color="#1d4ed8" />}>
          <Suspense fallback={<meshStandardMaterial color="#1d4ed8" />}>
            <EarthSurface />
          </Suspense>
        </ErrorBoundary>
      </mesh>
      {/* Atmosphere: a thin blue halo */}
      <mesh scale={1.035}>
        <sphereGeometry args={[radius, 48, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.22} side={BackSide} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[radius, 48, 32]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.08} side={BackSide} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** A bright Sun with a soft glow, always facing the camera */
export function Sun({ position, size = 6 }: { position: [number, number, number]; size?: number }) {
  return (
    <group position={position}>
      <sprite scale={size}>
        <spriteMaterial map={glowTexture()} color="#fff3c4" transparent blending={AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite scale={size * 3}>
        <spriteMaterial map={glowTexture()} color="#fbbf24" transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

/** Reflections for shiny materials, made from a few light panels (no HDR download) */
export function Reflections() {
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" intensity={4} color="#fff7e0" position={[5, 4, 3]} scale={[6, 4, 1]} />
      <Lightformer form="rect" intensity={1.5} color="#60a5fa" position={[-4, -3, -2]} scale={[8, 4, 1]} />
      <Lightformer form="ring" intensity={2} color="#a78bfa" position={[0, 5, -6]} scale={3} />
    </Environment>
  )
}

/** Everything around the spacecraft in the builder: Earth below, Sun, stars, lights */
export default function SpaceBackdrop() {
  return (
    <>
      <color attach="background" args={['#02040c']} />
      <Reflections />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[6, 4, 4]}
        intensity={3}
        color="#fff4dc"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
      />
      <directionalLight position={[0, -5, 0]} intensity={0.6} color="#38bdf8" />
      <Stars radius={60} depth={30} count={1500} factor={3} saturation={0.4} fade speed={0.4} />
      <Sun position={[14, 8, -18]} />
      <Earth radius={9} position={[0, -11.5, -4]} />
    </>
  )
}
