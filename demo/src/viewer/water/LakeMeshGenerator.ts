/**
 * Lake mesh generator for water system
 * 
 * Creates water meshes for lakes at their elevation levels with smooth surfaces
 * across all lake tiles. Handles lake-river outlet connections seamlessly.
 */

import * as THREE from 'three';
import type { ChunkData } from '../../../../src/world/chunk';
import type { RiverNetwork, Lake } from '../../../../src/gen/rivers';
import type { WaterConfig } from './types';
import { HEIGHT_SCALE } from './config';

/**
 * Generate lake meshes for all lakes in a chunk
 * 
 * Creates individual meshes for each lake with water positioned at lake elevation.
 * Lake water is positioned at lake.elevation + waterOffset to prevent z-fighting.
 * Handles lake-river outlet connections for seamless transitions.
 * 
 * @param chunkData - Chunk data containing heightmap and size
 * @param riverNetwork - River network data with lakes
 * @param config - Water configuration
 * @returns Array of lake meshes
 */
export function generateLakeMeshes(
  chunkData: ChunkData,
  riverNetwork: RiverNetwork,
  config: WaterConfig
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  if (!riverNetwork || riverNetwork.lakes.length === 0) {
    return meshes;
  }

  // Create a mesh for each lake
  for (const lake of riverNetwork.lakes) {
    const geometry = buildLakeGeometry(lake, chunkData, config);
    if (geometry) {
      const material = new THREE.MeshPhongMaterial({
        color: config.lake.color,
        transparent: true,
        opacity: config.lake.opacity,
        shininess: config.lake.shininess,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 2; // Render after terrain and rivers
      meshes.push(mesh);
    }
  }

  return meshes;
}

/**
 * Build geometry for a lake
 * 
 * Creates a smooth surface mesh covering all lake tiles at the lake's elevation.
 * Uses a merged quad approach for efficient rendering.
 * 
 * @param lake - Lake data with tiles and elevation
 * @param chunkData - Chunk data for coordinate calculations
 * @param config - Water configuration
 * @returns BufferGeometry for lake surface, or null if lake is empty
 */
function buildLakeGeometry(
  lake: Lake,
  chunkData: ChunkData,
  config: WaterConfig
): THREE.BufferGeometry | null {
  if (lake.tiles.size === 0) {
    return null;
  }

  const { size } = chunkData;
  const waterElevation = (lake.elevation + config.rendering.waterOffset) * HEIGHT_SCALE;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let vertexCount = 0;

  // Convert lake tiles to array for iteration
  const lakeTilesArray = Array.from(lake.tiles);

  // Create a quad for each lake tile
  for (const tileIndex of lakeTilesArray) {
    // Convert flat index to local coordinates
    const localX = tileIndex % size;
    const localY = Math.floor(tileIndex / size);

    // Create quad for this tile using world coordinates
    // This ensures alignment with terrain and ocean meshes
    const x0 = chunkData.x * size + localX;
    const z0 = chunkData.y * size + localY;
    const x1 = chunkData.x * size + localX + 1;
    const z1 = chunkData.y * size + localY + 1;

    // Add 4 vertices for the quad at lake elevation
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
      baseIndex, baseIndex + 1, baseIndex + 2,      // Triangle 1
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

  // Compute bounding sphere for frustum culling
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return geometry;
}
