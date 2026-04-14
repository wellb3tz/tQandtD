/**
 * Test script to verify smooth chunk loading with intra-stage yielding
 * 
 * This test simulates realistic frame-by-frame chunk generation and measures:
 * - Frame times (should be < 16ms for 60 FPS)
 * - Total frames to complete
 * - FPS during loading
 * - Smoothness (no freezing)
 */

import { ChunkManager } from './src/world/chunk-manager';
import { GenerationStage } from './src/world/chunk';

interface FrameMetrics {
  frameNumber: number;
  duration: number;
  stage: GenerationStage;
  fps: number;
}

/**
 * Simulates frame-by-frame chunk generation with realistic rendering overhead
 */
function simulateFrameByFrameGeneration(
  chunkManager: ChunkManager,
  chunkX: number,
  chunkY: number,
  timeBudgetMs: number
): FrameMetrics[] {
  const metrics: FrameMetrics[] = [];
  let frameNumber = 0;
  let complete = false;

  // Start generation
  chunkManager.startIncrementalGeneration(chunkX, chunkY);

  while (!complete) {
    frameNumber++;
    const frameStart = performance.now();

    // Continue generation (respects time budget)
    complete = chunkManager.continueIncrementalGeneration(chunkX, chunkY);

    // Simulate rendering overhead (5ms)
    const renderStart = performance.now();
    while (performance.now() - renderStart < 5) {
      // Busy wait to simulate rendering
    }

    const frameEnd = performance.now();
    const frameDuration = frameEnd - frameStart;
    const fps = 1000 / frameDuration;

    const stage = chunkManager.getIncrementalStage(chunkX, chunkY) || GenerationStage.COMPLETE;

    metrics.push({
      frameNumber,
      duration: frameDuration,
      stage,
      fps,
    });
  }

  return metrics;
}

/**
 * Analyzes frame metrics and reports smoothness
 */
function analyzeMetrics(metrics: FrameMetrics[], timeBudgetMs: number): void {
  const totalFrames = metrics.length;
  const totalTime = metrics.reduce((sum, m) => sum + m.duration, 0);
  const avgFrameTime = totalTime / totalFrames;
  const avgFPS = 1000 / avgFrameTime;

  const maxFrameTime = Math.max(...metrics.map(m => m.duration));
  const minFrameTime = Math.min(...metrics.map(m => m.duration));

  const framesOver16ms = metrics.filter(m => m.duration > 16).length;
  const framesOver8ms = metrics.filter(m => m.duration > 8).length;

  const smoothness = (1 - framesOver16ms / totalFrames) * 100;

  console.log('\n=== Smooth Loading Test Results ===\n');
  console.log(`Time Budget: ${timeBudgetMs}ms`);
  console.log(`Total Frames: ${totalFrames}`);
  console.log(`Total Time: ${totalTime.toFixed(2)}ms`);
  console.log(`\nFrame Times:`);
  console.log(`  Average: ${avgFrameTime.toFixed(2)}ms (${avgFPS.toFixed(1)} FPS)`);
  console.log(`  Min: ${minFrameTime.toFixed(2)}ms`);
  console.log(`  Max: ${maxFrameTime.toFixed(2)}ms`);
  console.log(`\nSmoothness:`);
  console.log(`  Frames > 16ms (freeze): ${framesOver16ms} (${((framesOver16ms / totalFrames) * 100).toFixed(1)}%)`);
  console.log(`  Frames > 8ms: ${framesOver8ms} (${((framesOver8ms / totalFrames) * 100).toFixed(1)}%)`);
  console.log(`  Smoothness Score: ${smoothness.toFixed(1)}%`);

  console.log(`\nFrame-by-Frame Breakdown:`);
  metrics.forEach(m => {
    const stageNames = ['TERRAIN', 'BIOMES', 'RIVERS', 'RESOURCES', 'STRUCTURES', 'COMPLETE'];
    const stageName = stageNames[m.stage] || 'UNKNOWN';
    const warning = m.duration > 16 ? ' ⚠️ FREEZE' : m.duration > 8 ? ' ⚠️ SLOW' : ' ✓';
    console.log(`  Frame ${m.frameNumber}: ${m.duration.toFixed(2)}ms (${m.fps.toFixed(1)} FPS) - ${stageName}${warning}`);
  });

  console.log(`\n=== Assessment ===\n`);
  if (smoothness >= 95 && avgFPS >= 50) {
    console.log('✅ EXCELLENT: Smooth 60 FPS loading with no freezing!');
  } else if (smoothness >= 80 && avgFPS >= 40) {
    console.log('✅ GOOD: Mostly smooth loading with occasional slowdowns');
  } else if (smoothness >= 60 && avgFPS >= 30) {
    console.log('⚠️ ACCEPTABLE: Some freezing but playable');
  } else {
    console.log('❌ POOR: Significant freezing, needs improvement');
  }

  console.log('\n');
}

/**
 * Compares different time budgets
 */
function compareTimeBudgets(): void {
  const budgets = [16, 8, 4, 2];

  console.log('\n=== Comparing Time Budgets ===\n');

  for (const budget of budgets) {
    const config = {
      seed: 12345,
      chunkSize: 32,
      seamlessChunks: true,
      incrementalConfig: {
        enabled: true,
        timeBudgetMs: budget,
      },
    };

    const chunkManager = new ChunkManager(config);
    const metrics = simulateFrameByFrameGeneration(chunkManager, 0, 0, budget);
    analyzeMetrics(metrics, budget);
  }
}

/**
 * Tests a single configuration
 */
function testSingleConfig(timeBudgetMs: number): void {
  const config = {
    seed: 12345,
    chunkSize: 32,
    seamlessChunks: true,
    incrementalConfig: {
      enabled: true,
      timeBudgetMs,
    },
  };

  const chunkManager = new ChunkManager(config);
  const metrics = simulateFrameByFrameGeneration(chunkManager, 0, 0, timeBudgetMs);
  analyzeMetrics(metrics, timeBudgetMs);
}

// Run tests
console.log('Testing smooth chunk loading with intra-stage yielding...\n');

// Test recommended 4ms budget
console.log('=== Testing Recommended Configuration (4ms budget) ===');
testSingleConfig(4);

// Compare all budgets
console.log('\n=== Comparing All Time Budgets ===');
compareTimeBudgets();

console.log('\n=== Recommendations ===\n');
console.log('For smooth 60 FPS loading:');
console.log('  • Use timeBudgetMs: 4 (recommended)');
console.log('  • Use timeBudgetMs: 2 (for maximum smoothness)');
console.log('  • Use timeBudgetMs: 8 (if 4ms is too aggressive)');
console.log('\nFor zero blocking:');
console.log('  • Enable Web Workers (see SMOOTH_LOADING_SOLUTIONS.md)');
console.log('\n');
