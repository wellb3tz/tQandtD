import { describe, it, expect } from 'vitest';
import { LODLevel, LODManager, type LODConfig } from '../../../src/world/lod';
import type { ChunkData } from '../../../src/world/chunk';
import { ResourceType, StructureType } from '../../../src/world/chunk';

describe('LOD Data Structures', () => {
  describe('LODLevel enum', () => {
    it('should have HIGH level with value 0', () => {
      expect(LODLevel.HIGH).toBe(0);
    });

    it('should have MEDIUM level with value 1', () => {
      expect(LODLevel.MEDIUM).toBe(1);
    });

    it('should have LOW level with value 2', () => {
      expect(LODLevel.LOW).toBe(2);
    });

    it('should have exactly 3 levels', () => {
      const levels = Object.values(LODLevel).filter(v => typeof v === 'number');
      expect(levels).toHaveLength(3);
    });
  });

  describe('LODConfig interface', () => {
    it('should accept valid LOD configuration', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };

      expect(config.distances).toEqual([2, 5]);
      expect(config.meshResolutions).toEqual([1.0, 0.5, 0.25]);
      expect(config.featureDensities).toEqual([1.0, 0.5, 0.25]);
    });

    it('should accept configuration with different resolution values', () => {
      const config: LODConfig = {
        distances: [3, 7, 15],
        meshResolutions: [1.0, 0.75, 0.5],
        featureDensities: [1.0, 0.6, 0.3],
      };

      expect(config.distances).toHaveLength(3);
      expect(config.meshResolutions).toHaveLength(3);
      expect(config.featureDensities).toHaveLength(3);
    });

    it('should accept empty arrays', () => {
      const config: LODConfig = {
        distances: [],
        meshResolutions: [],
        featureDensities: [],
      };

      expect(config.distances).toEqual([]);
      expect(config.meshResolutions).toEqual([]);
      expect(config.featureDensities).toEqual([]);
    });
  });

  describe('LODConfig validation scenarios', () => {
    it('should handle configuration for 3 LOD levels', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };

      // Verify array lengths match expected LOD levels
      expect(config.meshResolutions).toHaveLength(3);
      expect(config.featureDensities).toHaveLength(3);
      // Distance thresholds should be one less than LOD levels
      expect(config.distances).toHaveLength(2);
    });

    it('should handle decreasing resolution values', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };

      // Verify resolutions decrease with LOD level
      expect(config.meshResolutions[LODLevel.HIGH]).toBeGreaterThan(
        config.meshResolutions[LODLevel.MEDIUM]
      );
      expect(config.meshResolutions[LODLevel.MEDIUM]).toBeGreaterThan(
        config.meshResolutions[LODLevel.LOW]
      );
    });

    it('should handle decreasing density values', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };

      // Verify densities decrease with LOD level
      expect(config.featureDensities[LODLevel.HIGH]).toBeGreaterThan(
        config.featureDensities[LODLevel.MEDIUM]
      );
      expect(config.featureDensities[LODLevel.MEDIUM]).toBeGreaterThan(
        config.featureDensities[LODLevel.LOW]
      );
    });
  });
});


describe('LODManager', () => {
  describe('constructor', () => {
    it('should create LODManager with valid configuration', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };

      const manager = new LODManager(config);
      expect(manager).toBeDefined();
    });
  });

  describe('getLODLevel', () => {
    it('should return HIGH for chunks close to viewer', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      // Distance = 0 (viewer at chunk position)
      expect(manager.getLODLevel(0, 0, 0, 0)).toBe(LODLevel.HIGH);

      // Distance = 1 (adjacent chunk)
      expect(manager.getLODLevel(1, 0, 0, 0)).toBe(LODLevel.HIGH);

      // Distance = 1.41 (diagonal adjacent)
      expect(manager.getLODLevel(1, 1, 0, 0)).toBe(LODLevel.HIGH);
    });

    it('should return MEDIUM for chunks at medium distance', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      // Distance = 2.83 (between 2 and 5)
      expect(manager.getLODLevel(2, 2, 0, 0)).toBe(LODLevel.MEDIUM);

      // Distance = 3 (between 2 and 5)
      expect(manager.getLODLevel(3, 0, 0, 0)).toBe(LODLevel.MEDIUM);

      // Distance = 4.24 (between 2 and 5)
      expect(manager.getLODLevel(3, 3, 0, 0)).toBe(LODLevel.MEDIUM);
    });

    it('should return LOW for chunks far from viewer', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      // Distance = 5 (at threshold)
      expect(manager.getLODLevel(5, 0, 0, 0)).toBe(LODLevel.LOW);

      // Distance = 7.07 (beyond threshold)
      expect(manager.getLODLevel(5, 5, 0, 0)).toBe(LODLevel.LOW);

      // Distance = 10 (far beyond threshold)
      expect(manager.getLODLevel(10, 0, 0, 0)).toBe(LODLevel.LOW);
    });

    it('should calculate distance correctly with negative coordinates', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      // Distance = 1 (negative direction)
      expect(manager.getLODLevel(-1, 0, 0, 0)).toBe(LODLevel.HIGH);

      // Distance = 2.83 (negative coordinates)
      expect(manager.getLODLevel(-2, -2, 0, 0)).toBe(LODLevel.MEDIUM);
    });

    it('should handle viewer not at origin', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      // Viewer at (10, 10), chunk at (10, 10) - distance = 0
      expect(manager.getLODLevel(10, 10, 10, 10)).toBe(LODLevel.HIGH);

      // Viewer at (10, 10), chunk at (11, 10) - distance = 1
      expect(manager.getLODLevel(11, 10, 10, 10)).toBe(LODLevel.HIGH);

      // Viewer at (10, 10), chunk at (13, 10) - distance = 3
      expect(manager.getLODLevel(13, 10, 10, 10)).toBe(LODLevel.MEDIUM);

      // Viewer at (10, 10), chunk at (16, 10) - distance = 6
      expect(manager.getLODLevel(16, 10, 10, 10)).toBe(LODLevel.LOW);
    });

    it('should return HIGH when no distance thresholds configured', () => {
      const config: LODConfig = {
        distances: [],
        meshResolutions: [1.0],
        featureDensities: [1.0],
      };
      const manager = new LODManager(config);

      expect(manager.getLODLevel(0, 0, 0, 0)).toBe(LODLevel.HIGH);
      expect(manager.getLODLevel(100, 100, 0, 0)).toBe(LODLevel.HIGH);
    });

    it('should handle boundary cases at exact threshold distances', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      // Distance exactly 2.0 should be MEDIUM (not less than 2)
      expect(manager.getLODLevel(2, 0, 0, 0)).toBe(LODLevel.MEDIUM);

      // Distance exactly 5.0 should be LOW (not less than 5)
      expect(manager.getLODLevel(5, 0, 0, 0)).toBe(LODLevel.LOW);

      // Distance slightly less than 2.0 should be HIGH
      expect(manager.getLODLevel(1.9, 0, 0, 0)).toBe(LODLevel.HIGH);
    });
  });

  describe('getMeshResolution', () => {
    it('should return correct resolution for each LOD level', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      expect(manager.getMeshResolution(LODLevel.HIGH)).toBe(1.0);
      expect(manager.getMeshResolution(LODLevel.MEDIUM)).toBe(0.5);
      expect(manager.getMeshResolution(LODLevel.LOW)).toBe(0.25);
    });

    it('should return 1.0 for unconfigured LOD levels', () => {
      const config: LODConfig = {
        distances: [2],
        meshResolutions: [1.0],
        featureDensities: [1.0],
      };
      const manager = new LODManager(config);

      expect(manager.getMeshResolution(LODLevel.HIGH)).toBe(1.0);
      expect(manager.getMeshResolution(LODLevel.MEDIUM)).toBe(1.0);
      expect(manager.getMeshResolution(LODLevel.LOW)).toBe(1.0);
    });
  });

  describe('getFeatureDensity', () => {
    it('should return correct density for each LOD level', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.6, 0.3],
      };
      const manager = new LODManager(config);

      expect(manager.getFeatureDensity(LODLevel.HIGH)).toBe(1.0);
      expect(manager.getFeatureDensity(LODLevel.MEDIUM)).toBe(0.6);
      expect(manager.getFeatureDensity(LODLevel.LOW)).toBe(0.3);
    });

    it('should return 1.0 for unconfigured LOD levels', () => {
      const config: LODConfig = {
        distances: [2],
        meshResolutions: [1.0],
        featureDensities: [1.0],
      };
      const manager = new LODManager(config);

      expect(manager.getFeatureDensity(LODLevel.HIGH)).toBe(1.0);
      expect(manager.getFeatureDensity(LODLevel.MEDIUM)).toBe(1.0);
      expect(manager.getFeatureDensity(LODLevel.LOW)).toBe(1.0);
    });
  });

  describe('applyLOD', () => {
    it('should return chunk as-is for HIGH LOD level', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size: 32,
        heightmap: new Float32Array(32 * 32).fill(0.5),
        biomeMap: new Uint8Array(32 * 32),
        biomeWeights: new Float32Array(32 * 32 * 8),
        resources: [
          { x: 5, y: 5, type: ResourceType.IRON, amount: 100 },
          { x: 10, y: 10, type: ResourceType.GOLD, amount: 50 },
        ],
        structures: [
          { x: 15, y: 15, type: StructureType.VILLAGE },
        ],
        rivers: new Set([100, 200]),
      };

      const result = manager.applyLOD(chunk, LODLevel.HIGH);
      expect(result).toBe(chunk); // Should be same reference
    });

    it('should downsample heightmap for MEDIUM LOD level', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size: 32,
        heightmap: new Float32Array(32 * 32).fill(0.5),
        biomeMap: new Uint8Array(32 * 32),
        biomeWeights: new Float32Array(32 * 32 * 8),
        resources: [],
        structures: [],
        rivers: new Set(),
      };

      const result = manager.applyLOD(chunk, LODLevel.MEDIUM);
      
      // Heightmap should be downsampled to 16x16 (0.5 resolution)
      expect(result.heightmap.length).toBe(16 * 16);
      expect(result.heightmap).not.toBe(chunk.heightmap);
    });

    it('should reduce feature count for MEDIUM LOD level', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      // Create chunk with many resources
      const resources = Array.from({ length: 100 }, (_, i) => ({
        x: i % 32,
        y: Math.floor(i / 32),
        type: ResourceType.IRON,
        amount: 100,
      }));

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size: 32,
        heightmap: new Float32Array(32 * 32),
        biomeMap: new Uint8Array(32 * 32),
        biomeWeights: new Float32Array(32 * 32 * 8),
        resources,
        structures: [],
        rivers: new Set(),
      };

      const result = manager.applyLOD(chunk, LODLevel.MEDIUM);
      
      // Should have approximately 50% of resources (density = 0.5)
      expect(result.resources.length).toBeLessThan(resources.length);
      expect(result.resources.length).toBeGreaterThan(0);
    });

    it('should apply both heightmap and feature reduction for LOW LOD', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const resources = Array.from({ length: 100 }, (_, i) => ({
        x: i % 32,
        y: Math.floor(i / 32),
        type: ResourceType.IRON,
        amount: 100,
      }));

      const chunk: ChunkData = {
        x: 5,
        y: 10,
        size: 32,
        heightmap: new Float32Array(32 * 32).fill(0.7),
        biomeMap: new Uint8Array(32 * 32),
        biomeWeights: new Float32Array(32 * 32 * 8),
        resources,
        structures: [],
        rivers: new Set(),
      };

      const result = manager.applyLOD(chunk, LODLevel.LOW);
      
      // Heightmap should be downsampled to 8x8 (0.25 resolution)
      expect(result.heightmap.length).toBe(8 * 8);
      
      // Should have approximately 25% of resources (density = 0.25)
      expect(result.resources.length).toBeLessThan(resources.length * 0.5);
    });

    it('should preserve chunk metadata when applying LOD', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const chunk: ChunkData = {
        x: 7,
        y: 13,
        size: 32,
        heightmap: new Float32Array(32 * 32),
        biomeMap: new Uint8Array(32 * 32),
        biomeWeights: new Float32Array(32 * 32 * 8),
        resources: [],
        structures: [],
        rivers: new Set([1, 2, 3]),
      };

      const result = manager.applyLOD(chunk, LODLevel.MEDIUM);
      
      expect(result.x).toBe(7);
      expect(result.y).toBe(13);
      expect(result.size).toBe(32);
      expect(result.biomeMap).toBe(chunk.biomeMap);
      expect(result.rivers).toBe(chunk.rivers);
    });
  });

  describe('downsampleHeightmap', () => {
    it('should downsample to half resolution correctly', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      // Create a simple 4x4 heightmap
      const heightmap = new Float32Array([
        0.0, 0.0, 1.0, 1.0,
        0.0, 0.0, 1.0, 1.0,
        1.0, 1.0, 0.0, 0.0,
        1.0, 1.0, 0.0, 0.0,
      ]);

      // Access private method via any cast for testing
      const result = (manager as any).downsampleHeightmap(heightmap, 4, 0.5);
      
      expect(result.length).toBe(2 * 2);
      // Corner values should be preserved
      expect(result[0]).toBeCloseTo(0.0, 5);
      expect(result[1]).toBeCloseTo(1.0, 5);
      expect(result[2]).toBeCloseTo(1.0, 5);
      expect(result[3]).toBeCloseTo(0.0, 5);
    });

    it('should handle uniform heightmap', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const heightmap = new Float32Array(16 * 16).fill(0.5);
      const result = (manager as any).downsampleHeightmap(heightmap, 16, 0.5);
      
      expect(result.length).toBe(8 * 8);
      // All values should remain 0.5
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeCloseTo(0.5, 5);
      }
    });

    it('should handle quarter resolution', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const heightmap = new Float32Array(32 * 32).fill(0.8);
      const result = (manager as any).downsampleHeightmap(heightmap, 32, 0.25);
      
      expect(result.length).toBe(8 * 8);
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeCloseTo(0.8, 5);
      }
    });

    it('should use bilinear interpolation for smooth transitions', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      // Create a gradient heightmap
      const heightmap = new Float32Array(4 * 4);
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          heightmap[y * 4 + x] = x / 3; // Gradient from 0 to 1
        }
      }

      const result = (manager as any).downsampleHeightmap(heightmap, 4, 0.5);
      
      expect(result.length).toBe(2 * 2);
      // Should interpolate smoothly
      expect(result[0]).toBeCloseTo(0.0, 5);
      expect(result[1]).toBeCloseTo(1.0, 5);
    });

    it('should handle minimum size of 1', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const heightmap = new Float32Array(4 * 4).fill(0.6);
      // Very low resolution should result in 1x1
      const result = (manager as any).downsampleHeightmap(heightmap, 4, 0.1);
      
      expect(result.length).toBe(1);
      expect(result[0]).toBeCloseTo(0.6, 5);
    });
  });

  describe('filterFeatures', () => {
    it('should return all features when density is 1.0', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const features = [
        { x: 1, y: 1, type: ResourceType.IRON, amount: 100 },
        { x: 2, y: 2, type: ResourceType.GOLD, amount: 50 },
        { x: 3, y: 3, type: ResourceType.COAL, amount: 75 },
      ];

      const result = (manager as any).filterFeatures(features, 1.0, 12345);
      expect(result).toEqual(features);
    });

    it('should return empty array when density is 0', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const features = [
        { x: 1, y: 1, type: ResourceType.IRON, amount: 100 },
        { x: 2, y: 2, type: ResourceType.GOLD, amount: 50 },
      ];

      const result = (manager as any).filterFeatures(features, 0.0, 12345);
      expect(result).toEqual([]);
    });

    it('should return empty array when density is negative', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const features = [
        { x: 1, y: 1, type: ResourceType.IRON, amount: 100 },
      ];

      const result = (manager as any).filterFeatures(features, -0.5, 12345);
      expect(result).toEqual([]);
    });

    it('should filter features deterministically with same seed', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const features = Array.from({ length: 100 }, (_, i) => ({
        x: i,
        y: i,
        type: ResourceType.IRON,
        amount: 100,
      }));

      const result1 = (manager as any).filterFeatures(features, 0.5, 12345);
      const result2 = (manager as any).filterFeatures(features, 0.5, 12345);
      
      expect(result1).toEqual(result2);
    });

    it('should produce different results with different seeds', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const features = Array.from({ length: 100 }, (_, i) => ({
        x: i,
        y: i,
        type: ResourceType.IRON,
        amount: 100,
      }));

      const result1 = (manager as any).filterFeatures(features, 0.5, 12345);
      const result2 = (manager as any).filterFeatures(features, 0.5, 54321);
      
      expect(result1).not.toEqual(result2);
    });

    it('should filter approximately to target density', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const features = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: i,
        type: ResourceType.IRON,
        amount: 100,
      }));

      const result = (manager as any).filterFeatures(features, 0.25, 12345);
      
      // Should be approximately 25% (allow 10% margin due to randomness)
      expect(result.length).toBeGreaterThan(200);
      expect(result.length).toBeLessThan(300);
    });

    it('should handle empty feature array', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const result = (manager as any).filterFeatures([], 0.5, 12345);
      expect(result).toEqual([]);
    });

    it('should handle density greater than 1.0', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const features = [
        { x: 1, y: 1, type: ResourceType.IRON, amount: 100 },
        { x: 2, y: 2, type: ResourceType.GOLD, amount: 50 },
      ];

      const result = (manager as any).filterFeatures(features, 1.5, 12345);
      expect(result).toEqual(features);
    });
  });

  describe('LOD Edge Cases', () => {
    describe('viewer at chunk position', () => {
      it('should return HIGH LOD when viewer is exactly at chunk position', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Viewer at origin, chunk at origin - distance = 0
        expect(manager.getLODLevel(0, 0, 0, 0)).toBe(LODLevel.HIGH);
      });

      it('should return HIGH LOD when viewer is at positive chunk coordinates', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Viewer at (50, 50), chunk at (50, 50) - distance = 0
        expect(manager.getLODLevel(50, 50, 50, 50)).toBe(LODLevel.HIGH);
      });

      it('should return HIGH LOD when viewer is at negative chunk coordinates', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Viewer at (-25, -30), chunk at (-25, -30) - distance = 0
        expect(manager.getLODLevel(-25, -30, -25, -30)).toBe(LODLevel.HIGH);
      });

      it('should apply full resolution when viewer is at chunk position', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const chunk: ChunkData = {
          x: 10,
          y: 10,
          size: 32,
          heightmap: new Float32Array(32 * 32).fill(0.5),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources: [
            { x: 5, y: 5, type: ResourceType.IRON, amount: 100 },
            { x: 10, y: 10, type: ResourceType.GOLD, amount: 50 },
          ],
          structures: [
            { x: 15, y: 15, type: StructureType.VILLAGE },
          ],
          rivers: new Set([100, 200]),
        };

        const level = manager.getLODLevel(10, 10, 10, 10);
        const result = manager.applyLOD(chunk, level);

        // Should return chunk as-is (HIGH LOD)
        expect(result).toBe(chunk);
        expect(result.heightmap.length).toBe(32 * 32);
        expect(result.resources.length).toBe(2);
        expect(result.structures.length).toBe(1);
      });
    });

    describe('very far chunks', () => {
      it('should return LOW LOD for chunks at extreme distances', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Distance = 100 (very far)
        expect(manager.getLODLevel(100, 0, 0, 0)).toBe(LODLevel.LOW);

        // Distance = 141.42 (very far diagonal)
        expect(manager.getLODLevel(100, 100, 0, 0)).toBe(LODLevel.LOW);

        // Distance = 1000 (extremely far)
        expect(manager.getLODLevel(1000, 0, 0, 0)).toBe(LODLevel.LOW);
      });

      it('should return LOW LOD for chunks far in negative direction', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Distance = 100 (far in negative X)
        expect(manager.getLODLevel(-100, 0, 0, 0)).toBe(LODLevel.LOW);

        // Distance = 100 (far in negative Y)
        expect(manager.getLODLevel(0, -100, 0, 0)).toBe(LODLevel.LOW);

        // Distance = 141.42 (far in both negative directions)
        expect(manager.getLODLevel(-100, -100, 0, 0)).toBe(LODLevel.LOW);
      });

      it('should apply minimal resolution for very far chunks', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const resources = Array.from({ length: 100 }, (_, i) => ({
          x: i % 32,
          y: Math.floor(i / 32),
          type: ResourceType.IRON,
          amount: 100,
        }));

        const structures = Array.from({ length: 20 }, (_, i) => ({
          x: i % 32,
          y: Math.floor(i / 32),
          type: StructureType.VILLAGE,
        }));

        const chunk: ChunkData = {
          x: 100,
          y: 100,
          size: 32,
          heightmap: new Float32Array(32 * 32).fill(0.7),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources,
          structures,
          rivers: new Set(),
        };

        const level = manager.getLODLevel(100, 100, 0, 0);
        const result = manager.applyLOD(chunk, level);

        // Should be LOW LOD
        expect(level).toBe(LODLevel.LOW);

        // Heightmap should be downsampled to 8x8 (0.25 resolution)
        expect(result.heightmap.length).toBe(8 * 8);

        // Should have approximately 25% of features
        expect(result.resources.length).toBeLessThan(resources.length * 0.4);
        expect(result.structures.length).toBeLessThan(structures.length * 0.4);
      });

      it('should handle chunks at maximum safe integer distance', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Very large but safe coordinates
        const farX = 1000000;
        const farY = 1000000;

        expect(manager.getLODLevel(farX, farY, 0, 0)).toBe(LODLevel.LOW);
      });
    });

    describe('LOD transitions', () => {
      it('should transition from HIGH to MEDIUM at first threshold', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Just below threshold - should be HIGH
        expect(manager.getLODLevel(1.9, 0, 0, 0)).toBe(LODLevel.HIGH);

        // At threshold - should be MEDIUM
        expect(manager.getLODLevel(2, 0, 0, 0)).toBe(LODLevel.MEDIUM);

        // Just above threshold - should be MEDIUM
        expect(manager.getLODLevel(2.1, 0, 0, 0)).toBe(LODLevel.MEDIUM);
      });

      it('should transition from MEDIUM to LOW at second threshold', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Just below threshold - should be MEDIUM
        expect(manager.getLODLevel(4.9, 0, 0, 0)).toBe(LODLevel.MEDIUM);

        // At threshold - should be LOW
        expect(manager.getLODLevel(5, 0, 0, 0)).toBe(LODLevel.LOW);

        // Just above threshold - should be LOW
        expect(manager.getLODLevel(5.1, 0, 0, 0)).toBe(LODLevel.LOW);
      });

      it('should apply different resolutions across LOD transitions', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const chunk: ChunkData = {
          x: 0,
          y: 0,
          size: 32,
          heightmap: new Float32Array(32 * 32).fill(0.5),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        // HIGH LOD - full resolution
        const highResult = manager.applyLOD(chunk, LODLevel.HIGH);
        expect(highResult.heightmap.length).toBe(32 * 32);

        // MEDIUM LOD - half resolution
        const mediumResult = manager.applyLOD(chunk, LODLevel.MEDIUM);
        expect(mediumResult.heightmap.length).toBe(16 * 16);

        // LOW LOD - quarter resolution
        const lowResult = manager.applyLOD(chunk, LODLevel.LOW);
        expect(lowResult.heightmap.length).toBe(8 * 8);
      });

      it('should apply different feature densities across LOD transitions', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const resources = Array.from({ length: 1000 }, (_, i) => ({
          x: i % 32,
          y: Math.floor(i / 32),
          type: ResourceType.IRON,
          amount: 100,
        }));

        const chunk: ChunkData = {
          x: 0,
          y: 0,
          size: 32,
          heightmap: new Float32Array(32 * 32),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources,
          structures: [],
          rivers: new Set(),
        };

        // HIGH LOD - all features
        const highResult = manager.applyLOD(chunk, LODLevel.HIGH);
        expect(highResult.resources.length).toBe(1000);

        // MEDIUM LOD - approximately 50% features
        const mediumResult = manager.applyLOD(chunk, LODLevel.MEDIUM);
        expect(mediumResult.resources.length).toBeGreaterThan(400);
        expect(mediumResult.resources.length).toBeLessThan(600);

        // LOW LOD - approximately 25% features
        const lowResult = manager.applyLOD(chunk, LODLevel.LOW);
        expect(lowResult.resources.length).toBeGreaterThan(150);
        expect(lowResult.resources.length).toBeLessThan(350);
      });

      it('should handle transitions with custom distance thresholds', () => {
        const config: LODConfig = {
          distances: [3, 10, 20],
          meshResolutions: [1.0, 0.75, 0.5, 0.25],
          featureDensities: [1.0, 0.75, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Distance 2 - should be level 0 (HIGH)
        expect(manager.getLODLevel(2, 0, 0, 0)).toBe(0);

        // Distance 5 - should be level 1
        expect(manager.getLODLevel(5, 0, 0, 0)).toBe(1);

        // Distance 15 - should be level 2
        expect(manager.getLODLevel(15, 0, 0, 0)).toBe(2);

        // Distance 25 - should be level 3
        expect(manager.getLODLevel(25, 0, 0, 0)).toBe(3);
      });

      it('should maintain consistent LOD for chunks at same distance', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // All chunks at distance 3 should have same LOD
        const level1 = manager.getLODLevel(3, 0, 0, 0);
        const level2 = manager.getLODLevel(0, 3, 0, 0);
        const level3 = manager.getLODLevel(-3, 0, 0, 0);
        const level4 = manager.getLODLevel(0, -3, 0, 0);

        expect(level1).toBe(LODLevel.MEDIUM);
        expect(level2).toBe(LODLevel.MEDIUM);
        expect(level3).toBe(LODLevel.MEDIUM);
        expect(level4).toBe(LODLevel.MEDIUM);
      });

      it('should handle diagonal transitions correctly', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Distance = sqrt(2) ≈ 1.41 - should be HIGH
        expect(manager.getLODLevel(1, 1, 0, 0)).toBe(LODLevel.HIGH);

        // Distance = sqrt(8) ≈ 2.83 - should be MEDIUM
        expect(manager.getLODLevel(2, 2, 0, 0)).toBe(LODLevel.MEDIUM);

        // Distance = sqrt(32) ≈ 5.66 - should be LOW
        expect(manager.getLODLevel(4, 4, 0, 0)).toBe(LODLevel.LOW);
      });

      it('should handle viewer movement across LOD boundaries', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const chunkX = 10;
        const chunkY = 10;

        // Viewer close to chunk - HIGH LOD
        expect(manager.getLODLevel(chunkX, chunkY, 10, 10)).toBe(LODLevel.HIGH);

        // Viewer moves away - MEDIUM LOD
        expect(manager.getLODLevel(chunkX, chunkY, 7, 10)).toBe(LODLevel.MEDIUM);

        // Viewer moves further - LOW LOD
        expect(manager.getLODLevel(chunkX, chunkY, 4, 10)).toBe(LODLevel.LOW);
      });
    });
  });
});
