/**
 * 3D launch: rocket on the pad → liftoff → (stage separation, fairing opens,
 * spacecraft deploys above Earth) or (rocket breaks apart in a fireball).
 * Low-poly with drawn textures, glowing flames and smoke made of sprites.
 * Lazy-loaded, dpr ≤ 1.5, stops rendering when off-screen.
 */

import { OrbitControls, Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  AdditiveBlending,
  BackSide,
  DoubleSide,
  NormalBlending,
  Vector3,
  type Group,
  type Object3D,
  type PointLight,
  type ShaderMaterial,
  type Sprite,
  type SpriteMaterial,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import ErrorBoundary from '../../../../components/ui/ErrorBoundary'
import type { MissionDesign } from '../../../../game/types'
import CraftModel from '../../design/components/CraftModel'
import { Earth, Reflections, Sun } from '../../design/components/SpaceBackdrop'
import { concreteTexture, glowTexture, groundTexture, smokeTexture } from '../../design/components/textures'
import { useOnScreen } from '../../design/components/useOnScreen'
import { useShadows } from '../../design/components/useShadows'

export type FlightTone = 'good' | 'bad' | 'fail'

interface RocketLook {
  height: number
  radius: number
  body: string
  band: string
  stripe: string
  boosters: boolean
  boosterColor: string
}

const LOOK: Record<string, RocketLook> = {
  'small-launcher': { height: 2.6, radius: 0.18, body: '#1f2937', band: '#111827', stripe: '#22d3ee', boosters: false, boosterColor: '#1f2937' },
  'rideshare-leo': { height: 4, radius: 0.28, body: '#f8fafc', band: '#111827', stripe: '#22d3ee', boosters: false, boosterColor: '#f8fafc' },
  'rideshare-geo': { height: 4, radius: 0.28, body: '#f8fafc', band: '#111827', stripe: '#a78bfa', boosters: false, boosterColor: '#f8fafc' },
  'medium-launcher': { height: 4.2, radius: 0.3, body: '#f8fafc', band: '#1e3a8a', stripe: '#ef4444', boosters: true, boosterColor: '#e2e8f0' },
  'deep-rideshare': { height: 4.6, radius: 0.32, body: '#ea7a1a', band: '#9a4a0c', stripe: '#f8fafc', boosters: true, boosterColor: '#f8fafc' },
}

/** How long each ending plays before onDone (seconds) */
const DURATION: Record<FlightTone, number> = { good: 8, bad: 8, fail: 5 }
const SEPARATION_AT = 3.4
const FAIRING_AT = 4.4
const BREAKUP_AT = 2.7
const CLIMB = 0.42

const climbY = (t: number) => t * t * CLIMB
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/* ---------------- sky: blue gradient that fades to black space ---------------- */

const SKY_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SKY_FRAG = /* glsl */ `
  uniform float uSpace;
  varying vec3 vPos;
  void main() {
    float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
    vec3 horizon = vec3(0.98, 0.78, 0.55);
    vec3 low = vec3(0.49, 0.78, 0.98);
    vec3 high = vec3(0.10, 0.36, 0.78);
    vec3 col = mix(horizon, low, smoothstep(0.45, 0.55, h));
    col = mix(col, high, smoothstep(0.55, 0.95, h));
    gl_FragColor = vec4(col, 1.0 - uSpace);
  }
`

function Sky({ matRef }: { matRef: RefObject<ShaderMaterial | null> }) {
  const uniforms = useMemo(() => ({ uSpace: { value: 0 } }), [])
  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[80, 32, 16]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={SKY_VERT}
        fragmentShader={SKY_FRAG}
        side={BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}

/* ---------------- sprite particles (flame trail and smoke) ---------------- */

interface Particle {
  pos: Vector3
  vel: Vector3
  age: number
  life: number
  size: number
}

/**
 * Sprites that spawn under the engines while `active` is on and stay behind in
 * the air. Near the ground the exhaust is pushed sideways, like smoke leaving
 * the flame trench.
 */
function Plume({
  emitter,
  active,
  count,
  kind,
}: {
  emitter: RefObject<Object3D | null>
  active: RefObject<boolean>
  count: number
  kind: 'fire' | 'smoke'
}) {
  const sprites = useRef<(Sprite | null)[]>([])
  // Simulation state lives in a ref: it changes every frame, outside React
  const store = useRef<Particle[] | null>(null)
  const next = useRef(0)
  const at = useMemo(() => new Vector3(), [])
  const fire = kind === 'fire'
  const tex = fire ? glowTexture() : smokeTexture()

  useFrame((_, delta) => {
    store.current ??= Array.from({ length: count }, () => ({ pos: new Vector3(), vel: new Vector3(), age: 1, life: 1, size: 1 }))
    const parts = store.current
    const dt = Math.min(delta, 0.05)
    if (active.current && emitter.current) {
      emitter.current.getWorldPosition(at)
      const spawn = fire ? 3 : 2
      for (let i = 0; i < spawn; i++) {
        const p = parts[next.current]
        next.current = (next.current + 1) % parts.length
        const nearGround = at.y < 1.2
        p.pos.copy(at)
        p.age = 0
        p.life = fire ? 0.35 + Math.random() * 0.2 : 2.2 + Math.random() * 1.5
        p.size = fire ? 0.9 + Math.random() * 0.5 : 0.8 + Math.random() * 0.6
        if (nearGround) {
          const a = Math.random() * Math.PI * 2
          const s = fire ? 2 : 1.4 + Math.random() * 1.2
          p.vel.set(Math.cos(a) * s, 0.2 + Math.random() * 0.4, Math.sin(a) * s)
        } else {
          p.vel.set((Math.random() - 0.5) * 0.4, fire ? -3.5 : -1.2 - Math.random(), (Math.random() - 0.5) * 0.4)
        }
      }
    }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      const s = sprites.current[i]
      if (!s) continue
      p.age += dt / p.life
      if (p.age >= 1) {
        s.visible = false
        continue
      }
      s.visible = true
      p.vel.multiplyScalar(fire ? 0.96 : 0.985)
      p.pos.addScaledVector(p.vel, dt)
      if (p.pos.y < 0.15) p.pos.y = 0.15
      s.position.copy(p.pos)
      s.scale.setScalar(p.size * (fire ? 1 - p.age * 0.5 : 1 + p.age * 3.5))
      const m = s.material as SpriteMaterial
      m.opacity = fire ? (1 - p.age) * 0.9 : (1 - p.age) * 0.55
      if (fire) m.color.setRGB(1, 0.75 - p.age * 0.45, 0.35 - p.age * 0.3)
      else {
        const g = 0.92 - p.age * 0.35
        m.color.setRGB(g, g, g)
      }
    }
  })

  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            sprites.current[i] = el
          }}
          visible={false}
        >
          <spriteMaterial
            map={tex}
            transparent
            depthWrite={false}
            blending={fire ? AdditiveBlending : NormalBlending}
            color={fire ? '#ffb347' : '#e5e7eb'}
          />
        </sprite>
      ))}
    </group>
  )
}

/* ---------------- launch tower ---------------- */

function Tower({ height }: { height: number }) {
  const levels = Math.round(height / 0.45)
  return (
    <group position={[-1.15, 0.2, 0]}>
      {[
        [-0.15, -0.15],
        [0.15, -0.15],
        [-0.15, 0.15],
        [0.15, 0.15],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, height / 2, z]}>
          <boxGeometry args={[0.04, height, 0.04]} />
          <meshStandardMaterial color="#b91c1c" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {Array.from({ length: levels }, (_, i) => (
        <group key={i} position={[0, 0.3 + i * 0.45, 0]}>
          <mesh>
            <boxGeometry args={[0.34, 0.03, 0.03]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.5} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.34, 0.03, 0.03]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.5} />
          </mesh>
        </group>
      ))}
      {/* Access arm to the rocket */}
      <mesh position={[0.55, height * 0.82, 0]}>
        <boxGeometry args={[0.8, 0.08, 0.12]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.6} />
      </mesh>
      {/* Warning light on top */}
      <mesh position={[0, height + 0.08, 0]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color="#f87171" />
      </mesh>
    </group>
  )
}

/* ---------------- the rocket ---------------- */

function Stage({ look, height, band }: { look: RocketLook; height: number; band?: boolean }) {
  return (
    <group>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[look.radius, look.radius, height, 24]} />
        <meshStandardMaterial color={look.body} metalness={0.25} roughness={0.35} />
      </mesh>
      {/* Coloured stripe */}
      <mesh position={[0, height * 0.55, 0]}>
        <cylinderGeometry args={[look.radius * 1.005, look.radius * 1.005, height * 0.05, 24]} />
        <meshStandardMaterial color={look.stripe} metalness={0.3} roughness={0.4} emissive={look.stripe} emissiveIntensity={0.15} />
      </mesh>
      {band && (
        <mesh position={[0, height - 0.12, 0]}>
          <cylinderGeometry args={[look.radius * 1.01, look.radius * 1.01, 0.24, 24]} />
          <meshStandardMaterial color={look.band} metalness={0.4} roughness={0.5} />
        </mesh>
      )}
    </group>
  )
}

function Engines({ look }: { look: RocketLook }) {
  const n = look.radius > 0.25 ? 5 : 3
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        const r = i === 0 && n === 5 ? 0 : look.radius * 0.5
        return (
          <mesh key={i} position={[Math.cos(a) * r, -0.12, Math.sin(a) * r]}>
            <cylinderGeometry args={[0.05, look.radius * 0.28, 0.24, 12, 1, true]} />
            <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.3} side={DoubleSide} />
          </mesh>
        )
      })}
    </group>
  )
}

function GridFins({ look, y }: { look: RocketLook; y: number }) {
  return (
    <group position={[0, y, 0]}>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2
        return (
          <mesh key={i} position={[Math.cos(a) * (look.radius + 0.06), 0, Math.sin(a) * (look.radius + 0.06)]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.12, 0.14, 0.02]} />
            <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.35} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Layered glowing flame cones + a glow sprite; scaled by the scene each frame */
function Flame({ radius, flameRef }: { radius: number; flameRef: RefObject<Group | null> }) {
  return (
    <group ref={flameRef} position={[0, -0.24, 0]} visible={false}>
      <mesh position={[0, -0.45, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius * 1.1, 1.0, 16, 1, true]} />
        <meshBasicMaterial color="#ff7a1a" transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius * 0.6, 0.65, 16, 1, true]} />
        <meshBasicMaterial color="#ffe08a" transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <sprite position={[0, -0.25, 0]} scale={radius * 9}>
        <spriteMaterial map={glowTexture()} color="#ffb04a" transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

/* ---------------- explosion ---------------- */

function Explosion({ boomRef, look }: { boomRef: RefObject<Group | null>; look: RocketLook }) {
  return (
    <group ref={boomRef} visible={false}>
      {Array.from({ length: 10 }, (_, i) => (
        <sprite key={`f${i}`} userData={{ kind: 'fire', i }}>
          <spriteMaterial map={glowTexture()} color="#ff9a2e" transparent blending={AdditiveBlending} depthWrite={false} />
        </sprite>
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <sprite key={`s${i}`} userData={{ kind: 'smoke', i }}>
          <spriteMaterial map={smokeTexture()} color="#3f3f46" transparent depthWrite={false} />
        </sprite>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={`d${i}`} userData={{ kind: 'debris', i }}>
          <boxGeometry args={[0.14, 0.06, 0.1]} />
          <meshStandardMaterial color={i % 3 ? '#9ca3af' : look.body} emissive="#f97316" emissiveIntensity={i % 2 ? 0.8 : 0} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------------- scene ---------------- */

function Scene({ rocketId, design, tone, flying, onDone }: SceneProps) {
  const look = LOOK[rocketId] ?? LOOK['rideshare-leo']
  const lowerH = look.height * 0.7
  const upperH = look.height * 0.3

  const rocket = useRef<Group>(null)
  const lower = useRef<Group>(null)
  const fairingL = useRef<Group>(null)
  const fairingR = useRef<Group>(null)
  const craft = useRef<Group>(null)
  const flame = useRef<Group>(null)
  const upperFlame = useRef<Group>(null)
  const nozzle = useRef<Group>(null)
  const engineLight = useRef<PointLight>(null)
  const boom = useRef<Group>(null)
  const boomLight = useRef<PointLight>(null)
  const sky = useRef<ShaderMaterial>(null)
  const ground = useRef<Group>(null)
  const earth = useRef<Group>(null)
  const burning = useRef(false)
  const controls = useRef<OrbitControlsImpl>(null)
  /** True while the player is holding and dragging the view */
  const userDragging = useRef(false)
  const placed = useRef(false)
  const focus = useMemo(() => new Vector3(), [])
  const offset = useMemo(() => new Vector3(), [])
  const shadowRoot = useRef<Group>(null)
  useShadows(shadowRoot)
  const startedAt = useRef<number | null>(null)
  const finished = useRef(false)
  const { camera, clock, size } = useThree()
  // Tall phone screens need the camera further back to fit the whole rocket
  const portrait = size.width / size.height < 0.8 ? 1.2 : 1

  useEffect(() => {
    startedAt.current = flying ? clock.getElapsedTime() : null
    finished.current = false
  }, [flying, clock])

  const breakupY = climbY(BREAKUP_AT) + look.height * 0.6

  useFrame(({ clock: c }) => {
    const t = startedAt.current === null ? 0 : Math.min(DURATION[tone] + 0.1, c.getElapsedTime() - startedAt.current)
    const flicker = 0.85 + Math.random() * 0.3
    const r = rocket.current
    if (!r) return
    const failed = tone === 'fail'
    const broken = flying && failed && t > BREAKUP_AT

    // Climb: speeds up like a real rocket
    const y = flying ? climbY(failed ? Math.min(t, BREAKUP_AT) : t) : 0
    r.position.y = y + 0.2

    // Sky fades to black space; the ground drops away
    const space = failed ? 0 : clamp01((t - 1.4) / 3)
    if (sky.current) sky.current.uniforms.uSpace.value = space
    if (ground.current) ground.current.visible = space < 0.98

    // Main engines
    burning.current = flying && t < SEPARATION_AT && !broken
    if (flame.current) {
      flame.current.visible = burning.current
      flame.current.scale.set(flicker, flicker * (1 + Math.min(t, 3) * 0.25), flicker)
    }
    if (engineLight.current) engineLight.current.intensity = burning.current ? 25 * flicker : 0

    if (failed) {
      // Tilt, then break apart in a fireball
      r.rotation.z = flying && t > BREAKUP_AT - 0.7 ? (t - (BREAKUP_AT - 0.7)) * 0.55 : 0
      r.visible = !broken
      const k = t - BREAKUP_AT
      if (boom.current) {
        boom.current.visible = broken
        boom.current.children.forEach((o) => {
          const { kind, i } = o.userData as { kind: string; i: number }
          const a = i * 2.4
          const spread = kind === 'debris' ? 1.6 : kind === 'fire' ? 0.9 : 1.2
          o.position.set(
            Math.cos(a) * k * spread,
            Math.sin(a * 1.3) * k * spread * 0.8 - (kind === 'debris' ? k * k * 0.7 : -k * 0.3),
            Math.sin(a) * k * spread * 0.6,
          )
          if (kind === 'debris') o.rotation.set(k * 5 + i, k * 4, 0)
          else {
            const s = o as Sprite
            const m = s.material as SpriteMaterial
            s.scale.setScalar(kind === 'fire' ? 0.6 + k * 2.6 : 0.8 + k * 3)
            m.opacity = kind === 'fire' ? clamp01(1 - k / 1.2) : clamp01(Math.min(k * 2, 1) * (1 - k / 2.4)) * 0.85
          }
        })
      }
      if (boomLight.current) boomLight.current.intensity = broken ? 60 * clamp01(1 - k / 1.3) : 0
    } else {
      // Stage separation: the first stage falls away
      if (lower.current) {
        const k = flying ? t - SEPARATION_AT : -1
        lower.current.position.y = k > 0 ? -k * k * 0.9 - k * 0.6 : 0
        lower.current.rotation.z = k > 0 ? k * 0.35 : 0
        lower.current.visible = k < 3
      }
      if (upperFlame.current) {
        upperFlame.current.visible = flying && t > SEPARATION_AT + 0.3 && t < FAIRING_AT
        upperFlame.current.scale.setScalar(flicker * 0.55)
      }
      // Fairing opens, the spacecraft drifts out and turns
      const open = flying ? clamp01((t - FAIRING_AT) / 0.9) : 0
      if (fairingL.current && fairingR.current) {
        fairingL.current.rotation.z = open * 1.3
        fairingR.current.rotation.z = -open * 1.3
        fairingL.current.position.x = -open * 0.7
        fairingR.current.position.x = open * 0.7
      }
      if (craft.current) {
        const out = flying ? clamp01((t - FAIRING_AT - 0.5) / 2) : 0
        craft.current.position.y = upperH * 0.55 + out * 1.6
        craft.current.scale.setScalar(look.radius * 0.6 + out * 0.4)
        craft.current.rotation.y = t * 0.8
      }
    }

    // Earth below once in space
    if (earth.current) {
      earth.current.visible = space > 0.3
      earth.current.position.set(0, y - 30, -6)
    }

    // Camera follows the rocket. The player can hold and drag to orbit around it
    // (OrbitControls); we only move the view along with the rocket and, while
    // they're not dragging, ease it to a distance that fits the scene.
    const focusY = failed ? Math.min(y, climbY(BREAKUP_AT)) + look.height * 0.55 : y + look.height * 0.55
    const dist = (7.8 + clamp01(t / 4) * 1.8) * portrait
    const shake = burning.current && t < 2.5 ? (2.5 - t) * 0.02 : 0
    focus.set((Math.random() - 0.5) * shake, focusY + (Math.random() - 0.5) * shake, 0)
    const ctl = controls.current
    if (!placed.current) {
      camera.position.set(dist * 0.45, focusY + 0.4, dist)
      placed.current = true
    }
    if (ctl) {
      offset.copy(camera.position).sub(ctl.target)
      if (!userDragging.current) offset.setLength(offset.length() + (dist - offset.length()) * 0.05)
      ctl.target.copy(focus)
      camera.position.copy(focus).add(offset)
      ctl.update()
    } else {
      camera.lookAt(focus)
    }

    if (flying && !finished.current && t > DURATION[tone]) {
      finished.current = true
      onDone()
    }
  })

  return (
    <>
      <color attach="background" args={['#02040c']} />
      <Reflections />
      <Sky matRef={sky} />
      <Stars radius={100} depth={30} count={1500} factor={4} saturation={0.3} fade speed={0.3} />
      <Sun position={[30, 25, -40]} size={10} />
      <hemisphereLight args={['#bae6fd', '#3f6212', 0.6]} />
      <directionalLight
        position={[7, 9, 5]}
        intensity={2.6}
        color="#fff4dc"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={9}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        minDistance={2.5}
        maxDistance={25}
        onStart={() => {
          userDragging.current = true
        }}
        onEnd={() => {
          userDragging.current = false
        }}
      />

      <group ref={earth} visible={false}>
        <Earth radius={28} position={[0, 0, 0]} spin={0.01} />
      </group>

      <group ref={shadowRoot}>
      {/* Ground, pad and tower */}
      <group ref={ground}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[40, 32]} />
          <meshStandardMaterial map={groundTexture()} roughness={1} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[3, 0.2, 3]} />
          <meshStandardMaterial map={concreteTexture()} roughness={0.9} />
        </mesh>
        <Tower height={look.height * 1.1} />
        {/* Lightning masts */}
        {[
          [3, -2],
          [-3, -2.5],
          [2.5, 3],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, look.height * 0.7, z]}>
            <cylinderGeometry args={[0.03, 0.05, look.height * 1.4, 6]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.6} />
          </mesh>
        ))}
      </group>

      {/* Exhaust: glowing trail and smoke, both left behind in the air */}
      <Plume emitter={nozzle} active={burning} count={40} kind="fire" />
      <Plume emitter={nozzle} active={burning} count={70} kind="smoke" />

      {/* Rocket */}
      <group ref={rocket} position={[0, 0.2, 0]}>
        <group ref={lower}>
          <group position={[0, 0.25, 0]}>
            <Stage look={look} height={lowerH - 0.25} band />
            <GridFins look={look} y={lowerH - 0.45} />
            <Engines look={look} />
          </group>
          {look.boosters &&
            [-1, 1].map((s) => (
              <group key={s} position={[s * look.radius * 1.65, 0.25, 0]}>
                <mesh position={[0, lowerH * 0.4, 0]}>
                  <cylinderGeometry args={[look.radius * 0.55, look.radius * 0.55, lowerH * 0.8, 16]} />
                  <meshStandardMaterial color={look.boosterColor} metalness={0.25} roughness={0.4} />
                </mesh>
                <mesh position={[0, lowerH * 0.8 + 0.18, 0]}>
                  <coneGeometry args={[look.radius * 0.55, 0.36, 16]} />
                  <meshStandardMaterial color={look.boosterColor} metalness={0.25} roughness={0.4} />
                </mesh>
              </group>
            ))}
          <group ref={nozzle} />
          <Flame radius={look.radius * (look.boosters ? 2.2 : 1.1)} flameRef={flame} />
          <pointLight ref={engineLight} position={[0, -0.6, 0]} color="#ff9a3c" distance={8} intensity={0} />
        </group>

        <group position={[0, lowerH, 0]}>
          <Stage look={look} height={upperH * 0.5} />
          <Flame radius={look.radius * 0.6} flameRef={upperFlame} />

          {/* The spacecraft inside the fairing */}
          <group ref={craft} position={[0, upperH * 0.55, 0]}>
            <CraftModel design={design} />
          </group>

          {/* Fairing halves (right half: angles 0..π, left half: π..2π), hinged at the bottom */}
          {(
            [
              [fairingL, -1],
              [fairingR, 1],
            ] as const
          ).map(([ref, side]) => (
            <group key={side} ref={ref} position={[0, upperH * 0.5, 0]}>
              <mesh position={[0, upperH * 0.5, 0]}>
                <cylinderGeometry args={[look.radius * 1.15, look.radius * 1.15, upperH, 24, 1, true, side === 1 ? 0 : Math.PI, Math.PI]} />
                <meshStandardMaterial color="#f8fafc" metalness={0.2} roughness={0.35} side={DoubleSide} />
              </mesh>
              <mesh position={[0, upperH + 0.28, 0]}>
                <coneGeometry args={[look.radius * 1.15, 0.56, 24, 1, true, side === 1 ? 0 : Math.PI, Math.PI]} />
                <meshStandardMaterial color="#f8fafc" metalness={0.2} roughness={0.35} side={DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      </group>

      {/* Explosion at the break-up point */}
      <group position={[0.3, breakupY, 0]}>
        <Explosion boomRef={boom} look={look} />
        <pointLight ref={boomLight} color="#ff8a1f" distance={14} intensity={0} />
      </group>
    </>
  )
}

interface SceneProps {
  rocketId: string
  design: MissionDesign
  tone: FlightTone
  /** true starts the flight animation */
  flying: boolean
  onDone: () => void
}

export default function LaunchScene(props: SceneProps) {
  const wrapper = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(wrapper)
  return (
    <div ref={wrapper} className="h-full w-full">
      <ErrorBoundary
        fallback={<p className="flex h-full items-center justify-center p-4 text-center text-sm text-slate-400">3D view isn’t available on this device.</p>}
      >
        <Canvas
          shadows="soft"
          dpr={[1, 1.5]}
          frameloop={visible ? 'always' : 'never'}
          camera={{ position: [3, 3, 7], fov: 45, near: 0.1, far: 300 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <Scene {...props} />
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}
