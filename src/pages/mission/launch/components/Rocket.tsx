/**
 * Rocket and launch-site models. Shapes are turned on a lathe (smooth curved
 * nose cones and engine bells) instead of plain cones and boxes, with panel
 * seams, a cable raceway and engine clusters, so they read as real hardware.
 * No Canvas here: LaunchScene places and animates these.
 */

import { useMemo } from 'react'
import { DoubleSide, LatheGeometry, Vector2 } from 'three'
import { concreteTexture, groundTexture } from '../../../../components/space/textures'
import { NOSE_LENGTH, type RocketLook } from './rocketLook'

/** Round parts use this many sides, so silhouettes look smooth */
const SIDES = 48

const PAINT = { metalness: 0.12, roughness: 0.5 }

/* ---------------- lathe shapes ---------------- */

/** A nozzle: narrow throat at the top flaring out to `radius` at the bottom */
function useBell(radius: number, length: number) {
  return useMemo(() => {
    const pts = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11
      return new Vector2(radius * (0.22 + 0.78 * Math.sqrt(t)), -t * length)
    })
    return new LatheGeometry(pts, 24)
  }, [radius, length])
}

/** A smooth pointed nose (parabolic, like real fairings) on a short tube */
function useNose(radius: number, tube: number, nose: number, baseRadius = radius, phiStart = 0, phiLength = Math.PI * 2) {
  return useMemo(() => {
    const pts = [new Vector2(baseRadius, 0), new Vector2(radius, Math.min(tube, 0.16)), new Vector2(radius, tube)]
    for (let i = 1; i <= 14; i++) {
      const t = i / 14
      pts.push(new Vector2(Math.max(0.004, radius * (1 - t * t)), tube + nose * t))
    }
    return new LatheGeometry(pts, SIDES / 2, phiStart, phiLength)
  }, [radius, tube, nose, baseRadius, phiStart, phiLength])
}

/* ---------------- rocket parts ---------------- */

/** A painted stage: tube, panel seams, coloured stripe, dark band and a cable raceway */
export function StageBody({ look, height, band }: { look: RocketLook; height: number; band?: boolean }) {
  const seams = Math.max(1, Math.floor(height / 0.55))
  return (
    <group>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[look.radius, look.radius, height, SIDES]} />
        <meshStandardMaterial color={look.body} {...PAINT} />
      </mesh>
      {/* Panel seams: thin rings where the tank sections are welded */}
      {Array.from({ length: seams }, (_, i) => (
        <mesh key={i} position={[0, ((i + 1) * height) / (seams + 1), 0]}>
          <cylinderGeometry args={[look.radius * 1.004, look.radius * 1.004, 0.012, SIDES]} />
          <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, height * 0.6, 0]}>
        <cylinderGeometry args={[look.radius * 1.006, look.radius * 1.006, height * 0.045, SIDES]} />
        <meshStandardMaterial color={look.stripe} metalness={0.2} roughness={0.45} />
      </mesh>
      {band && (
        <mesh position={[0, height - 0.13, 0]}>
          <cylinderGeometry args={[look.radius * 1.012, look.radius * 1.012, 0.26, SIDES]} />
          <meshStandardMaterial color={look.band} metalness={0.35} roughness={0.55} />
        </mesh>
      )}
      {/* Cable raceway down the side */}
      <mesh position={[0, height * 0.48, look.radius + 0.012]}>
        <boxGeometry args={[0.05, height * 0.86, 0.03]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Engine bells under a stage: one in the middle and a ring around it */
export function EngineCluster({ radius, big }: { radius: number; big: boolean }) {
  const ring = big ? 8 : 4
  const bellR = radius * (big ? 0.19 : 0.26)
  const bell = useBell(bellR, 0.26)
  const spots: [number, number][] = [[0, 0]]
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2
    spots.push([Math.cos(a) * radius * 0.66, Math.sin(a) * radius * 0.66])
  }
  return (
    <group>
      {/* Thrust plate the engines hang from */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[radius * 0.98, radius * 0.9, 0.08, SIDES]} />
        <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.45} />
      </mesh>
      {spots.map(([x, z], i) => (
        <mesh key={i} geometry={bell} position={[x, 0, z]}>
          <meshStandardMaterial color="#52525b" metalness={0.95} roughness={0.28} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/** The single wide nozzle of an upper stage (built for the vacuum of space) */
export function VacuumEngine({ radius }: { radius: number }) {
  const bell = useBell(radius * 0.62, 0.34)
  return (
    <mesh geometry={bell}>
      <meshStandardMaterial color="#3f3f46" metalness={0.95} roughness={0.3} side={DoubleSide} />
    </mesh>
  )
}

/** A strap-on booster with its own pointed nose and nozzle */
export function Booster({ look, height }: { look: RocketLook; height: number }) {
  const r = look.radius * 0.55
  const nose = useNose(r, 0, r * 2.6)
  const bell = useBell(r * 0.7, 0.22)
  return (
    <group>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[r, r, height, SIDES / 2]} />
        <meshStandardMaterial color={look.boosterColor} {...PAINT} />
      </mesh>
      <mesh geometry={nose} position={[0, height, 0]}>
        <meshStandardMaterial color={look.boosterColor} {...PAINT} />
      </mesh>
      <mesh position={[0, height * 0.5, 0]}>
        <cylinderGeometry args={[r * 1.01, r * 1.01, height * 0.05, SIDES / 2]} />
        <meshStandardMaterial color={look.stripe} metalness={0.2} roughness={0.45} />
      </mesh>
      <mesh geometry={bell}>
        <meshStandardMaterial color="#52525b" metalness={0.95} roughness={0.28} side={DoubleSide} />
      </mesh>
    </group>
  )
}

/**
 * One half of the nose fairing (the shell around the spacecraft). `side` 1 is
 * the +x half. The origin is the hinge line at the bottom, so rotating the
 * group around z swings the half open.
 */
export function FairingHalf({ look, side, tube }: { look: RocketLook; side: 1 | -1; tube: number }) {
  const geom = useNose(look.radius * 1.16, tube, look.radius * NOSE_LENGTH, look.radius, side === 1 ? 0 : Math.PI, Math.PI)
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color="#f8fafc" metalness={0.1} roughness={0.42} side={DoubleSide} />
    </mesh>
  )
}

/** Four steering fins near the top of the first stage */
export function GridFins({ look, y }: { look: RocketLook; y: number }) {
  return (
    <group position={[0, y, 0]}>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4
        return (
          <mesh key={i} position={[Math.cos(a) * (look.radius + 0.07), 0, Math.sin(a) * (look.radius + 0.07)]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.14, 0.16, 0.025]} />
            <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.35} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ---------------- launch site ---------------- */

function Tower({ height }: { height: number }) {
  const levels = Math.round(height / 0.45)
  const steel = <meshStandardMaterial color="#b91c1c" metalness={0.55} roughness={0.45} />
  const rail = <meshStandardMaterial color="#e2e8f0" metalness={0.55} roughness={0.45} />
  return (
    <group position={[-1.25, 0.2, 0]}>
      {[
        [-0.17, -0.17],
        [0.17, -0.17],
        [-0.17, 0.17],
        [0.17, 0.17],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, height / 2, z]}>
          <boxGeometry args={[0.045, height, 0.045]} />
          {steel}
        </mesh>
      ))}
      {Array.from({ length: levels }, (_, i) => (
        <group key={i} position={[0, 0.3 + i * 0.45, 0]}>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[k < 2 ? 0 : k === 2 ? -0.17 : 0.17, 0, k === 0 ? -0.17 : k === 1 ? 0.17 : 0]} rotation={[0, k < 2 ? 0 : Math.PI / 2, 0]}>
              <boxGeometry args={[0.36, 0.025, 0.025]} />
              {rail}
            </mesh>
          ))}
          {/* Diagonal brace, alternating direction */}
          <mesh position={[0, 0.22, 0.17]} rotation={[0, 0, i % 2 ? 0.92 : -0.92]}>
            <boxGeometry args={[0.56, 0.02, 0.02]} />
            {steel}
          </mesh>
        </group>
      ))}
      {/* Access arm and the fuel line to the rocket */}
      <mesh position={[0.55, height * 0.8, 0]}>
        <boxGeometry args={[0.85, 0.09, 0.14]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.5, height * 0.42, 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.8, 8]} />
        <meshStandardMaterial color="#facc15" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, height + 0.08, 0]}>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshBasicMaterial color={[3, 0.5, 0.5]} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Ground, pad, tower, masts and a few buildings for scale */
export function LaunchSite({ rocketHeight }: { rocketHeight: number }) {
  const white = <meshStandardMaterial color="#e5e7eb" metalness={0.1} roughness={0.6} />
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial map={groundTexture()} roughness={1} />
      </mesh>

      {/* Concrete pad with a painted safety ring and a scorched flame trench */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[2.7, 2.9, 0.2, 8]} />
        <meshStandardMaterial map={concreteTexture()} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.205, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.62, 48]} />
        <meshStandardMaterial color="#facc15" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.02, 4.2]}>
        <boxGeometry args={[1.4, 0.03, 4]} />
        <meshStandardMaterial color="#27272a" roughness={1} />
      </mesh>
      {/* Road to the hangar */}
      <mesh position={[-7, 0.015, -3.5]} rotation={[0, -0.46, 0]}>
        <boxGeometry args={[12, 0.02, 1]} />
        <meshStandardMaterial color="#52525b" roughness={1} />
      </mesh>

      <Tower height={rocketHeight * 1.12} />

      {/* Lightning masts */}
      {[
        [3.4, -2.2],
        [-3.2, -2.8],
        [2.8, 3.2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, rocketHeight * 0.75, z]}>
          <cylinderGeometry args={[0.015, 0.05, rocketHeight * 1.5, 8]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      {/* Hangar */}
      <group position={[-13, 0, -6.5]} rotation={[0, -0.46, 0]}>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[4, 1.8, 2.6]} />
          {white}
        </mesh>
        <mesh position={[0, 1.86, 0]}>
          <boxGeometry args={[4.2, 0.12, 2.8]} />
          <meshStandardMaterial color="#334155" metalness={0.3} roughness={0.6} />
        </mesh>
        <mesh position={[2.01, 0.7, 0]}>
          <boxGeometry args={[0.02, 1.4, 1.6]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>
      </group>

      {/* Propellant tanks */}
      {[
        [6.5, -5.5],
        [8.4, -5.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.95, 0]}>
            <sphereGeometry args={[0.75, 24, 16]} />
            {white}
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.3, 0.45, 0.5, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      ))}
      <mesh position={[7.4, 0.45, -3.4]} rotation={[0, 0.3, Math.PI / 2]}>
        <capsuleGeometry args={[0.38, 1.6, 6, 16]} />
        {white}
      </mesh>

      {/* Water tower (it floods the pad at liftoff to soften the noise) */}
      <group position={[-5.5, 0, 5]}>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.07, 0.1, 2.2, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.5, 0]}>
          <sphereGeometry args={[0.6, 24, 16]} />
          {white}
        </mesh>
      </group>
    </group>
  )
}
