/**
 * Unit tests for OceanMeshGenerator
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { identifyOceanTiles, buildOceanGeometry } from './OceanMeshGenerator';
import type { ChunkData } from '../../../../src/world/chunk';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG, HEIGHT_SCALE } from './config';

/**
 * Create a test chunk with specified heightmap
 */
function createTestChunk(
  heightmap: number[],
  size: number = 4,
  x: number = 0,
  y: number = 0
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

describe('OceanMeshGenerator', () => {
  describe('identifyOceanTiles', () => {
    it('should identify tiles below sea level', () => {
      // Create 4x4 chunk with some underwater tiles
      // Heightmap is 5x5 vertices
      const heightmap = [
        0.2, 0.2, 0.4, 0.4, 0.5,
        0.2, 0.2, 0.4, 0.4, 0.5,
        0.4, 0.4, 0.5, 0.5, 0.6,
        0.4, 0.4, 0.5, 0.5, 0.6,
        0.5, 0.5, 0.6, 0.6, 0.7,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);

      // Tile (0,0) has corners: 0.2, 0.2, 0.2, 0.2 -> avg = 0.2 (underwater)
      // Tile (1,0) has corners: 0.2, 0.4, 0.2, 0.4 -> avg = 0.3 (at sea level, not underwater)
      // Only tile (0,0) should be underwater
      expect(oceanTiles.length).toBe(1);
      
      // Check first tile
      expect(oceanTiles[0].index).toBe(0);
      expect(oceanTiles[0].terrainHeight).toBeCloseTo(0.2);
      expect(oceanTiles[0].waterElevation).toBe(seaLevel);
      expect(oceanTiles[0].underwaterDepth).toBeCloseTo(0.1);
    });

    it('should return empty array for chunk with no ocean', () => {
      // All heights above sea level
      const heightmap = [
        0.5, 0.5, 0.6, 0.6, 0.7,
        0.5, 0.5, 0.6, 0.6, 0.7,
        0.6, 0.6, 0.7, 0.7, 0.8,
        0.6, 0.6, 0.7, 0.7, 0.8,
        0.7, 0.7, 0.8, 0.8, 0.9,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);

      expect(oceanTiles).toEqual([]);
    });

    it('should identify all tiles as ocean when chunk is fully underwater', () => {
      // All heights below sea level
      const heightmap = [
        0.1, 0.1, 0.1, 0.1, 0.1,
        0.1, 0.1, 0.1, 0.1, 0.1,
        0.1, 0.1, 0.1, 0.1, 0.1,
        0.1, 0.1, 0.1, 0.1, 0.1,
        0.1, 0.1, 0.1, 0.1, 0.1,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);

      // 4x4 = 16 tiles
      expect(oceanTiles.length).toBe(16);
      
      // All should have same properties
      oceanTiles.forEach(tile => {
        expect(tile.terrainHeight).toBeCloseTo(0.1);
        expect(tile.waterElevation).toBe(seaLevel);
        expect(tile.underwaterDepth).toBeCloseTo(0.2);
      });
    });

    it('should handle tiles exactly at sea level as above water', () => {
      // Heights exactly at sea level
      const heightmap = [
        0.3, 0.3, 0.3, 0.3, 0.3,
        0.3, 0.3, 0.3, 0.3, 0.3,
        0.3, 0.3, 0.3, 0.3, 0.3,
        0.3, 0.3, 0.3, 0.3, 0.3,
        0.3, 0.3, 0.3, 0.3, 0.3,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);

      // Tiles at exactly sea level should not be ocean
      expect(oceanTiles).toEqual([]);
    });

    it('should calculate correct tile indices', () => {
      // Create pattern where we can verify indices
      const heightmap = [
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);

      // Only top-left tile (0,0) should be underwater
      expect(oceanTiles.length).toBe(1);
      expect(oceanTiles[0].index).toBe(0);
    });
  });

  describe('buildOceanGeometry', () => {
    it('should return null for empty ocean tiles array', () => {
      const chunk = createTestChunk(new Array(25).fill(0.5), 4);
      const config: WaterConfig = { ...DEFAULT_WATER_CONFIG };
      
      const geometry = buildOceanGeometry([], chunk, config);
      
      expect(geometry).toBeNull();
    });

    it('should create geometry with correct vertex count', () => {
      const heightmap = [
        0.1, 0.1, 0.1, 0.1, 0.1,
        0.1, 0.1, 0.1, 0.1, 0.1,
        0.1, 0.1, 0.1, 0.1, 0.1,
        0.1, 0.1, 0.1, 0.1, 0.1,
        0.1, 0.1, 0.1, 0.1, 0.1,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const config: WaterConfig = { ...DEFAULT_WATER_CONFIG };
      
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      expect(geometry).not.toBeNull();
      if (geometry) {
        const positions = geometry.getAttribute('position');
        // 16 tiles * 4 vertices per tile = 64 vertices
        expect(positions.count).toBe(64);
      }
    });

    it('should position water surface at seaLevel + waterOffset', () => {
      const heightmap = [
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const waterOffset = 0.1;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        seaLevel,
        rendering: {
          ...DEFAULT_WATER_CONFIG.rendering,
          waterOffset,
        },
      };
      
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      expect(geometry).not.toBeNull();
      if (geometry) {
        const positions = geometry.getAttribute('position');
        const expectedElevation = (seaLevel + waterOffset) * HEIGHT_SCALE;
        
        // Check all Y coordinates (every 3rd value starting at index 1)
        for (let i = 1; i < positions.count * 3; i += 3) {
          expect(positions.array[i]).toBeCloseTo(expectedElevation);
        }
      }
    });

    it('should create geometry with proper normals', () => {
      const heightmap = [
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const config: WaterConfig = { ...DEFAULT_WATER_CONFIG };
      
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      expect(geometry).not.toBeNull();
      if (geometry) {
        const normals = geometry.getAttribute('normal');
        
        // All normals should point up (0, 1, 0)
        for (let i = 0; i < normals.count; i++) {
          expect(normals.getX(i)).toBe(0);
          expect(normals.getY(i)).toBe(1);
          expect(normals.getZ(i)).toBe(0);
        }
      }
    });

    it('should create geometry with UV coordinates', () => {
      const heightmap = [
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const config: WaterConfig = { ...DEFAULT_WATER_CONFIG };
      
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      expect(geometry).not.toBeNull();
      if (geometry) {
        const uvs = geometry.getAttribute('uv');
        expect(uvs).toBeDefined();
        expect(uvs.count).toBe(4); // 1 tile * 4 vertices
      }
    });

    it('should create geometry with correct triangle indices', () => {
      const heightmap = [
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const config: WaterConfig = { ...DEFAULT_WATER_CONFIG };
      
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      expect(geometry).not.toBeNull();
      if (geometry) {
        const index = geometry.getIndex();
        expect(index).not.toBeNull();
        if (index) {
          // 1 tile = 2 triangles = 6 indices
          expect(index.count).toBe(6);
        }
      }
    });

    it('should compute bounding sphere', () => {
      const heightmap = [
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.1, 0.1, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const config: WaterConfig = { ...DEFAULT_WATER_CONFIG };
      
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      expect(geometry).not.toBeNull();
      if (geometry) {
        expect(geometry.boundingSphere).not.toBeNull();
      }
    });

    it('should handle multiple ocean tiles correctly', () => {
      const heightmap = [
        0.1, 0.1, 0.1, 0.5, 0.5,
        0.1, 0.1, 0.1, 0.5, 0.5,
        0.1, 0.1, 0.1, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5,
      ];
      
      const chunk = createTestChunk(heightmap, 4);
      const seaLevel = 0.3;
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const config: WaterConfig = { ...DEFAULT_WATER_CONFIG };
      
      // Should have 4 ocean tiles (top-left 2x2 area)
      // Tiles (0,0), (1,0), (0,1), (1,1) all have avg height 0.1
      expect(oceanTiles.length).toBe(4);
      
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);
      
      expect(geometry).not.toBeNull();
      if (geometry) {
        const positions = geometry.getAttribute('position');
        // 4 tiles * 4 vertices = 16 vertices
        expect(positions.count).toBe(16);
        
        const index = geometry.getIndex();
        if (index) {
          // 4 tiles * 6 indices = 24 indices
          expect(index.count).toBe(24);
        }
      }
    });
  });
});
