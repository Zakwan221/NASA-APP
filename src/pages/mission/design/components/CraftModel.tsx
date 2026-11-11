/**
 * Low-poly 3D spacecraft built from the design. No Canvas here, so both the
 * Design viewer and the Launch scene can use it.
 * Every part pops in when it is added, so players see their choice land.
 */

import { Edges } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import { DoubleSide, type Group, type Texture } from 'three'
import type { MissionDesign } from '../../../../game/types'
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

/** Scales its children from 0 to 1 when mounted (re-mounts when `key` changes) */
function PopIn({ children, position }: { children: ReactNode; position?: [number, number, number] }) {
  const ref = useRef<Group>(null)
  useFrame((_, delta) => {
    const g = ref.current
    if (!g || g.scale.x >= 0.999) return
    const s = Math.min(1, g.scale.x + (1 - g.scale.x) * Math.min(1, delta * 9) + 0.002)
    g.scale.setScalar(s)
  })
  return (
    <group ref={ref} position={position} scale={0.001}>
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
  return (
    <group position={position}>
      <Rod from={[0, 0, 0]} length={radius * 0.6} axis="y" color={COLORS.rail} />
      <mesh position={[0, radius * 0.6 + radius * 0.55, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[radius, 20, 8, 0, Math.PI * 2, 0, Math.PI / 4]} />
        <meshStandardMaterial color={COLORS.white} side={DoubleSide} metalness={0.2} roughness={0.5} />
      </mesh>
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
      {Array.from({ length: segments }, (_, i) => (
        <Box
          key={i}
          size={[seg - 0.03, height, 0.025]}
          position={[side * (0.18 + seg * i + seg / 2), y, 0]}
          color="#ffffff"
          map={solarTexture()}
          metal={0.55}
          rough={0.22}
          edges="#94a3b8"
        />
      ))}
    </group>
  )
}

export default function CraftModel({ design }: { design: MissionDesign }) {
  const root = useRef<Group>(null)
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
    <group ref={root}>
      {/* Frame (a ghost outline until one is picked) */}
      {hasFrame ? (
        <PopIn key={e.structureId}>
          <Box size={[sx, sy, sz]} color="#ffe3a3" map={foilTexture()} metal={0.9} rough={0.28} edges="#e2e8f0" />
        </PopIn>
      ) : (
        <mesh>
          <boxGeometry args={[sx, sy, sz]} />
          <meshBasicMaterial color={COLORS.led} wireframe transparent opacity={0.35} />
        </mesh>
      )}

      {/* Solar */}
      {e.solarId === 'solar-body' && (
        <PopIn key="solar-body">
          <Box size={[sx * 0.9, sy * 0.85, 0.01]} position={[0, 0, front + 0.006]} color="#ffffff" map={solarTexture()} metal={0.55} rough={0.22} />
          <Box size={[0.01, sy * 0.85, sz * 0.9]} position={[sx / 2 + 0.006, 0, 0]} color="#ffffff" map={solarTexture()} metal={0.55} rough={0.22} />
          <Box size={[0.01, sy * 0.85, sz * 0.9]} position={[-sx / 2 - 0.006, 0, 0]} color="#ffffff" map={solarTexture()} metal={0.55} rough={0.22} />
        </PopIn>
      )}
      {(e.solarId === 'solar-deploy' || e.solarId === 'solar-large') && (
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
      {e.batteryId && (
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
      {e.computerId && (
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
      {e.attitudeId === 'magnetorquers' && (
        <PopIn key="mtq">
          <Rod from={[-sx / 2 + 0.05, top - 0.15, front + 0.03]} length={sx - 0.1} axis="x" color={COLORS.copper} radius={0.025} />
          <Rod from={[sx / 2 + 0.03, -sy / 4, front - 0.05]} length={-(sz - 0.1)} axis="z" color={COLORS.copper} radius={0.025} />
        </PopIn>
      )}
      {(e.attitudeId === 'wheels' || e.attitudeId === 'star-tracker') && (
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
      {design.comms.radioId === 'uhf' && (
        <PopIn key="uhf">
          {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([dx, dz], i) => (
            <group key={i} position={[(dx * sx) / 2, top, (dz * sz) / 2]} rotation={[dz * 0.5, 0, -dx * 0.5]}>
              <Rod from={[0, 0, 0]} length={0.8} axis="y" color={COLORS.white} radius={0.008} />
            </group>
          ))}
        </PopIn>
      )}
      {design.comms.radioId === 'sband' && (
        <PopIn key="sband">
          <Box size={[0.22, 0.02, 0.22]} position={[-sx * 0.2, top + 0.01, 0]} color={COLORS.white} edges={COLORS.rail} />
        </PopIn>
      )}
      {design.comms.radioId === 'xband' && (
        <PopIn key="xband">
          <Dish radius={0.28} position={[-sx * 0.2, top, 0]} />
        </PopIn>
      )}
      {design.comms.radioId === 'deep-transponder' && (
        <PopIn key="deep">
          <Dish radius={0.7} position={[0, top, 0]} />
        </PopIn>
      )}

      {/* Instruments on the bottom face, looking down at the target */}
      {instruments.map((id, i) => {
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
