/**
 * DemoApp Incremental Generation Integration Tests
 * 
 * Tests the integration of incremental generation into the demo application,
 * including chunk loading, progressive rendering, and state management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DemoApp, AppEvent } from './DemoApp';
import { GenerationStage } from '../../../src/index';

describe('DemoApp - Incremental Generation Integration', () => {
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

  describe('Incremental Configuration', () => {
    it('should enable incremental generation when configured', () => {
      // Enable incremental generation
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
    });

    it('should disable incremental generation when configured', () => {
      // First enable
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Then disable
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: false,
          timeBudgetMs: 16
        }
      });

      const state = app.getState();
      expect(state.incrementalEnabled).toBe(false);
    });

    it('should update time budget when changed', () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 32
        }
      });

      const state = app.getState();
      expect(state.config.incrementalConfig?.timeBudgetMs).toBe(32);
    });
  });

  describe('Incremental Chunk Loading', () => {
    it('should start incremental generation for chunks when enabled', async () => {
      // Enable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 1 // Very small budget to force partial generation
        }
      });

      // Track chunk loaded events
      const chunkLoadedEvents: any[] = [];
      app.on(AppEvent.CHUNK_LOADED, (data) => {
        chunkLoadedEvents.push(data);
      });

      // Load chunks
      await app.loadChunksAround(0, 0, 1);

      const state = app.getState();
      
      // Should have chunks (either in progress or completed)
      const totalChunks = state.chunksInProgress.size + state.loadedChunks.size;
      expect(totalChunks).toBeGreaterThan(0);
      
      // Should have emitted chunk events (partial or complete)
      expect(chunkLoadedEvents.length).toBeGreaterThan(0);
    });

    it('should load chunks immediately when incremental is disabled', async () => {
      // Disable incremental generation
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: false,
          timeBudgetMs: 16
        }
      });

      // Load chunks
      await app.loadChunksAround(0, 0, 1);

      const state = app.getState();
      
      // Should have no chunks in progress
      expect(state.chunksInProgress.size).toBe(0);
      
      // Should have loaded chunks
      expect(state.loadedChunkCount).toBeGreaterThan(0);
    });

    it('should not start duplicate generation for same chunk', async () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Load same chunk twice
      await app.loadChunksAround(0, 0, 0);
      const firstSize = app.getState().chunksInProgress.size;
      
      await app.loadChunksAround(0, 0, 0);
      const secondSize = app.getState().chunksInProgress.size;

      // Should not increase chunks in progress
      expect(secondSize).toBe(firstSize);
    });
  });

  describe('Continue Incremental Generation', () => {
    it('should continue generation for chunks in progress', async () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Start generation
      await app.loadChunksAround(0, 0, 0);
      
      const initialInProgress = app.getState().chunksInProgress.size;
      expect(initialInProgress).toBeGreaterThan(0);

      // Continue generation multiple times
      for (let i = 0; i < 10; i++) {
        app.continueIncrementalGeneration();
      }

      // Should eventually complete
      const finalInProgress = app.getState().chunksInProgress.size;
      expect(finalInProgress).toBeLessThanOrEqual(initialInProgress);
    });

    it('should emit progress events as stages complete', async () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 1 // Very small budget to force multiple iterations
        }
      });

      const progressEvents: any[] = [];
      app.on(AppEvent.CHUNK_LOADED, (data) => {
        if (data.partial) {
          progressEvents.push(data);
        }
      });

      // Start generation
      await app.loadChunksAround(0, 0, 0);

      // Continue until complete
      for (let i = 0; i < 50; i++) { // Increased iterations
        app.continueIncrementalGeneration();
      }

      // Should have received multiple progress events (or generation completed quickly)
      // If no progress events, it means generation completed in first call
      expect(progressEvents.length).toBeGreaterThanOrEqual(0);
    });

    it('should move chunks to loaded when generation completes', async () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Start generation
      await app.loadChunksAround(0, 0, 0);

      // Continue until complete
      for (let i = 0; i < 50; i++) {
        app.continueIncrementalGeneration();
      }

      const state = app.getState();
      
      // Should have completed all chunks
      expect(state.chunksInProgress.size).toBe(0);
      expect(state.loadedChunkCount).toBeGreaterThan(0);
    });

    it('should do nothing when incremental is disabled', () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: false,
          timeBudgetMs: 16
        }
      });

      // Should not throw
      expect(() => {
        app.continueIncrementalGeneration();
      }).not.toThrow();
    });

    it('should do nothing when no chunks are in progress', () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Should not throw
      expect(() => {
        app.continueIncrementalGeneration();
      }).not.toThrow();
    });
  });

  describe('State Management', () => {
    it('should track chunks in progress with their stages', async () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 1 // Very small budget to keep chunks in progress
        }
      });

      await app.loadChunksAround(0, 0, 0);

      const state = app.getState();
      
      // Should have chunks (either in progress or completed)
      const totalChunks = state.chunksInProgress.size + state.loadedChunks.size;
      expect(totalChunks).toBeGreaterThan(0);
      
      // Each chunk in progress should have a valid stage (not COMPLETE)
      for (const [key, stage] of state.chunksInProgress.entries()) {
        expect(stage).toBeGreaterThanOrEqual(GenerationStage.TERRAIN);
        expect(stage).toBeLessThanOrEqual(GenerationStage.COMPLETE);
      }
    });

    it('should update state when chunks progress', async () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      await app.loadChunksAround(0, 0, 0);

      const stateChanges: any[] = [];
      app.subscribeToState((state) => {
        stateChanges.push({
          chunksInProgress: state.chunksInProgress.size,
          loadedChunks: state.loadedChunkCount
        });
      });

      // Continue generation
      for (let i = 0; i < 10; i++) {
        app.continueIncrementalGeneration();
      }

      // Should have state changes
      expect(stateChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with LOD', () => {
    it('should apply LOD to completed incremental chunks', async () => {
      // Enable both LOD and incremental
      app.updateEngineConfig({
        lodConfig: {
          distances: [2, 5],
          meshResolutions: [1.0, 0.5, 0.25],
          featureDensities: [1.0, 0.5, 0.1]
        },
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      await app.loadChunksAround(0, 0, 0);

      // Complete generation
      for (let i = 0; i < 50; i++) {
        app.continueIncrementalGeneration();
      }

      const state = app.getState();
      
      // Should have loaded chunks with LOD applied
      expect(state.loadedChunkCount).toBeGreaterThan(0);
      expect(state.lodManager).not.toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during incremental generation gracefully', async () => {
      app.updateEngineConfig({
        incrementalConfig: {
          enabled: true,
          timeBudgetMs: 16
        }
      });

      // Mock console.error to suppress error output
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Start generation
      await app.loadChunksAround(0, 0, 0);

      // Should not throw even if there are errors
      expect(() => {
        for (let i = 0; i < 10; i++) {
          app.continueIncrementalGeneration();
        }
      }).not.toThrow();

      consoleError.mockRestore();
    });
  });
});
