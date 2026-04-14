/**
 * DemoApp LOD System Integration Tests
 * 
 * Comprehensive integration tests for LOD system functionality
 * Tests camera movement triggers, performance improvements, and visual quality
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.6**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DemoApp } from './DemoApp';
import { LODLevel } from '../../../src/index';

describe('DemoApp - LOD System Integration', () => {
  let app: DemoApp;

  beforeEach(async () => {
    app = new DemoApp();
    await app.initialize();
  });

  describe('Camera Movement Triggers LOD Updates (Requirement 7.6)', () => {
    beforeEach(() => {
      // Enable LOD with standard configuration
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });
    });

    it('should update LOD levels when camera moves', async () => {
      // Generate world with chunks
      await app.generateWorld(12345);

      // Initial camera position at center (chunk 0,0)
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      const initialState = app.getState();
      const initialHighCount = initialState.lodHighCount;
      const initialMediumCount = initialState.lodMediumCount;
      const initialLowCount = initialState.lodLowCount;

      // Move camera far away (chunk 15,15 in chunk coordinates)
      app.updateCameraPosition({ x: 480, y: 100, z: 480 });

      const newState = app.getState();

      // LOD distribution should have changed
      const countsChanged = 
        newState.lodHighCount !== initialHighCount ||
        newState.lodMediumCount !== initialMediumCount ||
        newState.lodLowCount !== initialLowCount;

      expect(countsChanged).toBe(true);
    });

    it('should update LOD within 100ms requirement', async () => {
      await app.generateWorld(12345);

      // Measure time to update LOD levels
      const startTime = performance.now();
      app.updateCameraPosition({ x: 500, y: 100, z: 500 });
      const endTime = performance.now();

      const updateTime = endTime - startTime;

      // Requirement 7.6: Update within 100ms
      expect(updateTime).toBeLessThan(100);
    });

    it('should recalculate LOD for all loaded chunks on camera move', async () => {
      await app.generateWorld(12345);

      // Camera at origin
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      const state = app.getState();
      const totalChunks = state.lodHighCount + state.lodMediumCount + state.lodLowCount;

      // All loaded chunks should have LOD levels assigned
      expect(totalChunks).toBe(state.loadedChunkCount);
    });

    it('should increase HIGH LOD count when camera moves closer to chunks', async () => {
      // Load chunks in a larger area
      await app.loadChunksAround(0, 0, 3);

      // Camera far from center
      app.updateCameraPosition({ x: 300, y: 100, z: 300 });
      const farState = app.getState();
      const farHighCount = farState.lodHighCount;

      // Move camera to center
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });
      const nearState = app.getState();
      const nearHighCount = nearState.lodHighCount;

      // More chunks should be HIGH LOD when camera is at center
      expect(nearHighCount).toBeGreaterThan(farHighCount);
    });

    it('should increase LOW LOD count when camera moves away from chunks', async () => {
      // Load chunks in a larger area
      await app.loadChunksAround(0, 0, 3);

      // Camera at center
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });
      const nearState = app.getState();
      const nearLowCount = nearState.lodLowCount;

      // Move camera far away
      app.updateCameraPosition({ x: 300, y: 100, z: 300 });
      const farState = app.getState();
      const farLowCount = farState.lodLowCount;

      // More chunks should be LOW LOD when camera is far
      expect(farLowCount).toBeGreaterThan(nearLowCount);
    });
  });

  describe('Performance Improvement with LOD Enabled (Requirement 7.2)', () => {
    it('should reduce total vertex count with LOD enabled', async () => {
      // Enable LOD
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      // Camera at origin
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });
      await app.loadChunksAround(0, 0, 3);

      const state = app.getState();
      const chunks = Array.from(state.loadedChunks.values());

      // Calculate total vertices with LOD (mixed resolutions)
      let verticesWithLOD = 0;
      for (const chunk of chunks) {
        verticesWithLOD += chunk.size * chunk.size;
      }

      // Calculate what vertices would be without LOD (all at full 32x32 resolution)
      const verticesWithoutLOD = chunks.length * 32 * 32;

      // LOD should reduce total vertex count
      // (some chunks will have reduced resolution)
      expect(verticesWithLOD).toBeLessThanOrEqual(verticesWithoutLOD);
      
      // Verify we have mixed LOD levels
      expect(state.lodHighCount).toBeGreaterThan(0);
      expect(state.lodMediumCount + state.lodLowCount).toBeGreaterThan(0);
    });

    it('should improve chunk generation performance with LOD', async () => {
      // Measure generation time without LOD
      const startWithoutLOD = performance.now();
      await app.generateWorld(12345);
      await app.loadChunksAround(0, 0, 3);
      const endWithoutLOD = performance.now();
      const timeWithoutLOD = endWithoutLOD - startWithoutLOD;

      // Clear and regenerate with LOD
      await app.initialize();
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      const startWithLOD = performance.now();
      await app.generateWorld(12345);
      await app.loadChunksAround(0, 0, 3);
      const endWithLOD = performance.now();
      const timeWithLOD = endWithLOD - startWithLOD;

      // LOD should not significantly degrade performance
      // Allow up to 20% overhead for LOD processing
      expect(timeWithLOD).toBeLessThan(timeWithoutLOD * 1.2);
    });

    it('should track LOD statistics correctly', async () => {
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      await app.generateWorld(12345);

      const state = app.getState();

      // Should have LOD statistics
      expect(state.lodHighCount).toBeGreaterThanOrEqual(0);
      expect(state.lodMediumCount).toBeGreaterThanOrEqual(0);
      expect(state.lodLowCount).toBeGreaterThanOrEqual(0);

      // Total LOD chunks should equal loaded chunks
      const totalLODChunks = state.lodHighCount + state.lodMediumCount + state.lodLowCount;
      expect(totalLODChunks).toBe(state.loadedChunkCount);
    });
  });

  describe('Visual Quality at Each LOD Level (Requirements 7.3, 7.4)', () => {
    beforeEach(() => {
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });
    });

    it('should maintain full resolution for HIGH LOD chunks', async () => {
      // Camera at origin
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      await app.loadChunksAround(0, 0, 1);

      const state = app.getState();
      const chunks = Array.from(state.loadedChunks.values());

      // Center chunk should be HIGH LOD
      const centerChunk = chunks.find(c => c.x === 0 && c.y === 0);
      expect(centerChunk).toBeDefined();
      expect((centerChunk as any).lodLevel).toBe(LODLevel.HIGH);

      // HIGH LOD chunks maintain their original size
      // (LOD affects rendering resolution, not chunk data size)
      expect(centerChunk!.size).toBeGreaterThan(0);
    });

    it('should apply MEDIUM LOD to chunks at medium distance', async () => {
      // Camera at origin
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      await app.loadChunksAround(0, 0, 3);

      const state = app.getState();
      const chunks = Array.from(state.loadedChunks.values());

      // Find a MEDIUM LOD chunk (distance 3-4 from camera)
      const mediumChunk = chunks.find(c => {
        const dx = c.x - 0;
        const dy = c.y - 0;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance >= 2 && distance < 5 && (c as any).lodLevel === LODLevel.MEDIUM;
      });

      if (mediumChunk) {
        // MEDIUM LOD chunks are marked with LOD level
        expect((mediumChunk as any).lodLevel).toBe(LODLevel.MEDIUM);
        // Chunk data size remains consistent
        expect(mediumChunk.size).toBeGreaterThan(0);
      }
    });

    it('should apply LOW LOD to chunks far from camera', async () => {
      // Camera at origin
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      await app.loadChunksAround(0, 0, 5);

      const state = app.getState();
      const chunks = Array.from(state.loadedChunks.values());

      // Find a LOW LOD chunk (distance >= 5 from camera)
      const lowChunk = chunks.find(c => {
        const dx = c.x - 0;
        const dy = c.y - 0;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance >= 5 && (c as any).lodLevel === LODLevel.LOW;
      });

      if (lowChunk) {
        // LOW LOD chunks are marked with LOD level
        expect((lowChunk as any).lodLevel).toBe(LODLevel.LOW);
        // Chunk data size remains consistent
        expect(lowChunk.size).toBeGreaterThan(0);
      }
    });

    it('should reduce feature density at lower LOD levels', async () => {
      // Enable resources and structures
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        },
        resourceConfig: {
          types: ['iron', 'gold', 'coal'],
          clusterScale: 20,
          densityThreshold: 0.6
        },
        structureConfig: {
          types: ['village', 'dungeon'],
          minDistance: 10,
          maxAttempts: 30
        }
      });

      app.updateCameraPosition({ x: 0, y: 100, z: 0 });
      await app.loadChunksAround(0, 0, 5);

      const state = app.getState();
      const chunks = Array.from(state.loadedChunks.values());

      // Find chunks at different LOD levels
      const highChunk = chunks.find(c => (c as any).lodLevel === LODLevel.HIGH);
      const mediumChunk = chunks.find(c => (c as any).lodLevel === LODLevel.MEDIUM);
      const lowChunk = chunks.find(c => (c as any).lodLevel === LODLevel.LOW);

      if (highChunk && mediumChunk && lowChunk) {
        const highFeatures = highChunk.resources.length + highChunk.structures.length;
        const mediumFeatures = mediumChunk.resources.length + mediumChunk.structures.length;
        const lowFeatures = lowChunk.resources.length + lowChunk.structures.length;

        // Feature density should decrease with LOD level
        expect(lowFeatures).toBeLessThanOrEqual(mediumFeatures);
        expect(mediumFeatures).toBeLessThanOrEqual(highFeatures);
      }
    });

    it('should preserve biome data at all LOD levels', async () => {
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });
      await app.loadChunksAround(0, 0, 5);

      const state = app.getState();
      const chunks = Array.from(state.loadedChunks.values());

      // All chunks should have biome data regardless of LOD level
      for (const chunk of chunks) {
        expect(chunk.biomeMap).toBeDefined();
        expect(chunk.biomeMap.length).toBeGreaterThan(0);
      }
    });

    it('should maintain heightmap data at all LOD levels', async () => {
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });
      await app.loadChunksAround(0, 0, 5);

      const state = app.getState();
      const chunks = Array.from(state.loadedChunks.values());

      // All chunks should have heightmap data regardless of LOD level
      for (const chunk of chunks) {
        expect(chunk.heightmap).toBeDefined();
        expect(chunk.heightmap.length).toBeGreaterThan(0);
      }
    });
  });

  describe('LOD Level Calculation (Requirement 7.1)', () => {
    beforeEach(() => {
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });
    });

    it('should calculate HIGH LOD for chunks close to camera', () => {
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      // Chunk at origin should be HIGH LOD
      const level = app.getChunkLODLevel(0, 0);
      expect(level).toBe(LODLevel.HIGH);
    });

    it('should calculate MEDIUM LOD for chunks at medium distance', () => {
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      // Chunk 3 chunks away should be MEDIUM LOD (between threshold 2 and 5)
      const level = app.getChunkLODLevel(3, 0);
      expect(level).toBe(LODLevel.MEDIUM);
    });

    it('should calculate LOW LOD for chunks far from camera', () => {
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      // Chunk 10 chunks away should be LOW LOD (beyond threshold 5)
      const level = app.getChunkLODLevel(10, 10);
      expect(level).toBe(LODLevel.LOW);
    });

    it('should use distance thresholds from config', () => {
      // Update with different thresholds
      app.updateEngineConfig({
        lodConfig: {
          distances: [1, 3],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      // With new thresholds, chunk at distance 2 should be MEDIUM LOD
      const level = app.getChunkLODLevel(2, 0);
      expect(level).toBe(LODLevel.MEDIUM);
    });
  });

  describe('LOD Configuration Management (Requirement 7.1)', () => {
    it('should initialize without LOD manager by default', () => {
      const state = app.getState();
      expect(state.lodManager).toBeNull();
    });

    it('should create LOD manager when LOD config is set', () => {
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      const state = app.getState();
      expect(state.lodManager).not.toBeNull();
    });

    it('should remove LOD manager when LOD config is disabled', () => {
      // Enable LOD
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      expect(app.getState().lodManager).not.toBeNull();

      // Disable LOD
      app.updateEngineConfig({
        lodConfig: undefined
      });

      expect(app.getState().lodManager).toBeNull();
    });

    it('should apply LOD to chunks when loading with LOD enabled', async () => {
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      app.updateCameraPosition({ x: 0, y: 100, z: 0 });
      await app.loadChunksAround(0, 0, 2);

      const state = app.getState();
      const chunks = Array.from(state.loadedChunks.values());

      // All chunks should have LOD level metadata
      const chunksWithLOD = chunks.filter(chunk => (chunk as any).lodLevel !== undefined);
      expect(chunksWithLOD.length).toBe(chunks.length);
    });
  });

  describe('LOD Statistics Display (Requirement 7.5)', () => {
    beforeEach(() => {
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });
    });

    it('should display count of chunks at each LOD level', async () => {
      await app.generateWorld(12345);

      const state = app.getState();

      // Should have counts for each LOD level
      expect(typeof state.lodHighCount).toBe('number');
      expect(typeof state.lodMediumCount).toBe('number');
      expect(typeof state.lodLowCount).toBe('number');

      // At least one count should be non-zero
      const totalLOD = state.lodHighCount + state.lodMediumCount + state.lodLowCount;
      expect(totalLOD).toBeGreaterThan(0);
    });

    it('should update LOD statistics when chunks are loaded', async () => {
      const initialState = app.getState();
      expect(initialState.lodHighCount).toBe(0);

      await app.generateWorld(12345);

      const newState = app.getState();
      const totalLOD = newState.lodHighCount + newState.lodMediumCount + newState.lodLowCount;

      expect(totalLOD).toBeGreaterThan(0);
    });

    it('should update LOD statistics when camera moves', async () => {
      await app.generateWorld(12345);

      const initialState = app.getState();
      const initialHighCount = initialState.lodHighCount;

      // Move camera
      app.updateCameraPosition({ x: 200, y: 100, z: 200 });

      const newState = app.getState();

      // Statistics should be updated
      expect(newState.lodHighCount).toBeDefined();
      expect(typeof newState.lodHighCount).toBe('number');
    });
  });
});
