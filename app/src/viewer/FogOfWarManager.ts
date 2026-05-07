import * as THREE from 'three';
import { disposeMesh } from './ThreeDisposal';

export class FogOfWarManager {
  private readonly meshes = new Map<string, THREE.Mesh>();

  createFogPlane(
    chunkX: number,
    chunkY: number,
    originalTerrain: THREE.Mesh,
    scene: THREE.Scene,
    visible: boolean = true,
  ): void {
    const key = getChunkKey(chunkX, chunkY);
    this.removeFogPlane(chunkX, chunkY, scene);

    const geometry = originalTerrain.geometry as THREE.BufferGeometry;
    const positions = geometry.getAttribute('position');
    let avgHeight = 0;

    for (let i = 0; i < positions.count; i++) {
      avgHeight += positions.getY(i);
    }
    avgHeight = positions.count > 0 ? avgHeight / positions.count : 0;

    const chunkSize = Math.sqrt(positions.count) - 1;
    const planeGeometry = new THREE.PlaneGeometry(chunkSize, chunkSize, 1, 1);
    planeGeometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const plane = new THREE.Mesh(planeGeometry, material);
    plane.visible = visible;
    plane.position.set(
      chunkX * chunkSize + chunkSize / 2,
      avgHeight,
      chunkY * chunkSize + chunkSize / 2,
    );

    scene.add(plane);
    this.meshes.set(key, plane);
  }

  removeFogPlane(chunkX: number, chunkY: number, scene: THREE.Scene): void {
    const key = getChunkKey(chunkX, chunkY);
    const plane = this.meshes.get(key);
    if (!plane) return;

    scene.remove(plane);
    disposeMesh(plane);
    this.meshes.delete(key);
  }

  clear(scene: THREE.Scene): void {
    for (const plane of this.meshes.values()) {
      scene.remove(plane);
      disposeMesh(plane);
    }
    this.meshes.clear();
  }

  setVisible(visible: boolean): void {
    for (const plane of this.meshes.values()) {
      plane.visible = visible;
    }
  }

  get size(): number {
    return this.meshes.size;
  }
}

function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}
