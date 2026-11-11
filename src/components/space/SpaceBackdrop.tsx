/**
 * Shared space look: a realistic Earth (NASA Blue Marble colours, bumps, shiny
 * oceans, city lights on the night side, clouds, glowing atmosphere), the Sun,
 * stars, and real reflections from an HDRI photo so metal and foil shine.
 *
 * Earth textures: NASA Blue Marble / Earth at Night (public domain), in the
 * sizes shipped with the three.js examples. HDRI: "Studio Small 09" from
 * Poly Haven (CC0).
 */

import { Environment, Stars, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  Color,
  SRGBColorSpace,
  Vector3,
  type Mesh,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import ErrorBoundary from '../ui/ErrorBoundary'
import CLOUDS from '../../assets/space/earth_clouds_1024.png'
import DAY from '../../assets/space/earth_atmos_2048.jpg'
import LIGHTS from '../../assets/space/earth_lights_2048.png'
import NORMAL from '../../assets/space/earth_normal_2048.jpg'
import SPECULAR from '../../assets/space/earth_specular_2048.jpg'
import HDRI from '../../assets/space/studio_small_09_1k.hdr?url'
import { glowTexture } from './textures'

/** Where sunlight comes from in every scene (world space) */
const SUN_DIRECTION = new Vector3(6, 4, 4).normalize()

/* ---------------- Earth ---------------- */

/**
 * Standard material with two small shader additions:
 *  - oceans (white in the specular map) are smooth and reflect the Sun
 *  - city lights only glow on the side facing away from the Sun
 */
/** `sunDirection` (world space, towards the Sun) may be changed every frame by the parent */
function EarthSurface({ sunDirection = SUN_DIRECTION }: { sunDirection?: Vector3 }) {
  const [day, normal, specular, lights] = useTexture([DAY, NORMAL, SPECULAR, LIGHTS], (loaded) => {
    loaded[0].colorSpace = SRGBColorSpace
    loaded[3].colorSpace = SRGBColorSpace
  })
  const uniforms = useMemo(() => ({ uSpec: { value: specular }, uSunView: { value: new Vector3() } }), [specular])
  const mat = useRef<MeshStandardMaterial>(null)

  useFrame(({ camera }) => {
    // The night mask works in view space, so turn the Sun direction with the camera
    uniforms.uSunView.value.copy(sunDirection).transformDirection(camera.matrixWorldInverse)
  })

  const onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSpec = uniforms.uSpec
    shader.uniforms.uSunView = uniforms.uSunView
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uSpec;\nuniform vec3 uSunView;')
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.85, 0.32, texture2D(uSpec, vMapUv).r);',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(0.1, -0.25, dot(normal, uSunView));',
      )
  }

  return (
    <meshStandardMaterial
      ref={mat}
      map={day}
      normalMap={normal}
      normalScale={[0.8, 0.8]}
      emissiveMap={lights}
      emissive={new Color('#ffcf7a')}
      emissiveIntensity={1.6}
      metalness={0}
      roughness={0.8}
      onBeforeCompile={onBeforeCompile}
    />
  )
}

function Clouds({ radius }: { radius: number }) {
  const clouds = useTexture(CLOUDS)
  return (
    <mesh scale={1.012}>
      <sphereGeometry args={[radius, 64, 48]} />
      <meshStandardMaterial map={clouds} alphaMap={clouds} transparent depthWrite={false} opacity={0.9} roughness={1} />
    </mesh>
  )
}

const ATMOS_VERT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const ATMOS_FRAG = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float rim = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    gl_FragColor = vec4(0.32, 0.62, 1.0, 1.0) * rim * 0.95;
  }
`

export function Earth({
  radius,
  position,
  spin = 0.02,
  sunDirection,
}: {
  radius: number
  position: [number, number, number]
  spin?: number
  /** Towards the Sun, for the night side; defaults to the scenes' usual sunlight */
  sunDirection?: Vector3
}) {
  const ref = useRef<Mesh>(null)
  const cloudRef = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * spin
    if (cloudRef.current) cloudRef.current.rotation.y += delta * spin * 1.25
  })
  const fallback = <meshStandardMaterial color="#1d4ed8" />
  return (
    <group position={position}>
      <group rotation={[0.35, 0, 0.1]}>
        <mesh ref={ref}>
          <sphereGeometry args={[radius, 96, 64]} />
          <ErrorBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <EarthSurface sunDirection={sunDirection} />
            </Suspense>
          </ErrorBoundary>
        </mesh>
        <group ref={cloudRef}>
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <Clouds radius={radius} />
            </Suspense>
          </ErrorBoundary>
        </group>
      </group>
      {/* Atmosphere: bright thin blue rim, like photos from the ISS */}
      <mesh scale={1.06}>
        <sphereGeometry args={[radius, 64, 48]} />
        <shaderMaterial
          vertexShader={ATMOS_VERT}
          fragmentShader={ATMOS_FRAG}
          side={BackSide}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/* ---------------- Sun ---------------- */

/** A bright Sun with a soft glow (bright enough to bloom), always facing the camera */
export function Sun({ position, size = 6 }: { position: [number, number, number]; size?: number }) {
  return (
    <group position={position}>
      <sprite scale={size}>
        <spriteMaterial map={glowTexture()} color={[3, 2.8, 2.2]} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite scale={size * 3}>
        <spriteMaterial map={glowTexture()} color="#fbbf24" transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

/* ---------------- reflections ---------------- */

/** Real reflections from an HDRI photo; the scene shows without them while it loads */
export function Reflections({ intensity = 0.8 }: { intensity?: number }) {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <Environment files={HDRI} environmentIntensity={intensity} />
      </Suspense>
    </ErrorBoundary>
  )
}

/** Everything around the spacecraft in the builder: Earth below, Sun, stars, lights */
export default function SpaceBackdrop() {
  const sun = SUN_DIRECTION.clone().multiplyScalar(8)
  return (
    <>
      <color attach="background" args={['#010208']} />
      <Reflections intensity={0.7} />
      <ambientLight intensity={0.12} />
      <directionalLight
        position={[sun.x, sun.y, sun.z]}
        intensity={3.2}
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
      {/* Earthshine: blue light bouncing up from the planet */}
      <directionalLight position={[0, -5, 0]} intensity={0.5} color="#38bdf8" />
      <Stars radius={60} depth={30} count={2500} factor={3} saturation={0.5} fade speed={0.4} />
      <Sun position={[14, 8, -18]} />
      <Earth radius={9} position={[0, -11.5, -4]} />
    </>
  )
}
