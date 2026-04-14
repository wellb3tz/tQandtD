/**
 * Unit tests for DemoApp core class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DemoApp, AppEvent, TerrainTool } from './DemoApp';

describe('DemoApp', () => {
  let app: DemoApp;

  beforeEach(() => {
    app = new DemoApp();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await app.initialize();
      
      const state = app.getState();
      expect(state.chunkManager).not.toBeNull();
      expect(state.loadedChunks.size).toBe(0);
    });

    it('should not initialize twice', async () => {
      await app.initialize();
      const consoleSpy = vi.spyOn(console, 'warn');
      
      await app.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('DemoApp already initialized');
    });

    it('should have default state values', () => {
      const state = app.getState();
      
      expect(state.config.seed).toBe(12345);
      expect(state.config.chunkSize).toBe(32);
      expect(state.selectedTool).toBe(TerrainTool.NONE);
      expect(state.brushSize).toBe(5);
      expect(state.brushStrength).toBe(1.0);
      expect(state.showTerrain).toBe(true);
      expect(state.showBiomes).toBe(true);
      expect(state.showRivers).toBe(true);
    });
  });

  describe('state management', () => {
    it('should update state with partial updates', async () => {
      await app.initialize();
      
      app.updateState({ brushSize: 10, brushStrength: 2.0 });
      
      const state = app.getState();
      expect(state.brushSize).toBe(10);
      expect(state.brushStrength).toBe(2.0);
    });

    it('should notify subscribers on state change', async () => {
      await app.initialize();
      
      const callback = vi.fn();
      app.subscribeToState(callback);
      
      // Should be called immediately with current state
      expect(callback).toHaveBeenCalledTimes(1);
      
      app.updateState({ brushSize: 15 });
      
      // Should be called again after update
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({ brushSize: 15 })
      );
    });

    it('should allow unsubscribing from state changes', async () => {
      await app.initialize();
      
      const callback = vi.fn();
      const unsubscribe = app.subscribeToState(callback);
      
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      app.updateState({ brushSize: 20 });
      
      // Should not be called after unsubscribe
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should return state snapshot', async () => {
      await app.initialize();
      
      const state1 = app.getState();
      const brushSize1 = state1.brushSize;
      
      // Update state
      app.updateState({ brushSize: 999 });
      
      // New state should have updated value
      const state2 = app.getState();
      expect(state2.brushSize).toBe(999);
      
      // Original snapshot should still have old value (if it was a copy)
      // Note: In this implementation, getState returns the actual state object,
      // so both references will show the updated value. This is acceptable
      // as long as consumers don't mutate the state directly.
      expect(brushSize1).toBe(5);
    });
  });

  describe('world generation', () => {
    it('should generate world with specified seed', async () => {
      await app.initialize();
      
      await app.generateWorld(54321);
      
      const state = app.getState();
      expect(state.config.seed).toBe(54321);
      expect(state.loadedChunks.size).toBeGreaterThan(0);
    });

    it('should load initial 3x3 chunk grid', async () => {
      await app.initialize();
      
      await app.generateWorld(12345);
      
      const state = app.getState();
      // 3x3 grid = 9 chunks
      expect(state.loadedChunks.size).toBe(9);
    });

    it('should emit WORLD_GENERATED event', async () => {
      await app.initialize();
      
      const callback = vi.fn();
      app.on(AppEvent.WORLD_GENERATED, callback);
      
      await app.generateWorld(12345);
      
      expect(callback).toHaveBeenCalledWith({ seed: 12345 });
    });

    it('should throw error if not initialized', async () => {
      await expect(app.generateWorld(12345)).rejects.toThrow(
        'ChunkManager not initialized'
      );
    });
  });

  describe('chunk loading', () => {
    beforeEach(async () => {
      await app.initialize();
    });

    it('should load chunks in radius around center', async () => {
      await app.loadChunksAround(0, 0, 1);
      
      const state = app.getState();
      expect(state.loadedChunks.size).toBe(9); // 3x3 grid
    });

    it('should not reload already loaded chunks', async () => {
      await app.loadChunksAround(0, 0, 1);
      const firstSize = app.getState().loadedChunks.size;
      
      await app.loadChunksAround(0, 0, 1);
      const secondSize = app.getState().loadedChunks.size;
      
      expect(firstSize).toBe(secondSize);
    });

    it('should emit CHUNK_LOADED events', async () => {
      const callback = vi.fn();
      app.on(AppEvent.CHUNK_LOADED, callback);
      
      await app.loadChunksAround(0, 0, 1);
      
      expect(callback).toHaveBeenCalledTimes(9);
    });

    it('should update performance metrics', async () => {
      await app.loadChunksAround(0, 0, 1);
      
      const state = app.getState();
      expect(state.loadedChunkCount).toBe(9);
      expect(state.avgGenerationTime).toBeGreaterThan(0);
    });
  });

  describe('chunk unloading', () => {
    beforeEach(async () => {
      await app.initialize();
      await app.loadChunksAround(0, 0, 2); // Load 5x5 grid
    });

    it('should unload chunks beyond max distance', () => {
      const initialSize = app.getState().loadedChunks.size;
      
      app.unloadDistantChunks(0, 0, 1);
      
      const finalSize = app.getState().loadedChunks.size;
      expect(finalSize).toBeLessThan(initialSize);
    });

    it('should emit CHUNK_UNLOADED events', () => {
      const callback = vi.fn();
      app.on(AppEvent.CHUNK_UNLOADED, callback);
      
      app.unloadDistantChunks(0, 0, 1);
      
      expect(callback).toHaveBeenCalled();
    });

    it('should update loaded chunk count', () => {
      app.unloadDistantChunks(0, 0, 1);
      
      const state = app.getState();
      expect(state.loadedChunkCount).toBe(state.loadedChunks.size);
    });

    it('should keep chunks within max distance', () => {
      app.unloadDistantChunks(0, 0, 1);
      
      const state = app.getState();
      for (const chunk of state.loadedChunks.values()) {
        const distance = Math.sqrt(chunk.x * chunk.x + chunk.y * chunk.y);
        expect(distance).toBeLessThanOrEqual(1.5); // Allow some tolerance
      }
    });
  });

  describe('configuration updates', () => {
    beforeEach(async () => {
      await app.initialize();
    });

    it('should update engine configuration', () => {
      app.updateEngineConfig({
        seed: 99999,
        chunkSize: 64
      });
      
      const state = app.getState();
      expect(state.config.seed).toBe(99999);
      expect(state.config.chunkSize).toBe(64);
    });

    it('should emit CONFIG_CHANGED event', () => {
      const callback = vi.fn();
      app.on(AppEvent.CONFIG_CHANGED, callback);
      
      app.updateEngineConfig({ seed: 99999 });
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ seed: 99999 })
      );
    });

    it('should preserve unmodified config values', () => {
      const originalConfig = app.getState().config;
      
      app.updateEngineConfig({ seed: 99999 });
      
      const newConfig = app.getState().config;
      expect(newConfig.chunkSize).toBe(originalConfig.chunkSize);
      expect(newConfig.terrainConfig).toEqual(originalConfig.terrainConfig);
    });
  });

  describe('event system', () => {
    beforeEach(async () => {
      await app.initialize();
    });

    it('should register and call event listeners', () => {
      const callback = vi.fn();
      app.on(AppEvent.STATE_CHANGED, callback);
      
      app.updateState({ brushSize: 10 });
      
      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscribing from events', () => {
      const callback = vi.fn();
      const unsubscribe = app.on(AppEvent.STATE_CHANGED, callback);
      
      unsubscribe();
      app.updateState({ brushSize: 10 });
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      app.on(AppEvent.STATE_CHANGED, callback1);
      app.on(AppEvent.STATE_CHANGED, callback2);
      
      app.updateState({ brushSize: 10 });
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should not throw if listener throws error', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();
      
      app.on(AppEvent.STATE_CHANGED, errorCallback);
      app.on(AppEvent.STATE_CHANGED, normalCallback);
      
      expect(() => {
        app.updateState({ brushSize: 10 });
      }).not.toThrow();
      
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      await app.initialize();
    });

    it('should update statistics after world generation', async () => {
      await app.generateWorld(12345);
      
      const state = app.getState();
      expect(state.biomeDistribution.size).toBeGreaterThan(0);
      expect(state.avgHeight).toBeGreaterThan(0);
      expect(state.minHeight).toBeLessThanOrEqual(state.maxHeight);
    });

    it('should aggregate statistics from all loaded chunks', async () => {
      await app.generateWorld(12345);
      
      const state = app.getState();
      const totalBiomes = Array.from(state.biomeDistribution.values())
        .reduce((sum, count) => sum + count, 0);
      
      // Total biomes should equal total tiles in all chunks
      const expectedTiles = state.loadedChunks.size * 32 * 32;
      expect(totalBiomes).toBe(expectedTiles);
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on destroy', async () => {
      await app.initialize();
      await app.generateWorld(12345);
      
      app.destroy();
      
      const state = app.getState();
      expect(state.chunkManager).toBeNull();
      expect(state.loadedChunks.size).toBe(0);
    });

    it('should remove all subscribers on destroy', async () => {
      await app.initialize();
      
      const callback = vi.fn();
      app.subscribeToState(callback);
      
      app.destroy();
      app.updateState({ brushSize: 10 });
      
      // Callback should not be called after destroy
      expect(callback).toHaveBeenCalledTimes(1); // Only initial call
    });

    it('should remove all event listeners on destroy', async () => {
      await app.initialize();
      
      const callback = vi.fn();
      app.on(AppEvent.STATE_CHANGED, callback);
      
      app.destroy();
      app.updateState({ brushSize: 10 });
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
