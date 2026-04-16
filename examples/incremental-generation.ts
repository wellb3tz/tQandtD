/**
 * Incremental Generation Example
 * 
 * Demonstrates how to use incremental chunk generation to maintain responsiveness
 * during world generation. Incremental generation divides chunk generation into
 * discrete stages that respect time budgets, allowing the main thread to remain
 * responsive.
 */

import {
  ChunkManager,
  BiomeType,
  ResourceType,
  StructureType,
  GenerationStage,
  type PartialChunkData,
} from '../src/index';

// Configure world with incremental generation enabled
const config = {
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
          { type: 'biome' as const, params: { biomes: [BiomeType.PLAINS] } },
          { type: 'slope' as const, params: { maxSlope: 0.1 } },
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
  // Enable incremental generation with 16ms time budget (60fps)
  incrementalConfig: {
    enabled: true,
    timeBudgetMs: 16,
  },
};

const manager = new ChunkManager(config);

// Example 1: Basic incremental generation
console.log('Example 1: Basic incremental generation');
console.log('========================================');

const partial = manager.getChunkIncremental(0, 0);
console.log(`Started generation for chunk (${partial.x}, ${partial.y})`);
console.log(`Initial stage: ${GenerationStage[partial.stage]}`);

// Continue generation until complete
let complete = false;
let iterations = 0;
while (!complete) {
  complete = manager.continueGeneration(0, 0);
  iterations++;
  console.log(`Iteration ${iterations}: Stage ${GenerationStage[partial.stage]}`);
  
  // Access partial data as it becomes available
  if (partial.stage >= GenerationStage.TERRAIN && partial.data.heightmap) {
    console.log(`  - Heightmap available: ${partial.data.heightmap.length} values`);
  }
  if (partial.stage >= GenerationStage.BIOMES && partial.data.biomeMap) {
    console.log(`  - Biome map available: ${partial.data.biomeMap.length} values`);
  }
  if (partial.stage >= GenerationStage.RESOURCES && partial.data.resources) {
    console.log(`  - Resources available: ${partial.data.resources.length} resources`);
  }
  if (partial.stage >= GenerationStage.STRUCTURES && partial.data.structures) {
    console.log(`  - Structures available: ${partial.data.structures.length} structures`);
  }
}

console.log(`\nGeneration complete after ${iterations} iterations`);
console.log(`Final chunk data:`, {
  heightmapSize: partial.data.heightmap?.length,
  biomeMapSize: partial.data.biomeMap?.length,
  resourceCount: partial.data.resources?.length,
  structureCount: partial.data.structures?.length,
  riverCount: partial.data.rivers?.size,
});

// Example 2: Parallel incremental generation
console.log('\n\nExample 2: Parallel incremental generation');
console.log('===========================================');

const chunks = [
  manager.getChunkIncremental(1, 0),
  manager.getChunkIncremental(2, 0),
  manager.getChunkIncremental(3, 0),
];

console.log(`Started generation for ${chunks.length} chunks`);

// Continue all chunks in parallel
let allComplete = false;
let parallelIterations = 0;
while (!allComplete) {
  parallelIterations++;
  allComplete = true;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.stage < GenerationStage.COMPLETE) {
      const complete = manager.continueGeneration(chunk.x, chunk.y);
      if (!complete) {
        allComplete = false;
      }
    }
  }
  
  if (parallelIterations % 5 === 0) {
    console.log(`Iteration ${parallelIterations}:`);
    chunks.forEach((chunk, i) => {
      console.log(`  Chunk ${i} (${chunk.x}, ${chunk.y}): ${GenerationStage[chunk.stage]}`);
    });
  }
}

console.log(`\nAll chunks complete after ${parallelIterations} iterations`);

// Example 3: Cancelling incremental generation
console.log('\n\nExample 3: Cancelling incremental generation');
console.log('=============================================');

const cancelChunk = manager.getChunkIncremental(10, 10);
console.log(`Started generation for chunk (${cancelChunk.x}, ${cancelChunk.y})`);

// Continue for a few iterations
for (let i = 0; i < 2; i++) {
  manager.continueGeneration(10, 10);
  console.log(`Iteration ${i + 1}: Stage ${GenerationStage[cancelChunk.stage]}`);
}

// Cancel generation
manager.cancelIncrementalGeneration(10, 10);
console.log('Generation cancelled');

const stage = manager.getGenerationStage(10, 10);
console.log(`Stage after cancellation: ${stage === undefined ? 'undefined (cancelled)' : GenerationStage[stage]}`);

// Example 4: Monitoring generation progress
console.log('\n\nExample 4: Monitoring generation progress');
console.log('==========================================');

const monitoredChunk = manager.getChunkIncremental(20, 20);
console.log(`Started generation for chunk (${monitoredChunk.x}, ${monitoredChunk.y})`);

const stageNames = [
  'TERRAIN',
  'BIOMES',
  'RIVERS',
  'RESOURCES',
  'STRUCTURES',
  'COMPLETE',
];

let previousStage = -1;
complete = false;
while (!complete) {
  complete = manager.continueGeneration(20, 20);
  
  const currentStage = manager.getGenerationStage(20, 20);
  if (currentStage !== undefined && currentStage !== previousStage) {
    const progress = (currentStage / GenerationStage.COMPLETE) * 100;
    console.log(`Progress: ${progress.toFixed(1)}% - ${stageNames[currentStage]}`);
    previousStage = currentStage;
  }
}

console.log('Generation complete!');

// Example 5: Using incremental generation in a game loop
console.log('\n\nExample 5: Game loop integration pattern');
console.log('=========================================');

// Simulate a game loop with frame budget
const FRAME_BUDGET_MS = 16; // 60fps
const activeChunks = new Map<string, PartialChunkData>();

// Start generation for multiple chunks
for (let x = 0; x < 3; x++) {
  for (let y = 0; y < 3; y++) {
    const key = `${x},${y}`;
    activeChunks.set(key, manager.getChunkIncremental(x + 30, y + 30));
  }
}

console.log(`Started generation for ${activeChunks.size} chunks`);

// Simulate game loop frames
let frame = 0;
while (activeChunks.size > 0) {
  frame++;
  const frameStart = performance.now();
  
  // Process chunks until frame budget is exhausted
  for (const [key, chunk] of activeChunks.entries()) {
    if (chunk.stage >= GenerationStage.COMPLETE) {
      activeChunks.delete(key);
      continue;
    }
    
    // Continue generation for this chunk
    const complete = manager.continueGeneration(chunk.x, chunk.y);
    if (complete) {
      activeChunks.delete(key);
    }
    
    // Check frame budget
    const elapsed = performance.now() - frameStart;
    if (elapsed >= FRAME_BUDGET_MS) {
      break; // Yield to next frame
    }
  }
  
  if (frame % 10 === 0) {
    console.log(`Frame ${frame}: ${activeChunks.size} chunks remaining`);
  }
}

console.log(`\nAll chunks generated in ${frame} frames`);
console.log('Game loop remained responsive throughout generation!');
