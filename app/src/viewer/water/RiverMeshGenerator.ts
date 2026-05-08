import * as THREE from 'three';
import {
  buildRiverGeometryData,
  type RiverData,
} from '@engine/index';
import type { RiverRenderConfig } from './types';
import { HEIGHT_SCALE } from './config';
import { createBufferGeometry } from '../BufferGeometryFactory';
import { WATER_NORMAL_SCALE } from './WaterMaterialFactory';

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
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
    specular: new THREE.Color(0x88ccff),
  });

  if (config.normalMap) {
    material.normalMap = config.normalMap;
    material.normalScale = new THREE.Vector2(WATER_NORMAL_SCALE.x, WATER_NORMAL_SCALE.y);
  }

  return material;
}
