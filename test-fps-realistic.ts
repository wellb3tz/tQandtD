/**
 * Realistic FPS Comparison Test
 * 
 * Simulates actual rendering workload during chunk loading
 */

import { ChunkManager, WorldConfig, BiomeType, ResourceType, StructureType } from './src/index';

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
    enabled: false,
    timeBudgetMs: 16,
  },
};

/**
 * Simulate rendering workload (5ms per frame)
 */
function simulateRenderingWork() {
  const start = performance.now();
  while (performance.now() - start < 5) {
    // Busy wait to simulate rendering
  }
}

/**
 * Test standard generation with rendering
 */
function testStandardGeneration() {
  console.log('=== Standard Generation (Blocking) ===');
  const manager = new ChunkManager({ ...config, incrementalConfig: { enabled: false, timeBudgetMs: 16 } });
  
  const frameTimes: number[] = [];
  const chunks: Array<{ x: number; y: number }> = [];
  
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      chunks.push({ x, y });
    }
  }
  
  // Frame 1: Generate all chunks (blocking)
  const frame1Start = performance.now();
  for (const chunk of chunks) {
    manager.getChunk(chunk.x, chunk.y);
  }
  simulateRenderingWork();
  const frame1Time = performance.now() - frame1Start;
  frameTimes.push(frame1Time);
  
  // Subsequent frames: Just rendering
  for (let i = 0; i < 60; i++) {
    const frameStart = performance.now();
    simulateRenderingWork();
    frameTimes.push(performance.now() - frameStart);
  }
  
  const avgFPS = 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length);
  const minFPS = 1000 / Math.max(...frameTimes);
  const maxFPS = 1000 / Math.min(...frameTimes);
  
  console.log(`First Frame Time: ${frame1Time.toFixed(2)}ms (includes chunk generation)`);
  console.log(`Average FPS: ${avgFPS.toFixed(2)}`);
  console.log(`Min FPS: ${minFPS.toFixed(2)} (worst frame)`);
  console.log(`Max FPS: ${maxFPS.toFixed(2)}`);
  console.log(`Frames > 16ms: ${frameTimes.filter(t => t > 16).length}/${frameTimes.length}`);
  console.log(`Frames > 33ms: ${frameTimes.filter(t => t > 33).length}/${frameTimes.length} (< 30 FPS)`);
  console.log();
  
  return { frameTimes, avgFPS, minFPS, maxFPS };
}

/**
 * Test incremental generation with rendering
 */
function testIncrementalGeneration() {
  console.log('=== Incremental Generation (Non-Blocking) ===');
  const manager = new ChunkManager({ ...config, incrementalConfig: { enabled: true, timeBudgetMs: 8 } });
  
  const frameTimes: number[] = [];
  const chunks: Array<{ x: number; y: number }> = [];
  
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      chunks.push({ x, y });
    }
  }
  
  // Start incremental generation
  for (const chunk of chunks) {
    manager.getChunkIncremental(chunk.x, chunk.y);
  }
  
  // Simulate frames while generation continues
  let allComplete = false;
  let frameCount = 0;
  
  while (!allComplete && frameCount < 100) {
    const frameStart = performance.now();
    
    // Continue generation for incomplete chunks
    let completedCount = 0;
    for (const chunk of chunks) {
      const stage = manager.getGenerationStage(chunk.x, chunk.y);
      if (stage === 5) {
        completedCount++;
      } else {
        manager.continueGeneration(chunk.x, chunk.y);
      }
    }
    
    // Simulate rendering work
    simulateRenderingWork();
    
    const frameTime = performance.now() - frameStart;
    frameTimes.push(frameTime);
    frameCount++;
    
    allComplete = completedCount === chunks.length;
  }
  
  // Continue for a few more frames after completion
  for (let i = 0; i < 60 - frameCount; i++) {
    const frameStart = performance.now();
    simulateRenderingWork();
    frameTimes.push(performance.now() - frameStart);
  }
  
  const avgFPS = 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length);
  const minFPS = 1000 / Math.max(...frameTimes);
  const maxFPS = 1000 / Math.min(...frameTimes);
  
  console.log(`First Frame Time: ${frameTimes[0].toFixed(2)}ms (incremental start)`);
  console.log(`Frames to Complete: ${frameCount}`);
  console.log(`Average FPS: ${avgFPS.toFixed(2)}`);
  console.log(`Min FPS: ${minFPS.toFixed(2)} (worst frame)`);
  console.log(`Max FPS: ${maxFPS.toFixed(2)}`);
  console.log(`Frames > 16ms: ${frameTimes.filter(t => t > 16).length}/${frameTimes.length}`);
  console.log(`Frames > 33ms: ${frameTimes.filter(t => t > 33).length}/${frameTimes.length} (< 30 FPS)`);
  console.log();
  
  return { frameTimes, avgFPS, minFPS, maxFPS, frameCount };
}

// Run tests
console.log('FPS Comparison: Standard vs Incremental Generation');
console.log('Simulating 5ms rendering work per frame\n');

const standardResults = testStandardGeneration();
const incrementalResults = testIncrementalGeneration();

console.log('=== Comparison ===');
console.log(`First Frame Improvement: ${((standardResults.frameTimes[0] - incrementalResults.frameTimes[0]) / standardResults.frameTimes[0] * 100).toFixed(1)}%`);
console.log(`Min FPS Improvement: ${((incrementalResults.minFPS - standardResults.minFPS) / standardResults.minFPS * 100).toFixed(1)}%`);
console.log(`Average FPS: Standard ${standardResults.avgFPS.toFixed(1)} vs Incremental ${incrementalResults.avgFPS.toFixed(1)}`);
console.log();

if (incrementalResults.minFPS > standardResults.minFPS) {
  console.log('✓ Incremental generation provides better minimum FPS (smoother experience)');
} else {
  console.log('✗ Standard generation has better minimum FPS');
}

if (incrementalResults.frameTimes[0] < standardResults.frameTimes[0]) {
  console.log('✓ Incremental generation has faster first frame (better responsiveness)');
} else {
  console.log('✗ Standard generation has faster first frame');
}

const standardBadFrames = standardResults.frameTimes.filter(t => t > 33).length;
const incrementalBadFrames = incrementalResults.frameTimes.filter(t => t > 33).length;

if (incrementalBadFrames < standardBadFrames) {
  console.log(`✓ Incremental generation has fewer frames below 30 FPS (${incrementalBadFrames} vs ${standardBadFrames})`);
} else {
  console.log(`✗ Standard generation has fewer frames below 30 FPS (${standardBadFrames} vs ${incrementalBadFrames})`);
}
