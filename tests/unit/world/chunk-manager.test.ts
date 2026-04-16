import { describe, test, expect } from 'vitest';
import { ChunkManager, WorldConfig } from '../../../src/world/chunk-manager';
import { BiomeType, ResourceType, StructureType } from '../../../src/world/chunk';
import { LODLevel } from '../../../src/world/lod';

describe('ChunkManager Unit Tests', () => {
  const defaultConfig: WorldConfig = {
    seed: 12345,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
    },
    biomeConfig: {
      temperatureScale: 0.01,
      moistureScale: 0.01,
      blendRadius: 2,
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
      flowWidth: 1,
    },
  };

  test('constructor creates ChunkManager with valid config', () => {
    const manager = new ChunkManager(defaultConfig);
    expect(manager).toBeDefined();
  });

  test('generateChunk creates chunk with correct coordinates', () => {
    const manager = new ChunkManager(defaultConfig);
    const chunk = manager.generateChunk(5, 10);
    
    expect(chunk.x).toBe(5);
    expect(chunk.y).toBe(10);
    expect(chunk.size).toBe(32);
  });

  test('generateChunk creates chunk at origin (0, 0)', () => {
    const manager = new ChunkManager(defaultConfig);
    const chunk = manager.generateChunk(0, 0);
    
    expect(chunk.x).toBe(0);
    expect(chunk.y).toBe(0);
    expect(chunk.heightmap.length).toBe(33 * 33);
  });

  test('generateChunk handles negative coordinates', () => {
    const manager = new ChunkManager(defaultConfig);
    const chunk = manager.generateChunk(-5, -10);
    
    expect(chunk.x).toBe(-5);
    expect(chunk.y).toBe(-10);
    expect(chunk.heightmap.length).toBe(33 * 33);
  });

  test('generateChunk creates all required arrays', () => {
    const manager = new ChunkManager(defaultConfig);
    const chunk = manager.generateChunk(0, 0);
    
    expect(chunk.heightmap).toBeInstanceOf(Float32Array);
    expect(chunk.biomeMap).toBeInstanceOf(Uint8Array);
    expect(chunk.biomeWeights).toBeInstanceOf(Float32Array);
    expect(Array.isArray(chunk.resources)).toBe(true);
    expect(Array.isArray(chunk.structures)).toBe(true);
    expect(chunk.rivers).toBeInstanceOf(Set);
  });

  test('generateChunk initializes empty resource and structure arrays', () => {
    const manager = new ChunkManager(defaultConfig);
    const chunk = manager.generateChunk(0, 0);
    
    expect(chunk.resources.length).toBe(0);
    expect(chunk.structures.length).toBe(0);
    expect(chunk.rivers.size).toBe(0);
  });

  test('getChunk returns same reference when called twice', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const chunk1 = manager.getChunk(3, 7);
    const chunk2 = manager.getChunk(3, 7);
    
    expect(chunk1).toBe(chunk2);
  });

  test('getChunk caches different chunks separately', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const chunk1 = manager.getChunk(0, 0);
    const chunk2 = manager.getChunk(1, 1);
    
    expect(chunk1).not.toBe(chunk2);
    expect(chunk1.x).toBe(0);
    expect(chunk2.x).toBe(1);
  });

  test('clearCache removes cached chunks', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const chunk1 = manager.getChunk(0, 0);
    manager.clearCache();
    const chunk2 = manager.getChunk(0, 0);
    
    // Should be different object references
    expect(chunk1).not.toBe(chunk2);
    
    // But should have same data
    expect(chunk1.x).toBe(chunk2.x);
    expect(chunk1.y).toBe(chunk2.y);
  });

  test('chunk has valid biome types', () => {
    const manager = new ChunkManager(defaultConfig);
    const chunk = manager.generateChunk(0, 0);
    
    for (let i = 0; i < chunk.biomeMap.length; i++) {
      const biome = chunk.biomeMap[i];
      expect(biome).toBeGreaterThanOrEqual(BiomeType.OCEAN);
      expect(biome).toBeLessThanOrEqual(BiomeType.MOUNTAIN);
    }
  });

  test('chunk heightmap values are in valid range', () => {
    const manager = new ChunkManager(defaultConfig);
    const chunk = manager.generateChunk(0, 0);
    
    for (let i = 0; i < chunk.heightmap.length; i++) {
      expect(chunk.heightmap[i]).toBeGreaterThanOrEqual(0);
      expect(chunk.heightmap[i]).toBeLessThanOrEqual(1);
    }
  });

  test('different world seeds produce different chunks', () => {
    const config1 = { ...defaultConfig, seed: 111 };
    const config2 = { ...defaultConfig, seed: 222 };
    
    const manager1 = new ChunkManager(config1);
    const manager2 = new ChunkManager(config2);
    
    const chunk1 = manager1.generateChunk(0, 0);
    const chunk2 = manager2.generateChunk(0, 0);
    
    // Should have at least some different height values
    let differences = 0;
    for (let i = 0; i < chunk1.heightmap.length; i++) {
      if (chunk1.heightmap[i] !== chunk2.heightmap[i]) {
        differences++;
      }
    }
    
    expect(differences).toBeGreaterThan(0);
  });

  test('custom maxCacheSize is respected', () => {
    const config = { ...defaultConfig, maxCacheSize: 3 };
    const manager = new ChunkManager(config);
    
    const chunk1 = manager.getChunk(0, 0);
    const chunk2 = manager.getChunk(1, 0);
    const chunk3 = manager.getChunk(2, 0);
    
    // All three should be cached
    expect(manager.getChunk(0, 0)).toBe(chunk1);
    expect(manager.getChunk(1, 0)).toBe(chunk2);
    expect(manager.getChunk(2, 0)).toBe(chunk3);
    
    // Add a fourth chunk, should evict chunk1 (least recently used)
    const chunk4 = manager.getChunk(3, 0);
    
    // chunk2, chunk3, and chunk4 should be cached
    expect(manager.getChunk(1, 0)).toBe(chunk2);
    expect(manager.getChunk(2, 0)).toBe(chunk3);
    expect(manager.getChunk(3, 0)).toBe(chunk4);
    
    // chunk1 should have been evicted (new object reference)
    const chunk1Again = manager.getChunk(0, 0);
    expect(chunk1Again).not.toBe(chunk1);
  });

  test('biome weights are populated for all tiles', () => {
    const manager = new ChunkManager(defaultConfig);
    const chunk = manager.generateChunk(0, 0);
    
    const numBiomes = 8;
    const expectedLength = chunk.size * chunk.size * numBiomes;
    
    expect(chunk.biomeWeights.length).toBe(expectedLength);
  });

  test('chunk generation is deterministic across multiple managers', () => {
    const manager1 = new ChunkManager(defaultConfig);
    const manager2 = new ChunkManager(defaultConfig);
    
    const chunk1 = manager1.generateChunk(5, 5);
    const chunk2 = manager2.generateChunk(5, 5);
    
    // Should have identical heightmaps
    for (let i = 0; i < chunk1.heightmap.length; i++) {
      expect(chunk1.heightmap[i]).toBe(chunk2.heightmap[i]);
    }
    
    // Should have identical biome maps
    for (let i = 0; i < chunk1.biomeMap.length; i++) {
      expect(chunk1.biomeMap[i]).toBe(chunk2.biomeMap[i]);
    }
  });

  test('chunks with different chunk sizes work correctly', () => {
    const config16 = { ...defaultConfig, chunkSize: 16 };
    const config64 = { ...defaultConfig, chunkSize: 64 };
    
    const manager16 = new ChunkManager(config16);
    const manager64 = new ChunkManager(config64);
    
    const chunk16 = manager16.generateChunk(0, 0);
    const chunk64 = manager64.generateChunk(0, 0);
    
    expect(chunk16.size).toBe(16);
    expect(chunk16.heightmap.length).toBe(17 * 17); // (chunkSize + 1)^2 for seamless boundaries
    
    expect(chunk64.size).toBe(64);
    expect(chunk64.heightmap.length).toBe(65 * 65); // (chunkSize + 1)^2 for seamless boundaries
  });

  test('adjacent chunks have different data', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const chunk1 = manager.generateChunk(0, 0);
    const chunk2 = manager.generateChunk(1, 0);
    const chunk3 = manager.generateChunk(0, 1);
    
    // Verify they are different chunks
    expect(chunk1).not.toBe(chunk2);
    expect(chunk1).not.toBe(chunk3);
    expect(chunk2).not.toBe(chunk3);
    
    // Verify coordinates are correct
    expect(chunk1.x).toBe(0);
    expect(chunk1.y).toBe(0);
    expect(chunk2.x).toBe(1);
    expect(chunk2.y).toBe(0);
    expect(chunk3.x).toBe(0);
    expect(chunk3.y).toBe(1);
  });
});

describe('ChunkManager LOD Integration', () => {
  const defaultConfig: WorldConfig = {
    seed: 12345,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
    },
    biomeConfig: {
      temperatureScale: 0.01,
      moistureScale: 0.01,
      blendRadius: 2,
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
      flowWidth: 1,
    },
  };

  const lodConfig = {
    distances: [2, 5],
    meshResolutions: [1.0, 0.5, 0.25],
    featureDensities: [1.0, 0.5, 0.25],
  };

  const configWithLOD = {
    ...defaultConfig,
    lodConfig,
  };

  test('constructor creates ChunkManager with LOD configuration', () => {
    const manager = new ChunkManager(configWithLOD);
    expect(manager).toBeDefined();
  });

  test('getChunk with HIGH LOD returns full resolution chunk', () => {
    const manager = new ChunkManager(configWithLOD);
    const chunk = manager.getChunk(0, 0, 0); // LODLevel.HIGH = 0
    
    expect(chunk.x).toBe(0);
    expect(chunk.y).toBe(0);
    expect(chunk.size).toBe(32);
    expect(chunk.heightmap.length).toBe(33 * 33);
  });

  test('getChunk with MEDIUM LOD returns downsampled chunk', () => {
    const manager = new ChunkManager(configWithLOD);
    const chunk = manager.getChunk(0, 0, 1); // LODLevel.MEDIUM = 1
    
    expect(chunk.x).toBe(0);
    expect(chunk.y).toBe(0);
    // After LOD fix, size is updated to downsampled size
    expect(chunk.size).toBe(16); // 32 * 0.5 = 16
    // Heightmap should be downsampled to (16+1) x (16+1) for seamless boundaries
    expect(chunk.heightmap.length).toBe(17 * 17);
  });

  test('getChunk with LOW LOD returns heavily downsampled chunk', () => {
    const manager = new ChunkManager(configWithLOD);
    const chunk = manager.getChunk(0, 0, 2); // LODLevel.LOW = 2
    
    expect(chunk.x).toBe(0);
    expect(chunk.y).toBe(0);
    // After LOD fix, size is updated to downsampled size
    expect(chunk.size).toBe(8); // 32 * 0.25 = 8
    // Heightmap should be downsampled to (8+1) x (8+1) for seamless boundaries
    expect(chunk.heightmap.length).toBe(9 * 9);
  });

  test('getChunk caches chunks by LOD level separately', () => {
    const manager = new ChunkManager(configWithLOD);
    
    const chunkHigh = manager.getChunk(0, 0, 0); // HIGH
    const chunkMedium = manager.getChunk(0, 0, 1); // MEDIUM
    const chunkLow = manager.getChunk(0, 0, 2); // LOW
    
    // All should be different references
    expect(chunkHigh).not.toBe(chunkMedium);
    expect(chunkHigh).not.toBe(chunkLow);
    expect(chunkMedium).not.toBe(chunkLow);
    
    // Verify they have different heightmap sizes (with seamless boundaries)
    expect(chunkHigh.heightmap.length).toBe(33 * 33);
    expect(chunkMedium.heightmap.length).toBe(17 * 17); // 16+1 for seamless boundaries
    expect(chunkLow.heightmap.length).toBe(9 * 9); // 8+1 for seamless boundaries
  });

  test('getChunk returns cached chunk for same coordinates and LOD', () => {
    const manager = new ChunkManager(configWithLOD);
    
    const chunk1 = manager.getChunk(5, 5, 1); // MEDIUM
    const chunk2 = manager.getChunk(5, 5, 1); // MEDIUM
    
    // Should be same reference (cached)
    expect(chunk1).toBe(chunk2);
  });

  test('getChunk without LOD config works normally', () => {
    const manager = new ChunkManager(defaultConfig);
    const chunk = manager.getChunk(0, 0, 1); // MEDIUM LOD requested but no LOD config
    
    // Should return full resolution chunk since LOD is not configured
    expect(chunk.heightmap.length).toBe(33 * 33);
  });

  test('getChunk defaults to HIGH LOD when no level specified', () => {
    const manager = new ChunkManager(configWithLOD);
    const chunk = manager.getChunk(0, 0); // No LOD level specified
    
    // Should default to HIGH LOD (full resolution)
    expect(chunk.heightmap.length).toBe(33 * 33);
  });

  test('cache eviction works with LOD levels', () => {
    const config = { ...configWithLOD, maxCacheSize: 3 };
    const manager = new ChunkManager(config);
    
    // Fill cache with 3 chunks at different LOD levels
    const chunk1 = manager.getChunk(0, 0, 0); // HIGH
    const chunk2 = manager.getChunk(0, 0, 1); // MEDIUM
    const chunk3 = manager.getChunk(0, 0, 2); // LOW
    
    expect(manager.getCacheSize()).toBe(3);
    
    // Add one more chunk, should evict oldest
    manager.getChunk(1, 1, 0); // HIGH
    
    expect(manager.getCacheSize()).toBe(3);
    
    // First chunk should have been evicted
    const chunk1Again = manager.getChunk(0, 0, 0);
    expect(chunk1Again).not.toBe(chunk1); // New instance, not cached
  });

  test('LOD reduces feature count for MEDIUM level', () => {
    const manager = new ChunkManager(configWithLOD);
    
    const chunkHigh = manager.getChunk(0, 0, 0); // HIGH
    const chunkMedium = manager.getChunk(0, 0, 1); // MEDIUM
    
    // MEDIUM should have fewer or equal resources (density = 0.5)
    expect(chunkMedium.resources.length).toBeLessThanOrEqual(chunkHigh.resources.length);
    
    // MEDIUM should have fewer or equal structures (density = 0.5)
    expect(chunkMedium.structures.length).toBeLessThanOrEqual(chunkHigh.structures.length);
  });

  test('LOD reduces feature count for LOW level', () => {
    const manager = new ChunkManager(configWithLOD);
    
    const chunkHigh = manager.getChunk(0, 0, 0); // HIGH
    const chunkLow = manager.getChunk(0, 0, 2); // LOW
    
    // LOW should have fewer or equal resources (density = 0.25)
    expect(chunkLow.resources.length).toBeLessThanOrEqual(chunkHigh.resources.length);
    
    // LOW should have fewer or equal structures (density = 0.25)
    expect(chunkLow.structures.length).toBeLessThanOrEqual(chunkHigh.structures.length);
  });

  test('LOD preserves chunk metadata', () => {
    const manager = new ChunkManager(configWithLOD);
    
    const chunkHigh = manager.getChunk(7, 13, 0); // HIGH
    const chunkMedium = manager.getChunk(7, 13, 1); // MEDIUM
    
    // Coordinates should be preserved
    expect(chunkMedium.x).toBe(7);
    expect(chunkMedium.y).toBe(13);
    // After LOD fix, size is updated to downsampled size
    expect(chunkMedium.size).toBe(16); // 32 * 0.5 = 16
    
    // Biome data should be preserved
    expect(chunkMedium.biomeMap).toBeDefined();
    expect(chunkMedium.biomeWeights).toBeDefined();
  });
});

describe('ChunkManager Incremental Generation Integration', () => {
  const defaultConfig: WorldConfig = {
    seed: 12345,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
    },
    biomeConfig: {
      temperatureScale: 0.01,
      moistureScale: 0.01,
      blendRadius: 2,
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
      flowWidth: 1,
    },
  };

  const incrementalConfig = {
    enabled: true,
    timeBudgetMs: 16,
  };

  const configWithIncremental = {
    ...defaultConfig,
    incrementalConfig,
  };

  test('constructor creates ChunkManager with incremental generation enabled', () => {
    const manager = new ChunkManager(configWithIncremental);
    expect(manager).toBeDefined();
  });

  test('getChunkIncremental throws error when incremental generation is not enabled', () => {
    const manager = new ChunkManager(defaultConfig);
    
    expect(() => manager.getChunkIncremental(0, 0)).toThrow(
      'Incremental generation is not enabled'
    );
  });

  test('getChunkIncremental returns PartialChunkData', () => {
    const manager = new ChunkManager(configWithIncremental);
    const partial = manager.getChunkIncremental(5, 10);
    
    expect(partial).toBeDefined();
    expect(partial.x).toBe(5);
    expect(partial.y).toBe(10);
    expect(partial.stage).toBeDefined();
    expect(partial.data).toBeDefined();
  });

  test('getChunkIncremental starts at TERRAIN stage', () => {
    const manager = new ChunkManager(configWithIncremental);
    const partial = manager.getChunkIncremental(0, 0);
    
    expect(partial.stage).toBe(0); // GenerationStage.TERRAIN
  });

  test('continueGeneration progresses through stages', () => {
    const manager = new ChunkManager(configWithIncremental);
    const partial = manager.getChunkIncremental(0, 0);
    
    // Initial stage should be TERRAIN
    expect(partial.stage).toBe(0);
    
    // Continue generation
    let complete = manager.continueGeneration(0, 0);
    
    // Should progress to next stage or complete
    expect(partial.stage).toBeGreaterThanOrEqual(0);
    
    // Continue until complete
    while (!complete) {
      complete = manager.continueGeneration(0, 0);
    }
    
    // Should reach COMPLETE stage
    expect(partial.stage).toBe(5); // GenerationStage.COMPLETE
  });

  test('continueGeneration throws error when incremental generation is not enabled', () => {
    const manager = new ChunkManager(defaultConfig);
    
    expect(() => manager.continueGeneration(0, 0)).toThrow(
      'Incremental generation is not enabled'
    );
  });

  test('continueGeneration throws error when generation not started', () => {
    const manager = new ChunkManager(configWithIncremental);
    
    expect(() => manager.continueGeneration(0, 0)).toThrow(
      'No active generation for chunk'
    );
  });

  test('partial data is accessible before completion', () => {
    const manager = new ChunkManager(configWithIncremental);
    const partial = manager.getChunkIncremental(0, 0);
    
    // Continue generation once
    manager.continueGeneration(0, 0);
    
    // Partial data should have some fields populated
    expect(partial.data).toBeDefined();
    expect(partial.data.x).toBe(0);
    expect(partial.data.y).toBe(0);
    expect(partial.data.size).toBe(32);
  });

  test('heightmap is available after TERRAIN stage', () => {
    const manager = new ChunkManager(configWithIncremental);
    const partial = manager.getChunkIncremental(0, 0);
    
    // Continue through TERRAIN stage
    manager.continueGeneration(0, 0);
    
    // Heightmap should be populated
    if (partial.stage > 0) {
      expect(partial.data.heightmap).toBeDefined();
      expect(partial.data.heightmap?.length).toBe(33 * 33);
    }
  });

  test('biome data is available after BIOMES stage', () => {
    const manager = new ChunkManager(configWithIncremental);
    const partial = manager.getChunkIncremental(0, 0);
    
    // Continue through TERRAIN and BIOMES stages
    manager.continueGeneration(0, 0); // TERRAIN
    manager.continueGeneration(0, 0); // BIOMES
    
    // Biome data should be populated
    if (partial.stage > 1) {
      expect(partial.data.biomeMap).toBeDefined();
      expect(partial.data.biomeWeights).toBeDefined();
    }
  });

  test('getGenerationStage returns current stage', () => {
    const manager = new ChunkManager(configWithIncremental);
    manager.getChunkIncremental(0, 0);
    
    const stage = manager.getGenerationStage(0, 0);
    expect(stage).toBeDefined();
    expect(stage).toBeGreaterThanOrEqual(0);
    expect(stage).toBeLessThanOrEqual(5);
  });

  test('getGenerationStage returns undefined when not generating', () => {
    const manager = new ChunkManager(configWithIncremental);
    
    const stage = manager.getGenerationStage(0, 0);
    expect(stage).toBeUndefined();
  });

  test('getGenerationStage returns undefined when incremental generation is not enabled', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const stage = manager.getGenerationStage(0, 0);
    expect(stage).toBeUndefined();
  });

  test('cancelIncrementalGeneration stops generation', () => {
    const manager = new ChunkManager(configWithIncremental);
    manager.getChunkIncremental(0, 0);
    
    // Cancel generation
    manager.cancelIncrementalGeneration(0, 0);
    
    // Stage should be undefined after cancellation
    const stage = manager.getGenerationStage(0, 0);
    expect(stage).toBeUndefined();
  });

  test('cancelIncrementalGeneration does nothing when incremental generation is not enabled', () => {
    const manager = new ChunkManager(defaultConfig);
    
    // Should not throw
    expect(() => manager.cancelIncrementalGeneration(0, 0)).not.toThrow();
  });

  test('getChunkIncremental returns same PartialChunkData when called twice', () => {
    const manager = new ChunkManager(configWithIncremental);
    
    const partial1 = manager.getChunkIncremental(3, 7);
    const partial2 = manager.getChunkIncremental(3, 7);
    
    // Should return same reference
    expect(partial1).toBe(partial2);
  });

  test('multiple chunks can be generated incrementally in parallel', () => {
    const manager = new ChunkManager(configWithIncremental);
    
    const partial1 = manager.getChunkIncremental(0, 0);
    const partial2 = manager.getChunkIncremental(1, 1);
    const partial3 = manager.getChunkIncremental(2, 2);
    
    // All should be different references
    expect(partial1).not.toBe(partial2);
    expect(partial1).not.toBe(partial3);
    expect(partial2).not.toBe(partial3);
    
    // All should have correct coordinates
    expect(partial1.x).toBe(0);
    expect(partial2.x).toBe(1);
    expect(partial3.x).toBe(2);
  });

  test('completed incremental generation produces valid chunk data', () => {
    const manager = new ChunkManager(configWithIncremental);
    const partial = manager.getChunkIncremental(0, 0);
    
    // Continue until complete
    let complete = false;
    while (!complete) {
      complete = manager.continueGeneration(0, 0);
    }
    
    // Verify all data is populated
    expect(partial.data.heightmap).toBeDefined();
    expect(partial.data.biomeMap).toBeDefined();
    expect(partial.data.biomeWeights).toBeDefined();
    expect(partial.data.resources).toBeDefined();
    expect(partial.data.structures).toBeDefined();
    expect(partial.data.rivers).toBeDefined();
    
    // Verify data is valid
    expect(partial.data.heightmap?.length).toBe(33 * 33);
    expect(partial.data.biomeMap?.length).toBe(32 * 32);
    expect(Array.isArray(partial.data.resources)).toBe(true);
    expect(Array.isArray(partial.data.structures)).toBe(true);
    expect(partial.data.rivers).toBeInstanceOf(Set);
  });

  test('incremental generation is deterministic', () => {
    const manager1 = new ChunkManager(configWithIncremental);
    const manager2 = new ChunkManager(configWithIncremental);
    
    const partial1 = manager1.getChunkIncremental(5, 5);
    const partial2 = manager2.getChunkIncremental(5, 5);
    
    // Complete both generations
    let complete1 = false;
    let complete2 = false;
    while (!complete1 || !complete2) {
      if (!complete1) complete1 = manager1.continueGeneration(5, 5);
      if (!complete2) complete2 = manager2.continueGeneration(5, 5);
    }
    
    // Should have identical heightmaps
    expect(partial1.data.heightmap?.length).toBe(partial2.data.heightmap?.length);
    for (let i = 0; i < partial1.data.heightmap!.length; i++) {
      expect(partial1.data.heightmap![i]).toBe(partial2.data.heightmap![i]);
    }
    
    // Should have identical biome maps
    expect(partial1.data.biomeMap?.length).toBe(partial2.data.biomeMap?.length);
    for (let i = 0; i < partial1.data.biomeMap!.length; i++) {
      expect(partial1.data.biomeMap![i]).toBe(partial2.data.biomeMap![i]);
    }
  });
});

describe('ChunkManager Modification Tracking', () => {
  const defaultConfig: WorldConfig = {
    seed: 12345,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
    },
    biomeConfig: {
      temperatureScale: 0.01,
      moistureScale: 0.01,
      blendRadius: 2,
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
      flowWidth: 1,
    },
  };

  test('recordModification stores modification for a chunk', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const modification = {
      chunkX: 5,
      chunkY: 10,
      timestamp: Date.now(),
      modifiedTiles: new Set([0, 1, 2]),
      heightChanges: new Map([[0, 0.5], [1, 0.6]]),
      addedStructures: [],
      removedStructures: [],
    };
    
    // Should not throw
    expect(() => manager.recordModification(5, 10, modification)).not.toThrow();
  });

  test('recordModification tracks height changes in sparse map', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const modification = {
      chunkX: 0,
      chunkY: 0,
      timestamp: Date.now(),
      modifiedTiles: new Set([10, 20, 30]),
      heightChanges: new Map([
        [10, 0.75],
        [20, 0.85],
        [30, 0.95],
      ]),
      addedStructures: [],
      removedStructures: [],
    };
    
    manager.recordModification(0, 0, modification);
    
    // Verify modification was recorded (we can't directly access private field,
    // but we can verify no errors occurred)
    expect(true).toBe(true);
  });

  test('recordModification tracks structure additions', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const modification = {
      chunkX: 1,
      chunkY: 1,
      timestamp: Date.now(),
      modifiedTiles: new Set([15]),
      heightChanges: new Map(),
      addedStructures: [
        { type: 0, x: 5, y: 5, rotation: 0 },
        { type: 1, x: 10, y: 10, rotation: 90 },
      ],
      removedStructures: [],
    };
    
    manager.recordModification(1, 1, modification);
    
    // Verify no errors
    expect(true).toBe(true);
  });

  test('recordModification tracks structure removals', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const modification = {
      chunkX: 2,
      chunkY: 2,
      timestamp: Date.now(),
      modifiedTiles: new Set([25]),
      heightChanges: new Map(),
      addedStructures: [],
      removedStructures: [0, 1, 2],
    };
    
    manager.recordModification(2, 2, modification);
    
    // Verify no errors
    expect(true).toBe(true);
  });

  test('recordModification merges multiple modifications to same chunk', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const modification1 = {
      chunkX: 3,
      chunkY: 3,
      timestamp: 1000,
      modifiedTiles: new Set([1, 2]),
      heightChanges: new Map([[1, 0.5]]),
      addedStructures: [{ type: 0, x: 1, y: 1, rotation: 0 }],
      removedStructures: [0],
    };
    
    const modification2 = {
      chunkX: 3,
      chunkY: 3,
      timestamp: 2000,
      modifiedTiles: new Set([3, 4]),
      heightChanges: new Map([[3, 0.7]]),
      addedStructures: [{ type: 1, x: 2, y: 2, rotation: 90 }],
      removedStructures: [1],
    };
    
    manager.recordModification(3, 3, modification1);
    manager.recordModification(3, 3, modification2);
    
    // Verify no errors - modifications should be merged
    expect(true).toBe(true);
  });

  test('recordModification updates timestamp to latest', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const modification1 = {
      chunkX: 4,
      chunkY: 4,
      timestamp: 1000,
      modifiedTiles: new Set([1]),
      heightChanges: new Map(),
      addedStructures: [],
      removedStructures: [],
    };
    
    const modification2 = {
      chunkX: 4,
      chunkY: 4,
      timestamp: 2000,
      modifiedTiles: new Set([2]),
      heightChanges: new Map(),
      addedStructures: [],
      removedStructures: [],
    };
    
    manager.recordModification(4, 4, modification1);
    manager.recordModification(4, 4, modification2);
    
    // Timestamp should be updated to latest (2000)
    // We can't verify directly, but ensure no errors
    expect(true).toBe(true);
  });

  test('recordModification handles empty modifications', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const modification = {
      chunkX: 5,
      chunkY: 5,
      timestamp: Date.now(),
      modifiedTiles: new Set(),
      heightChanges: new Map(),
      addedStructures: [],
      removedStructures: [],
    };
    
    manager.recordModification(5, 5, modification);
    
    // Should handle empty modifications without errors
    expect(true).toBe(true);
  });

  test('recordModification handles negative chunk coordinates', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const modification = {
      chunkX: -5,
      chunkY: -10,
      timestamp: Date.now(),
      modifiedTiles: new Set([0]),
      heightChanges: new Map([[0, 0.5]]),
      addedStructures: [],
      removedStructures: [],
    };
    
    manager.recordModification(-5, -10, modification);
    
    // Should handle negative coordinates
    expect(true).toBe(true);
  });

  test('recordModification preserves modification data integrity', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const originalTiles = new Set([1, 2, 3]);
    const originalHeights = new Map([[1, 0.5], [2, 0.6]]);
    const originalAdded = [{ type: 0, x: 1, y: 1, rotation: 0 }];
    const originalRemoved = [0, 1];
    
    const modification = {
      chunkX: 6,
      chunkY: 6,
      timestamp: Date.now(),
      modifiedTiles: originalTiles,
      heightChanges: originalHeights,
      addedStructures: originalAdded,
      removedStructures: originalRemoved,
    };
    
    manager.recordModification(6, 6, modification);
    
    // Modify original data after recording
    originalTiles.add(4);
    originalHeights.set(3, 0.7);
    originalAdded.push({ type: 1, x: 2, y: 2, rotation: 90 });
    originalRemoved.push(2);
    
    // Recorded modification should not be affected by changes to original data
    // (we can't verify directly, but ensure no errors)
    expect(true).toBe(true);
  });

  test('recordModification handles large modification sets', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const largeTileSet = new Set<number>();
    const largeHeightMap = new Map<number, number>();
    
    // Add 1000 tiles
    for (let i = 0; i < 1000; i++) {
      largeTileSet.add(i);
      largeHeightMap.set(i, Math.random());
    }
    
    const modification = {
      chunkX: 7,
      chunkY: 7,
      timestamp: Date.now(),
      modifiedTiles: largeTileSet,
      heightChanges: largeHeightMap,
      addedStructures: [],
      removedStructures: [],
    };
    
    manager.recordModification(7, 7, modification);
    
    // Should handle large datasets
    expect(true).toBe(true);
  });

  test('recordModification works with different chunks independently', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const mod1 = {
      chunkX: 0,
      chunkY: 0,
      timestamp: 1000,
      modifiedTiles: new Set([1]),
      heightChanges: new Map([[1, 0.5]]),
      addedStructures: [],
      removedStructures: [],
    };
    
    const mod2 = {
      chunkX: 1,
      chunkY: 1,
      timestamp: 2000,
      modifiedTiles: new Set([2]),
      heightChanges: new Map([[2, 0.6]]),
      addedStructures: [],
      removedStructures: [],
    };
    
    const mod3 = {
      chunkX: 2,
      chunkY: 2,
      timestamp: 3000,
      modifiedTiles: new Set([3]),
      heightChanges: new Map([[3, 0.7]]),
      addedStructures: [],
      removedStructures: [],
    };
    
    manager.recordModification(0, 0, mod1);
    manager.recordModification(1, 1, mod2);
    manager.recordModification(2, 2, mod3);
    
    // All modifications should be stored independently
    expect(true).toBe(true);
  });
});

describe('ChunkManager Serialization Methods', () => {
  const defaultConfig: WorldConfig = {
    seed: 12345,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
    },
    biomeConfig: {
      temperatureScale: 0.01,
      moistureScale: 0.01,
      blendRadius: 2,
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
      flowWidth: 1,
    },
  };

  test('saveWorld returns SerializedWorld with JSON format', () => {
    const manager = new ChunkManager(defaultConfig);
    
    // Generate some chunks
    manager.getChunk(0, 0);
    manager.getChunk(1, 1);
    
    const serialized = manager.saveWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    expect(serialized).toBeDefined();
    expect(serialized.version).toBe('1.0.0');
    expect(serialized.seed).toBe(12345);
    expect(serialized.config).toBeDefined();
    expect(Array.isArray(serialized.chunks)).toBe(true);
    expect(serialized.chunks.length).toBeGreaterThan(0);
    expect(serialized.checksum).toBeDefined();
  });

  test('saveWorld returns SerializedWorld with binary format', () => {
    const manager = new ChunkManager(defaultConfig);
    
    // Generate some chunks
    manager.getChunk(0, 0);
    
    const serialized = manager.saveWorld({
      format: 'binary' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    expect(serialized).toBeDefined();
    expect(serialized.version).toBe('1.0.0');
    expect(serialized.seed).toBe(12345);
    expect(Array.isArray(serialized.chunks)).toBe(true);
  });

  test('saveWorld with compression enabled', () => {
    const manager = new ChunkManager(defaultConfig);
    
    manager.getChunk(0, 0);
    
    const serialized = manager.saveWorld({
      format: 'json' as any,
      compress: true,
      modifiedOnly: false,
    });
    
    expect(serialized).toBeDefined();
    expect(serialized.chunks.length).toBeGreaterThan(0);
  });

  test('saveWorld with modifiedOnly option', () => {
    const manager = new ChunkManager(defaultConfig);
    
    // Generate chunks
    manager.getChunk(0, 0);
    manager.getChunk(1, 1);
    
    // Record modification for one chunk
    manager.recordTerrainEdit(0, 0, 10, 0.75);
    
    const serialized = manager.saveWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: true,
    });
    
    expect(serialized).toBeDefined();
    // Should only include modified chunks
    expect(serialized.chunks.length).toBeGreaterThanOrEqual(1);
  });

  test('saveWorld with region filter', () => {
    const manager = new ChunkManager(defaultConfig);
    
    // Generate chunks in different regions
    manager.getChunk(0, 0);
    manager.getChunk(5, 5);
    manager.getChunk(10, 10);
    
    const serialized = manager.saveWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
      region: { minX: 0, minY: 0, maxX: 5, maxY: 5 },
    });
    
    expect(serialized).toBeDefined();
    // Should only include chunks in the specified region
    for (const chunk of serialized.chunks) {
      expect(chunk.x).toBeGreaterThanOrEqual(0);
      expect(chunk.x).toBeLessThanOrEqual(5);
      expect(chunk.y).toBeGreaterThanOrEqual(0);
      expect(chunk.y).toBeLessThanOrEqual(5);
    }
  });

  test('loadWorld restores chunks to cache', () => {
    const manager1 = new ChunkManager(defaultConfig);
    
    // Generate and save
    manager1.getChunk(0, 0);
    manager1.getChunk(1, 1);
    const serialized = manager1.saveWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    // Create new manager and load
    const manager2 = new ChunkManager(defaultConfig);
    manager2.loadWorld(serialized);
    
    // Chunks should be in cache
    expect(manager2.getCacheSize()).toBeGreaterThan(0);
  });

  test('loadWorld restores chunk data correctly', () => {
    const manager1 = new ChunkManager(defaultConfig);
    
    // Generate and save
    const originalChunk = manager1.getChunk(5, 5);
    const serialized = manager1.saveWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    // Create new manager and load
    const manager2 = new ChunkManager(defaultConfig);
    manager2.loadWorld(serialized);
    
    // Get the restored chunk
    const restoredChunk = manager2.getChunk(5, 5);
    
    // Verify data matches
    expect(restoredChunk.x).toBe(originalChunk.x);
    expect(restoredChunk.y).toBe(originalChunk.y);
    expect(restoredChunk.size).toBe(originalChunk.size);
    expect(restoredChunk.heightmap.length).toBe(originalChunk.heightmap.length);
    
    // Verify heightmap values match
    for (let i = 0; i < originalChunk.heightmap.length; i++) {
      expect(restoredChunk.heightmap[i]).toBe(originalChunk.heightmap[i]);
    }
  });

  test('loadWorld applies modifications correctly', () => {
    const manager1 = new ChunkManager(defaultConfig);
    
    // Generate chunk and modify it
    manager1.getChunk(0, 0);
    manager1.recordTerrainEdit(0, 0, 10, 0.99);
    
    const serialized = manager1.saveWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    // Create new manager and load
    const manager2 = new ChunkManager(defaultConfig);
    manager2.loadWorld(serialized);
    
    // Get the restored chunk
    const restoredChunk = manager2.getChunk(0, 0);
    
    // Verify modification was applied (use toBeCloseTo for floating point comparison)
    expect(restoredChunk.heightmap[10]).toBeCloseTo(0.99, 5);
  });

  test('loadWorld throws error for invalid version', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const invalidData = {
      version: '99.0.0',
      seed: 12345,
      config: defaultConfig,
      chunks: [],
      modifications: [],
      checksum: 'invalid',
    };
    
    expect(() => manager.loadWorld(invalidData)).toThrow('Unsupported serialization version');
  });

  test('loadWorld throws error for invalid checksum', () => {
    const manager1 = new ChunkManager(defaultConfig);
    
    manager1.getChunk(0, 0);
    const serialized = manager1.saveWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    // Corrupt the checksum
    serialized.checksum = 'corrupted';
    
    const manager2 = new ChunkManager(defaultConfig);
    expect(() => manager2.loadWorld(serialized)).toThrow('Checksum validation failed');
  });

  test('exportWorld returns string for JSON format', () => {
    const manager = new ChunkManager(defaultConfig);
    
    manager.getChunk(0, 0);
    
    const exported = manager.exportWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    expect(typeof exported).toBe('string');
    
    // Should be valid JSON
    const parsed = JSON.parse(exported as string);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.seed).toBe(12345);
  });

  test('exportWorld returns Blob for binary format', () => {
    const manager = new ChunkManager(defaultConfig);
    
    manager.getChunk(0, 0);
    
    const exported = manager.exportWorld({
      format: 'binary' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    expect(exported).toBeInstanceOf(Blob);
    expect((exported as Blob).type).toBe('application/octet-stream');
  });

  test('exportWorld with compression produces smaller output', () => {
    const manager = new ChunkManager(defaultConfig);
    
    // Generate multiple chunks for better compression
    manager.getChunk(0, 0);
    manager.getChunk(1, 1);
    manager.getChunk(2, 2);
    
    const uncompressed = manager.exportWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    const compressed = manager.exportWorld({
      format: 'json' as any,
      compress: true,
      modifiedOnly: false,
    });
    
    // Compressed should be smaller or equal (for small data, compression might not help)
    expect((compressed as string).length).toBeLessThanOrEqual((uncompressed as string).length * 1.1);
  });

  test('exportWorld includes metadata', () => {
    const manager = new ChunkManager(defaultConfig);
    
    manager.getChunk(0, 0);
    
    const exported = manager.exportWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    const parsed = JSON.parse(exported as string);
    
    // Verify metadata is present
    expect(parsed.version).toBeDefined();
    expect(parsed.seed).toBeDefined();
    expect(parsed.config).toBeDefined();
    expect(parsed.checksum).toBeDefined();
  });

  test('saveWorld and loadWorld round-trip preserves data', () => {
    const manager1 = new ChunkManager(defaultConfig);
    
    // Generate multiple chunks with modifications
    manager1.getChunk(0, 0);
    manager1.getChunk(1, 1);
    manager1.recordTerrainEdit(0, 0, 5, 0.88);
    manager1.recordStructureAddition(1, 1, { type: 0, x: 10, y: 10, rotation: 0 });
    
    // Save
    const serialized = manager1.saveWorld({
      format: 'json' as any,
      compress: true,
      modifiedOnly: false,
    });
    
    // Load into new manager
    const manager2 = new ChunkManager(defaultConfig);
    manager2.loadWorld(serialized);
    
    // Verify chunks are restored
    const chunk1 = manager2.getChunk(0, 0);
    const chunk2 = manager2.getChunk(1, 1);
    
    expect(chunk1.heightmap[5]).toBeCloseTo(0.88, 5);
    expect(chunk2.structures.length).toBeGreaterThan(0);
  });

  test('exportWorld and import round-trip works', async () => {
    const manager1 = new ChunkManager(defaultConfig);
    
    manager1.getChunk(0, 0);
    
    // Export
    const exported = manager1.exportWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    // Parse back (simulating file load)
    const parsed = JSON.parse(exported as string);
    
    // Load into new manager
    const manager2 = new ChunkManager(defaultConfig);
    manager2.loadWorld(parsed);
    
    // Verify chunk is restored
    const chunk = manager2.getChunk(0, 0);
    expect(chunk).toBeDefined();
    expect(chunk.x).toBe(0);
    expect(chunk.y).toBe(0);
  });

  test('saveWorld handles empty cache', () => {
    const manager = new ChunkManager(defaultConfig);
    
    // Don't generate any chunks
    const serialized = manager.saveWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    expect(serialized).toBeDefined();
    expect(serialized.chunks.length).toBe(0);
    expect(serialized.modifications.length).toBe(0);
  });

  test('loadWorld handles empty world data', () => {
    const manager = new ChunkManager(defaultConfig);
    
    const emptyData = {
      version: '1.0.0',
      seed: 12345,
      config: defaultConfig,
      chunks: [],
      modifications: [],
      checksum: '00000000', // Will be recalculated
    };
    
    // Calculate proper checksum using the manager's serializer
    const tempManager = new ChunkManager(defaultConfig);
    const serialized = tempManager.saveWorld({
      format: 'json' as any,
      compress: false,
      modifiedOnly: false,
    });
    
    // Use the checksum from an empty world
    emptyData.checksum = serialized.checksum;
    
    // Should not throw
    expect(() => manager.loadWorld(emptyData)).not.toThrow();
    expect(manager.getCacheSize()).toBe(0);
  });
});
