/**
 * Ocean mesh generator for water system
 * 
 * Identifies ocean tiles (height < seaLevel) and creates water surface meshes
 * at sea level with proper positioning and boundary alignment.
 */

import * as THREE from 'three';
import type { ChunkData } from '@engine/world/chunk';
import type { WaterConfig, OceanTile } from './types';
import { HEIGHT_SCALE } from './config';

/**
 * Identify ocean tiles in a chunk where terrain height is below sea level.
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

      if (terrainHeight < seaLevel) {
        oceanTiles.push({
          index,
          terrainHeight,
          waterElevation: seaLevel,
          underwaterDepth: seaLevel - terrainHeight,
        });
      }
    }
  }

  return oceanTiles;
}

/**
 * Calculate water surface color based on depth below sea level.
 * Shallow water → bright turquoise, deep water → dark navy blue.
 *
 * @param depth - Depth below sea level in [0, seaLevel] range
 * @param seaLevel - Sea level threshold
 * @returns RGB color components in [0, 1] range
 */
function depthColor(depth: number, seaLevel: number): [number, number, number] {
  // Normalise depth: 0 = surface, 1 = maximum depth
  const t = Math.min(depth / seaLevel, 1.0);

  // Smooth curve — emphasise shallow gradient more than deep
  const s = t * t;

  // Shallow (t=0): bright turquoise  #29b6d4  → r=0.16, g=0.71, b=0.83
  // Deep    (t=1): dark navy         #0a1a3a  → r=0.04, g=0.10, b=0.23
  const r = 0.16 - s * 0.12;
  const g = 0.71 - s * 0.61;
  const b = 0.83 - s * 0.60;

  return [r, g, b];
}

/**
 * Build ocean geometry as a single unified grid mesh for the entire chunk.
 *
 * Uses a (chunkSize+1) × (chunkSize+1) vertex grid — identical topology to
 * the terrain mesh — so vertex colors are smoothly interpolated across the
 * whole chunk with no visible tile boundaries or diamond patterns.
 *
 * Only tiles where ALL four corner vertices are below sea level are included;
 * boundary tiles that straddle the shoreline are skipped so the water edge
 * aligns cleanly with the terrain beach.
 *
 * @param oceanTiles - Array of ocean tiles (used to determine which cells are underwater)
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

  const { size, heightmap } = chunkData;
  const vertexSize = size + 1;
  const seaLevel = config.seaLevel;

  const positions: number[] = [];
  const normals:   number[] = [];
  const colors:    number[] = [];
  const uvs:       number[] = [];
  const indices:   number[] = [];

  // Shared vertex grid — separate maps for ocean (seaLevel) and lake (lakeLevel)
  // tiles because they sit at different Y elevations.
  const vertexIndex     = new Int32Array(vertexSize * vertexSize).fill(-1); // ocean
  const lakeVertexIndex = new Int32Array(vertexSize * vertexSize).fill(-1); // lake
  let vertexCount = 0;

  // Helper: get or create a vertex at grid position (vx, vy)
  const getVertex = (vx: number, vy: number, tileWaterElevation: number): number => {
    const key = vy * vertexSize + vx;
    const isLake = tileWaterElevation > seaLevel;
    const lookup = isLake ? lakeVertexIndex : vertexIndex;
    if (lookup[key] !== -1) return lookup[key];

    const worldX = chunkData.x * size + vx;
    const worldZ = chunkData.y * size + vy;

    const h = heightmap[key];
    const depth = Math.max(0, tileWaterElevation - h);

    const [r, g, b] = depthColor(depth, seaLevel);

    positions.push(worldX, tileWaterElevation * HEIGHT_SCALE + 0.15, worldZ);
    normals.push(0, 1, 0);
    colors.push(r, g, b);
    uvs.push(vx / size, vy / size);

    lookup[key] = vertexCount;
    return vertexCount++;
  };

  // Emit one quad (two triangles) per underwater/lake tile
  for (const tile of oceanTiles) {
    const tx = tile.index % size;
    const ty = Math.floor(tile.index / size);

    const i00 = getVertex(tx,     ty,     tile.waterElevation);
    const i10 = getVertex(tx + 1, ty,     tile.waterElevation);
    const i01 = getVertex(tx,     ty + 1, tile.waterElevation);
    const i11 = getVertex(tx + 1, ty + 1, tile.waterElevation);

    indices.push(i00, i10, i01);
    indices.push(i01, i10, i11);
  }

  if (vertexCount === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(normals),   3));
  geometry.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(colors),    3));
  geometry.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs),       2));
  geometry.setIndex(indices);

  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return geometry;
}
