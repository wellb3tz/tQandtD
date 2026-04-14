/**
 * DemoApp LOD Integration Tests
 * 
 * Tests for LOD system integration in the demo application
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DemoApp } from './DemoApp';
import { LODLevel } from '../../../src/index';

describe('DemoApp - LOD Integration', () => {
  let app: DemoApp;

  beforeEach(async () => {
    app = new DemoApp();
    await app.initialize();
  });

  describe('LOD Configuration', () => {
    it('should initialize without LOD manager by default', () => {
      const state = app.getState();
      expect(state.lodManager).toBeNull();
      expect(state.lodHighCount).toBe(0);
      expect(state.lodMediumCount).toBe(0);
      expect(state.lodLowCount).toBe(0);
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
      expect(state.config.lodConfig).toBeDefined();
      expect(state.config.lodConfig?.distances).toEqual([2, 5]);
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
  });

  describe('LOD Level Calculation', () => {
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

    it('should calculate HIGH LOD for chunks close to camera', () => {
      // Camera at origin (chunk 0,0)
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      // Chunk at origin should be HIGH LOD
      const level = app.getChunkLODLevel(0, 0);
      expect(level).toBe(LODLevel.HIGH);
    });

    it('should calculate MEDIUM LOD for chunks at medium distance', () => {
      // Camera at origin
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      // Chunk 3 chunks away (distance = 3) should be MEDIUM LOD
      // (between threshold 2 and 5)
      const level = app.getChunkLODLevel(3, 0);
      expect(level).toBe(LODLevel.MEDIUM);
    });

    it('should calculate LOW LOD for chunks far from camera', () => {
      // Camera at origin
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      // Chunk 10 chunks away should be LOW LOD (beyond threshold 5)
      const level = app.getChunkLODLevel(10, 10);
      expect(level).toBe(LODLevel.LOW);
    });

    it('should update LOD levels when camera moves', async () => {
      // Generate some chunks
      await app.generateWorld(12345);

      const initialState = app.getState();
      const initialHighCount = initialState.lodHighCount;

      // Move camera far away
      app.updateCameraPosition({ x: 500, y: 100, z: 500 });

      const newState = app.getState();
      
      // LOD distribution should have changed
      // (exact values depend on chunk layout, but counts should be different)
      const countsChanged = 
        newState.lodHighCount !== initialHighCount ||
        newState.lodMediumCount !== initialState.lodMediumCount ||
        newState.lodLowCount !== initialState.lodLowCount;

      expect(countsChanged).toBe(true);
    });
  });

  describe('LOD Statistics', () => {
    beforeEach(() => {
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });
    });

    it('should track LOD statistics when chunks are loaded', async () => {
      await app.generateWorld(12345);

      const state = app.getState();
      const totalChunks = state.lodHighCount + state.lodMediumCount + state.lodLowCount;

      // Should have loaded 9 chunks (3x3 grid)
      expect(totalChunks).toBe(9);

      // Most chunks should be HIGH LOD since camera is at center
      expect(state.lodHighCount).toBeGreaterThan(0);
    });

    it('should update LOD statistics when camera position changes', async () => {
      await app.generateWorld(12345);

      // Initial position - camera at center
      const initialState = app.getState();
      const initialHighCount = initialState.lodHighCount;

      // Move camera to corner
      app.updateCameraPosition({ x: 100, y: 100, z: 100 });

      const newState = app.getState();

      // LOD distribution should change
      expect(newState.lodHighCount).not.toBe(initialHighCount);
    });
  });

  describe('LOD with Chunk Loading', () => {
    beforeEach(() => {
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });
    });

    it('should apply LOD when loading chunks', async () => {
      await app.generateWorld(12345);

      const state = app.getState();
      const chunks = Array.from(state.loadedChunks.values());

      // Check that chunks have LOD level metadata
      const chunksWithLOD = chunks.filter(chunk => (chunk as any).lodLevel !== undefined);
      expect(chunksWithLOD.length).toBeGreaterThan(0);
    });

    it('should apply appropriate LOD level to each chunk', async () => {
      // Camera at origin
      app.updateCameraPosition({ x: 0, y: 100, z: 0 });

      await app.loadChunksAround(0, 0, 2);

      const state = app.getState();
      const chunks = Array.from(state.loadedChunks.values());

      // Check that center chunk has HIGH LOD
      const centerChunk = chunks.find(c => c.x === 0 && c.y === 0);
      expect(centerChunk).toBeDefined();
      expect((centerChunk as any).lodLevel).toBe(LODLevel.HIGH);

      // Check that distant chunks have lower LOD
      const distantChunk = chunks.find(c => Math.abs(c.x) === 2 || Math.abs(c.y) === 2);
      if (distantChunk) {
        expect((distantChunk as any).lodLevel).toBeGreaterThanOrEqual(LODLevel.MEDIUM);
      }
    });
  });

  describe('LOD Performance', () => {
    it('should update LOD levels within 100ms requirement', async () => {
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      await app.generateWorld(12345);

      const startTime = performance.now();
      app.updateCameraPosition({ x: 100, y: 100, z: 100 });
      const endTime = performance.now();

      const updateTime = endTime - startTime;

      // Requirement 7.6: Update within 100ms
      expect(updateTime).toBeLessThan(100);
    });
  });
});
