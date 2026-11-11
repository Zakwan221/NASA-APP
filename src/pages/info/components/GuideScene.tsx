/**
 * 3D for the "How to play" guide, driven by scroll. `step` is the panel the
 * reader is on (fractional while scrolling between panels):
 *   0     the whole spacecraft, turning
 *   1     it comes apart into its 7 parts
 *   2–8   one part at a time lights up (the others fade back)
 *   9     back together: the six things to balance
 *   10    it shrinks into orbit around Earth, with orbit rings
 *   11    a rocket climbs past
 *   12    flying month by month
 *   13+   back to the spacecraft for the score and "start"
 */

import { Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  AdditiveBlending,
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  MathUtils,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type Sprite,
  type SpriteMaterial,
} from 'three'
import ErrorBoundary from '../../../components/ui/ErrorBoundary'
import CraftModel, { type CraftPart } from '../../../components/space/CraftModel'
import Glow from '../../../components/space/Glow'
import { RocketModel } from '../../../components/space/Rocket'
import { ROCKET_LOOK } from '../../../components/space/rocketLook'
import { Earth, Reflections, Sun } from '../../../components/space/SpaceBackdrop'
import { glowTexture } from '../../../components/space/textures'
import { useOnScreen } from '../../../components/space/useOnScreen'
import type { MissionDesign } from '../../../game/types'
import { GUIDE_PARTS } from '../guideContent'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const ramp = (x: number, from: number, to: number) => {
  const u = clamp01((x - from) / (to - from))
  return u * u * (3 - 2 * u)
}

/** A complete, sensible spacecraft to take apart */
const SHOWCASE: MissionDesign = {
  planner: { scenarioId: 'earth-watch', difficulty: 'engineer', targetLifetimeMonths: 12, targetCoverage: 0.5 },
  engineer: { structureId: 'frame-12u', solarId: 'solar-deploy', batteryId: 'battery-80', computerId: 'obc', attitudeId: 'wheels' },
  science: { instrumentIds: ['camera', 'spectro'] },
  comms: { radioId: 'xband', orbitId: 'sso', launchVehicleId: 'rideshare-leo' },
}

/** Where each part drifts to when the spacecraft comes apart */
const EXPLODE: Record<CraftPart, [number, number, number]> = {
  frame: [0, 0, 0],
  solar: [0, 0, -1.5],
  battery: [0, -0.9, -1.3],
  computer: [0.7, 1.4, 0.2],
  attitude: [0, -0.3, 1.5],
  radio: [-0.7, 1.9, 0],
  instruments: [0, -1.9, 0.5],
}

const ORBIT_RINGS = [
  { r: 1.75, tilt: 0.25, color: '#67e8f9' },
  { r: 2.05, tilt: 1.45, color: '#a78bfa' },
  { r: 3.6, tilt: 0.05, color: '#fbbf24' },
]

/** Fades every material in a group (only when the value really changes) */
function setOpacity(g: Group, value: number) {
  g.traverse((o) => {
    const mat = (o as Mesh).material as Material | Material[] | undefined
    if (!mat) return
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      const base = (m.userData.baseOpacity as number | undefined) ?? (m.userData.baseOpacity = m.opacity)
      const transparent = value < 0.999 || base < 1
      // Switching transparency needs the material rebuilt, or the fade won't show
      if (m.transparent !== transparent) {
        m.transparent = transparent
        m.needsUpdate = true
      }
      m.opacity = base * value
      m.depthWrite = value > 0.6
    }
  })
}

function Ring({ r, tilt, color, matRef }: { r: number; tilt: number; color: string; matRef: (m: LineBasicMaterial | null) => void }) {
  const geometry = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      pts.push(Math.cos(a) * r, 0, Math.sin(a) * r)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pts, 3))
    return g
  }, [r])
  const line = useMemo(() => {
    const l = new Line(geometry, new LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }))
    l.rotation.x = tilt
    return l
  }, [geometry, color, tilt])
  // Hand the material to the scene, which fades it in and out
  useEffect(() => {
    matRef(line.material as LineBasicMaterial)
    return () => matRef(null)
  }, [line, matRef])
  return <primitive object={line} />
}

function Scene({ step }: { step: RefObject<number> }) {
  const { camera, size } = useThree()
  const craft = useRef<Group>(null)
  const parts = useRef<(Group | null)[]>([])
  const halo = useRef<Sprite>(null)
  const earth = useRef<Group>(null)
  const rocket = useRef<Group>(null)
  const flame = useRef<Sprite>(null)
  const rings = useRef<(LineBasicMaterial | null)[]>([])
  const sim = useRef({ s: 0, spin: 0, orbit: 0, opacity: GUIDE_PARTS.map(() => 1) })
  const v = useMemo(
    () => ({ look: new Vector3(), pos: new Vector3(), tmp: new Vector3(), focus: new Vector3(), size: new Vector3(), box: new Box3(), view: new Vector3(0.55, 0.4, 1).normalize() }),
    [],
  )

  const aspect = size.width / size.height
  const wide = aspect > 1.1
  // Phones are narrow: stand further back
  const fit = aspect < 1 ? MathUtils.clamp(1 / aspect, 1, 2) * 0.8 + 0.2 : 1

  useFrame(({ clock }, delta) => {
    const S = sim.current
    const dt = Math.min(delta, 0.05)
    S.s = MathUtils.damp(S.s, step.current ?? 0, 3, dt)
    const s = S.s
    const t = clock.getElapsedTime()

    // ---- what is happening ----
    const apart = ramp(s, 0.5, 1.3) * (1 - ramp(s, 8.5, 9.2))
    const focusing = ramp(s, 1.5, 2) * (1 - ramp(s, 8.4, 8.9))
    const inOrbit = ramp(s, 9.4, 10.2) * (1 - ramp(s, 12.4, 13.2))
    const rocketShow = ramp(s, 10.4, 10.9) * (1 - ramp(s, 11.6, 12.1))

    // ---- the spacecraft ----
    S.spin += dt * 0.35 * (1 - focusing)
    // While a part is explained, turn the spacecraft to face the reader (cells, lenses and dish in view)
    if (focusing > 0) {
      const facing = Math.round(S.spin / (Math.PI * 2)) * Math.PI * 2 + 0.3
      S.spin = MathUtils.damp(S.spin, facing, 2.5 * focusing, dt)
    }
    S.orbit += dt * 0.45 * inOrbit
    const c = craft.current
    if (c) {
      const scale = MathUtils.lerp(1, 0.16, inOrbit)
      c.scale.setScalar(scale)
      v.tmp.set(Math.cos(S.orbit) * 2.05, Math.sin(S.orbit) * 0.5, Math.sin(S.orbit) * 2.05).multiplyScalar(inOrbit)
      c.position.copy(v.tmp)
      c.rotation.set(0.15, S.spin, 0)
    }

    let focusIndex = -1
    let best = 0
    GUIDE_PARTS.forEach((gp, i) => {
      const g = parts.current[i]
      if (!g) return
      const weight = 1 - clamp01(Math.abs(s - (i + 2)) * 1.6)
      if (weight > best) {
        best = weight
        focusIndex = i
      }
      const [x, y, z] = EXPLODE[gp.part]
      g.position.set(x * apart, y * apart, z * apart)
      g.scale.setScalar(1 + 0.18 * weight * focusing)
      const want = MathUtils.lerp(1, 0.06 + 0.94 * weight, focusing)
      if (Math.abs(want - S.opacity[i]) > 0.01) {
        S.opacity[i] = want
        setOpacity(g, want)
      }
    })

    // A soft light behind the part being explained
    const focused = focusIndex >= 0 ? parts.current[focusIndex] : null
    if (halo.current) {
      const m = halo.current.material as SpriteMaterial
      m.opacity = focused ? best * focusing * 0.55 : 0
      if (focused) {
        // Measure the part itself (its group origin can sit between, say, two solar wings)
        v.box.setFromObject(focused)
        v.box.getCenter(v.focus)
        v.box.getSize(v.size)
        // Glow sits just behind the part, so it lights it from behind without washing it out
        const glowSize = Math.max(1.2, v.size.length() * 1.4)
        halo.current.position.copy(v.focus).addScaledVector(v.tmp.copy(v.focus).sub(camera.position).normalize(), glowSize * 0.4)
        halo.current.scale.setScalar(glowSize)
      }
    }

    // ---- Earth, orbits, rocket ----
    if (earth.current) {
      earth.current.scale.setScalar(Math.max(0.0001, inOrbit))
      earth.current.visible = inOrbit > 0.01
    }
    const ringFade = ramp(s, 9.8, 10.4) * (1 - ramp(s, 11, 11.6))
    rings.current.forEach((m) => m && (m.opacity = ringFade * 0.75))
    if (rocket.current) {
      rocket.current.visible = rocketShow > 0.01
      rocket.current.position.set(-2.9, -4 + ramp(s, 10.5, 11.8) * 7.5, -0.5)
      rocket.current.scale.setScalar(0.55 * rocketShow + 0.0001)
    }
    if (flame.current) flame.current.scale.setScalar((0.9 + Math.sin(t * 40) * 0.08) * 1.6 * rocketShow + 0.0001)

    // ---- camera ----
    // Close on the whole spacecraft; closer on the part being explained; wide for Earth
    // Whole spacecraft (further back when it is in pieces), the part being explained
    // (framed by its real size, from the front-right), or wide for Earth
    v.look.set(0, 0, 0)
    v.pos.set(1.3, 0.9, 5.3 + apart * 3.2).multiplyScalar(fit)
    let dist = v.pos.length()
    if (focused && focusing > 0) {
      const partDist = Math.max(1.6, (v.size.length() / 2 / Math.sin((40 * Math.PI) / 360)) * 1.15) * fit
      v.look.lerp(v.focus, focusing)
      v.pos.lerp(v.tmp.copy(v.focus).addScaledVector(v.view, partDist), focusing)
      dist = MathUtils.lerp(dist, partDist, focusing)
    }
    v.look.lerp(v.tmp.set(0, 0, 0), inOrbit)
    v.pos.lerp(v.tmp.set(0.6, 3, 9).multiplyScalar(fit), inOrbit)
    dist = MathUtils.lerp(dist, 9.5 * fit, inOrbit)
    // Leave room for the text: on wide screens the model sits right, on phones above.
    // The shift grows with distance so it looks the same close up and far away.
    const shift = dist * 0.27
    if (wide) {
      v.look.setX(v.look.x - shift)
      v.pos.setX(v.pos.x - shift)
    } else {
      // Centre it in the space between the menu bar and the text card
      v.look.setY(v.look.y - shift * 0.62)
      v.pos.setY(v.pos.y - shift * 0.62)
    }
    camera.position.lerp(v.pos, 1 - Math.exp(-dt * 4))
    camera.lookAt(v.look)
  })

  return (
    <>
      <color attach="background" args={['#020309']} />
      <Reflections intensity={0.35} />
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 3, 4]} intensity={2.8} color="#fff4dc" />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#60a5fa" />
      <Stars radius={80} depth={40} count={2500} factor={3} saturation={0.4} fade speed={0.3} />
      <Sun position={[18, 9, -26]} size={8} />
      <Glow strength={0.8} />

      <sprite ref={halo} scale={2.4}>
        <spriteMaterial map={glowTexture()} color={[0.4, 1.6, 2.2]} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>

      <group ref={craft}>
        {GUIDE_PARTS.map((gp, i) => (
          <group
            key={gp.part}
            ref={(g) => {
              parts.current[i] = g
            }}
          >
            <CraftModel design={SHOWCASE} only={gp.part} instant />
          </group>
        ))}
      </group>

      <group ref={earth} visible={false}>
        <Earth radius={1.4} position={[0, 0, 0]} spin={0.04} />
        {ORBIT_RINGS.map((r, i) => (
          <Ring
            key={i}
            {...r}
            matRef={(m) => {
              rings.current[i] = m
            }}
          />
        ))}
      </group>

      <group ref={rocket} visible={false}>
        <RocketModel look={ROCKET_LOOK['rideshare-leo']} />
        <sprite ref={flame} position={[0, -0.25, 0]}>
          <spriteMaterial map={glowTexture()} color={[3, 1.5, 0.4]} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      </group>
    </>
  )
}

export default function GuideScene({ step }: { step: RefObject<number> }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(wrapper)
  return (
    <div ref={wrapper} className="absolute inset-0">
      <ErrorBoundary fallback={null}>
        <Canvas
          dpr={[1, 1.5]}
          frameloop={visible ? 'always' : 'never'}
          camera={{ position: [1.2, 0.8, 5.3], fov: 40, near: 0.05, far: 300 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <Scene step={step} />
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}
