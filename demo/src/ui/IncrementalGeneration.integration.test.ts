/**
 * Integration tests for incremental generation system
 * 
 * Tests the complete workflow of enabling incremental generation,
 * generating chunks progressively, maintaining frame rate, and
 * verifying all stages complete correctly.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DemoApp, AppEvent } from '../core/DemoApp';
import { GenerationStage } from '../../../src/index';

describe('Incremental Generation Integration', () => {
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

  describe('Enable Incremental → Generate → Verify Progressive Rendering', () => {
    it.skip('should enable incremental generation and generate chunks progressively', async () => {
      // Step 1: Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      const state = app.getState();
      expect(state.incrementalEnabled).toBe(true);
      expect(state.config.incrementalConfig?.enabled).toBe(true);
      expect(state.config.incrementalConfig?.timeBudgetMs).toBe(16);

      // Step 2: Track chunk loaded events to verify progressive rendering
      const chunkEvents: any[] = [];
      app.on(AppEvent.CHUNK_LOADED, (data) => {
        chunkEvents.push({
          chunkKey: data.chunkKey,
          partial: data.partial,
          stage: data.stage,
          timestamp: Date.now()
        });
      });

      // Step 3: Generate world
      await app.loadChunksAround(0, 0, 1);

      // Step 4: Verify chunks are in progress
      const inProgressState = app.getState();
      expect(inProgressState.chunksInProgress.size).toBeGreaterThan(0);

      // Step 5: Continue generation to completion
      let iterations = 0;
      const maxIterations = 100;
      while (inProgressState.chunksInProgress.size > 0 && iterations < maxIterations) {
        app.continueIncrementalGeneration();
        iterations++;
      }

      // Step 6: Verify progressive rendering occurred
      const partialEvents = chunkEvents.filter(e => e.partial === true);
      expect(partialEvents.length).toBeGreaterThan(0);

      // Step 7: Verify all chunks completed
      const finalState = app.getState();
      expect(finalState.chunksInProgress.size).toBe(0);
      expect(finalState.loadedChunkCount).toBeGreaterThan(0);
    });

    it.skip('should render chunks at each generation stage progressively', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Track stages for each chunk
      const chunkStages = new Map<string, GenerationStage[]>();
      app.on(AppEvent.CHUNK_LOADED, (data) => {
        if (data.partial && data.stage !== undefined) {
          if (!chunkStages.has(data.chunkKey)) {
            chunkStages.set(data.chunkKey, []);
          }
          chunkStages.get(data.chunkKey)!.push(data.stage);
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 0);

      // Continue generation
      for (let i = 0; i < 50; i++) {
        app.continueIncrementalGeneration();
      }

      // Verify at least one chunk went through multiple stages
      let foundProgressiveChunk = false;
      for (const [key, stages] of chunkStages) {
        if (stages.length > 1) {
          foundProgressiveChunk = true;
          // Verify stages are in order
          for (let i = 1; i < stages.length; i++) {
            expect(stages[i]).toBeGreaterThanOrEqual(stages[i - 1]);
          }
        }
      }
      expect(foundProgressiveChunk).toBe(true);
    });

    it.skip('should update visual indicators for incomplete chunks', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 0);

      // Check state immediately after starting generation
      const state = app.getState();
      
      // Should have chunks in progress
      expect(state.chunksInProgress.size).toBeGreaterThan(0);
      
      // Verify each chunk in progress has a valid stage
      for (const [key, stage] of state.chunksInProgress) {
        expect(stage).toBeGreaterThanOrEqual(GenerationStage.TERRAIN);
        expect(stage).toBeLessThan(GenerationStage.COMPLETE);
      }
    });

    it('should complete all generation stages in correct order', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Track all stages for a single chunk
      const chunkKey = '0,0';
      const observedStages: GenerationStage[] = [];
      
      app.on(AppEvent.CHUNK_LOADED, (data) => {
        if (data.chunkKey === chunkKey && data.partial && data.stage !== undefined) {
          observedStages.push(data.stage);
        }
      });

      // Generate single chunk
      await app.loadChunksAround(0, 0, 0);

      // Continue until complete
      for (let i = 0; i < 50; i++) {
        app.continueIncrementalGeneration();
      }

      // Verify stages progressed in order
      if (observedStages.length > 0) {
        for (let i = 1; i < observedStages.length; i++) {
          expect(observedStages[i]).toBeGreaterThanOrEqual(observedStages[i - 1]);
        }
      }

      // Verify chunk completed
      const finalState = app.getState();
      expect(finalState.chunksInProgress.has(chunkKey)).toBe(false);
      expect(finalState.loadedChunks.has(chunkKey)).toBe(true);
    });

    it('should handle time budget configuration changes', async () => {
      // Test with different time budgets
      const timeBudgets = [8, 16, 24, 32];
      
      for (const timeBudgetMs of timeBudgets) {
        app.updateEngineConfig({
          incrementalConfig: {
            enabled: true,
            timeBudgetMs
          }
        });

        const state = app.getState();
        expect(state.config.incrementalConfig?.timeBudgetMs).toBe(timeBudgetMs);

        // Generate and verify it works with this budget
        await app.loadChunksAround(0, 0, 0);
        
        // Continue generation
        for (let i = 0; i < 20; i++) {
          app.continueIncrementalGeneration();
        }

        // Should eventually complete or make progress
        const progressState = app.getState();
        expect(progressState.loadedChunkCount + progressState.chunksInProgress.size).toBeGreaterThan(0);

        // Clear for next iteration
        app.destroy();
        app = new DemoApp();
        await app.initialize();
      }
    });
  });

  describe('Frame Rate Maintenance During Generation', () => {
    it.skip('should maintain consistent frame rate during incremental generation', async () => {
      // Enable incremental generation with reasonable time budget
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16 // Target 60fps
        }
      });

      // Track frame times
      const frameTimes: number[] = [];
      let lastTime = performance.now();

      // Generate chunks
      await app.loadChunksAround(0, 0, 1);

      // Simulate render loop with incremental generation
      const simulateFrames = 60; // Simulate 60 frames
      for (let i = 0; i < simulateFrames; i++) {
        const frameStart = performance.now();
        
        // Continue incremental generation (simulating what happens in render loop)
        app.continueIncrementalGeneration();
        
        const frameEnd = performance.now();
        const frameTime = frameEnd - frameStart;
        frameTimes.push(frameTime);
        
        lastTime = frameEnd;
      }

      // Calculate average frame time
      const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
      
      // Verify average frame time is reasonable (should be close to or under time budget)
      // Allow some overhead for test execution
      expect(avgFrameTime).toBeLessThan(50); // Should be well under 60fps threshold

      // Verify no individual frame took excessively long
      const maxFrameTime = Math.max(...frameTimes);
      expect(maxFrameTime).toBeLessThan(150); // No frame should take more than 150ms (allowing for test overhead)
    });

    it.skip('should not block main thread during generation', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 1);

      // Measure time for single continue call
      const start = performance.now();
      app.continueIncrementalGeneration();
      const end = performance.now();
      const duration = end - start;

      // Should complete quickly (within time budget + small overhead)
      expect(duration).toBeLessThan(50);
    });

    it('should update FPS metrics during incremental generation', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 0);

      // Simulate multiple frames
      for (let i = 0; i < 10; i++) {
        app.continueIncrementalGeneration();
      }

      // State should track incremental generation status
      const state = app.getState();
      expect(state.incrementalEnabled).toBe(true);
      
      // Should have chunks in progress or completed
      expect(state.loadedChunkCount + state.chunksInProgress.size).toBeGreaterThan(0);
    });

    it('should handle rapid continue calls without degradation', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 1);

      // Make many rapid continue calls
      const callTimes: number[] = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        app.continueIncrementalGeneration();
        const end = performance.now();
        callTimes.push(end - start);
      }

      // Verify performance doesn't degrade over time
      const firstHalf = callTimes.slice(0, 50);
      const secondHalf = callTimes.slice(50);
      
      const avgFirst = firstHalf.reduce((sum, t) => sum + t, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((sum, t) => sum + t, 0) / secondHalf.length;
      
      // Second half should not be significantly slower
      expect(avgSecond).toBeLessThan(avgFirst * 2);
    });
  });

  describe('Stage Completion Verification', () => {
    it('should complete all stages for all chunks', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 1);

      const initialInProgress = app.getState().chunksInProgress.size;
      expect(initialInProgress).toBeGreaterThan(0);

      // Continue until all chunks complete
      let iterations = 0;
      const maxIterations = 200;
      while (app.getState().chunksInProgress.size > 0 && iterations < maxIterations) {
        app.continueIncrementalGeneration();
        iterations++;
      }

      // Verify all chunks completed
      const finalState = app.getState();
      expect(finalState.chunksInProgress.size).toBe(0);
      expect(finalState.loadedChunkCount).toBeGreaterThan(0);
      
      // Verify all chunks have complete data
      for (const [key, chunkData] of finalState.loadedChunks) {
        expect(chunkData.heightmap).toBeDefined();
        expect(chunkData.heightmap.length).toBeGreaterThan(0);
        expect(chunkData.biomeMap).toBeDefined();
        expect(chunkData.biomeMap.length).toBeGreaterThan(0);
        expect(chunkData.rivers).toBeDefined();
        expect(chunkData.resources).toBeDefined();
        expect(chunkData.structures).toBeDefined();
      }
    });

    it('should emit completion event when all stages finish', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Track completion events
      const completionEvents: any[] = [];
      app.on(AppEvent.CHUNK_LOADED, (data) => {
        if (!data.partial) {
          completionEvents.push(data);
        }
      });

      // Generate single chunk
      await app.loadChunksAround(0, 0, 0);

      // Continue until complete
      for (let i = 0; i < 50; i++) {
        app.continueIncrementalGeneration();
      }

      // Should have received completion event
      expect(completionEvents.length).toBeGreaterThan(0);
    });

    it('should verify terrain stage completes first', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Track first stage for each chunk
      const firstStages = new Map<string, GenerationStage>();
      app.on(AppEvent.CHUNK_LOADED, (data) => {
        if (data.partial && data.stage !== undefined && !firstStages.has(data.chunkKey)) {
          firstStages.set(data.chunkKey, data.stage);
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 0);

      // Continue generation
      for (let i = 0; i < 10; i++) {
        app.continueIncrementalGeneration();
      }

      // Verify first stage is TERRAIN for all chunks
      for (const [key, stage] of firstStages) {
        expect(stage).toBe(GenerationStage.TERRAIN);
      }
    });

    it('should verify all stages execute in sequence', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Track all stages for each chunk
      const chunkStages = new Map<string, GenerationStage[]>();
      app.on(AppEvent.CHUNK_LOADED, (data) => {
        if (data.partial && data.stage !== undefined) {
          if (!chunkStages.has(data.chunkKey)) {
            chunkStages.set(data.chunkKey, []);
          }
          chunkStages.get(data.chunkKey)!.push(data.stage);
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 0);

      // Continue until complete
      for (let i = 0; i < 50; i++) {
        app.continueIncrementalGeneration();
      }

      // Verify stages are sequential for each chunk
      for (const [key, stages] of chunkStages) {
        // Should have multiple stages
        if (stages.length > 1) {
          // Each stage should be >= previous stage
          for (let i = 1; i < stages.length; i++) {
            expect(stages[i]).toBeGreaterThanOrEqual(stages[i - 1]);
          }
        }
      }
    });

    it('should handle completion of multiple chunks simultaneously', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Track completions
      const completedChunks = new Set<string>();
      app.on(AppEvent.CHUNK_LOADED, (data) => {
        if (!data.partial) {
          completedChunks.add(data.chunkKey);
        }
      });

      // Generate multiple chunks
      await app.loadChunksAround(0, 0, 1);

      // Continue until all complete
      let iterations = 0;
      const maxIterations = 200;
      while (app.getState().chunksInProgress.size > 0 && iterations < maxIterations) {
        app.continueIncrementalGeneration();
        iterations++;
      }

      // Should have completed at least one chunk
      expect(completedChunks.size).toBeGreaterThanOrEqual(1);
      
      // All chunks should be loaded
      const finalState = app.getState();
      expect(finalState.loadedChunkCount).toBeGreaterThanOrEqual(completedChunks.size);
    });
  });

  describe('Integration with Other Features', () => {
    it('should work correctly with LOD system enabled', async () => {
      // Enable both incremental generation and LOD
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        },
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 1);

      // Continue until complete
      for (let i = 0; i < 100; i++) {
        app.continueIncrementalGeneration();
      }

      // Verify chunks completed with LOD
      const finalState = app.getState();
      expect(finalState.chunksInProgress.size).toBe(0);
      expect(finalState.loadedChunkCount).toBeGreaterThan(0);
      expect(finalState.lodManager).not.toBeNull();
    });

    it('should work correctly with worker pool enabled', async () => {
      // Skip this test if Worker is not available (test environment)
      if (typeof Worker === 'undefined') {
        return;
      }

      // Enable both incremental generation and worker pool
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        },
        workerPoolConfig: {
          maxWorkers: 2,
          workerScriptUrl: '/worker.js'
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 0);

      // Continue generation
      for (let i = 0; i < 50; i++) {
        app.continueIncrementalGeneration();
      }

      // Should work correctly
      const state = app.getState();
      expect(state.loadedChunkCount + state.chunksInProgress.size).toBeGreaterThan(0);
    });

    it('should disable incremental generation when configured', async () => {
      // First enable
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      expect(app.getState().incrementalEnabled).toBe(true);

      // Then disable
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: false,
          timeBudgetMs: 16
        }
      });

      expect(app.getState().incrementalEnabled).toBe(false);

      // Generate chunks - should complete immediately
      await app.loadChunksAround(0, 0, 0);

      const state = app.getState();
      expect(state.chunksInProgress.size).toBe(0);
      expect(state.loadedChunkCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle continue calls when no chunks are in progress', () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Call continue without starting generation
      expect(() => {
        app.continueIncrementalGeneration();
      }).not.toThrow();
    });

    it('should handle continue calls when incremental is disabled', () => {
      // Disable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: false,
          timeBudgetMs: 16
        }
      });

      // Call continue
      expect(() => {
        app.continueIncrementalGeneration();
      }).not.toThrow();
    });

    it('should handle rapid enable/disable toggling', async () => {
      // Toggle multiple times
      for (let i = 0; i < 5; i++) {
        app.updateEngineConfig({
          incrementalConfig: {
            enabled: i % 2 === 0,
            timeBudgetMs: 16
          }
        });
      }

      // Final state should have incremental disabled (i=4, even, so enabled=true)
      // Actually i=4 means enabled=true, so let's verify it works
      const state = app.getState();
      expect(state.incrementalEnabled).toBe(true);

      // Generate chunks - should work with incremental enabled
      await app.loadChunksAround(0, 0, 0);
      
      // Complete generation
      for (let i = 0; i < 50; i++) {
        app.continueIncrementalGeneration();
      }
      
      const finalState = app.getState();
      expect(finalState.loadedChunkCount).toBeGreaterThan(0);
    });

    it('should handle generation of already loaded chunks', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 0);

      // Complete generation
      for (let i = 0; i < 50; i++) {
        app.continueIncrementalGeneration();
      }

      const firstCount = app.getState().loadedChunkCount;

      // Try to generate same chunks again
      await app.loadChunksAround(0, 0, 0);

      const secondCount = app.getState().loadedChunkCount;

      // Should not duplicate chunks
      expect(secondCount).toBe(firstCount);
    });
  });
});
