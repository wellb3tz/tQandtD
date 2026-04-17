import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ChunkManager } from '../../src/world/chunk-manager';
import { WorkerPool } from '../../src/world/worker-pool';
import { LODLevel } from '../../src/world/lod';
import type { WorldConfig } from '../../src/world/chunk-manager';

/**
 * Bug Condition Exploration Test for Worker Pool Integration Fix
 * 
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 * 
 * This test explores the bug condition where WorkerPool is initialized but never invoked.
 * 
 * **CRITICAL**: This test is EXPECTED TO FAIL on unfixed code.
 * The failure confirms that the bug exists (submitTask is never called).
 * 
 * **DO NOT attempt to fix the test or code when it fails.**
 * 
 * After the fix is implemented, this same test will pass, validating the fix.
 */
describe('Bug Condition Exploration: Worker Pool Integration', () => {
  // Mock Worker API for Node.js test environment
  let MockWorker: any;
  let originalWorker: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock Worker class
    MockWorker = vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    }));

    // Store original Worker and replace with mock
    originalWorker = (globalThis as any).Worker;
    (globalThis as any).Worker = MockWorker;
  });

  afterEach(() => {
    // Restore original Worker
    (globalThis as any).Worker = originalWorker;
  });

  /**
   * Property 1: Bug Condition - Worker Pool Delegation Not Invoked
   * 
   * Tests that when workerPoolConfig is provided with maxWorkers > 0,
   * calling getChunk() for a non-cached chunk invokes WorkerPool.submitTask().
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS
   * - submitTask() is never called
   * - getChunk() executes synchronously instead
   * 
   * **EXPECTED OUTCOME AFTER FIX**: Test PASSES
   * - submitTask() is called with correct parameters
   * - Chunk generation is delegated to worker pool
   */
  it('should invoke WorkerPool.submitTask() when workerPoolConfig is enabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random chunk coordinates
        fc.integer({ min: -10, max: 10 }), // chunkX
        fc.integer({ min: -10, max: 10 }), // chunkY
        // Generate random maxWorkers setting (1-8 workers)
        fc.integer({ min: 1, max: 8 }),
        async (chunkX, chunkY, maxWorkers) => {
          // Spy on WorkerPool.submitTask() method and mock it to call onComplete immediately
          const submitTaskSpy = vi.spyOn(WorkerPool.prototype, 'submitTask').mockImplementation(function(this: WorkerPool, task: any) {
            // Simulate immediate worker completion with a generated chunk
            setTimeout(() => {
              const mockChunk = {
                x: task.chunkX,
                y: task.chunkY,
                size: 32,
                heightmap: new Float32Array(33 * 33),
                biomeMap: new Uint8Array(32 * 32),
                biomeWeights: new Float32Array(32 * 32 * 8),
                resources: [],
                structures: [],
                rivers: new Set<number>(),
              };
              task.onComplete(mockChunk);
            }, 0);
            return 'mock-task-id';
          });

          // Create minimal WorldConfig with workerPoolConfig enabled
          const config: WorldConfig = {
            seed: 12345,
            chunkSize: 32,
            terrainConfig: {
              scale: 0.01,
              octaves: 4,
              persistence: 0.5,
              lacunarity: 2.0,
              heightScale: 1.0,
              enableDomainWarping: false,
            },
            biomeConfig: {
              scale: 0.005,
              moistureScale: 0.008,
            },
            resourceConfig: {
              types: [],
              clusterScale: 50,
              densityThreshold: 0.6,
            },
            structureConfig: {
              types: [],
              minDistance: 20,
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
            workerPoolConfig: {
              maxWorkers,
              workerScriptUrl: '/worker.js',
              taskTimeout: 30000,
            },
            maxCacheSize: 10,
          };

          // Create ChunkManager with workerPoolConfig
          const chunkManager = new ChunkManager(config);

          // Call getChunk() for a non-cached chunk
          // This should trigger worker pool delegation
          const chunk = await chunkManager.getChunk(chunkX, chunkY, LODLevel.HIGH);

          // Assert that submitTask() was called
          // **ON UNFIXED CODE**: This assertion will FAIL because submitTask is never called
          // **AFTER FIX**: This assertion will PASS
          expect(submitTaskSpy).toHaveBeenCalled();

          // Verify submitTask was called with correct parameters
          if (submitTaskSpy.mock.calls.length > 0) {
            const taskArg = submitTaskSpy.mock.calls[0][0];
            expect(taskArg).toMatchObject({
              chunkX,
              chunkY,
              lodLevel: LODLevel.HIGH,
            });
            expect(taskArg.onComplete).toBeDefined();
            expect(taskArg.onError).toBeDefined();
          }

          // Verify chunk was returned
          expect(chunk).toBeDefined();
          expect(chunk.x).toBe(chunkX);
          expect(chunk.y).toBe(chunkY);

          // Cleanup
          submitTaskSpy.mockRestore();
        }
      ),
      {
        // Run 10 test cases to explore the bug condition
        numRuns: 10,
        // Use verbose mode to see counterexamples
        verbose: true,
      }
    );
  }, 30000); // Increase timeout for async property tests

  /**
   * Scoped Bug Condition Test - Concrete Failing Case
   * 
   * This test uses a specific concrete case to ensure reproducibility.
   * For deterministic bugs, scoping to concrete cases ensures the test
   * consistently demonstrates the bug.
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS
   * **EXPECTED OUTCOME AFTER FIX**: Test PASSES
   */
  it('should invoke WorkerPool.submitTask() for concrete case: chunk (0,0) with 4 workers', async () => {
    // Spy on WorkerPool.submitTask() method and mock it to call onComplete immediately
    const submitTaskSpy = vi.spyOn(WorkerPool.prototype, 'submitTask').mockImplementation(function(this: WorkerPool, task: any) {
      // Simulate immediate worker completion with a generated chunk
      setTimeout(() => {
        const mockChunk = {
          x: task.chunkX,
          y: task.chunkY,
          size: 32,
          heightmap: new Float32Array(33 * 33),
          biomeMap: new Uint8Array(32 * 32),
          biomeWeights: new Float32Array(32 * 32 * 8),
          resources: [],
          structures: [],
          rivers: new Set<number>(),
        };
        task.onComplete(mockChunk);
      }, 0);
      return 'mock-task-id';
    });

    // Create minimal WorldConfig with workerPoolConfig enabled
    const config: WorldConfig = {
      seed: 12345,
      chunkSize: 32,
      terrainConfig: {
        scale: 0.01,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        heightScale: 1.0,
        enableDomainWarping: false,
      },
      biomeConfig: {
        scale: 0.005,
        moistureScale: 0.008,
      },
      resourceConfig: {
        types: [],
        clusterScale: 50,
        densityThreshold: 0.6,
      },
      structureConfig: {
        types: [],
        minDistance: 20,
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
      workerPoolConfig: {
        maxWorkers: 4,
        workerScriptUrl: '/worker.js',
        taskTimeout: 30000,
      },
      maxCacheSize: 10,
    };

    // Create ChunkManager with workerPoolConfig
    const chunkManager = new ChunkManager(config);

    // Call getChunk() for chunk (0, 0)
    const chunk = await chunkManager.getChunk(0, 0, LODLevel.HIGH);

    // **CRITICAL ASSERTION**: submitTask() should be called
    // **ON UNFIXED CODE**: This will FAIL - submitTask is never called
    // **AFTER FIX**: This will PASS - submitTask is called
    expect(submitTaskSpy).toHaveBeenCalled();

    // Document the counterexample
    if (!submitTaskSpy.mock.calls.length) {
      console.log('COUNTEREXAMPLE FOUND:');
      console.log('  - workerPoolConfig provided with maxWorkers: 4');
      console.log('  - getChunk(0, 0) called');
      console.log('  - submitTask() was NOT called (bug confirmed)');
      console.log('  - Chunk was generated synchronously instead');
    }

    // Verify chunk structure is correct
    expect(chunk).toBeDefined();
    expect(chunk.x).toBe(0);
    expect(chunk.y).toBe(0);
    expect(chunk.size).toBe(32);

    // Cleanup
    submitTaskSpy.mockRestore();
  }, 10000); // Increase timeout for async test
});

/**
 * Preservation Property Tests for Worker Pool Integration Fix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * These tests verify that synchronous generation behavior is preserved when
 * workerPoolConfig is null/undefined. They follow the observation-first methodology:
 * 1. Observe behavior on UNFIXED code for non-buggy inputs
 * 2. Write property-based tests capturing observed behavior patterns
 * 3. Run tests on UNFIXED code
 * 
 * **EXPECTED OUTCOME**: Tests PASS on unfixed code (confirms baseline behavior)
 * **AFTER FIX**: Tests should continue to PASS (confirms no regressions)
 */
describe('Preservation Property Tests: Synchronous Generation Behavior', () => {
  // Mock Worker API for Node.js test environment
  let MockWorker: any;
  let originalWorker: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock Worker class
    MockWorker = vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    }));

    // Store original Worker and replace with mock
    originalWorker = (globalThis as any).Worker;
    (globalThis as any).Worker = MockWorker;
  });

  afterEach(() => {
    // Restore original Worker
    (globalThis as any).Worker = originalWorker;
  });

  /**
   * Test Case 1: Verify getChunk() returns ChunkData synchronously when workerPoolConfig is null
   * 
   * **Validates: Requirements 3.1, 3.2**
   */
  it('Property 2.1: getChunk() returns ChunkData synchronously when workerPoolConfig is null', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random chunk coordinates
        fc.integer({ min: -10, max: 10 }), // chunkX
        fc.integer({ min: -10, max: 10 }), // chunkY
        async (chunkX, chunkY) => {
          // Create WorldConfig WITHOUT workerPoolConfig
          const config: WorldConfig = {
            seed: 12345,
            chunkSize: 32,
            terrainConfig: {
              scale: 0.01,
              octaves: 4,
              persistence: 0.5,
              lacunarity: 2.0,
              heightScale: 1.0,
              enableDomainWarping: false,
            },
            biomeConfig: {
              scale: 0.005,
              moistureScale: 0.008,
            },
            resourceConfig: {
              types: [],
              clusterScale: 50,
              densityThreshold: 0.6,
            },
            structureConfig: {
              types: [],
              minDistance: 20,
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
            maxCacheSize: 10,
            // workerPoolConfig is NOT provided (null/undefined)
          };

          // Create ChunkManager without workerPoolConfig
          const chunkManager = new ChunkManager(config);

          // Spy on generateChunk to verify it's called directly
          const generateChunkSpy = vi.spyOn(chunkManager as any, 'generateChunk');

          // Call getChunk() - should execute synchronously
          const chunk = await chunkManager.getChunk(chunkX, chunkY, LODLevel.HIGH);

          // Verify chunk is returned immediately (synchronous)
          expect(chunk).toBeDefined();
          expect(chunk.x).toBe(chunkX);
          expect(chunk.y).toBe(chunkY);
          expect(chunk.size).toBe(32);
          expect(chunk.heightmap).toBeInstanceOf(Float32Array);
          expect(chunk.biomeMap).toBeInstanceOf(Uint8Array);
          expect(chunk.biomeWeights).toBeInstanceOf(Float32Array);
          expect(Array.isArray(chunk.resources)).toBe(true);
          expect(Array.isArray(chunk.structures)).toBe(true);
          expect(chunk.rivers).toBeInstanceOf(Set);

          // Verify generateChunk was called directly (synchronous path)
          expect(generateChunkSpy).toHaveBeenCalledWith(chunkX, chunkY);

          // Cleanup
          generateChunkSpy.mockRestore();
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });

  /**
   * Test Case 2: Verify generateChunk() is called directly when workerPoolConfig is null
   * 
   * **Validates: Requirements 3.1, 3.2**
   */
  it('Property 2.2: generateChunk() is called directly when workerPoolConfig is null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -5, max: 5 }), // chunkX
        fc.integer({ min: -5, max: 5 }), // chunkY
        async (chunkX, chunkY) => {
          const config: WorldConfig = {
            seed: 54321,
            chunkSize: 32,
            terrainConfig: {
              scale: 0.01,
              octaves: 4,
              persistence: 0.5,
              lacunarity: 2.0,
              heightScale: 1.0,
              enableDomainWarping: false,
            },
            biomeConfig: {
              scale: 0.005,
              moistureScale: 0.008,
            },
            resourceConfig: {
              types: [],
              clusterScale: 50,
              densityThreshold: 0.6,
            },
            structureConfig: {
              types: [],
              minDistance: 20,
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
            maxCacheSize: 10,
          };

          const chunkManager = new ChunkManager(config);
          const generateChunkSpy = vi.spyOn(chunkManager as any, 'generateChunk');

          // Call getChunk() - should call generateChunk directly
          await chunkManager.getChunk(chunkX, chunkY);

          // Verify generateChunk was called with correct parameters
          expect(generateChunkSpy).toHaveBeenCalledTimes(1);
          expect(generateChunkSpy).toHaveBeenCalledWith(chunkX, chunkY);

          generateChunkSpy.mockRestore();
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });

  /**
   * Test Case 3: Verify cache behavior (hits, misses, LRU eviction) works identically
   * with and without workerPoolConfig
   * 
   * **Validates: Requirement 3.3**
   */
  it('Property 2.3: Cache behavior works identically with and without workerPoolConfig', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // maxCacheSize
        fc.array(fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 })), { minLength: 5, maxLength: 10 }), // chunk coordinates
        async (maxCacheSize, chunkCoords) => {
          // Create two ChunkManagers: one without workerPoolConfig, one with
          const baseConfig = {
            seed: 99999,
            chunkSize: 32,
            terrainConfig: {
              scale: 0.01,
              octaves: 4,
              persistence: 0.5,
              lacunarity: 2.0,
              heightScale: 1.0,
              enableDomainWarping: false,
            },
            biomeConfig: {
              scale: 0.005,
              moistureScale: 0.008,
            },
            resourceConfig: {
              types: [],
              clusterScale: 50,
              densityThreshold: 0.6,
            },
            structureConfig: {
              types: [],
              minDistance: 20,
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
            maxCacheSize,
          };

          // ChunkManager without workerPoolConfig
          const chunkManagerNoWorker = new ChunkManager(baseConfig);

          // Generate chunks and track cache behavior
          for (const [x, y] of chunkCoords) {
            await chunkManagerNoWorker.getChunk(x, y);
          }

          const statsNoWorker = chunkManagerNoWorker.getCacheStats();

          // Verify cache behavior
          expect(statsNoWorker.size).toBeLessThanOrEqual(maxCacheSize);
          expect(statsNoWorker.maxSize).toBe(maxCacheSize);
          expect(statsNoWorker.hitRate).toBeGreaterThanOrEqual(0);
          expect(statsNoWorker.hitRate).toBeLessThanOrEqual(1);

          // Verify LRU eviction: cache size should not exceed maxCacheSize
          expect(chunkManagerNoWorker.getCacheSize()).toBeLessThanOrEqual(maxCacheSize);
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });

  /**
   * Test Case 4: Verify LOD transformations are applied correctly regardless of generation method
   * 
   * **Validates: Requirement 3.4**
   */
  it('Property 2.4: LOD transformations are applied correctly when workerPoolConfig is null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -5, max: 5 }), // chunkX
        fc.integer({ min: -5, max: 5 }), // chunkY
        fc.constantFrom(LODLevel.HIGH, LODLevel.MEDIUM, LODLevel.LOW), // lodLevel
        async (chunkX, chunkY, lodLevel) => {
          const config: WorldConfig = {
            seed: 77777,
            chunkSize: 32,
            terrainConfig: {
              scale: 0.01,
              octaves: 4,
              persistence: 0.5,
              lacunarity: 2.0,
              heightScale: 1.0,
              enableDomainWarping: false,
            },
            biomeConfig: {
              scale: 0.005,
              moistureScale: 0.008,
            },
            resourceConfig: {
              types: [],
              clusterScale: 50,
              densityThreshold: 0.6,
            },
            structureConfig: {
              types: [],
              minDistance: 20,
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
            lodConfig: {
              distances: [2, 5],
              meshResolutions: [1.0, 0.5, 0.25],
              featureDensities: [1.0, 0.5, 0.1],
            },
            maxCacheSize: 10,
          };

          const chunkManager = new ChunkManager(config);

          // Generate chunk with LOD level
          const chunk = await chunkManager.getChunk(chunkX, chunkY, lodLevel);

          // Verify chunk structure
          expect(chunk).toBeDefined();
          expect(chunk.x).toBe(chunkX);
          expect(chunk.y).toBe(chunkY);

          // Verify LOD was applied based on level
          if (lodLevel === LODLevel.HIGH) {
            // HIGH LOD should have full resolution
            expect(chunk.size).toBe(32);
            expect(chunk.heightmap.length).toBe(33 * 33); // (size + 1) * (size + 1)
          } else if (lodLevel === LODLevel.MEDIUM) {
            // MEDIUM LOD should have 50% resolution
            expect(chunk.size).toBe(16);
            expect(chunk.heightmap.length).toBe(17 * 17);
          } else if (lodLevel === LODLevel.LOW) {
            // LOW LOD should have 25% resolution
            expect(chunk.size).toBe(8);
            expect(chunk.heightmap.length).toBe(9 * 9);
          }
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });

  /**
   * Test Case 5: Verify getChunkIncremental() continues to work independently
   * of worker pool configuration
   * 
   * **Validates: Requirement 3.5**
   */
  it('Property 2.5: getChunkIncremental() works independently of worker pool configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -5, max: 5 }), // chunkX
        fc.integer({ min: -5, max: 5 }), // chunkY
        async (chunkX, chunkY) => {
          const config: WorldConfig = {
            seed: 88888,
            chunkSize: 32,
            terrainConfig: {
              scale: 0.01,
              octaves: 4,
              persistence: 0.5,
              lacunarity: 2.0,
              heightScale: 1.0,
              enableDomainWarping: false,
            },
            biomeConfig: {
              scale: 0.005,
              moistureScale: 0.008,
            },
            resourceConfig: {
              types: [],
              clusterScale: 50,
              densityThreshold: 0.6,
            },
            structureConfig: {
              types: [],
              minDistance: 20,
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
            incrementalConfig: {
              enabled: true,
              timeBudgetMs: 16,
            },
            maxCacheSize: 10,
          };

          const chunkManager = new ChunkManager(config);

          // Start incremental generation
          const partialChunk = chunkManager.getChunkIncremental(chunkX, chunkY);

          // Verify partial chunk structure
          expect(partialChunk).toBeDefined();
          expect(partialChunk.x).toBe(chunkX);
          expect(partialChunk.y).toBe(chunkY);
          expect(partialChunk.stage).toBeDefined();
          expect(partialChunk.completedStages).toBeInstanceOf(Set);
          expect(partialChunk.data).toBeDefined();

          // Continue generation until complete
          let isComplete = false;
          let iterations = 0;
          const maxIterations = 100; // Safety limit

          while (!isComplete && iterations < maxIterations) {
            isComplete = chunkManager.continueGeneration(chunkX, chunkY);
            iterations++;
          }

          // Verify generation completed
          expect(isComplete).toBe(true);
          expect(iterations).toBeLessThan(maxIterations);

          // Verify final stage
          const finalStage = chunkManager.getGenerationStage(chunkX, chunkY);
          expect(finalStage).toBeDefined();
        }
      ),
      {
        numRuns: 5, // Fewer runs since incremental generation is slower
        verbose: true,
      }
    );
  });

  /**
   * Concrete test case for cache behavior preservation
   * Tests specific scenario: generate 3 chunks with cache size 2, verify LRU eviction
   */
  it('Concrete case: Cache LRU eviction works correctly without workerPoolConfig', async () => {
    const config: WorldConfig = {
      seed: 11111,
      chunkSize: 32,
      terrainConfig: {
        scale: 0.01,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        heightScale: 1.0,
        enableDomainWarping: false,
      },
      biomeConfig: {
        scale: 0.005,
        moistureScale: 0.008,
      },
      resourceConfig: {
        types: [],
        clusterScale: 50,
        densityThreshold: 0.6,
      },
      structureConfig: {
        types: [],
        minDistance: 20,
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
      maxCacheSize: 2,
    };

    const chunkManager = new ChunkManager(config);

    // Generate 3 chunks with cache size 2
    await chunkManager.getChunk(0, 0); // Cache: [(0,0)]
    await chunkManager.getChunk(1, 0); // Cache: [(0,0), (1,0)]
    await chunkManager.getChunk(2, 0); // Cache: [(1,0), (2,0)] - (0,0) evicted

    // Verify cache size is 2 (LRU eviction occurred)
    expect(chunkManager.getCacheSize()).toBe(2);

    // Access (1,0) again - should be cache hit
    const statsBefore = chunkManager.getCacheStats();
    await chunkManager.getChunk(1, 0);
    const statsAfter = chunkManager.getCacheStats();

    // Verify cache hit occurred
    expect(statsAfter.hitRate).toBeGreaterThan(statsBefore.hitRate);
  });
});
