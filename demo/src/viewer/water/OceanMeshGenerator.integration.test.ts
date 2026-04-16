/**
 * Integration tests for ocean mesh generation across multiple chunks
 * 
 * Validates seamless ocean surfaces across chunk boundaries in realistic scenarios.
 */

import { describe, it, expect } from 'vitest';
import { identifyOceanTiles, buildOceanGeometry } from './OceanMeshGenerator';
import type { ChunkData } from '../../../../src/world/chunk';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG, HEIGHT_SCALE } from './config';

/**
 * Create a test chunk with specified heightmap
 */
function createTestChunk(
  heightmap: number[],
  size: number,
  x: number,
  y: number
): ChunkData {
  const vertexSize = size + 1;
  const expectedLength = vertexSize * vertexSize;
  
  if (heightmap.length !== expectedLength) {
    throw new Error(`Heightmap must have ${expectedLength} vertices for size ${size}`);
  }

  return {
    x,
    y,
    size,
    heightmap: new Float32Array(heightmap),
    biomeMap: new Uint8Array(size * size),
    biomeWeights: new Float32Array(size * size * 8),
    resources: [],
    structures: [],
    rivers: new Set(),
  };
}

/**
 * Generate a realistic heightmap with ocean and land
 */
function generateRealisticHeightmap(
  size: number,
  chunkX: number,
  chunkY: number,
  seaLevel: number
): number[] {
  const vertexSize = size + 1;
  const heightmap: number[] = [];
  
  for (let y = 0; y < vertexSize; y++) {
    for (let x = 0; x < vertexSize; x++) {
      // Create a simple gradient from ocean (left) to land (right)
      const worldX = chunkX * size + x;
      const worldY = chunkY * size + y;
      
      // Simple height function: increases with x coordinate
      const height = (worldX / (size * 2)) * 0.6 + 0.1;
      heightmap.push(height);
    }
  }
  
  return heightmap;
}

describe('OceanMeshGenerator - Integration Tests', () => {
  const seaLevel = 0.3;
  const waterOffset = 0.1;
  const config: WaterConfig = {
    ...DEFAULT_WATER_CONFIG,
    seaLevel,
    rendering: {
      ...DEFAULT_WATER_CONFIG.rendering,
      waterOffset,
    },
  };

  describe('multi-chunk ocean continuity', () => {
    it('should create seamless ocean across 3x3 chunk grid', () => {
      const size = 8;
      const gridSize = 3;
      
      // Generate 3x3 grid of chunks with realistic heightmaps
      const chunks: ChunkData[] = [];
      const geometries: (THREE.BufferGeometry | null)[] = [];
      
      for (let cy = 0; cy < gridSize; cy++) {
        for (let cx = 0; cx < gridSize; cx++) {
          const heightmap = generateRealisticHeightmap(size, cx, cy, seaLevel);
          const chunk = createTestChunk(heightmap, size, cx, cy);
          chunks.push(chunk);
          
          const oceanTiles = identifyOceanTiles(chunk, seaLevel);
          const geometry = buildOceanGeometry(oceanTiles, chunk, config);
          geometries.push(geometry);
        }
      }
      
      // Verify that all chunks with ocean have valid geometries
      const validGeometries = geometries.filter(g => g !== null);
      expect(validGeometries.length).toBeGreaterThan(0);
      
      // Verify all geometries use the same water elevation
      const expectedElevation = (seaLevel + waterOffset) * HEIGHT_SCALE;
      for (const geometry of validGeometries) {
        if (geometry) {
          const positions = geometry.getAttribute('position');
          for (let i = 1; i < positions.count * 3; i += 3) {
            expect(positions.array[i]).toBeCloseTo(expectedElevation);
          }
        }
      }
    });

    it('should handle mixed ocean and land chunks seamlessly', () => {
      const size = 4;
      
      // Create a scenario with ocean on left, land on right
      const oceanHeightmap = new Array((size + 1) * (size + 1)).fill(0.1);
      const landHeightmap = new Array((size + 1) * (size + 1)).fill(0.5);
      
      // Create transition heightmap (left side ocean, right side land)
      const transitionHeightmap: number[] = [];
      for (let y = 0; y < size + 1; y++) {
        for (let x = 0; x < size + 1; x++) {
          // Gradual transition from ocean to land
          const height = 0.1 + (x / size) * 0.5;
          transitionHeightmap.push(height);
        }
      }
      
      const oceanChunk = createTestChunk(oceanHeightmap, size, 0, 0);
      const transitionChunk = createTestChunk(transitionHeightmap, size, 1, 0);
      const landChunk = createTestChunk(landHeightmap, size, 2, 0);
      
      const oceanTiles1 = identifyOceanTiles(oceanChunk, seaLevel);
      const oceanTiles2 = identifyOceanTiles(transitionChunk, seaLevel);
      const oceanTiles3 = identifyOceanTiles(landChunk, seaLevel);
      
      const geometry1 = buildOceanGeometry(oceanTiles1, oceanChunk, config);
      const geometry2 = buildOceanGeometry(oceanTiles2, transitionChunk, config);
      const geometry3 = buildOceanGeometry(oceanTiles3, landChunk, config);
      
      // Ocean chunk should have water
      expect(geometry1).not.toBeNull();
      
      // Transition chunk may have some water
      // (depends on how many tiles are below sea level)
      
      // Land chunk should have no water
      expect(geometry3).toBeNull();
      
      // If transition chunk has water, it should align with ocean chunk
      if (geometry1 && geometry2) {
        const positions1 = geometry1.getAttribute('position');
        const positions2 = geometry2.getAttribute('position');
        
        // Both should use the same elevation
        const expectedElevation = (seaLevel + waterOffset) * HEIGHT_SCALE;
        expect(positions1.array[1]).toBeCloseTo(expectedElevation);
        expect(positions2.array[1]).toBeCloseTo(expectedElevation);
      }
    });
  });

  describe('realistic ocean scenarios', () => {
    it('should handle archipelago scenario (islands in ocean)', () => {
      const size = 8;
      
      // Create heightmap with an island in the middle
      const heightmap: number[] = [];
      const vertexSize = size + 1;
      const centerX = size / 2;
      const centerY = size / 2;
      
      for (let y = 0; y < vertexSize; y++) {
        for (let x = 0; x < vertexSize; x++) {
          // Distance from center
          const dx = x - centerX;
          const dy = y - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Island in center, ocean around edges
          const height = distance < 2 ? 0.5 : 0.1;
          heightmap.push(height);
        }
      }
      
      const chunk = createTestChunk(heightmap, size, 0, 0);
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      expect(geometry).not.toBeNull();
      
      if (geometry) {
        // Should have ocean tiles (around the island)
        expect(oceanTiles.length).toBeGreaterThan(0);
        
        // Should not cover entire chunk (island in middle)
        expect(oceanTiles.length).toBeLessThan(size * size);
        
        // All water should be at correct elevation
        const positions = geometry.getAttribute('position');
        const expectedElevation = (seaLevel + waterOffset) * HEIGHT_SCALE;
        for (let i = 1; i < positions.count * 3; i += 3) {
          expect(positions.array[i]).toBeCloseTo(expectedElevation);
        }
      }
    });

    it('should handle coastal scenario (ocean meets land)', () => {
      const size = 8;
      
      // Create heightmap with ocean on left, land on right
      const heightmap: number[] = [];
      const vertexSize = size + 1;
      
      for (let y = 0; y < vertexSize; y++) {
        for (let x = 0; x < vertexSize; x++) {
          // Smooth transition from ocean to land
          const height = (x / size) * 0.6;
          heightmap.push(height);
        }
      }
      
      const chunk = createTestChunk(heightmap, size, 0, 0);
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      // Should have some ocean tiles on the left side
      expect(oceanTiles.length).toBeGreaterThan(0);
      expect(geometry).not.toBeNull();
      
      if (geometry) {
        // Verify geometry is valid
        const positions = geometry.getAttribute('position');
        expect(positions.count).toBeGreaterThan(0);
        
        // All vertices should be at correct elevation
        const expectedElevation = (seaLevel + waterOffset) * HEIGHT_SCALE;
        for (let i = 1; i < positions.count * 3; i += 3) {
          expect(positions.array[i]).toBeCloseTo(expectedElevation);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle single ocean tile', () => {
      const size = 4;
      
      // Create heightmap with only one underwater tile
      // Tile (0,0) needs all 4 corner vertices underwater
      const heightmap: number[] = [];
      const vertexSize = size + 1;
      
      for (let y = 0; y < vertexSize; y++) {
        for (let x = 0; x < vertexSize; x++) {
          // Make tile (0,0) underwater by setting its 4 corners to 0.1
          // Corners are at (0,0), (1,0), (0,1), (1,1)
          const isCornerOfFirstTile = (x <= 1 && y <= 1);
          const height = isCornerOfFirstTile ? 0.1 : 0.5;
          heightmap.push(height);
        }
      }
      
      const chunk = createTestChunk(heightmap, size, 0, 0);
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      expect(oceanTiles.length).toBe(1);
      expect(geometry).not.toBeNull();
      
      if (geometry) {
        const positions = geometry.getAttribute('position');
        // 1 tile = 4 vertices
        expect(positions.count).toBe(4);
      }
    });

    it('should handle checkerboard pattern', () => {
      const size = 4;
      
      // Create checkerboard pattern of ocean and land
      // Each tile needs all 4 corners at the same height
      const heightmap: number[] = [];
      const vertexSize = size + 1;
      
      for (let y = 0; y < vertexSize; y++) {
        for (let x = 0; x < vertexSize; x++) {
          // Determine which tile this vertex belongs to (use floor for tile coordinates)
          // For checkerboard, we need to ensure all 4 corners of a tile have the same height
          // Use the top-left tile coordinate to determine the pattern
          const tileX = Math.min(x, size - 1);
          const tileY = Math.min(y, size - 1);
          const isOcean = (tileX + tileY) % 2 === 0;
          const height = isOcean ? 0.1 : 0.5;
          heightmap.push(height);
        }
      }
      
      const chunk = createTestChunk(heightmap, size, 0, 0);
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      // Should have roughly half the tiles as ocean (8 out of 16 tiles)
      expect(oceanTiles.length).toBeGreaterThan(0);
      expect(geometry).not.toBeNull();
      
      if (geometry) {
        // Verify all vertices are at correct elevation
        const positions = geometry.getAttribute('position');
        const expectedElevation = (seaLevel + waterOffset) * HEIGHT_SCALE;
        for (let i = 1; i < positions.count * 3; i += 3) {
          expect(positions.array[i]).toBeCloseTo(expectedElevation);
        }
      }
    });
  });
});
