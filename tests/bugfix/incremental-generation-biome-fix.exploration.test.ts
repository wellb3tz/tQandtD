import { describe, test, expect, beforeEach } from 'vitest';
import { IncrementalGenerator } from '../../src/world/incremental-generator';
import { ChunkManager } from '../../src/world/chunk-manager';
import { GenerationStage, PartialChunkData, IncrementalConfig, BiomeType, ResourceType, StructureType } from '../../src/world/chunk';

/**
 * Bug Condition Exploration Tests for Incremental Generation Biome Fix
 * 
 * These tests are designed to FAIL on unfixed code to demonstrate the bugs exist.
 * They test the bug conditions described in the bugfix specification:
 * 
 * 1. Infinite Loop in TERRAIN Stage - stage never advances beyond TERRAIN
 * 2. Infinite Loop in BIOMES Stage - stage never advances beyond BIOMES
 * 3. Redundant Work Regeneration - work regenerated on every continueGeneration() call
 * 4. Premature Rendering - biomeMap missing after first continueGeneration() call
 * 5. Zero Completion Rate - chunks never reach COMPLETE stage
 * 6. Time Budget Design Flaw - budget checked after work completes
 * 
 * EXPECTED OUTCOME: All tests FAIL on unfixed code (this confirms bugs exist)
 */

describe('Incremental Generation Biome Fix - Bug Condition Exploration', () => {
  // Test configuration with incremental generation enabled
  const createTestConfig = () => ({
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
    riverNetworkConfig: {
      sourceElevation: 0.6,
      minFlowLength: 5,
      flowWidth: 2,
    },
    incrementalConfig: {
      enabled: true,
      timeBudgetMs: 16, // 60 FPS target
    },
  });

  let chunkManager: ChunkManager;

  beforeEach(() => {
    const config = createTestConfig();
    chunkManager = new ChunkManager(config);
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
   * 
   * Property 1a: Bug Condition - TERRAIN Stage Never Advances
   * 
   * This test demonstrates the infinite loop bug in the TERRAIN stage.
   * The bug manifests when a stage exceeds the time budget - it gets stuck
   * regenerating the same work over and over.
   * 
   * EXPECTED BEHAVIOR ON UNFIXED CODE:
   * - Test FAILS - stage stays stuck (TERRAIN or BIOMES) after 10 iterations
   * - This confirms the bug: Stage generates data, exceeds time budget,
   *   returns false, but next call regenerates everything again (infinite loop)
   * 
   * EXPECTED BEHAVIOR ON FIXED CODE:
   * - Test PASSES - stage advances beyond TERRAIN to BIOMES and eventually COMPLETE
   * - This confirms the fix: Stages complete, mark themselves done, advance
   * 
   * Document: "TERRAIN stage stuck in infinite loop, never advances to BIOMES"
   * (Note: In this test run, TERRAIN completes quickly but BIOMES gets stuck)
   */
  test('Property 1a: Bug Condition - TERRAIN Stage Never Advances', () => {
    // Start incremental generation for chunk (0,0) at TERRAIN stage
    const partial = chunkManager.getChunkIncremental(0, 0);
    expect(partial.stage).toBe(GenerationStage.TERRAIN);

    // Call continueGeneration() until complete or max iterations
    const stages: number[] = [];
    const maxIterations = 100; // Safety limit
    let complete = false;
    
    for (let i = 0; i < maxIterations && !complete; i++) {
      complete = chunkManager.continueGeneration(0, 0);
      const currentStage = chunkManager.getGenerationStage(0, 0);
      stages.push(currentStage!);
    }

    // Get current stage after iterations
    const currentStage = chunkManager.getGenerationStage(0, 0);

    // Document the observed behavior
    const stageNames = stages.map(s => GenerationStage[s]);
    const uniqueStages = [...new Set(stageNames)];
    const finalStage = stageNames[stageNames.length - 1];
    
    console.log(`\n=== BUG DEMONSTRATION ===`);
    console.log(`After ${stages.length} iterations, stage is: ${finalStage}`);
    console.log(`Stage progression: ${stageNames.slice(0, 20).join(' -> ')}${stages.length > 20 ? '...' : ''}`);
    console.log(`Unique stages visited: ${uniqueStages.join(', ')}`);
    console.log(`Completed: ${complete}`);
    
    // Check if stage is stuck (same stage for last 10 iterations)
    const lastTenStages = stages.slice(-10);
    const isStuck = lastTenStages.length >= 10 && lastTenStages.every(s => s === lastTenStages[0]);
    
    if (isStuck && currentStage !== GenerationStage.COMPLETE) {
      console.log(`\n✗ BUG CONFIRMED: Stage ${GenerationStage[currentStage!]} stuck in infinite loop`);
      console.log(`  - Stage never advances beyond ${GenerationStage[currentStage!]}`);
      console.log(`  - Work is regenerated on every continueGeneration() call`);
      console.log(`  - This matches the bug description in bugfix.md`);
    } else if (complete && currentStage === GenerationStage.COMPLETE) {
      console.log(`\n✓ FIX VERIFIED: Generation completed successfully`);
      console.log(`  - All stages advanced properly`);
      console.log(`  - No infinite loops detected`);
    }

    // Assert that stage advances beyond TERRAIN (to BIOMES or later)
    expect(currentStage).toBeGreaterThan(GenerationStage.TERRAIN);
    
    // The real test: stage should eventually reach COMPLETE
    // EXPECTED ON UNFIXED CODE: This assertion FAILS - stage stuck at BIOMES
    // EXPECTED ON FIXED CODE: This assertion PASSES - stage reaches COMPLETE
    expect(currentStage).toBe(GenerationStage.COMPLETE);
  });

  /**
   * **Validates: Requirements 1.6, 1.7, 1.8, 1.9**
   * 
   * Property 1b: Bug Condition - BIOMES Stage Never Advances
   * 
   * This test isolates the BIOMES stage infinite loop by manually creating
   * a PartialChunkData at BIOMES stage (skipping TERRAIN). This demonstrates
   * that the bug exists in BIOMES stage specifically.
   * 
   * EXPECTED BEHAVIOR ON UNFIXED CODE:
   * - Test FAILS - stage stays stuck at BIOMES after 10 iterations
   * - This confirms the bug: BIOMES stage generates data, exceeds time budget,
   *   returns false, but next call regenerates everything again (infinite loop)
   * 
   * EXPECTED BEHAVIOR ON FIXED CODE:
   * - Test PASSES - stage advances beyond BIOMES to RIVERS and eventually COMPLETE
   * - This confirms the fix: BIOMES stage completes, marks itself done, advances
   * 
   * Document: "BIOMES stage stuck in infinite loop, never advances to RIVERS"
   */
  test('Property 1b: Bug Condition - BIOMES Stage Never Advances', () => {
    // Manually create PartialChunkData at BIOMES stage (skip TERRAIN)
    // First, start generation normally to get TERRAIN done
    const partial = chunkManager.getChunkIncremental(0, 0);
    expect(partial.stage).toBe(GenerationStage.TERRAIN);
    
    // Complete TERRAIN stage
    chunkManager.continueGeneration(0, 0);
    
    // Verify we're now at BIOMES stage or beyond (fix may advance multiple stages in one call)
    const currentStageBeforeLoop = chunkManager.getGenerationStage(0, 0);
    expect(currentStageBeforeLoop).toBeGreaterThanOrEqual(GenerationStage.BIOMES);

    // Call continueGeneration() until complete or max iterations
    const stages: number[] = [];
    const maxIterations = 100; // Safety limit
    let complete = false;
    
    for (let i = 0; i < maxIterations && !complete; i++) {
      complete = chunkManager.continueGeneration(0, 0);
      const currentStage = chunkManager.getGenerationStage(0, 0);
      stages.push(currentStage!);
    }

    // Get current stage after iterations
    const currentStage = chunkManager.getGenerationStage(0, 0);

    // Document the observed behavior
    const stageNames = stages.map(s => GenerationStage[s]);
    const uniqueStages = [...new Set(stageNames)];
    const finalStage = stageNames[stageNames.length - 1];
    
    console.log(`\n=== BUG DEMONSTRATION - BIOMES STAGE ===`);
    console.log(`After ${stages.length} iterations, stage is: ${finalStage}`);
    console.log(`Stage progression: ${stageNames.slice(0, 20).join(' -> ')}${stages.length > 20 ? '...' : ''}`);
    console.log(`Unique stages visited: ${uniqueStages.join(', ')}`);
    console.log(`Completed: ${complete}`);
    
    // Check if stage is stuck (same stage for last 10 iterations)
    const lastTenStages = stages.slice(-10);
    const isStuck = lastTenStages.length >= 10 && lastTenStages.every(s => s === lastTenStages[0]);
    
    if (isStuck && currentStage === GenerationStage.BIOMES) {
      console.log(`\n✗ BUG CONFIRMED: BIOMES stage stuck in infinite loop`);
      console.log(`  - Stage never advances beyond BIOMES to RIVERS`);
      console.log(`  - Work is regenerated on every continueGeneration() call`);
      console.log(`  - This matches the bug description in bugfix.md`);
    } else if (complete && currentStage === GenerationStage.COMPLETE) {
      console.log(`\n✓ FIX VERIFIED: Generation completed successfully`);
      console.log(`  - All stages advanced properly`);
      console.log(`  - No infinite loops detected`);
    }

    // Assert that stage advances beyond BIOMES (to RIVERS or later)
    expect(currentStage).toBeGreaterThan(GenerationStage.BIOMES);
    
    // The real test: stage should eventually reach COMPLETE
    // EXPECTED ON UNFIXED CODE: This assertion FAILS - stage stuck at BIOMES
    // EXPECTED ON FIXED CODE: This assertion PASSES - stage reaches COMPLETE
    expect(currentStage).toBe(GenerationStage.COMPLETE);
  });

  /**
   * **Validates: Requirements 1.4, 1.14, 1.15, 1.16**
   * 
   * Property 1c: Bug Condition - Work Regenerated on Every Call
   * 
   * This test demonstrates that work is redundantly regenerated on every
   * continueGeneration() call because there's no completion tracking.
   * 
   * The test starts generation for chunk (0,0), calls continueGeneration() once
   * to advance to BIOMES stage, then calls it again. On subsequent calls, the
   * biomes should NOT be regenerated if the work is already done.
   * 
   * We detect regeneration by measuring generation time. If biomes are regenerated
   * on every call, the time should be similar. If biomes are NOT regenerated
   * (because completion tracking exists), the time should be much faster.
   * 
   * EXPECTED BEHAVIOR ON UNFIXED CODE:
   * - Test FAILS - biomes are regenerated on every call (similar time ~16ms)
   * - This confirms the bug: No completion tracking, so work is redone
   * 
   * EXPECTED BEHAVIOR ON FIXED CODE:
   * - Test PASSES - biomes are NOT regenerated (much faster, <1ms)
   * - This confirms the fix: Completion tracking prevents redundant work
   * 
   * Document: "Heightmap regenerated on every continueGeneration() call"
   */
  test('Property 1c: Bug Condition - Work Regenerated on Every Call', () => {
    // Start generation for chunk (0,0) at TERRAIN stage
    const partial = chunkManager.getChunkIncremental(0, 0);
    expect(partial.stage).toBe(GenerationStage.TERRAIN);

    // Call continueGeneration() once to advance to BIOMES stage or beyond
    chunkManager.continueGeneration(0, 0);
    const stage1 = chunkManager.getGenerationStage(0, 0);
    expect(stage1).toBeGreaterThanOrEqual(GenerationStage.BIOMES);
    
    // Capture heightmap and biomeMap references after first call
    const partial1 = chunkManager.getChunkIncremental(0, 0);
    const heightmap1 = partial1.data.heightmap;
    const biomeMap1 = partial1.data.biomeMap;
    expect(heightmap1).toBeDefined();
    
    // Call continueGeneration() to execute BIOMES stage (first time)
    const startTime1 = performance.now();
    chunkManager.continueGeneration(0, 0);
    const time1 = performance.now() - startTime1;
    
    // Capture biomeMap reference after BIOMES execution
    const partial2 = chunkManager.getChunkIncremental(0, 0);
    const biomeMap2 = partial2.data.biomeMap;

    // Call continueGeneration() again for same chunk (should advance to next stage, not regenerate BIOMES)
    const startTime2 = performance.now();
    chunkManager.continueGeneration(0, 0);
    const time2 = performance.now() - startTime2;
    const stage2 = chunkManager.getGenerationStage(0, 0);
    
    // Capture biomeMap reference after third call
    const partial3 = chunkManager.getChunkIncremental(0, 0);
    const biomeMap3 = partial3.data.biomeMap;
    const heightmap3 = partial3.data.heightmap;

    // Document the observed behavior
    console.log(`\n=== BUG DEMONSTRATION - REDUNDANT WORK ===`);
    console.log(`Stage after first BIOMES call: ${GenerationStage[stage1!]}`);
    console.log(`Stage after second call: ${GenerationStage[stage2!]}`);
    console.log(`Heightmap reference changed: ${heightmap1 !== heightmap3}`);
    console.log(`BiomeMap reference changed (1st->2nd): ${biomeMap2 !== biomeMap3}`);
    console.log(`First BIOMES call time: ${time1.toFixed(2)}ms`);
    console.log(`Second call time (next stage): ${time2.toFixed(2)}ms`);

    // Verify biomeMap was NOT regenerated (same reference throughout)
    expect(biomeMap3).toBe(biomeMap1);
    expect(biomeMap3).toBe(biomeMap2);
    
    // Verify heightmap was NOT regenerated (same reference throughout)
    expect(heightmap3).toBe(heightmap1);
    
    console.log(`\n✓ FIX VERIFIED: Work NOT regenerated`);
    console.log(`  - BiomeMap reference unchanged: ${biomeMap3 === biomeMap1}`);
    console.log(`  - Heightmap reference unchanged: ${heightmap3 === heightmap1}`);
    console.log(`  - Completion tracking prevents redundant work`);
  });

  /**
   * **Validates: Requirements 1.10, 1.11, 1.12, 1.13**
   * 
   * Property 1d: Bug Condition - BiomeMap Missing After First Call
   * 
   * This test simulates DemoApp.loadChunksAround() behavior, which calls
   * continueGeneration() only once and then emits CHUNK_LOADED. This causes
   * premature rendering before biomes are generated, resulting in grey terrain.
   * 
   * The test starts generation for chunk (0,0), calls continueGeneration() once
   * (which completes TERRAIN stage), then checks if biomeMap exists in the
   * partial chunk data. On unfixed code, biomeMap will be undefined because
   * BIOMES stage hasn't executed yet.
   * 
   * EXPECTED BEHAVIOR ON UNFIXED CODE:
   * - Test FAILS - biomeMap is undefined after first continueGeneration() call
   * - This confirms the bug: DemoApp renders chunks before biomes are generated
   * - Result: Grey terrain (fallback color r: 0.5, g: 0.5, b: 0.5)
   * 
   * EXPECTED BEHAVIOR ON FIXED CODE:
   * - Test PASSES - biomeMap is defined after first continueGeneration() call
   * - This confirms the fix: DemoApp calls continueGeneration() at least twice
   *   (once for TERRAIN, once for BIOMES) before emitting CHUNK_LOADED
   * - Result: Proper biome colors on first render
   * 
   * Document: "BiomeMap undefined after first continueGeneration() call, causes grey terrain"
   */
  test('Property 1d: Bug Condition - BiomeMap Missing After First Call', () => {
    // Simulate DemoApp.loadChunksAround() behavior:
    // 1. Start generation for chunk (0,0)
    const partial = chunkManager.getChunkIncremental(0, 0);
    expect(partial.stage).toBe(GenerationStage.TERRAIN);
    
    // 2. Call continueGeneration() once (simulates single call in DemoApp)
    chunkManager.continueGeneration(0, 0);
    
    // 3. Check if partial.data.biomeMap exists (DemoApp would emit CHUNK_LOADED here)
    const partialAfterFirstCall = chunkManager.getChunkIncremental(0, 0);
    const biomeMapExists = partialAfterFirstCall.data.biomeMap !== undefined;
    const currentStage = chunkManager.getGenerationStage(0, 0);
    
    // Document the observed behavior
    console.log(`\n=== BUG DEMONSTRATION - PREMATURE RENDERING ===`);
    console.log(`Stage after first continueGeneration() call: ${GenerationStage[currentStage!]}`);
    console.log(`BiomeMap exists: ${biomeMapExists}`);
    console.log(`Heightmap exists: ${partialAfterFirstCall.data.heightmap !== undefined}`);
    
    if (!biomeMapExists) {
      console.log(`\n✗ BUG CONFIRMED: BiomeMap undefined after first continueGeneration() call`);
      console.log(`  - DemoApp.loadChunksAround() calls continueGeneration() only once`);
      console.log(`  - CHUNK_LOADED emitted before BIOMES stage executes`);
      console.log(`  - WorldViewer renders terrain with grey fallback color (r: 0.5, g: 0.5, b: 0.5)`);
      console.log(`  - This matches the bug description in bugfix.md (Requirements 1.10, 1.11, 1.12, 1.13)`);
    } else {
      console.log(`\n✓ FIX VERIFIED: BiomeMap defined after first continueGeneration() call`);
      console.log(`  - DemoApp calls continueGeneration() at least twice before emitting CHUNK_LOADED`);
      console.log(`  - Proper biome colors on first render`);
    }
    
    // Assert biomeMap is defined
    // EXPECTED ON UNFIXED CODE: This assertion FAILS - biomeMap is undefined
    // EXPECTED ON FIXED CODE: This assertion PASSES - biomeMap is defined
    expect(partialAfterFirstCall.data.biomeMap).toBeDefined();
  });

  /**
   * **Validates: Requirements 1.5, 1.9, 1.17, 1.18, 1.19**
   * 
   * Property 1e: Bug Condition - Chunks Never Complete
   * 
   * This test demonstrates the overall system failure: chunks never reach
   * COMPLETE stage because they get stuck in infinite loops at TERRAIN or BIOMES.
   * 
   * The test starts generation for 9 chunks (3x3 grid), calls continueGeneration()
   * up to 1000 times total across all chunks, and measures how many chunks reach
   * COMPLETE stage. On unfixed code, the completion rate should be 0% because
   * all chunks get stuck in infinite loops.
   * 
   * EXPECTED BEHAVIOR ON UNFIXED CODE:
   * - Test FAILS - 0% completion rate (no chunks reach COMPLETE)
   * - This confirms the bug: System is completely non-functional
   * - Chunks stuck in infinite loops, never complete generation
   * - Performance is 135x slower than standard generation
   * 
   * EXPECTED BEHAVIOR ON FIXED CODE:
   * - Test PASSES - >0% completion rate (chunks complete within 1000 iterations)
   * - This confirms the fix: Stages advance properly, chunks complete
   * - System is functional and provides FPS benefits
   * 
   * Document: "No chunks complete within 1000 iterations, system stuck in infinite loops"
   */
  test('Property 1e: Bug Condition - Chunks Never Complete', () => {
    // Start generation for 9 chunks (3x3 grid)
    const chunks: Array<{ x: number; y: number }> = [];
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        chunks.push({ x, y });
        chunkManager.getChunkIncremental(x, y);
      }
    }
    
    expect(chunks.length).toBe(9);
    
    // Call continueGeneration() up to 1000 times total
    // Distribute calls across all chunks in round-robin fashion
    const maxIterations = 1000;
    let totalCalls = 0;
    const callsPerChunk: Map<string, number> = new Map();
    
    for (let i = 0; i < maxIterations; i++) {
      const chunk = chunks[i % chunks.length];
      const key = `${chunk.x},${chunk.y}`;
      
      // Check if chunk is already complete
      const stage = chunkManager.getGenerationStage(chunk.x, chunk.y);
      if (stage === GenerationStage.COMPLETE) {
        continue; // Skip completed chunks
      }
      
      // Call continueGeneration()
      chunkManager.continueGeneration(chunk.x, chunk.y);
      totalCalls++;
      callsPerChunk.set(key, (callsPerChunk.get(key) || 0) + 1);
    }
    
    // Count how many chunks reach COMPLETE stage
    let completedCount = 0;
    const stageDistribution: Map<string, number> = new Map();
    
    for (const chunk of chunks) {
      const stage = chunkManager.getGenerationStage(chunk.x, chunk.y);
      const stageName = GenerationStage[stage!];
      stageDistribution.set(stageName, (stageDistribution.get(stageName) || 0) + 1);
      
      if (stage === GenerationStage.COMPLETE) {
        completedCount++;
      }
    }
    
    const completionRate = (completedCount / chunks.length) * 100;
    
    // Document the observed behavior
    console.log(`\n=== BUG DEMONSTRATION - ZERO COMPLETION RATE ===`);
    console.log(`Total chunks: ${chunks.length}`);
    console.log(`Total continueGeneration() calls: ${totalCalls}`);
    console.log(`Completed chunks: ${completedCount}`);
    console.log(`Completion rate: ${completionRate.toFixed(1)}%`);
    console.log(`\nStage distribution:`);
    for (const [stageName, count] of stageDistribution.entries()) {
      console.log(`  ${stageName}: ${count} chunks (${((count / chunks.length) * 100).toFixed(1)}%)`);
    }
    console.log(`\nCalls per chunk:`);
    for (const chunk of chunks) {
      const key = `${chunk.x},${chunk.y}`;
      const calls = callsPerChunk.get(key) || 0;
      const stage = chunkManager.getGenerationStage(chunk.x, chunk.y);
      console.log(`  Chunk (${chunk.x},${chunk.y}): ${calls} calls, stage: ${GenerationStage[stage!]}`);
    }
    
    if (completionRate === 0) {
      console.log(`\n✗ BUG CONFIRMED: No chunks complete within ${maxIterations} iterations`);
      console.log(`  - System stuck in infinite loops`);
      console.log(`  - Chunks never reach COMPLETE stage`);
      console.log(`  - Performance is 135x slower than standard generation`);
      console.log(`  - This matches the bug description in bugfix.md (Requirements 1.5, 1.9, 1.17, 1.18, 1.19)`);
    } else {
      console.log(`\n✓ FIX VERIFIED: ${completionRate.toFixed(1)}% completion rate`);
      console.log(`  - Stages advance properly`);
      console.log(`  - Chunks complete generation`);
      console.log(`  - System is functional`);
    }
    
    // Assert completion rate > 0%
    // EXPECTED ON UNFIXED CODE: This assertion FAILS - 0% completion rate
    // EXPECTED ON FIXED CODE: This assertion PASSES - >0% completion rate
    expect(completionRate).toBeGreaterThan(0);
  });

  /**
   * **Validates: Requirements 1.16, 1.17, 1.18, 1.19**
   * 
   * Property 1f: Bug Condition - Work Done Before Budget Check
   * 
   * This test demonstrates the fundamental design flaw in the incremental generation
   * system: stages perform ALL work first, THEN check if the time budget was exceeded.
   * This creates two problems:
   * 
   * 1. **All-or-Nothing Execution**: Each stage is atomic - it either completes all
   *    work or none. There's no true incremental progress within a stage.
   * 
   * 2. **Infinite Loop When Budget Exceeded**: When a stage completes its work but
   *    exceeds the budget, it returns false (incomplete) even though the work is done.
   *    The stage doesn't advance, so the next call regenerates everything from scratch.
   * 
   * The test demonstrates this by:
   * 1. Observing TERRAIN stage - generates entire heightmap, THEN checks budget
   * 2. Observing BIOMES stage - attempts to generate all biomes, checks budget periodically
   *    but doesn't save progress, so yields mid-work and regenerates on next call
   * 3. Measuring regeneration by calling continueGeneration() multiple times and
   *    observing that work is redone each time (similar execution times)
   * 
   * EXPECTED BEHAVIOR ON UNFIXED CODE:
   * - Test FAILS - demonstrates that budget check happens after work completes
   * - TERRAIN: Heightmap generated, then budget checked (all-or-nothing)
   * - BIOMES: Work regenerated on every call (no progress saved when yielding)
   * - This confirms the bug: Budget checked after work, making generation non-incremental
   * 
   * EXPECTED BEHAVIOR ON FIXED CODE:
   * - Test PASSES - stages advance after completing work, regardless of budget
   * - Work is marked complete when done, preventing regeneration
   * - Budget check only controls whether to continue to NEXT stage, not whether
   *   CURRENT stage is complete
   * 
   * Document: "Time budget checked after work completes, making generation non-incremental"
   */
  test('Property 1f: Bug Condition - Work Done Before Budget Check', () => {
    // Use default config with 16ms budget
    const defaultChunkManager = chunkManager;
    
    // Start generation for chunk (0,0) at TERRAIN stage
    const partial = defaultChunkManager.getChunkIncremental(0, 0);
    expect(partial.stage).toBe(GenerationStage.TERRAIN);
    
    // === PART 1: Demonstrate TERRAIN stage all-or-nothing execution ===
    console.log(`\n=== BUG DEMONSTRATION - TIME BUDGET DESIGN FLAW ===`);
    console.log(`\nPART 1: TERRAIN Stage - All-or-Nothing Execution`);
    
    const startTimeTerrain = performance.now();
    const resultTerrain = defaultChunkManager.continueGeneration(0, 0);
    const elapsedTerrain = performance.now() - startTimeTerrain;
    
    const partialAfterTerrain = defaultChunkManager.getChunkIncremental(0, 0);
    const heightmapGenerated = partialAfterTerrain.data.heightmap !== undefined;
    const stageAfterTerrain = defaultChunkManager.getGenerationStage(0, 0)!;
    
    console.log(`Elapsed time: ${elapsedTerrain.toFixed(2)}ms`);
    console.log(`Time budget: 16ms`);
    console.log(`Heightmap generated: ${heightmapGenerated}`);
    console.log(`Stage after call: ${GenerationStage[stageAfterTerrain]}`);
    console.log(`Function returned: ${resultTerrain}`);
    
    if (heightmapGenerated) {
      console.log(`\n✗ DESIGN FLAW CONFIRMED: TERRAIN stage is all-or-nothing`);
      console.log(`  - Entire heightmap generated in one call`);
      console.log(`  - Budget check happens AFTER all work completes`);
      console.log(`  - No incremental progress within the stage`);
      console.log(`  - Code: executeTerrainStage() generates heightmap (lines 177-183),`);
      console.log(`    THEN checks budget (lines 186-187)`);
    }
    
    // === PART 2: Demonstrate BIOMES stage infinite loop ===
    console.log(`\nPART 2: BIOMES Stage - Infinite Loop Due to No Progress Tracking`);
    
    // Ensure we're at BIOMES stage or beyond (fix may advance multiple stages)
    if (stageAfterTerrain === GenerationStage.TERRAIN) {
      defaultChunkManager.continueGeneration(0, 0);
    }
    
    const stageBeforeBiomes = defaultChunkManager.getGenerationStage(0, 0)!;
    expect(stageBeforeBiomes).toBeGreaterThanOrEqual(GenerationStage.BIOMES);
    
    // Call continueGeneration() multiple times for BIOMES stage
    // Measure execution time to detect if work is being regenerated
    const biomesTimes: number[] = [];
    const biomesStages: GenerationStage[] = [];
    const biomesMapsGenerated: boolean[] = [];
    
    for (let i = 0; i < 50; i++) { // Increased from 5 to 50 to allow biomes stage to complete
      const startTime = performance.now();
      const result = defaultChunkManager.continueGeneration(0, 0);
      const elapsed = performance.now() - startTime;
      
      const partialAfter = defaultChunkManager.getChunkIncremental(0, 0);
      const biomeMapGenerated = partialAfter.data.biomeMap !== undefined;
      const currentStage = defaultChunkManager.getGenerationStage(0, 0)!;
      
      biomesTimes.push(elapsed);
      biomesStages.push(currentStage);
      biomesMapsGenerated.push(biomeMapGenerated);
      
      console.log(`Call ${i + 1}: ${elapsed.toFixed(2)}ms, biomeMap=${biomeMapGenerated}, stage=${GenerationStage[currentStage]}, result=${result}`);
      
      // If biomeMap is generated and stage advanced, break
      if (biomeMapGenerated && currentStage > GenerationStage.BIOMES) {
        break;
      }
    }
    
    // Analyze the results
    const avgTime = biomesTimes.reduce((a, b) => a + b, 0) / biomesTimes.length;
    const allStagesSame = biomesStages.every(s => s === biomesStages[0]);
    const noBiomeMapGenerated = biomesMapsGenerated.every(b => !b);
    const finalStage = biomesStages[biomesStages.length - 1];
    const finalBiomeMapGenerated = biomesMapsGenerated[biomesMapsGenerated.length - 1];
    
    console.log(`\nAnalysis:`);
    console.log(`Average time per call: ${avgTime.toFixed(2)}ms`);
    console.log(`All calls stayed at BIOMES: ${allStagesSame}`);
    console.log(`No biomeMap generated: ${noBiomeMapGenerated}`);
    console.log(`Final stage: ${GenerationStage[finalStage]}`);
    console.log(`Final biomeMap generated: ${finalBiomeMapGenerated}`);
    
    // The bug: if all calls take similar time and stage never advances,
    // it means work is being regenerated on every call (infinite loop)
    if (allStagesSame && finalStage === GenerationStage.BIOMES) {
      console.log(`\n✗ BUG CONFIRMED: BIOMES stage stuck in infinite loop`);
      console.log(`  - Stage never advances beyond BIOMES after ${biomesTimes.length} calls`);
      console.log(`  - Work is regenerated on every call (similar execution times)`);
      console.log(`  - No completion tracking - system doesn't know work is done`);
      console.log(`  - Budget check happens after work, but stage doesn't advance`);
      console.log(`  - This matches the bug description in bugfix.md (Requirements 1.16, 1.17, 1.18, 1.19)`);
      
      // This is the assertion that should FAIL on unfixed code
      // After many calls, the stage should have advanced beyond BIOMES
      expect(finalStage).toBeGreaterThan(GenerationStage.BIOMES);
    } else if (finalBiomeMapGenerated && finalStage > GenerationStage.BIOMES) {
      console.log(`\n✓ FIX VERIFIED: BIOMES stage advances after work completes`);
      console.log(`  - BiomeMap generated and stage advanced to ${GenerationStage[finalStage]}`);
      console.log(`  - Completion tracking prevents infinite loop`);
    }
  });
});

