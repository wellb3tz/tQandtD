import * as THREE from 'three';
import { getRiverChannelWidth, getRiverWaterLevel, type RiverData, type RiverPoint } from '../../../../src/gen/rivers';
import type { RiverRenderConfig } from './types';
import { HEIGHT_SCALE } from './config';

const WATER_SURFACE_OFFSET = -1.0;
const OCEAN_SURFACE_VERTEX_COLOR = [0.16, 0.71, 0.83] as const;

export function buildRiverGeometry(
  rivers: RiverData[],
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  seaLevel = -Infinity
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  for (const river of rivers) {
    if (river.points.length < 2) continue;

    for (const points of getVisibleRiverRuns(river.points, seaLevel)) {
      if (points.length < 2) continue;

      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
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

        if (i < points.length - 1) {
          const base = vertexCount;
          indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }

        vertexCount += 2;
      }
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

function getVisibleRiverRuns(points: RiverPoint[], seaLevel: number): RiverPoint[][] {
  if (!Number.isFinite(seaLevel)) return [points];

  const runs: RiverPoint[][] = [];
  let current: RiverPoint[] = [];
  const renderOffsetLevel = WATER_SURFACE_OFFSET / HEIGHT_SCALE;

  const flush = (): void => {
    if (current.length >= 2) {
      runs.push(current);
    }
    current = [];
  };

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const waterA = getRiverWaterLevel(a) + renderOffsetLevel;
    const waterB = getRiverWaterLevel(b) + renderOffsetLevel;
    const aVisible = waterA >= seaLevel;
    const bVisible = waterB >= seaLevel;

    if (aVisible && current.length === 0) {
      current.push(a);
    }

    if (aVisible && bVisible) {
      current.push(b);
      continue;
    }

    if (aVisible && !bVisible) {
      current.push(interpolateRiverPointAtWaterLevel(a, b, waterA, waterB, seaLevel));
      flush();
      continue;
    }

    if (!aVisible && bVisible) {
      current = [interpolateRiverPointAtWaterLevel(a, b, waterA, waterB, seaLevel), b];
      continue;
    }

    flush();
  }

  flush();
  return runs;
}

function interpolateRiverPointAtWaterLevel(
  a: RiverPoint,
  b: RiverPoint,
  waterA: number,
  waterB: number,
  seaLevel: number
): RiverPoint {
  const denominator = waterB - waterA;
  const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, (seaLevel - waterA) / denominator));
  const optional = (start: number | undefined, end: number | undefined): number | undefined => {
    if (!Number.isFinite(start) && !Number.isFinite(end)) return undefined;
    const from = Number.isFinite(start) ? (start as number) : (end as number);
    const to = Number.isFinite(end) ? (end as number) : from;
    return from + (to - from) * t;
  };

  return {
    ...a,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    height: a.height + (b.height - a.height) * t,
    surfaceLevel: a.surfaceLevel + (b.surfaceLevel - a.surfaceLevel) * t,
    width: a.width + (b.width - a.width) * t,
    depth: a.depth + (b.depth - a.depth) * t,
    flow: optional(a.flow, b.flow),
    channelWidth: optional(a.channelWidth, b.channelWidth),
    valleyWidth: optional(a.valleyWidth, b.valleyWidth),
    channelDepth: optional(a.channelDepth, b.channelDepth),
    valleyDepth: optional(a.valleyDepth, b.valleyDepth),
    flowX: a.flowX + (b.flowX - a.flowX) * t,
    flowY: a.flowY + (b.flowY - a.flowY) * t,
  };
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
