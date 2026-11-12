/**
 * Pictures of every part, instrument and rocket, rendered from the same 3D
 * models the game uses (so a card's picture matches what lands on the
 * spacecraft). A hidden canvas draws them one by one, once per visit, and
 * cards read them with useThumbnail().
 *
 * Mount <ThumbnailStudio /> once on a page that shows pictures (lazy-load it:
 * it pulls in three.js).
 */

import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Box3, PMREMGenerator, Vector3, type Group } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { INSTRUMENTS, PARTS, ROCKETS } from '../../game/data'
import ItemModel, { type ItemKind } from './ItemModel'
import { emitThumbnails, hasThumbnail, saveThumbnail } from './thumbnailStore'

interface ThumbItem {
  key: string
  kind: ItemKind
  id: string
}

const ITEMS: ThumbItem[] = [
  ...PARTS.map((p) => ({ key: `part:${p.id}`, kind: 'part' as const, id: p.id })),
  ...INSTRUMENTS.map((i) => ({ key: `instrument:${i.id}`, kind: 'instrument' as const, id: i.id })),
  ...ROCKETS.map((r) => ({ key: `rocket:${r.id}`, kind: 'rocket' as const, id: r.id })),
]

/** Draws each item that has no picture yet, one per animation frame */
function Shooter() {
  const { gl, scene, camera } = useThree()
  const group = useRef<Group>(null)
  const [index, setIndex] = useState(() => ITEMS.findIndex((i) => !hasThumbnail(i.key)))

  // Soft studio lighting for reflections (metal and gold foil look flat without it)
  const env = useMemo(() => {
    const pmrem = new PMREMGenerator(gl)
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    return texture
  }, [gl])
  useEffect(() => () => env.dispose(), [env])

  useEffect(() => {
    if (index < 0) return
    const frame = requestAnimationFrame(() => {
      const g = group.current
      const item = ITEMS[index]
      if (g && item) {
        // Frame the item: look from front-right-above, far enough that it fits
        const box = new Box3().setFromObject(g)
        const centre = box.getCenter(new Vector3())
        const radius = Math.max(0.05, box.getSize(new Vector3()).length() / 2)
        const dir = new Vector3(0.75, 0.45, 1).normalize()
        const dist = (radius / Math.sin(((40 * Math.PI) / 180) / 2)) * 0.95
        camera.position.copy(centre).addScaledVector(dir, dist)
        camera.near = dist / 50
        camera.far = dist * 10
        camera.lookAt(centre)
        camera.updateProjectionMatrix()
        gl.render(scene, camera)
        saveThumbnail(item.key, gl.domElement.toDataURL('image/webp', 0.86))
        emitThumbnails()
      }
      const next = ITEMS.findIndex((i, n) => n > index && !hasThumbnail(i.key))
      setIndex(next)
    })
    return () => cancelAnimationFrame(frame)
  }, [index, gl, scene, camera])

  if (index < 0) return null
  return (
    <>
      <primitive attach="environment" object={env} />
      <group ref={group} rotation={[0, -0.35, 0]}>
        <ItemModel key={ITEMS[index].key} kind={ITEMS[index].kind} id={ITEMS[index].id} />
      </group>
    </>
  )
}

/** Off-screen canvas that renders the pictures. Unmounts itself when they are all done. */
export default function ThumbnailStudio() {
  const [done, setDone] = useState(() => ITEMS.every((i) => hasThumbnail(i.key)))
  useEffect(() => {
    if (done) return
    const t = setInterval(() => ITEMS.every((i) => hasThumbnail(i.key)) && setDone(true), 500)
    return () => clearInterval(t)
  }, [done])
  if (done) return null
  return (
    <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: 320, height: 320, pointerEvents: 'none' }}>
      <Canvas
        frameloop="never"
        dpr={2}
        camera={{ fov: 40 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ width: 320, height: 320 }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 6, 5]} intensity={2.4} color="#fff4e0" />
        <directionalLight position={[-5, 2, -3]} intensity={0.8} color="#93c5fd" />
        <Shooter />
      </Canvas>
    </div>
  )
}
