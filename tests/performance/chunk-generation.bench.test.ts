/**
 * Performance Benchmarks for Chunk Generation
 * 
 * Tests that chunk generation meets the <100ms target (Requirement 9.4)
 * and measures memory usage patterns.
 */

import { describe, test, expect } from 'vitest';
import {
  ChunkManager,
  BiomeType,
  ResourceType,
  StructureType,
  type WorldConfig,
} from '../../src/index';

// Standard configuration for benchmarks
const standardConfig: WorldConfig = {
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
    types: [
      {
        type: ResourceType.STONE,
        rarity: 0.3,
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 10,
        maxAmount: 50,
      },
      {
        type: ResourceType.IRON,
        rarity: 0.2,
        biomes: [BiomeType.MOUNTAIN],
        minAmount: 5,
        maxAmount: 20,
      },
      {
        type: ResourceType.WOOD,
        rarity: 0.4,
        biomes: [BiomeType.FOREST, BiomeType.TAIGA],
        minAmount: 20,
        maxAmount: 100,
      },
    ],
    clusterScale: 20,
    densityThreshold: 0.6,
  },
  structureConfig: {
    types: [
      {
        type: StructureType.VILLAGE,
        rarity: 1.0,
        rules: [
          { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
          { type: 'slope', params: { maxSlope: 0.1 } },
        ],
      },
      {
        type: StructureType.RUINS,
        rarity: 0.5,
        rules: [
          { type: 'biome', params: { biomes: [BiomeType.DESERT, BiomeType.PLAINS] } },
        ],
      },
    ],
    minDistance: 10,
    maxAttempts: 30,
  },
  riverConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
  },
};

describe('Chunk Generation Performance', () => {
  test('single chunk generation should complete in <100ms', () => {
    const manager = new ChunkManager(standardConfig);
    
    // Warmup run to allow JIT compilation
    manager.getChunk(-1, -1);
    
    // Actual measurement
    const startTime = performance.now();
    manager.getChunk(0, 0);
    const duration = performance.now() - startTime;
    
    console.log(`Single chunk generation: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(100);
  });

  test('average chunk generation should be <100ms over 10 chunks', () => {
    const manager = new ChunkManager(standardConfig);
    const chunkCount = 10;
    const times: number[] = [];
    
    for (let i = 0; i < chunkCount; i++) {
      const startTime = performance.now();
      manager.getChunk(i, 0);
      const duration = performance.now() - startTime;
      times.push(duration);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`Average chunk generation: ${avgTime.toFixed(2)}ms`);
    console.log(`Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    
    expect(avgTime).toBeLessThan(100);
  });

  test('cached chunk retrieval should be <1ms', () => {
    const manager = new ChunkManager(standardConfig);
    
    // Generate chunk first
    manager.getChunk(0, 0);
    
    // Measure cache retrieval
    const startTime = performance.now();
    manager.getChunk(0, 0);
    const duration = performance.now() - startTime;
    
    console.log(`Cached chunk retrieval: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(1);
  });

  test('chunk generation with different sizes', () => {
    const sizes = [16, 32, 64];
    
    for (const size of sizes) {
      const config = { ...standardConfig, chunkSize: size };
      const manager = new ChunkManager(config);
      
      const startTime = performance.now();
      manager.getChunk(0, 0);
      const duration = performance.now() - startTime;
      
      console.log(`Chunk size ${size}x${size}: ${duration.toFixed(2)}ms`);
      
      // Larger chunks may take longer, but should scale reasonably
      // 64x64 is 4x the area of 32x32, so allow 4x the time
      const maxTime = size === 64 ? 400 : 100;
      expect(duration).toBeLessThan(maxTime);
    }
  });

  test('parallel chunk generation performance', () => {
    const manager = new ChunkManager(standardConfig);
    const chunkCount = 25; // 5x5 grid
    
    const startTime = performance.now();
    
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        manager.getChunk(x, y);
      }
    }
    
    const totalTime = performance.now() - startTime;
    const avgTime = totalTime / chunkCount;
    
    console.log(`Generated ${chunkCount} chunks in ${totalTime.toFixed(2)}ms`);
    console.log(`Average: ${avgTime.toFixed(2)}ms per chunk`);
    
    expect(avgTime).toBeLessThan(100);
  });

  test('chunk generation with minimal features', () => {
    const minimalConfig: WorldConfig = {
      ...standardConfig,
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
    
    const manager = new ChunkManager(minimalConfig);
    
    const startTime = performance.now();
    manager.getChunk(0, 0);
    const duration = performance.now() - startTime;
    
    console.log(`Minimal features chunk: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(50); // Should be faster with fewer features
  });

  test('chunk generation with maximum features', () => {
    const maximalConfig: WorldConfig = {
      ...standardConfig,
      resourceConfig: {
        types: [
          {
            type: ResourceType.STONE,
            rarity: 0.5,
            biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS, BiomeType.DESERT],
            minAmount: 10,
            maxAmount: 50,
          },
          {
            type: ResourceType.IRON,
            rarity: 0.3,
            biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
            minAmount: 5,
            maxAmount: 20,
          },
          {
            type: ResourceType.GOLD,
            rarity: 0.1,
            biomes: [BiomeType.MOUNTAIN],
            minAmount: 1,
            maxAmount: 10,
          },
          {
            type: ResourceType.COAL,
            rarity: 0.4,
            biomes: [BiomeType.MOUNTAIN, BiomeType.FOREST],
            minAmount: 10,
            maxAmount: 30,
          },
          {
            type: ResourceType.WOOD,
            rarity: 0.6,
            biomes: [BiomeType.FOREST, BiomeType.TAIGA],
            minAmount: 20,
            maxAmount: 100,
          },
        ],
        clusterScale: 20,
        densityThreshold: 0.5,
      },
      structureConfig: {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [
              { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
              { type: 'slope', params: { maxSlope: 0.1 } },
            ],
          },
          {
            type: StructureType.RUINS,
            rarity: 0.5,
            rules: [
              { type: 'biome', params: { biomes: [BiomeType.DESERT, BiomeType.PLAINS] } },
            ],
          },
          {
            type: StructureType.TOWER,
            rarity: 0.3,
            rules: [
              { type: 'biome', params: { biomes: [BiomeType.MOUNTAIN] } },
              { type: 'elevation', params: { min: 0.6, max: 1.0 } },
            ],
          },
        ],
        minDistance: 8,
        maxAttempts: 50,
      },
    };
    
    const manager = new ChunkManager(maximalConfig);
    
    const startTime = performance.now();
    manager.getChunk(0, 0);
    const duration = performance.now() - startTime;
    
    console.log(`Maximum features chunk: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(150); // Allow slightly more time for complex generation
  });
});

describe('Memory Usage', () => {
  test('chunk memory footprint', () => {
    const manager = new ChunkManager(standardConfig);
    const chunk = manager.getChunk(0, 0);
    
    // Calculate approximate memory usage
    const size = chunk.size;
    const heightmapBytes = chunk.heightmap.byteLength;
    const biomeMapBytes = chunk.biomeMap.byteLength;
    const biomeWeightsBytes = chunk.biomeWeights.byteLength;
    
    // Approximate object overhead (resources, structures, rivers)
    const resourceBytes = chunk.resources.length * 32; // Rough estimate
    const structureBytes = chunk.structures.length * 24; // Rough estimate
    const riverBytes = chunk.rivers.size * 8; // Rough estimate
    
    const totalBytes = heightmapBytes + biomeMapBytes + biomeWeightsBytes + 
                       resourceBytes + structureBytes + riverBytes;
    const totalKB = totalBytes / 1024;
    
    console.log(`Chunk memory footprint: ${totalKB.toFixed(2)} KB`);
    console.log(`  Heightmap: ${heightmapBytes} bytes`);
    console.log(`  Biome map: ${biomeMapBytes} bytes`);
    console.log(`  Biome weights: ${biomeWeightsBytes} bytes`);
    console.log(`  Resources: ~${resourceBytes} bytes (${chunk.resources.length} items)`);
    console.log(`  Structures: ~${structureBytes} bytes (${chunk.structures.length} items)`);
    console.log(`  Rivers: ~${riverBytes} bytes (${chunk.rivers.size} tiles)`);
    
    // For 32x32 chunk, expect roughly 20-30KB
    expect(totalKB).toBeLessThan(100);
  });

  test('cache memory usage with LRU eviction', () => {
    const cacheSize = 10;
    const manager = new ChunkManager({
      ...standardConfig,
      maxCacheSize: cacheSize,
    });
    
    // Generate more chunks than cache can hold
    for (let i = 0; i < cacheSize * 2; i++) {
      manager.getChunk(i, 0);
    }
    
    const stats = manager.getCacheStats();
    
    console.log(`Cache size: ${stats.size}/${stats.maxSize}`);
    expect(stats.size).toBeLessThanOrEqual(cacheSize);
  });

  test('memory stability over many generations', () => {
    const manager = new ChunkManager({
      ...standardConfig,
      maxCacheSize: 20,
    });
    
    // Generate many chunks to test for memory leaks
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      manager.getChunk(i % 10, Math.floor(i / 10));
    }
    
    const stats = manager.getCacheStats();
    
    console.log(`After ${iterations} generations, cache size: ${stats.size}/${stats.maxSize}`);
    expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
  });
});

describe('Performance Regression Tests', () => {
  test('consistent performance across multiple runs', () => {
    const runs = 5;
    const times: number[] = [];
    
    for (let run = 0; run < runs; run++) {
      const manager = new ChunkManager(standardConfig);
      
      const startTime = performance.now();
      manager.getChunk(0, 0);
      const duration = performance.now() - startTime;
      
      times.push(duration);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    
    console.log(`Performance consistency over ${runs} runs:`);
    console.log(`  Average: ${avgTime.toFixed(2)}ms`);
    console.log(`  Std Dev: ${stdDev.toFixed(2)}ms`);
    console.log(`  Times: ${times.map(t => t.toFixed(2)).join(', ')}ms`);
    
    // Standard deviation should be reasonable (less than 50% of average)
    expect(stdDev).toBeLessThan(avgTime * 0.5);
  });

  test('performance with different seeds', () => {
    const seeds = [12345, 67890, 11111, 99999, 54321];
    const times: number[] = [];
    
    for (const seed of seeds) {
      const config = { ...standardConfig, seed };
      const manager = new ChunkManager(config);
      
      // Warmup to avoid JIT spikes
      manager.getChunk(-1, -1);
      
      const startTime = performance.now();
      manager.getChunk(0, 0);
      const duration = performance.now() - startTime;
      
      times.push(duration);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`Performance across different seeds:`);
    console.log(`  Average: ${avgTime.toFixed(2)}ms`);
    console.log(`  Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    console.log(`  Times: ${times.map(t => t.toFixed(2)).join(', ')}ms`);
    
    // Average should meet the <100ms target (individual runs may spike due to system load)
    expect(avgTime).toBeLessThan(100);
  });
});
