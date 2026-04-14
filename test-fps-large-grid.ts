/**
 * Large Grid FPS Comparison
 * 
 * Tests with a 5x5 grid (25 chunks) to show incremental benefits
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

function simulateRenderingWork() {
  const start = performance.now();
  while (performance.now() - start < 5) {
    // Busy wait
  }
}

function testMode(gridSize: number, incremental: boolean) {
  const mode = incremental ? 'Incremental' : 'Standard';
  console.log(`\n=== ${mode} Generation (${gridSize}x${gridSize} = ${gridSize * gridSize} chunks) ===`);
  
  const manager = new ChunkManager({
    ...config,
    incrementalConfig: { enabled: incremental, timeBudgetMs: 8 }
  });
  
  const chunks: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      chunks.push({ x, y });
    }
  }
  
  const frameTimes: number[] = [];
  let generationComplete = false;
  let frameCount = 0;
  
  if (incremental) {
    // Start incremental generation
    for (const chunk of chunks) {
      manager.getChunkIncremental(chunk.x, chunk.y);
    }
    
    // Simulate frames
    while (!generationComplete && frameCount < 200) {
      const frameStart = performance.now();
      
      let completedCount = 0;
      for (const chunk of chunks) {
        const stage = manager.getGenerationStage(chunk.x, chunk.y);
        if (stage === 5) {
          completedCount++;
        } else {
          manager.continueGeneration(chunk.x, chunk.y);
        }
      }
      
      simulateRenderingWork();
      frameTimes.push(performance.now() - frameStart);
      frameCount++;
      
      generationComplete = completedCount === chunks.length;
    }
  } else {
    // Standard generation - all at once
    const frameStart = performance.now();
    for (const chunk of chunks) {
      manager.getChunk(chunk.x, chunk.y);
    }
    simulateRenderingWork();
    frameTimes.push(performance.now() - frameStart);
    frameCount = 1;
    generationComplete = true;
  }
  
  // Continue for more frames after generation
  for (let i = 0; i < 60; i++) {
    const frameStart = performance.now();
    simulateRenderingWork();
    frameTimes.push(performance.now() - frameStart);
  }
  
  const avgFPS = 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length);
  const minFPS = 1000 / Math.max(...frameTimes);
  const maxFPS = 1000 / Math.min(...frameTimes);
  const framesOver16 = frameTimes.filter(t => t > 16).length;
  const framesOver33 = frameTimes.filter(t => t > 33).length;
  const framesOver100 = frameTimes.filter(t => t > 100).length;
  
  console.log(`First Frame: ${frameTimes[0].toFixed(2)}ms`);
  console.log(`Frames to Complete: ${frameCount}`);
  console.log(`Average FPS: ${avgFPS.toFixed(2)}`);
  console.log(`Min FPS: ${minFPS.toFixed(2)}`);
  console.log(`Max FPS: ${maxFPS.toFixed(2)}`);
  console.log(`Frames > 16ms (< 60 FPS): ${framesOver16}/${frameTimes.length} (${(framesOver16 / frameTimes.length * 100).toFixed(1)}%)`);
  console.log(`Frames > 33ms (< 30 FPS): ${framesOver33}/${frameTimes.length} (${(framesOver33 / frameTimes.length * 100).toFixed(1)}%)`);
  console.log(`Frames > 100ms (< 10 FPS): ${framesOver100}/${frameTimes.length} (${(framesOver100 / frameTimes.length * 100).toFixed(1)}%)`);
  
  return { frameTimes, avgFPS, minFPS, maxFPS, frameCount, framesOver16, framesOver33, framesOver100 };
}

console.log('='.repeat(70));
console.log('FPS COMPARISON: Standard vs Incremental Generation');
console.log('Simulating 5ms rendering work per frame');
console.log('='.repeat(70));

// Test with 3x3 grid
console.log('\n--- Small Grid (3x3 = 9 chunks) ---');
const small3x3 = testMode(3, false);
const smallInc3x3 = testMode(3, true);

console.log('\n📊 3x3 Grid Comparison:');
console.log(`  First Frame: ${small3x3.frameTimes[0].toFixed(0)}ms → ${smallInc3x3.frameTimes[0].toFixed(0)}ms (${((small3x3.frameTimes[0] - smallInc3x3.frameTimes[0]) / small3x3.frameTimes[0] * 100).toFixed(1)}% faster)`);
console.log(`  Min FPS: ${small3x3.minFPS.toFixed(1)} → ${smallInc3x3.minFPS.toFixed(1)} (${((smallInc3x3.minFPS - small3x3.minFPS) / small3x3.minFPS * 100).toFixed(1)}% better)`);
console.log(`  Frames < 60 FPS: ${small3x3.framesOver16} → ${smallInc3x3.framesOver16}`);

// Test with 5x5 grid
console.log('\n--- Medium Grid (5x5 = 25 chunks) ---');
const medium5x5 = testMode(5, false);
const mediumInc5x5 = testMode(5, true);

console.log('\n📊 5x5 Grid Comparison:');
console.log(`  First Frame: ${medium5x5.frameTimes[0].toFixed(0)}ms → ${mediumInc5x5.frameTimes[0].toFixed(0)}ms (${((medium5x5.frameTimes[0] - mediumInc5x5.frameTimes[0]) / medium5x5.frameTimes[0] * 100).toFixed(1)}% faster)`);
console.log(`  Min FPS: ${medium5x5.minFPS.toFixed(1)} → ${mediumInc5x5.minFPS.toFixed(1)} (${((mediumInc5x5.minFPS - medium5x5.minFPS) / medium5x5.minFPS * 100).toFixed(1)}% better)`);
console.log(`  Frames < 60 FPS: ${medium5x5.framesOver16} → ${mediumInc5x5.framesOver16}`);
console.log(`  Frames < 30 FPS: ${medium5x5.framesOver33} → ${mediumInc5x5.framesOver33}`);
console.log(`  Frames < 10 FPS: ${medium5x5.framesOver100} → ${mediumInc5x5.framesOver100}`);

console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

if (mediumInc5x5.minFPS > medium5x5.minFPS) {
  console.log('✓ Incremental generation provides better minimum FPS');
}
if (mediumInc5x5.frameTimes[0] < medium5x5.frameTimes[0]) {
  console.log('✓ Incremental generation has faster first frame');
}
if (mediumInc5x5.framesOver100 < medium5x5.framesOver100) {
  console.log('✓ Incremental generation reduces severe stuttering (< 10 FPS frames)');
}
if (mediumInc5x5.framesOver33 < medium5x5.framesOver33) {
  console.log('✓ Incremental generation reduces noticeable stuttering (< 30 FPS frames)');
}

console.log('\nIncremental generation spreads work across multiple frames,');
console.log('providing smoother experience during chunk loading.');
