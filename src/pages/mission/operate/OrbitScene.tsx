/**
 * Phase 3 in 3D: your own spacecraft circling Earth in the orbit you picked.
 * It goes dark in Earth's shadow (running on battery), and a beam shows when it
 * passes over the ground station and sends data home. Each Fly speeds time up
 * for a moment, so a month visibly goes by. Lazy-loaded (three.js is big).
 */

import { Line, Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, Vector3, type Group, type Mesh, type MeshBasicMaterial, type PerspectiveCamera, type Points } from 'three'
import CraftModel from '../../../components/space/CraftModel'
import { Earth, Sun } from '../../../components/space/SpaceBackdrop'
import { useOnScreen } from '../../../components/space/useOnScreen'
import ErrorBoundary from '../../../components/ui/ErrorBoundary'
import type { EventId } from '../../../game/events/events'
import type { MissionDesign, OrbitId } from '../../../game/types'

const SUN_DIR = new Vector3(1, 0.2, 0.75).normalize()
const EARTH_R = 2

interface OrbitLook {
  /** Orbit radius in scene units (Earth radius is 2) */
  radius: number
  /** Tilt of the orbit plane: x then z rotation */
  tilt: [number, number]
  /** Turns per second at normal speed */
  speed: number
  camera: [number, number, number]
  /** Sun–Earth L1 and deep space don't circle Earth */
  away?: boolean
}

const LOOK: Record<OrbitId, OrbitLook> = {
  leo: { radius: 2.6, tilt: [0.9, 0.2], speed: 0.12, camera: [3.5, 2.6, 8.5] },
  sso: { radius: 2.7, tilt: [1.45, 0.35], speed: 0.11, camera: [3.5, 2.6, 8.5] },
  geo: { radius: 5, tilt: [0.05, 0], speed: 0.03, camera: [5, 4, 14] },
  l1: { radius: 6, tilt: [0, 0], speed: 0, camera: [-4, 3, 11], away: true },
  'deep-space': { radius: 7, tilt: [0, 0], speed: 0, camera: [-4, 3, 12], away: true },
}

function Craft({
  design,
  look,
  month,
  effect,
  onStatus,
}: {
  design: MissionDesign
  look: OrbitLook
  month: number
  effect: EventId | null
  onStatus: (s: Status) => void
}) {
  const glitch = useRef<Mesh>(null)
  const orbit = useRef<Group>(null)
  const craft = useRef<Group>(null)
  const beam = useRef<Mesh>(null)
  const station = useRef<Group>(null)
  const angle = useRef(0)
  const boostUntil = useRef(0)
  const lastMonth = useRef(month)
  const lastStatus = useRef<Status | null>(null)
  const world = useMemo(() => new Vector3(), [])
  const stationWorld = useMemo(() => new Vector3(), [])

  /** Tells the page only when the light or the data pass changes */
  const report = (light: 'sun' | 'shadow', sending: boolean) => {
    const prev = lastStatus.current
    if (prev && prev.light === light && prev.sending === sending) return
    lastStatus.current = { light, sending }
    onStatus({ light, sending })
  }

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (month !== lastMonth.current) {
      lastMonth.current = month
      boostUntil.current = t + 1.6 // a month goes by: fast-forward
    }
    const boost = t < boostUntil.current ? 12 : 1
    if (station.current) station.current.rotation.y += delta * 0.15 // turns with Earth

    if (glitch.current) glitch.current.visible = effect === 'instrument-glitch' && Math.sin(t * 10) > 0
    if (!craft.current) return
    if (look.away) {
      // Parked far away (L1 towards the Sun, deep space drifting off), with a small halo loop
      angle.current += delta * 0.4 * boost
      const base = look.radius
      const dir = look.radius === LOOK.l1.radius ? SUN_DIR : new Vector3(-0.6, 0.25, 0.75).normalize()
      craft.current.position.copy(dir).multiplyScalar(base)
      craft.current.position.y += Math.sin(angle.current) * 0.25
      craft.current.position.z += Math.cos(angle.current) * 0.25
      craft.current.rotation.y += delta * 0.3
      report('sun', false)
      return
    }

    angle.current += delta * look.speed * Math.PI * 2 * boost
    craft.current.position.set(Math.cos(angle.current) * look.radius, 0, Math.sin(angle.current) * look.radius)
    craft.current.rotation.y = -angle.current
    craft.current.getWorldPosition(world)

    // Shadow: behind Earth as seen from the Sun, within Earth's radius of the Sun line
    const along = world.dot(SUN_DIR)
    const off = world.clone().sub(SUN_DIR.clone().multiplyScalar(along)).length()
    const inShadow = along < 0 && off < EARTH_R

    // Ground station pass: the spacecraft is close to the station's sky
    let sending = false
    if (station.current && beam.current) {
      station.current.children[0].getWorldPosition(stationWorld)
      const toCraft = world.clone().sub(stationWorld)
      const up = stationWorld.clone().normalize()
      sending = effect !== 'station-outage' && toCraft.clone().normalize().dot(up) > (look.radius > 4 ? 0.2 : 0.55)
      beam.current.visible = sending && effect !== 'station-outage'
      if (sending) {
        const mid = stationWorld.clone().add(world).multiplyScalar(0.5)
        beam.current.position.copy(mid)
        beam.current.lookAt(world)
        beam.current.rotateX(Math.PI / 2)
        beam.current.scale.set(1, toCraft.length(), 1)
        ;(beam.current.material as MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 8) * 0.15
      }
    }
    report(inShadow ? 'shadow' : 'sun', sending)
  })

  const path = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2
      pts.push([Math.cos(a) * look.radius, 0, Math.sin(a) * look.radius])
    }
    return pts
  }, [look.radius])

  return (
    <>
      {/* Ground station: a cyan light on Earth that turns with it */}
      <group ref={station} rotation={[0.35, 0, 0.1]}>
        <mesh position={[0, 0.35, EARTH_R * 0.97]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshBasicMaterial color={effect === 'station-outage' ? '#f43f5e' : '#22d3ee'} toneMapped={false} />
        </mesh>
        {/* Fire season: glowing fires around the station's region (Southeast Asia) */}
        {effect === 'fire-season' &&
          FIRES.map(([x, y], i) => (
            <mesh key={i} position={new Vector3(x, 0.35 + y, EARTH_R).normalize().multiplyScalar(EARTH_R * 1.005).toArray()}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshBasicMaterial color="#fb923c" toneMapped={false} />
            </mesh>
          ))}
      </group>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.015, 0.015, 1, 6]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.5} toneMapped={false} depthWrite={false} />
      </mesh>
      <group ref={orbit} rotation={[look.tilt[0], 0, look.tilt[1]]}>
        {!look.away && <Line points={path} color="#67e8f9" lineWidth={1} transparent opacity={0.35} />}
        <group ref={craft} scale={look.radius > 4 ? 0.6 : 0.45}>
          <CraftModel design={design} instant />
          <mesh ref={glitch} visible={false} position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshBasicMaterial color="#f43f5e" toneMapped={false} />
          </mesh>
        </group>
      </group>
    </>
  )
}

/** Fire spots near the station, as small offsets on Earth's face */
const FIRES: [number, number][] = [
  [0.12, 0.08], [-0.1, 0.15], [0.2, -0.05], [-0.18, -0.02], [0.05, 0.22], [0.25, 0.14], [-0.05, -0.12],
]

const STORM_COUNT = 260
/** Fixed pseudo-random offsets for the storm particles */
const STORM_SEEDS = Array.from({ length: STORM_COUNT }, (_, i) => [
  ((i * 7919) % 1000) / 1000,
  ((i * 104729) % 1000) / 1000 - 0.5,
  ((i * 1299709) % 1000) / 1000 - 0.5,
])

/** A solar storm: particles streaming from the Sun past Earth */
function StormStream() {
  const ref = useRef<Points>(null)
  const side = useMemo(() => new Vector3(0, 1, 0).cross(SUN_DIR).normalize(), [])
  const up = useMemo(() => SUN_DIR.clone().cross(side).normalize(), [side])
  useFrame(({ clock }) => {
    const geo = ref.current?.geometry
    if (!geo) return
    if (!geo.getAttribute('position')) geo.setAttribute('position', new BufferAttribute(new Float32Array(STORM_COUNT * 3), 3))
    const attr = geo.getAttribute('position') as BufferAttribute
    const positions = attr.array as Float32Array
    const t = clock.elapsedTime
    const p = new Vector3()
    for (let i = 0; i < STORM_COUNT; i++) {
      const [phase, a, b] = STORM_SEEDS[i]
      const k = (phase + t * 0.35) % 1 // 0 at the Sun side, 1 past Earth
      const spread = 1.2 + k * 2.2
      p.copy(SUN_DIR).multiplyScalar(14 - k * 22).addScaledVector(side, a * spread * 2).addScaledVector(up, b * spread * 2)
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
    }
    attr.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry />
      <pointsMaterial color="#fb923c" size={0.08} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </points>
  )
}

/** Space debris: a few tumbling bits crossing the orbit */
function Debris({ radius }: { radius: number }) {
  const ref = useRef<Group>(null)
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y -= delta * 0.5
    ref.current.children.forEach((c, i) => {
      c.rotation.x += delta * (1 + i * 0.3)
      c.rotation.z += delta * 0.7
    })
  })
  return (
    <group ref={ref} rotation={[0.4, 0, -0.3]}>
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 0.9
        return (
          <mesh key={i} position={[Math.cos(a) * (radius + (i % 3) * 0.08), (i % 2) * 0.1 - 0.05, Math.sin(a) * radius]}>
            <dodecahedronGeometry args={[0.05 + (i % 3) * 0.02, 0]} />
            <meshStandardMaterial color="#9ca3af" roughness={0.9} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Keeps Earth and the whole orbit in view on tall phones and wide screens */
function CameraRig({ look }: { look: OrbitLook }) {
  const { camera, size } = useThree()
  useFrame(() => {
    const cam = camera as PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)
    const halfV = (cam.fov * Math.PI) / 360
    const halfH = Math.atan(Math.tan(halfV) * aspect)
    const reach = look.away ? look.radius * 0.75 + EARTH_R : look.radius + 0.4
    // Far enough that the orbit fits across, and fills about half the screen height
    const dist = Math.max(reach / Math.tan(halfH), (reach * 2.3) / Math.tan(halfV))
    const base = new Vector3(...look.camera).normalize()
    // Aim a little below Earth so it sits above the bottom panel
    const target = new Vector3(look.away ? 1.5 : 0, -reach * 0.25, 0)
    cam.position.lerp(target.clone().addScaledVector(base, dist), 0.08)
    cam.lookAt(target)
  })
  return null
}

export interface Status {
  light: 'sun' | 'shadow'
  sending: boolean
}

export default function OrbitScene({
  design,
  orbitId,
  month,
  effect = null,
  onStatus,
}: {
  design: MissionDesign
  orbitId: OrbitId
  /** Months flown so far: a change plays a short fast-forward */
  month: number
  /** The surprise happening now, shown in 3D */
  effect?: EventId | null
  onStatus: (s: Status) => void
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(wrapper)
  const look = LOOK[orbitId] ?? LOOK.leo
  const sun = SUN_DIR.clone().multiplyScalar(30)

  return (
    <div ref={wrapper} className="h-full w-full">
      <ErrorBoundary fallback={<p className="flex h-full items-center justify-center p-4 text-center text-sm text-slate-400">3D view isn’t available on this device.</p>}>
        <Canvas
          dpr={[1, 1.5]}
          frameloop={visible ? 'always' : 'never'}
          camera={{ position: look.camera, fov: 40 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <CameraRig look={look} />
          <color attach="background" args={['#010208']} />
          <ambientLight intensity={0.15} />
          <directionalLight position={[sun.x, sun.y, sun.z]} intensity={3} color="#fff4dc" />
          <Stars radius={60} depth={30} count={1500} factor={3} saturation={0.5} fade speed={0.4} />
          <Sun position={[sun.x, sun.y, sun.z]} size={effect === 'solar-storm' ? 9 : 5} />
          {effect === 'solar-storm' && <StormStream />}
          {effect === 'debris' && !look.away && <Debris radius={look.radius} />}
          <Earth radius={EARTH_R} position={[0, 0, 0]} spin={0.15} sunDirection={SUN_DIR} />
          <Craft design={design} look={look} month={month} effect={effect} onStatus={onStatus} />
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}
