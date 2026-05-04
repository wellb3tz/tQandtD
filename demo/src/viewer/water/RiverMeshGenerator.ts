import * as THREE from 'three';
import { getRiverChannelWidth, getRiverWaterLevel, type RiverData } from '../../../../src/gen/rivers';
import type { RiverRenderConfig } from './types';
import { HEIGHT_SCALE } from './config';

const WATER_SURFACE_OFFSET = 0.04;
const OCEAN_SURFACE_VERTEX_COLOR = [0.16, 0.71, 0.83] as const;

export function buildRiverGeometry(
  rivers: RiverData[],
  chunkX: number,
  chunkY: number,
  chunkSize: number
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  for (const river of rivers) {
    if (river.points.length < 2) continue;

    for (let i = 0; i < river.points.length; i++) {
      const point = river.points[i];
      const prev = river.points[Math.max(0, i - 1)];
      const next = river.points[Math.min(river.points.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const length = Math.hypot(dx, dy) || 1;
      const normalX = -dy / length;
      const normalY = dx / length;
      const halfWidth = getRiverChannelWidth(point) * 0.5;
      const worldX = chunkX * chunkSize + point.x;
      const worldZ = chunkY * chunkSize + point.y;
      const y = getRiverWaterLevel(point) * HEIGHT_SCALE + WATER_SURFACE_OFFSET;

      positions.push(worldX + normalX * halfWidth, y, worldZ + normalY * halfWidth);
      positions.push(worldX - normalX * halfWidth, y, worldZ - normalY * halfWidth);
      normals.push(0, 1, 0, 0, 1, 0);
      colors.push(...OCEAN_SURFACE_VERTEX_COLOR, ...OCEAN_SURFACE_VERTEX_COLOR);
      uvs.push(0, i, 1, i);

      if (i < river.points.length - 1) {
        const base = vertexCount;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }

      vertexCount += 2;
    }
  }

  if (vertexCount === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
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
