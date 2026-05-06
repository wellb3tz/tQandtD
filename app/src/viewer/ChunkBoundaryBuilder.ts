import * as THREE from 'three';
import { type ChunkData } from '../../../src/index';

const TERRAIN_HEIGHT_SCALE = 50;

export function createChunkBoundaries(chunkX: number, chunkY: number, data: ChunkData): THREE.LineSegments {
  const chunkSize = data.size;
  const verticesPerSide = chunkSize + 1;
  const worldX = chunkX * chunkSize;
  const worldZ = chunkY * chunkSize;
  const topLeft = data.heightmap[0] ?? 0;
  const topRight = data.heightmap[chunkSize] ?? topLeft;
  const bottomLeft = data.heightmap[chunkSize * verticesPerSide] ?? topLeft;

  const vertices = [
    worldX, topLeft * TERRAIN_HEIGHT_SCALE, worldZ,
    worldX + chunkSize, topRight * TERRAIN_HEIGHT_SCALE, worldZ,
    worldX, topLeft * TERRAIN_HEIGHT_SCALE, worldZ,
    worldX, bottomLeft * TERRAIN_HEIGHT_SCALE, worldZ + chunkSize,
  ];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

  const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
  return new THREE.LineSegments(geometry, material);
}
