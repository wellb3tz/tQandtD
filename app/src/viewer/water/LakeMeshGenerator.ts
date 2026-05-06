/**
 * Lake mesh generator
 *
 * Converts engine lake geometry data into Three.js geometry/materials.
 */

import * as THREE from 'three';
import {
  buildLakeGeometryData,
  identifyLakeSurfaceTiles,
  type ChunkData,
  type LakeData,
} from '@engine/index';
import type { LakeTile, LakeRenderConfig } from './types';
import { HEIGHT_SCALE } from './config';
import { createBufferGeometry } from '../BufferGeometryFactory';

export function identifyLakeTiles(
  chunkData: ChunkData,
  lakes: LakeData[],
): LakeTile[] {
  return identifyLakeSurfaceTiles(chunkData, lakes);
}

export function buildLakeGeometry(
  lakeTiles: LakeTile[],
  lakes: LakeData[],
  chunkData: ChunkData,
): THREE.BufferGeometry | null {
  return createBufferGeometry(
    buildLakeGeometryData(lakeTiles, lakes, chunkData, {
      heightScale: HEIGHT_SCALE,
    })
  );
}

export function createLakeMaterial(config: LakeRenderConfig): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
    specular: new THREE.Color(0x88ffcc),
  });
}
