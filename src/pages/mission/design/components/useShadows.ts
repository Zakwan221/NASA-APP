import { useEffect, type RefObject } from 'react'
import type { Mesh, Object3D } from 'three'

/**
 * Lets every solid part inside `ref` cast and receive shadows. Glows, flames and
 * sprites (basic or additive materials) are skipped so they never cast dark shapes.
 * Runs after every render, so parts added later get shadows too.
 */
export function useShadows(ref: RefObject<Object3D | null>, receive = true) {
  useEffect(() => {
    ref.current?.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      const solid = !Array.isArray(mesh.material) && mesh.material.type === 'MeshStandardMaterial'
      mesh.castShadow = solid
      mesh.receiveShadow = solid && receive
    })
  })
}
