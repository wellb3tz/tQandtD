import * as THREE from 'three';
import {
  buildRiverGeometryData,
  type RiverData,
} from '@engine/index';
import type { RiverRenderConfig } from './types';
import { HEIGHT_SCALE } from './config';
import { createBufferGeometry } from '../BufferGeometryFactory';
import { WATER_NORMAL_SCALE } from './WaterMaterialFactory';

const WATER_SURFACE_OFFSET = 0.3;

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

export function createRiverMaterial(config: RiverRenderConfig): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    roughness: 0.22,
    metalness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  if (config.normalMap) {
    material.normalMap = config.normalMap;
    material.normalScale = new THREE.Vector2(WATER_NORMAL_SCALE.x, WATER_NORMAL_SCALE.y);
  }

  return material;
}
