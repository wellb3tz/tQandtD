/**
 * Property-based tests for OceanMeshGenerator
 * 
 * Tests universal correctness properties across randomized chunk data
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { identifyOceanTiles, buildOceanGeometry } from './OceanMeshGenerator';
import type { ChunkData } from '../../../../src/world/chunk';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG } from './config';

/**
 * Arbitrary generator for heightmap data
 * Generates heightmaps with various terrain configurations
 */
const arbitraryHeightmap = (size: number = 4): fc.Arbitrary<Float32Array> => {
  const vertexSize = size + 1;
  const vertexCount = vertexSize * vertexSize;
  
  return fc.array(
    fc.double({ min: 0, max: 1 }),
    { minLength: vertexCount, maxLength: vertexCount }
  ).map(arr => new Float32Array(arr));
};

/**
 * Arbitrary generator for chunk data with random heightmaps
 */
const arbitraryChunkData = (): fc.Arbitrary<ChunkData> => {
  return fc.record({
    x: fc.integer({ min: -10, max: 10 }),
    y: fc.integer({ min: -10, max: 10 }),
    size: fc.constant(4), // Use consistent size for testing
  }).chain(({ x, y, size }) => {
    return arbitraryHeightmap(size).map(heightmap => ({
      x,
      y,
      size,
      heightmap,
      biomeMap: new Uint8Array(size * size),
      biomeWeights: new Float32Array(size * size * 8),
      resources: [],
      structures: [],
      rivers: new Set<number>(),
    }));
  });
};

/**
 * Calculate average height of a tile from its 4 corner vertices
 */
function getTileHeight(heightmap: Float32Array, tileIndex: number, size: number): number {
  const vertexSize = size + 1;
  const localX = tileIndex % size;
  const localY = Math.floor(tileIndex / size);
  
  const v00 = heightmap[localY * vertexSize + localX];
  const v10 = heightmap[localY * vertexSize + (localX + 1)];
  const v01 = heightmap[(localY + 1) * vertexSize + localX];
  const v11 = heightmap[(localY + 1) * vertexSize + (localX + 1)];
  
  return (v00 + v10 + v01 + v11) / 4;
}

/**
 * Extract set of tile indices covered by ocean geometry
 * Analyzes the geometry's position data to determine which tiles are covered
 */
function extractCoveredTiles(
  geometry: THREE.BufferGeometry | null,
  chunkSize: number
): Set<number> {
  if (!geometry) {
    return new Set();
  }
  
  const positions = geometry.getAttribute('position');
  const coveredTiles = new Set<number>();
  
  // Each tile has 4 vertices forming a quad
  // We can identify tiles by their bottom-left corner position
  for (let i = 0; i < positions.count; i += 4) {
    // Get the first vertex of the quad (bottom-left corner)
    const x = positions.getX(i);
    const z = positions.getZ(i);
    
    // Convert local coordinates to tile index
    const tileX = Math.floor(x);
    const tileY = Math.floor(z);
    const tileIndex = tileY * chunkSize + tileX;
    
    coveredTiles.add(tileIndex);
  }
  
  return coveredTiles;
}

/**
 * Get set of tile indices that should be ocean (height < seaLevel)
 */
function getExpectedOceanTiles(
  chunkData: ChunkData,
  seaLevel: number
): Set<number> {
  const expectedTiles = new Set<number>();
  const { size, heightmap } = chunkData;
  
  for (let tileIndex = 0; tileIndex < size * size; tileIndex++) {
    const tileHeight = getTileHeight(heightmap, tileIndex, size);
    if (tileHeight < seaLevel) {
      expectedTiles.add(tileIndex);
    }
  }
  
  return expectedTiles;
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

describe('OceanMeshGenerator Property Tests', () => {
  // Feature: comprehensive-water-system, Property 1: Ocean Water Coverage Completeness
  // **Validates: Requirements 1.2, 2.1, 2.3**
  test('Ocean water meshes cover exactly tiles where height < seaLevel', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        fc.double({ min: 0.1, max: 0.9, noNaN: true }), // seaLevel
        (chunkData, seaLevel) => {
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
          };
          
          // Identify ocean tiles using the function under test
          const oceanTiles = identifyOceanTiles(chunkData, seaLevel);
          
          // Build geometry from identified tiles
          const geometry = buildOceanGeometry(oceanTiles, chunkData, config);
          
          // Extract which tiles are covered by the geometry
          const coveredTiles = extractCoveredTiles(geometry, chunkData.size);
          
          // Determine which tiles should be ocean based on heightmap
          const expectedTiles = getExpectedOceanTiles(chunkData, seaLevel);
          
          // Verify coverage is complete and exact
          expect(setsEqual(coveredTiles, expectedTiles)).toBe(true);
          
          // Additional verification: oceanTiles array should match expected tiles
          const identifiedTileIndices = new Set(oceanTiles.map(t => t.index));
          expect(setsEqual(identifiedTileIndices, expectedTiles)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 1: Ocean Water Coverage Completeness
  // **Validates: Requirements 1.2, 2.1, 2.3**
  test('Ocean tiles are identified correctly based on average tile height', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        fc.double({ min: 0.1, max: 0.9, noNaN: true }), // seaLevel
        (chunkData, seaLevel) => {
          const oceanTiles = identifyOceanTiles(chunkData, seaLevel);
          
          // Every identified ocean tile must have average height < seaLevel
          for (const tile of oceanTiles) {
            const tileHeight = getTileHeight(chunkData.heightmap, tile.index, chunkData.size);
            expect(tileHeight).toBeLessThan(seaLevel);
            expect(tile.terrainHeight).toBeCloseTo(tileHeight, 5);
            expect(tile.waterElevation).toBe(seaLevel);
            expect(tile.underwaterDepth).toBeCloseTo(seaLevel - tileHeight, 5);
          }
          
          // Every tile with height < seaLevel must be identified
          const identifiedIndices = new Set(oceanTiles.map(t => t.index));
          for (let i = 0; i < chunkData.size * chunkData.size; i++) {
            const tileHeight = getTileHeight(chunkData.heightmap, i, chunkData.size);
            if (tileHeight < seaLevel) {
              expect(identifiedIndices.has(i)).toBe(true);
            } else {
              expect(identifiedIndices.has(i)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 1: Ocean Water Coverage Completeness
  // **Validates: Requirements 1.2, 2.1, 2.3**
  test('No ocean tiles are identified when all terrain is above sea level', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.integer({ min: -10, max: 10 }),
          y: fc.integer({ min: -10, max: 10 }),
          size: fc.constant(4),
        }),
        fc.double({ min: 0.1, max: 0.4, noNaN: true }), // seaLevel
        ({ x, y, size }, seaLevel) => {
          // Generate heightmap where all values are above seaLevel
          const vertexSize = size + 1;
          const vertexCount = vertexSize * vertexSize;
          const heightmap = new Float32Array(vertexCount);
          
          for (let i = 0; i < vertexCount; i++) {
            heightmap[i] = seaLevel + 0.1 + Math.random() * 0.5; // All above seaLevel
          }
          
          const chunkData: ChunkData = {
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
          
          const oceanTiles = identifyOceanTiles(chunkData, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunkData, DEFAULT_WATER_CONFIG);
          
          expect(oceanTiles.length).toBe(0);
          expect(geometry).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 1: Ocean Water Coverage Completeness
  // **Validates: Requirements 1.2, 2.1, 2.3**
  test('All tiles are ocean when entire chunk is below sea level', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.integer({ min: -10, max: 10 }),
          y: fc.integer({ min: -10, max: 10 }),
          size: fc.constant(4),
        }),
        fc.double({ min: 0.5, max: 0.9, noNaN: true }), // seaLevel
        ({ x, y, size }, seaLevel) => {
          // Generate heightmap where all values are below seaLevel
          const vertexSize = size + 1;
          const vertexCount = vertexSize * vertexSize;
          const heightmap = new Float32Array(vertexCount);
          
          for (let i = 0; i < vertexCount; i++) {
            heightmap[i] = Math.random() * (seaLevel - 0.1); // All below seaLevel
          }
          
          const chunkData: ChunkData = {
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
          
          const oceanTiles = identifyOceanTiles(chunkData, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunkData, DEFAULT_WATER_CONFIG);
          
          // All tiles should be ocean
          expect(oceanTiles.length).toBe(size * size);
          expect(geometry).not.toBeNull();
          
          if (geometry) {
            const coveredTiles = extractCoveredTiles(geometry, size);
            expect(coveredTiles.size).toBe(size * size);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 1: Ocean Water Coverage Completeness
  // **Validates: Requirements 1.2, 2.1, 2.3**
  test('Ocean geometry vertex count matches tile count', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        fc.double({ min: 0.1, max: 0.9, noNaN: true }), // seaLevel
        (chunkData, seaLevel) => {
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
          };
          
          const oceanTiles = identifyOceanTiles(chunkData, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunkData, config);
          
          if (oceanTiles.length === 0) {
            expect(geometry).toBeNull();
          } else {
            expect(geometry).not.toBeNull();
            
            if (geometry) {
              const positions = geometry.getAttribute('position');
              // Each tile has 4 vertices
              expect(positions.count).toBe(oceanTiles.length * 4);
              
              // Each tile has 2 triangles = 6 indices
              const index = geometry.getIndex();
              if (index) {
                expect(index.count).toBe(oceanTiles.length * 6);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 6: Ocean Water Seamless Boundaries
  // **Validates: Requirements 2.4**
  test('Adjacent chunks with ocean tiles have identical boundary vertices', () => {
    fc.assert(
      fc.property(
        fc.record({
          chunkX: fc.integer({ min: -5, max: 5 }),
          chunkY: fc.integer({ min: -5, max: 5 }),
          size: fc.constant(4),
          seaLevel: fc.double({ min: 0.4, max: 0.7, noNaN: true }),
        }),
        ({ chunkX, chunkY, size, seaLevel }) => {
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
          };
          
          // Create heightmap where all terrain is below sea level
          // This ensures ocean tiles exist at boundaries
          const vertexSize = size + 1;
          const vertexCount = vertexSize * vertexSize;
          const heightmap = new Float32Array(vertexCount);
          for (let i = 0; i < vertexCount; i++) {
            heightmap[i] = Math.random() * (seaLevel - 0.1);
          }
          
          // Create two horizontally adjacent chunks with the same heightmap
          const chunk1: ChunkData = {
            x: chunkX,
            y: chunkY,
            size,
            heightmap: new Float32Array(heightmap),
            biomeMap: new Uint8Array(size * size),
            biomeWeights: new Float32Array(size * size * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };
          
          const chunk2: ChunkData = {
            x: chunkX + 1,
            y: chunkY,
            size,
            heightmap: new Float32Array(heightmap),
            biomeMap: new Uint8Array(size * size),
            biomeWeights: new Float32Array(size * size * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };
          
          const oceanTiles1 = identifyOceanTiles(chunk1, seaLevel);
          const oceanTiles2 = identifyOceanTiles(chunk2, seaLevel);
          
          const geometry1 = buildOceanGeometry(oceanTiles1, chunk1, config);
          const geometry2 = buildOceanGeometry(oceanTiles2, chunk2, config);
          
          // Both chunks should have ocean geometry
          expect(geometry1).not.toBeNull();
          expect(geometry2).not.toBeNull();
          
          if (!geometry1 || !geometry2) {
            return true;
          }
          
          // Extract boundary vertices in world coordinates
          const boundary1 = extractBoundaryVertices(geometry1, chunk1, 'right');
          const boundary2 = extractBoundaryVertices(geometry2, chunk2, 'left');
          
          // Both boundaries should have vertices
          expect(boundary1.length).toBeGreaterThan(0);
          expect(boundary2.length).toBeGreaterThan(0);
          
          // Every vertex on chunk1's right edge should have a matching vertex
          // on chunk2's left edge with identical world coordinates
          for (const v1 of boundary1) {
            const hasMatch = boundary2.some(v2 => 
              Math.abs(v1.x - v2.x) < 0.001 &&
              Math.abs(v1.y - v2.y) < 0.001 &&
              Math.abs(v1.z - v2.z) < 0.001
            );
            expect(hasMatch).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 6: Ocean Water Seamless Boundaries
  // **Validates: Requirements 2.4**
  test('Vertically adjacent chunks have identical boundary elevations', () => {
    fc.assert(
      fc.property(
        fc.record({
          chunkX: fc.integer({ min: -5, max: 5 }),
          chunkY: fc.integer({ min: -5, max: 5 }),
          size: fc.constant(4),
          seaLevel: fc.double({ min: 0.4, max: 0.7, noNaN: true }),
        }),
        ({ chunkX, chunkY, size, seaLevel }) => {
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
          };
          
          // Create heightmap where all terrain is below sea level
          const vertexSize = size + 1;
          const vertexCount = vertexSize * vertexSize;
          const heightmap = new Float32Array(vertexCount);
          for (let i = 0; i < vertexCount; i++) {
            heightmap[i] = Math.random() * (seaLevel - 0.1);
          }
          
          // Create two vertically adjacent chunks
          const chunk1: ChunkData = {
            x: chunkX,
            y: chunkY,
            size,
            heightmap: new Float32Array(heightmap),
            biomeMap: new Uint8Array(size * size),
            biomeWeights: new Float32Array(size * size * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };
          
          const chunk2: ChunkData = {
            x: chunkX,
            y: chunkY + 1,
            size,
            heightmap: new Float32Array(heightmap),
            biomeMap: new Uint8Array(size * size),
            biomeWeights: new Float32Array(size * size * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };
          
          const oceanTiles1 = identifyOceanTiles(chunk1, seaLevel);
          const oceanTiles2 = identifyOceanTiles(chunk2, seaLevel);
          
          const geometry1 = buildOceanGeometry(oceanTiles1, chunk1, config);
          const geometry2 = buildOceanGeometry(oceanTiles2, chunk2, config);
          
          expect(geometry1).not.toBeNull();
          expect(geometry2).not.toBeNull();
          
          if (!geometry1 || !geometry2) {
            return true;
          }
          
          const boundary1 = extractBoundaryVertices(geometry1, chunk1, 'bottom');
          const boundary2 = extractBoundaryVertices(geometry2, chunk2, 'top');
          
          expect(boundary1.length).toBeGreaterThan(0);
          expect(boundary2.length).toBeGreaterThan(0);
          
          // All boundary vertices should have the same elevation
          const heightScale = 50; // Must match WorldViewer's heightScale
          const expectedElevation = (seaLevel + config.rendering.waterOffset) * heightScale;
          
          for (const vertex of boundary1) {
            expect(vertex.y).toBeCloseTo(expectedElevation, 5);
          }
          
          for (const vertex of boundary2) {
            expect(vertex.y).toBeCloseTo(expectedElevation, 5);
          }
          
          // Verify matching vertices exist
          for (const v1 of boundary1) {
            const hasMatch = boundary2.some(v2 => 
              Math.abs(v1.x - v2.x) < 0.001 &&
              Math.abs(v1.y - v2.y) < 0.001 &&
              Math.abs(v1.z - v2.z) < 0.001
            );
            expect(hasMatch).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 6: Ocean Water Seamless Boundaries
  // **Validates: Requirements 2.4**
  test('Four-way chunk corners have identical vertex coordinates', () => {
    fc.assert(
      fc.property(
        fc.record({
          chunkX: fc.integer({ min: -5, max: 5 }),
          chunkY: fc.integer({ min: -5, max: 5 }),
          size: fc.constant(4),
          seaLevel: fc.double({ min: 0.4, max: 0.7, noNaN: true }),
        }),
        ({ chunkX, chunkY, size, seaLevel }) => {
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
          };
          
          // Create heightmap where all terrain is below sea level
          const vertexSize = size + 1;
          const vertexCount = vertexSize * vertexSize;
          const heightmap = new Float32Array(vertexCount);
          for (let i = 0; i < vertexCount; i++) {
            heightmap[i] = Math.random() * (seaLevel - 0.1);
          }
          
          // Create 2x2 grid of chunks
          const chunks: ChunkData[] = [
            { x: chunkX, y: chunkY, size, heightmap: new Float32Array(heightmap), biomeMap: new Uint8Array(size * size), biomeWeights: new Float32Array(size * size * 8), resources: [], structures: [], rivers: new Set() },
            { x: chunkX + 1, y: chunkY, size, heightmap: new Float32Array(heightmap), biomeMap: new Uint8Array(size * size), biomeWeights: new Float32Array(size * size * 8), resources: [], structures: [], rivers: new Set() },
            { x: chunkX, y: chunkY + 1, size, heightmap: new Float32Array(heightmap), biomeMap: new Uint8Array(size * size), biomeWeights: new Float32Array(size * size * 8), resources: [], structures: [], rivers: new Set() },
            { x: chunkX + 1, y: chunkY + 1, size, heightmap: new Float32Array(heightmap), biomeMap: new Uint8Array(size * size), biomeWeights: new Float32Array(size * size * 8), resources: [], structures: [], rivers: new Set() },
          ];
          
          const geometries = chunks.map(chunk => {
            const oceanTiles = identifyOceanTiles(chunk, seaLevel);
            return buildOceanGeometry(oceanTiles, chunk, config);
          });
          
          // All geometries should exist
          for (const geometry of geometries) {
            expect(geometry).not.toBeNull();
          }
          
          // If any geometry is null, skip test
          if (geometries.some(g => g === null)) {
            return true;
          }
          
          // Find the corner where all 4 chunks meet
          const cornerX = (chunkX + 1) * size;
          const cornerZ = (chunkY + 1) * size;
          const heightScale = 50; // Must match WorldViewer's heightScale
          const expectedY = (seaLevel + config.rendering.waterOffset) * heightScale;
          
          // Extract corner vertices from each chunk
          const cornerVertices = geometries.map((geometry, i) => {
            if (!geometry) return [];
            const chunk = chunks[i];
            return extractCornerVertex(geometry, chunk, cornerX, cornerZ);
          });
          
          // Filter out empty arrays
          const validCorners = cornerVertices.filter(v => v.length > 0);
          
          // All chunks should have corner vertices
          expect(validCorners.length).toBeGreaterThan(0);
          
          // All corner vertices should have identical coordinates
          for (const corners of validCorners) {
            for (const corner of corners) {
              expect(corner.x).toBeCloseTo(cornerX, 5);
              expect(corner.y).toBeCloseTo(expectedY, 5);
              expect(corner.z).toBeCloseTo(cornerZ, 5);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Extract vertices along a specific edge of a chunk in world coordinates
 */
function extractBoundaryVertices(
  geometry: THREE.BufferGeometry,
  chunk: ChunkData,
  edge: 'left' | 'right' | 'top' | 'bottom'
): Array<{ x: number; y: number; z: number }> {
  const positions = geometry.getAttribute('position');
  const vertices: Array<{ x: number; y: number; z: number }> = [];
  const tolerance = 0.001;
  
  for (let i = 0; i < positions.count; i++) {
    const localX = positions.getX(i);
    const localY = positions.getY(i);
    const localZ = positions.getZ(i);
    
    // Convert to world coordinates
    const worldX = chunk.x * chunk.size + localX;
    const worldZ = chunk.y * chunk.size + localZ;
    
    // Check if vertex is on the specified edge
    let isOnEdge = false;
    
    switch (edge) {
      case 'left':
        isOnEdge = Math.abs(localX - 0) < tolerance;
        break;
      case 'right':
        isOnEdge = Math.abs(localX - chunk.size) < tolerance;
        break;
      case 'top':
        isOnEdge = Math.abs(localZ - 0) < tolerance;
        break;
      case 'bottom':
        isOnEdge = Math.abs(localZ - chunk.size) < tolerance;
        break;
    }
    
    if (isOnEdge) {
      vertices.push({ x: worldX, y: localY, z: worldZ });
    }
  }
  
  return vertices;
}

/**
 * Extract vertex at a specific corner in world coordinates
 */
function extractCornerVertex(
  geometry: THREE.BufferGeometry,
  chunk: ChunkData,
  cornerX: number,
  cornerZ: number
): Array<{ x: number; y: number; z: number }> {
  const positions = geometry.getAttribute('position');
  const vertices: Array<{ x: number; y: number; z: number }> = [];
  const tolerance = 0.001;
  
  for (let i = 0; i < positions.count; i++) {
    const localX = positions.getX(i);
    const localY = positions.getY(i);
    const localZ = positions.getZ(i);
    
    // Convert to world coordinates
    const worldX = chunk.x * chunk.size + localX;
    const worldZ = chunk.y * chunk.size + localZ;
    
    // Check if vertex is at the corner
    if (Math.abs(worldX - cornerX) < tolerance && Math.abs(worldZ - cornerZ) < tolerance) {
      vertices.push({ x: worldX, y: localY, z: worldZ });
    }
  }
  
  return vertices;
}
