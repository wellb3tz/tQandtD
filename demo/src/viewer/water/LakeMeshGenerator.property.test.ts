/**
 * Property-based tests for LakeMeshGenerator
 * 
 * Tests Property 4: Lake Water Coverage
 * Validates that lake water meshes cover all lake tiles at the lake's elevation level
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { generateLakeMeshes } from './LakeMeshGenerator';
import type { ChunkData } from '../../../../src/world/chunk';
import type { RiverNetwork, Lake } from '../../../../src/gen/rivers';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG } from './config';

/**
 * Arbitrary generator for lake data
 * Generates lakes with various tile configurations and elevations
 */
const arbitraryLake = (chunkSize: number = 4): fc.Arbitrary<Lake> => {
  return fc.record({
    tileCount: fc.integer({ min: 1, max: Math.min(16, chunkSize * chunkSize) }),
    elevation: fc.double({ min: 0.31, max: 0.9, noNaN: true }), // Above ocean level
    outlet: fc.integer({ min: -1, max: 10 }),
  }).map(({ tileCount, elevation, outlet }) => {
    // Generate random tile indices
    const tiles = new Set<number>();
    const maxIndex = chunkSize * chunkSize - 1;
    
    while (tiles.size < tileCount) {
      const tileIndex = Math.floor(Math.random() * (maxIndex + 1));
      tiles.add(tileIndex);
    }
    
    return {
      tiles,
      elevation,
      outlet,
    };
  });
};

/**
 * Arbitrary generator for river network with lakes
 */
const arbitraryRiverNetwork = (chunkSize: number = 4): fc.Arbitrary<RiverNetwork> => {
  return fc.record({
    lakeCount: fc.integer({ min: 0, max: 5 }),
  }).chain(({ lakeCount }) => {
    return fc.array(arbitraryLake(chunkSize), { minLength: lakeCount, maxLength: lakeCount }).map(lakes => ({
      segments: [],
      lakes,
      tileToSegment: new Map(),
    }));
  });
};

/**
 * Arbitrary generator for chunk data
 */
const arbitraryChunkData = (): fc.Arbitrary<ChunkData> => {
  return fc.record({
    x: fc.integer({ min: -10, max: 10 }),
    y: fc.integer({ min: -10, max: 10 }),
    size: fc.constant(4),
  }).map(({ x, y, size }) => {
    const vertexSize = size + 1;
    const vertexCount = vertexSize * vertexSize;
    const heightmap = new Float32Array(vertexCount);
    
    // Fill with random terrain heights
    for (let i = 0; i < vertexCount; i++) {
      heightmap[i] = Math.random();
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
 * Extract set of tile indices covered by lake meshes
 */
function extractCoveredTiles(
  meshes: THREE.Mesh[],
  chunkSize: number
): Set<number> {
  const coveredTiles = new Set<number>();
  
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const positions = geometry.getAttribute('position');
    
    // Each tile has 4 vertices forming a quad
    // We can identify tiles by their bottom-left corner position
    for (let i = 0; i < positions.count; i += 4) {
      // Get the first vertex of the quad (bottom-left corner)
      const worldX = positions.getX(i);
      const worldZ = positions.getZ(i);
      
      // Convert world coordinates to local tile coordinates
      // World coordinates are: chunkX * chunkSize + localX
      // We need to extract localX and localY using modulo
      // Handle negative coordinates properly with ((n % m) + m) % m
      const localX = ((Math.floor(worldX) % chunkSize) + chunkSize) % chunkSize;
      const localY = ((Math.floor(worldZ) % chunkSize) + chunkSize) % chunkSize;
      const tileIndex = localY * chunkSize + localX;
      
      coveredTiles.add(tileIndex);
    }
  }
  
  return coveredTiles;
}

/**
 * Check if two sets are equal
 */
function setsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
  if (set1.size !== set2.size) {
    return false;
  }
  
  for (const item of set1) {
    if (!set2.has(item)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Extract all elevations from lake meshes
 */
function extractMeshElevations(meshes: THREE.Mesh[]): number[] {
  const elevations: number[] = [];
  
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const positions = geometry.getAttribute('position');
    
    // Get Y coordinate from first vertex (all vertices should have same Y)
    if (positions.count > 0) {
      elevations.push(positions.getY(0));
    }
  }
  
  return elevations;
}

describe('LakeMeshGenerator Property Tests', () => {
  // Feature: comprehensive-water-system, Property 4: Lake Water Coverage
  // **Validates: Requirements 1.4, 4.1, 4.2, 4.4**
  test('Lake water meshes cover exactly all lake tiles', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryRiverNetwork(4),
        (chunkData, riverNetwork) => {
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake meshes
          const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
          
          // Extract which tiles are covered by the meshes
          const coveredTiles = extractCoveredTiles(meshes, chunkData.size);
          
          // Determine which tiles should be covered (all lake tiles)
          const expectedTiles = new Set<number>();
          for (const lake of riverNetwork.lakes) {
            for (const tileIndex of lake.tiles) {
              expectedTiles.add(tileIndex);
            }
          }
          
          // Verify coverage is complete and exact
          expect(setsEqual(coveredTiles, expectedTiles)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 4: Lake Water Coverage
  // **Validates: Requirements 1.4, 4.1, 4.2, 4.4**
  test('Lake water is positioned at lake elevation + waterOffset', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryLake(4),
        (chunkData, lake) => {
          const riverNetwork: RiverNetwork = {
            segments: [],
            lakes: [lake],
            tileToSegment: new Map(),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake meshes
          const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
          
          // Should generate exactly one mesh for one lake
          expect(meshes.length).toBe(1);
          
          const mesh = meshes[0];
          const geometry = mesh.geometry;
          const positions = geometry.getAttribute('position');
          
          // Expected elevation
          const heightScale = 50; // Must match WorldViewer's heightScale
          const expectedY = (lake.elevation + config.rendering.waterOffset) * heightScale;
          
          // All vertices should be at the same elevation
          for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i);
            expect(y).toBeCloseTo(expectedY, 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 4: Lake Water Coverage
  // **Validates: Requirements 1.4, 4.1, 4.2, 4.4**
  test('Each lake generates exactly one mesh', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryRiverNetwork(4),
        (chunkData, riverNetwork) => {
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake meshes
          const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
          
          // Number of meshes should equal number of non-empty lakes
          const nonEmptyLakes = riverNetwork.lakes.filter(lake => lake.tiles.size > 0);
          expect(meshes.length).toBe(nonEmptyLakes.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 4: Lake Water Coverage
  // **Validates: Requirements 1.4, 4.1, 4.2, 4.4**
  test('Lake mesh vertex count matches tile count', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryLake(4),
        (chunkData, lake) => {
          const riverNetwork: RiverNetwork = {
            segments: [],
            lakes: [lake],
            tileToSegment: new Map(),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake meshes
          const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
          
          expect(meshes.length).toBe(1);
          
          const mesh = meshes[0];
          const geometry = mesh.geometry;
          const positions = geometry.getAttribute('position');
          
          // Each tile has 4 vertices
          expect(positions.count).toBe(lake.tiles.size * 4);
          
          // Each tile has 2 triangles = 6 indices
          const index = geometry.getIndex();
          if (index) {
            expect(index.count).toBe(lake.tiles.size * 6);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 4: Lake Water Coverage
  // **Validates: Requirements 1.4, 4.1, 4.2, 4.4**
  test('Multiple lakes have distinct elevations when specified', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        fc.array(arbitraryLake(4), { minLength: 2, maxLength: 5 }),
        (chunkData, lakes) => {
          // Ensure lakes have different elevations
          const uniqueLakes = lakes.map((lake, i) => ({
            ...lake,
            elevation: 0.4 + i * 0.1,
          }));
          
          const riverNetwork: RiverNetwork = {
            segments: [],
            lakes: uniqueLakes,
            tileToSegment: new Map(),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake meshes
          const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
          
          expect(meshes.length).toBe(uniqueLakes.length);
          
          // Extract elevations from meshes
          const meshElevations = extractMeshElevations(meshes);
          
          // Each mesh should have elevation matching its lake
          const heightScale = 50; // Must match WorldViewer's heightScale
          for (let i = 0; i < uniqueLakes.length; i++) {
            const expectedY = (uniqueLakes[i].elevation + config.rendering.waterOffset) * heightScale;
            expect(meshElevations[i]).toBeCloseTo(expectedY, 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 4: Lake Water Coverage
  // **Validates: Requirements 1.4, 4.1, 4.2, 4.4**
  test('Empty lakes generate no meshes', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        fc.integer({ min: 1, max: 5 }),
        (chunkData, lakeCount) => {
          // Create lakes with empty tile sets
          const emptyLakes: Lake[] = [];
          for (let i = 0; i < lakeCount; i++) {
            emptyLakes.push({
              tiles: new Set(),
              elevation: 0.4 + i * 0.1,
              outlet: -1,
            });
          }
          
          const riverNetwork: RiverNetwork = {
            segments: [],
            lakes: emptyLakes,
            tileToSegment: new Map(),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake meshes
          const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
          
          // No meshes should be generated for empty lakes
          expect(meshes.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 4: Lake Water Coverage
  // **Validates: Requirements 1.4, 4.1, 4.2, 4.4**
  test('Lake meshes have smooth surfaces (all normals point up)', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryLake(4),
        (chunkData, lake) => {
          const riverNetwork: RiverNetwork = {
            segments: [],
            lakes: [lake],
            tileToSegment: new Map(),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake meshes
          const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
          
          expect(meshes.length).toBe(1);
          
          const mesh = meshes[0];
          const geometry = mesh.geometry;
          const normals = geometry.getAttribute('normal');
          
          // All normals should point up (0, 1, 0) for smooth surface
          for (let i = 0; i < normals.count; i++) {
            expect(normals.getX(i)).toBe(0);
            expect(normals.getY(i)).toBe(1);
            expect(normals.getZ(i)).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 4: Lake Water Coverage
  // **Validates: Requirements 1.4, 4.1, 4.2, 4.4**
  test('Lake meshes have bounding volumes for culling', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryLake(4),
        (chunkData, lake) => {
          const riverNetwork: RiverNetwork = {
            segments: [],
            lakes: [lake],
            tileToSegment: new Map(),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          
          // Generate lake meshes
          const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
          
          expect(meshes.length).toBe(1);
          
          const mesh = meshes[0];
          const geometry = mesh.geometry;
          
          // Bounding sphere and box should be computed
          expect(geometry.boundingSphere).not.toBeNull();
          expect(geometry.boundingBox).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 4: Lake Water Coverage
  // **Validates: Requirements 1.4, 4.1, 4.2, 4.4**
  test('Lake water elevation is always above ocean level', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryLake(4),
        (chunkData, lake) => {
          const riverNetwork: RiverNetwork = {
            segments: [],
            lakes: [lake],
            tileToSegment: new Map(),
          };
          
          const config = DEFAULT_WATER_CONFIG;
          const oceanLevel = config.seaLevel;
          
          // Generate lake meshes
          const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
          
          expect(meshes.length).toBe(1);
          
          const mesh = meshes[0];
          const geometry = mesh.geometry;
          const positions = geometry.getAttribute('position');
          
          // All lake water should be above ocean level
          for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i);
            expect(y).toBeGreaterThan(oceanLevel);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
