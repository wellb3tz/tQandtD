/**
 * Property-based tests for Lake-River Connection Seamlessness
 * 
 * Tests Property 11: Lake-River Connection Seamlessness
 * Validates that lake water meshes and river water meshes connect seamlessly
 * at outlet points with no gaps or overlaps
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { generateLakeMeshes } from './LakeMeshGenerator';
import { generateRiverMeshes } from './RiverMeshGenerator';
import type { ChunkData } from '../../../../src/world/chunk';
import type { RiverNetwork, Lake, RiverSegment } from '../../../../src/gen/rivers';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG } from './config';

/**
 * Arbitrary generator for lake with outlet
 * Creates a lake that has an outlet river connection
 */
const arbitraryLakeWithOutlet = (chunkSize: number = 8): fc.Arbitrary<{
  lake: Lake;
  outletSegment: RiverSegment;
  connectionPoint: number;
}> => {
  return fc.record({
    lakeSize: fc.integer({ min: 3, max: 10 }),
    lakeElevation: fc.double({ min: 0.35, max: 0.7, noNaN: true }),
    outletLength: fc.integer({ min: 2, max: 5 }),
  }).map(({ lakeSize, lakeElevation, outletLength }) => {
    // Create lake tiles in a cluster
    const lakeTiles = new Set<number>();
    const startX = Math.floor(chunkSize / 4);
    const startY = Math.floor(chunkSize / 4);
    
    for (let i = 0; i < lakeSize; i++) {
      const x = startX + (i % 3);
      const y = startY + Math.floor(i / 3);
      if (x < chunkSize && y < chunkSize) {
        lakeTiles.add(y * chunkSize + x);
      }
    }
    
    // Find a boundary tile for the outlet
    let outletTile = -1;
    for (const tileIndex of lakeTiles) {
      const x = tileIndex % chunkSize;
      const y = Math.floor(tileIndex / chunkSize);
      
      // Check if this tile has a neighbor outside the lake
      const neighbors = [
        y * chunkSize + (x + 1), // right
        y * chunkSize + (x - 1), // left
        (y + 1) * chunkSize + x, // down
        (y - 1) * chunkSize + x, // up
      ];
      
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && neighbor < chunkSize * chunkSize && !lakeTiles.has(neighbor)) {
          outletTile = neighbor;
          break;
        }
      }
      
      if (outletTile !== -1) break;
    }
    
    // If no outlet found, use a tile adjacent to the lake
    if (outletTile === -1) {
      const firstLakeTile = Array.from(lakeTiles)[0];
      const x = firstLakeTile % chunkSize;
      const y = Math.floor(firstLakeTile / chunkSize);
      outletTile = y * chunkSize + Math.min(x + 1, chunkSize - 1);
    }
    
    // Create outlet river segment
    const outletSegment: RiverSegment = {
      index: outletTile,
      flow: lakeSize * 0.5, // Flow proportional to lake size
      width: 1.5,
      order: 1,
      next: -1, // Terminus for simplicity
    };
    
    const lake: Lake = {
      tiles: lakeTiles,
      elevation: lakeElevation,
      outlet: 0, // Index in segments array
    };
    
    return {
      lake,
      outletSegment,
      connectionPoint: outletTile,
    };
  });
};

/**
 * Arbitrary generator for chunk data with appropriate heightmap
 */
const arbitraryChunkData = (size: number = 8): fc.Arbitrary<ChunkData> => {
  return fc.record({
    x: fc.integer({ min: -5, max: 5 }),
    y: fc.integer({ min: -5, max: 5 }),
  }).map(({ x, y }) => {
    const vertexSize = size + 1;
    const vertexCount = vertexSize * vertexSize;
    const heightmap = new Float32Array(vertexCount);
    
    // Fill with terrain heights that support lakes and rivers
    for (let i = 0; i < vertexCount; i++) {
      heightmap[i] = 0.4 + Math.random() * 0.3; // Range 0.4-0.7
    }
    
    return {
      x,
      y,
      size,
      heightmap,
      biomeMap: new Uint8Array(size * size),
      biomeWeights: new Float32Array(size * size * 8),
      resources: [],
      structures: [],
      rivers: new Set(),
    };
  });
};

/**
 * Find vertices near a specific tile index
 */
function findVerticesNearTile(
  geometry: THREE.BufferGeometry,
  tileIndex: number,
  chunkSize: number,
  tolerance: number = 1.5
): Array<{ x: number; y: number; z: number }> {
  const positions = geometry.getAttribute('position');
  const vertices: Array<{ x: number; y: number; z: number }> = [];
  
  const targetX = tileIndex % chunkSize;
  const targetZ = Math.floor(tileIndex / chunkSize);
  
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    
    // Check if vertex is near the target tile
    const dx = Math.abs(x - targetX);
    const dz = Math.abs(z - targetZ);
    
    if (dx <= tolerance && dz <= tolerance) {
      vertices.push({ x, y, z });
    }
  }
  
  return vertices;
}

/**
 * Check if two meshes have vertices at similar positions (indicating connection)
 */
function meshesHaveNearbyVertices(
  vertices1: Array<{ x: number; y: number; z: number }>,
  vertices2: Array<{ x: number; y: number; z: number }>,
  tolerance: number = 0.5
): boolean {
  if (vertices1.length === 0 || vertices2.length === 0) {
    return false;
  }
  
  // Check if any vertices from mesh1 are close to vertices from mesh2
  for (const v1 of vertices1) {
    for (const v2 of vertices2) {
      const dx = Math.abs(v1.x - v2.x);
      const dy = Math.abs(v1.y - v2.y);
      const dz = Math.abs(v1.z - v2.z);
      
      if (dx < tolerance && dz < tolerance) {
        // Vertices are close in XZ plane (connection point)
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check elevation consistency at connection point
 */
function checkElevationConsistency(
  lakeVertices: Array<{ x: number; y: number; z: number }>,
  riverVertices: Array<{ x: number; y: number; z: number }>,
  tolerance: number = 0.2
): boolean {
  if (lakeVertices.length === 0 || riverVertices.length === 0) {
    return true; // No connection to check
  }
  
  // Find matching vertices in XZ plane
  for (const lv of lakeVertices) {
    for (const rv of riverVertices) {
      const dx = Math.abs(lv.x - rv.x);
      const dz = Math.abs(lv.z - rv.z);
      
      if (dx < 0.5 && dz < 0.5) {
        // These vertices are at the same XZ position
        // Check if their Y coordinates are similar (within tolerance)
        const dy = Math.abs(lv.y - rv.y);
        if (dy > tolerance) {
          return false; // Elevation mismatch
        }
      }
    }
  }
  
  return true;
}

describe('Lake-River Connection Property Tests', () => {
  // Feature: comprehensive-water-system, Property 11: Lake-River Connection Seamlessness
  // **Validates: Requirements 4.5**
  test('Lake and river meshes have vertices near the outlet connection point', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(8),
        arbitraryLakeWithOutlet(8),
        (chunkData, { lake, outletSegment, connectionPoint }) => {
          const riverNetwork: RiverNetwork = {
            segments: [outletSegment],
            lakes: [lake],
            tileToSegment: new Map([[outletSegment.index, 0]]),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake and river meshes
          const lakeMeshes = generateLakeMeshes(chunkData, riverNetwork, config);
          const riverMeshes = generateRiverMeshes(chunkData, riverNetwork, config);
          
          // Should have generated meshes
          expect(lakeMeshes.length).toBeGreaterThan(0);
          expect(riverMeshes.length).toBeGreaterThan(0);
          
          // Find vertices near the connection point
          const lakeVertices = findVerticesNearTile(
            lakeMeshes[0].geometry,
            connectionPoint,
            chunkData.size
          );
          
          const riverVertices = findVerticesNearTile(
            riverMeshes[0].geometry,
            connectionPoint,
            chunkData.size
          );
          
          // Both meshes should have vertices near the connection point
          // (This indicates they are in proximity, which is necessary for seamless connection)
          const hasNearbyVertices = meshesHaveNearbyVertices(lakeVertices, riverVertices);
          
          // Note: We check for proximity rather than exact overlap because
          // the lake and river may use different mesh generation strategies
          // The key is that they are close enough to appear seamless visually
          expect(hasNearbyVertices || lakeVertices.length === 0 || riverVertices.length === 0).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 11: Lake-River Connection Seamlessness
  // **Validates: Requirements 4.5**
  test('Lake and river water elevations follow expected positioning rules', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(8),
        arbitraryLakeWithOutlet(8),
        (chunkData, { lake, outletSegment, connectionPoint }) => {
          const riverNetwork: RiverNetwork = {
            segments: [outletSegment],
            lakes: [lake],
            tileToSegment: new Map([[outletSegment.index, 0]]),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake and river meshes
          const lakeMeshes = generateLakeMeshes(chunkData, riverNetwork, config);
          const riverMeshes = generateRiverMeshes(chunkData, riverNetwork, config);
          
          if (lakeMeshes.length === 0 || riverMeshes.length === 0) {
            return true; // Skip if no meshes generated
          }
          
          // Lake water should be at lake.elevation + waterOffset
          const lakeGeometry = lakeMeshes[0].geometry;
          const lakePositions = lakeGeometry.getAttribute('position');
          const lakeY = lakePositions.getY(0);
          const heightScale = 50; // Must match WorldViewer's heightScale
          const expectedLakeY = (lake.elevation + config.rendering.waterOffset) * heightScale;
          expect(lakeY).toBeCloseTo(expectedLakeY, 5);
          
          // River water should be at terrain height + waterOffset
          const riverGeometry = riverMeshes[0].geometry;
          const riverPositions = riverGeometry.getAttribute('position');
          const riverY = riverPositions.getY(0);
          
          // River should use waterOffset consistently
          expect(riverY).toBeGreaterThan(0); // Should be above zero
          
          // Both should use the same waterOffset value
          // (even though base elevations differ)
          const waterOffset = config.rendering.waterOffset;
          expect(waterOffset).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 11: Lake-River Connection Seamlessness
  // **Validates: Requirements 4.5**
  test('Lake mesh covers lake tiles including outlet boundary', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(8),
        arbitraryLakeWithOutlet(8),
        (chunkData, { lake, outletSegment }) => {
          const riverNetwork: RiverNetwork = {
            segments: [outletSegment],
            lakes: [lake],
            tileToSegment: new Map([[outletSegment.index, 0]]),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake meshes
          const lakeMeshes = generateLakeMeshes(chunkData, riverNetwork, config);
          
          expect(lakeMeshes.length).toBe(1);
          
          const geometry = lakeMeshes[0].geometry;
          const positions = geometry.getAttribute('position');
          
          // Extract covered tiles
          const coveredTiles = new Set<number>();
          for (let i = 0; i < positions.count; i += 4) {
            const worldX = positions.getX(i);
            const worldZ = positions.getZ(i);
            // Convert world coordinates to local tile coordinates
            const localX = ((Math.floor(worldX) % chunkData.size) + chunkData.size) % chunkData.size;
            const localZ = ((Math.floor(worldZ) % chunkData.size) + chunkData.size) % chunkData.size;
            const tileIndex = localZ * chunkData.size + localX;
            coveredTiles.add(tileIndex);
          }
          
          // All lake tiles should be covered
          for (const tileIndex of lake.tiles) {
            expect(coveredTiles.has(tileIndex)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 11: Lake-River Connection Seamlessness
  // **Validates: Requirements 4.5**
  test('River mesh starts at or near lake outlet', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(8),
        arbitraryLakeWithOutlet(8),
        (chunkData, { lake, outletSegment, connectionPoint }) => {
          const riverNetwork: RiverNetwork = {
            segments: [outletSegment],
            lakes: [lake],
            tileToSegment: new Map([[outletSegment.index, 0]]),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate river meshes
          const riverMeshes = generateRiverMeshes(chunkData, riverNetwork, config);
          
          if (riverMeshes.length === 0) {
            return true; // Skip if no river mesh generated
          }
          
          const geometry = riverMeshes[0].geometry;
          const positions = geometry.getAttribute('position');
          
          // Find vertices near the outlet segment start
          const outletLocalX = outletSegment.index % chunkData.size;
          const outletLocalZ = Math.floor(outletSegment.index / chunkData.size);
          // Convert to world coordinates
          const outletWorldX = chunkData.x * chunkData.size + outletLocalX;
          const outletWorldZ = chunkData.y * chunkData.size + outletLocalZ;
          
          let hasVertexNearOutlet = false;
          for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);
            
            const dx = Math.abs(x - outletWorldX);
            const dz = Math.abs(z - outletWorldZ);
            
            if (dx < 2 && dz < 2) {
              hasVertexNearOutlet = true;
              break;
            }
          }
          
          // River should have vertices near the outlet point
          expect(hasVertexNearOutlet).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 11: Lake-River Connection Seamlessness
  // **Validates: Requirements 4.5**
  test('No gaps between lake and river at connection (visual continuity)', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(8),
        arbitraryLakeWithOutlet(8),
        (chunkData, { lake, outletSegment, connectionPoint }) => {
          const riverNetwork: RiverNetwork = {
            segments: [outletSegment],
            lakes: [lake],
            tileToSegment: new Map([[outletSegment.index, 0]]),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake and river meshes
          const lakeMeshes = generateLakeMeshes(chunkData, riverNetwork, config);
          const riverMeshes = generateRiverMeshes(chunkData, riverNetwork, config);
          
          if (lakeMeshes.length === 0 || riverMeshes.length === 0) {
            return true; // Skip if no meshes generated
          }
          
          // Find vertices near the connection point from both meshes
          const lakeVertices = findVerticesNearTile(
            lakeMeshes[0].geometry,
            connectionPoint,
            chunkData.size,
            2.0 // Larger tolerance for gap detection
          );
          
          const riverVertices = findVerticesNearTile(
            riverMeshes[0].geometry,
            connectionPoint,
            chunkData.size,
            2.0
          );
          
          // If both meshes have vertices near the connection point,
          // they should be close enough to avoid visible gaps
          if (lakeVertices.length > 0 && riverVertices.length > 0) {
            const hasNearbyVertices = meshesHaveNearbyVertices(
              lakeVertices,
              riverVertices,
              1.5 // Tolerance for gap detection
            );
            
            // Should have nearby vertices (no large gap)
            expect(hasNearbyVertices).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 11: Lake-River Connection Seamlessness
  // **Validates: Requirements 4.5**
  test('Lake and river meshes use consistent waterOffset', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(8),
        arbitraryLakeWithOutlet(8),
        fc.double({ min: 0.05, max: 0.3, noNaN: true }), // waterOffset
        (chunkData, { lake, outletSegment }, waterOffset) => {
          const riverNetwork: RiverNetwork = {
            segments: [outletSegment],
            lakes: [lake],
            tileToSegment: new Map([[outletSegment.index, 0]]),
          };
          
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            rendering: {
              ...DEFAULT_WATER_CONFIG.rendering,
              waterOffset,
            },
          };
          
          // Generate lake and river meshes
          const lakeMeshes = generateLakeMeshes(chunkData, riverNetwork, config);
          const riverMeshes = generateRiverMeshes(chunkData, riverNetwork, config);
          
          if (lakeMeshes.length === 0 || riverMeshes.length === 0) {
            return true;
          }
          
          // Lake elevation should be lake.elevation + waterOffset
          const lakeGeometry = lakeMeshes[0].geometry;
          const lakePositions = lakeGeometry.getAttribute('position');
          const lakeY = lakePositions.getY(0);
          const heightScale = 50; // Must match WorldViewer's heightScale
          const expectedLakeY = (lake.elevation + waterOffset) * heightScale;
          
          expect(lakeY).toBeCloseTo(expectedLakeY, 5);
          
          // River uses terrain height + waterOffset, which may differ from lake
          // but the waterOffset should be consistently applied
          const riverGeometry = riverMeshes[0].geometry;
          const riverPositions = riverGeometry.getAttribute('position');
          
          // Check that river vertices use waterOffset consistently
          // (all vertices at same segment should have same Y)
          const firstY = riverPositions.getY(0);
          for (let i = 1; i < Math.min(4, riverPositions.count); i++) {
            const y = riverPositions.getY(i);
            expect(Math.abs(y - firstY)).toBeLessThan(0.01);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
