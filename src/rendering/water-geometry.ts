import type { ChunkData } from '../world/chunk';
import type { LakeData } from '../gen/lakes';
import {
  getRiverChannelDepth,
  getRiverChannelWidth,
  getRiverValleyDepth,
  getRiverValleyWidth,
  getRiverWaterLevel,
  type RiverData,
  type RiverPoint,
} from '../gen/rivers';
import {
  createIndexedGeometryData,
  getIndexedGeometryVertexCount,
  type IndexedGeometryData,
} from './geometry';

const CONTOUR_EPSILON = 1e-6;
const OUTSIDE_LAKE_EPSILON = 1e-6;
const DEFAULT_WATER_SURFACE_OFFSET = 0.15;
const DEFAULT_RIVER_SURFACE_OFFSET = -1.0;
const RIVER_CROSS_SECTION_OFFSETS = [-1, -0.5, 0, 0.5, 1] as const;
const RIVER_MAX_SURFACE_SEGMENT_LENGTH = 1.25;
const RIVER_UV_DISTANCE_SCALE = 0.22;
const RIVER_MIN_CHANNEL_CARVE_RADIUS = 1.35;
const RIVER_MIN_CHANNEL_FLOOR_RADIUS = 0.65;
const RIVER_WATER_DEPTH_FRACTION = 0.72;
const RIVER_TRIBUTARY_MOUTH_TAPER_LENGTH = 2.25;
const RIVER_SURFACE_VERTEX_COLOR = [0.04, 0.1, 0.23] as const;

interface RiverSurfaceSample {
  point: RiverPoint;
  distance: number;
}

interface ContourPoint {
  x: number;
  z: number;
  field: number;
  terrainHeight: number;
}

export interface WaterSurfaceTile {
  index: number;
  terrainHeight: number;
  waterElevation: number;
  underwaterDepth: number;
}

export interface WaterGeometryOptions {
  heightScale: number;
  surfaceOffset?: number;
}

export function identifyOceanSurfaceTiles(
  chunkData: ChunkData,
  seaLevel: number
): WaterSurfaceTile[] {
  const oceanTiles: WaterSurfaceTile[] = [];
  const { heightmap, size } = chunkData;
  const vertexSize = size + 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const v00 = heightmap[y * vertexSize + x];
      const v10 = heightmap[y * vertexSize + (x + 1)];
      const v01 = heightmap[(y + 1) * vertexSize + x];
      const v11 = heightmap[(y + 1) * vertexSize + (x + 1)];
      const terrainHeight = (v00 + v10 + v01 + v11) / 4;
      const minTerrainHeight = Math.min(v00, v10, v01, v11);

      if (minTerrainHeight < seaLevel) {
        oceanTiles.push({
          index,
          terrainHeight,
          waterElevation: seaLevel,
          underwaterDepth: seaLevel - minTerrainHeight,
        });
      }
    }
  }

  return oceanTiles;
}

export function identifyLakeSurfaceTiles(
  chunkData: ChunkData,
  lakes: LakeData[],
): WaterSurfaceTile[] {
  const { heightmap, size } = chunkData;
  const vertexSize = size + 1;
  const result: WaterSurfaceTile[] = [];

  for (const lake of lakes) {
    for (const tileIdx of lake.tiles) {
      if (tileIdx < 0 || tileIdx >= size * size) {
        continue;
      }

      const tx = tileIdx % size;
      const ty = Math.floor(tileIdx / size);

      if (tx < 0 || tx >= size || ty < 0 || ty >= size) {
        continue;
      }

      const v00 = heightmap[ty * vertexSize + tx];
      const v10 = heightmap[ty * vertexSize + (tx + 1)];
      const v01 = heightmap[(ty + 1) * vertexSize + tx];
      const v11 = heightmap[(ty + 1) * vertexSize + (tx + 1)];
      const terrainHeight = (v00 + v10 + v01 + v11) * 0.25;

      result.push({
        index: tileIdx,
        terrainHeight,
        waterElevation: lake.waterLevel,
        underwaterDepth: lake.waterLevel - terrainHeight,
      });
    }
  }

  return result;
}

export function buildOceanGeometryData(
  oceanTiles: WaterSurfaceTile[],
  chunkData: ChunkData,
  seaLevel: number,
  options: WaterGeometryOptions,
): IndexedGeometryData | null {
  if (oceanTiles.length === 0) {
    return null;
  }

  const { size } = chunkData;
  const surfaceOffset = options.surfaceOffset ?? DEFAULT_WATER_SURFACE_OFFSET;
  const data = createIndexedGeometryData();
  let vertexCount = 0;

  for (const tile of oceanTiles) {
    const tx = tile.index % size;
    const ty = Math.floor(tile.index / size);
    const polygon = buildSeaLevelPolygon(tx, ty, chunkData, seaLevel);

    if (polygon.length < 3) {
      continue;
    }

    const baseIndex = vertexCount;
    for (const point of polygon) {
      const worldX = chunkData.x * size + point.x;
      const worldZ = chunkData.y * size + point.z;
      const depth = Math.max(0, seaLevel - point.terrainHeight);
      const [r, g, b] = depthColor(depth, seaLevel);

      data.positions.push(worldX, seaLevel * options.heightScale + surfaceOffset, worldZ);
      data.normals.push(0, 1, 0);
      data.colors.push(r, g, b);
      data.uvs.push(point.x / size, point.z / size);
      vertexCount++;
    }

    for (let i = 1; i < polygon.length - 1; i++) {
      data.indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
    }
  }

  return getIndexedGeometryVertexCount(data) > 0 ? data : null;
}

export function buildLakeGeometryData(
  lakeTiles: WaterSurfaceTile[],
  lakes: LakeData[],
  chunkData: ChunkData,
  options: WaterGeometryOptions,
): IndexedGeometryData | null {
  if (lakeTiles.length === 0) {
    return null;
  }

  const { size } = chunkData;
  const surfaceOffset = options.surfaceOffset ?? DEFAULT_WATER_SURFACE_OFFSET;
  const data = createIndexedGeometryData();
  let vertexCount = 0;

  for (const lake of lakes) {
    if (lake.tiles.size === 0) continue;

    const waterY = lake.waterLevel;
    const maxDepth = lake.maxDepth;
    const candidateCells = collectLakeContourCells(lake.tiles, size);

    for (const cellIdx of candidateCells) {
      const tx = cellIdx % size;
      const ty = Math.floor(cellIdx / size);
      const polygon = buildLakePolygon(tx, ty, lake.tiles, chunkData, waterY);

      if (polygon.length < 3) {
        continue;
      }

      const baseIndex = vertexCount;
      for (const point of polygon) {
        const worldX = chunkData.x * size + point.x;
        const worldZ = chunkData.y * size + point.z;
        const depth = Math.max(0, waterY - point.terrainHeight);
        const [r, g, b] = lakeDepthColor(depth, maxDepth);

        data.positions.push(worldX, waterY * options.heightScale + surfaceOffset, worldZ);
        data.normals.push(0, 1, 0);
        data.colors.push(r, g, b);
        data.uvs.push(point.x / size, point.z / size);
        vertexCount++;
      }

      for (let i = 1; i < polygon.length - 1; i++) {
        data.indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
      }
    }
  }

  return getIndexedGeometryVertexCount(data) > 0 ? data : null;
}

export function buildRiverGeometryData(
  rivers: RiverData[],
  chunkX: number,
  chunkY: number,
  chunkSize: number,
  options: WaterGeometryOptions,
  seaLevel = -Infinity,
): IndexedGeometryData | null {
  const surfaceOffset = options.surfaceOffset ?? DEFAULT_RIVER_SURFACE_OFFSET;
  const data = createIndexedGeometryData();
  let vertexCount = 0;

  for (const river of rivers) {
    if (river.points.length < 2) continue;

    for (const visiblePoints of getVisibleRiverRuns(river.points, seaLevel, surfaceOffset, options.heightScale)) {
      const samples = createRiverSurfaceSamples(visiblePoints);
      if (samples.length < 2) continue;

      const runStart = vertexCount;
      const totalRunDistance = samples[samples.length - 1].distance;
      for (let i = 0; i < samples.length; i++) {
        const point = samples[i].point;
        const prev = samples[Math.max(0, i - 1)].point;
        const next = samples[Math.min(samples.length - 1, i + 1)].point;
        const tangent = getRiverSurfaceTangent(point, prev, next);
        const normalX = -tangent.y;
        const normalY = tangent.x;
        const halfWidth = getRiverWaterSurfaceHalfWidth(point, surfaceOffset, options.heightScale)
          * getRiverMouthTaper(river, samples[i].distance, totalRunDistance);
        const worldX = chunkX * chunkSize + point.x;
        const worldZ = chunkY * chunkSize + point.y;
        const baseY = getRiverWaterLevel(point) * options.heightScale + surfaceOffset;
        const v = samples[i].distance * RIVER_UV_DISTANCE_SCALE;

        for (let column = 0; column < RIVER_CROSS_SECTION_OFFSETS.length; column++) {
          const lateral = RIVER_CROSS_SECTION_OFFSETS[column];
          const edgeAmount = Math.abs(lateral);
          const [r, g, b] = riverSurfaceColor(point, edgeAmount);
          const x = worldX + normalX * halfWidth * lateral;
          const z = worldZ + normalY * halfWidth * lateral;
          // Very subtle edge lift for a hint of concavity without looking like a water-slide
          const edgeLift = edgeAmount * edgeAmount * getRiverChannelDepth(point) * 0.06 * options.heightScale;
          const y = baseY + edgeLift;

          data.positions.push(x, y, z);
          data.normals.push(0, 1, 0);
          data.colors.push(r, g, b);
          data.uvs.push((lateral + 1) * 0.5, v);
          vertexCount++;
        }
      }

      const columnCount = RIVER_CROSS_SECTION_OFFSETS.length;
      for (let row = 0; row < samples.length - 1; row++) {
        const rowStart = runStart + row * columnCount;
        const nextRowStart = rowStart + columnCount;
        for (let column = 0; column < columnCount - 1; column++) {
          data.indices.push(
            rowStart + column,
            rowStart + column + 1,
            nextRowStart + column,
            rowStart + column + 1,
            nextRowStart + column + 1,
            nextRowStart + column,
          );
        }
      }
    }
  }

  return getIndexedGeometryVertexCount(data) > 0 ? data : null;
}

function getRiverMouthTaper(river: RiverData, distance: number, totalDistance: number): number {
  if (!river.isTributary) return 1;
  if (totalDistance <= 1e-6) return 1;

  const remaining = totalDistance - distance;
  if (remaining >= RIVER_TRIBUTARY_MOUTH_TAPER_LENGTH) return 1;
  return smoothStep(remaining / RIVER_TRIBUTARY_MOUTH_TAPER_LENGTH);
}

function getRiverWaterSurfaceHalfWidth(
  point: RiverPoint,
  surfaceOffset: number,
  heightScale: number,
): number {
  const rawChannelRadius = Math.max(getRiverChannelWidth(point) * 0.5, 0);
  // No hard minimum for surface width — let narrow source streams stay narrow
  const channelRadius = rawChannelRadius;
  const valleyRadius = Math.max(getRiverValleyWidth(point) * 0.5, channelRadius);
  const channelDepth = Math.max(getRiverChannelDepth(point), 0);
  const valleyDepth = Math.max(getRiverValleyDepth(point), 0);

  if (channelRadius <= 0 || channelDepth <= 1e-6) {
    return rawChannelRadius;
  }

  const renderOffsetDepth = -surfaceOffset / heightScale;
  const waterDepth = clamp(channelDepth * RIVER_WATER_DEPTH_FRACTION + renderOffsetDepth, 0, channelDepth);
  const bankDepth = Math.min(channelDepth * 0.6, valleyDepth * 1.2);
  const floorRadius = Math.min(
    Math.max(channelRadius * 0.35, RIVER_MIN_CHANNEL_FLOOR_RADIUS),
    channelRadius * 0.7,
  );

  if (bankDepth > 1e-6 && waterDepth < bankDepth) {
    const outerT = smoothStep((bankDepth - waterDepth) / bankDepth);
    return channelRadius + (valleyRadius - channelRadius) * outerT;
  }

  if (channelDepth > bankDepth + 1e-6) {
    const wallT = smoothStep((channelDepth - waterDepth) / (channelDepth - bankDepth));
    return floorRadius + (channelRadius - floorRadius) * wallT;
  }

  return channelRadius;
}

function riverSurfaceColor(point: RiverPoint, edgeAmount: number): [number, number, number] {
  void point;
  void edgeAmount;
  return [
    RIVER_SURFACE_VERTEX_COLOR[0],
    RIVER_SURFACE_VERTEX_COLOR[1],
    RIVER_SURFACE_VERTEX_COLOR[2],
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothStep(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
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
        point: interpolateRiverPoint(a, b, t),
        distance: distance + segmentLength * t,
      });
    }
    distance += segmentLength;
  }

  return samples;
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

function depthColor(depth: number, seaLevel: number): [number, number, number] {
  const t = Math.min(depth / seaLevel, 1.0);
  const s = t * t;

  const r = 0.16 - s * 0.12;
  const g = 0.71 - s * 0.61;
  const b = 0.83 - s * 0.60;

  return [r, g, b];
}

function lakeDepthColor(depth: number, maxDepth: number): [number, number, number] {
  const t = maxDepth > 0 ? Math.min(depth / maxDepth, 1.0) : 0;
  const s = t * t;

  const r = 0.31 - s * 0.24;
  const g = 0.76 - s * 0.48;
  const b = 0.83 - s * 0.48;

  return [r, g, b];
}

function buildSeaLevelPolygon(
  tx: number,
  ty: number,
  chunkData: ChunkData,
  seaLevel: number,
): ContourPoint[] {
  const corners = [
    sampleSeaContourPoint(tx, ty, chunkData, seaLevel),
    sampleSeaContourPoint(tx + 1, ty, chunkData, seaLevel),
    sampleSeaContourPoint(tx + 1, ty + 1, chunkData, seaLevel),
    sampleSeaContourPoint(tx, ty + 1, chunkData, seaLevel),
  ];

  return clipContourPolygon(corners, CONTOUR_EPSILON);
}

function sampleSeaContourPoint(
  vx: number,
  vy: number,
  chunkData: ChunkData,
  seaLevel: number,
): ContourPoint {
  const { heightmap, size } = chunkData;
  const vertexSize = size + 1;
  const terrainHeight = heightmap[vy * vertexSize + vx];
  const field = seaLevel - terrainHeight;

  return { x: vx, z: vy, field, terrainHeight };
}

function collectLakeContourCells(lakeTiles: Set<number>, size: number): Set<number> {
  const cells = new Set<number>();

  for (const tileIdx of lakeTiles) {
    const tx = tileIdx % size;
    const ty = Math.floor(tileIdx / size);

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cx = tx + ox;
        const cy = ty + oy;
        if (cx < 0 || cy < 0 || cx >= size || cy >= size) {
          continue;
        }
        cells.add(cy * size + cx);
      }
    }
  }

  return cells;
}

function buildLakePolygon(
  tx: number,
  ty: number,
  lakeTiles: Set<number>,
  chunkData: ChunkData,
  waterY: number,
): ContourPoint[] {
  const corners = [
    sampleLakeContourPoint(tx, ty, lakeTiles, chunkData, waterY),
    sampleLakeContourPoint(tx + 1, ty, lakeTiles, chunkData, waterY),
    sampleLakeContourPoint(tx + 1, ty + 1, lakeTiles, chunkData, waterY),
    sampleLakeContourPoint(tx, ty + 1, lakeTiles, chunkData, waterY),
  ];

  return clipContourPolygon(corners, OUTSIDE_LAKE_EPSILON);
}

function sampleLakeContourPoint(
  vx: number,
  vy: number,
  lakeTiles: Set<number>,
  chunkData: ChunkData,
  waterY: number,
): ContourPoint {
  const { heightmap, size } = chunkData;
  const vertexSize = size + 1;
  const terrainHeight = heightmap[vy * vertexSize + vx];
  const touchesLake = lakeVertexTouchesTile(vx, vy, lakeTiles, size);
  const field = touchesLake
    ? waterY - terrainHeight
    : Math.min(waterY - terrainHeight, -OUTSIDE_LAKE_EPSILON);

  return { x: vx, z: vy, field, terrainHeight };
}

function lakeVertexTouchesTile(
  vx: number,
  vy: number,
  lakeTiles: Set<number>,
  size: number,
): boolean {
  const hasTile = (tx: number, ty: number): boolean => {
    return tx >= 0 && ty >= 0 && tx < size && ty < size && lakeTiles.has(ty * size + tx);
  };

  return (
    hasTile(vx - 1, vy - 1) ||
    hasTile(vx, vy - 1) ||
    hasTile(vx - 1, vy) ||
    hasTile(vx, vy)
  );
}

function clipContourPolygon(corners: ContourPoint[], epsilon: number): ContourPoint[] {
  const polygon: ContourPoint[] = [];
  for (let i = 0; i < corners.length; i++) {
    const current = corners[i];
    const previous = corners[(i + corners.length - 1) % corners.length];
    const currentInside = current.field >= 0;
    const previousInside = previous.field >= 0;

    if (currentInside !== previousInside) {
      polygon.push(interpolateContourPoint(previous, current, epsilon));
    }
    if (currentInside) {
      polygon.push(current);
    }
  }

  return polygon;
}

function interpolateContourPoint(a: ContourPoint, b: ContourPoint, epsilon: number): ContourPoint {
  const denominator = a.field - b.field;
  const t = Math.abs(denominator) > epsilon
    ? a.field / denominator
    : 0.5;
  const clamped = Math.min(Math.max(t, 0), 1);

  return {
    x: a.x + (b.x - a.x) * clamped,
    z: a.z + (b.z - a.z) * clamped,
    field: 0,
    terrainHeight: a.terrainHeight + (b.terrainHeight - a.terrainHeight) * clamped,
  };
}

function getVisibleRiverRuns(
  points: RiverPoint[],
  seaLevel: number,
  surfaceOffset: number,
  heightScale: number,
): RiverPoint[][] {
  if (!Number.isFinite(seaLevel)) return [points];

  const runs: RiverPoint[][] = [];
  let current: RiverPoint[] = [];
  const renderOffsetLevel = surfaceOffset / heightScale;

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
    // Allow shoreline points (surfaceLevel at/above sea) to remain visible even if
    // the recessed water level is slightly below — this gives a smooth mouth transition.
    const aVisible = waterA >= seaLevel || a.surfaceLevel >= seaLevel;
    const bVisible = waterB >= seaLevel || b.surfaceLevel >= seaLevel;

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
  return interpolateRiverPoint(a, b, t);
}

function interpolateRiverPoint(
  a: RiverPoint,
  b: RiverPoint,
  t: number,
): RiverPoint {
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
