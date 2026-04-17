import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Bug Condition Exploration Test for Worker Pool Integration Fix
 * 
 * **Validates: Requirements 1.1, 1.3, 1.4, 1.5**
 * 
 * This test explores the bug condition where enabling workerPoolConfig and calling
 * updateEngineConfig() multiple times creates infinite WorkerPool instances without
 * shutting down old ones, causing memory leaks.
 * 
 * **CRITICAL**: This test is EXPECTED TO FAIL on unfixed code.
 * The failure confirms that the bug exists (multiple WorkerPool instances, no shutdown).
 * 
 * **DO NOT attempt to fix the test or code when it fails.**
 * 
 * After the fix is implemented, this same test will pass, validating the fix.
 */
describe('Bug Condition Exploration: WorkerPool Infinite Creation', () => {
  // Mock Worker API for Node.js test environment
  let MockWorker: any;
  let originalWorker: any;
  let workerInstances: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    workerInstances = [];

    // Create a mock Worker class that tracks all instances
    MockWorker = vi.fn().mockImplementation(() => {
      const instance = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null,
        onerror: null,
        _terminated: false,
      };
      
      // Override terminate to track termination
      const originalTerminate = instance.terminate;
      instance.terminate = vi.fn(() => {
        instance._terminated = true;
        originalTerminate.call(instance);
      });
      
      workerInstances.push(instance);
      return instance;
    });

    // Store original Worker and replace with mock
    originalWorker = (globalThis as any).Worker;
    (globalThis as any).Worker = MockWorker;
  });

  afterEach(() => {
    // Restore original Worker
    (globalThis as any).Worker = originalWorker;
    workerInstances = [];
  });

  /**
   * Property 1: Bug Condition - WorkerPool Infinite Creation
   * 
   * Tests that enabling workerPoolConfig and calling updateEngineConfig() multiple times
   * results in exactly one WorkerPool instance (not multiple instances).
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS
   * - Multiple WorkerPool instances are created (100+ observed in production)
   * - shutdown() is never called on old WorkerPool instances
   * - Old workers are never terminated, causing memory leak
   * 
   * **EXPECTED OUTCOME AFTER FIX**: Test PASSES
   * - Exactly one WorkerPool instance exists
   * - shutdown() is called on old WorkerPool before creating new one
   * - Old workers are terminated properly
   */
  it('Property 1: Exactly one WorkerPool instance after multiple updateEngineConfig() calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random number of updateEngineConfig() calls (2-10)
        fc.integer({ min: 2, max: 10 }),
        // Generate random maxWorkers setting (1-8 workers)
        fc.integer({ min: 1, max: 8 }),
        async (numCalls, maxWorkers) => {
          // Clear worker instances from previous property test iterations
          workerInstances.length = 0;
          
          // Dynamically import DemoApp to avoid module caching issues
          const { DemoApp } = await import('../../demo/src/core/DemoApp');
          
          // Create DemoApp instance
          const app = new DemoApp();
          await app.initialize();

          // Enable worker pool
          app.updateEngineConfig({
            workerPoolConfig: {
              maxWorkers,
              workerScriptUrl: '/worker.js',
              taskTimeout: 30000,
            },
          });

          // Record initial worker count
          const initialWorkerCount = workerInstances.length;
          expect(initialWorkerCount).toBe(maxWorkers);

          // Call updateEngineConfig() multiple times with workerPoolConfig changes
          for (let i = 0; i < numCalls - 1; i++) {
            app.updateEngineConfig({
              workerPoolConfig: {
                maxWorkers: maxWorkers + (i % 2), // Alternate between maxWorkers and maxWorkers+1
                workerScriptUrl: '/worker.js',
                taskTimeout: 30000,
              },
            });
          }

          // **CRITICAL ASSERTIONS**: These will FAIL on unfixed code
          
          // 1. Verify exactly one WorkerPool instance exists (not multiple)
          // On unfixed code: workerInstances.length will be much larger (numCalls * maxWorkers)
          const expectedMaxWorkers = maxWorkers + ((numCalls - 2) % 2);
          const expectedTotalWorkers = expectedMaxWorkers; // Should be only the latest WorkerPool's workers
          
          // On unfixed code, this will fail because old workers are never terminated
          const activeWorkers = workerInstances.filter(w => !w._terminated);
          expect(activeWorkers.length).toBe(expectedTotalWorkers);

          // 2. Verify old workers were terminated (shutdown was called)
          // On unfixed code: no workers will be terminated
          const terminatedWorkers = workerInstances.filter(w => w._terminated);
          const expectedTerminatedCount = workerInstances.length - expectedTotalWorkers;
          expect(terminatedWorkers.length).toBe(expectedTerminatedCount);

          // 3. Document counterexample if test fails
          if (activeWorkers.length !== expectedTotalWorkers) {
            console.log('COUNTEREXAMPLE FOUND:');
            console.log(`  - updateEngineConfig() called ${numCalls} times with workerPoolConfig`);
            console.log(`  - Expected ${expectedTotalWorkers} active workers (one WorkerPool)`);
            console.log(`  - Actual ${activeWorkers.length} active workers (multiple WorkerPools)`);
            console.log(`  - Total workers created: ${workerInstances.length}`);
            console.log(`  - Workers terminated: ${terminatedWorkers.length}`);
            console.log(`  - BUG CONFIRMED: Multiple WorkerPool instances exist, old ones not shut down`);
          }

          // Cleanup
          app.destroy();
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
   * Tests the exact scenario from the bug report: enabling workerPoolConfig
   * and calling updateEngineConfig() multiple times.
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS
   * **EXPECTED OUTCOME AFTER FIX**: Test PASSES
   */
  it('Concrete case: Enable worker pool and call updateEngineConfig() 5 times', async () => {
    // Dynamically import DemoApp
    const { DemoApp } = await import('../../demo/src/core/DemoApp');
    
    // Create DemoApp instance
    const app = new DemoApp();
    await app.initialize();

    // Enable worker pool with 4 workers
    app.updateEngineConfig({
      workerPoolConfig: {
        maxWorkers: 4,
        workerScriptUrl: '/worker.js',
        taskTimeout: 30000,
      },
    });

    // Verify initial state: 4 workers created
    expect(workerInstances.length).toBe(4);
    const initialWorkers = [...workerInstances];

    // Call updateEngineConfig() 4 more times (5 total calls)
    for (let i = 0; i < 4; i++) {
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });
    }

    // **CRITICAL ASSERTIONS**: These will FAIL on unfixed code

    // 1. Verify exactly 4 active workers (one WorkerPool)
    // On unfixed code: 20 workers will be active (5 WorkerPools * 4 workers each)
    const activeWorkers = workerInstances.filter(w => !w._terminated);
    expect(activeWorkers.length).toBe(4);

    // 2. Verify old workers were terminated
    // On unfixed code: 0 workers will be terminated
    const terminatedWorkers = workerInstances.filter(w => w._terminated);
    expect(terminatedWorkers.length).toBe(workerInstances.length - 4);

    // 3. Verify initial workers were terminated (shutdown was called)
    // On unfixed code: initial workers will still be active
    for (const worker of initialWorkers) {
      expect(worker._terminated).toBe(true);
    }

    // Document counterexample if test fails
    if (activeWorkers.length !== 4) {
      console.log('COUNTEREXAMPLE FOUND:');
      console.log('  - Enabled workerPoolConfig with 4 workers');
      console.log('  - Called updateEngineConfig() 5 times total');
      console.log(`  - Expected 4 active workers (one WorkerPool)`);
      console.log(`  - Actual ${activeWorkers.length} active workers`);
      console.log(`  - Total workers created: ${workerInstances.length}`);
      console.log(`  - Workers terminated: ${terminatedWorkers.length}`);
      console.log('  - BUG CONFIRMED: Multiple WorkerPool instances created without shutdown');
    }

    // Cleanup
    app.destroy();
  }, 10000);

  /**
   * Test: shutdown() is called on old WorkerPool before creating new ChunkManager
   * 
   * Verifies that when updateEngineConfig() recreates ChunkManager, it calls
   * shutdown() on the old WorkerPool instance.
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS (shutdown never called)
   * **EXPECTED OUTCOME AFTER FIX**: Test PASSES (shutdown called)
   */
  it('shutdown() is called on old WorkerPool before creating new ChunkManager', async () => {
    // Dynamically import DemoApp
    const { DemoApp } = await import('../../demo/src/core/DemoApp');
    
    // Create DemoApp instance
    const app = new DemoApp();
    await app.initialize();

    // Enable worker pool
    app.updateEngineConfig({
      workerPoolConfig: {
        maxWorkers: 4,
        workerScriptUrl: '/worker.js',
        taskTimeout: 30000,
      },
    });

    // Get reference to first WorkerPool's workers
    const firstPoolWorkers = [...workerInstances];

    // Update config again (should trigger shutdown of old pool)
    app.updateEngineConfig({
      workerPoolConfig: {
        maxWorkers: 4,
        workerScriptUrl: '/worker.js',
        taskTimeout: 30000,
      },
    });

    // **CRITICAL ASSERTION**: Old workers should be terminated
    // On unfixed code: firstPoolWorkers will still be active (terminate never called)
    for (const worker of firstPoolWorkers) {
      expect(worker.terminate).toHaveBeenCalled();
      expect(worker._terminated).toBe(true);
    }

    // Document counterexample if test fails
    const activeOldWorkers = firstPoolWorkers.filter(w => !w._terminated);
    if (activeOldWorkers.length > 0) {
      console.log('COUNTEREXAMPLE FOUND:');
      console.log('  - Created WorkerPool with 4 workers');
      console.log('  - Called updateEngineConfig() again');
      console.log(`  - Expected old workers to be terminated`);
      console.log(`  - Actual ${activeOldWorkers.length} old workers still active`);
      console.log('  - BUG CONFIRMED: shutdown() not called on old WorkerPool');
    }

    // Cleanup
    app.destroy();
  }, 10000);

  /**
   * Test: Old workers are terminated when new WorkerPool is created
   * 
   * Verifies that worker.terminate() is called on all workers from the old
   * WorkerPool when a new one is created.
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS (workers never terminated)
   * **EXPECTED OUTCOME AFTER FIX**: Test PASSES (workers terminated)
   */
  it('Old workers are terminated when new WorkerPool is created', async () => {
    // Dynamically import DemoApp
    const { DemoApp } = await import('../../demo/src/core/DemoApp');
    
    // Create DemoApp instance
    const app = new DemoApp();
    await app.initialize();

    // Enable worker pool with 4 workers
    app.updateEngineConfig({
      workerPoolConfig: {
        maxWorkers: 4,
        workerScriptUrl: '/worker.js',
        taskTimeout: 30000,
      },
    });

    expect(workerInstances.length).toBe(4);

    // Change maxWorkers to 6 (should shutdown old pool and create new one)
    app.updateEngineConfig({
      workerPoolConfig: {
        maxWorkers: 6,
        workerScriptUrl: '/worker.js',
        taskTimeout: 30000,
      },
    });

    // **CRITICAL ASSERTIONS**:
    
    // 1. Total workers created should be 10 (4 old + 6 new)
    expect(workerInstances.length).toBe(10);

    // 2. First 4 workers should be terminated
    // On unfixed code: first 4 workers will still be active
    for (let i = 0; i < 4; i++) {
      expect(workerInstances[i]._terminated).toBe(true);
    }

    // 3. Last 6 workers should be active
    for (let i = 4; i < 10; i++) {
      expect(workerInstances[i]._terminated).toBe(false);
    }

    // 4. Exactly 6 active workers (new pool only)
    const activeWorkers = workerInstances.filter(w => !w._terminated);
    expect(activeWorkers.length).toBe(6);

    // Document counterexample if test fails
    if (activeWorkers.length !== 6) {
      console.log('COUNTEREXAMPLE FOUND:');
      console.log('  - Created WorkerPool with 4 workers');
      console.log('  - Changed maxWorkers to 6');
      console.log(`  - Expected 6 active workers (new pool only)`);
      console.log(`  - Actual ${activeWorkers.length} active workers`);
      console.log(`  - Old workers terminated: ${workerInstances.slice(0, 4).filter(w => w._terminated).length}/4`);
      console.log('  - BUG CONFIRMED: Old workers not terminated');
    }

    // Cleanup
    app.destroy();
  }, 10000);
});

/**
 * Preservation Property Tests for Worker Pool Integration Fix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * These tests validate that non-workerPoolConfig updates continue to work correctly
 * after the fix is implemented. They follow the observation-first methodology:
 * 
 * 1. Run tests on UNFIXED code to observe baseline behavior
 * 2. Tests should PASS on unfixed code (confirming current behavior)
 * 3. After fix is implemented, tests should still PASS (confirming no regressions)
 * 
 * **EXPECTED OUTCOME ON UNFIXED CODE**: Tests PASS
 * **EXPECTED OUTCOME AFTER FIX**: Tests PASS
 */
describe('Preservation: Non-WorkerPool Configuration Updates', () => {
  // Mock Worker API for Node.js test environment
  let MockWorker: any;
  let originalWorker: any;
  let workerInstances: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    workerInstances = [];

    // Create a mock Worker class that tracks all instances
    MockWorker = vi.fn().mockImplementation(() => {
      const instance = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null,
        onerror: null,
        _terminated: false,
      };
      
      // Override terminate to track termination
      const originalTerminate = instance.terminate;
      instance.terminate = vi.fn(() => {
        instance._terminated = true;
        originalTerminate.call(instance);
      });
      
      workerInstances.push(instance);
      return instance;
    });

    // Store original Worker and replace with mock
    originalWorker = (globalThis as any).Worker;
    (globalThis as any).Worker = MockWorker;
  });

  afterEach(() => {
    // Restore original Worker
    (globalThis as any).Worker = originalWorker;
    workerInstances = [];
  });

  /**
   * Property 2: Preservation - Non-WorkerPool Configuration Updates
   * 
   * Tests that updateEngineConfig() with non-workerPoolConfig changes produces
   * the same behavior as before the fix. This includes terrain config, biome config,
   * LOD config, incremental config, and cache size updates.
   * 
   * **EXPECTED OUTCOME**: Tests PASS on both unfixed and fixed code
   */
  it('Property 2: Non-workerPoolConfig updates work correctly without WorkerPool', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random terrain config updates
        fc.record({
          baseScale: fc.double({ min: 0.001, max: 0.1 }),
          octaves: fc.integer({ min: 1, max: 8 }),
          persistence: fc.double({ min: 0.1, max: 0.9 }),
          lacunarity: fc.double({ min: 1.5, max: 3.0 }),
        }),
        // Generate random biome config updates
        fc.record({
          temperatureScale: fc.double({ min: 0.001, max: 0.01 }),
          moistureScale: fc.double({ min: 0.001, max: 0.01 }),
        }),
        // Generate random cache size
        fc.integer({ min: 100, max: 2000 }),
        async (terrainConfig, biomeConfig, maxCacheSize) => {
          // Clear worker instances from previous property test iterations
          workerInstances.length = 0;
          
          // Dynamically import DemoApp
          const { DemoApp } = await import('../../demo/src/core/DemoApp');
          
          // Create DemoApp instance WITHOUT worker pool
          const app = new DemoApp();
          await app.initialize();

          // Verify no workers created initially
          expect(workerInstances.length).toBe(0);

          // Update terrain config (should NOT create WorkerPool)
          app.updateEngineConfig({ terrainConfig });
          expect(workerInstances.length).toBe(0);

          // Update biome config (should NOT create WorkerPool)
          app.updateEngineConfig({ biomeConfig });
          expect(workerInstances.length).toBe(0);

          // Update cache size (should NOT create WorkerPool)
          app.updateEngineConfig({ maxCacheSize });
          expect(workerInstances.length).toBe(0);

          // Verify ChunkManager still exists and works
          const state = app.getState();
          expect(state.chunkManager).not.toBeNull();
          expect(state.config.terrainConfig).toEqual(terrainConfig);
          expect(state.config.biomeConfig).toEqual(biomeConfig);
          expect(state.config.maxCacheSize).toBe(maxCacheSize);

          // Cleanup
          app.destroy();
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  }, 30000);

  /**
   * Test: Synchronous chunk generation works when workerPoolConfig is null
   * 
   * Validates that the default synchronous generation path continues to work
   * correctly without any WorkerPool involvement.
   * 
   * **EXPECTED OUTCOME**: Test PASSES on both unfixed and fixed code
   */
  it('Synchronous chunk generation works when workerPoolConfig is null', async () => {
    // Dynamically import DemoApp
    const { DemoApp } = await import('../../demo/src/core/DemoApp');
    
    // Create DemoApp instance WITHOUT worker pool
    const app = new DemoApp();
    await app.initialize();

    // Verify no workers created
    expect(workerInstances.length).toBe(0);

    // Generate chunks synchronously
    await app.loadChunksAround(0, 0, 1);

    // Verify chunks were loaded
    const state = app.getState();
    expect(state.loadedChunkCount).toBeGreaterThan(0);
    expect(state.loadedChunks.size).toBeGreaterThan(0);

    // Verify still no workers created
    expect(workerInstances.length).toBe(0);

    // Cleanup
    app.destroy();
  }, 10000);

  /**
   * Test: LOD configuration updates work correctly
   * 
   * Validates that LOD config updates continue to work without affecting
   * WorkerPool behavior. Note: LOD config alone doesn't trigger ChunkManager
   * recreation, so lodManager remains null unless combined with other config changes.
   * 
   * **EXPECTED OUTCOME**: Test PASSES on both unfixed and fixed code
   */
  it('LOD configuration updates work correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random LOD config
        fc.record({
          highDetailRadius: fc.integer({ min: 1, max: 3 }),
          mediumDetailRadius: fc.integer({ min: 2, max: 5 }),
          lowDetailRadius: fc.integer({ min: 3, max: 8 }),
          highDetailResolution: fc.integer({ min: 16, max: 64 }),
          mediumDetailResolution: fc.integer({ min: 8, max: 32 }),
          lowDetailResolution: fc.integer({ min: 4, max: 16 }),
        }),
        async (lodConfig) => {
          // Clear worker instances from previous property test iterations
          workerInstances.length = 0;
          
          // Dynamically import DemoApp
          const { DemoApp } = await import('../../demo/src/core/DemoApp');
          
          // Create DemoApp instance WITHOUT worker pool
          const app = new DemoApp();
          await app.initialize();

          // Update LOD config (should NOT create WorkerPool)
          app.updateEngineConfig({ lodConfig });

          // Verify no workers created
          expect(workerInstances.length).toBe(0);

          // Verify LOD config was updated in state
          const state = app.getState();
          expect(state.config.lodConfig).toEqual(lodConfig);
          
          // Note: lodManager remains null because LOD config alone doesn't trigger
          // ChunkManager recreation. This is the observed baseline behavior.
          expect(state.lodManager).toBeNull();

          // Cleanup
          app.destroy();
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  }, 30000);

  /**
   * Test: Incremental generation configuration updates work correctly
   * 
   * Validates that incremental generation config updates continue to work
   * without affecting WorkerPool behavior.
   * 
   * **EXPECTED OUTCOME**: Test PASSES on both unfixed and fixed code
   */
  it('Incremental generation configuration updates work correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random incremental config
        fc.record({
          enabled: fc.boolean(),
          timeBudgetMs: fc.integer({ min: 5, max: 50 }),
          stagesPerFrame: fc.integer({ min: 1, max: 3 }),
        }),
        async (incrementalConfig) => {
          // Clear worker instances from previous property test iterations
          workerInstances.length = 0;
          
          // Dynamically import DemoApp
          const { DemoApp } = await import('../../demo/src/core/DemoApp');
          
          // Create DemoApp instance WITHOUT worker pool
          const app = new DemoApp();
          await app.initialize();

          // Update incremental config (should recreate ChunkManager but NOT create WorkerPool)
          app.updateEngineConfig({ incrementalConfig });

          // Verify no workers created
          expect(workerInstances.length).toBe(0);

          // Verify incremental config was updated
          const state = app.getState();
          expect(state.config.incrementalConfig).toEqual(incrementalConfig);
          expect(state.incrementalEnabled).toBe(incrementalConfig.enabled);

          // Cleanup
          app.destroy();
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  }, 30000);

  /**
   * Test: Multiple non-workerPoolConfig updates in sequence
   * 
   * Validates that multiple configuration updates work correctly without
   * creating any WorkerPool instances.
   * 
   * **EXPECTED OUTCOME**: Test PASSES on both unfixed and fixed code
   */
  it('Multiple non-workerPoolConfig updates work correctly', async () => {
    // Dynamically import DemoApp
    const { DemoApp } = await import('../../demo/src/core/DemoApp');
    
    // Create DemoApp instance WITHOUT worker pool
    const app = new DemoApp();
    await app.initialize();

    // Verify no workers created initially
    expect(workerInstances.length).toBe(0);

    // Update terrain config
    app.updateEngineConfig({
      terrainConfig: {
        baseScale: 0.02,
        octaves: 5,
        persistence: 0.6,
        lacunarity: 2.5,
        warpStrength: 1.5,
        heightMultiplier: 1.2,
        enable3D: false,
        zScale: 0.5,
      },
    });
    expect(workerInstances.length).toBe(0);

    // Update biome config
    app.updateEngineConfig({
      biomeConfig: {
        temperatureScale: 0.008,
        moistureScale: 0.008,
        blendRadius: 8,
      },
    });
    expect(workerInstances.length).toBe(0);

    // Update cache size (requires ChunkManager recreation)
    app.updateEngineConfig({ maxCacheSize: 500 });
    expect(workerInstances.length).toBe(0);

    // Update incremental config (requires ChunkManager recreation)
    app.updateEngineConfig({
      incrementalConfig: {
        enabled: true,
        timeBudgetMs: 10,
        stagesPerFrame: 2,
      },
    });
    expect(workerInstances.length).toBe(0);

    // Verify all configs were updated
    const state = app.getState();
    expect(state.config.terrainConfig?.baseScale).toBe(0.02);
    expect(state.config.biomeConfig?.temperatureScale).toBe(0.008);
    expect(state.config.maxCacheSize).toBe(500);
    expect(state.config.incrementalConfig?.enabled).toBe(true);
    expect(state.incrementalEnabled).toBe(true);

    // Verify ChunkManager still works
    expect(state.chunkManager).not.toBeNull();

    // Cleanup
    app.destroy();
  }, 10000);

  /**
   * Test: Configuration updates work correctly after disabling worker pool
   * 
   * Validates that after disabling worker pool, non-workerPoolConfig updates
   * continue to work correctly.
   * 
   * **EXPECTED OUTCOME**: Test PASSES on both unfixed and fixed code
   */
  it('Configuration updates work correctly after disabling worker pool', async () => {
    // Dynamically import DemoApp
    const { DemoApp } = await import('../../demo/src/core/DemoApp');
    
    // Create DemoApp instance
    const app = new DemoApp();
    await app.initialize();

    // Enable worker pool
    app.updateEngineConfig({
      workerPoolConfig: {
        maxWorkers: 4,
        workerScriptUrl: '/worker.js',
        taskTimeout: 30000,
      },
    });
    expect(workerInstances.length).toBe(4);

    // Disable worker pool
    app.updateEngineConfig({ workerPoolConfig: undefined });

    // Now update non-workerPoolConfig settings (should NOT create new workers)
    const workerCountAfterDisable = workerInstances.length;

    app.updateEngineConfig({
      terrainConfig: {
        baseScale: 0.015,
        octaves: 6,
        persistence: 0.55,
        lacunarity: 2.2,
        warpStrength: 1.0,
        heightMultiplier: 1.0,
        enable3D: false,
        zScale: 0.5,
      },
    });

    // Verify no new workers created
    expect(workerInstances.length).toBe(workerCountAfterDisable);

    // Verify config was updated
    const state = app.getState();
    expect(state.config.terrainConfig?.baseScale).toBe(0.015);
    expect(state.workerPoolEnabled).toBe(false);

    // Cleanup
    app.destroy();
  }, 10000);
});
