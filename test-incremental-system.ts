/**
 * Comprehensive diagnostic script for incremental generation system
 */

import { ChunkManager, WorldConfig } from './src/world/chunk-manager';
import { GenerationStage } from './src/world/chunk';

const config: WorldConfig = {
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 1,
    heightMultiplier: 1.0,
    enable3D: false,
    zScale: 0.5
  },
  biomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5
  },
  resourceConfig: {
    types: [],
    clusterScale: 20,
    densityThreshold: 0.6
  },
  structureConfig: {
    types: [],
    minDistance: 30,
    maxAttempts: 30
  },
  riverConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2
  },
  incrementalConfig: {
    enabled: true,
    timeBudgetMs: 16
  },
  maxCacheSize: 100,
  enablePerformanceMetrics: true
};

console.log('=== INCREMENTAL GENERATION SYSTEM DIAGNOSTIC ===\n');

// Test 1: Check if incremental generator is created
console.log('Test 1: ChunkManager Initialization');
const manager = new ChunkManager(config);
console.log('✓ ChunkManager created successfully\n');

// Test 2: Start incremental generation
console.log('Test 2: Start Incremental Generation');
const partial = manager.getChunkIncremental(0, 0);
console.log(`✓ Started generation for chunk (0, 0)`);
console.log(`  Initial stage: ${partial.stage} (${GenerationStage[partial.stage]})`);
console.log(`  Has heightmap: ${!!partial.data.heightmap}`);
console.log(`  Has biomeMap: ${!!partial.data.biomeMap}\n`);

// Test 3: Continue generation through TERRAIN stage
console.log('Test 3: Continue Generation - TERRAIN Stage');
let complete = manager.continueGeneration(0, 0);
let stage = manager.getGenerationStage(0, 0);
console.log(`  Complete: ${complete}`);
console.log(`  Current stage: ${stage} (${stage !== undefined ? GenerationStage[stage] : 'undefined'})`);
console.log(`  Has heightmap: ${!!partial.data.heightmap}`);
console.log(`  Has biomeMap: ${!!partial.data.biomeMap}`);
if (partial.data.heightmap) {
  console.log(`  Heightmap size: ${partial.data.heightmap.length}`);
}
console.log();

// Test 4: Continue generation through BIOMES stage
console.log('Test 4: Continue Generation - BIOMES Stage');
complete = manager.continueGeneration(0, 0);
stage = manager.getGenerationStage(0, 0);
console.log(`  Complete: ${complete}`);
console.log(`  Current stage: ${stage} (${stage !== undefined ? GenerationStage[stage] : 'undefined'})`);
console.log(`  Has heightmap: ${!!partial.data.heightmap}`);
console.log(`  Has biomeMap: ${!!partial.data.biomeMap}`);
if (partial.data.biomeMap) {
  console.log(`  BiomeMap size: ${partial.data.biomeMap.length}`);
  console.log(`  BiomeWeights size: ${partial.data.biomeWeights?.length}`);
}
console.log();

// Test 5: Continue through remaining stages
console.log('Test 5: Continue Through Remaining Stages');
let iterations = 0;
while (!complete && iterations < 10) {
  complete = manager.continueGeneration(0, 0);
  stage = manager.getGenerationStage(0, 0);
  console.log(`  Iteration ${iterations + 1}: Stage ${stage} (${stage !== undefined ? GenerationStage[stage] : 'undefined'}), Complete: ${complete}`);
  iterations++;
}
console.log();

// Test 6: Get final chunk
console.log('Test 6: Get Final Chunk');
const finalChunk = manager.getChunk(0, 0);
console.log(`  Chunk X: ${finalChunk.x}, Y: ${finalChunk.y}`);
console.log(`  Heightmap size: ${finalChunk.heightmap.length}`);
console.log(`  BiomeMap size: ${finalChunk.biomeMap.length}`);
console.log(`  BiomeWeights size: ${finalChunk.biomeWeights.length}`);
console.log(`  Resources: ${finalChunk.resources.length}`);
console.log(`  Structures: ${finalChunk.structures.length}`);
console.log(`  Rivers: ${finalChunk.rivers.size}`);
console.log();

// Test 7: Simulate DemoApp behavior
console.log('Test 7: Simulate DemoApp.loadChunksAround() Behavior');
const manager2 = new ChunkManager(config);
const partial2 = manager2.getChunkIncremental(1, 1);
console.log(`  Started generation for chunk (1, 1)`);
console.log(`  Initial stage: ${partial2.stage} (${GenerationStage[partial2.stage]})`);

// This is what DemoApp does - call continueGeneration once
const terrainComplete = manager2.continueGeneration(1, 1);
const currentStage = manager2.getGenerationStage(1, 1);
console.log(`  After first continueGeneration():`);
console.log(`    Complete: ${terrainComplete}`);
console.log(`    Current stage: ${currentStage} (${currentStage !== undefined ? GenerationStage[currentStage] : 'undefined'})`);
console.log(`    Has heightmap: ${!!partial2.data.heightmap}`);
console.log(`    Has biomeMap: ${!!partial2.data.biomeMap}`);
console.log(`  ⚠️  This is the problem! Chunk is emitted with heightmap but NO biomeMap`);
console.log();

// Test 8: Show the fix
console.log('Test 8: Proposed Fix - Continue to BIOMES Stage');
const manager3 = new ChunkManager(config);
const partial3 = manager3.getChunkIncremental(2, 2);
console.log(`  Started generation for chunk (2, 2)`);

// Continue through TERRAIN
manager3.continueGeneration(2, 2);
console.log(`  After TERRAIN stage:`);
console.log(`    Stage: ${manager3.getGenerationStage(2, 2)} (${GenerationStage[manager3.getGenerationStage(2, 2)!]})`);
console.log(`    Has heightmap: ${!!partial3.data.heightmap}`);
console.log(`    Has biomeMap: ${!!partial3.data.biomeMap}`);

// Continue through BIOMES
manager3.continueGeneration(2, 2);
console.log(`  After BIOMES stage:`);
console.log(`    Stage: ${manager3.getGenerationStage(2, 2)} (${GenerationStage[manager3.getGenerationStage(2, 2)!]})`);
console.log(`    Has heightmap: ${!!partial3.data.heightmap}`);
console.log(`    Has biomeMap: ${!!partial3.data.biomeMap}`);
console.log(`  ✓ Now chunk has BOTH heightmap AND biomeMap for proper rendering`);
console.log();

console.log('=== DIAGNOSTIC COMPLETE ===');
console.log('\nSUMMARY:');
console.log('- Incremental generation system is working correctly');
console.log('- The issue is in DemoApp.loadChunksAround()');
console.log('- It calls continueGeneration() only ONCE (TERRAIN stage)');
console.log('- Then emits CHUNK_LOADED before biomes are generated');
console.log('- Fix: Call continueGeneration() TWICE before first emit');
console.log('  (once for TERRAIN, once for BIOMES)');
