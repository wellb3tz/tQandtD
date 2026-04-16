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
        heightmap: new Float32Array((32 + 1) * (32 + 1)).fill(0.5),
        biomeMap: new Uint8Array(32 * 32),
        biomeWeights: new Float32Array(32 * 32 * 8),
        resources: [],
        structures: [],
        rivers: new Set(),
      };

      const result = manager.applyLOD(chunk, LODLevel.MEDIUM);
      
      // Heightmap should be downsampled to (16 + 1) x (16 + 1) for seamless boundaries
      expect(result.heightmap.length).toBe((16 + 1) * (16 + 1));
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
        heightmap: new Float32Array((32 + 1) * (32 + 1)).fill(0.7),
        biomeMap: new Uint8Array(32 * 32),
        biomeWeights: new Float32Array(32 * 32 * 8),
        resources,
        structures: [],
        rivers: new Set(),
      };

      const result = manager.applyLOD(chunk, LODLevel.LOW);
      
      // Heightmap should be downsampled to (8 + 1) x (8 + 1) for seamless boundaries
      expect(result.heightmap.length).toBe((8 + 1) * (8 + 1));
      
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
      // Size should be updated after LOD downsampling (resolution = 0.5, so 32 * 0.5 = 16)
      expect(result.size).toBe(16);
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

      // Create a simple 4x4 heightmap with (4 + 1) x (4 + 1) = 5x5 vertices
      const heightmap = new Float32Array([
        0.0, 0.0, 0.5, 1.0, 1.0,
        0.0, 0.0, 0.5, 1.0, 1.0,
        0.5, 0.5, 0.5, 0.5, 0.5,
        1.0, 1.0, 0.5, 0.0, 0.0,
        1.0, 1.0, 0.5, 0.0, 0.0,
      ]);

      // Access private method via any cast for testing
      const result = (manager as any).downsampleHeightmap(heightmap, 4, 0.5);
      
      // newSize = 2, so result should be (2 + 1) x (2 + 1) = 3x3
      expect(result.length).toBe((2 + 1) * (2 + 1));
      // Corner values should be preserved
      expect(result[0]).toBeCloseTo(0.0, 5);
      expect(result[2]).toBeCloseTo(1.0, 5);
      expect(result[6]).toBeCloseTo(1.0, 5);
      expect(result[8]).toBeCloseTo(0.0, 5);
    });

    it('should handle uniform heightmap', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const heightmap = new Float32Array((16 + 1) * (16 + 1)).fill(0.5);
      const result = (manager as any).downsampleHeightmap(heightmap, 16, 0.5);
      
      // newSize = 8, so result should be (8 + 1) x (8 + 1) = 9x9
      expect(result.length).toBe((8 + 1) * (8 + 1));
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

      const heightmap = new Float32Array((32 + 1) * (32 + 1)).fill(0.8);
      const result = (manager as any).downsampleHeightmap(heightmap, 32, 0.25);
      
      // newSize = 8, so result should be (8 + 1) x (8 + 1) = 9x9
      expect(result.length).toBe((8 + 1) * (8 + 1));
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

      // Create a gradient heightmap (4 + 1) x (4 + 1) = 5x5
      const heightmap = new Float32Array((4 + 1) * (4 + 1));
      for (let y = 0; y <= 4; y++) {
        for (let x = 0; x <= 4; x++) {
          heightmap[y * 5 + x] = x / 4; // Gradient from 0 to 1
        }
      }

      const result = (manager as any).downsampleHeightmap(heightmap, 4, 0.5);
      
      // newSize = 2, so result should be (2 + 1) x (2 + 1) = 3x3
      expect(result.length).toBe((2 + 1) * (2 + 1));
      // Should interpolate smoothly
      expect(result[0]).toBeCloseTo(0.0, 5);
      expect(result[2]).toBeCloseTo(1.0, 5);
    });

    it('should handle minimum size of 1', () => {
      const config: LODConfig = {
        distances: [2, 5],
        meshResolutions: [1.0, 0.5, 0.25],
        featureDensities: [1.0, 0.5, 0.25],
      };
      const manager = new LODManager(config);

      const heightmap = new Float32Array((4 + 1) * (4 + 1)).fill(0.6);
      // Very low resolution should result in 1x1 chunk with 2x2 heightmap
      const result = (manager as any).downsampleHeightmap(heightmap, 4, 0.1);
      
      expect(result.length).toBe(4); // 2x2 for 1x1 chunk
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
          heightmap: new Float32Array((32 + 1) * (32 + 1)).fill(0.7),
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

        // Heightmap should be downsampled to (8 + 1) x (8 + 1) for seamless boundaries
        expect(result.heightmap.length).toBe((8 + 1) * (8 + 1));

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
          heightmap: new Float32Array((32 + 1) * (32 + 1)).fill(0.5),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        // HIGH LOD - full resolution
        const highResult = manager.applyLOD(chunk, LODLevel.HIGH);
        expect(highResult.heightmap.length).toBe((32 + 1) * (32 + 1));

        // MEDIUM LOD - half resolution with seamless boundaries
        const mediumResult = manager.applyLOD(chunk, LODLevel.MEDIUM);
        expect(mediumResult.heightmap.length).toBe((16 + 1) * (16 + 1));

        // LOW LOD - quarter resolution with seamless boundaries
        const lowResult = manager.applyLOD(chunk, LODLevel.LOW);
        expect(lowResult.heightmap.length).toBe((8 + 1) * (8 + 1));
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

  describe('LOD Fixes - Task 7', () => {
    describe('applyLOD updates data.size correctly', () => {
      it('should update size to 16 for MEDIUM LOD (0.5 resolution) on 32-size chunk', () => {
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
          heightmap: new Float32Array((32 + 1) * (32 + 1)),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.MEDIUM);
        
        // Verify size is updated to 16 (32 * 0.5)
        expect(result.size).toBe(16);
      });

      it('should update size to 8 for LOW LOD (0.25 resolution) on 32-size chunk', () => {
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
          heightmap: new Float32Array((32 + 1) * (32 + 1)),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.LOW);
        
        // Verify size is updated to 8 (32 * 0.25)
        expect(result.size).toBe(8);
      });

      it('should update size correctly for various chunk sizes at MEDIUM LOD', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const testCases = [
          { originalSize: 8, expectedSize: 4 },
          { originalSize: 16, expectedSize: 8 },
          { originalSize: 32, expectedSize: 16 },
          { originalSize: 64, expectedSize: 32 },
        ];

        for (const { originalSize, expectedSize } of testCases) {
          const chunk: ChunkData = {
            x: 0,
            y: 0,
            size: originalSize,
            heightmap: new Float32Array((originalSize + 1) * (originalSize + 1)),
            biomeMap: new Uint8Array(originalSize * originalSize),
            biomeWeights: new Float32Array(originalSize * originalSize * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };

          const result = manager.applyLOD(chunk, LODLevel.MEDIUM);
          expect(result.size).toBe(expectedSize);
        }
      });

      it('should update size correctly for various chunk sizes at LOW LOD', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const testCases = [
          { originalSize: 8, expectedSize: 2 },
          { originalSize: 16, expectedSize: 4 },
          { originalSize: 32, expectedSize: 8 },
          { originalSize: 64, expectedSize: 16 },
        ];

        for (const { originalSize, expectedSize } of testCases) {
          const chunk: ChunkData = {
            x: 0,
            y: 0,
            size: originalSize,
            heightmap: new Float32Array((originalSize + 1) * (originalSize + 1)),
            biomeMap: new Uint8Array(originalSize * originalSize),
            biomeWeights: new Float32Array(originalSize * originalSize * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };

          const result = manager.applyLOD(chunk, LODLevel.LOW);
          expect(result.size).toBe(expectedSize);
        }
      });

      it('should not change size for HIGH LOD', () => {
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
          heightmap: new Float32Array((32 + 1) * (32 + 1)),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.HIGH);
        
        // HIGH LOD should return same chunk reference
        expect(result).toBe(chunk);
        expect(result.size).toBe(32);
      });
    });

    describe('downsampled heightmap has correct size for seamless boundaries', () => {
      it('should produce (newSize + 1) x (newSize + 1) heightmap for MEDIUM LOD', () => {
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
          heightmap: new Float32Array((32 + 1) * (32 + 1)).fill(0.5),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.MEDIUM);
        
        // newSize = 16, so heightmap should be (16 + 1) x (16 + 1) = 17 x 17 = 289
        const expectedHeightmapSize = (16 + 1) * (16 + 1);
        expect(result.heightmap.length).toBe(expectedHeightmapSize);
      });

      it('should produce (newSize + 1) x (newSize + 1) heightmap for LOW LOD', () => {
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
          heightmap: new Float32Array((32 + 1) * (32 + 1)).fill(0.5),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.LOW);
        
        // newSize = 8, so heightmap should be (8 + 1) x (8 + 1) = 9 x 9 = 81
        const expectedHeightmapSize = (8 + 1) * (8 + 1);
        expect(result.heightmap.length).toBe(expectedHeightmapSize);
      });

      it('should produce correct heightmap size for various chunk sizes', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const testCases = [
          { size: 8, lodLevel: LODLevel.MEDIUM, expectedNewSize: 4 },
          { size: 16, lodLevel: LODLevel.MEDIUM, expectedNewSize: 8 },
          { size: 32, lodLevel: LODLevel.MEDIUM, expectedNewSize: 16 },
          { size: 64, lodLevel: LODLevel.MEDIUM, expectedNewSize: 32 },
          { size: 8, lodLevel: LODLevel.LOW, expectedNewSize: 2 },
          { size: 16, lodLevel: LODLevel.LOW, expectedNewSize: 4 },
          { size: 32, lodLevel: LODLevel.LOW, expectedNewSize: 8 },
          { size: 64, lodLevel: LODLevel.LOW, expectedNewSize: 16 },
        ];

        for (const { size, lodLevel, expectedNewSize } of testCases) {
          const chunk: ChunkData = {
            x: 0,
            y: 0,
            size,
            heightmap: new Float32Array((size + 1) * (size + 1)),
            biomeMap: new Uint8Array(size * size),
            biomeWeights: new Float32Array(size * size * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };

          const result = manager.applyLOD(chunk, lodLevel);
          const expectedHeightmapSize = (expectedNewSize + 1) * (expectedNewSize + 1);
          
          expect(result.heightmap.length).toBe(expectedHeightmapSize);
        }
      });
    });

    describe('bilinear interpolation produces valid values', () => {
      it('should preserve corner values during downsampling', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Create 8x8 chunk with distinct corner values
        const size = 8;
        const heightmap = new Float32Array((size + 1) * (size + 1));
        
        // Set corner values
        heightmap[0] = 0.0; // Top-left
        heightmap[size] = 1.0; // Top-right
        heightmap[size * (size + 1)] = 2.0; // Bottom-left
        heightmap[size * (size + 1) + size] = 3.0; // Bottom-right

        const chunk: ChunkData = {
          x: 0,
          y: 0,
          size,
          heightmap,
          biomeMap: new Uint8Array(size * size),
          biomeWeights: new Float32Array(size * size * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.MEDIUM);
        
        // newSize = 4, heightmap is 5x5
        const newSize = 4;
        
        // Check corner values are preserved
        expect(result.heightmap[0]).toBeCloseTo(0.0, 5); // Top-left
        expect(result.heightmap[newSize]).toBeCloseTo(1.0, 5); // Top-right
        expect(result.heightmap[newSize * (newSize + 1)]).toBeCloseTo(2.0, 5); // Bottom-left
        expect(result.heightmap[newSize * (newSize + 1) + newSize]).toBeCloseTo(3.0, 5); // Bottom-right
      });

      it('should produce interpolated values between samples', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        // Create 4x4 chunk with gradient
        const size = 4;
        const heightmap = new Float32Array((size + 1) * (size + 1));
        
        // Fill with horizontal gradient (0.0 to 1.0)
        for (let y = 0; y <= size; y++) {
          for (let x = 0; x <= size; x++) {
            heightmap[y * (size + 1) + x] = x / size;
          }
        }

        const chunk: ChunkData = {
          x: 0,
          y: 0,
          size,
          heightmap,
          biomeMap: new Uint8Array(size * size),
          biomeWeights: new Float32Array(size * size * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.MEDIUM);
        
        // newSize = 2, heightmap is 3x3
        // Check that gradient is preserved
        expect(result.heightmap[0]).toBeCloseTo(0.0, 5); // Left edge
        expect(result.heightmap[1]).toBeCloseTo(0.5, 5); // Middle
        expect(result.heightmap[2]).toBeCloseTo(1.0, 5); // Right edge
      });

      it('should produce values within range of original heightmap', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const size = 16;
        const heightmap = new Float32Array((size + 1) * (size + 1));
        
        // Fill with random values between 0.2 and 0.8
        for (let i = 0; i < heightmap.length; i++) {
          heightmap[i] = 0.2 + Math.random() * 0.6;
        }

        const chunk: ChunkData = {
          x: 0,
          y: 0,
          size,
          heightmap,
          biomeMap: new Uint8Array(size * size),
          biomeWeights: new Float32Array(size * size * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.MEDIUM);
        
        // All interpolated values should be within original range
        for (let i = 0; i < result.heightmap.length; i++) {
          expect(result.heightmap[i]).toBeGreaterThanOrEqual(0.2);
          expect(result.heightmap[i]).toBeLessThanOrEqual(0.8);
        }
      });

      it('should handle uniform heightmap correctly', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const size = 32;
        const uniformValue = 0.75;
        const heightmap = new Float32Array((size + 1) * (size + 1)).fill(uniformValue);

        const chunk: ChunkData = {
          x: 0,
          y: 0,
          size,
          heightmap,
          biomeMap: new Uint8Array(size * size),
          biomeWeights: new Float32Array(size * size * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.LOW);
        
        // All values should remain uniform
        for (let i = 0; i < result.heightmap.length; i++) {
          expect(result.heightmap[i]).toBeCloseTo(uniformValue, 5);
        }
      });
    });

    describe('special case: 1x1 chunk has 2x2 heightmap', () => {
      it('should produce 2x2 heightmap for 1x1 chunk at extreme LOD', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.03125], // 0.03125 = 1/32, will produce 1x1 from 32x32
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const size = 32;
        const heightmap = new Float32Array((size + 1) * (size + 1)).fill(0.6);

        const chunk: ChunkData = {
          x: 0,
          y: 0,
          size,
          heightmap,
          biomeMap: new Uint8Array(size * size),
          biomeWeights: new Float32Array(size * size * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.LOW);
        
        // Should produce 1x1 chunk with 2x2 heightmap
        expect(result.size).toBe(1);
        expect(result.heightmap.length).toBe(4); // 2x2
      });

      it('should fill all 4 vertices of 2x2 heightmap with center value', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.125], // Will produce 1x1 from 8x8
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const size = 8;
        const heightmap = new Float32Array((size + 1) * (size + 1));
        
        // Fill with gradient, center should be around 0.5
        for (let y = 0; y <= size; y++) {
          for (let x = 0; x <= size; x++) {
            heightmap[y * (size + 1) + x] = (x + y) / (2 * size);
          }
        }

        const chunk: ChunkData = {
          x: 0,
          y: 0,
          size,
          heightmap,
          biomeMap: new Uint8Array(size * size),
          biomeWeights: new Float32Array(size * size * 8),
          resources: [],
          structures: [],
          rivers: new Set(),
        };

        const result = manager.applyLOD(chunk, LODLevel.LOW);
        
        expect(result.size).toBe(1);
        expect(result.heightmap.length).toBe(4);
        
        // All 4 vertices should have the same value (center value)
        const centerValue = result.heightmap[0];
        expect(result.heightmap[1]).toBeCloseTo(centerValue, 5);
        expect(result.heightmap[2]).toBeCloseTo(centerValue, 5);
        expect(result.heightmap[3]).toBeCloseTo(centerValue, 5);
      });

      it('should handle 1x1 chunk from various original sizes', () => {
        const config: LODConfig = {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.0625], // Will produce 1x1 from 16x16
          featureDensities: [1.0, 0.5, 0.25],
        };
        const manager = new LODManager(config);

        const testSizes = [16, 32, 64];

        for (const size of testSizes) {
          const heightmap = new Float32Array((size + 1) * (size + 1)).fill(0.7);

          const chunk: ChunkData = {
            x: 0,
            y: 0,
            size,
            heightmap,
            biomeMap: new Uint8Array(size * size),
            biomeWeights: new Float32Array(size * size * 8),
            resources: [],
            structures: [],
            rivers: new Set(),
          };

          // Adjust resolution to produce 1x1
          const resolution = 1 / size;
          const customConfig: LODConfig = {
            distances: [2, 5],
            meshResolutions: [1.0, 0.5, resolution],
            featureDensities: [1.0, 0.5, 0.25],
          };
          const customManager = new LODManager(customConfig);

          const result = customManager.applyLOD(chunk, LODLevel.LOW);
          
          expect(result.size).toBe(1);
          expect(result.heightmap.length).toBe(4);
        }
      });
    });
  });
});

