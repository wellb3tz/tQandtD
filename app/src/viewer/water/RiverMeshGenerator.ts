import * as THREE from 'three';
import {
  buildRiverGeometryData,
  type RiverData,
  type RiverState,
} from '@engine/index';
import type { RiverRenderConfig } from './types';
import { HEIGHT_SCALE } from './config';
import { createBufferGeometry } from '../BufferGeometryFactory';
import { WATER_NORMAL_SCALE } from './WaterMaterialFactory';

const WATER_SURFACE_OFFSET = -0.6;

export function buildRiverGeometry(
  rivers: RiverData[],
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  seaLevel = -Infinity,
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
  return createRiverMaterialForState(config, 'flowing');
}

export function createRiverMaterialForState(
  config: RiverRenderConfig,
  state: RiverState = 'flowing',
): THREE.MeshStandardMaterial {
  const frozen = state === 'frozen';
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: frozen ? Math.min(1, Math.max(config.opacity, 0.86)) : config.opacity,
    roughness: frozen ? 0.68 : 0.22,
    metalness: frozen ? 0 : 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  material.userData.riverState = state;

  if (!frozen && config.normalMap) {
    material.normalMap = config.normalMap;
    material.normalScale = new THREE.Vector2(WATER_NORMAL_SCALE.x, WATER_NORMAL_SCALE.y);
  }

  return material;
}
