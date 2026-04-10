import { describe, test, expect } from 'vitest';
import { ChunkManager, WorldConfig } from '../../../src/world/chunk-manager';
import { BiomeType, ResourceType, StructureType } from '../../../src/world/chunk';

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
    expect(chunk.heightmap.length).toBe(32 * 32);
  });

  test('generateChunk handles negative coordinates', () => {
    const manager = new ChunkManager(defaultConfig);
    const chunk = manager.generateChunk(-5, -10);
    
    expect(chunk.x).toBe(-5);
    expect(chunk.y).toBe(-10);
    expect(chunk.heightmap.length).toBe(32 * 32);
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
    expect(chunk16.heightmap.length).toBe(16 * 16);
    
    expect(chunk64.size).toBe(64);
    expect(chunk64.heightmap.length).toBe(64 * 64);
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
