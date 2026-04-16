/**
 * Unit tests for LakeMeshGenerator
 * 
 * Tests lake mesh generation for various lake shapes, elevation positioning,
 * and edge cases like empty lake data.
 */

import { describe, it, expect } from 'vitest';
import { generateLakeMeshes } from './LakeMeshGenerator';
import type { ChunkData } from '../../../../src/world/chunk';
import type { RiverNetwork, Lake } from '../../../../src/gen/rivers';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG, HEIGHT_SCALE } from './config';

describe('LakeMeshGenerator', () => {
  // Helper to create test chunk data
  function createTestChunk(size: number = 32): ChunkData {
    const vertexSize = size + 1;
    const heightmap = new Float32Array(vertexSize * vertexSize);
    
    // Fill with default terrain height
    for (let i = 0; i < heightmap.length; i++) {
      heightmap[i] = 0.5;
    }
    
    return {
      x: 0,
      y: 0,
      size,
      heightmap,
      seed: 12345,
    };
  }

  // Helper to create test lake
  function createTestLake(tiles: number[], elevation: number): Lake {
    return {
      tiles: new Set(tiles),
      elevation,
      outlet: -1,
    };
  }

  // Helper to create test river network
  function createTestRiverNetwork(lakes: Lake[]): RiverNetwork {
    return {
      segments: [],
      lakes,
      tileToSegment: new Map(),
    };
  }

  describe('generateLakeMeshes', () => {
    it('should return empty array when river network is null', () => {
      const chunkData = createTestChunk();
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, null as any, config);
      
      expect(meshes).toEqual([]);
    });

    it('should return empty array when river network has no lakes', () => {
      const chunkData = createTestChunk();
      const riverNetwork = createTestRiverNetwork([]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      expect(meshes).toEqual([]);
    });

    it('should generate mesh for single-tile lake', () => {
      const chunkData = createTestChunk();
      const lake = createTestLake([100], 0.4);
      const riverNetwork = createTestRiverNetwork([lake]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      expect(meshes).toHaveLength(1);
      expect(meshes[0].geometry).toBeDefined();
      expect(meshes[0].material).toBeDefined();
    });

    it('should generate mesh for multi-tile lake', () => {
      const chunkData = createTestChunk();
      const lake = createTestLake([100, 101, 132, 133], 0.4);
      const riverNetwork = createTestRiverNetwork([lake]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      expect(meshes).toHaveLength(1);
      
      const geometry = meshes[0].geometry;
      const positions = geometry.getAttribute('position');
      
      // 4 tiles × 4 vertices per tile = 16 vertices
      expect(positions.count).toBe(16);
    });

    it('should generate separate meshes for multiple lakes', () => {
      const chunkData = createTestChunk();
      const lake1 = createTestLake([100, 101], 0.4);
      const lake2 = createTestLake([200, 201], 0.45);
      const riverNetwork = createTestRiverNetwork([lake1, lake2]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      expect(meshes).toHaveLength(2);
    });

    it('should position lake water at lake elevation + waterOffset', () => {
      const chunkData = createTestChunk();
      const lakeElevation = 0.4;
      const lake = createTestLake([100], lakeElevation);
      const riverNetwork = createTestRiverNetwork([lake]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      const geometry = meshes[0].geometry;
      const positions = geometry.getAttribute('position');
      
      // Check that all Y coordinates match lake elevation + waterOffset scaled by HEIGHT_SCALE
      const expectedY = (lakeElevation + config.rendering.waterOffset) * HEIGHT_SCALE;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        expect(y).toBeCloseTo(expectedY, 5);
      }
    });

    it('should handle empty lake tiles gracefully', () => {
      const chunkData = createTestChunk();
      const lake = createTestLake([], 0.4);
      const riverNetwork = createTestRiverNetwork([lake]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      // Should return empty array since lake has no tiles
      expect(meshes).toHaveLength(0);
    });

    it('should generate mesh for irregular lake shape', () => {
      const chunkData = createTestChunk();
      // L-shaped lake
      const lake = createTestLake([100, 101, 102, 132, 164], 0.4);
      const riverNetwork = createTestRiverNetwork([lake]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      expect(meshes).toHaveLength(1);
      
      const geometry = meshes[0].geometry;
      const positions = geometry.getAttribute('position');
      
      // 5 tiles × 4 vertices per tile = 20 vertices
      expect(positions.count).toBe(20);
    });

    it('should apply lake material configuration', () => {
      const chunkData = createTestChunk();
      const lake = createTestLake([100], 0.4);
      const riverNetwork = createTestRiverNetwork([lake]);
      
      const customConfig: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        lake: {
          color: 0xff0000,
          opacity: 0.8,
          shininess: 50,
        },
      };
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, customConfig);
      
      const material = meshes[0].material as THREE.MeshPhongMaterial;
      expect(material.color.r).toBe(1);
      expect(material.color.g).toBe(0);
      expect(material.color.b).toBe(0);
      expect(material.opacity).toBe(0.8);
      expect(material.shininess).toBe(50);
      expect(material.transparent).toBe(true);
    });

    it('should set correct render order', () => {
      const chunkData = createTestChunk();
      const lake = createTestLake([100], 0.4);
      const riverNetwork = createTestRiverNetwork([lake]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      // Lake should render after terrain and rivers (renderOrder = 2)
      expect(meshes[0].renderOrder).toBe(2);
    });

    it('should generate normals pointing upward', () => {
      const chunkData = createTestChunk();
      const lake = createTestLake([100], 0.4);
      const riverNetwork = createTestRiverNetwork([lake]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      const geometry = meshes[0].geometry;
      const normals = geometry.getAttribute('normal');
      
      // All normals should point up (0, 1, 0)
      for (let i = 0; i < normals.count; i++) {
        expect(normals.getX(i)).toBe(0);
        expect(normals.getY(i)).toBe(1);
        expect(normals.getZ(i)).toBe(0);
      }
    });

    it('should compute bounding sphere and box', () => {
      const chunkData = createTestChunk();
      const lake = createTestLake([100, 101], 0.4);
      const riverNetwork = createTestRiverNetwork([lake]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      const geometry = meshes[0].geometry;
      expect(geometry.boundingSphere).not.toBeNull();
      expect(geometry.boundingBox).not.toBeNull();
    });

    it('should handle large lake with many tiles', () => {
      const chunkData = createTestChunk();
      
      // Create a 5x5 lake (25 tiles)
      const lakeTiles: number[] = [];
      for (let y = 10; y < 15; y++) {
        for (let x = 10; x < 15; x++) {
          lakeTiles.push(y * 32 + x);
        }
      }
      
      const lake = createTestLake(lakeTiles, 0.4);
      const riverNetwork = createTestRiverNetwork([lake]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      expect(meshes).toHaveLength(1);
      
      const geometry = meshes[0].geometry;
      const positions = geometry.getAttribute('position');
      
      // 25 tiles × 4 vertices per tile = 100 vertices
      expect(positions.count).toBe(100);
    });

    it('should handle lakes at different elevations', () => {
      const chunkData = createTestChunk();
      const lake1 = createTestLake([100], 0.35);
      const lake2 = createTestLake([200], 0.55);
      const riverNetwork = createTestRiverNetwork([lake1, lake2]);
      const config = DEFAULT_WATER_CONFIG;
      
      const meshes = generateLakeMeshes(chunkData, riverNetwork, config);
      
      expect(meshes).toHaveLength(2);
      
      // Check elevations scaled by HEIGHT_SCALE
      const geometry1 = meshes[0].geometry;
      const positions1 = geometry1.getAttribute('position');
      const expectedY1 = (0.35 + config.rendering.waterOffset) * HEIGHT_SCALE;
      expect(positions1.getY(0)).toBeCloseTo(expectedY1, 5);
      
      const geometry2 = meshes[1].geometry;
      const positions2 = geometry2.getAttribute('position');
      const expectedY2 = (0.55 + config.rendering.waterOffset) * HEIGHT_SCALE;
      expect(positions2.getY(0)).toBeCloseTo(expectedY2, 5);
    });
  });
});
