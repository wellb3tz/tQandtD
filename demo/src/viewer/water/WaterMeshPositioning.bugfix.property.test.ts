/**
 * Bug Condition Exploration Test for Water Mesh Positioning Fix
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5**
 * 
 * This test surfaces counterexamples that demonstrate the coordinate mismatch bug:
 * - Ocean vertices use local coordinates (0-32) instead of world coordinates
 * - Water group positioned at chunk offset causes double offset
 * - Water appears in wrong locations relative to terrain
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import * as THREE from 'three';
import { identifyOceanTiles, buildOceanGeometry } from './OceanMeshGenerator';
import { WaterLayerManager } from './WaterLayerManager';
import type { ChunkData } from '../../../../src/world/chunk';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG, HEIGHT_SCALE } from './config';

/**
 * Create chunk data with all terrain below sea level (guaranteed ocean)
 */
function createOceanChunk(chunkX: number, chunkY: number, size: number, seaLevel: number): ChunkData {
  const vertexSize = size + 1;
  const vertexCount = vertexSize * vertexSize;
  const heightmap = new Float32Array(vertexCount);
  
  // All terrain below sea level
  for (let i = 0; i < vertexCount; i++) {
    heightmap[i] = Math.random() * (seaLevel - 0.1);
  }
  
  return {
    x: chunkX,
    y: chunkY,
    size,
    heightmap,
    biomeMap: new Uint8Array(size * size),
    biomeWeights: new Float32Array(size * size * 8),
    resources: [],
    structures: [],
    rivers: new Set(),
  };
}

/**
 * Extract vertex positions from geometry
 */
function extractVertexPositions(geometry: THREE.BufferGeometry): Array<{ x: number; y: number; z: number }> {
  const positions = geometry.getAttribute('position');
  const vertices: Array<{ x: number; y: number; z: number }> = [];
  
  for (let i = 0; i < positions.count; i++) {
    vertices.push({
      x: positions.getX(i),
      y: positions.getY(i),
      z: positions.getZ(i),
    });
  }
  
  return vertices;
}

describe('Water Mesh Positioning Bug Condition Exploration', () => {
  // Property 1: Bug Condition - Water Positioned at World Coordinates
  // **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5**
  test('Ocean geometry vertices use world coordinates (not local coordinates)', () => {
    const testCases = [
      { chunkX: 0, chunkY: 0, description: 'Chunk (0,0)' },
      { chunkX: 1, chunkY: 0, description: 'Chunk (1,0)' },
      { chunkX: -1, chunkY: 0, description: 'Chunk (-1,0)' },
      { chunkX: 5, chunkY: 5, description: 'Chunk (5,5)' },
    ];
    
    const size = 32;
    const seaLevel = 0.3;
    const config: WaterConfig = {
      ...DEFAULT_WATER_CONFIG,
      seaLevel,
    };
    
    for (const { chunkX, chunkY, description } of testCases) {
      const chunkData = createOceanChunk(chunkX, chunkY, size, seaLevel);
      const oceanTiles = identifyOceanTiles(chunkData, seaLevel);
      const geometry = buildOceanGeometry(oceanTiles, chunkData, config);
      
      expect(geometry).not.toBeNull();
      
      if (geometry) {
        const vertices = extractVertexPositions(geometry);
        
        // Expected world coordinate range for this chunk
        const expectedMinX = chunkX * size;
        const expectedMaxX = chunkX * size + size;
        const expectedMinZ = chunkY * size;
        const expectedMaxZ = chunkY * size + size;
        
        // Verify vertices use world coordinates
        for (const vertex of vertices) {
          // X coordinate should be in world coordinate range
          expect(vertex.x).toBeGreaterThanOrEqual(expectedMinX);
          expect(vertex.x).toBeLessThanOrEqual(expectedMaxX);
          
          // Z coordinate should be in world coordinate range
          expect(vertex.z).toBeGreaterThanOrEqual(expectedMinZ);
          expect(vertex.z).toBeLessThanOrEqual(expectedMaxZ);
        }
        
        // Additional check: vertices should NOT all be in local coordinate range (0 to size)
        // unless chunk is at origin (0,0)
        if (chunkX !== 0 || chunkY !== 0) {
          const allInLocalRange = vertices.every(v => 
            v.x >= 0 && v.x <= size && v.z >= 0 && v.z <= size
          );
          
          // This should be false - vertices should use world coordinates
          expect(allInLocalRange).toBe(false);
        }
      }
    }
  });

  // Property 1: Bug Condition - Water Positioned at World Coordinates
  // **Validates: Requirements 2.2**
  test('Water group positioned at origin (0, 0, 0) when using world coordinates', () => {
    const testCases = [
      { chunkX: 0, chunkY: 0 },
      { chunkX: 1, chunkY: 0 },
      { chunkX: -1, chunkY: 0 },
      { chunkX: 5, chunkY: 5 },
    ];
    
    const size = 32;
    const seaLevel = 0.3;
    const config: WaterConfig = {
      ...DEFAULT_WATER_CONFIG,
      seaLevel,
    };
    
    const manager = new WaterLayerManager();
    const scene = new THREE.Scene();
    
    for (const { chunkX, chunkY } of testCases) {
      const chunkData = createOceanChunk(chunkX, chunkY, size, seaLevel);
      const chunkKey = `${chunkX},${chunkY}`;
      
      manager.addWaterToChunk(chunkKey, chunkData, scene, config);
      
      const waterLayer = manager.getWaterLayer(chunkKey);
      expect(waterLayer).toBeDefined();
      
      if (waterLayer) {
        // Water group should be at origin since geometry contains world coordinates
        expect(waterLayer.group.position.x).toBe(0);
        expect(waterLayer.group.position.y).toBe(0);
        expect(waterLayer.group.position.z).toBe(0);
      }
      
      // Cleanup
      manager.removeWaterFromChunk(chunkKey, scene);
    }
  });

  // Property 1: Bug Condition - Water Positioned at World Coordinates
  // **Validates: Requirements 2.3**
  test('Water elevation equals (seaLevel + waterOffset) * HEIGHT_SCALE', () => {
    fc.assert(
      fc.property(
        fc.record({
          chunkX: fc.integer({ min: -5, max: 5 }),
          chunkY: fc.integer({ min: -5, max: 5 }),
          seaLevel: fc.double({ min: 0.2, max: 0.8, noNaN: true }),
          waterOffset: fc.double({ min: 0, max: 0.2, noNaN: true }),
        }),
        ({ chunkX, chunkY, seaLevel, waterOffset }) => {
          const size = 32;
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
            rendering: {
              ...DEFAULT_WATER_CONFIG.rendering,
              waterOffset,
            },
          };
          
          const chunkData = createOceanChunk(chunkX, chunkY, size, seaLevel);
          const oceanTiles = identifyOceanTiles(chunkData, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunkData, config);
          
          expect(geometry).not.toBeNull();
          
          if (geometry) {
            const vertices = extractVertexPositions(geometry);
            const expectedElevation = (seaLevel + waterOffset) * HEIGHT_SCALE;
            
            // All vertices should be at the correct water elevation
            for (const vertex of vertices) {
              expect(vertex.y).toBeCloseTo(expectedElevation, 5);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property 1: Bug Condition - Water Positioned at World Coordinates
  // **Validates: Requirements 2.4, 2.5**
  test('Water appears at correct world position for all chunk coordinates', () => {
    fc.assert(
      fc.property(
        fc.record({
          chunkX: fc.integer({ min: -10, max: 10 }),
          chunkY: fc.integer({ min: -10, max: 10 }),
        }),
        ({ chunkX, chunkY }) => {
          const size = 32;
          const seaLevel = 0.3;
          const config: WaterConfig = {
            ...DEFAULT_WATER_CONFIG,
            seaLevel,
          };
          
          const chunkData = createOceanChunk(chunkX, chunkY, size, seaLevel);
          const oceanTiles = identifyOceanTiles(chunkData, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunkData, config);
          
          expect(geometry).not.toBeNull();
          
          if (geometry) {
            const vertices = extractVertexPositions(geometry);
            
            // Calculate expected world coordinate bounds
            const worldMinX = chunkX * size;
            const worldMaxX = chunkX * size + size;
            const worldMinZ = chunkY * size;
            const worldMaxZ = chunkY * size + size;
            
            // Find actual bounds from vertices
            let actualMinX = Infinity;
            let actualMaxX = -Infinity;
            let actualMinZ = Infinity;
            let actualMaxZ = -Infinity;
            
            for (const vertex of vertices) {
              actualMinX = Math.min(actualMinX, vertex.x);
              actualMaxX = Math.max(actualMaxX, vertex.x);
              actualMinZ = Math.min(actualMinZ, vertex.z);
              actualMaxZ = Math.max(actualMaxZ, vertex.z);
            }
            
            // Verify vertices are in the correct world coordinate range
            expect(actualMinX).toBeCloseTo(worldMinX, 1);
            expect(actualMaxX).toBeCloseTo(worldMaxX, 1);
            expect(actualMinZ).toBeCloseTo(worldMinZ, 1);
            expect(actualMaxZ).toBeCloseTo(worldMaxZ, 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 1: Bug Condition - Water Positioned at World Coordinates
  // **Validates: Requirements 2.1, 2.4**
  test('Adjacent chunks have seamless water boundaries with world coordinates', () => {
    const size = 32;
    const seaLevel = 0.3;
    const config: WaterConfig = {
      ...DEFAULT_WATER_CONFIG,
      seaLevel,
    };
    
    // Test horizontal adjacency
    const chunk1 = createOceanChunk(0, 0, size, seaLevel);
    const chunk2 = createOceanChunk(1, 0, size, seaLevel);
    
    const oceanTiles1 = identifyOceanTiles(chunk1, seaLevel);
    const oceanTiles2 = identifyOceanTiles(chunk2, seaLevel);
    
    const geometry1 = buildOceanGeometry(oceanTiles1, chunk1, config);
    const geometry2 = buildOceanGeometry(oceanTiles2, chunk2, config);
    
    expect(geometry1).not.toBeNull();
    expect(geometry2).not.toBeNull();
    
    if (geometry1 && geometry2) {
      const vertices1 = extractVertexPositions(geometry1);
      const vertices2 = extractVertexPositions(geometry2);
      
      // Find boundary vertices at x = size (right edge of chunk1, left edge of chunk2)
      const boundaryX = size;
      const tolerance = 0.001;
      
      const boundary1 = vertices1.filter(v => Math.abs(v.x - boundaryX) < tolerance);
      const boundary2 = vertices2.filter(v => Math.abs(v.x - boundaryX) < tolerance);
      
      // Both chunks should have boundary vertices at the same world coordinate
      expect(boundary1.length).toBeGreaterThan(0);
      expect(boundary2.length).toBeGreaterThan(0);
      
      // Verify boundary vertices have matching coordinates
      for (const v1 of boundary1) {
        const hasMatch = boundary2.some(v2 =>
          Math.abs(v1.x - v2.x) < tolerance &&
          Math.abs(v1.y - v2.y) < tolerance &&
          Math.abs(v1.z - v2.z) < tolerance
        );
        expect(hasMatch).toBe(true);
      }
    }
  });
});
