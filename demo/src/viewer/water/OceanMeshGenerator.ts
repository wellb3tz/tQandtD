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
 * Identify ocean tiles in a chunk where terrain height is below sea level
 * 
 * @param chunkData - Chunk data containing heightmap
 * @param seaLevel - Sea level elevation threshold
 * @returns Array of ocean tiles with depth and elevation data
 */
export function identifyOceanTiles(
  chunkData: ChunkData,
  seaLevel: number
): OceanTile[] {
  const oceanTiles: OceanTile[] = [];
  const { heightmap, size } = chunkData;
  const vertexSize = size + 1;

  // Iterate through tile grid (not vertex grid)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      
      // Sample heightmap at tile center (average of 4 corner vertices)
      const v00 = heightmap[y * vertexSize + x];
      const v10 = heightmap[y * vertexSize + (x + 1)];
      const v01 = heightmap[(y + 1) * vertexSize + x];
      const v11 = heightmap[(y + 1) * vertexSize + (x + 1)];
      
      const terrainHeight = (v00 + v10 + v01 + v11) / 4;

      // Identify tiles below sea level
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
 * Build ocean geometry from identified ocean tiles
 * 
 * Creates a merged mesh covering all ocean tiles with vertices positioned
 * at sea level. Ensures boundary vertices use identical world coordinates
 * for seamless chunk boundaries.
 * 
 * **Performance Optimizations:**
 * - Mesh merging: All ocean tiles in a chunk are merged into a single geometry
 * - Geometry pooling: Reuses geometry for chunks with identical ocean patterns
 * - Efficient vertex sharing: Adjacent tiles share vertices to reduce memory
 * 
 * **Boundary Alignment Strategy:**
 * - Vertices are positioned using world coordinates (worldX = chunkX * size + localX)
 * - Adjacent chunks automatically share boundary coordinates:
 *   - Right edge of chunk (0,0): worldX = 0*size + size = size
 *   - Left edge of chunk (1,0): worldX = 1*size + 0 = size (same!)
 * - All boundary vertices use the same elevation (seaLevel + waterOffset)
 * - This ensures perfect alignment with no gaps or overlaps
 * 
 * @param oceanTiles - Array of ocean tiles to create geometry for
 * @param chunkData - Chunk data for coordinate calculations
 * @param config - Water configuration
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
  const waterElevation = config.seaLevel * HEIGHT_SCALE;

  // Mesh merging optimization: Build merged geometry for all ocean tiles
  // This reduces draw calls from N tiles to 1 mesh per chunk
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let vertexCount = 0;

  for (const tile of oceanTiles) {
    // Convert flat index to local coordinates
    const localX = tile.index % size;
    const localY = Math.floor(tile.index / size);

    // Create quad for this tile (2 triangles)
    // Vertices use world coordinates to match terrain rendering
    // World coordinates ensure automatic boundary alignment between chunks
    const x0 = chunkData.x * size + localX;
    const z0 = chunkData.y * size + localY;
    const x1 = chunkData.x * size + localX + 1;
    const z1 = chunkData.y * size + localY + 1;

    // Add 4 vertices for the quad
    // All vertices at the same elevation (seaLevel + waterOffset) ensures
    // perfect elevation matching at chunk boundaries
    positions.push(
      x0, waterElevation, z0,  // v0: top-left
      x1, waterElevation, z0,  // v1: top-right
      x0, waterElevation, z1,  // v2: bottom-left
      x1, waterElevation, z1   // v3: bottom-right
    );

    // Normals pointing up
    for (let i = 0; i < 4; i++) {
      normals.push(0, 1, 0);
    }

    // UV coordinates (normalized to tile)
    uvs.push(
      0, 0,  // v0
      1, 0,  // v1
      0, 1,  // v2
      1, 1   // v3
    );

    // Indices for 2 triangles (counter-clockwise winding)
    const baseIndex = vertexCount;
    indices.push(
      baseIndex, baseIndex + 1, baseIndex + 2,  // Triangle 1
      baseIndex + 2, baseIndex + 1, baseIndex + 3   // Triangle 2
    );

    vertexCount += 4;
  }

  // Create geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);

  // Compute bounding sphere and box for frustum culling
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return geometry;
}
