/**
 * Low-poly 3D spacecraft built from the design. No Canvas here, so both the
 * Design viewer and the Launch scene can use it.
 * Every part pops in when it is added, so players see their choice land.
 */

import { Edges, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import { DoubleSide, LatheGeometry, Vector2, type Group, type Texture } from 'three'
import type { MissionDesign } from '../../game/types'
import { foilTexture, solarTexture } from './textures'
import { useShadows } from './useShadows'

/** Body size per frame [x, y, z]: 1U is a 10 cm cube, drawn here as 0.4 */
const FRAME_SIZE: Record<string, [number, number, number]> = {
  'frame-3u': [0.4, 1.2, 0.4],
  'frame-6u': [0.8, 1.2, 0.4],
  'frame-12u': [0.8, 1.2, 0.8],
  'bus-micro': [1.4, 1.4, 1.4],
}

const COLORS = {
  foil: '#d4a72c',
  rail: '#9ca3af',
  cell: '#1e3a8a',
  cellEdge: '#60a5fa',
  white: '#e5e7eb',
  dark: '#111827',
  copper: '#b87333',
  battery: '#34d399',
  led: '#22d3ee',
}

/** True when parts should appear at full size straight away (pictures, the guide) */
const InstantContext = createContext(false)

/** Scales its children from 0 to 1 when mounted (re-mounts when `key` changes) */
function PopIn({ children, position }: { children: ReactNode; position?: [number, number, number] }) {
  const instant = useContext(InstantContext)
  const ref = useRef<Group>(null)
  useFrame((_, delta) => {
    const g = ref.current
    if (!g || g.scale.x >= 0.999) return
    const s = Math.min(1, g.scale.x + (1 - g.scale.x) * Math.min(1, delta * 9) + 0.002)
    g.scale.setScalar(s)
  })
  return (
    <group ref={ref} position={position} scale={instant ? 1 : 0.001}>
      {children}
    </group>
  )
}

function Box({
  size,
  position,
  color,
  emissive,
  metal = 0.3,
  rough = 0.45,
  map,
  edges,
  glow,
}: {
  size: [number, number, number]
  position?: [number, number, number]
  color: string
  emissive?: string
  metal?: number
  rough?: number
  map?: Texture
  edges?: string
  /** Emissive strength; above ~1.5 it blooms */
  glow?: number
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        map={map}
        metalness={metal}
        roughness={rough}
        emissive={emissive ?? '#000'}
        emissiveIntensity={emissive ? (glow ?? 0.8) : 0}
      />
      {edges && <Edges color={edges} />}
    </mesh>
  )
}

function Rod({ from, length, axis, color, radius = 0.02 }: { from: [number, number, number]; length: number; axis: 'x' | 'y' | 'z'; color: string; radius?: number }) {
  const rot: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
  const pos: [number, number, number] = [
    from[0] + (axis === 'x' ? length / 2 : 0),
    from[1] + (axis === 'y' ? length / 2 : 0),
    from[2] + (axis === 'z' ? length / 2 : 0),
  ]
  return (
    <mesh position={pos} rotation={rot}>
      <cylinderGeometry args={[radius, radius, Math.abs(length), 6]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
    </mesh>
  )
}

function Dish({ radius, position }: { radius: number; position: [number, number, number] }) {
  // A shallow parabola turned on a lathe, like a real antenna reflector
  const bowl = useMemo(() => {
    const pts = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11
      return new Vector2(Math.max(0.002, radius * t), radius * 0.38 * t * t)
    })
    return new LatheGeometry(pts, 40)
  }, [radius])
  const mast = radius * 0.35
  return (
    <group position={position}>
      <Rod from={[0, 0, 0]} length={mast} axis="y" color={COLORS.rail} radius={radius * 0.05} />
      <group position={[0, mast, 0]}>
        <mesh geometry={bowl}>
          <meshStandardMaterial color={COLORS.white} side={DoubleSide} metalness={0.35} roughness={0.35} />
        </mesh>
        {/* Feed horn at the focus, held by three struts */}
        <mesh position={[0, radius * 0.62, 0]}>
          <cylinderGeometry args={[radius * 0.07, radius * 0.1, radius * 0.14, 12]} />
          <meshStandardMaterial color={COLORS.dark} metalness={0.7} roughness={0.35} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2
          const reach = radius * 0.8
          return (
            <mesh
              key={i}
              position={[(Math.cos(a) * reach) / 2, radius * 0.44, (Math.sin(a) * reach) / 2]}
              rotation={[0, -a, Math.atan2(radius * 0.38, reach) + Math.PI / 2 - 0.25]}
            >
              <cylinderGeometry args={[radius * 0.012, radius * 0.012, reach * 1.02, 6]} />
              <meshStandardMaterial color={COLORS.rail} metalness={0.7} roughness={0.4} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

/** A solar wing made of a few panel segments, sticking out along x */
function Wing({ side, length, height, y }: { side: 1 | -1; length: number; height: number; y: number }) {
  const segments = 3
  const seg = length / segments
  return (
    <group>
      <Rod from={[0, y, 0]} length={side * 0.18} axis="x" color={COLORS.rail} />
      {Array.from({ length: segments }, (_, i) => {
        const x = side * (0.18 + seg * i + seg / 2)
        return (
          <group key={i}>
            {/* Cells on the sunny side, an aluminium frame behind them */}
            <Box size={[seg - 0.05, height - 0.04, 0.012]} position={[x, y, 0.012]} color="#ffffff" map={solarTexture()} metal={0.55} rough={0.2} />
            <Box size={[seg - 0.02, height, 0.016]} position={[x, y, 0]} color="#cbd5e1" metal={0.8} rough={0.35} />
            {/* Hinge between this panel and the next */}
            <Rod from={[x - side * (seg / 2), y - height * 0.3, 0]} length={height * 0.6} axis="y" color={COLORS.rail} radius={0.014} />
          </group>
        )
      })}
    </group>
  )
}

/** The parts of the spacecraft, for drawing just one of them */
export type CraftPart = 'frame' | 'solar' | 'battery' | 'computer' | 'attitude' | 'radio' | 'instruments'

export default function CraftModel({
  design,
  only,
  instant = false,
}: {
  design: MissionDesign
  /** Draw just this part, placed where it sits on the spacecraft */
  only?: CraftPart
  /** Show parts at full size straight away instead of popping in */
  instant?: boolean
}) {
  const root = useRef<Group>(null)
  const show = (part: CraftPart) => !only || only === part
  useShadows(root)
  const e = design.engineer
  const hasFrame = Boolean(e.structureId)
  const [sx, sy, sz] = FRAME_SIZE[e.structureId ?? ''] ?? [0.8, 1.2, 0.4]
  const top = sy / 2
  const bottom = -sy / 2
  const front = sz / 2
  const back = -sz / 2
  const instruments = design.science.instrumentIds

  return (
    <InstantContext.Provider value={instant}>
    <group ref={root}>
      {/* Frame (a ghost outline until one is picked) */}
      {show('frame') && hasFrame && (
        <PopIn key={e.structureId}>
          <RoundedBox args={[sx, sy, sz]} radius={0.025} smoothness={3}>
            <meshStandardMaterial color="#ffe3a3" map={foilTexture()} metalness={0.9} roughness={0.3} />
          </RoundedBox>
          {/* Aluminium rails down the four corners and plates on both ends */}
          {(
            [
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ] as const
          ).map(([dx, dz]) => (
            <Box key={`${dx}${dz}`} size={[0.045, sy + 0.04, 0.045]} position={[(dx * sx) / 2, 0, (dz * sz) / 2]} color="#d1d5db" metal={0.9} rough={0.3} />
          ))}
          <Box size={[sx + 0.02, 0.025, sz + 0.02]} position={[0, sy / 2 + 0.008, 0]} color="#9ca3af" metal={0.85} rough={0.35} />
          <Box size={[sx + 0.02, 0.025, sz + 0.02]} position={[0, -sy / 2 - 0.008, 0]} color="#9ca3af" metal={0.85} rough={0.35} />
        </PopIn>
      )}
      {!only && !hasFrame && (
        <mesh>
          <boxGeometry args={[sx, sy, sz]} />
          <meshBasicMaterial color={COLORS.led} wireframe transparent opacity={0.35} />
        </mesh>
      )}

      {/* Solar */}
      {show('solar') && e.solarId === 'solar-body' && (
        <PopIn key="solar-body">
          <Box size={[sx * 0.9, sy * 0.85, 0.01]} position={[0, 0, front + 0.006]} color="#ffffff" map={solarTexture()} metal={0.55} rough={0.22} />
          <Box size={[0.01, sy * 0.85, sz * 0.9]} position={[sx / 2 + 0.006, 0, 0]} color="#ffffff" map={solarTexture()} metal={0.55} rough={0.22} />
          <Box size={[0.01, sy * 0.85, sz * 0.9]} position={[-sx / 2 - 0.006, 0, 0]} color="#ffffff" map={solarTexture()} metal={0.55} rough={0.22} />
        </PopIn>
      )}
      {show('solar') && (e.solarId === 'solar-deploy' || e.solarId === 'solar-large') && (
        <PopIn key={e.solarId}>
          {([1, -1] as const).map((side) => (
            <group key={side} position={[side * (sx / 2), 0, 0]}>
              {e.solarId === 'solar-deploy' ? (
                <Wing side={side} length={1.3} height={sy * 0.7} y={0} />
              ) : (
                <>
                  <Wing side={side} length={2.2} height={sy * 0.42} y={sy * 0.24} />
                  <Wing side={side} length={2.2} height={sy * 0.42} y={-sy * 0.24} />
                </>
              )}
            </group>
          ))}
        </PopIn>
      )}

      {/* Battery: a glowing pack on the back, bigger for more Wh */}
      {show('battery') && e.batteryId && (
        <PopIn key={e.batteryId}>
          <Box
            size={[sx * 0.6, { 'battery-20': 0.12, 'battery-80': 0.22, 'battery-200': 0.36 }[e.batteryId] ?? 0.2, 0.08]}
            position={[0, bottom + 0.3, back - 0.04]}
            color="#065f46"
            emissive={COLORS.battery}
            glow={1.6}
            edges={COLORS.battery}
          />
        </PopIn>
      )}

      {/* Flight computer: a box on top with a blinking-looking LED */}
      {show('computer') && e.computerId && (
        <PopIn key={e.computerId}>
          <Box
            size={e.computerId === 'obc-big' ? [0.34, 0.1, 0.3] : [0.24, 0.06, 0.22]}
            position={[sx * 0.2, top + 0.04, 0]}
            color={COLORS.dark}
            edges={COLORS.led}
          />
          <Box size={[0.05, 0.03, 0.05]} position={[sx * 0.2, top + 0.1, 0]} color={COLORS.led} emissive={COLORS.led} glow={5} />
        </PopIn>
      )}

      {/* Attitude control */}
      {show('attitude') && e.attitudeId === 'magnetorquers' && (
        <PopIn key="mtq">
          <Rod from={[-sx / 2 + 0.05, top - 0.15, front + 0.03]} length={sx - 0.1} axis="x" color={COLORS.copper} radius={0.025} />
          <Rod from={[sx / 2 + 0.03, -sy / 4, front - 0.05]} length={-(sz - 0.1)} axis="z" color={COLORS.copper} radius={0.025} />
        </PopIn>
      )}
      {show('attitude') && (e.attitudeId === 'wheels' || e.attitudeId === 'star-tracker') && (
        <PopIn key={e.attitudeId}>
          {[-0.18, 0, 0.18].map((x, i) => (
            <mesh key={i} position={[x * (sx / 0.8), -sy * 0.15, front + 0.04]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
              <meshStandardMaterial color={COLORS.rail} metalness={0.8} roughness={0.25} />
            </mesh>
          ))}
          {e.attitudeId === 'star-tracker' && (
            <group position={[-sx / 2 + 0.12, top + 0.1, back + 0.12]} rotation={[0.5, 0, 0.3]}>
              <mesh>
                <cylinderGeometry args={[0.06, 0.09, 0.2, 12]} />
                <meshStandardMaterial color={COLORS.dark} />
              </mesh>
            </group>
          )}
        </PopIn>
      )}

      {/* Radio */}
      {show('radio') && design.comms.radioId === 'uhf' && (
        <PopIn key="uhf">
          {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([dx, dz], i) => (
            <group key={i} position={[(dx * sx) / 2, top, (dz * sz) / 2]} rotation={[dz * 0.5, 0, -dx * 0.5]}>
              <Rod from={[0, 0, 0]} length={0.8} axis="y" color={COLORS.white} radius={0.008} />
            </group>
          ))}
        </PopIn>
      )}
      {show('radio') && design.comms.radioId === 'sband' && (
        <PopIn key="sband">
          <Box size={[0.22, 0.02, 0.22]} position={[-sx * 0.2, top + 0.01, 0]} color={COLORS.white} edges={COLORS.rail} />
        </PopIn>
      )}
      {show('radio') && design.comms.radioId === 'xband' && (
        <PopIn key="xband">
          <Dish radius={0.28} position={[-sx * 0.2, top, 0]} />
        </PopIn>
      )}
      {show('radio') && design.comms.radioId === 'deep-transponder' && (
        <PopIn key="deep">
          <Dish radius={0.7} position={[0, top, 0]} />
        </PopIn>
      )}

      {/* Instruments on the bottom face, looking down at the target */}
      {show('instruments') &&
        instruments.map((id, i) => {
        const cols = Math.max(1, Math.min(3, instruments.length))
        const x = (i % cols - (cols - 1) / 2) * Math.min(0.3, sx / cols)
        const z = (Math.floor(i / cols) - 0.5 * Math.floor((instruments.length - 1) / cols)) * 0.3
        return (
          <PopIn key={id} position={[x, bottom, Math.max(back + 0.1, Math.min(front - 0.1, z))]}>
            <Instrument id={id} />
          </PopIn>
        )
      })}
    </group>
    </InstantContext.Provider>
  )
}

function Instrument({ id }: { id: string }) {
  switch (id) {
    case 'radar':
      return <Box size={[0.5, 0.03, 0.35]} position={[0, -0.03, 0]} color={COLORS.white} edges={COLORS.rail} />
    case 'magnetometer':
      return (
        <group>
          <Rod from={[0, 0, 0]} length={-0.9} axis="y" color={COLORS.rail} radius={0.012} />
          <Box size={[0.07, 0.07, 0.07]} position={[0, -0.92, 0]} color={COLORS.white} />
        </group>
      )
    case 'particle':
      return (
        <mesh position={[0, -0.06, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 8]} />
          <meshStandardMaterial color="#a78bfa" metalness={0.4} />
        </mesh>
      )
    case 'spectro':
    case 'nir-spectro':
      return (
        <group>
          <Box size={[0.2, 0.12, 0.16]} position={[0, -0.06, 0]} color="#7c3aed" edges="#c4b5fd" />
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.05, 12]} />
            <meshStandardMaterial color={COLORS.dark} metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      )
    default: {
      // Cameras: a lens barrel; infrared and EUV ones get a coloured ring
      const ring = id === 'thermal-ir' ? '#f97316' : id === 'euv-imager' ? '#a3e635' : '#22d3ee'
      return (
        <group>
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.2, 14]} />
            <meshStandardMaterial color={COLORS.dark} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.205, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.015, 14]} />
            <meshStandardMaterial color={ring} emissive={ring} emissiveIntensity={0.6} />
          </mesh>
        </group>
      )
    }
  }
}
