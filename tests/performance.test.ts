/**
 * Performance benchmarks for chunk generation
 * 
 * Run with: npm run test:bench
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import { makeMinimalConfig } from './helpers';
import { DEFAULT_LAKE_CONFIG } from '../src/gen/lakes';

describe('Performance Benchmarks', () => {
  it('benchmarks 32x32 chunk generation (no lakes)', async () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    const manager = new ChunkManager(config);

    // Warm-up: one chunk to trigger JIT compilation and NoiseEngine init.
    // This run is excluded from the measured average.
    await manager.getChunk(999, 999);

    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await manager.getChunk(i, 0);
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    // Median is robust against cold-start outliers in CI / Node.js environments.
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    console.log(`\n32x32 chunk (no lakes):`);
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  Median:  ${median.toFixed(2)}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);

    // Use median to avoid cold-start outliers skewing the result.
    // Browser target is 30-50ms; Node.js/Vitest adds overhead on first runs.
    expect(median).toBeLessThan(100);
  });

  it('benchmarks 32x32 chunk generation (with lakes)', async () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = DEFAULT_LAKE_CONFIG;
    const manager = new ChunkManager(config);

    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await manager.getChunk(i, 0);
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log(`\n32x32 chunk (with lakes):`);
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);

    // Performance target: < 200ms average (multi-chunk lakes can be slower)
    expect(avg).toBeLessThan(200);
  });

  it('benchmarks 64x64 chunk generation', async () => {
    const config = makeMinimalConfig(42);
    config.chunkSize = 64;
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    const manager = new ChunkManager(config);

    const iterations = 5;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await manager.getChunk(i, 0);
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log(`\n64x64 chunk (no lakes):`);
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);

    // Performance target: < 600ms average (4x vertices = 4x time)
    expect(avg).toBeLessThan(600);
  });

  it('benchmarks memory usage per chunk', async () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = DEFAULT_LAKE_CONFIG;
    const manager = new ChunkManager(config);

    const chunk = await manager.getChunk(0, 0);

    // Calculate memory usage
    const heightmapSize = chunk.heightmap.byteLength;
    const biomeMapSize = chunk.biomeMap.byteLength;
    const sparseBiomeTypesSize = chunk.sparseBiomeTypes.byteLength;
    const sparseBiomeWeightsSize = chunk.sparseBiomeWeights.byteLength;
    const sparseBiomeOffsetsSize = chunk.sparseBiomeOffsets.byteLength;
    const biomeWeightsSize = sparseBiomeTypesSize + sparseBiomeWeightsSize + sparseBiomeOffsetsSize;
    const microBiomeMapSize = chunk.microBiomeMap?.byteLength || 0;
    
    // Estimate resources and structures (rough approximation)
    const resourcesSize = chunk.resources.length * 32; // ~32 bytes per resource
    const structuresSize = chunk.structures.length * 32; // ~32 bytes per structure
    const lakesSize = chunk.lakes.reduce((sum, lake) => sum + lake.tiles.size * 4 + 32, 0);

    const totalSize = heightmapSize + biomeMapSize + biomeWeightsSize + microBiomeMapSize +
                      resourcesSize + structuresSize + lakesSize;

    console.log(`\nMemory usage per 32x32 chunk:`);
    console.log(`  Heightmap: ${(heightmapSize / 1024).toFixed(2)} KB`);
    console.log(`  Biome map: ${(biomeMapSize / 1024).toFixed(2)} KB`);
    console.log(`  Biome weights: ${(biomeWeightsSize / 1024).toFixed(2)} KB`);
    console.log(`  Micro-biomes: ${(microBiomeMapSize / 1024).toFixed(2)} KB`);
    console.log(`  Resources: ${(resourcesSize / 1024).toFixed(2)} KB`);
    console.log(`  Structures: ${(structuresSize / 1024).toFixed(2)} KB`);
    console.log(`  Lakes: ${(lakesSize / 1024).toFixed(2)} KB`);
    console.log(`  Total: ${(totalSize / 1024).toFixed(2)} KB`);

    // Memory target: < 50KB per chunk
    expect(totalSize).toBeLessThan(50 * 1024);
  });

  it('benchmarks cache performance', async () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.maxCacheSize = 100;
    const manager = new ChunkManager(config);

    // Generate 20 chunks
    for (let i = 0; i < 20; i++) {
      await manager.getChunk(i % 5, Math.floor(i / 5));
    }

    // Access same chunks again (should be cached)
    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      await manager.getChunk(i % 5, Math.floor(i / 5));
    }
    const end = performance.now();

    const avgCachedTime = (end - start) / 20;
    const stats = manager.getCacheStats();

    console.log(`\nCache performance:`);
    console.log(`  Cache size: ${stats.size}/${stats.maxSize}`);
    console.log(`  Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(`  Avg cached access: ${avgCachedTime.toFixed(2)}ms`);

    // Cached access should be very fast (< 1ms)
    expect(avgCachedTime).toBeLessThan(1);
    // Hit rate should be high (>= 50%)
    expect(stats.hitRate).toBeGreaterThanOrEqual(0.5);
  });
});
