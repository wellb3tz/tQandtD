/**
 * River mesh generator for water system
 * 
 * Creates water meshes following river network paths with widths based on flow data.
 * Positions river water at terrain height with smooth width transitions between segments.
 */

import * as THREE from 'three';
import type { ChunkData } from '../../../../src/world/chunk';
import type { RiverNetwork, RiverSegment } from '../../../../src/gen/rivers';
import type { WaterConfig } from './types';
import { HEIGHT_SCALE } from './config';

/**
 * Generate river meshes for all river segments in a chunk
 * 
 * Creates individual meshes for each river segment with width based on flow.
 * River water is positioned at terrain height + waterOffset to prevent z-fighting.
 * 
 * @param chunkData - Chunk data containing heightmap and size
 * @param riverNetwork - River network data with segments
 * @param config - Water configuration
 * @returns Array of river meshes
 */
export function generateRiverMeshes(
  chunkData: ChunkData,
  riverNetwork: RiverNetwork,
  config: WaterConfig
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  if (!riverNetwork || riverNetwork.segments.length === 0) {
    return meshes;
  }

  // Group segments into connected paths for better mesh generation
  const paths = groupSegmentsIntoPaths(riverNetwork.segments);

  // Create a mesh for each path
  for (const path of paths) {
    const geometry = buildRiverPathGeometry(path, chunkData, config);
    if (geometry) {
      const material = new THREE.MeshPhongMaterial({
        color: config.river.color,
        transparent: true,
        opacity: config.river.opacity,
        shininess: config.river.shininess,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 1; // Render after terrain but before other water
      meshes.push(mesh);
    }
  }

  return meshes;
}

/**
 * Group river segments into connected paths
 * 
 * Segments that are connected via the 'next' property are grouped together
 * to create continuous river paths for more efficient mesh generation.
 * 
 * @param segments - Array of river segments
 * @returns Array of segment paths (each path is an array of connected segments)
 */
function groupSegmentsIntoPaths(segments: RiverSegment[]): RiverSegment[][] {
  const paths: RiverSegment[][] = [];
  const processed = new Set<number>();

  // Build index map for quick lookup
  const segmentMap = new Map<number, RiverSegment>();
  for (const segment of segments) {
    segmentMap.set(segment.index, segment);
  }

  // Find all path starting points (segments with no upstream connection)
  const hasUpstream = new Set<number>();
  for (const segment of segments) {
    if (segment.next !== -1) {
      hasUpstream.add(segment.next);
    }
  }

  // Trace each path from its starting point
  for (const segment of segments) {
    // Skip if already processed or if this segment has an upstream connection
    if (processed.has(segment.index) || hasUpstream.has(segment.index)) {
      continue;
    }

    // Trace path from this starting point
    const path: RiverSegment[] = [];
    let current: RiverSegment | undefined = segment;

    while (current && !processed.has(current.index)) {
      path.push(current);
      processed.add(current.index);

      // Move to next segment
      if (current.next !== -1) {
        current = segmentMap.get(current.next);
      } else {
        current = undefined;
      }
    }

    if (path.length > 0) {
      paths.push(path);
    }
  }

  return paths;
}

/**
 * Build geometry for a river path
 * 
 * Creates a ribbon-like mesh following the river path with width varying
 * based on flow data. Implements smooth width transitions between segments.
 * 
 * @param path - Array of connected river segments
 * @param chunkData - Chunk data for terrain height lookup
 * @param config - Water configuration
 * @returns BufferGeometry for river path, or null if path is empty
 */
function buildRiverPathGeometry(
  path: RiverSegment[],
  chunkData: ChunkData,
  config: WaterConfig
): THREE.BufferGeometry | null {
  if (path.length === 0) {
    return null;
  }

  const { heightmap, size } = chunkData;
  const vertexSize = size + 1;
  const waterOffset = config.rendering.waterOffset * HEIGHT_SCALE;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Generate geometry for each segment
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const nextSegment = i < path.length - 1 ? path[i + 1] : null;

    // Get segment position
    const localX = segment.index % size;
    const localY = Math.floor(segment.index / size);

    // Get terrain height at this position (sample from heightmap)
    const vx = Math.min(localX, size);
    const vy = Math.min(localY, size);
    const heightIndex = vy * vertexSize + vx;
    const terrainHeight = heightmap[heightIndex] * HEIGHT_SCALE;
    const riverElevation = terrainHeight + waterOffset;

    // Calculate world coordinates for this segment
    const worldX = chunkData.x * size + localX;
    const worldZ = chunkData.y * size + localY;

    // Calculate river width (convert from tiles to local units)
    const width = segment.width * 0.5; // Half-width for each side

    // Calculate direction to next segment for proper orientation
    let dirX = 0;
    let dirY = 1; // Default direction if no next segment

    if (nextSegment) {
      const nextLocalX = nextSegment.index % size;
      const nextLocalY = Math.floor(nextSegment.index / size);
      dirX = nextLocalX - localX;
      dirY = nextLocalY - localY;

      // Normalize direction
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length > 0) {
        dirX /= length;
        dirY /= length;
      }
    } else if (i > 0) {
      // Use direction from previous segment
      const prevSegment = path[i - 1];
      const prevLocalX = prevSegment.index % size;
      const prevLocalY = Math.floor(prevSegment.index / size);
      dirX = localX - prevLocalX;
      dirY = localY - prevLocalY;

      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      if (length > 0) {
        dirX /= length;
        dirY /= length;
      }
    }

    // Calculate perpendicular direction for width
    const perpX = -dirY;
    const perpY = dirX;

    // Create cross-section vertices (left and right edges) using world coordinates
    const leftX = worldX + perpX * width;
    const leftZ = worldZ + perpY * width;
    const rightX = worldX - perpX * width;
    const rightZ = worldZ - perpY * width;

    // Add vertices for this cross-section
    const baseIndex = positions.length / 3;
    positions.push(
      leftX, riverElevation, leftZ,   // Left edge
      rightX, riverElevation, rightZ  // Right edge
    );

    // Normals pointing up
    normals.push(0, 1, 0);
    normals.push(0, 1, 0);

    // UV coordinates (u varies across width, v along length)
    const vCoord = i / Math.max(1, path.length - 1);
    uvs.push(0, vCoord);  // Left edge
    uvs.push(1, vCoord);  // Right edge

    // Create triangles connecting to previous cross-section
    if (i > 0) {
      const prevBase = baseIndex - 2;
      indices.push(
        prevBase, prevBase + 1, baseIndex,      // Triangle 1
        baseIndex, prevBase + 1, baseIndex + 1  // Triangle 2
      );
    }
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
