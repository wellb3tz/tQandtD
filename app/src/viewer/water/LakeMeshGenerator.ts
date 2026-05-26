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
  type LakeState,
} from '@engine/index';
import type { LakeTile, LakeRenderConfig } from './types';
import { HEIGHT_SCALE, HORIZONTAL_SCALE } from './config';
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
      horizontalScale: HORIZONTAL_SCALE,
    })
  );
}

export function createLakeMaterial(config: LakeRenderConfig): THREE.MeshPhongMaterial {
  return createLakeMaterialForState(config, 'filled');
}

export function createLakeMaterialForState(
  config: LakeRenderConfig,
  state: LakeState = 'filled',
): THREE.MeshPhongMaterial {
  const frozen = state === 'frozen';
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: frozen ? Math.min(1, Math.max(config.opacity, 0.88)) : config.opacity,
    shininess: frozen ? Math.min(100, Math.max(config.shininess, 82)) : config.shininess,
    side: THREE.DoubleSide,
    specular: new THREE.Color(frozen ? 0xd8f6ff : 0x88ffcc),
  });

  material.userData.lakeState = state;
  return material;
}
