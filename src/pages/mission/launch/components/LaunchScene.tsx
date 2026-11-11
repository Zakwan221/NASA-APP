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
  MathUtils,
  NormalBlending,
  Vector3,
  type Fog,
  type Group,
  type Object3D,
  type PointLight,
  type ShaderMaterial,
  type Sprite,
  type SpriteMaterial,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import ErrorBoundary from '../../../../components/ui/ErrorBoundary'
import type { LaunchKind } from '../../../../game/engine/launch'
import type { MissionDesign } from '../../../../game/types'
import CraftModel from '../../design/components/CraftModel'
import { Earth, Reflections, Sun } from '../../design/components/SpaceBackdrop'
import { glowTexture, smokeTexture } from '../../design/components/textures'
import { useOnScreen } from '../../design/components/useOnScreen'
import { useShadows } from '../../design/components/useShadows'
import Glow from '../../design/components/Glow'
import { Booster, EngineCluster, FairingHalf, GridFins, LaunchSite, StageBody, VacuumEngine } from './Rocket'
import { ROCKET_LOOK, rocketTop, type RocketLook } from './rocketLook'


/** How long each result plays before onDone (seconds) */
const DURATION: Record<LaunchKind, number> = {
  perfect: 8,
  weather: 8,
  hold: 8,
  cable: 8,
  explode: 5,
  underpowered: 6.8,
  'wrong-orbit': 9,
  'lost-signal': 10,
}
const SEPARATION_AT = 3.4
const FAIRING_AT = 4.4
const BREAKUP_AT = 2.7
/** Signal lost / wrong orbit: trouble starts after the spacecraft is out */
const TROUBLE_AT = FAIRING_AT + 2.6
const CLIMB = 0.42

const climbY = (t: number) => t * t * CLIMB
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
/** Ease in and out, so moves start and stop gently */
const smooth = (n: number) => {
  const x = clamp01(n)
  return x * x * (3 - 2 * x)
}

/* Too heavy: a slow, struggling climb, engines cut out, the rocket falls back */
const CUT_AT = 3.2
const UNDER_ACCEL = 0.12
const UNDER_GRAVITY = 1.2
const cutY = UNDER_ACCEL * CUT_AT * CUT_AT
const cutV = 2 * UNDER_ACCEL * CUT_AT
/** When the falling rocket hits the ground */
const IMPACT_AT = CUT_AT + (cutV + Math.sqrt(cutV * cutV + 4 * UNDER_GRAVITY * cutY)) / (2 * UNDER_GRAVITY)
function underpoweredPath(t: number) {
  if (t < CUT_AT) return { y: UNDER_ACCEL * t * t, x: 0, tilt: Math.sin(t * 3) * 0.04 }
  const k = Math.min(t, IMPACT_AT) - CUT_AT
  return { y: Math.max(0, cutY + cutV * k - UNDER_GRAVITY * k * k), x: 0.5 * k * k, tilt: -k * 0.9 }
}

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
      // Hot (brighter than white, so it glows) and cooling as it ages
      if (fire) m.color.setRGB(2.6 - p.age * 1.4, (0.75 - p.age * 0.45) * 2.2, Math.max(0, 0.35 - p.age * 0.3) * 1.6)
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
            toneMapped={!fire}
          />
        </sprite>
      ))}
    </group>
  )
}

/** Layered glowing flame cones + a glow sprite; scaled by the scene each frame */
function Flame({ radius, flameRef, y }: { radius: number; flameRef: RefObject<Group | null>; y: number }) {
  return (
    <group ref={flameRef} position={[0, y, 0]} visible={false}>
      <mesh position={[0, -0.45, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius * 1.1, 1.0, 16, 1, true]} />
        <meshBasicMaterial color={[3, 1.1, 0.25]} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius * 0.6, 0.65, 16, 1, true]} />
        <meshBasicMaterial color={[4, 3.4, 1.8]} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <sprite position={[0, -0.25, 0]} scale={radius * 9}>
        <spriteMaterial map={glowTexture()} color={[2.6, 1.5, 0.5]} transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
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
          <spriteMaterial map={glowTexture()} color={[3.2, 1.6, 0.4]} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
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

function Scene({ rocketId, design, kind, roughness, flying, onDone }: SceneProps) {
  const look = ROCKET_LOOK[rocketId] ?? ROCKET_LOOK['rideshare-leo']
  const top = rocketTop(look)
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
  const boomAt = useRef<Group>(null)
  const beacon = useRef<Sprite>(null)
  const sky = useRef<ShaderMaterial>(null)
  const fog = useRef<Fog>(null)
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
  const impact = underpoweredPath(IMPACT_AT)

  useFrame(({ clock: c }, delta) => {
    const k0 = kind ?? 'perfect'
    const t = startedAt.current === null ? 0 : Math.min(DURATION[k0] + 0.1, c.getElapsedTime() - startedAt.current)
    // Less reliable launches flicker, shake and wobble more
    const now = c.getElapsedTime()
    const flicker = 1 + (Math.sin(now * 43) * 0.07 + Math.sin(now * 71) * 0.05) * (1 + roughness * 1.5)
    const r = rocket.current
    if (!r) return
    const exploded = flying && k0 === 'explode' && t > BREAKUP_AT
    const crashed = flying && k0 === 'underpowered' && t > IMPACT_AT
    const destroyed = k0 === 'explode' || k0 === 'underpowered'
    const boomT = k0 === 'explode' ? BREAKUP_AT : IMPACT_AT
    const broken = exploded || crashed

    // ---- where the rocket is ----
    let y = 0
    let x = 0
    let tilt = 0
    if (flying) {
      if (k0 === 'underpowered') {
        const p = underpoweredPath(t)
        y = p.y
        x = p.x
        tilt = p.tilt
      } else if (k0 === 'explode') {
        y = climbY(Math.min(t, BREAKUP_AT))
        tilt = t > BREAKUP_AT - 0.7 ? -(t - (BREAKUP_AT - 0.7)) * 0.55 : 0
      } else {
        y = climbY(t)
        // A rough ride wobbles while the main engines burn
        if (t < SEPARATION_AT) tilt = Math.sin(t * 9) * 0.05 * roughness + Math.sin(t * 2.3) * 0.02 * roughness
      }
    }
    r.position.set(x, y + 0.2, 0)
    r.rotation.z = tilt
    // A slow roll on the way up, like real rockets turning onto their heading
    r.rotation.y = flying && !destroyed ? smooth(t / 6) * 0.7 : 0
    r.visible = !broken

    // ---- sky and ground ----
    const space = destroyed ? 0 : smooth((t - 1.4) / 3.2)
    if (sky.current) sky.current.uniforms.uSpace.value = space
    if (ground.current) ground.current.visible = space < 0.98
    // Morning haze near the ground; it clears as the rocket leaves the air
    if (fog.current) {
      fog.current.near = 28 + space * 4000
      fog.current.far = 95 + space * 20000
    }

    // ---- main engines ----
    const burnUntil = k0 === 'underpowered' ? CUT_AT : SEPARATION_AT
    // Too heavy: the engines sputter as they strain
    const sputter = k0 === 'underpowered' && t > 1.2 ? Math.random() > 0.35 : true
    burning.current = flying && t < burnUntil && !broken && sputter
    if (flame.current) {
      flame.current.visible = burning.current
      const boost = k0 === 'underpowered' ? 0.7 : 1 + Math.min(t, 3) * 0.25
      flame.current.scale.set(flicker, flicker * boost, flicker)
    }
    if (engineLight.current) engineLight.current.intensity = burning.current ? 25 * flicker : 0

    // ---- explosion (in the air, or on the ground after falling back) ----
    const k = t - boomT
    if (boomAt.current) boomAt.current.position.set(k0 === 'explode' ? 0.3 : impact.x, k0 === 'explode' ? breakupY : 0.6, 0)
    if (boom.current) {
      boom.current.visible = broken
      if (broken) {
        boom.current.children.forEach((o) => {
          const { kind: part, i } = o.userData as { kind: string; i: number }
          const a = i * 2.4
          const spread = part === 'debris' ? 1.6 : part === 'fire' ? 0.9 : 1.2
          const ground = k0 === 'underpowered'
          o.position.set(
            Math.cos(a) * k * spread,
            ground ? Math.abs(Math.sin(a * 1.3)) * k * spread * 0.9 + (part === 'debris' ? -k * k * 0.9 : k * 0.4) : Math.sin(a * 1.3) * k * spread * 0.8 - (part === 'debris' ? k * k * 0.7 : -k * 0.3),
            Math.sin(a) * k * spread * 0.6,
          )
          if (ground && o.position.y < -0.4) o.position.y = -0.4
          if (part === 'debris') o.rotation.set(k * 5 + i, k * 4, 0)
          else {
            const sp = o as Sprite
            const m = sp.material as SpriteMaterial
            sp.scale.setScalar(part === 'fire' ? 0.6 + k * 2.6 : 0.8 + k * 3)
            m.opacity = part === 'fire' ? clamp01(1 - k / 1.2) : clamp01(Math.min(k * 2, 1) * (1 - k / 2.6)) * 0.85
          }
        })
      }
    }
    if (boomLight.current) boomLight.current.intensity = broken ? 60 * clamp01(1 - k / 1.3) : 0

    if (!destroyed) {
      // Stage separation: the first stage falls away
      if (lower.current) {
        const ks = flying ? t - SEPARATION_AT : -1
        lower.current.position.y = ks > 0 ? -ks * ks * 0.9 - ks * 0.6 : 0
        lower.current.rotation.z = ks > 0 ? ks * 0.35 : 0
        lower.current.visible = ks < 3
      }
      if (upperFlame.current) {
        // Wrong orbit: the upper stage burns only briefly (not enough to climb higher)
        const upperEnd = k0 === 'wrong-orbit' ? SEPARATION_AT + 0.6 : FAIRING_AT
        upperFlame.current.visible = flying && t > SEPARATION_AT + 0.3 && t < upperEnd
        upperFlame.current.scale.setScalar(flicker * 0.55)
      }
      // Fairing opens, the spacecraft drifts out and turns
      const open = flying ? smooth((t - FAIRING_AT) / 1.2) : 0
      if (fairingL.current && fairingR.current) {
        fairingL.current.rotation.z = open * 1.3
        fairingR.current.rotation.z = -open * 1.3
        fairingL.current.position.x = -open * 0.7
        fairingR.current.position.x = open * 0.7
      }
      if (craft.current) {
        const out = flying ? smooth((t - FAIRING_AT - 0.5) / 2.4) : 0
        const trouble = flying && (k0 === 'lost-signal' || k0 === 'wrong-orbit') ? Math.max(0, t - TROUBLE_AT) : 0
        craft.current.position.set(trouble * 0.25, upperH * 0.7 + out * 1.9 - (k0 === 'wrong-orbit' ? trouble * 0.35 : 0), 0)
        craft.current.scale.setScalar(look.radius * 0.55 + out * 0.5)
        craft.current.rotation.set(trouble * 1.6, t * 0.8 + trouble * 1.1, trouble * 0.9)
      }
      // Signal lost: a red warning light blinks on the silent spacecraft
      if (beacon.current) {
        const on = flying && k0 === 'lost-signal' && t > TROUBLE_AT && Math.sin(t * 9) > 0
        beacon.current.visible = on
      }
    }

    // ---- Earth below once in space (much closer in the wrong, too-low orbit) ----
    if (earth.current) {
      earth.current.visible = space > 0.3
      const trouble = k0 === 'wrong-orbit' ? clamp01((t - TROUBLE_AT + 2) / 3) : 0
      earth.current.position.set(0, y - 30 + trouble * 9, -6)
    }

    // Camera follows the rocket. The player can hold and drag to orbit around it
    // (OrbitControls); we only move the view along with the rocket and, while
    // they're not dragging, ease it to a distance that fits the scene.
    // Aim a little below the middle, so the rocket sits above the bottom panel
    const mid = top * 0.38
    // Wide for the climb, then move in close to watch the spacecraft come out
    const closeUp = destroyed ? 0 : smooth((t - FAIRING_AT + 0.4) / 2.5)
    const craftY = lowerH + upperH * 0.7 + 1.3
    const focusY =
      k0 === 'explode' ? Math.min(y, climbY(BREAKUP_AT)) + mid : k0 === 'underpowered' ? Math.max(1.6, y + mid * 0.8) : y + mid + closeUp * (craftY - mid)
    const dist = Math.max(7, top * 1.85 + (destroyed ? 0 : smooth(t / 4) * 1.8)) * (1 - closeUp * 0.52) * portrait
    // Rumble: smooth waves (not random jumps), strongest at liftoff and for rough rides
    const rumble = burning.current && t < 3 ? (3 - t) * (0.012 + roughness * 0.035) : 0
    const shake = rumble + (broken && k < 0.6 ? (0.6 - k) * 0.25 : 0)
    focus.set(x * 0.6 + Math.sin(now * 37) * shake, focusY + Math.sin(now * 29 + 1.3) * shake, 0)
    const ctl = controls.current
    if (!placed.current) {
      camera.position.set(dist * 0.5, focusY + 0.5, dist * 0.87)
      ctl?.target.copy(focus)
      placed.current = !!ctl
    }
    if (ctl) {
      offset.copy(camera.position).sub(ctl.target)
      // Frame-rate independent glide to the framing distance
      if (!userDragging.current) offset.setLength(MathUtils.damp(offset.length(), dist, 2.5, delta))
      ctl.target.copy(focus)
      camera.position.copy(focus).add(offset)
      ctl.update()
    } else {
      camera.lookAt(focus)
    }

    if (flying && !finished.current && t > DURATION[k0]) {
      finished.current = true
      onDone()
    }
  })

  return (
    <>
      <color attach="background" args={['#02040c']} />
      {/* Studio reflections are for space; outdoors keep them soft so white paint isn't blown out */}
      <Reflections intensity={0.3} />
      <Sky matRef={sky} />
      <Glow strength={1.1} />
      <Stars radius={100} depth={30} count={1500} factor={4} saturation={0.3} fade speed={0.3} />
      <Sun position={[30, 25, -40]} size={10} />
      <fog ref={fog} attach="fog" args={['#f1cfa6', 28, 95]} />
      <hemisphereLight args={['#bae6fd', '#4d6b2a', 0.75]} />
      <directionalLight
        position={[7, 9, 5]}
        intensity={2.6}
        color="#fff4dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={11}
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
        <group ref={ground}>
          <LaunchSite rocketHeight={top} />
        </group>

        {/* Exhaust: glowing trail and smoke, both left behind in the air */}
        <Plume emitter={nozzle} active={burning} count={40} kind="fire" />
        <Plume emitter={nozzle} active={burning} count={80} kind="smoke" />

        <group ref={rocket} position={[0, 0.2, 0]}>
          {/* First stage */}
          <group ref={lower}>
            <group position={[0, 0.3, 0]}>
              <StageBody look={look} height={lowerH - 0.3} band />
              <GridFins look={look} y={lowerH - 0.6} />
              <EngineCluster radius={look.radius} big={look.radius > 0.25} />
            </group>
            {look.boosters &&
              [-1, 1].map((side) => (
                <group key={side} position={[side * look.radius * 1.6, 0.3, 0]}>
                  <Booster look={look} height={lowerH * 0.7} />
                </group>
              ))}
            <group ref={nozzle} />
            <Flame radius={look.radius * (look.boosters ? 2.2 : 1.1)} flameRef={flame} y={0.06} />
            <pointLight ref={engineLight} position={[0, -0.4, 0]} color="#ff9a3c" distance={9} intensity={0} />
          </group>

          {/* Second stage, with the spacecraft inside the nose fairing */}
          <group position={[0, lowerH, 0]}>
            <StageBody look={look} height={upperH * 0.5} />
            <VacuumEngine radius={look.radius} />
            <Flame radius={look.radius * 0.6} flameRef={upperFlame} y={-0.3} />

            <group ref={craft} position={[0, upperH * 0.7, 0]}>
              <CraftModel design={design} />
              <sprite ref={beacon} position={[0, 1, 0]} scale={1.4} visible={false}>
                <spriteMaterial map={glowTexture()} color={[4, 0.4, 0.4]} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
              </sprite>
            </group>

            {(
              [
                [fairingL, -1],
                [fairingR, 1],
              ] as const
            ).map(([ref, side]) => (
              <group key={side} ref={ref} position={[0, upperH * 0.5, 0]}>
                <FairingHalf look={look} side={side} tube={upperH} />
              </group>
            ))}
          </group>
        </group>
      </group>

      {/* Explosion: in the air, or where the falling rocket hits the ground */}
      <group ref={boomAt}>
        <Explosion boomRef={boom} look={look} />
        <pointLight ref={boomLight} color="#ff8a1f" distance={14} intensity={0} />
      </group>
    </>
  )
}

interface SceneProps {
  rocketId: string
  design: MissionDesign
  /** What happens on this launch (null while waiting on the pad) */
  kind: LaunchKind | null
  /** 0..1 how rough the ride looks; from the chance of success */
  roughness: number
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
