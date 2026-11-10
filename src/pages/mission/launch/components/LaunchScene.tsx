/**
 * 3D launch: rocket on the pad → liftoff → (stage separation, fairing opens,
 * spacecraft deploys) or (rocket fails and explodes). Low-poly, lazy-loaded,
 * stops rendering when off-screen.
 */

import { Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Color, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import ErrorBoundary from '../../../../components/ui/ErrorBoundary'
import type { MissionDesign } from '../../../../game/types'
import CraftModel from '../../design/components/CraftModel'
import { useOnScreen } from '../../design/components/useOnScreen'

export type FlightTone = 'good' | 'bad' | 'fail'

interface RocketLook {
  height: number
  radius: number
  color: string
  boosters: boolean
  boosterColor: string
}

const LOOK: Record<string, RocketLook> = {
  'small-launcher': { height: 2.6, radius: 0.18, color: '#1f2937', boosters: false, boosterColor: '#1f2937' },
  'rideshare-leo': { height: 4, radius: 0.28, color: '#f3f4f6', boosters: false, boosterColor: '#f3f4f6' },
  'rideshare-geo': { height: 4, radius: 0.28, color: '#f3f4f6', boosters: false, boosterColor: '#f3f4f6' },
  'medium-launcher': { height: 4.2, radius: 0.3, color: '#f3f4f6', boosters: true, boosterColor: '#e5e7eb' },
  'deep-rideshare': { height: 4.6, radius: 0.32, color: '#d97706', boosters: true, boosterColor: '#f3f4f6' },
}

const SKY_DAY = new Color('#7dd3fc')
const SKY_SPACE = new Color('#050816')

/** How long each ending plays before onDone (seconds) */
const DURATION: Record<FlightTone, number> = { good: 7.5, bad: 7.5, fail: 4.6 }
const SEPARATION_AT = 3.4
const FAIRING_AT = 4.4
const BREAKUP_AT = 2.7

const ease = (t: number) => t * t
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function Flame({ radius, flameRef }: { radius: number; flameRef: React.RefObject<Mesh | null> }) {
  return (
    <mesh ref={flameRef} position={[0, -0.45, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
      <coneGeometry args={[radius * 0.9, 0.9, 12]} />
      <meshBasicMaterial color="#fb923c" transparent opacity={0.9} />
    </mesh>
  )
}

function Scene({ rocketId, design, tone, flying, onDone }: SceneProps) {
  const look = LOOK[rocketId] ?? LOOK['rideshare-leo']
  const lowerH = look.height * 0.7
  const upperH = look.height * 0.3

  const rocket = useRef<Group>(null)
  const lower = useRef<Group>(null)
  const upper = useRef<Group>(null)
  const fairingL = useRef<Group>(null)
  const fairingR = useRef<Group>(null)
  const craft = useRef<Group>(null)
  const flame = useRef<Mesh>(null)
  const upperFlame = useRef<Mesh>(null)
  const boom = useRef<Mesh>(null)
  const debris = useRef<Group>(null)
  const smoke = useRef<Group>(null)
  const earth = useRef<Mesh>(null)
  const startedAt = useRef<number | null>(null)
  const finished = useRef(false)
  const sky = useRef<Color>(null)
  const { camera, clock } = useThree()

  useEffect(() => {
    startedAt.current = flying ? clock.getElapsedTime() : null
    finished.current = false
  }, [flying, clock])

  useFrame(({ clock: c }) => {
    const t = startedAt.current === null ? 0 : Math.min(DURATION[tone] + 0.1, c.getElapsedTime() - startedAt.current)
    const flicker = 0.85 + Math.random() * 0.3
    const r = rocket.current
    if (!r) return

    // Climb: speeds up like a real rocket
    const y = flying ? ease(t) * 0.42 : 0
    r.position.y = y

    // Sky turns black as the rocket leaves the atmosphere
    const space = clamp01((t - 1.4) / 3)
    sky.current?.copy(SKY_DAY).lerp(SKY_SPACE, tone === 'fail' ? 0 : space)

    // Engine flame and pad smoke
    if (flame.current) {
      flame.current.visible = flying && t < SEPARATION_AT && !(tone === 'fail' && t > BREAKUP_AT)
      flame.current.scale.set(flicker, flicker * (1 + t * 0.15), flicker)
    }
    if (smoke.current) {
      smoke.current.visible = flying && t < 3
      smoke.current.children.forEach((m, i) => {
        const s = 0.4 + t * (0.6 + i * 0.1)
        m.scale.setScalar(s)
        m.position.y = -y + 0.2
      })
    }

    if (tone === 'fail') {
      // Tilt, then break apart
      r.rotation.z = flying && t > BREAKUP_AT - 0.6 ? (t - (BREAKUP_AT - 0.6)) * 0.6 : 0
      const broken = flying && t > BREAKUP_AT
      if (lower.current) lower.current.visible = !broken
      if (upper.current) upper.current.visible = !broken
      if (boom.current) {
        boom.current.visible = broken
        const k = t - BREAKUP_AT
        boom.current.scale.setScalar(0.3 + k * 2.2)
        ;(boom.current.material as MeshBasicMaterial).opacity = clamp01(1 - k / 1.6)
      }
      if (debris.current) {
        debris.current.visible = broken
        debris.current.children.forEach((d, i) => {
          const k = t - BREAKUP_AT
          const a = (i / debris.current!.children.length) * Math.PI * 2
          d.position.set(Math.cos(a) * k * 1.4, Math.sin(a) * k * 1.2 - k * k * 0.6, Math.sin(a * 2) * k)
          d.rotation.set(k * 4 + i, k * 3, 0)
        })
      }
    } else {
      // Stage separation: the lower stage falls away
      if (lower.current) {
        const k = flying ? t - SEPARATION_AT : -1
        lower.current.position.y = k > 0 ? -k * k * 0.9 - k * 0.6 : 0
        lower.current.rotation.z = k > 0 ? k * 0.35 : 0
        lower.current.visible = k < 3
      }
      if (upperFlame.current) {
        upperFlame.current.visible = flying && t > SEPARATION_AT + 0.3 && t < FAIRING_AT
        upperFlame.current.scale.setScalar(flicker * 0.6)
      }
      // Fairing opens, spacecraft drifts out and turns
      const open = flying ? clamp01((t - FAIRING_AT) / 0.9) : 0
      if (fairingL.current && fairingR.current) {
        fairingL.current.rotation.z = open * 1.2
        fairingR.current.rotation.z = -open * 1.2
        fairingL.current.position.x = -open * 0.6
        fairingR.current.position.x = open * 0.6
      }
      if (craft.current) {
        const out = flying ? clamp01((t - FAIRING_AT - 0.5) / 2) : 0
        craft.current.position.y = upperH * 0.55 + out * 1.6
        craft.current.scale.setScalar(look.radius * 0.6 + out * 0.35)
        craft.current.rotation.y = t * 0.8
      }
    }

    // Earth appears below once in space
    if (earth.current) {
      earth.current.visible = tone !== 'fail' && space > 0.5
      earth.current.position.y = y - 31
    }

    // Camera follows the rocket (or the explosion)
    const focusY = tone === 'fail' ? Math.min(y, ease(BREAKUP_AT) * 0.42) + 1 : y + look.height * 0.6
    const dist = 6 + clamp01(t / 4) * 1.5
    camera.position.set(dist * 0.45, focusY + 0.6, dist)
    camera.lookAt(0, focusY, 0)

    if (flying && !finished.current && t > DURATION[tone]) {
      finished.current = true
      onDone()
    }
  })

  return (
    <>
      <color ref={sky} attach="background" args={['#7dd3fc']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 4]} intensity={2} />
      <Stars radius={60} depth={30} count={800} factor={3} fade speed={0.4} />

      {/* Ground and launch pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[30, 24]} />
        <meshStandardMaterial color="#3f6212" />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.4, 0.2, 2.4]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
      <mesh position={[-1.1, look.height * 0.55, 0]}>
        <boxGeometry args={[0.25, look.height * 1.1, 0.25]} />
        <meshStandardMaterial color="#b91c1c" metalness={0.4} />
      </mesh>

      <group ref={smoke} visible={false}>
        {[-0.8, 0, 0.8, -0.4, 0.4].map((x, i) => (
          <mesh key={i} position={[x, 0.2, (i % 2) * 0.5 - 0.25]}>
            <sphereGeometry args={[0.5, 8, 6]} />
            <meshStandardMaterial color="#d1d5db" transparent opacity={0.65} />
          </mesh>
        ))}
      </group>

      <mesh ref={earth} visible={false}>
        <sphereGeometry args={[30, 48, 24]} />
        <meshStandardMaterial color="#1d4ed8" emissive="#0c4a6e" emissiveIntensity={0.4} />
      </mesh>

      {/* Rocket */}
      <group ref={rocket} position={[0, 0.2, 0]}>
        <group ref={lower}>
          <mesh position={[0, lowerH / 2, 0]}>
            <cylinderGeometry args={[look.radius, look.radius, lowerH, 16]} />
            <meshStandardMaterial color={look.color} metalness={0.3} roughness={0.5} />
          </mesh>
          {look.boosters &&
            [-1, 1].map((s) => (
              <group key={s} position={[s * (look.radius * 1.7), 0, 0]}>
                <mesh position={[0, lowerH * 0.4, 0]}>
                  <cylinderGeometry args={[look.radius * 0.55, look.radius * 0.55, lowerH * 0.8, 12]} />
                  <meshStandardMaterial color={look.boosterColor} />
                </mesh>
                <mesh position={[0, lowerH * 0.8 + 0.15, 0]}>
                  <coneGeometry args={[look.radius * 0.55, 0.3, 12]} />
                  <meshStandardMaterial color={look.boosterColor} />
                </mesh>
              </group>
            ))}
          <Flame radius={look.radius * (look.boosters ? 2.2 : 1)} flameRef={flame} />
        </group>

        <group ref={upper} position={[0, lowerH, 0]}>
          <mesh position={[0, upperH * 0.25, 0]}>
            <cylinderGeometry args={[look.radius, look.radius, upperH * 0.5, 16]} />
            <meshStandardMaterial color={look.color} metalness={0.3} roughness={0.5} />
          </mesh>
          <mesh ref={upperFlame} position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
            <coneGeometry args={[look.radius * 0.6, 0.5, 10]} />
            <meshBasicMaterial color="#fdba74" transparent opacity={0.85} />
          </mesh>

          {/* The spacecraft inside the fairing */}
          <group ref={craft} position={[0, upperH * 0.55, 0]}>
            <CraftModel design={design} />
          </group>

          {/* Fairing halves (hinged at the bottom) */}
          {[
            [fairingL, -1],
            [fairingR, 1],
          ].map(([ref, side]) => (
            <group key={side as number} ref={ref as React.RefObject<Group>} position={[0, upperH * 0.5, 0]}>
              <mesh position={[(side as number) * look.radius * 0.5, upperH * 0.5, 0]} scale={[0.5, 1, 1]}>
                <cylinderGeometry args={[look.radius * 1.15, look.radius * 1.15, upperH, 16, 1, false, side === 1 ? 0 : Math.PI, Math.PI]} />
                <meshStandardMaterial color="#f9fafb" />
              </mesh>
              <mesh position={[(side as number) * look.radius * 0.5, upperH + 0.25, 0]} scale={[0.5, 1, 1]}>
                <coneGeometry args={[look.radius * 1.15, 0.5, 16, 1, false, side === 1 ? 0 : Math.PI, Math.PI]} />
                <meshStandardMaterial color="#f9fafb" />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* Explosion */}
      <group position={[0, ease(BREAKUP_AT) * 0.42 + look.height * 0.6, 0]}>
        <mesh ref={boom} visible={false}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial color="#f97316" transparent opacity={1} />
        </mesh>
        <group ref={debris} visible={false}>
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={i}>
              <boxGeometry args={[0.15, 0.08, 0.12]} />
              <meshStandardMaterial color={i % 3 ? '#9ca3af' : look.color} />
            </mesh>
          ))}
        </group>
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
        <Canvas dpr={[1, 1.5]} frameloop={visible ? 'always' : 'never'} camera={{ position: [3, 3, 7], fov: 45 }} gl={{ powerPreference: 'low-power' }}>
          <Scene {...props} />
        </Canvas>
      </ErrorBoundary>
    </div>
  )
}
