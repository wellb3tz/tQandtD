import * as THREE from 'three';
import {
  getRiverChannelWidth,
  type ChunkData,
  type RiverData,
  type RiverPoint,
  type RiverState,
} from '@engine/index';
import type { RiverRenderConfig } from './types';
import { HEIGHT_SCALE, HORIZONTAL_SCALE } from './config';
import { createBufferGeometry } from '../BufferGeometryFactory';
import { WATER_NORMAL_SCALE } from './WaterMaterialFactory';

const TERRAIN_DRAPED_RIVER_OFFSET = 0.5;
const RIVER_CROSS_SECTION_OFFSETS = [
  -1, -0.875, -0.75, -0.625, -0.5, -0.375, -0.25, -0.125, 0,
  0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1,
] as const;
const RIVER_MAX_SURFACE_SEGMENT_LENGTH = 0.125;
const RIVER_MIN_SURFACE_RADIUS = 0.45;
const RIVER_UV_DISTANCE_SCALE = 0.22;
const RIVER_TRIBUTARY_MOUTH_TAPER_LENGTH = 2.25;
const RIVER_SURFACE_VERTEX_COLOR = [0.04, 0.1, 0.23] as const;
const FROZEN_RIVER_SURFACE_VERTEX_COLOR = [0.74, 0.88, 0.98] as const;

interface RiverSurfaceSample {
  point: RiverPoint;
  distance: number;
}

interface RiverRibbonVertex {
  x: number;
  y: number;
  u: number;
  v: number;
  river: RiverData;
}

export function buildRiverGeometry(
  rivers: RiverData[],
  chunkData: ChunkData,
  seaLevel = -Infinity,
): THREE.BufferGeometry | null {
  const geometryData = buildTerrainDrapedRiverGeometryData(rivers, chunkData, seaLevel);
  return createBufferGeometry(geometryData);
}

function buildTerrainDrapedRiverGeometryData(
  rivers: RiverData[],
  chunkData: ChunkData,
  seaLevel: number,
) {
  const { size, heightmap } = chunkData;
  const data = {
    positions: [] as number[],
    normals: [] as number[],
    colors: [] as number[],
    uvs: [] as number[],
    indices: [] as number[],
  };

  let vertexCount = 0;

  for (const river of rivers) {
    if (river.points.length < 2) continue;

    const visibleRuns = splitVisibleRuns(createRiverSurfaceSamples(river.points), chunkData, seaLevel);
    for (const samples of visibleRuns) {
      if (samples.length < 2) continue;

      const totalRunDistance = samples[samples.length - 1].distance;
      const rows = samples.map((sample, index) => {
        const point = sample.point;
        const prev = samples[Math.max(0, index - 1)].point;
        const next = samples[Math.min(samples.length - 1, index + 1)].point;
        const tangent = getRiverSurfaceTangent(point, prev, next);
        const normalX = -tangent.y;
        const normalY = tangent.x;
        const halfWidth = Math.max(getRiverChannelWidth(point) * 0.5, RIVER_MIN_SURFACE_RADIUS)
          * getRiverMouthTaper(river, sample.distance, totalRunDistance);
        const v = sample.distance * RIVER_UV_DISTANCE_SCALE;

        return RIVER_CROSS_SECTION_OFFSETS.map((lateral): RiverRibbonVertex => {
          const u = (lateral + 1) * 0.5;
          return {
            x: point.x + normalX * halfWidth * lateral,
            y: point.y + normalY * halfWidth * lateral,
            u,
            v,
            river,
          };
        });
      });

      for (let row = 0; row < rows.length - 1; row++) {
        for (let column = 0; column < RIVER_CROSS_SECTION_OFFSETS.length - 1; column++) {
          const polygon = clipPolygonToChunk([
            rows[row][column],
            rows[row + 1][column],
            rows[row + 1][column + 1],
            rows[row][column + 1],
          ], size);

          if (polygon.length < 3) continue;

          const baseIndex = vertexCount;
          for (const vertex of polygon) {
            const height = sampleTerrainHeight(heightmap, size, vertex.x, vertex.y);
            const color = getRiverSurfaceColor(vertex.river);

            data.positions.push(
              (chunkData.x * size + vertex.x) * HORIZONTAL_SCALE,
              height * HEIGHT_SCALE + TERRAIN_DRAPED_RIVER_OFFSET,
              (chunkData.y * size + vertex.y) * HORIZONTAL_SCALE,
            );
            data.normals.push(0, 1, 0);
            data.colors.push(color[0], color[1], color[2]);
            data.uvs.push(vertex.u, vertex.v);
            vertexCount++;
          }

          for (let i = 1; i < polygon.length - 1; i++) {
            data.indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
          }
        }
      }
    }
  }

  return vertexCount > 0 ? data : null;
}

function clipPolygonToChunk(polygon: RiverRibbonVertex[], chunkSize: number): RiverRibbonVertex[] {
  let clipped = polygon;
  clipped = clipPolygon(clipped, vertex => vertex.x >= 0, (a, b) => interpolateRibbonVertexAtX(a, b, 0));
  clipped = clipPolygon(clipped, vertex => vertex.x <= chunkSize, (a, b) => interpolateRibbonVertexAtX(a, b, chunkSize));
  clipped = clipPolygon(clipped, vertex => vertex.y >= 0, (a, b) => interpolateRibbonVertexAtY(a, b, 0));
  clipped = clipPolygon(clipped, vertex => vertex.y <= chunkSize, (a, b) => interpolateRibbonVertexAtY(a, b, chunkSize));
  return clipped;
}

function clipPolygon(
  polygon: RiverRibbonVertex[],
  inside: (vertex: RiverRibbonVertex) => boolean,
  intersect: (a: RiverRibbonVertex, b: RiverRibbonVertex) => RiverRibbonVertex,
): RiverRibbonVertex[] {
  if (polygon.length === 0) return [];

  const result: RiverRibbonVertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);

    if (currentInside !== previousInside) {
      result.push(intersect(previous, current));
    }
    if (currentInside) {
      result.push(current);
    }
  }

  return result;
}

function interpolateRibbonVertexAtX(a: RiverRibbonVertex, b: RiverRibbonVertex, x: number): RiverRibbonVertex {
  const denominator = b.x - a.x;
  const t = Math.abs(denominator) > 1e-9 ? (x - a.x) / denominator : 0;
  return interpolateRibbonVertex(a, b, clamp(t, 0, 1));
}

function interpolateRibbonVertexAtY(a: RiverRibbonVertex, b: RiverRibbonVertex, y: number): RiverRibbonVertex {
  const denominator = b.y - a.y;
  const t = Math.abs(denominator) > 1e-9 ? (y - a.y) / denominator : 0;
  return interpolateRibbonVertex(a, b, clamp(t, 0, 1));
}

function interpolateRibbonVertex(a: RiverRibbonVertex, b: RiverRibbonVertex, t: number): RiverRibbonVertex {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    u: a.u + (b.u - a.u) * t,
    v: a.v + (b.v - a.v) * t,
    river: a.river,
  };
}

function createRiverSurfaceSamples(points: RiverPoint[]): RiverSurfaceSample[] {
  if (points.length === 0) return [];

  const samples: RiverSurfaceSample[] = [{ point: points[0], distance: 0 }];
  let distance = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
    if (segmentLength <= 1e-6) continue;

    const steps = Math.max(1, Math.ceil(segmentLength / RIVER_MAX_SURFACE_SEGMENT_LENGTH));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      samples.push({
        point: interpolateRiverPoint(a, b, t, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t),
        distance: distance + segmentLength * t,
      });
    }
    distance += segmentLength;
  }

  return samples;
}

function splitVisibleRuns(
  samples: RiverSurfaceSample[],
  chunkData: ChunkData,
  seaLevel: number,
): RiverSurfaceSample[][] {
  if (!Number.isFinite(seaLevel)) return [samples];

  const runs: RiverSurfaceSample[][] = [];
  let current: RiverSurfaceSample[] = [];

  for (const sample of samples) {
    const terrainHeight = sampleTerrainHeight(chunkData.heightmap, chunkData.size, sample.point.x, sample.point.y);
    if (terrainHeight >= seaLevel - 0.02) {
      current.push(sample);
      continue;
    }

    if (current.length >= 2) {
      runs.push(current);
    }
    current = [];
  }

  if (current.length >= 2) {
    runs.push(current);
  }

  return runs;
}

function getRiverSurfaceTangent(
  point: RiverPoint,
  previous: RiverPoint,
  next: RiverPoint,
): { x: number; y: number } {
  let dx = next.x - previous.x;
  let dy = next.y - previous.y;

  if (Math.hypot(dx, dy) <= 1e-6) {
    dx = point.flowX;
    dy = point.flowY;
  }

  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function getRiverMouthTaper(river: RiverData, distance: number, totalDistance: number): number {
  if (!river.isTributary) return 1;
  if (totalDistance <= 1e-6) return 1;

  const remaining = totalDistance - distance;
  if (remaining >= RIVER_TRIBUTARY_MOUTH_TAPER_LENGTH) return 1;
  return smoothStep(remaining / RIVER_TRIBUTARY_MOUTH_TAPER_LENGTH);
}

function interpolateRiverPoint(a: RiverPoint, b: RiverPoint, t: number, x: number, y: number): RiverPoint {
  const optional = (start: number | undefined, end: number | undefined): number | undefined => {
    if (!Number.isFinite(start) && !Number.isFinite(end)) return undefined;
    const from = Number.isFinite(start) ? (start as number) : (end as number);
    const to = Number.isFinite(end) ? (end as number) : from;
    return from + (to - from) * t;
  };

  return {
    ...a,
    x,
    y,
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

function sampleTerrainHeight(heightmap: Float32Array, chunkSize: number, x: number, y: number): number {
  const vertexSize = chunkSize + 1;
  const clampedX = clamp(x, 0, chunkSize);
  const clampedY = clamp(y, 0, chunkSize);
  const x0 = Math.min(Math.floor(clampedX), chunkSize - 1);
  const y0 = Math.min(Math.floor(clampedY), chunkSize - 1);
  const x1 = Math.min(x0 + 1, chunkSize);
  const y1 = Math.min(y0 + 1, chunkSize);
  const tx = clampedX - x0;
  const ty = clampedY - y0;

  const h00 = heightmap[y0 * vertexSize + x0] ?? 0;
  const h10 = heightmap[y0 * vertexSize + x1] ?? h00;
  const h01 = heightmap[y1 * vertexSize + x0] ?? h00;
  const h11 = heightmap[y1 * vertexSize + x1] ?? h10;

  if (tx + ty <= 1) {
    return h00 + (h10 - h00) * tx + (h01 - h00) * ty;
  }

  const invTx = 1 - tx;
  const invTy = 1 - ty;
  return h11 + (h01 - h11) * invTx + (h10 - h11) * invTy;
}

function getRiverSurfaceColor(river: RiverData): readonly [number, number, number] {
  if (river.state === 'frozen') {
    return FROZEN_RIVER_SURFACE_VERTEX_COLOR;
  }
  return RIVER_SURFACE_VERTEX_COLOR;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothStep(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
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
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  material.userData.riverState = state;

  if (!frozen && config.normalMap) {
    material.normalMap = config.normalMap;
    material.normalScale = new THREE.Vector2(WATER_NORMAL_SCALE.x, WATER_NORMAL_SCALE.y);
  }

  return material;
}
