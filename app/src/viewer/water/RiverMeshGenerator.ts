import * as THREE from 'three';
import {
  buildRiverGeometryData,
  type RiverData,
} from '@engine/index';
import type { RiverRenderConfig } from './types';
import { HEIGHT_SCALE } from './config';
import { createBufferGeometry } from '../BufferGeometryFactory';

const WATER_SURFACE_OFFSET = -1.0;

export function buildRiverGeometry(
  rivers: RiverData[],
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  seaLevel = -Infinity
): THREE.BufferGeometry | null {
  return createBufferGeometry(
    buildRiverGeometryData(
      rivers,
      chunkX,
      chunkY,
      chunkSize,
      {
        heightScale: HEIGHT_SCALE,
        surfaceOffset: WATER_SURFACE_OFFSET,
      },
      seaLevel,
    )
  );
}

export function createRiverMaterial(config: RiverRenderConfig): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
    specular: new THREE.Color(0x88ccff),
  });
}
