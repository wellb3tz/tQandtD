/**
 * FPS Performance Test: Incremental vs Standard Generation
 * Tests whether incremental generation actually improves FPS during chunk loading
 */

import { ChunkManager, WorldConfig } from './src/world/chunk-manager';

const baseConfig: WorldConfig = {
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
  maxCacheSize: 100,
  enablePerformanceMetrics: false
};

// Simulate frame timing
class FrameSimulator {
  private frameCount = 0;
  private frameTimes: number[] = [];
  private lastFrameTime = performance.now();
  
  simulateFrame(workCallback: () => void): void {
    const frameStart = performance.now();
    
    // Simulate frame work (rendering, etc.)
    const renderTime = 2; // Assume 2ms for rendering
    const busyWait = performance.now() + renderTime;
    while (performance.now() < busyWait) {
      // Busy wait to simulate rendering work
    }
    
    // Do the actual work (chunk generation)
    workCallback();
    
    const frameEnd = performance.now();
    const frameTime = frameEnd - frameStart;
    this.frameTimes.push(frameTime);
    this.frameCount++;
    this.lastFrameTime = frameEnd;
  }
  
  getStats() {
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const avgFPS = 1000 / avgFrameTime;
    const minFrameTime = Math.min(...this.frameTimes);
    const maxFrameTime = Math.max(...this.frameTimes);
    const minFPS = 1000 / maxFrameTime;
    const maxFPS = 1000 / minFrameTime;
    
    // Count frames below 60 FPS (16.67ms)
    const framesBelow60 = this.frameTimes.filter(t => t > 16.67).length;
    const percentBelow60 = (framesBelow60 / this.frameTimes.length) * 100;
    
    // Count frames below 30 FPS (33.33ms)
    const framesBelow30 = this.frameTimes.filter(t => t > 33.33).length;
    const percentBelow30 = (framesBelow30 / this.frameTimes.length) * 100;
    
    return {
      frameCount: this.frameCount,
      avgFrameTime: avgFrameTime.toFixed(2),
      avgFPS: avgFPS.toFixed(2),
      minFPS: minFPS.toFixed(2),
      maxFPS: maxFPS.toFixed(2),
      framesBelow60,
      percentBelow60: percentBelow60.toFixed(1),
      framesBelow30,
      percentBelow30: percentBelow30.toFixed(1)
    };
  }
}

console.log('=== FPS PERFORMANCE TEST: INCREMENTAL VS STANDARD ===\n');

// Test 1: Standard Generation (No Incremental)
console.log('Test 1: Standard Generation (Baseline)');
console.log('Loading 9 chunks (3x3 grid) in standard mode...\n');

const standardConfig = { ...baseConfig };
const standardManager = new ChunkManager(standardConfig);
const standardSim = new FrameSimulator();

const standardStart = performance.now();

// Simulate loading chunks in a render loop
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    standardSim.simulateFrame(() => {
      // Standard generation: entire chunk in one frame
      standardManager.getChunk(dx, dy);
    });
  }
}

const standardEnd = performance.now();
const standardTotal = standardEnd - standardStart;

const standardStats = standardSim.getStats();
console.log('Standard Generation Results:');
console.log(`  Total Time: ${standardTotal.toFixed(2)}ms`);
console.log(`  Frames: ${standardStats.frameCount}`);
console.log(`  Avg Frame Time: ${standardStats.avgFrameTime}ms`);
console.log(`  Avg FPS: ${standardStats.avgFPS}`);
console.log(`  Min FPS: ${standardStats.minFPS}`);
console.log(`  Max FPS: ${standardStats.maxFPS}`);
console.log(`  Frames Below 60 FPS: ${standardStats.framesBelow60} (${standardStats.percentBelow60}%)`);
console.log(`  Frames Below 30 FPS: ${standardStats.framesBelow30} (${standardStats.percentBelow30}%)`);
console.log();

// Test 2: Incremental Generation (Current Broken Implementation)
console.log('Test 2: Incremental Generation (Current Implementation)');
console.log('Loading 9 chunks (3x3 grid) with incremental generation...\n');

const incrementalConfig = { 
  ...baseConfig, 
  incrementalConfig: { enabled: true, timeBudgetMs: 16 } 
};
const incrementalManager = new ChunkManager(incrementalConfig);
const incrementalSim = new FrameSimulator();

const incrementalStart = performance.now();

// Track chunks in progress
const chunksInProgress = new Map<string, boolean>();

// Start all chunks
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    incrementalManager.getChunkIncremental(dx, dy);
    chunksInProgress.set(`${dx},${dy}`, true);
  }
}

// Simulate render loop with continueGeneration
let maxIterations = 1000;
let iterations = 0;

while (chunksInProgress.size > 0 && iterations < maxIterations) {
  incrementalSim.simulateFrame(() => {
    // Process up to 3 chunks per frame (like DemoApp does)
    let processed = 0;
    const maxPerFrame = 3;
    
    for (const [key, _] of chunksInProgress.entries()) {
      if (processed >= maxPerFrame) break;
      
      const [x, y] = key.split(',').map(Number);
      
      try {
        const complete = incrementalManager.continueGeneration(x, y);
        
        if (complete) {
          chunksInProgress.delete(key);
        }
        
        processed++;
      } catch (error) {
        // If error, remove from progress
        chunksInProgress.delete(key);
        processed++;
      }
    }
  });
  
  iterations++;
}

const incrementalEnd = performance.now();
const incrementalTotal = incrementalEnd - incrementalStart;

const incrementalStats = incrementalSim.getStats();
console.log('Incremental Generation Results:');
console.log(`  Total Time: ${incrementalTotal.toFixed(2)}ms`);
console.log(`  Frames: ${incrementalStats.frameCount}`);
console.log(`  Avg Frame Time: ${incrementalStats.avgFrameTime}ms`);
console.log(`  Avg FPS: ${incrementalStats.avgFPS}`);
console.log(`  Min FPS: ${incrementalStats.minFPS}`);
console.log(`  Max FPS: ${incrementalStats.maxFPS}`);
console.log(`  Frames Below 60 FPS: ${incrementalStats.framesBelow60} (${incrementalStats.percentBelow60}%)`);
console.log(`  Frames Below 30 FPS: ${incrementalStats.framesBelow30} (${incrementalStats.percentBelow30}%)`);
console.log(`  Chunks Completed: ${9 - chunksInProgress.size}/9`);
console.log(`  Iterations: ${iterations}`);
console.log();

// Comparison
console.log('=== COMPARISON ===\n');

const avgFPSDiff = parseFloat(incrementalStats.avgFPS) - parseFloat(standardStats.avgFPS);
const minFPSDiff = parseFloat(incrementalStats.minFPS) - parseFloat(standardStats.minFPS);
const totalTimeDiff = incrementalTotal - standardTotal;
const below60Diff = parseFloat(incrementalStats.percentBelow60) - parseFloat(standardStats.percentBelow60);

console.log(`Average FPS: ${avgFPSDiff > 0 ? '+' : ''}${avgFPSDiff.toFixed(2)} (${avgFPSDiff > 0 ? 'BETTER' : 'WORSE'})`);
console.log(`Minimum FPS: ${minFPSDiff > 0 ? '+' : ''}${minFPSDiff.toFixed(2)} (${minFPSDiff > 0 ? 'BETTER' : 'WORSE'})`);
console.log(`Total Time: ${totalTimeDiff > 0 ? '+' : ''}${totalTimeDiff.toFixed(2)}ms (${totalTimeDiff < 0 ? 'FASTER' : 'SLOWER'})`);
console.log(`Frames Below 60 FPS: ${below60Diff > 0 ? '+' : ''}${below60Diff.toFixed(1)}% (${below60Diff < 0 ? 'BETTER' : 'WORSE'})`);
console.log();

// Verdict
console.log('=== VERDICT ===\n');

if (chunksInProgress.size > 0) {
  console.log('❌ CRITICAL: Incremental generation FAILED to complete all chunks!');
  console.log(`   ${chunksInProgress.size} chunks stuck in infinite loop`);
  console.log('   This confirms the infinite loop bug found in diagnostic.');
  console.log();
}

if (avgFPSDiff > 5) {
  console.log('✓ Incremental generation provides BETTER average FPS');
} else if (avgFPSDiff < -5) {
  console.log('✗ Incremental generation provides WORSE average FPS');
} else {
  console.log('≈ Incremental generation has SIMILAR average FPS');
}

if (minFPSDiff > 5) {
  console.log('✓ Incremental generation provides BETTER minimum FPS (less stuttering)');
} else if (minFPSDiff < -5) {
  console.log('✗ Incremental generation provides WORSE minimum FPS (more stuttering)');
} else {
  console.log('≈ Incremental generation has SIMILAR minimum FPS');
}

if (totalTimeDiff < -100) {
  console.log('✓ Incremental generation completes FASTER overall');
} else if (totalTimeDiff > 100) {
  console.log('✗ Incremental generation completes SLOWER overall');
} else {
  console.log('≈ Incremental generation has SIMILAR total time');
}

console.log();
console.log('CONCLUSION:');
if (chunksInProgress.size > 0) {
  console.log('The incremental generation system is BROKEN and cannot complete chunk generation.');
  console.log('It gets stuck in infinite loops due to the bugs identified in the diagnostic.');
  console.log('FPS comparison is meaningless until the infinite loop bug is fixed.');
} else if (avgFPSDiff > 5 && minFPSDiff > 5) {
  console.log('Incremental generation DOES improve FPS during chunk loading.');
  console.log('However, it needs the bug fixes to work correctly.');
} else if (avgFPSDiff < -5 || minFPSDiff < -5) {
  console.log('Incremental generation DOES NOT improve FPS during chunk loading.');
  console.log('The overhead of incremental processing may outweigh the benefits.');
} else {
  console.log('Incremental generation has MINIMAL impact on FPS.');
  console.log('The benefits may not justify the complexity.');
}
