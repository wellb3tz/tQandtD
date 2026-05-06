/**
 * Ocean mesh generator for water system.
 *
 * Identifies ocean cells and builds a sea-level mesh clipped to the terrain
 * contour, so coastlines follow the heightmap instead of square tile edges.
 */

import * as THREE from 'three';
import type { ChunkData } from '@engine/world/chunk';
import type { WaterConfig, OceanTile } from './types';
import { HEIGHT_SCALE } from './config';

const CONTOUR_EPSILON = 1e-6;

interface ContourPoint {
  x: number;
  z: number;
  field: number;
  terrainHeight: number;
}

/**
 * Identify ocean tiles in a chunk where terrain touches or falls below sea level.
 *
 * @param chunkData - Chunk data containing heightmap
 * @param seaLevel  - Sea level elevation threshold
 * @returns Array of ocean tiles with depth and elevation data
 */
export function identifyOceanTiles(
  chunkData: ChunkData,
  seaLevel: number
): OceanTile[] {
  const oceanTiles: OceanTile[] = [];
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

/**
 * Calculate water surface color based on depth below sea level.
 *
 * @param depth    - Depth below sea level
 * @param seaLevel - Sea level threshold
 * @returns RGB color components in [0, 1] range
 */
function depthColor(depth: number, seaLevel: number): [number, number, number] {
  const t = Math.min(depth / seaLevel, 1.0);
  const s = t * t;

  const r = 0.16 - s * 0.12;
  const g = 0.71 - s * 0.61;
  const b = 0.83 - s * 0.60;

  return [r, g, b];
}

/**
 * Build ocean geometry clipped to the sea-level contour.
 *
 * Fully submerged cells become quads. Shoreline cells become clipped polygons
 * whose border vertices lie where terrain height crosses sea level.
 *
 * @param oceanTiles - Array of ocean tiles
 * @param chunkData  - Chunk data for heightmap and coordinate calculations
 * @param config     - Water configuration
 * @returns BufferGeometry for ocean surface, or null if no ocean tiles
 */
export function buildOceanGeometry(
  oceanTiles: OceanTile[],
  chunkData: ChunkData,
  config: WaterConfig
): THREE.BufferGeometry | null {
  if (oceanTiles.length === 0) {
    return null;
  }

  const { size } = chunkData;
  const seaLevel = config.seaLevel;

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
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

      positions.push(worldX, seaLevel * HEIGHT_SCALE + 0.15, worldZ);
      normals.push(0, 1, 0);
      colors.push(r, g, b);
      uvs.push(point.x / size, point.z / size);
      vertexCount++;
    }

    for (let i = 1; i < polygon.length - 1; i++) {
      indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
    }
  }

  if (vertexCount === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);

  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return geometry;
}

function buildSeaLevelPolygon(
  tx: number,
  ty: number,
  chunkData: ChunkData,
  seaLevel: number,
): ContourPoint[] {
  const corners = [
    sampleContourPoint(tx, ty, chunkData, seaLevel),
    sampleContourPoint(tx + 1, ty, chunkData, seaLevel),
    sampleContourPoint(tx + 1, ty + 1, chunkData, seaLevel),
    sampleContourPoint(tx, ty + 1, chunkData, seaLevel),
  ];

  const polygon: ContourPoint[] = [];
  for (let i = 0; i < corners.length; i++) {
    const current = corners[i];
    const previous = corners[(i + corners.length - 1) % corners.length];
    const currentInside = current.field >= 0;
    const previousInside = previous.field >= 0;

    if (currentInside !== previousInside) {
      polygon.push(interpolateContourPoint(previous, current));
    }
    if (currentInside) {
      polygon.push(current);
    }
  }

  return polygon;
}

function sampleContourPoint(
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

function interpolateContourPoint(a: ContourPoint, b: ContourPoint): ContourPoint {
  const denominator = a.field - b.field;
  const t = Math.abs(denominator) > CONTOUR_EPSILON
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
