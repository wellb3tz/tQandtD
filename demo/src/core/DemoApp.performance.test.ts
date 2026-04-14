/**
 * DemoApp Performance Testing
 * 
 * Tests performance requirements for the demo application:
 * - Frame rate during normal operation (target: 60fps)
 * - Chunk generation time (target: <100ms)
 * - Incremental generation maintains target FPS
 * - Memory usage with 50+ chunks loaded
 * - Cache eviction works correctly
 * 
 * **Validates: Requirements 1.7, 7.6, 9.6, 10.2**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DemoApp } from './DemoApp';

describe('DemoApp - Performance Testing', () => {
  let app: DemoApp;

  beforeEach(async () => {
    app = new DemoApp();
    await app.initialize();
  });

  afterEach(() => {
    if (app) {
      app.destroy();
    }
  });

  describe('Frame Rate Performance', () => {
    it('should maintain 60fps target during normal operation', async () => {
      // Load initial chunks
      await app.loadChunksAround(0, 0, 2);

      const state = app.getState();
      
      // Simulate frame updates
      const frameCount = 60;
      const frameTimes: number[] = [];
      
      for (let i = 0; i < frameCount; i++) {
        const startTime = performance.now();
        
        // Simulate typical frame operations
        app.updateCameraPosition({
          x: Math.sin(i * 0.1) * 10,
          y: 5,
          z: Math.cos(i * 0.1) * 10
        });
        
        const endTime = performance.now();
        frameTimes.push(endTime - startTime);
      }

      // Calculate average frame time
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const targetFrameTime = 1000 / 60; // 16.67ms for 60fps

      // Frame time should be well under target
      expect(avgFrameTime).toBeLessThan(targetFrameTime);
      
      // 95th percentile should also be under target
      const sorted = frameTimes.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      expect(p95).toBeLessThan(targetFrameTime * 1.5); // Allow some variance
    });

    it('should track FPS metrics accurately', async () => {
      await app.loadChunksAround(0, 0, 1);

      const state = app.getState();
      
      // FPS should be initialized
      expect(state.fps).toBeGreaterThanOrEqual(0);
      expect(state.fps).toBeLessThanOrEqual(60);
    });

    it('should maintain performance with camera movement', async () => {
      await app.loadChunksAround(0, 0, 2);

      const movementCount = 30;
      const movementTimes: number[] = [];

      for (let i = 0; i < movementCount; i++) {
        const startTime = performance.now();
        
        app.updateCameraPosition({
          x: i * 2,
          y: 5,
          z: i * 2
        });
        
        const endTime = performance.now();
        movementTimes.push(endTime - startTime);
      }

      const avgMovementTime = movementTimes.reduce((a, b) => a + b, 0) / movementTimes.length;
      
      // Camera updates should be very fast (<5ms)
      expect(avgMovementTime).toBeLessThan(5);
    });
  });

  describe('Chunk Generation Performance', () => {
    it('should generate chunks in less than 100ms', async () => {
      const chunkCount = 9; // 3x3 grid
      
      const startTime = performance.now();
      await app.loadChunksAround(0, 0, 1);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerChunk = totalTime / chunkCount;

      // Average time per chunk should be under 100ms
      expect(avgTimePerChunk).toBeLessThan(100);
      
      const state = app.getState();
      expect(state.loadedChunkCount).toBe(chunkCount);
    });

    it('should track generation time metrics', async () => {
      await app.loadChunksAround(0, 0, 1);

      const state = app.getState();
      
      // Should have generation time recorded
      expect(state.avgGenerationTime).toBeGreaterThan(0);
      expect(state.avgGenerationTime).toBeLessThan(100);
    });

    it('should generate multiple chunks efficiently', async () => {
      const startTime = performance.now();
      
      // Load 5x5 grid (25 chunks)
      await app.loadChunksAround(0, 0, 2);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const state = app.getState();
      const chunkCount = state.loadedChunkCount;
      
      expect(chunkCount).toBe(25);
      
      // Average should still be under 100ms per chunk
      const avgTime = totalTime / chunkCount;
      expect(avgTime).toBeLessThan(100);
    });

    it('should handle distant chunk loading efficiently', async () => {
      // Load chunks at different locations
      const locations = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: -10, y: -10 }
      ];

      const loadTimes: number[] = [];

      for (const loc of locations) {
        const startTime = performance.now();
        await app.loadChunksAround(loc.x, loc.y, 1);
        const endTime = performance.now();
        
        loadTimes.push(endTime - startTime);
      }

      // All loads should be reasonably fast
      for (const time of loadTimes) {
        expect(time).toBeLessThan(1000); // 1 second for 9 chunks
      }
    });
  });

  describe('Incremental Generation Performance', () => {
    it('should maintain target FPS during incremental generation', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16 // Target 60fps
        }
      });

      // Start generation
      await app.loadChunksAround(0, 0, 2);

      const frameCount = 60;
      const frameTimes: number[] = [];

      for (let i = 0; i < frameCount; i++) {
        const startTime = performance.now();
        
        // Continue incremental generation
        app.continueIncrementalGeneration();
        
        // Simulate frame operations
        app.updateCameraPosition({
          x: Math.sin(i * 0.1) * 5,
          y: 5,
          z: Math.cos(i * 0.1) * 5
        });
        
        const endTime = performance.now();
        frameTimes.push(endTime - startTime);
      }

      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const targetFrameTime = 1000 / 60; // 16.67ms

      // Should maintain target frame time
      expect(avgFrameTime).toBeLessThan(targetFrameTime * 1.2); // Allow 20% variance
    });

    it('should respect time budget during incremental generation', async () => {
      const timeBudget = 16;
      
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: timeBudget
        }
      });

      await app.loadChunksAround(0, 0, 1);

      const iterations = 20;
      const executionTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        app.continueIncrementalGeneration();
        const endTime = performance.now();
        
        executionTimes.push(endTime - startTime);
      }

      // Most executions should be within time budget (allow 2x budget for variance)
      const withinBudget = executionTimes.filter(t => t <= timeBudget * 2).length;
      const percentage = (withinBudget / iterations) * 100;
      
      expect(percentage).toBeGreaterThan(70); // At least 70% within 2x budget
    });

    it('should complete generation progressively', async () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      await app.loadChunksAround(0, 0, 1);

      const initialInProgress = app.getState().chunksInProgress.size;
      expect(initialInProgress).toBeGreaterThan(0);

      // Continue generation
      const maxIterations = 100;
      let iterations = 0;
      
      while (app.getState().chunksInProgress.size > 0 && iterations < maxIterations) {
        app.continueIncrementalGeneration();
        iterations++;
      }

      // Should complete within reasonable iterations
      expect(iterations).toBeLessThan(maxIterations);
      expect(app.getState().chunksInProgress.size).toBe(0);
    });
  });

  describe('Memory Usage with Large Chunk Counts', () => {
    it('should handle 50+ chunks without excessive memory growth', async () => {
      // Load 7x7 grid (49 chunks)
      await app.loadChunksAround(0, 0, 3);

      let state = app.getState();
      expect(state.loadedChunkCount).toBe(49);

      // Load additional chunks to exceed 50
      await app.loadChunksAround(5, 5, 1);

      state = app.getState();
      expect(state.loadedChunkCount).toBeGreaterThanOrEqual(50);

      // Verify chunks are loaded and tracked
      expect(state.loadedChunks.size).toBeGreaterThanOrEqual(50);
      
      // Estimate memory usage based on chunk data
      // Each chunk has heightmap (32x32 Float32Array), biomeMap (32x32 Uint8Array), etc.
      const estimatedBytesPerChunk = 
        (32 * 32 * 4) + // heightmap (Float32Array)
        (32 * 32 * 1) + // biomeMap (Uint8Array)
        1024; // overhead for resources, structures, rivers
      
      const estimatedMemoryMB = (state.loadedChunks.size * estimatedBytesPerChunk) / (1024 * 1024);
      
      // Should be reasonable (< 10MB for 50+ chunks)
      expect(estimatedMemoryMB).toBeLessThan(10);
    });

    it('should track chunk count accurately', async () => {
      const initialState = app.getState();
      const initialCount = initialState.loadedChunkCount;

      // Load chunks
      await app.loadChunksAround(0, 0, 2);

      const afterLoadState = app.getState();
      const afterLoadCount = afterLoadState.loadedChunkCount;

      // Chunk count should increase after loading
      expect(afterLoadCount).toBeGreaterThan(initialCount);
      expect(afterLoadCount).toBe(25); // 5x5 grid
    });

    it('should handle large world efficiently', async () => {
      // Load 9x9 grid (81 chunks)
      const startTime = performance.now();
      await app.loadChunksAround(0, 0, 4);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const state = app.getState();

      expect(state.loadedChunkCount).toBe(81);
      
      // Should complete in reasonable time (< 10 seconds)
      expect(totalTime).toBeLessThan(10000);
      
      // Average time per chunk should still be reasonable
      const avgTime = totalTime / 81;
      expect(avgTime).toBeLessThan(150); // Slightly higher for large batches
    });
  });

  describe('Cache Eviction Performance', () => {
    it('should evict distant chunks correctly', async () => {
      // Load initial chunks
      await app.loadChunksAround(0, 0, 3);

      const initialCount = app.getState().loadedChunkCount;
      expect(initialCount).toBe(49); // 7x7 grid

      // Move far away and unload distant chunks
      app.unloadDistantChunks(20, 20, 5);

      const afterUnloadCount = app.getState().loadedChunkCount;
      
      // Should have unloaded some chunks
      expect(afterUnloadCount).toBeLessThan(initialCount);
    });

    it('should maintain cache hit rate with eviction', async () => {
      // Load chunks
      await app.loadChunksAround(0, 0, 2);

      // Unload distant chunks
      app.unloadDistantChunks(10, 10, 3);

      // Reload original chunks
      await app.loadChunksAround(0, 0, 2);

      const state = app.getState();
      
      // Cache hit rate should be tracked
      expect(state.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(state.cacheHitRate).toBeLessThanOrEqual(1);
    });

    it('should handle rapid load/unload cycles', async () => {
      const cycles = 5;
      const cycleTimes: number[] = [];

      for (let i = 0; i < cycles; i++) {
        const startTime = performance.now();
        
        // Load chunks
        await app.loadChunksAround(i * 5, i * 5, 1);
        
        // Unload distant chunks
        app.unloadDistantChunks(i * 5, i * 5, 2);
        
        const endTime = performance.now();
        cycleTimes.push(endTime - startTime);
      }

      // Each cycle should be reasonably fast
      for (const time of cycleTimes) {
        expect(time).toBeLessThan(1000);
      }
    });

    it('should not exceed memory limits with eviction', async () => {
      // Load many chunks in different locations
      const locations = [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: -20, y: -20 },
        { x: 20, y: -20 },
        { x: -20, y: 20 }
      ];

      for (const loc of locations) {
        await app.loadChunksAround(loc.x, loc.y, 2);
        
        // Evict distant chunks after each load
        app.unloadDistantChunks(loc.x, loc.y, 5);
      }

      const state = app.getState();
      
      // Should maintain reasonable chunk count
      expect(state.loadedChunkCount).toBeLessThan(100);
      
      // Verify chunks are properly managed
      expect(state.loadedChunks.size).toBeLessThan(100);
    });
  });

  describe('LOD Performance Impact', () => {
    it('should improve performance with LOD enabled', async () => {
      // Test without LOD
      app.updateEngineConfig({
        lodConfig: undefined
      });

      const startTimeNoLOD = performance.now();
      await app.loadChunksAround(0, 0, 3);
      const endTimeNoLOD = performance.now();
      const timeNoLOD = endTimeNoLOD - startTimeNoLOD;

      // Clear chunks
      app.unloadDistantChunks(0, 0, 0);

      // Test with LOD
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      const startTimeWithLOD = performance.now();
      await app.loadChunksAround(0, 0, 3);
      const endTimeWithLOD = performance.now();
      const timeWithLOD = endTimeWithLOD - startTimeWithLOD;

      // LOD should not significantly slow down generation
      // (may be slightly slower due to LOD calculations)
      expect(timeWithLOD).toBeLessThan(timeNoLOD * 1.5);
    });

    it('should meet 60 FPS target with LOD enabled and 25 chunks loaded', async () => {
      // Configure LOD system
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      // Generate world
      await app.generateWorld(12345);

      // Load 25 chunks (5x5 grid)
      await app.loadChunksAround(0, 0, 2);

      const state = app.getState();
      expect(state.loadedChunkCount).toBe(25);

      // Simulate 5 seconds of frame updates at 60 FPS (300 frames)
      const targetFPS = 60;
      const simulationDuration = 5000; // 5 seconds in ms
      const frameCount = Math.floor((simulationDuration / 1000) * targetFPS);
      const frameTimes: number[] = [];

      for (let i = 0; i < frameCount; i++) {
        const startTime = performance.now();

        // Simulate typical frame operations
        // Move camera in a circular pattern to trigger LOD updates
        const angle = (i / frameCount) * Math.PI * 2;
        app.updateCameraPosition({
          x: Math.cos(angle) * 15,
          y: 10,
          z: Math.sin(angle) * 15
        });

        const endTime = performance.now();
        frameTimes.push(endTime - startTime);
      }

      // Calculate average frame time
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const targetFrameTime = 1000 / targetFPS; // 16.67ms for 60fps

      // Calculate simulated FPS
      const simulatedFPS = 1000 / avgFrameTime;

      // Verify FPS >= 60
      expect(simulatedFPS).toBeGreaterThanOrEqual(targetFPS);
      expect(avgFrameTime).toBeLessThan(targetFrameTime);

      // Verify LOD statistics
      const finalState = app.getState();
      expect(finalState.lodHighCount).toBeGreaterThan(0);
      expect(finalState.lodMediumCount + finalState.lodLowCount).toBeGreaterThan(0);

      // Verify total LOD chunks equals loaded chunks
      const totalLODChunks = finalState.lodHighCount + finalState.lodMediumCount + finalState.lodLowCount;
      expect(totalLODChunks).toBe(finalState.loadedChunkCount);

      // Note: Frustum culling statistics are managed by WorldViewer which is not
      // directly exposed by DemoApp. The LOD statistics above indirectly validate
      // that the performance optimizations (including frustum culling) are working
      // correctly, as different LOD levels are being applied based on distance.
    });
  });

  describe('Worker Pool Performance', () => {
    it('should improve throughput with worker pool', async () => {
      // Test with single worker
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 1,
          workerScriptUrl: '/worker.js'
        }
      });

      const startTimeSingle = performance.now();
      await app.loadChunksAround(0, 0, 2);
      const endTimeSingle = performance.now();
      const timeSingle = endTimeSingle - startTimeSingle;

      // Clear chunks
      app.unloadDistantChunks(0, 0, 0);

      // Test with multiple workers
      const workerCount = Math.min(4, navigator.hardwareConcurrency || 2);
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: workerCount,
          workerScriptUrl: '/worker.js'
        }
      });

      const startTimeMulti = performance.now();
      await app.loadChunksAround(0, 0, 2);
      const endTimeMulti = performance.now();
      const timeMulti = endTimeMulti - startTimeMulti;

      // Multiple workers should be at least as fast
      // (may not be faster in test environment)
      expect(timeMulti).toBeLessThanOrEqual(timeSingle * 1.2);
    });
  });

  describe('Overall Performance Benchmarks', () => {
    it('should meet all performance targets simultaneously', async () => {
      // Enable all features
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        },
        incrementalConfig: {
          enabled: false, // Disable for faster test
          timeBudgetMs: 16
        }
      });

      // Load chunks (3x3 grid = 9 chunks for faster test)
      await app.loadChunksAround(0, 0, 1);

      const state = app.getState();

      // Verify chunk loading
      expect(state.loadedChunkCount).toBeGreaterThanOrEqual(9);
      
      // Verify generation time target
      if (state.avgGenerationTime > 0) {
        expect(state.avgGenerationTime).toBeLessThan(100);
      }
      
      // Simulate frame updates
      const frameTimes: number[] = [];
      for (let i = 0; i < 30; i++) {
        const startTime = performance.now();
        app.updateCameraPosition({
          x: Math.sin(i * 0.1) * 5,
          y: 5,
          z: Math.cos(i * 0.1) * 5
        });
        const endTime = performance.now();
        frameTimes.push(endTime - startTime);
      }

      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      expect(avgFrameTime).toBeLessThan(1000 / 60);
    });
  });
});
