/**
 * Home page 3D story, driven by scroll (`progress` 0..1):
 *   0.00  Earth fills the screen, lit by the Sun (day side, night lights, clouds)
 *   0.25  the camera pulls back and a spacecraft swings round in orbit
 *   0.50  Earth shrinks and flies out to its orbit while the Sun and the other
 *         planets grow in one by one
 *   0.80  the whole solar system, turning slowly, with orbit lines and names
 * Scroll only sets a target; the scene eases towards it, so it never jumps.
 */

import { Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  MathUtils,
  Vector3,
  type Group,
  type LineBasicMaterial,
  type PointsMaterial,
  type ShaderMaterial,
} from 'three'
import ErrorBoundary from '../../../components/ui/ErrorBoundary'
import CraftModel from '../../../components/space/CraftModel'
import Glow from '../../../components/space/Glow'
import { PLANET_TEXTURES, ringTexture } from '../../../components/space/planetTextures'
import { Earth, Reflections } from '../../../components/space/SpaceBackdrop'
import { glowTexture } from '../../../components/space/textures'
import { useOnScreen } from '../../../components/space/useOnScreen'
import type { MissionDesign } from '../../../game/types'

/* ---------------- helpers ---------------- */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
/** Ease in and out between two scroll points */
const ramp = (p: number, from: number, to: number) => {
  const x = clamp01((p - from) / (to - from))
  return x * x * (3 - 2 * x)
}

/* ---------------- the solar system (not to scale: sizes and distances squeezed to fit) ---------------- */

const EARTH_ORBIT = 5
const EARTH_FINAL_SCALE = 0.24
const SUN_RADIUS = 1.25

interface PlanetInfo {
  name: string
  key: keyof typeof PLANET_TEXTURES
  radius: number
  orbit: number
  /** Radians per second once the system is turning */
  speed: number
  start: number
  tilt: number
  ring?: boolean
}

const PLANETS: PlanetInfo[] = [
  { name: 'Mercury', key: 'mercury', radius: 0.11, orbit: 2.4, speed: 0.48, start: 2.2, tilt: 0 },
  { name: 'Venus', key: 'venus', radius: 0.19, orbit: 3.6, speed: 0.35, start: 4.1, tilt: 0.05 },
  { name: 'Mars', key: 'mars', radius: 0.15, orbit: 6.4, speed: 0.19, start: 1.1, tilt: 0.4 },
  { name: 'Jupiter', key: 'jupiter', radius: 0.62, orbit: 9, speed: 0.1, start: 3.3, tilt: 0.05 },
  { name: 'Saturn', key: 'saturn', radius: 0.52, orbit: 11.8, speed: 0.075, start: 5.4, tilt: 0.47, ring: true },
  { name: 'Uranus', key: 'uranus', radius: 0.33, orbit: 14, speed: 0.055, start: 0.4, tilt: 1.7 },
  { name: 'Neptune', key: 'neptune', radius: 0.31, orbit: 16, speed: 0.045, start: 2.7, tilt: 0.5 },
]
const EARTH_SPEED = 0.26
const EARTH_START = 0.35

/** The spacecraft shown in orbit (a tidy 12U CubeSat) */
const SHOWCASE: MissionDesign = {
  planner: { scenarioId: 'earth-watch', difficulty: 'engineer', targetLifetimeMonths: 12, targetCoverage: 0.5 },
  engineer: { structureId: 'frame-12u', solarId: 'solar-deploy', batteryId: 'battery-80', computerId: 'obc', attitudeId: 'wheels' },
  science: { instrumentIds: ['camera', 'spectro'] },
  comms: { radioId: 'xband', orbitId: 'sso', launchVehicleId: 'rideshare-leo' },
}

/* ---------------- Sun ---------------- */

const SUN_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
/** Boiling surface: layered noise that drifts over time, darker towards the edge */
const SUN_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; } return v; }
  void main() {
    vec3 p = normalize(vPos) * 3.0;
    float n = fbm(p + vec3(uTime * 0.08, uTime * 0.05, 0.0));
    float spots = smoothstep(0.62, 0.75, fbm(p * 0.6 - uTime * 0.02));
    vec3 col = mix(vec3(1.0, 0.38, 0.05), vec3(1.0, 0.86, 0.45), n);
    col *= 1.0 - spots * 0.35;
    float limb = 0.55 + 0.45 * pow(max(dot(vNormal, vView), 0.0), 0.6);
    gl_FragColor = vec4(col * limb * 3.2, 1.0);
  }
`

function Sun({ sunRef }: { sunRef: RefObject<Group | null> }) {
  const mat = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame(({ clock }) => {
    if (mat.current) mat.current.uniforms.uTime.value = clock.getElapsedTime()
  })
  return (
    <group ref={sunRef} scale={0.001}>
      <mesh>
        <sphereGeometry args={[SUN_RADIUS, 64, 48]} />
        <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={SUN_VERT} fragmentShader={SUN_FRAG} toneMapped={false} />
      </mesh>
      <sprite scale={SUN_RADIUS * 4.2}>
        <spriteMaterial map={glowTexture()} color={[2.4, 1.3, 0.45]} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite scale={SUN_RADIUS * 10}>
        <spriteMaterial map={glowTexture()} color={[1, 0.45, 0.12]} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

/* ---------------- planets, orbits, belt ---------------- */

function Planet({ info, groupRef }: { info: PlanetInfo; groupRef: (g: Group | null) => void }) {
  const { key } = info
  const map = useMemo(() => PLANET_TEXTURES[key](), [key])
  return (
    <group ref={groupRef} scale={0.001}>
      <group rotation={[0, 0, info.tilt]}>
        <mesh>
          <sphereGeometry args={[info.radius, 48, 32]} />
          <meshStandardMaterial map={map} roughness={0.85} metalness={0} />
        </mesh>
        {info.ring && (
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[info.radius * 1.35, info.radius * 2.4, 96]} />
            <meshStandardMaterial map={ringTexture()} transparent side={DoubleSide} depthWrite={false} roughness={0.9} />
          </mesh>
        )}
      </group>
    </group>
  )
}

/** Thin circles showing each orbit */
function OrbitLines({ matRef }: { matRef: RefObject<LineBasicMaterial | null> }) {
  const geometry = useMemo(() => {
    const pts: number[] = []
    for (const r of [...PLANETS.map((p) => p.orbit), EARTH_ORBIT]) {
      for (let i = 0; i < 128; i++) {
        const a0 = (i / 128) * Math.PI * 2
        const a1 = ((i + 1) / 128) * Math.PI * 2
        pts.push(Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r)
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pts, 3))
    return g
  }, [])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial ref={matRef} color="#7dd3fc" transparent opacity={0} depthWrite={false} />
    </lineSegments>
  )
}

/** A ring of rocks between Mars and Jupiter (positions made once, seeded) */
function AsteroidBelt({ matRef, beltRef }: { matRef: RefObject<PointsMaterial | null>; beltRef: RefObject<Group | null> }) {
  const geometry = useMemo(() => {
    let seed = 7
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const pts: number[] = []
    for (let i = 0; i < 1400; i++) {
      const a = rnd() * Math.PI * 2
      const r = 7.3 + rnd() * 0.9 + (rnd() - 0.5) * 0.3
      pts.push(Math.cos(a) * r, (rnd() - 0.5) * 0.18, Math.sin(a) * r)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pts, 3))
    return g
  }, [])
  return (
    <group ref={beltRef}>
      <points geometry={geometry}>
        <pointsMaterial ref={matRef} color="#cbb89d" size={0.045} sizeAttenuation transparent opacity={0} depthWrite={false} />
      </points>
    </group>
  )
}

/* ---------------- camera path ---------------- */

interface Key {
  p: number
  /** Camera position and look-at point; `earth: true` means relative to Earth */
  pos: [number, number, number]
  look: [number, number, number]
  earth?: boolean
}

const KEYS: Key[] = [
  { p: 0, pos: [0, 0.1, 2.75], look: [0, 0.62, 0], earth: true },
  // Earth on the right, leaving room for the text on the left
  { p: 0.28, pos: [0.9, 0.75, 3.4], look: [-1.05, 0.05, 0], earth: true },
  // Sun coming in on the left, Earth low on the right, text at the top
  { p: 0.5, pos: [-1.2, 2.4, 6], look: [-1.9, 1.1, 0], earth: true },
  // Far enough back that all eight orbits fit
  { p: 0.8, pos: [0, 17, 25], look: [0, -2.2, 0] },
  { p: 1, pos: [8, 13, 23], look: [0, -2.2, 0] },
]

/** Tall phone screens: Earth sits above the text box instead of beside it */
const KEYS_PORTRAIT: Key[] = KEYS.map((k, i) =>
  i === 1
    ? { ...k, pos: [0.6, 0.9, 3.4], look: [0.05, -1.15, 0] }
    : i === 2
      ? { ...k, look: [-0.6, 1.4, 0] }
      : // Look down from higher up, so the orbits use the screen's height
        i === 3
        ? { ...k, pos: [0, 21, 12], look: [0, 0, 0] }
        : i === 4
          ? { ...k, pos: [5, 20, 12], look: [0, 0, 0] }
          : k,
)

/* ---------------- scene ---------------- */

/** Names in the order: the seven planets, then Earth */
const LABELS = [...PLANETS.map((p) => p.name), 'Earth']

function Scene({ progress, labels }: { progress: RefObject<number>; labels: RefObject<(HTMLSpanElement | null)[]> }) {
  const { camera, size } = useThree()
  const earthGroup = useRef<Group>(null)
  const craft = useRef<Group>(null)
  const sun = useRef<Group>(null)
  const belt = useRef<Group>(null)
  const beltMat = useRef<PointsMaterial>(null)
  const orbitMat = useRef<LineBasicMaterial>(null)
  const planets = useRef<(Group | null)[]>([])
  const sunDir = useMemo(() => new Vector3(-1, 0, 0), [])
  const tmp = useMemo(() => ({ a: new Vector3(), b: new Vector3(), pos: new Vector3(), look: new Vector3(), earth: new Vector3(), screen: new Vector3() }), [])
  // Scroll target is eased, and planet angles add up over time (so speeding up never jumps)
  const sim = useRef({ p: 0, spin: 0, earthAngle: EARTH_START, angles: PLANETS.map((pl) => pl.start) })

  // Tall phone screens: stand further back so things fit the width
  const aspect = size.width / size.height
  const portrait = aspect < 0.8
  const fit = aspect < 1 ? MathUtils.clamp(1 / aspect, 1, 2) * 0.85 + 0.15 : 1
  // The whole solar system needs more room on a narrow screen
  const fitSystem = aspect < 1 ? MathUtils.clamp(1 / aspect, 1, 2.4) * 0.95 : 1
  const keys = portrait ? KEYS_PORTRAIT : KEYS

  useFrame(({ clock }, delta) => {
    const s = sim.current
    const dt = Math.min(delta, 0.05)
    s.p = MathUtils.damp(s.p, progress.current ?? 0, 3.2, dt)
    const p = s.p
    const t = clock.getElapsedTime()

    // ---- the system starts turning once it has formed ----
    const turning = ramp(p, 0.6, 0.85)
    s.earthAngle += EARTH_SPEED * turning * dt
    PLANETS.forEach((pl, i) => (s.angles[i] += pl.speed * turning * dt))
    s.spin += turning * dt * 0.035

    // ---- Earth: big in the hero, shrinks into its orbit ----
    const shrink = ramp(p, 0.42, 0.75)
    const earthScale = MathUtils.lerp(1, EARTH_FINAL_SCALE, shrink)
    tmp.earth.set(Math.cos(s.earthAngle) * EARTH_ORBIT, 0, Math.sin(s.earthAngle) * EARTH_ORBIT)
    if (earthGroup.current) {
      earthGroup.current.position.copy(tmp.earth)
      earthGroup.current.scale.setScalar(earthScale)
    }
    // Daylight always comes from the Sun at the centre
    sunDir.copy(tmp.earth).multiplyScalar(-1).normalize()

    // ---- spacecraft: scroll swings it round Earth, then it fades as we leave ----
    if (craft.current) {
      const show = ramp(p, 0.12, 0.26) * (1 - ramp(p, 0.5, 0.6))
      // Swings across the front of Earth while the Design text is on screen
      const a = -0.9 + ramp(p, 0.1, 0.55) * 6.2 + t * 0.03
      const r = 1.6
      craft.current.position.set(tmp.earth.x + Math.cos(a) * r, tmp.earth.y + Math.sin(a) * r * 0.32, tmp.earth.z + Math.sin(a) * r)
      craft.current.rotation.set(0.3, -a + Math.PI / 2, 0.15)
      craft.current.scale.setScalar(0.13 * show + 0.0001)
      craft.current.visible = show > 0.01
    }

    // ---- Sun, planets, belt, orbit lines grow in one after another ----
    if (sun.current) sun.current.scale.setScalar(ramp(p, 0.45, 0.68) + 0.0001)
    PLANETS.forEach((pl, i) => {
      const g = planets.current[i]
      if (!g) return
      const grow = ramp(p, 0.5 + i * 0.035, 0.66 + i * 0.035)
      g.position.set(Math.cos(s.angles[i]) * pl.orbit, 0, Math.sin(s.angles[i]) * pl.orbit)
      g.scale.setScalar(grow + 0.0001)
      g.rotation.y = t * 0.3
      g.visible = grow > 0.01
    })
    const lines = ramp(p, 0.6, 0.78)
    if (orbitMat.current) orbitMat.current.opacity = lines * 0.22
    if (beltMat.current) beltMat.current.opacity = lines * 0.8
    if (belt.current) belt.current.rotation.y = s.spin * 2

    // ---- camera: glide along the keyframes ----
    let i = 0
    while (i < keys.length - 2 && p > keys[i + 1].p) i++
    const k0 = keys[i]
    const k1 = keys[i + 1]
    const u = ramp(p, k0.p, k1.p)
    const at = (k: Key, v: [number, number, number], out: Vector3, scale: number) =>
      out.set(v[0] * scale, v[1] * scale, v[2] * scale).add(k.earth ? tmp.earth : tmp.a.set(0, 0, 0))
    // Near Earth the offsets shrink with Earth, so it stays framed while it shrinks
    const near = (k: Key) => (k.earth ? MathUtils.lerp(1, 0.55, shrink) * fit : fitSystem)
    at(k0, k0.pos, tmp.pos, near(k0))
    at(k1, k1.pos, tmp.b, near(k1))
    tmp.pos.lerp(tmp.b, u)
    at(k0, k0.look, tmp.look, near(k0))
    at(k1, k1.look, tmp.b, near(k1))
    tmp.look.lerp(tmp.b, u)
    // Slowly circle the finished solar system
    if (s.spin > 0) tmp.pos.applyAxisAngle(tmp.a.set(0, 1, 0), s.spin)
    camera.position.copy(tmp.pos)
    camera.lookAt(tmp.look)
    camera.updateMatrixWorld()

    // ---- names: project each planet to the screen and move its label there ----
    const names = ramp(p, 0.76, 0.86)
    LABELS.forEach((_, li) => {
      const el = labels.current?.[li]
      if (!el) return
      const isEarth = li === PLANETS.length
      const g = isEarth ? earthGroup.current : planets.current[li]
      if (!g || names < 0.01) {
        el.style.opacity = '0'
        return
      }
      const lift = isEarth ? earthScale + 0.3 : PLANETS[li].radius + 0.3
      tmp.screen.copy(g.position).setY(g.position.y + lift).project(camera)
      const behind = tmp.screen.z > 1
      el.style.opacity = behind ? '0' : String(names)
      el.style.transform = `translate(-50%, -100%) translate(${((tmp.screen.x + 1) / 2) * size.width}px, ${((1 - tmp.screen.y) / 2) * size.height}px)`
    })
  })

  return (
    <>
      <color attach="background" args={['#010208']} />
      <Reflections intensity={0.35} />
      <ambientLight intensity={0.05} />
      {/* Sunlight from the centre, no fall-off, so every planet is lit like the real thing */}
      <pointLight position={[0, 0, 0]} intensity={4.2} decay={0} color="#fff3e0" />
      <Stars radius={140} depth={60} count={4000} factor={4} saturation={0.4} fade speed={0.3} />
      <Glow strength={0.9} />

      <Sun sunRef={sun} />
      <OrbitLines matRef={orbitMat} />
      <AsteroidBelt matRef={beltMat} beltRef={belt} />

      <group ref={earthGroup}>
        <Earth radius={1} position={[0, 0, 0]} spin={0.03} sunDirection={sunDir} />
      </group>

      <group ref={craft} visible={false}>
        <CraftModel design={SHOWCASE} />
      </group>

      {PLANETS.map((pl, i) => (
        <Planet
          key={pl.name}
          info={pl}
          groupRef={(g) => {
            planets.current[i] = g
          }}
        />
      ))}
    </>
  )
}

export default function SolarStoryScene({ progress }: { progress: RefObject<number> }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(wrapper)
  const labels = useRef<(HTMLSpanElement | null)[]>([])
  return (
    <div ref={wrapper} className="absolute inset-0">
      <ErrorBoundary fallback={null}>
        <Canvas
          dpr={[1, 1.5]}
          frameloop={visible ? 'always' : 'never'}
          camera={{ position: [5, 0.1, 2.75], fov: 42, near: 0.05, far: 400 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <Scene progress={progress} labels={labels} />
        </Canvas>
      </ErrorBoundary>
      {/* Planet names, positioned by the scene every frame */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {LABELS.map((name, i) => (
          <span
            key={name}
            ref={(el) => {
              labels.current[i] = el
            }}
            className={`absolute left-0 top-0 whitespace-nowrap text-xs font-semibold tracking-wide opacity-0 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)] ${
              name === 'Earth' ? 'text-cyan-200' : 'text-slate-200'
            }`}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}
