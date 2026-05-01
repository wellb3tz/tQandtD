/**
 * Lake mesh generator
 *
 * Converts LakeData (from the engine's LakeGenerator) into Three.js geometry
 * for rendering inland water bodies.
 *
 * Visual design (temporary, for testing):
 *   Flat water surface at lakeData.waterLevel * HEIGHT_SCALE.
 *   Vivid green color (#00ff88) so lakes are immediately distinguishable
 *   from the ocean (turquoise → navy).  Color will be replaced with a
 *   realistic palette after visual testing.
 */

import * as THREE from 'three';
import type { ChunkData } from '@engine/world/chunk';
import type { LakeData } from '../../../../src/gen/lakes';
import type { LakeTile, LakeRenderConfig } from './types';
import { HEIGHT_SCALE } from './config';

const SHORELINE_EXPANSION = 1.15;

// ─── Tile identification ──────────────────────────────────────────────────────

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
      // Ensure tile index is within chunk bounds
      if (tileIdx < 0 || tileIdx >= size * size) {
        continue; // Skip tiles outside chunk
      }

      const tx = tileIdx % size;
      const ty = Math.floor(tileIdx / size);

      // Ensure vertex indices are within heightmap bounds
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

// ─── Color helpers ────────────────────────────────────────────────────────────

/**
 * Compute lake surface vertex color based on depth.
 *
 * Freshwater palette — warmer and greener than the ocean (which goes navy-blue):
 *   shallow → light cyan-teal  #4fc3d4  (sunlit freshwater)
 *   deep    → dark teal-green  #1a5c6e  (deep lake)
 *
 * Ocean for reference: shallow #29b6d4 → deep #0a1a3a (dark navy).
 * Lakes are visually distinct: greener mid-tones, lighter deep colour.
 *
 * @param depth      - Depth below lake surface (≥ 0)
 * @param maxDepth   - Maximum depth of this lake body
 * @returns [r, g, b] in [0, 1]
 */
function lakeDepthColor(depth: number, maxDepth: number): [number, number, number] {
  const t = maxDepth > 0 ? Math.min(depth / maxDepth, 1.0) : 0;
  const s = t * t; // quadratic curve — emphasise shallow gradient

  // Shallow (t=0): #4fc3d4 → r=0.31, g=0.76, b=0.83
  // Deep    (t=1): #1a5c6e → r=0.10, g=0.36, b=0.43
  const r = 0.31 - s * 0.21;
  const g = 0.76 - s * 0.40;
  const b = 0.83 - s * 0.40;

  return [r, g, b];
}

// ─── Geometry builder ─────────────────────────────────────────────────────────

/**
 * Build a BufferGeometry for all lake tiles in a chunk.
 *
 * Each LakeData is a single closed basin with one waterLevel.  All tiles
 * belonging to the same lake share a single flat vertex grid at that level,
 * so there are no gaps or steps between adjacent tiles of the same lake.
 *
 * Different lakes (different waterLevel values) each get their own vertex
 * grid, but since they are physically separate basins they never share edges
 * and therefore never produce visible seams.
 *
 * @param lakeTiles - Flat array of lake tiles (all lakes in the chunk)
 * @param lakes     - Original lake bodies (for maxDepth and tile membership)
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
  const vertexSize = size + 1;

  const positions: number[] = [];
  const normals:   number[] = [];
  const colors:    number[] = [];
  const uvs:       number[] = [];
  const indices:   number[] = [];
  let vertexCount = 0;

  // Process each lake independently so all its tiles share one flat surface.
  for (const lake of lakes) {
    if (lake.tiles.size === 0) continue;

    const maxDepth = lake.maxDepth;

    // Use consistent water height across all chunks for this lake.
    // If minTerrainHeight is available (multi-chunk lakes), position water
    // closer to the bottom for more dramatic visual effect.
    // Water at 1/3 from bottom: minTerrainHeight + (waterLevel - minTerrainHeight) * 0.33
    // This gives more visible depth while keeping consistency across chunks.
    const waterY = lake.minTerrainHeight !== undefined
      ? lake.minTerrainHeight + (lake.waterLevel - lake.minTerrainHeight) * 0.33
      : lake.waterLevel;

    // One vertex map per lake — key = vy * vertexSize + vx
    const vmap = new Int32Array(vertexSize * vertexSize).fill(-1);

    const getVertex = (vx: number, vy: number): number => {
      const key = vy * vertexSize + vx;
      if (vmap[key] !== -1) return vmap[key];

      const shorelineOffset = getShorelineOffset(vx, vy, lake.tiles, size);
      const worldX = chunkData.x * size + vx + shorelineOffset.x;
      const worldZ = chunkData.y * size + vy + shorelineOffset.z;

      // Depth at this vertex relative to the lake surface
      const terrainH = chunkData.heightmap[key];
      const depth = Math.max(0, waterY - terrainH);
      const [r, g, b] = lakeDepthColor(depth, maxDepth);

      // Water surface sits halfway between the deepest terrain point and the lake rim
      positions.push(worldX, waterY * HEIGHT_SCALE + 0.15, worldZ);
      normals.push(0, 1, 0);
      colors.push(r, g, b);
      uvs.push(vx / size, vy / size);

      vmap[key] = vertexCount;
      return vertexCount++;
    };

    for (const tileIdx of lake.tiles) {
      const tx = tileIdx % size;
      const ty = Math.floor(tileIdx / size);

      const i00 = getVertex(tx,     ty    );
      const i10 = getVertex(tx + 1, ty    );
      const i01 = getVertex(tx,     ty + 1);
      const i11 = getVertex(tx + 1, ty + 1);

      indices.push(i00, i10, i01);
      indices.push(i01, i10, i11);
    }
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

// ─── Material factory ─────────────────────────────────────────────────────────

/**
 * Push edge vertices slightly outward so the rendered surface overlaps the
 * carved basin rim and hides square tile boundaries along the shoreline.
 */
function getShorelineOffset(
  vx: number,
  vy: number,
  lakeTiles: Set<number>,
  size: number,
): { x: number; z: number } {
  const hasTile = (tx: number, ty: number): boolean => {
    return tx >= 0 && ty >= 0 && tx < size && ty < size && lakeTiles.has(ty * size + tx);
  };

  const topLeft = hasTile(vx - 1, vy - 1);
  const topRight = hasTile(vx, vy - 1);
  const bottomLeft = hasTile(vx - 1, vy);
  const bottomRight = hasTile(vx, vy);

  const hasLeft = topLeft || bottomLeft;
  const hasRight = topRight || bottomRight;
  const hasTop = topLeft || topRight;
  const hasBottom = bottomLeft || bottomRight;

  let x = 0;
  let z = 0;

  if (hasRight && !hasLeft) x -= SHORELINE_EXPANSION;
  if (hasLeft && !hasRight) x += SHORELINE_EXPANSION;
  if (hasBottom && !hasTop) z -= SHORELINE_EXPANSION;
  if (hasTop && !hasBottom) z += SHORELINE_EXPANSION;

  // Keep visual overlap inside the owning chunk. Neighbor chunks render their
  // own water mesh, so crossing this boundary can create z-fighting/overlap.
  if (vx === 0 && x < 0) x = 0;
  if (vx === size && x > 0) x = 0;
  if (vy === 0 && z < 0) z = 0;
  if (vy === size && z > 0) z = 0;

  if (x !== 0 && z !== 0) {
    const diagonalScale = 1 / Math.sqrt(2);
    x *= diagonalScale;
    z *= diagonalScale;
  }

  return { x, z };
}

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
    color: 0xffffff,       // white base — vertex colors carry the actual hue
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
    specular: new THREE.Color(0x88ffcc), // greenish specular highlight
  });
}
