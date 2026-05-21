/**
 * Ocean mesh generator for water system.
 *
 * Keeps Three.js-specific geometry creation in the app while the clipping and
 * vertex data generation live in the engine rendering helpers.
 */

import * as THREE from 'three';
import {
  buildOceanGeometryData,
  identifyOceanSurfaceTiles,
  type ChunkData,
} from '@engine/index';
import type { WaterConfig, OceanTile } from './types';
import { HEIGHT_SCALE, HORIZONTAL_SCALE } from './config';
import { createBufferGeometry } from '../BufferGeometryFactory';

export function identifyOceanTiles(
  chunkData: ChunkData,
  seaLevel: number
): OceanTile[] {
  return identifyOceanSurfaceTiles(chunkData, seaLevel);
}

export function buildOceanGeometry(
  oceanTiles: OceanTile[],
  chunkData: ChunkData,
  config: WaterConfig
): THREE.BufferGeometry | null {
  const geometry = createBufferGeometry(
    buildOceanGeometryData(oceanTiles, chunkData, config.seaLevel, {
      heightScale: HEIGHT_SCALE,
      horizontalScale: HORIZONTAL_SCALE,
    })
  );
  if (!geometry) {
    return null;
  }

  geometry.setAttribute(
    'waterDepth',
    new THREE.BufferAttribute(createOceanDepthAttribute(geometry, chunkData, config), 1),
  );

  return geometry;
}

function createOceanDepthAttribute(
  geometry: THREE.BufferGeometry,
  chunkData: ChunkData,
  config: WaterConfig,
): Float32Array {
  const position = geometry.getAttribute('position');
  const depth = new Float32Array(position.count);
  const baseX = chunkData.x * chunkData.size * HORIZONTAL_SCALE;
  const baseZ = chunkData.y * chunkData.size * HORIZONTAL_SCALE;

  for (let i = 0; i < position.count; i++) {
    const localX = (position.getX(i) - baseX) / HORIZONTAL_SCALE;
    const localZ = (position.getZ(i) - baseZ) / HORIZONTAL_SCALE;
    const terrainHeight = sampleHeightmap(chunkData, localX, localZ);
    depth[i] = Math.max(0, config.seaLevel - terrainHeight) * HEIGHT_SCALE;
  }

  return depth;
}

function sampleHeightmap(chunkData: ChunkData, x: number, z: number): number {
  const size = chunkData.size;
  const vertexSize = size + 1;
  const clampedX = THREE.MathUtils.clamp(x, 0, size);
  const clampedZ = THREE.MathUtils.clamp(z, 0, size);
  const x0 = Math.min(Math.floor(clampedX), size - 1);
  const z0 = Math.min(Math.floor(clampedZ), size - 1);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const tx = clampedX - x0;
  const tz = clampedZ - z0;

  const h00 = chunkData.heightmap[z0 * vertexSize + x0];
  const h10 = chunkData.heightmap[z0 * vertexSize + x1];
  const h01 = chunkData.heightmap[z1 * vertexSize + x0];
  const h11 = chunkData.heightmap[z1 * vertexSize + x1];
  const hx0 = THREE.MathUtils.lerp(h00, h10, tx);
  const hx1 = THREE.MathUtils.lerp(h01, h11, tx);
  return THREE.MathUtils.lerp(hx0, hx1, tz);
}
