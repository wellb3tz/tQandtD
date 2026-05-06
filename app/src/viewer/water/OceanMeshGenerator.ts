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
import { HEIGHT_SCALE } from './config';
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
  return createBufferGeometry(
    buildOceanGeometryData(oceanTiles, chunkData, config.seaLevel, {
      heightScale: HEIGHT_SCALE,
    })
  );
}
