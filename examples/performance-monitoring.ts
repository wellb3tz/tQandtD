/**
 * Performance Monitoring Example
 * 
 * Demonstrates how to use performance monitoring features to track
 * chunk generation timing and progress.
 */

import {
  ChunkManager,
  BiomeType,
  ResourceType,
  StructureType,
  type WorldConfig,
  type ChunkPerformanceMetrics,
  type ProgressCallback,
} from '../src/index';

// Example 1: Basic performance monitoring
console.log('=== Example 1: Basic Performance Monitoring ===\n');

const configWithMetrics: WorldConfig = {
  seed: 12345,
  chunkSize: 32,
  enablePerformanceMetrics: true, // Enable timing measurements
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
    ],
    minDistance: 10,
    maxAttempts: 30,
  },
  riverNetworkConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
    enableTributaries: true,
    maxTributaryOrder: 2,
    tributaryProbability: 0.3,
    enableLakes: true,
    lakeDepressionThreshold: 0.05,
    maxLakeSize: 100,
    enableDeltas: true,
    deltaBranchCount: 3,
    deltaSpreadAngle: Math.PI / 3,
    minFlow: 1.0,
    maxFlow: 100.0,
    widthScale: 0.5,
  },
};

const manager1 = new ChunkManager(configWithMetrics);

// Generate a chunk - metrics will be logged to console
const chunk1 = manager1.getChunk(0, 0);
console.log(`Generated chunk with ${chunk1.resources.length} resources\n`);

// Example 2: Progress tracking
console.log('=== Example 2: Progress Tracking ===\n');

const progressCallback: ProgressCallback = (stage: string, progress: number) => {
  const percentage = (progress * 100).toFixed(0);
  console.log(`[${percentage}%] ${stage}`);
};

const configWithProgress: WorldConfig = {
  ...configWithMetrics,
  onProgress: progressCallback, // Add progress callback
};

const manager2 = new ChunkManager(configWithProgress);
const chunk2 = manager2.getChunk(5, 5);
console.log(`\nChunk generation complete!\n`);

// Example 3: Benchmarking multiple chunks
console.log('=== Example 3: Benchmarking Multiple Chunks ===\n');

const manager3 = new ChunkManager({
  ...configWithMetrics,
  enablePerformanceMetrics: false, // Disable per-chunk logging
});

const startTime = performance.now();
const chunkCount = 10;

for (let i = 0; i < chunkCount; i++) {
  manager3.getChunk(i, 0);
}

const totalTime = performance.now() - startTime;
const avgTime = totalTime / chunkCount;

console.log(`Generated ${chunkCount} chunks in ${totalTime.toFixed(2)}ms`);
console.log(`Average time per chunk: ${avgTime.toFixed(2)}ms`);
console.log(`Target: <100ms per chunk - ${avgTime < 100 ? 'PASS ✓' : 'FAIL ✗'}\n`);

// Example 4: Cache statistics
console.log('=== Example 4: Cache Statistics ===\n');

const manager4 = new ChunkManager({
  ...configWithMetrics,
  maxCacheSize: 5,
  enablePerformanceMetrics: false,
});

// Generate more chunks than cache can hold
for (let i = 0; i < 10; i++) {
  manager4.getChunk(i, 0);
  const stats = manager4.getCacheStats();
  console.log(`After chunk ${i}: Cache size ${stats.size}/${stats.maxSize}`);
}

console.log('\nCache is full, LRU eviction is working!\n');

// Example 5: Custom performance tracking
console.log('=== Example 5: Custom Performance Tracking ===\n');

interface CustomMetrics {
  chunkCoords: string;
  generationTime: number;
  cacheHit: boolean;
}

const customMetrics: CustomMetrics[] = [];

const manager5 = new ChunkManager({
  ...configWithMetrics,
  enablePerformanceMetrics: false,
});

// Track custom metrics
for (let x = 0; x < 3; x++) {
  for (let y = 0; y < 3; y++) {
    const start = performance.now();
    const cacheSize = manager5.getCacheSize();
    
    manager5.getChunk(x, y);
    
    const time = performance.now() - start;
    const cacheHit = manager5.getCacheSize() === cacheSize;
    
    customMetrics.push({
      chunkCoords: `(${x}, ${y})`,
      generationTime: time,
      cacheHit,
    });
  }
}

console.log('Custom metrics collected:');
console.table(customMetrics);

// Calculate statistics
const generationTimes = customMetrics
  .filter(m => !m.cacheHit)
  .map(m => m.generationTime);

const avgGenTime = generationTimes.reduce((a, b) => a + b, 0) / generationTimes.length;
const minGenTime = Math.min(...generationTimes);
const maxGenTime = Math.max(...generationTimes);

console.log(`\nGeneration time statistics (excluding cache hits):`);
console.log(`  Average: ${avgGenTime.toFixed(2)}ms`);
console.log(`  Min: ${minGenTime.toFixed(2)}ms`);
console.log(`  Max: ${maxGenTime.toFixed(2)}ms`);
console.log(`  Target: <100ms - ${avgGenTime < 100 ? 'PASS ✓' : 'FAIL ✗'}`);
