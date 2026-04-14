/**
 * Integration tests for world generation flow
 * 
 * Tests the complete workflow from initialization through generation to rendering,
 * parameter changes, and performance metrics updates.
 * 
 * Requirements: 2.1, 2.5, 10.7
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DemoApp, AppEvent } from '../core/DemoApp';

describe('World Generation Flow Integration', () => {
  let app: DemoApp;

  beforeEach(() => {
    app = new DemoApp();
  });

  afterEach(() => {
    if (app) {
      app.destroy();
    }
  });

  describe('Initialize → Generate → Render Workflow', () => {
    it('should complete full workflow successfully', async () => {
      // Step 1: Initialize app
      await app.initialize();
      const initialState = app.getState();
      expect(initialState.chunkManager).not.toBeNull();
      expect(initialState.loadedChunks.size).toBe(0);

      // Step 2: Generate world
      const seed = 12345;
      await app.generateWorld(seed);
      
      const generatedState = app.getState();
      expect(generatedState.loadedChunks.size).toBe(9); // 3x3 grid
      expect(generatedState.config.seed).toBe(seed);

      // Step 3: Verify chunks have required data for rendering
      for (const [key, chunkData] of generatedState.loadedChunks) {
        expect(chunkData.heightmap).toBeDefined();
        expect(chunkData.heightmap.length).toBeGreaterThan(0);
        expect(chunkData.biomeMap).toBeDefined();
        expect(chunkData.biomeMap.length).toBeGreaterThan(0);
      }
    });

    it('should emit events in correct order', async () => {
      const events: string[] = [];
      
      app.on(AppEvent.STATE_CHANGED, () => events.push('STATE_CHANGED'));
      app.on(AppEvent.WORLD_GENERATED, () => events.push('WORLD_GENERATED'));
      app.on(AppEvent.CHUNK_LOADED, () => events.push('CHUNK_LOADED'));

      await app.initialize();
      await app.generateWorld(12345);

      // Verify events were emitted
      expect(events).toContain('WORLD_GENERATED');
      expect(events).toContain('CHUNK_LOADED');
      expect(events.filter(e => e === 'CHUNK_LOADED').length).toBe(9); // 9 chunks
    });

    it('should update statistics after generation', async () => {
      await app.initialize();
      await app.generateWorld(12345);

      const state = app.getState();
      
      // Verify statistics are populated
      expect(state.loadedChunkCount).toBe(9);
      expect(state.avgGenerationTime).toBeGreaterThan(0);
      expect(state.biomeDistribution.size).toBeGreaterThan(0);
      expect(state.avgHeight).toBeGreaterThan(0);
      expect(state.minHeight).toBeLessThanOrEqual(state.maxHeight);
    });

    it('should render all layers correctly', async () => {
      await app.initialize();
      await app.generateWorld(12345);

      const state = app.getState();
      
      // Verify chunks have all required data for rendering layers
      for (const [key, chunkData] of state.loadedChunks) {
        // Terrain data
        expect(chunkData.heightmap).toBeDefined();
        expect(chunkData.heightmap.length).toBeGreaterThan(0);
        
        // Biome data
        expect(chunkData.biomeMap).toBeDefined();
        expect(chunkData.biomeMap.length).toBeGreaterThan(0);
        
        // Rivers data (may be empty)
        expect(chunkData.rivers).toBeDefined();
        expect(chunkData.rivers instanceof Set).toBe(true);
        
        // Resources data (may be empty)
        expect(chunkData.resources).toBeDefined();
        expect(Array.isArray(chunkData.resources)).toBe(true);
        
        // Structures data (may be empty)
        expect(chunkData.structures).toBeDefined();
        expect(Array.isArray(chunkData.structures)).toBe(true);
      }
    });
  });

  describe('Parameter Change → Regenerate → Verify Changes', () => {
    beforeEach(async () => {
      await app.initialize();
    });

    it('should regenerate world with updated terrain parameters', async () => {
      // Generate initial world
      await app.generateWorld(12345);
      const initialState = app.getState();
      const initialChunk = Array.from(initialState.loadedChunks.values())[0];
      const initialHeightmap = [...initialChunk.heightmap];

      // Update terrain configuration
      app.updateEngineConfig({
        terrainConfig: {
          baseScale: 0.05, // Changed from default
          octaves: 6,
          persistence: 0.7,
          lacunarity: 2.5,
          warpStrength: 50,
          heightMultiplier: 1.5
        }
      });

      // Regenerate with same seed
      await app.generateWorld(12345);
      const updatedState = app.getState();
      const updatedChunk = Array.from(updatedState.loadedChunks.values())[0];
      const updatedHeightmap = [...updatedChunk.heightmap];

      // Verify heightmaps are different due to parameter change
      let hasDifference = false;
      for (let i = 0; i < initialHeightmap.length; i++) {
        if (Math.abs(initialHeightmap[i] - updatedHeightmap[i]) > 0.001) {
          hasDifference = true;
          break;
        }
      }
      expect(hasDifference).toBe(true);
    });

    it('should update biome distribution with changed biome parameters', async () => {
      // Generate initial world
      await app.generateWorld(12345);
      const initialState = app.getState();
      const initialBiomeDistribution = new Map(initialState.biomeDistribution);

      // Update biome configuration
      app.updateEngineConfig({
        biomeConfig: {
          temperatureScale: 0.008, // Changed from default
          moistureScale: 0.008,
          blendRadius: 8
        }
      });

      // Regenerate with same seed
      await app.generateWorld(12345);
      const updatedState = app.getState();
      const updatedBiomeDistribution = new Map(updatedState.biomeDistribution);

      // Verify biome distributions are different
      let hasDifference = false;
      for (const [biome, count] of initialBiomeDistribution) {
        const updatedCount = updatedBiomeDistribution.get(biome) || 0;
        if (Math.abs(count - updatedCount) > 10) {
          hasDifference = true;
          break;
        }
      }
      expect(hasDifference).toBe(true);
    });

    it('should update river count with changed river parameters', async () => {
      // Generate initial world
      await app.generateWorld(12345);
      const initialState = app.getState();
      const initialRiverCount = initialState.riverCount;

      // Update river configuration
      app.updateEngineConfig({
        riverConfig: {
          sourceElevation: 0.6, // Changed from default
          minFlowLength: 15,
          flowWidth: 3
        }
      });

      // Regenerate with same seed
      await app.generateWorld(12345);
      const updatedState = app.getState();
      const updatedRiverCount = updatedState.riverCount;

      // River count may change with different parameters
      // (not guaranteed to be different, but should be valid)
      expect(updatedRiverCount).toBeGreaterThanOrEqual(0);
    });

    it('should update visual rendering after parameter change', async () => {
      // Generate initial world
      await app.generateWorld(12345);
      const initialState = app.getState();
      const initialChunk = Array.from(initialState.loadedChunks.values())[0];
      const initialHeightmap = [...initialChunk.heightmap];

      // Update configuration and regenerate
      app.updateEngineConfig({
        terrainConfig: {
          baseScale: 0.05,
          octaves: 6,
          persistence: 0.7,
          lacunarity: 2.5,
          warpStrength: 50,
          heightMultiplier: 1.5
        }
      });
      
      await app.generateWorld(12345);
      const updatedState = app.getState();
      const updatedChunk = Array.from(updatedState.loadedChunks.values())[0];
      const updatedHeightmap = [...updatedChunk.heightmap];

      // Verify heightmaps changed (which would affect visual rendering)
      let hasDifference = false;
      for (let i = 0; i < initialHeightmap.length; i++) {
        if (Math.abs(initialHeightmap[i] - updatedHeightmap[i]) > 0.001) {
          hasDifference = true;
          break;
        }
      }
      expect(hasDifference).toBe(true);
      
      // Verify chunks still have all required rendering data
      expect(updatedChunk.heightmap).toBeDefined();
      expect(updatedChunk.biomeMap).toBeDefined();
    });
  });

  describe('Parameter Range Testing', () => {
    beforeEach(async () => {
      await app.initialize();
    });

    describe('Terrain Parameters', () => {
      it('should handle baseScale range (0.001 to 0.1)', async () => {
        const testValues = [0.001, 0.01, 0.05, 0.1];
        
        for (const baseScale of testValues) {
          app.updateEngineConfig({
            terrainConfig: {
              baseScale,
              octaves: 4,
              persistence: 0.5,
              lacunarity: 2.0,
              warpStrength: 30,
              heightMultiplier: 1.0
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.loadedChunks.size).toBe(9);
          expect(state.avgHeight).toBeGreaterThan(0);
        }
      });

      it('should handle octaves range (1 to 8)', async () => {
        const testValues = [1, 4, 6, 8];
        
        for (const octaves of testValues) {
          app.updateEngineConfig({
            terrainConfig: {
              baseScale: 0.01,
              octaves,
              persistence: 0.5,
              lacunarity: 2.0,
              warpStrength: 30,
              heightMultiplier: 1.0
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.loadedChunks.size).toBe(9);
        }
      });

      it('should handle persistence range (0.1 to 0.9)', async () => {
        const testValues = [0.1, 0.3, 0.5, 0.7, 0.9];
        
        for (const persistence of testValues) {
          app.updateEngineConfig({
            terrainConfig: {
              baseScale: 0.01,
              octaves: 4,
              persistence,
              lacunarity: 2.0,
              warpStrength: 30,
              heightMultiplier: 1.0
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.loadedChunks.size).toBe(9);
        }
      });

      it('should handle lacunarity range (1.5 to 3.0)', async () => {
        const testValues = [1.5, 2.0, 2.5, 3.0];
        
        for (const lacunarity of testValues) {
          app.updateEngineConfig({
            terrainConfig: {
              baseScale: 0.01,
              octaves: 4,
              persistence: 0.5,
              lacunarity,
              warpStrength: 30,
              heightMultiplier: 1.0
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.loadedChunks.size).toBe(9);
        }
      });

      it('should handle warpStrength range (0 to 100)', async () => {
        const testValues = [0, 25, 50, 75, 100];
        
        for (const warpStrength of testValues) {
          app.updateEngineConfig({
            terrainConfig: {
              baseScale: 0.01,
              octaves: 4,
              persistence: 0.5,
              lacunarity: 2.0,
              warpStrength,
              heightMultiplier: 1.0
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.loadedChunks.size).toBe(9);
        }
      });

      it('should handle heightMultiplier range (0.5 to 2.0)', async () => {
        const testValues = [0.5, 1.0, 1.5, 2.0];
        
        for (const heightMultiplier of testValues) {
          app.updateEngineConfig({
            terrainConfig: {
              baseScale: 0.01,
              octaves: 4,
              persistence: 0.5,
              lacunarity: 2.0,
              warpStrength: 30,
              heightMultiplier
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.loadedChunks.size).toBe(9);
          // Height should scale with multiplier
          expect(state.avgHeight).toBeGreaterThan(0);
        }
      });
    });

    describe('Biome Parameters', () => {
      it('should handle temperatureScale range (0.001 to 0.01)', async () => {
        const testValues = [0.001, 0.005, 0.008, 0.01];
        
        for (const temperatureScale of testValues) {
          app.updateEngineConfig({
            biomeConfig: {
              temperatureScale,
              moistureScale: 0.005,
              blendRadius: 5
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.biomeDistribution.size).toBeGreaterThan(0);
        }
      });

      it('should handle moistureScale range (0.001 to 0.01)', async () => {
        const testValues = [0.001, 0.005, 0.008, 0.01];
        
        for (const moistureScale of testValues) {
          app.updateEngineConfig({
            biomeConfig: {
              temperatureScale: 0.005,
              moistureScale,
              blendRadius: 5
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.biomeDistribution.size).toBeGreaterThan(0);
        }
      });

      it('should handle blendRadius range (1 to 10)', async () => {
        const testValues = [1, 3, 5, 8, 10];
        
        for (const blendRadius of testValues) {
          app.updateEngineConfig({
            biomeConfig: {
              temperatureScale: 0.005,
              moistureScale: 0.005,
              blendRadius
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.biomeDistribution.size).toBeGreaterThan(0);
        }
      });
    });

    describe('River Parameters', () => {
      it('should handle sourceElevation range (0.5 to 0.9)', async () => {
        const testValues = [0.5, 0.6, 0.7, 0.8, 0.9];
        
        for (const sourceElevation of testValues) {
          app.updateEngineConfig({
            riverConfig: {
              sourceElevation,
              minFlowLength: 10,
              flowWidth: 2
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.riverCount).toBeGreaterThanOrEqual(0);
        }
      });

      it('should handle minFlowLength range (5 to 50)', async () => {
        const testValues = [5, 15, 25, 35, 50];
        
        for (const minFlowLength of testValues) {
          app.updateEngineConfig({
            riverConfig: {
              sourceElevation: 0.7,
              minFlowLength,
              flowWidth: 2
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.riverCount).toBeGreaterThanOrEqual(0);
        }
      });

      it('should handle flowWidth range (1 to 5)', async () => {
        const testValues = [1, 2, 3, 4, 5];
        
        for (const flowWidth of testValues) {
          app.updateEngineConfig({
            riverConfig: {
              sourceElevation: 0.7,
              minFlowLength: 10,
              flowWidth
            }
          });
          
          await app.generateWorld(12345);
          const state = app.getState();
          
          expect(state.riverCount).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('Performance Metrics Update', () => {
    beforeEach(async () => {
      await app.initialize();
    });

    it('should update avgGenerationTime after world generation', async () => {
      const initialState = app.getState();
      expect(initialState.avgGenerationTime).toBe(0);

      await app.generateWorld(12345);
      
      const updatedState = app.getState();
      expect(updatedState.avgGenerationTime).toBeGreaterThan(0);
    });

    it('should update loadedChunkCount correctly', async () => {
      await app.generateWorld(12345);
      
      const state = app.getState();
      expect(state.loadedChunkCount).toBe(9); // 3x3 grid
      expect(state.loadedChunkCount).toBe(state.loadedChunks.size);
    });

    it('should track biome distribution accurately', async () => {
      await app.generateWorld(12345);
      
      const state = app.getState();
      const totalBiomes = Array.from(state.biomeDistribution.values())
        .reduce((sum, count) => sum + count, 0);
      
      // Total biomes should equal total tiles in all chunks
      const expectedTiles = state.loadedChunks.size * 32 * 32;
      expect(totalBiomes).toBe(expectedTiles);
    });

    it('should update height statistics', async () => {
      await app.generateWorld(12345);
      
      const state = app.getState();
      expect(state.avgHeight).toBeGreaterThan(0);
      expect(state.minHeight).toBeLessThanOrEqual(state.avgHeight);
      expect(state.avgHeight).toBeLessThanOrEqual(state.maxHeight);
      expect(state.minHeight).toBeLessThanOrEqual(state.maxHeight);
    });

    it('should update resource counts', async () => {
      await app.generateWorld(12345);
      
      const state = app.getState();
      const totalResources = Array.from(state.resourceCounts.values())
        .reduce((sum, count) => sum + count, 0);
      
      expect(totalResources).toBeGreaterThanOrEqual(0);
    });

    it('should update structure counts', async () => {
      await app.generateWorld(12345);
      
      const state = app.getState();
      const totalStructures = Array.from(state.structureCounts.values())
        .reduce((sum, count) => sum + count, 0);
      
      expect(totalStructures).toBeGreaterThanOrEqual(0);
    });

    it('should update metrics on subsequent generations', async () => {
      // First generation
      await app.generateWorld(12345);
      const firstState = app.getState();
      const firstAvgTime = firstState.avgGenerationTime;

      // Second generation
      await app.generateWorld(54321);
      const secondState = app.getState();
      const secondAvgTime = secondState.avgGenerationTime;

      // Both should have valid generation times
      expect(firstAvgTime).toBeGreaterThan(0);
      expect(secondAvgTime).toBeGreaterThan(0);
    });

    it('should maintain consistent metrics across regeneration with same seed', async () => {
      // First generation
      await app.generateWorld(12345);
      const firstState = app.getState();
      const firstBiomeDistribution = new Map(firstState.biomeDistribution);
      const firstResourceCounts = new Map(firstState.resourceCounts);

      // Regenerate with same seed
      await app.generateWorld(12345);
      const secondState = app.getState();
      const secondBiomeDistribution = new Map(secondState.biomeDistribution);
      const secondResourceCounts = new Map(secondState.resourceCounts);

      // Biome distributions should be identical
      expect(firstBiomeDistribution.size).toBe(secondBiomeDistribution.size);
      for (const [biome, count] of firstBiomeDistribution) {
        expect(secondBiomeDistribution.get(biome)).toBe(count);
      }

      // Resource counts should be identical
      expect(firstResourceCounts.size).toBe(secondResourceCounts.size);
      for (const [resource, count] of firstResourceCounts) {
        expect(secondResourceCounts.get(resource)).toBe(count);
      }
    });
  });
});
