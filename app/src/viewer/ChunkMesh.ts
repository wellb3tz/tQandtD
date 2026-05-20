import * as THREE from 'three';
import type { ChunkData } from '@engine/index';
import type { WaterLayerData } from './water/types';

export interface ChunkMesh {
  terrain: THREE.Mesh;
  data?: ChunkData;
  water?: WaterLayerData;
  foliage?: THREE.Group;
  resources?: THREE.Group;
  structures?: THREE.Group;
  boundaries?: THREE.LineSegments;
  boundingBox?: THREE.Box3;
  visible?: boolean;
}

export function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}
