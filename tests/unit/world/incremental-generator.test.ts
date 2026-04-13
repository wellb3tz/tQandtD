import { describe, it, expect, beforeEach } from 'vitest';
import { IncrementalGenerator } from '../../../src/world/incremental-generator';
import { GenerationStage, type IncrementalConfig } from '../../../src/world/chunk';
import type { WorldConfig } from '../../../src/world/chunk-manager';
import { BiomeType, ResourceType, StructureType } from '../../../src/world/chunk';
import { TerrainGenerator } from '../../../src/gen/terrain';
import { BiomeSystem } from '../../../src/world/biome';
import { RiverGenerator } from '../../../src/gen/rivers';
import { ResourceGenerator } from '../../../src/gen/resources';
import { StructurePlacer } from '../../../src/gen/structures';

describe('IncrementalGenerator', () => {
  let config: IncrementalConfig;
  let worldConfig: WorldConfig;
  let terrainGenerator: TerrainGenerator;
  let biomeSystem: BiomeSystem;
  let riverGenerator: RiverGenerator;
  let resourceGenerator: ResourceGenerator;
  let structurePlacer: StructurePlacer;

  beforeEach(() => {
    config = {
      timeBudgetMs: 16,
      enabled: true,
    };

    worldConfig = {
      seed: 12345,
      chunkSize: 32,
      terrainConfig: {
        baseScale: 0.01,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        warpStrength: 30,
        heightMultiplier: 1.0,
      },
      biomeConfig: {
        temperatureScale: 0.005,
        moistureScale: 0.005,
        blendRadius: 5,
      },
      resourceConfig: {
        types: [],
        clusterScale: 20,
        densityThreshold: 0.6,
      },
      structureConfig: {
        types: [],
        minDistance: 10,
        maxAttempts: 30,
      },
      riverConfig: {
        sourceElevation: 0.7,
        minFlowLength: 10,
        flowWidth: 2,
      },
    };

    // Initialize generators
    terrainGenerator = new TerrainGenerator(worldConfig.terrainConfig);
    biomeSystem = new BiomeSystem(worldConfig.seed, worldConfig.biomeConfig);
    riverGenerator = new RiverGenerator(worldConfig.riverConfig);
    resourceGenerator = new ResourceGenerator(worldConfig.resourceConfig);
    structurePlacer = new StructurePlacer(worldConfig.structureConfig);
  });

  // Helper function to create generator with default dependencies
  function createGenerator(cfg: IncrementalConfig = config): IncrementalGenerator {
    return new IncrementalGenerator(
      cfg,
      worldConfig,
      terrainGenerator,
      biomeSystem,
      riverGenerator,
      resourceGenerator,
      structurePlacer
    );
  }

  describe('constructor', () => {
    it('should create IncrementalGenerator with valid configuration', () => {
      const generator = createGenerator();
      expect(generator).toBeDefined();
    });

    it('should accept configuration with different time budgets', () => {
      const customConfig: IncrementalConfig = {
        timeBudgetMs: 32,
        enabled: true,
      };
      const generator = createGenerator(customConfig);
      expect(generator).toBeDefined();
    });

    it('should accept configuration with disabled incremental generation', () => {
      const customConfig: IncrementalConfig = {
        timeBudgetMs: 16,
        enabled: false,
      };
      const generator = createGenerator(customConfig);
      expect(generator).toBeDefined();
    });
  });

  describe('startGeneration', () => {
    it('should start generation for a chunk', () => {
      const generator = createGenerator();
      const partial = generator.startGeneration(0, 0);

      expect(partial).toBeDefined();
      expect(partial.x).toBe(0);
      expect(partial.y).toBe(0);
      expect(partial.stage).toBe(GenerationStage.TERRAIN);
      expect(partial.data).toBeDefined();
      expect(partial.data.x).toBe(0);
      expect(partial.data.y).toBe(0);
      expect(partial.data.size).toBe(32);
    });

    it('should start generation for chunks at different coordinates', () => {
      const generator = createGenerator();
      const partial1 = generator.startGeneration(5, 10);
      const partial2 = generator.startGeneration(-3, 7);

      expect(partial1.x).toBe(5);
      expect(partial1.y).toBe(10);
      expect(partial2.x).toBe(-3);
      expect(partial2.y).toBe(7);
    });

    it('should return existing partial data if generation already active', () => {
      const generator = createGenerator();
      const partial1 = generator.startGeneration(0, 0);
      const partial2 = generator.startGeneration(0, 0);

      expect(partial1).toBe(partial2);
    });

    it('should initialize partial data with correct chunk size', () => {
      const customWorldConfig = { ...worldConfig, chunkSize: 64 };
      const customTerrainGen = new TerrainGenerator(customWorldConfig.terrainConfig);
      const customBiomeSystem = new BiomeSystem(customWorldConfig.seed, customWorldConfig.biomeConfig);
      const customRiverGen = new RiverGenerator(customWorldConfig.riverConfig);
      const customResourceGen = new ResourceGenerator(customWorldConfig.resourceConfig);
      const customStructurePlacer = new StructurePlacer(customWorldConfig.structureConfig);
      
      const generator = new IncrementalGenerator(
        config,
        customWorldConfig,
        customTerrainGen,
        customBiomeSystem,
        customRiverGen,
        customResourceGen,
        customStructurePlacer
      );
      const partial = generator.startGeneration(0, 0);

      expect(partial.data.size).toBe(64);
    });

    it('should track multiple active generations', () => {
      const generator = createGenerator();
      const partial1 = generator.startGeneration(0, 0);
      const partial2 = generator.startGeneration(1, 1);
      const partial3 = generator.startGeneration(2, 2);

      expect(partial1.x).toBe(0);
      expect(partial2.x).toBe(1);
      expect(partial3.x).toBe(2);
    });
  });

  describe('getStage', () => {
    it('should return current generation stage', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);

      const stage = generator.getStage(0, 0);
      expect(stage).toBe(GenerationStage.TERRAIN);
    });

    it('should return undefined for non-existent generation', () => {
      const generator = createGenerator();
      const stage = generator.getStage(0, 0);

      expect(stage).toBeUndefined();
    });

    it('should track stage for multiple chunks', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);
      generator.startGeneration(1, 1);

      expect(generator.getStage(0, 0)).toBe(GenerationStage.TERRAIN);
      expect(generator.getStage(1, 1)).toBe(GenerationStage.TERRAIN);
    });
  });

  describe('cancelGeneration', () => {
    it('should cancel active generation', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);

      generator.cancelGeneration(0, 0);
      const stage = generator.getStage(0, 0);

      expect(stage).toBeUndefined();
    });

    it('should not throw when canceling non-existent generation', () => {
      const generator = createGenerator();
      expect(() => generator.cancelGeneration(0, 0)).not.toThrow();
    });

    it('should only cancel specified chunk', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);
      generator.startGeneration(1, 1);

      generator.cancelGeneration(0, 0);

      expect(generator.getStage(0, 0)).toBeUndefined();
      expect(generator.getStage(1, 1)).toBe(GenerationStage.TERRAIN);
    });
  });

  describe('continueGeneration', () => {
    it('should throw error if no active generation exists', () => {
      const generator = createGenerator();
      expect(() => generator.continueGeneration(0, 0)).toThrow(
        'No active generation for chunk (0, 0)'
      );
    });

    it('should progress through generation stages', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);

      // Stage 1: TERRAIN
      expect(generator.getStage(0, 0)).toBe(GenerationStage.TERRAIN);
      let complete = generator.continueGeneration(0, 0);
      expect(complete).toBe(false);

      // Stage 2: BIOMES
      expect(generator.getStage(0, 0)).toBe(GenerationStage.BIOMES);
      // Biomes stage might take multiple calls if time budget is exceeded
      while (generator.getStage(0, 0) === GenerationStage.BIOMES) {
        complete = generator.continueGeneration(0, 0);
        if (complete) break;
      }
      expect(complete).toBe(false);

      // Stage 3: RIVERS
      expect(generator.getStage(0, 0)).toBe(GenerationStage.RIVERS);
      complete = generator.continueGeneration(0, 0);
      expect(complete).toBe(false);

      // Stage 4: RESOURCES
      expect(generator.getStage(0, 0)).toBe(GenerationStage.RESOURCES);
      complete = generator.continueGeneration(0, 0);
      expect(complete).toBe(false);

      // Stage 5: STRUCTURES
      expect(generator.getStage(0, 0)).toBe(GenerationStage.STRUCTURES);
      complete = generator.continueGeneration(0, 0);
      expect(complete).toBe(true);

      // Stage 6: COMPLETE
      expect(generator.getStage(0, 0)).toBe(GenerationStage.COMPLETE);
    });

    it('should return true when generation is already complete', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);

      // Complete all stages
      for (let i = 0; i < 5; i++) {
        generator.continueGeneration(0, 0);
      }

      // Should return true on subsequent calls
      expect(generator.continueGeneration(0, 0)).toBe(true);
      expect(generator.continueGeneration(0, 0)).toBe(true);
    });

    it('should populate partial data during generation', () => {
      const generator = createGenerator();
      const partial = generator.startGeneration(0, 0);

      // After terrain stage
      generator.continueGeneration(0, 0);
      expect(partial.data.heightmap).toBeDefined();
      expect(partial.data.heightmap?.length).toBe(33 * 33);

      // After biomes stage (may take multiple calls)
      while (partial.stage === GenerationStage.BIOMES) {
        generator.continueGeneration(0, 0);
      }
      expect(partial.data.biomeMap).toBeDefined();
      expect(partial.data.biomeWeights).toBeDefined();

      // After rivers stage
      generator.continueGeneration(0, 0);
      expect(partial.data.rivers).toBeDefined();

      // After resources stage
      generator.continueGeneration(0, 0);
      expect(partial.data.resources).toBeDefined();

      // After structures stage
      generator.continueGeneration(0, 0);
      expect(partial.data.structures).toBeDefined();
    });

    it('should handle multiple chunks independently', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);
      generator.startGeneration(1, 1);

      // Progress first chunk
      generator.continueGeneration(0, 0);
      expect(generator.getStage(0, 0)).toBe(GenerationStage.BIOMES);
      expect(generator.getStage(1, 1)).toBe(GenerationStage.TERRAIN);

      // Progress second chunk
      generator.continueGeneration(1, 1);
      expect(generator.getStage(0, 0)).toBe(GenerationStage.BIOMES);
      expect(generator.getStage(1, 1)).toBe(GenerationStage.BIOMES);
    });
  });

  describe('stage execution', () => {
    it('should complete terrain stage within time budget', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);

      const startTime = performance.now();
      generator.continueGeneration(0, 0);
      const elapsed = performance.now() - startTime;

      // Should complete quickly (well within 16ms budget)
      expect(elapsed).toBeLessThan(100);
    });

    it('should respect time budget configuration', () => {
      const fastConfig: IncrementalConfig = {
        timeBudgetMs: 1,
        enabled: true,
      };
      const generator = createGenerator(fastConfig);
      generator.startGeneration(0, 0);

      // Should still complete stages even with very small budget
      expect(() => generator.continueGeneration(0, 0)).not.toThrow();
    });

    it('should handle zero time budget', () => {
      const zeroConfig: IncrementalConfig = {
        timeBudgetMs: 0,
        enabled: true,
      };
      const generator = createGenerator(zeroConfig);
      generator.startGeneration(0, 0);

      // Should still complete stages
      expect(() => generator.continueGeneration(0, 0)).not.toThrow();
    });

    it('should track time budget for each stage', () => {
      const generator = createGenerator();
      const partial = generator.startGeneration(0, 0);

      // Execute each stage and verify it respects time budget
      const stages = [
        GenerationStage.TERRAIN,
        GenerationStage.BIOMES,
        GenerationStage.RIVERS,
        GenerationStage.RESOURCES,
        GenerationStage.STRUCTURES,
      ];

      for (const expectedStage of stages) {
        expect(partial.stage).toBe(expectedStage);
        
        const startTime = performance.now();
        // Keep calling until stage progresses (may take multiple calls for biomes)
        const currentStage = partial.stage;
        while (partial.stage === currentStage && partial.stage !== GenerationStage.COMPLETE) {
          generator.continueGeneration(0, 0);
        }
        const elapsed = performance.now() - startTime;

        // Each stage should complete reasonably quickly
        expect(elapsed).toBeLessThan(100);
      }
    });

    it('should enforce time budget with large time budget value', () => {
      const largeConfig: IncrementalConfig = {
        timeBudgetMs: 1000,
        enabled: true,
      };
      const generator = createGenerator(largeConfig);
      generator.startGeneration(0, 0);

      // Should complete stages without issues
      let complete = false;
      let iterations = 0;
      while (!complete && iterations < 10) {
        complete = generator.continueGeneration(0, 0);
        iterations++;
      }

      expect(complete).toBe(true);
    });

    it('should measure time budget correctly for terrain stage', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);

      const startTime = performance.now();
      const result = generator.continueGeneration(0, 0);
      const elapsed = performance.now() - startTime;

      // Terrain stage should complete within budget
      expect(result).toBe(false); // Not complete yet, more stages to go
      expect(elapsed).toBeLessThan(config.timeBudgetMs * 10); // Allow some overhead
    });

    it('should measure time budget correctly for biomes stage', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);

      // Complete terrain stage
      generator.continueGeneration(0, 0);

      // Measure biomes stage
      const startTime = performance.now();
      const result = generator.continueGeneration(0, 0);
      const elapsed = performance.now() - startTime;

      expect(result).toBe(false); // Not complete yet
      expect(elapsed).toBeLessThan(config.timeBudgetMs * 10); // Allow some overhead
    });

    it('should measure time budget correctly for rivers stage', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);

      // Complete terrain and biomes stages
      generator.continueGeneration(0, 0);
      generator.continueGeneration(0, 0);

      // Measure rivers stage
      const startTime = performance.now();
      const result = generator.continueGeneration(0, 0);
      const elapsed = performance.now() - startTime;

      expect(result).toBe(false); // Not complete yet
      expect(elapsed).toBeLessThan(config.timeBudgetMs * 10); // Allow some overhead
    });

    it('should measure time budget correctly for resources stage', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);

      // Complete terrain, biomes, and rivers stages
      generator.continueGeneration(0, 0);
      generator.continueGeneration(0, 0);
      generator.continueGeneration(0, 0);

      // Measure resources stage
      const startTime = performance.now();
      const result = generator.continueGeneration(0, 0);
      const elapsed = performance.now() - startTime;

      expect(result).toBe(false); // Not complete yet
      expect(elapsed).toBeLessThan(config.timeBudgetMs * 10); // Allow some overhead
    });

    it('should measure time budget correctly for structures stage', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);

      // Complete all previous stages
      generator.continueGeneration(0, 0);
      generator.continueGeneration(0, 0);
      generator.continueGeneration(0, 0);
      generator.continueGeneration(0, 0);

      // Measure structures stage
      const startTime = performance.now();
      const result = generator.continueGeneration(0, 0);
      const elapsed = performance.now() - startTime;

      expect(result).toBe(true); // Should be complete now
      expect(elapsed).toBeLessThan(config.timeBudgetMs * 10); // Allow some overhead
    });
  });

  describe('edge cases', () => {
    it('should handle negative chunk coordinates', () => {
      const generator = createGenerator();
      const partial = generator.startGeneration(-5, -10);

      expect(partial.x).toBe(-5);
      expect(partial.y).toBe(-10);
      expect(generator.getStage(-5, -10)).toBe(GenerationStage.TERRAIN);
    });

    it('should handle large chunk coordinates', () => {
      const generator = createGenerator();
      const partial = generator.startGeneration(1000000, 1000000);

      expect(partial.x).toBe(1000000);
      expect(partial.y).toBe(1000000);
    });

    it('should handle very small chunk size', () => {
      const smallWorldConfig = { ...worldConfig, chunkSize: 4 };
      const smallTerrainGen = new TerrainGenerator(smallWorldConfig.terrainConfig);
      const smallBiomeSystem = new BiomeSystem(smallWorldConfig.seed, smallWorldConfig.biomeConfig);
      const smallRiverGen = new RiverGenerator(smallWorldConfig.riverConfig);
      const smallResourceGen = new ResourceGenerator(smallWorldConfig.resourceConfig);
      const smallStructurePlacer = new StructurePlacer(smallWorldConfig.structureConfig);
      
      const generator = new IncrementalGenerator(
        config,
        smallWorldConfig,
        smallTerrainGen,
        smallBiomeSystem,
        smallRiverGen,
        smallResourceGen,
        smallStructurePlacer
      );
      const partial = generator.startGeneration(0, 0);

      generator.continueGeneration(0, 0);
      expect(partial.data.heightmap?.length).toBe(5 * 5);
    });

    it('should handle very large chunk size', () => {
      const largeWorldConfig = { ...worldConfig, chunkSize: 256 };
      const largeTerrainGen = new TerrainGenerator(largeWorldConfig.terrainConfig);
      const largeBiomeSystem = new BiomeSystem(largeWorldConfig.seed, largeWorldConfig.biomeConfig);
      const largeRiverGen = new RiverGenerator(largeWorldConfig.riverConfig);
      const largeResourceGen = new ResourceGenerator(largeWorldConfig.resourceConfig);
      const largeStructurePlacer = new StructurePlacer(largeWorldConfig.structureConfig);
      
      const generator = new IncrementalGenerator(
        config,
        largeWorldConfig,
        largeTerrainGen,
        largeBiomeSystem,
        largeRiverGen,
        largeResourceGen,
        largeStructurePlacer
      );
      const partial = generator.startGeneration(0, 0);

      generator.continueGeneration(0, 0);
      expect(partial.data.heightmap?.length).toBe(257 * 257);
    });
  });

  describe('generation lifecycle', () => {
    it('should allow restarting generation after cancellation', () => {
      const generator = createGenerator();
      generator.startGeneration(0, 0);
      generator.continueGeneration(0, 0);

      generator.cancelGeneration(0, 0);
      const partial = generator.startGeneration(0, 0);

      expect(partial.stage).toBe(GenerationStage.TERRAIN);
    });

    it('should maintain separate state for different chunks', () => {
      const generator = createGenerator();
      const partial1 = generator.startGeneration(0, 0);
      const partial2 = generator.startGeneration(1, 1);

      // Progress first chunk to BIOMES
      generator.continueGeneration(0, 0);

      // Progress second chunk to RIVERS
      generator.continueGeneration(1, 1);
      generator.continueGeneration(1, 1);

      expect(partial1.stage).toBe(GenerationStage.BIOMES);
      expect(partial2.stage).toBe(GenerationStage.RIVERS);
    });

    it('should complete full generation cycle', () => {
      const generator = createGenerator();
      const partial = generator.startGeneration(0, 0);

      // Complete all stages
      let complete = false;
      let iterations = 0;
      const maxIterations = 10;

      while (!complete && iterations < maxIterations) {
        complete = generator.continueGeneration(0, 0);
        iterations++;
      }

      expect(complete).toBe(true);
      expect(partial.stage).toBe(GenerationStage.COMPLETE);
      expect(partial.data.heightmap).toBeDefined();
      expect(partial.data.biomeMap).toBeDefined();
      expect(partial.data.rivers).toBeDefined();
      expect(partial.data.resources).toBeDefined();
      expect(partial.data.structures).toBeDefined();
    });

    it('should allow accessing partial data at each stage', () => {
      const generator = createGenerator();
      const partial = generator.startGeneration(0, 0);

      // Stage 1: TERRAIN - only heightmap should be available
      expect(partial.stage).toBe(GenerationStage.TERRAIN);
      expect(partial.data.heightmap).toBeUndefined();
      generator.continueGeneration(0, 0);
      expect(partial.data.heightmap).toBeDefined();
      expect(partial.data.biomeMap).toBeUndefined();

      // Stage 2: BIOMES - heightmap and biomes should be available
      expect(partial.stage).toBe(GenerationStage.BIOMES);
      generator.continueGeneration(0, 0);
      expect(partial.data.heightmap).toBeDefined();
      expect(partial.data.biomeMap).toBeDefined();
      expect(partial.data.rivers).toBeUndefined();

      // Stage 3: RIVERS - heightmap, biomes, and rivers should be available
      expect(partial.stage).toBe(GenerationStage.RIVERS);
      generator.continueGeneration(0, 0);
      expect(partial.data.heightmap).toBeDefined();
      expect(partial.data.biomeMap).toBeDefined();
      expect(partial.data.rivers).toBeDefined();
      expect(partial.data.resources).toBeUndefined();

      // Stage 4: RESOURCES - all except structures should be available
      expect(partial.stage).toBe(GenerationStage.RESOURCES);
      generator.continueGeneration(0, 0);
      expect(partial.data.heightmap).toBeDefined();
      expect(partial.data.biomeMap).toBeDefined();
      expect(partial.data.rivers).toBeDefined();
      expect(partial.data.resources).toBeDefined();
      expect(partial.data.structures).toBeUndefined();

      // Stage 5: STRUCTURES - all data should be available
      expect(partial.stage).toBe(GenerationStage.STRUCTURES);
      generator.continueGeneration(0, 0);
      expect(partial.data.heightmap).toBeDefined();
      expect(partial.data.biomeMap).toBeDefined();
      expect(partial.data.rivers).toBeDefined();
      expect(partial.data.resources).toBeDefined();
      expect(partial.data.structures).toBeDefined();

      // Stage 6: COMPLETE
      expect(partial.stage).toBe(GenerationStage.COMPLETE);
    });

    it('should preserve data from previous stages', () => {
      const generator = createGenerator();
      const partial = generator.startGeneration(0, 0);

      // Complete terrain stage
      generator.continueGeneration(0, 0);
      const heightmapRef = partial.data.heightmap;
      expect(heightmapRef).toBeDefined();

      // Complete biomes stage
      generator.continueGeneration(0, 0);
      // Heightmap should still be the same reference
      expect(partial.data.heightmap).toBe(heightmapRef);
      const biomeMapRef = partial.data.biomeMap;
      expect(biomeMapRef).toBeDefined();

      // Complete rivers stage
      generator.continueGeneration(0, 0);
      // Previous data should still be preserved
      expect(partial.data.heightmap).toBe(heightmapRef);
      expect(partial.data.biomeMap).toBe(biomeMapRef);

      // Complete resources stage
      generator.continueGeneration(0, 0);
      expect(partial.data.heightmap).toBe(heightmapRef);
      expect(partial.data.biomeMap).toBe(biomeMapRef);

      // Complete structures stage
      generator.continueGeneration(0, 0);
      expect(partial.data.heightmap).toBe(heightmapRef);
      expect(partial.data.biomeMap).toBe(biomeMapRef);
    });

    it('should handle cancellation at different stages', () => {
      const generator = createGenerator();

      // Cancel at TERRAIN stage
      generator.startGeneration(0, 0);
      expect(generator.getStage(0, 0)).toBe(GenerationStage.TERRAIN);
      generator.cancelGeneration(0, 0);
      expect(generator.getStage(0, 0)).toBeUndefined();

      // Cancel at BIOMES stage
      generator.startGeneration(1, 1);
      generator.continueGeneration(1, 1);
      expect(generator.getStage(1, 1)).toBe(GenerationStage.BIOMES);
      generator.cancelGeneration(1, 1);
      expect(generator.getStage(1, 1)).toBeUndefined();

      // Cancel at RIVERS stage
      generator.startGeneration(2, 2);
      generator.continueGeneration(2, 2);
      generator.continueGeneration(2, 2);
      expect(generator.getStage(2, 2)).toBe(GenerationStage.RIVERS);
      generator.cancelGeneration(2, 2);
      expect(generator.getStage(2, 2)).toBeUndefined();
    });

    it('should handle multiple concurrent generations', () => {
      const generator = createGenerator();
      const chunks = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 4 },
      ];

      // Start all generations
      const partials = chunks.map(c => generator.startGeneration(c.x, c.y));

      // Progress each chunk to different stages
      // Note: biomes stage may take multiple calls
      for (let i = 0; i < chunks.length; i++) {
        for (let j = 0; j <= i; j++) {
          const currentStage = partials[i].stage;
          generator.continueGeneration(chunks[i].x, chunks[i].y);
          // If biomes stage didn't complete, keep calling
          if (currentStage === GenerationStage.BIOMES && partials[i].stage === GenerationStage.BIOMES) {
            while (partials[i].stage === GenerationStage.BIOMES) {
              generator.continueGeneration(chunks[i].x, chunks[i].y);
            }
          }
        }
      }

      // Verify each chunk progressed (may not be at exact expected stage due to biomes taking multiple calls)
      expect(partials[0].stage).toBeGreaterThanOrEqual(GenerationStage.BIOMES);
      expect(partials[1].stage).toBeGreaterThanOrEqual(GenerationStage.BIOMES);
      expect(partials[2].stage).toBeGreaterThanOrEqual(GenerationStage.RIVERS);
      expect(partials[3].stage).toBeGreaterThanOrEqual(GenerationStage.RESOURCES);
      expect(partials[4].stage).toBeGreaterThanOrEqual(GenerationStage.STRUCTURES);
    });

    it('should generate deterministic results across restarts', () => {
      const generator = createGenerator();

      // Generate chunk once
      const partial1 = generator.startGeneration(5, 5);
      let complete = false;
      while (!complete) {
        complete = generator.continueGeneration(5, 5);
      }
      const heightmap1 = partial1.data.heightmap!;
      const biomeMap1 = partial1.data.biomeMap!;

      // Cancel and regenerate
      generator.cancelGeneration(5, 5);
      const partial2 = generator.startGeneration(5, 5);
      complete = false;
      while (!complete) {
        complete = generator.continueGeneration(5, 5);
      }
      const heightmap2 = partial2.data.heightmap!;
      const biomeMap2 = partial2.data.biomeMap!;

      // Should have identical data
      expect(heightmap1.length).toBe(heightmap2.length);
      for (let i = 0; i < heightmap1.length; i++) {
        expect(heightmap1[i]).toBe(heightmap2[i]);
      }

      expect(biomeMap1.length).toBe(biomeMap2.length);
      for (let i = 0; i < biomeMap1.length; i++) {
        expect(biomeMap1[i]).toBe(biomeMap2[i]);
      }
    });
  });
});
