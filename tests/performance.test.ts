/**
 * Performance benchmarks for chunk generation
 * 
 * Run with: npm run test:bench
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import { BiomeSystem } from '../src/world/biome';
import { TerrainGenerator } from '../src/gen/terrain';
import { makeMinimalConfig } from './helpers';
import { DEFAULT_LAKE_CONFIG } from '../src/gen/lakes';
import { DEFAULT_RIVER_CONFIG } from '../src/gen/rivers';
import { EngineRuntime } from '../src/runtime/engine-runtime';
import { MovementSystem } from '../src/runtime/movement-system';
import {
  INPUT_ACTION_FORWARD,
  INPUT_ACTION_RIGHT,
  INPUT_ACTION_SPRINT,
} from '../src/runtime/input';
import {
  TRANSFORM_COMPONENT,
  MOVEMENT_COMPONENT,
  createTransformComponent,
  createMovementComponent,
} from '../src/runtime/components';
import { generateSpiralCoordinates } from '../src/utils/chunk-priority';
import type { ChunkPerformanceMetrics } from '../src/world/chunk-manager';

const shouldRunBenchmarks =
  process.env.RUN_BENCHMARKS === '1' ||
  process.env.npm_lifecycle_event === 'test:bench' ||
  process.argv.some(arg => arg.includes('performance.test.ts'));

const describeBenchmarks = shouldRunBenchmarks ? describe : describe.skip;

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describeBenchmarks('Performance Benchmarks', () => {
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

  it('benchmarks 32x32 chunk generation (with rivers)', async () => {
    const config = makeMinimalConfig(123);
    config.riverConfig = DEFAULT_RIVER_CONFIG;
    const manager = new ChunkManager(config);

    const start = performance.now();
    await manager.getChunk(0, 0);
    const elapsed = performance.now() - start;

    console.log(`\n32x32 chunk (with rivers): ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(300);
  });

  it('benchmarks 64x64 chunk generation', async () => {
    const config = makeMinimalConfig(42);
    config.chunkSize = 64;
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    const manager = new ChunkManager(config);

    // Warm-up: one chunk to trigger JIT compilation and NoiseEngine init.
    await manager.getChunk(999, 999);

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
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    console.log(`\n64x64 chunk (no lakes):`);
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  Median:  ${median.toFixed(2)}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);

    // Use median to avoid CI / Node.js outliers skewing benchmark checks.
    expect(median).toBeLessThan(900);
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
    // Estimate resources and structures (rough approximation)
    const resourcesSize = chunk.resources.length * 32; // ~32 bytes per resource
    const structuresSize = chunk.structures.length * 32; // ~32 bytes per structure
    const lakesSize = chunk.lakes.reduce((sum, lake) => sum + lake.tiles.size * 4 + 32, 0);

    const totalSize = heightmapSize + biomeMapSize + biomeWeightsSize +
                      resourcesSize + structuresSize + lakesSize;

    console.log(`\nMemory usage per 32x32 chunk:`);
    console.log(`  Heightmap: ${(heightmapSize / 1024).toFixed(2)} KB`);
    console.log(`  Biome map: ${(biomeMapSize / 1024).toFixed(2)} KB`);
    console.log(`  Biome weights: ${(biomeWeightsSize / 1024).toFixed(2)} KB`);
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

  it('benchmarks diagonal camera flight at shift speed with stage breakdown', async () => {
    const config = makeMinimalConfig(42);
    config.chunkSize = 32;
    config.lakeConfig = DEFAULT_LAKE_CONFIG;
    config.riverConfig = DEFAULT_RIVER_CONFIG;
    config.maxCacheSize = 200;

    const world = new ChunkManager(config);
    const runtime = new EngineRuntime({ world, maxDeltaTime: 0.25 });
    const radius = 2;

    // Create player entity with movement
    runtime.entities
      .createEntity('player')
      .addComponent(TRANSFORM_COMPONENT, createTransformComponent({ position: { x: 0, y: 50, z: 0 } }))
      .addComponent(MOVEMENT_COMPONENT, createMovementComponent({ speed: 32, sprintMultiplier: 2 }));

    runtime.addSystem(new MovementSystem());

    // Diagonal flight with shift (sprint)
    runtime.input.setAction(INPUT_ACTION_FORWARD, true);
    runtime.input.setAction(INPUT_ACTION_RIGHT, true);
    runtime.input.setAction(INPUT_ACTION_SPRINT, true);

    const frameCount = 300; // ~5 seconds at 60fps
    const dt = 1 / 60;

    const tickDurations: number[] = [];
    const allMetrics: ChunkPerformanceMetrics[] = [];
    const generatedChunkKeys = new Set<string>();

    for (let i = 0; i < frameCount; i++) {
      const tickStart = performance.now();

      // Update movement
      runtime.tick(dt);

      const pos = runtime.entities.getEntity('player')!.requireComponent(TRANSFORM_COMPONENT).position;
      const centerX = Math.floor(pos.x / config.chunkSize);
      const centerY = Math.floor(pos.z / config.chunkSize);

      // Generate missing chunks in radius and collect per-stage metrics
      for (const coord of generateSpiralCoordinates(centerX, centerY, radius)) {
        const key = `${coord.x},${coord.y}`;
        if (generatedChunkKeys.has(key)) {
          continue;
        }
        generatedChunkKeys.add(key);

        const { metrics } = world.generateChunkWithMetrics(coord.x, coord.y);
        allMetrics.push(metrics);
      }

      const tickElapsed = performance.now() - tickStart;
      tickDurations.push(tickElapsed);
    }

    const finalPos = runtime.entities.getEntity('player')!.requireComponent(TRANSFORM_COMPONENT).position;

    // Aggregates
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);
    const min = (arr: number[]) => (arr.length ? Math.min(...arr) : 0);
    const max = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);
    const med = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };

    const totals = allMetrics.map(m => m.totalTime);
    const terrains = allMetrics.map(m => m.terrainTime);
    const biomes = allMetrics.map(m => m.biomeTime);
    const biomeClassifications = allMetrics.map(m => m.biomeClassificationTime);
    const biomeBlendings = allMetrics.map(m => m.biomeBlendingTime);
    const rivers = allMetrics.map(m => m.riverTime);
    const lakes = allMetrics.map(m => m.lakeTime);
    const resources = allMetrics.map(m => m.resourceTime);
    const structures = allMetrics.map(m => m.structureTime);

    const reportStage = (name: string, arr: number[]) => {
      const pct = avg(totals) > 0 ? (avg(arr) / avg(totals)) * 100 : 0;
      console.log(`    ${name.padEnd(18)} avg=${avg(arr).toFixed(2)}ms  med=${med(arr).toFixed(2)}ms  min=${min(arr).toFixed(2)}ms  max=${max(arr).toFixed(2)}ms  (${pct.toFixed(1)}% of total)`);
    };

    console.log(`\nDiagonal camera flight at shift speed (stage breakdown):`);
    console.log(`  Simulation: ${frameCount} frames @ ${(dt * 1000).toFixed(2)}ms (${(frameCount * dt).toFixed(2)}s)`);
    console.log(`  Final position: (${finalPos.x.toFixed(1)}, ${finalPos.y.toFixed(1)}, ${finalPos.z.toFixed(1)})`);
    console.log(`  Chunks generated: ${allMetrics.length}`);
    console.log(`  Per-stage generation times:`);
    reportStage('Terrain', terrains);
    reportStage('Biome (total)', biomes);
    reportStage('  +- Classification', biomeClassifications);
    reportStage('  +- Blending', biomeBlendings);
    reportStage('Rivers', rivers);
    reportStage('Lakes', lakes);
    reportStage('Resources', resources);
    reportStage('Structures', structures);
    reportStage('Total', totals);
    console.log(`  Frame tick times:`);
    console.log(`    Average: ${avg(tickDurations).toFixed(2)}ms`);
    console.log(`    Median:  ${med(tickDurations).toFixed(2)}ms`);
    console.log(`    Max: ${max(tickDurations).toFixed(2)}ms`);

    expect(allMetrics.length).toBeGreaterThan(0);
    expect(avg(tickDurations)).toBeLessThan(50);
  });

  it('micro-benchmarks biome generation sub-stages', () => {
    const config = makeMinimalConfig(42);
    config.chunkSize = 32;
    config.lakeConfig = { ...DEFAULT_LAKE_CONFIG, enabled: false };
    config.riverConfig = { ...DEFAULT_RIVER_CONFIG, enabled: false };

    const terrainGen = new TerrainGenerator(config.terrainConfig);
    const biomeSys = new BiomeSystem(config.seed, config.biomeConfig);

    // Generate a heightmap exactly as ChunkManager does
    const heightmap = terrainGen.generateHeightmap(config.seed, config.chunkSize, 0, 0);

    const size = config.chunkSize;
    const worldX = 0;
    const worldY = 0;
    const vertexCount = size + 1;

    const getHeight = (worldPosX: number, worldPosY: number): number => {
      const localX = worldPosX - worldX;
      const localY = worldPosY - worldY;
      if (localX >= 0 && localX <= size && localY >= 0 && localY <= size) {
        return heightmap[localY * vertexCount + localX];
      }
      return terrainGen.getHeightAt(worldPosX, worldPosY, config.seed);
    };

    // --- Stage 1: Biome classification only ---
    const classificationStart = performance.now();
    const biomeMapClass = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const height = heightmap[y * vertexCount + x];
        biomeMapClass[y * size + x] = biomeSys.getBiome(worldX + x, worldY + y, height);
      }
    }
    const classificationTime = performance.now() - classificationStart;

    // --- Stage 2: Biome blending / weights only ---
    const blendingStart = performance.now();
    const tileWeights: Map<number, number>[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const weights = biomeSys.getBiomeWeights(worldX + x, worldY + y, getHeight);
        tileWeights.push(weights);
      }
    }
    const blendingTime = performance.now() - blendingStart;

    // --- Stage 3: Sparse conversion ---
    const sparseStart = performance.now();
    const types: number[] = [];
    const weights: number[] = [];
    const offsets: number[] = [];
    for (let i = 0; i < size * size; i++) {
      offsets.push(types.length);
      for (const [biomeType, weight] of tileWeights[i].entries()) {
        if (weight > 0.001) {
          types.push(biomeType);
          weights.push(weight);
        }
      }
    }
    const sparseTime = performance.now() - sparseStart;

    const totalBiomeTime = classificationTime + blendingTime + sparseTime;

    // --- Stage 4: Full chunk generation for comparison ---
    const manager = new ChunkManager(config);
    const { metrics } = manager.generateChunkWithMetrics(0, 0);

    console.log(`\nBiome generation micro-benchmark (32x32 chunk):`);
    console.log(`  Manual measurement:`);
    console.log(`    Classification (getBiome x ${size * size}):     ${classificationTime.toFixed(2)}ms  (${(classificationTime / totalBiomeTime * 100).toFixed(1)}%)`);
    console.log(`    Blending (getBiomeWeights x ${size * size}):    ${blendingTime.toFixed(2)}ms  (${(blendingTime / totalBiomeTime * 100).toFixed(1)}%)`);
    console.log(`    Sparse conversion:                            ${sparseTime.toFixed(2)}ms  (${(sparseTime / totalBiomeTime * 100).toFixed(1)}%)`);
    console.log(`    Total measured biome time:                    ${totalBiomeTime.toFixed(2)}ms`);
    console.log(`  From ChunkManager.generateChunkWithMetrics:`);
    console.log(`    biomeTime:          ${metrics.biomeTime.toFixed(2)}ms`);
    console.log(`    biomeClassificationTime: ${metrics.biomeClassificationTime.toFixed(2)}ms`);
    console.log(`    biomeBlendingTime:  ${metrics.biomeBlendingTime.toFixed(2)}ms`);
    console.log(`    terrainTime:        ${metrics.terrainTime.toFixed(2)}ms`);
    console.log(`    totalTime:          ${metrics.totalTime.toFixed(2)}ms`);

    expect(blendingTime).toBeGreaterThan(classificationTime);
    // Blending should dominate biome generation
    expect(blendingTime / totalBiomeTime).toBeGreaterThan(0.7);
  });
});
