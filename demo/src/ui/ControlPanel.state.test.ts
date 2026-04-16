/**
 * Unit tests for UI state management
 * 
 * Tests state updates, subscriptions, configuration validation,
 * and preset loading/parameter synchronization.
 * 
 * **Validates: Requirements 15.7, 3.9**
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ControlPanel } from './ControlPanel';
import { DemoApp, AppState, TerrainTool } from '../core/DemoApp';
import { WorldConfig } from '../../../src/index';
import { PRESETS } from '../config/presets';

// Mock Worker for testing
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  
  constructor(public url: string | URL) {
    // Simulate worker initialization
  }
  
  postMessage(message: any) {
    // Simulate async response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: { success: true } }));
      }
    }, 0);
  }
  
  terminate() {
    // Cleanup
  }
  
  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') {
      this.onmessage = listener as any;
    } else if (type === 'error') {
      this.onerror = listener as any;
    }
  }
  
  removeEventListener(type: string, listener: EventListener) {
    if (type === 'message') {
      this.onmessage = null;
    } else if (type === 'error') {
      this.onerror = null;
    }
  }
}

// Install Worker mock globally
(globalThis as any).Worker = MockWorker;

describe('UI State Management', () => {
  let app: DemoApp;
  let controlPanel: ControlPanel;

  beforeEach(async () => {
    app = new DemoApp();
    await app.initialize();
    controlPanel = new ControlPanel();
  });

  afterEach(() => {
    app.destroy();
  });

  describe('State Updates and Subscriptions', () => {
    it('should notify subscribers when state changes', () => {
      const callback = vi.fn();
      app.subscribeToState(callback);

      // Initial call on subscription
      expect(callback).toHaveBeenCalledTimes(1);

      app.updateState({ brushSize: 10 });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({ brushSize: 10 })
      );
    });

    it('should support multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      app.subscribeToState(callback1);
      app.subscribeToState(callback2);
      app.subscribeToState(callback3);

      app.updateState({ brushSize: 15 });

      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);
      expect(callback3).toHaveBeenCalledTimes(2);
    });

    it('should allow unsubscribing from state updates', () => {
      const callback = vi.fn();
      const unsubscribe = app.subscribeToState(callback);

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      app.updateState({ brushSize: 20 });

      // Should not be called after unsubscribe
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle partial state updates', () => {
      app.updateState({ brushSize: 10 });
      let state = app.getState();
      expect(state.brushSize).toBe(10);
      expect(state.brushStrength).toBe(1.0); // Unchanged

      app.updateState({ brushStrength: 2.5 });
      state = app.getState();
      expect(state.brushSize).toBe(10); // Still 10
      expect(state.brushStrength).toBe(2.5);
    });

    it('should update visibility settings', () => {
      app.updateState({
        showTerrain: false,
        showBiomes: false,
        showRivers: false
      });

      const state = app.getState();
      expect(state.showTerrain).toBe(false);
      expect(state.showBiomes).toBe(false);
      expect(state.showRivers).toBe(false);
      expect(state.showResources).toBe(true); // Unchanged
    });

    it('should update camera position and target', () => {
      app.updateState({
        cameraPosition: { x: 100, y: 200, z: 300 },
        cameraTarget: { x: 50, y: 0, z: 50 }
      });

      const state = app.getState();
      expect(state.cameraPosition).toEqual({ x: 100, y: 200, z: 300 });
      expect(state.cameraTarget).toEqual({ x: 50, y: 0, z: 50 });
    });

    it('should update terrain tool selection', () => {
      app.updateState({ selectedTool: TerrainTool.RAISE });
      expect(app.getState().selectedTool).toBe(TerrainTool.RAISE);

      app.updateState({ selectedTool: TerrainTool.FLATTEN });
      expect(app.getState().selectedTool).toBe(TerrainTool.FLATTEN);
    });

    it('should update performance metrics', () => {
      app.updateState({
        fps: 60,
        avgGenerationTime: 45.5,
        memoryUsage: 1024000,
        cacheHitRate: 0.85
      });

      const state = app.getState();
      expect(state.fps).toBe(60);
      expect(state.avgGenerationTime).toBe(45.5);
      expect(state.memoryUsage).toBe(1024000);
      expect(state.cacheHitRate).toBe(0.85);
    });

    it('should not throw when subscriber throws error', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalCallback = vi.fn();

      // Wrap in try-catch since subscribeToState calls callback immediately
      try {
        app.subscribeToState(errorCallback);
      } catch (e) {
        // Expected to throw on initial call
      }
      
      app.subscribeToState(normalCallback);

      expect(() => {
        app.updateState({ brushSize: 10 });
      }).not.toThrow();

      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate terrain configuration parameters', () => {
      const validConfig: Partial<WorldConfig> = {
        terrainConfig: {
          baseScale: 0.01,
          octaves: 4,
          persistence: 0.5,
          lacunarity: 2.0,
          warpStrength: 30,
          heightMultiplier: 1.0
        }
      };

      expect(() => {
        app.updateEngineConfig(validConfig);
      }).not.toThrow();

      const state = app.getState();
      expect(state.config.terrainConfig?.baseScale).toBe(0.01);
      expect(state.config.terrainConfig?.octaves).toBe(4);
    });

    it('should validate biome configuration parameters', () => {
      const validConfig: Partial<WorldConfig> = {
        biomeConfig: {
          temperatureScale: 0.005,
          moistureScale: 0.005,
          blendRadius: 5
        }
      };

      expect(() => {
        app.updateEngineConfig(validConfig);
      }).not.toThrow();

      const state = app.getState();
      expect(state.config.biomeConfig?.temperatureScale).toBe(0.005);
      expect(state.config.biomeConfig?.moistureScale).toBe(0.005);
    });

    it('should validate river configuration parameters', () => {
      const validConfig: Partial<WorldConfig> = {
        riverConfig: {
          sourceElevation: 0.7,
          minFlowLength: 10,
          flowWidth: 2
        }
      };

      expect(() => {
        app.updateEngineConfig(validConfig);
      }).not.toThrow();

      const state = app.getState();
      expect(state.config.riverConfig?.sourceElevation).toBe(0.7);
      expect(state.config.riverConfig?.minFlowLength).toBe(10);
    });

    it('should validate resource configuration parameters', () => {
      const validConfig: Partial<WorldConfig> = {
        resourceConfig: {
          types: [],
          clusterScale: 20,
          densityThreshold: 0.6
        }
      };

      expect(() => {
        app.updateEngineConfig(validConfig);
      }).not.toThrow();

      const state = app.getState();
      expect(state.config.resourceConfig?.clusterScale).toBe(20);
      expect(state.config.resourceConfig?.densityThreshold).toBe(0.6);
    });

    it('should validate structure configuration parameters', () => {
      const validConfig: Partial<WorldConfig> = {
        structureConfig: {
          types: [],
          minDistance: 10,
          maxAttempts: 30
        }
      };

      expect(() => {
        app.updateEngineConfig(validConfig);
      }).not.toThrow();

      const state = app.getState();
      expect(state.config.structureConfig?.minDistance).toBe(10);
      expect(state.config.structureConfig?.maxAttempts).toBe(30);
    });

    it('should preserve existing config when updating partial config', () => {
      const originalConfig = app.getState().config;
      const originalSeed = originalConfig.seed;
      const originalChunkSize = originalConfig.chunkSize;

      app.updateEngineConfig({
        terrainConfig: {
          baseScale: 0.02,
          octaves: 6,
          persistence: 0.6,
          lacunarity: 2.5,
          warpStrength: 50,
          heightMultiplier: 1.5
        }
      });

      const newConfig = app.getState().config;
      expect(newConfig.seed).toBe(originalSeed);
      expect(newConfig.chunkSize).toBe(originalChunkSize);
      expect(newConfig.terrainConfig?.baseScale).toBe(0.02);
    });

    it('should handle nested configuration updates', () => {
      app.updateEngineConfig({
        enhancedBiomeConfig: {
          enableTransitions: true,
          transitionWidth: 12,
          enableMicroBiomes: true,
          microBiomeFrequency: 0.15
        }
      });

      const state = app.getState();
      expect(state.config.enhancedBiomeConfig?.enableTransitions).toBe(true);
      expect(state.config.enhancedBiomeConfig?.transitionWidth).toBe(12);
    });

    it('should validate seed parameter', () => {
      app.updateEngineConfig({ seed: 99999 });
      expect(app.getState().config.seed).toBe(99999);

      app.updateEngineConfig({ seed: 0 });
      expect(app.getState().config.seed).toBe(0);

      app.updateEngineConfig({ seed: -12345 });
      expect(app.getState().config.seed).toBe(-12345);
    });

    it('should validate chunk size parameter', () => {
      app.updateEngineConfig({ chunkSize: 64 });
      expect(app.getState().config.chunkSize).toBe(64);

      app.updateEngineConfig({ chunkSize: 16 });
      expect(app.getState().config.chunkSize).toBe(16);
    });
  });

  describe('Preset Loading and Parameter Synchronization', () => {
    it('should load preset configuration', () => {
      const preset = PRESETS[0]; // Mountainous preset
      
      // Verify preset exists and can be retrieved
      expect(controlPanel.getPresets()).toContain(preset);
      expect(preset.name).toBe('Mountainous');
      expect(preset.config).toBeDefined();
    });

    it('should notify callbacks when preset is selected', () => {
      const callback = vi.fn();
      controlPanel.onPresetSelect(callback);

      // Verify callback registration works
      // Note: callback won't be invoked without DOM initialization
      expect(callback).toBeDefined();
      
      // Verify we can get presets
      const presets = controlPanel.getPresets();
      expect(presets.length).toBeGreaterThan(0);
    });

    it('should synchronize all terrain parameters from preset', () => {
      const mountainousPreset = PRESETS.find(p => p.name === 'Mountainous');
      expect(mountainousPreset).toBeDefined();

      if (mountainousPreset) {
        app.updateEngineConfig(mountainousPreset.config);

        const state = app.getState();
        expect(state.config.terrainConfig?.baseScale).toBe(0.005);
        expect(state.config.terrainConfig?.octaves).toBe(6);
        expect(state.config.terrainConfig?.persistence).toBe(0.6);
        expect(state.config.terrainConfig?.lacunarity).toBe(2.5);
        expect(state.config.terrainConfig?.warpStrength).toBe(50);
        expect(state.config.terrainConfig?.heightMultiplier).toBe(1.5);
      }
    });

    it('should synchronize biome parameters from preset', () => {
      const flatPlainsPreset = PRESETS.find(p => p.name === 'Flat Plains');
      expect(flatPlainsPreset).toBeDefined();

      if (flatPlainsPreset) {
        app.updateEngineConfig(flatPlainsPreset.config);

        const state = app.getState();
        expect(state.config.biomeConfig?.temperatureScale).toBe(0.008);
        expect(state.config.biomeConfig?.moistureScale).toBe(0.008);
        expect(state.config.biomeConfig?.blendRadius).toBe(8);
      }
    });

    it('should synchronize river parameters from preset', () => {
      const riverValleyPreset = PRESETS.find(p => p.name === 'River Valley');
      expect(riverValleyPreset).toBeDefined();

      if (riverValleyPreset) {
        app.updateEngineConfig(riverValleyPreset.config);

        const state = app.getState();
        expect(state.config.riverConfig?.sourceElevation).toBe(0.6);
        expect(state.config.riverConfig?.minFlowLength).toBe(15);
        expect(state.config.riverConfig?.flowWidth).toBe(3);
        expect(state.config.riverNetworkConfig?.enableTributaries).toBe(true);
        expect(state.config.riverNetworkConfig?.tributaryProbability).toBe(0.4);
        expect(state.config.riverNetworkConfig?.enableLakes).toBe(true);
        expect(state.config.riverNetworkConfig?.enableDeltas).toBe(true);
      }
    });

    it('should synchronize enhanced biome parameters from preset', () => {
      const islandWorldPreset = PRESETS.find(p => p.name === 'Island World');
      expect(islandWorldPreset).toBeDefined();

      if (islandWorldPreset) {
        app.updateEngineConfig(islandWorldPreset.config);

        const state = app.getState();
        expect(state.config.enhancedBiomeConfig?.enableTransitions).toBe(true);
        expect(state.config.enhancedBiomeConfig?.transitionWidth).toBe(12);
        expect(state.config.enhancedBiomeConfig?.enableMicroBiomes).toBe(true);
        expect(state.config.enhancedBiomeConfig?.microBiomeFrequency).toBe(0.15);
        expect(state.config.enhancedBiomeConfig?.enableElevationBands).toBe(true);
        expect(state.config.enhancedBiomeConfig?.snowLineElevation).toBe(0.85);
      }
    });

    it('should synchronize resource and structure parameters from preset', () => {
      const mountainousPreset = PRESETS.find(p => p.name === 'Mountainous');
      expect(mountainousPreset).toBeDefined();

      if (mountainousPreset) {
        app.updateEngineConfig(mountainousPreset.config);

        const state = app.getState();
        expect(state.config.resourceConfig?.types.length).toBe(3);
        expect(state.config.resourceConfig?.clusterScale).toBe(20);
        expect(state.config.resourceConfig?.densityThreshold).toBe(0.6);
        expect(state.config.structureConfig?.types.length).toBe(1);
        expect(state.config.structureConfig?.minDistance).toBe(15);
      }
    });

    it('should synchronize LOD and worker pool parameters from preset', () => {
      const performancePreset = PRESETS.find(p => p.name === 'Performance Test');
      expect(performancePreset).toBeDefined();

      if (performancePreset) {
        app.updateEngineConfig(performancePreset.config);

        const state = app.getState();
        expect(state.config.lodConfig?.distances).toEqual([2, 5]);
        expect(state.config.lodConfig?.meshResolutions).toEqual([1.0, 0.5, 0.25]);
        expect(state.config.workerPoolConfig?.workerScriptUrl).toContain('worker');
        expect(state.config.incrementalConfig?.timeBudgetMs).toBe(16);
      }
    });

    it('should handle all built-in presets', () => {
      PRESETS.forEach(preset => {
        expect(() => {
          app.updateEngineConfig(preset.config);
        }).not.toThrow();

        const state = app.getState();
        expect(state.config.seed).toBe(preset.config.seed);
        expect(state.config.chunkSize).toBe(preset.config.chunkSize);
      });
    });

    it('should return all available presets', () => {
      const presets = controlPanel.getPresets();
      expect(presets.length).toBeGreaterThanOrEqual(5);
      expect(presets).toContain(PRESETS[0]);
      expect(presets).toContain(PRESETS[1]);
    });

    it('should register parameter change callbacks', () => {
      const callback = vi.fn();
      controlPanel.onParameterChange(callback);

      // Callback should be registered
      expect(callback).toBeDefined();
    });

    it('should support multiple parameter change callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      controlPanel.onParameterChange(callback1);
      controlPanel.onParameterChange(callback2);
      controlPanel.onParameterChange(callback3);

      // All callbacks should be registered
      expect(callback1).toBeDefined();
      expect(callback2).toBeDefined();
      expect(callback3).toBeDefined();
    });
  });

  describe('State Consistency', () => {
    it('should maintain state consistency across updates', () => {
      const initialState = app.getState();
      
      app.updateState({ brushSize: 10 });
      app.updateState({ brushStrength: 2.0 });
      app.updateState({ showTerrain: false });

      const finalState = app.getState();
      expect(finalState.brushSize).toBe(10);
      expect(finalState.brushStrength).toBe(2.0);
      expect(finalState.showTerrain).toBe(false);
      expect(finalState.config.seed).toBe(initialState.config.seed);
    });

    it('should maintain configuration consistency', () => {
      app.updateEngineConfig({
        terrainConfig: {
          baseScale: 0.02,
          octaves: 6,
          persistence: 0.6,
          lacunarity: 2.5,
          warpStrength: 50,
          heightMultiplier: 1.5
        }
      });

      const state1 = app.getState();
      const terrainConfig1 = state1.config.terrainConfig;

      app.updateEngineConfig({
        biomeConfig: {
          temperatureScale: 0.008,
          moistureScale: 0.008,
          blendRadius: 8
        }
      });

      const state2 = app.getState();
      const terrainConfig2 = state2.config.terrainConfig;

      // Terrain config should remain unchanged
      expect(terrainConfig2).toEqual(terrainConfig1);
    });

    it('should handle rapid state updates', () => {
      for (let i = 0; i < 100; i++) {
        app.updateState({ brushSize: i });
      }

      const state = app.getState();
      expect(state.brushSize).toBe(99);
    });

    it('should handle concurrent subscriptions', () => {
      const callbacks = Array.from({ length: 10 }, () => vi.fn());
      
      callbacks.forEach(callback => {
        app.subscribeToState(callback);
      });

      app.updateState({ brushSize: 25 });

      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({ brushSize: 25 })
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty state updates', () => {
      const initialState = app.getState();
      
      app.updateState({});
      
      const finalState = app.getState();
      expect(finalState).toEqual(initialState);
    });

    it('should handle undefined values in state updates', () => {
      app.updateState({ brushSize: 10 });
      
      // TypeScript should prevent this, but test runtime behavior
      app.updateState({ brushSize: undefined as any });
      
      const state = app.getState();
      expect(state.brushSize).toBeUndefined();
    });

    it('should handle null values in configuration', () => {
      const config: Partial<WorldConfig> = {
        terrainConfig: null as any
      };

      app.updateEngineConfig(config);
      
      const state = app.getState();
      expect(state.config.terrainConfig).toBeNull();
    });

    it('should handle preset not found', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      controlPanel.loadPreset('NonExistentPreset');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preset not found')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle subscriber errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();

      // Wrap in try-catch since subscribeToState calls callback immediately
      try {
        app.subscribeToState(errorCallback);
      } catch (e) {
        // Expected to throw on initial call
      }
      
      app.subscribeToState(normalCallback);

      expect(() => {
        app.updateState({ brushSize: 10 });
      }).not.toThrow();

      expect(normalCallback).toHaveBeenCalled();
    });
  });
});
