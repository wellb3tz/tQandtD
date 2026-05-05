/**
 * Lake mesh generator
 *
 * Converts LakeData into Three.js geometry for rendering inland water bodies.
 * Lake shorelines are generated with marching squares so the rendered water
 * follows the basin contour instead of exposing square tile edges.
 */

import * as THREE from 'three';
import type { ChunkData } from '@engine/world/chunk';
import type { LakeData } from '../../../../src/gen/lakes';
import type { LakeTile, LakeRenderConfig } from './types';
import { HEIGHT_SCALE } from './config';

const OUTSIDE_LAKE_EPSILON = 1e-6;

// Tile identification

/**
 * Convert LakeData tile sets into LakeTile arrays suitable for mesh building.
 *
 * @param chunkData - Chunk data (heightmap + size)
 * @param lakes     - Lake bodies from LakeGenerator or LakeManager
 * @returns Flat array of LakeTile objects across all lakes in the chunk
 */
export function identifyLakeTiles(
  chunkData: ChunkData,
  lakes: LakeData[],
): LakeTile[] {
  const { heightmap, size } = chunkData;
  const vertexSize = size + 1;
  const result: LakeTile[] = [];

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

// Color helpers

/**
 * Compute lake surface vertex color based on depth.
 *
 * @param depth    - Depth below lake surface
 * @param maxDepth - Maximum depth of this lake body
 * @returns [r, g, b] in [0, 1]
 */
function lakeDepthColor(depth: number, maxDepth: number): [number, number, number] {
  const t = maxDepth > 0 ? Math.min(depth / maxDepth, 1.0) : 0;
  const s = t * t;

  const r = 0.31 - s * 0.24;
  const g = 0.76 - s * 0.48;
  const b = 0.83 - s * 0.48;

  return [r, g, b];
}

interface ContourPoint {
  x: number;
  z: number;
  field: number;
  terrainHeight: number;
}

// Geometry builder

/**
 * Build a BufferGeometry for all lake tiles in a chunk.
 *
 * Each lake is clipped against the local terrain height field with marching
 * squares. Interior cells become full quads; shoreline cells become clipped
 * polygons whose edges sit on the water-level contour of the basin.
 *
 * @param lakeTiles - Flat array of lake tiles (all lakes in the chunk)
 * @param lakes     - Original lake bodies
 * @param chunkData - Chunk data
 * @returns BufferGeometry or null if no lake tiles
 */
export function buildLakeGeometry(
  lakeTiles: LakeTile[],
  lakes: LakeData[],
  chunkData: ChunkData,
): THREE.BufferGeometry | null {
  if (lakeTiles.length === 0) return null;

  const { size } = chunkData;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  for (const lake of lakes) {
    if (lake.tiles.size === 0) continue;

    const waterY = lake.waterLevel;
    const maxDepth = lake.maxDepth;
    const candidateCells = collectLakeContourCells(lake.tiles, size);

    for (const cellIdx of candidateCells) {
      const tx = cellIdx % size;
      const ty = Math.floor(cellIdx / size);
      const polygon = buildMarchingSquarePolygon(tx, ty, lake.tiles, chunkData, waterY);

      if (polygon.length < 3) {
        continue;
      }

      const baseIndex = vertexCount;
      for (const point of polygon) {
        const worldX = chunkData.x * size + point.x;
        const worldZ = chunkData.y * size + point.z;
        const depth = Math.max(0, waterY - point.terrainHeight);
        const [r, g, b] = lakeDepthColor(depth, maxDepth);

        positions.push(worldX, waterY * HEIGHT_SCALE + 0.15, worldZ);
        normals.push(0, 1, 0);
        colors.push(r, g, b);
        uvs.push(point.x / size, point.z / size);
        vertexCount++;
      }

      for (let i = 1; i < polygon.length - 1; i++) {
        indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
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

  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return geometry;
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

function buildMarchingSquarePolygon(
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

function interpolateContourPoint(a: ContourPoint, b: ContourPoint): ContourPoint {
  const denominator = a.field - b.field;
  const t = Math.abs(denominator) > OUTSIDE_LAKE_EPSILON
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

// Material factory

/**
 * Create a Phong material for lake water.
 *
 * Uses vertexColors so the depth gradient baked into the geometry is visible.
 * The base color is white to avoid tinting the vertex colors.
 *
 * @param config - Lake render configuration
 */
export function createLakeMaterial(config: LakeRenderConfig): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
    specular: new THREE.Color(0x88ffcc),
  });
}
