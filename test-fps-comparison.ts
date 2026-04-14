/**
 * FPS Comparison Test - Incremental vs Standard Generation
 * 
 * This test measures FPS during chunk loading with both generation modes
 * to verify that incremental generation provides better responsiveness.
 */

import { ChunkManager, WorldConfig, BiomeType, ResourceType, StructureType } from './src/index';

// Test configuration
const config: WorldConfig = {
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
        rarity: 0.1,
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 10,
        maxAmount: 50,
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
          { type: 'biome' as const, params: { biomes: [BiomeType.PLAINS, BiomeType.FOREST] } },
          { type: 'slope' as const, params: { maxSlope: 0.1 } },
        ],
      },
    ],
    minDistance: 10,
    maxAttempts: 30,
  },
  riverConfig: {
    sourceElevation: 0.6,
    minFlowLength: 5,
    flowWidth: 2,
  },
  incrementalConfig: {
    enabled: false, // Will toggle this
    timeBudgetMs: 16, // 60 FPS target
  },
};

interface FPSMetrics {
  avgFPS: number;
  minFPS: number;
  maxFPS: number;
  totalTime: number;
  frameCount: number;
  frameTimes: number[];
}

/**
 * Simulate frame rendering and measure FPS
 */
function simulateFrames(chunkManager: ChunkManager, chunks: Array<{ x: number; y: number }>, incrementalEnabled: boolean): FPSMetrics {
  const frameTimes: number[] = [];
  let lastFrameTime = performance.now();
  let frameCount = 0;
  const maxFrames = 100; // Simulate 100 frames
  
  // Track chunk completion
  const completedChunks = new Set<string>();
  
  while (frameCount < maxFrames) {
    const frameStartTime = performance.now();
    
    // Simulate frame work
    if (incrementalEnabled) {
      // Continue incremental generation for incomplete chunks
      for (const chunk of chunks) {
        const key = `${chunk.x},${chunk.y}`;
        if (completedChunks.has(key)) continue;
        
        const stage = chunkManager.getGenerationStage(chunk.x, chunk.y);
        if (stage === 5) { // COMPLETE
          completedChunks.add(key);
          continue;
        }
        
        // Continue generation (respects time budget)
        chunkManager.continueGeneration(chunk.x, chunk.y);
      }
    } else {
      // Standard generation - all chunks generated immediately (blocking)
      if (frameCount === 0) {
        for (const chunk of chunks) {
          chunkManager.getChunk(chunk.x, chunk.y);
        }
      }
    }
    
    // Calculate frame time
    const frameEndTime = performance.now();
    const frameTime = frameEndTime - frameStartTime;
    frameTimes.push(frameTime);
    
    frameCount++;
    
    // Stop if all chunks complete (for incremental mode)
    if (incrementalEnabled && completedChunks.size === chunks.length) {
      break;
    }
  }
  
  // Calculate FPS metrics
  const totalTime = frameTimes.reduce((sum, time) => sum + time, 0);
  const avgFrameTime = totalTime / frameTimes.length;
  const avgFPS = 1000 / avgFrameTime;
  const minFrameTime = Math.max(...frameTimes);
  const maxFrameTime = Math.min(...frameTimes);
  const minFPS = 1000 / minFrameTime;
  const maxFPS = 1000 / maxFrameTime;
  
  return {
    avgFPS,
    minFPS,
    maxFPS,
    totalTime,
    frameCount: frameTimes.length,
    frameTimes,
  };
}

/**
 * Run FPS comparison test
 */
async function runFPSComparison() {
  console.log('=== FPS Comparison: Incremental vs Standard Generation ===\n');
  
  // Define chunks to load (3x3 grid)
  const chunks: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      chunks.push({ x, y });
    }
  }
  
  console.log(`Loading ${chunks.length} chunks (3x3 grid)\n`);
  
  // Test 1: Standard Generation (incremental disabled)
  console.log('--- Test 1: Standard Generation (Blocking) ---');
  const standardConfig = { ...config, incrementalConfig: { enabled: false, timeBudgetMs: 16 } };
  const standardManager = new ChunkManager(standardConfig);
  
  const standardMetrics = simulateFrames(standardManager, chunks, false);
  
  console.log(`Average FPS: ${standardMetrics.avgFPS.toFixed(2)}`);
  console.log(`Min FPS: ${standardMetrics.minFPS.toFixed(2)}`);
  console.log(`Max FPS: ${standardMetrics.maxFPS.toFixed(2)}`);
  console.log(`Total Time: ${standardMetrics.totalTime.toFixed(2)}ms`);
  console.log(`Frame Count: ${standardMetrics.frameCount}`);
  console.log(`First Frame Time: ${standardMetrics.frameTimes[0].toFixed(2)}ms (blocking generation)`);
  console.log();
  
  // Test 2: Incremental Generation (incremental enabled)
  console.log('--- Test 2: Incremental Generation (Non-Blocking) ---');
  const incrementalConfig = { ...config, incrementalConfig: { enabled: true, timeBudgetMs: 16 } };
  const incrementalManager = new ChunkManager(incrementalConfig);
  
  // Start incremental generation for all chunks
  for (const chunk of chunks) {
    incrementalManager.getChunkIncremental(chunk.x, chunk.y);
  }
  
  const incrementalMetrics = simulateFrames(incrementalManager, chunks, true);
  
  console.log(`Average FPS: ${incrementalMetrics.avgFPS.toFixed(2)}`);
  console.log(`Min FPS: ${incrementalMetrics.minFPS.toFixed(2)}`);
  console.log(`Max FPS: ${incrementalMetrics.maxFPS.toFixed(2)}`);
  console.log(`Total Time: ${incrementalMetrics.totalTime.toFixed(2)}ms`);
  console.log(`Frame Count: ${incrementalMetrics.frameCount}`);
  console.log(`First Frame Time: ${incrementalMetrics.frameTimes[0].toFixed(2)}ms (incremental)`);
  console.log();
  
  // Comparison
  console.log('--- Comparison ---');
  const avgFPSImprovement = ((incrementalMetrics.avgFPS - standardMetrics.avgFPS) / standardMetrics.avgFPS) * 100;
  const minFPSImprovement = ((incrementalMetrics.minFPS - standardMetrics.minFPS) / standardMetrics.minFPS) * 100;
  
  console.log(`Average FPS Improvement: ${avgFPSImprovement > 0 ? '+' : ''}${avgFPSImprovement.toFixed(2)}%`);
  console.log(`Min FPS Improvement: ${minFPSImprovement > 0 ? '+' : ''}${minFPSImprovement.toFixed(2)}%`);
  console.log(`First Frame Time Reduction: ${((standardMetrics.frameTimes[0] - incrementalMetrics.frameTimes[0]) / standardMetrics.frameTimes[0] * 100).toFixed(2)}%`);
  
  // Analysis
  console.log();
  console.log('--- Analysis ---');
  if (incrementalMetrics.minFPS > standardMetrics.minFPS) {
    console.log('✓ Incremental generation provides better minimum FPS (less stuttering)');
  } else {
    console.log('✗ Incremental generation has worse minimum FPS');
  }
  
  if (incrementalMetrics.avgFPS > standardMetrics.avgFPS) {
    console.log('✓ Incremental generation provides better average FPS');
  } else {
    console.log('✗ Incremental generation has worse average FPS');
  }
  
  if (incrementalMetrics.frameTimes[0] < standardMetrics.frameTimes[0]) {
    console.log('✓ Incremental generation has faster first frame (better responsiveness)');
  } else {
    console.log('✗ Incremental generation has slower first frame');
  }
  
  // Frame time distribution
  console.log();
  console.log('--- Frame Time Distribution ---');
  const standardFramesOver16ms = standardMetrics.frameTimes.filter(t => t > 16).length;
  const incrementalFramesOver16ms = incrementalMetrics.frameTimes.filter(t => t > 16).length;
  
  console.log(`Standard: ${standardFramesOver16ms}/${standardMetrics.frameCount} frames exceeded 16ms (${(standardFramesOver16ms / standardMetrics.frameCount * 100).toFixed(1)}%)`);
  console.log(`Incremental: ${incrementalFramesOver16ms}/${incrementalMetrics.frameCount} frames exceeded 16ms (${(incrementalFramesOver16ms / incrementalMetrics.frameCount * 100).toFixed(1)}%)`);
}

// Run the test
runFPSComparison().catch(console.error);
