/**
 * Shoreline transition smoothing utilities
 * 
 * Creates smooth transitions at water-land boundaries to prevent abrupt
 * elevation discontinuities and visual artifacts.
 */

import * as THREE from 'three';
import type { ChunkData } from '../../../../src/world/chunk';

/**
 * Shoreline transition data
 */
export interface ShorelineTransition {
  /** Tile index */
  tileIndex: number;
  /** Water elevation at this point */
  waterElevation: number;
  /** Terrain elevation at this point */
  terrainElevation: number;
  /** Elevation difference */
  elevationDifference: number;
  /** Whether this is a smooth transition */
  isSmooth: boolean;
}

/**
 * Analyze shoreline transitions in a chunk
 * 
 * Identifies water-land boundaries and measures elevation differences
 * 
 * @param waterTiles - Set of tile indices with water
 * @param chunkData - Chunk data with heightmap
 * @param waterElevation - Water surface elevation
 * @returns Array of shoreline transitions
 */
export function analyzeShorelineTransitions(
  waterTiles: Set<number>,
  chunkData: ChunkData,
  waterElevation: number
): ShorelineTransition[] {
  const transitions: ShorelineTransition[] = [];
  const { heightmap, size } = chunkData;
  const vertexSize = size + 1;
  const maxSmoothDifference = 0.5; // Maximum elevation difference for smooth transition

  // Check each water tile for adjacent land tiles
  for (const tileIndex of waterTiles) {
    const localX = tileIndex % size;
    const localY = Math.floor(tileIndex / size);

    // Check 4 adjacent tiles (N, S, E, W)
    const neighbors = [
      { x: localX - 1, y: localY },     // West
      { x: localX + 1, y: localY },     // East
      { x: localX, y: localY - 1 },     // North
      { x: localX, y: localY + 1 },     // South
    ];

    for (const neighbor of neighbors) {
      // Skip out of bounds
      if (neighbor.x < 0 || neighbor.x >= size || neighbor.y < 0 || neighbor.y >= size) {
        continue;
      }

      const neighborIndex = neighbor.y * size + neighbor.x;

      // Check if neighbor is land (not water)
      if (!waterTiles.has(neighborIndex)) {
        // Get terrain height at neighbor
        const vx = Math.min(neighbor.x, size);
        const vy = Math.min(neighbor.y, size);
        const heightIndex = vy * vertexSize + vx;
        const terrainHeight = heightmap[heightIndex];

        const elevationDiff = Math.abs(waterElevation - terrainHeight);
        const isSmooth = elevationDiff <= maxSmoothDifference;

        transitions.push({
          tileIndex: neighborIndex,
          waterElevation,
          terrainElevation: terrainHeight,
          elevationDifference: elevationDiff,
          isSmooth,
        });
      }
    }
  }

  return transitions;
}

/**
 * Check if all shoreline transitions are smooth
 * 
 * @param transitions - Array of shoreline transitions
 * @returns True if all transitions are smooth
 */
export function areTransitionsSmooth(transitions: ShorelineTransition[]): boolean {
  return transitions.every(t => t.isSmooth);
}

/**
 * Calculate smoothness score for shoreline transitions
 * 
 * Returns a value between 0 (not smooth) and 1 (perfectly smooth)
 * 
 * @param transitions - Array of shoreline transitions
 * @returns Smoothness score (0-1)
 */
export function calculateSmoothnessScore(transitions: ShorelineTransition[]): number {
  if (transitions.length === 0) {
    return 1.0; // No transitions = perfectly smooth
  }

  const smoothCount = transitions.filter(t => t.isSmooth).length;
  return smoothCount / transitions.length;
}

/**
 * Get maximum elevation discontinuity in shoreline transitions
 * 
 * @param transitions - Array of shoreline transitions
 * @returns Maximum elevation difference
 */
export function getMaxElevationDiscontinuity(transitions: ShorelineTransition[]): number {
  if (transitions.length === 0) {
    return 0;
  }

  return Math.max(...transitions.map(t => t.elevationDifference));
}

/**
 * Smooth river path elevations along segments
 * 
 * Ensures smooth elevation changes along river paths by interpolating
 * between segment elevations
 * 
 * @param segmentElevations - Array of elevations for each river segment
 * @param smoothingFactor - Smoothing factor (0-1), higher = more smoothing
 * @returns Smoothed elevations
 */
export function smoothRiverPathElevations(
  segmentElevations: number[],
  smoothingFactor: number = 0.5
): number[] {
  if (segmentElevations.length <= 2) {
    return [...segmentElevations]; // No smoothing needed
  }

  const smoothed = [...segmentElevations];

  // Apply simple moving average smoothing
  for (let i = 1; i < smoothed.length - 1; i++) {
    const prev = segmentElevations[i - 1];
    const curr = segmentElevations[i];
    const next = segmentElevations[i + 1];

    // Weighted average with neighbors
    const avg = (prev + curr * 2 + next) / 4;
    smoothed[i] = curr * (1 - smoothingFactor) + avg * smoothingFactor;
  }

  return smoothed;
}

/**
 * Blend water edge with terrain at boundaries
 * 
 * Creates a smooth visual transition by adjusting water mesh vertices
 * near shorelines
 * 
 * @param waterGeometry - Water geometry to blend
 * @param chunkData - Chunk data with heightmap
 * @param waterTiles - Set of water tile indices
 * @param blendDistance - Distance over which to blend (in tiles)
 * @returns Modified geometry with blended edges
 */
export function blendWaterEdgesWithTerrain(
  waterGeometry: THREE.BufferGeometry,
  chunkData: ChunkData,
  waterTiles: Set<number>,
  blendDistance: number = 0.5
): THREE.BufferGeometry {
  const positions = waterGeometry.getAttribute('position');
  const { size } = chunkData;

  // Create a map of water tiles for quick lookup
  const waterTileMap = new Set(waterTiles);

  // Process each vertex
  for (let i = 0; i < positions.count; i++) {
    const localX = positions.getX(i);
    const localZ = positions.getZ(i);

    // Determine which tile this vertex belongs to
    const tileX = Math.floor(localX);
    const tileZ = Math.floor(localZ);
    const tileIndex = tileZ * size + tileX;

    // Check if this tile is at the edge (has non-water neighbors)
    if (waterTileMap.has(tileIndex)) {
      const isEdge = isEdgeTile(tileIndex, size, waterTileMap);

      if (isEdge) {
        // Edge tile - could apply blending here if needed
        // For now, we maintain the water elevation but mark it as an edge
        // Future enhancement: adjust vertex elevation slightly for smoother visual transition
      }
    }
  }

  // Mark geometry as needing update
  positions.needsUpdate = true;

  return waterGeometry;
}

/**
 * Check if a tile is at the edge of a water body
 * 
 * @param tileIndex - Tile index to check
 * @param size - Chunk size
 * @param waterTiles - Set of water tile indices
 * @returns True if tile has at least one non-water neighbor
 */
function isEdgeTile(tileIndex: number, size: number, waterTiles: Set<number>): boolean {
  const localX = tileIndex % size;
  const localY = Math.floor(tileIndex / size);

  // Check 4 adjacent tiles
  const neighbors = [
    { x: localX - 1, y: localY },
    { x: localX + 1, y: localY },
    { x: localX, y: localY - 1 },
    { x: localX, y: localY + 1 },
  ];

  for (const neighbor of neighbors) {
    // Out of bounds counts as non-water
    if (neighbor.x < 0 || neighbor.x >= size || neighbor.y < 0 || neighbor.y >= size) {
      return true;
    }

    const neighborIndex = neighbor.y * size + neighbor.x;
    if (!waterTiles.has(neighborIndex)) {
      return true; // Has non-water neighbor
    }
  }

  return false; // All neighbors are water
}

/**
 * Validate shoreline smoothness
 * 
 * Checks that shoreline transitions meet smoothness criteria
 * 
 * @param transitions - Array of shoreline transitions
 * @param maxAllowedDiscontinuity - Maximum allowed elevation difference
 * @returns Validation result with details
 */
export function validateShorelineSmoothness(
  transitions: ShorelineTransition[],
  maxAllowedDiscontinuity: number = 0.5
): {
  valid: boolean;
  smoothnessScore: number;
  maxDiscontinuity: number;
  problematicTransitions: ShorelineTransition[];
} {
  const smoothnessScore = calculateSmoothnessScore(transitions);
  const maxDiscontinuity = getMaxElevationDiscontinuity(transitions);
  const problematicTransitions = transitions.filter(
    t => t.elevationDifference > maxAllowedDiscontinuity
  );

  return {
    valid: maxDiscontinuity <= maxAllowedDiscontinuity,
    smoothnessScore,
    maxDiscontinuity,
    problematicTransitions,
  };
}
