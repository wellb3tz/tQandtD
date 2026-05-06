import * as THREE from 'three';
import type { IndexedGeometryData } from '@engine/index';

export function createBufferGeometry(data: IndexedGeometryData | null): THREE.BufferGeometry | null {
  if (!data) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(data.normals), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(data.colors), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(data.uvs), 2));
  geometry.setIndex(data.indices);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return geometry;
}
