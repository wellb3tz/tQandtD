import * as THREE from 'three';
import {
  buildChunkBoundaryLineData,
  type ChunkData,
} from '@engine/index';

const TERRAIN_HEIGHT_SCALE = 50;

export function createChunkBoundaries(chunkX: number, chunkY: number, data: ChunkData): THREE.LineSegments {
  const boundaryData = buildChunkBoundaryLineData(chunkX, chunkY, data, {
    heightScale: TERRAIN_HEIGHT_SCALE,
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(boundaryData.positions, 3));

  const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
  const boundaries = new THREE.LineSegments(geometry, material);
  boundaries.name = `chunk-boundaries-${chunkX},${chunkY}`;
  return boundaries;
}
