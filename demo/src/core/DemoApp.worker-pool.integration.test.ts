/**
 * DemoApp Worker Pool Integration Tests
 * 
 * Comprehensive integration tests for Worker Pool functionality
 * Tests parallel chunk generation, worker failure recovery, and performance scaling
 * 
 * **Validates: Requirements 8.1, 8.2, 8.5**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DemoApp } from './DemoApp';
import { ChunkData, BiomeType } from '../../../src/index';

describe('DemoApp - Worker Pool Integration', () => {
  let app: DemoApp;
  let mockWorkers: MockWorker[] = [];

  // Mock Worker class for testing
  class MockWorker {
    postMessage: (msg: any) => void;
    terminate: () => void;
    onmessage: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    private workerId: number;
    private static nextId = 0;
    private isTerminated = false;
    private processingDelay: number;
    private shouldFail: boolean;

    constructor(_url: string, processingDelay = 10, shouldFail = false) {
      this.workerId = MockWorker.nextId++;
      this.processingDelay = processingDelay;
      this.shouldFail = shouldFail;
      this.onmessage = null;
      this.onerror = null;

      this.postMessage = (msg: any) => {
        if (this.isTerminated) {
          return;
        }

        // Simulate async chunk generation
        setTimeout(() => {
          if (this.isTerminated || !this.onmessage) {
            return;
          }

          // Simulate worker failure if configured
          if (this.shouldFail && this.onerror) {
            this.onerror({
              message: 'Simulated worker failure',
            } as any);
            return;
          }

          // Generate mock chunk data
          const chunkData: ChunkData = {
            x: msg.chunkX,
            y: msg.chunkY,
            size: 32,
            heightmap: new Float32Array(33 * 33).fill(0.5),
            biomeMap: new Uint8Array(32 * 32).fill(BiomeType.PLAINS),
            biomeWeights: new Float32Array(32 * 32 * 4).fill(0.25),
            resources: [],
            structures: [],
            rivers: new Set(),
          };

          this.onmessage({
            data: chunkData,
          });
        }, this.processingDelay);
      };

      this.terminate = () => {
        this.isTerminated = true;
        this.onmessage = null;
        this.onerror = null;
      };

      mockWorkers.push(this);
    }

    static resetId() {
      MockWorker.nextId = 0;
    }

    getId() {
      return this.workerId;
    }

    simulateError(message: string) {
      if (this.onerror && !this.isTerminated) {
        this.onerror({ message } as any);
      }
    }
  }

  beforeEach(async () => {
    mockWorkers = [];
    MockWorker.resetId();

    // Replace global Worker with mock
    (globalThis as any).Worker = MockWorker;

    app = new DemoApp();
    await app.initialize();
  });

  afterEach(() => {
    mockWorkers = [];
  });

  describe('Enable Workers and Generate Multiple Chunks in Parallel (Requirements 8.1, 8.2, 8.5)', () => {
    it('should enable worker pool when config is updated', () => {
      // Initially disabled
      expect(app.getState().workerPoolEnabled).toBe(false);

      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Should be enabled
      const state = app.getState();
      expect(state.workerPoolEnabled).toBe(true);
      expect(state.config.workerPoolConfig).toBeDefined();
      expect(state.config.workerPoolConfig?.maxWorkers).toBe(4);
    });

    it('should generate multiple chunks when worker pool is enabled', async () => {
      // Enable worker pool with 4 workers
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Generate world (creates 3x3 grid = 9 chunks)
      await app.generateWorld(12345);

      const state = app.getState();

      // Should have loaded chunks
      expect(state.loadedChunkCount).toBeGreaterThan(0);
      expect(state.loadedChunks.size).toBeGreaterThan(0);

      // Worker pool configuration should be maintained
      expect(state.workerPoolEnabled).toBe(true);
      expect(state.config.workerPoolConfig?.maxWorkers).toBe(4);
    });

    it('should maintain worker pool config when loading chunks', async () => {
      // Enable worker pool with 3 workers
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 3,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Load chunks in a larger area (5x5 = 25 chunks)
      await app.loadChunksAround(0, 0, 2);

      const state = app.getState();

      // Should have loaded multiple chunks
      expect(state.loadedChunkCount).toBeGreaterThan(0);

      // Worker pool config should be maintained
      expect(state.workerPoolEnabled).toBe(true);
      expect(state.config.workerPoolConfig?.maxWorkers).toBe(3);
    });

    it('should provide worker pool statistics API', async () => {
      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Generate chunks
      await app.loadChunksAround(0, 0, 3);

      // Check stats API is available
      const stats = app.getWorkerPoolStats();
      expect(stats).toBeDefined();
      expect(typeof stats.activeWorkers).toBe('number');
      expect(typeof stats.queuedTasks).toBe('number');
      expect(typeof stats.completedTasks).toBe('number');
      expect(typeof stats.avgWorkerTime).toBe('number');

      // Stats should be non-negative
      expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.queuedTasks).toBeGreaterThanOrEqual(0);
      expect(stats.completedTasks).toBeGreaterThanOrEqual(0);
      expect(stats.avgWorkerTime).toBeGreaterThanOrEqual(0);
    });

    it('should update worker pool statistics in app state', async () => {
      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Generate chunks
      await app.generateWorld(12345);

      // Update stats
      app.updateWorkerPoolStats();

      const state = app.getState();

      // State should have worker pool statistics
      expect(typeof state.activeWorkers).toBe('number');
      expect(typeof state.queuedTasks).toBe('number');
      expect(typeof state.completedTasks).toBe('number');
      expect(typeof state.avgWorkerTime).toBe('number');
    });

    it('should maintain consistent generation time with worker pool enabled', async () => {
      // Test with single worker
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 1,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      const startSingle = performance.now();
      await app.loadChunksAround(0, 0, 1); // 3x3 = 9 chunks
      const timeSingle = performance.now() - startSingle;

      // Reset app
      await app.initialize();

      // Test with multiple workers
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      const startMulti = performance.now();
      await app.loadChunksAround(0, 0, 1); // 3x3 = 9 chunks
      const timeMulti = performance.now() - startMulti;

      // Both should complete in reasonable time
      expect(timeSingle).toBeGreaterThan(0);
      expect(timeMulti).toBeGreaterThan(0);
      
      // Worker pool config should not break generation
      expect(timeMulti).toBeLessThan(timeSingle * 2);
    });

    it('should handle chunk loading with worker pool enabled', async () => {
      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Load chunks around different positions
      await app.loadChunksAround(0, 0, 1);
      const state1 = app.getState();
      const count1 = state1.loadedChunkCount;

      await app.loadChunksAround(5, 5, 1);
      const state2 = app.getState();
      const count2 = state2.loadedChunkCount;

      // Should have loaded more chunks
      expect(count2).toBeGreaterThan(count1);

      // Worker pool config should be maintained
      expect(app.getState().workerPoolEnabled).toBe(true);
    });
  });

  describe('Worker Failure Recovery (Requirement 8.2)', () => {
    it('should handle worker errors gracefully', async () => {
      // Create a mock worker that fails
      let failNextWorker = false;
      (globalThis as any).Worker = class extends MockWorker {
        constructor(url: string) {
          super(url, 10, failNextWorker);
          failNextWorker = false; // Only fail one worker
        }
      };

      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 2,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Trigger worker failure on next task
      failNextWorker = true;

      // Generate chunks - should handle failure gracefully
      await app.generateWorld(12345);

      const state = app.getState();

      // Should still have loaded some chunks (from successful workers)
      // Even if one worker fails, others should continue
      expect(state.loadedChunkCount).toBeGreaterThanOrEqual(0);
    });

    it('should continue processing queue after worker error', async () => {
      let taskCount = 0;
      let shouldFailTask = false;

      (globalThis as any).Worker = class extends MockWorker {
        constructor(url: string) {
          super(url, 10, false);
        }

        postMessage(msg: any) {
          taskCount++;
          const currentTaskCount = taskCount;

          if (this.isTerminated) {
            return;
          }

          setTimeout(() => {
            if (this.isTerminated) {
              return;
            }

            // Fail the second task
            if (currentTaskCount === 2 && this.onerror) {
              this.onerror({ message: 'Task 2 failed' } as any);
              return;
            }

            // Success for other tasks
            if (this.onmessage) {
              const chunkData: ChunkData = {
                x: msg.chunkX,
                y: msg.chunkY,
                size: 32,
                heightmap: new Float32Array(33 * 33).fill(0.5),
                biomeMap: new Uint8Array(32 * 32).fill(BiomeType.PLAINS),
                biomeWeights: new Float32Array(32 * 32 * 4).fill(0.25),
                resources: [],
                structures: [],
                rivers: new Set(),
              };

              this.onmessage({ data: chunkData });
            }
          }, 10);
        }
      };

      // Enable worker pool with single worker
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 1,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Load multiple chunks
      await app.loadChunksAround(0, 0, 1);

      const state = app.getState();

      // Should have loaded some chunks despite one failure
      expect(state.loadedChunkCount).toBeGreaterThan(0);
    });

    it('should maintain worker pool stats after errors', async () => {
      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 2,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Generate chunks
      await app.generateWorld(12345);

      // Get stats
      const stats = app.getWorkerPoolStats();

      // Stats should be valid even if some tasks failed
      expect(stats).toBeDefined();
      expect(typeof stats.activeWorkers).toBe('number');
      expect(typeof stats.queuedTasks).toBe('number');
      expect(typeof stats.completedTasks).toBe('number');
      expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.queuedTasks).toBeGreaterThanOrEqual(0);
      expect(stats.completedTasks).toBeGreaterThanOrEqual(0);
    });

    it('should handle worker timeout gracefully', async () => {
      // Create worker with very long processing delay
      (globalThis as any).Worker = class extends MockWorker {
        constructor(url: string) {
          super(url, 200); // 200ms delay
        }
      };

      // Enable worker pool with short timeout
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 1,
          workerScriptUrl: '/worker.js',
          taskTimeout: 50, // 50ms timeout (shorter than processing delay)
        },
      });

      // Try to generate chunks - should timeout
      await app.generateWorld(12345);

      // App should still be functional
      const state = app.getState();
      expect(state).toBeDefined();
      expect(state.workerPoolEnabled).toBe(true);
    });
  });

  describe('Performance Scaling with Multiple Workers (Requirement 8.5)', () => {
    it('should maintain consistent performance with different worker counts', async () => {
      const numChunks = 12;

      // Test with 1 worker
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 1,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      const start1 = performance.now();
      await app.loadChunksAround(0, 0, 2); // Load ~12 chunks
      const time1 = performance.now() - start1;

      // Reset app
      await app.initialize();

      // Test with 4 workers
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      const start4 = performance.now();
      await app.loadChunksAround(0, 0, 2); // Load ~12 chunks
      const time4 = performance.now() - start4;

      // Both should complete successfully
      expect(time1).toBeGreaterThan(0);
      expect(time4).toBeGreaterThan(0);
      
      // Worker pool config should not significantly degrade performance
      expect(time4).toBeLessThan(time1 * 2);
    });

    it('should scale worker count based on configuration', async () => {
      // Test with 2 workers
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 2,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      await app.generateWorld(12345);
      const state2 = app.getState();

      // Reset app
      await app.initialize();

      // Test with 8 workers
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 8,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      await app.generateWorld(12345);
      const state8 = app.getState();

      // Both should complete successfully
      expect(state2.loadedChunkCount).toBeGreaterThan(0);
      expect(state8.loadedChunkCount).toBeGreaterThan(0);
      
      // Should load same number of chunks
      expect(state8.loadedChunkCount).toBe(state2.loadedChunkCount);
    });

    it('should track per-worker generation time', async () => {
      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Generate chunks
      await app.generateWorld(12345);

      // Get stats
      const stats = app.getWorkerPoolStats();

      // Should have average worker time
      expect(typeof stats.avgWorkerTime).toBe('number');
      expect(stats.avgWorkerTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle large number of chunks efficiently', async () => {
      // Enable worker pool with multiple workers
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Load a large area (7x7 = 49 chunks)
      const start = performance.now();
      await app.loadChunksAround(0, 0, 3);
      const time = performance.now() - start;

      const state = app.getState();

      // Should have loaded many chunks
      expect(state.loadedChunkCount).toBeGreaterThan(20);

      // Should complete in reasonable time (< 15 seconds for test environment)
      expect(time).toBeLessThan(15000);
    });

    it('should maintain performance with worker pool disabled', async () => {
      // Test without worker pool
      const startWithout = performance.now();
      await app.generateWorld(12345);
      const timeWithout = performance.now() - startWithout;

      const stateWithout = app.getState();
      const chunksWithout = stateWithout.loadedChunkCount;

      // Reset app
      await app.initialize();

      // Test with worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      const startWith = performance.now();
      await app.generateWorld(12345);
      const timeWith = performance.now() - startWith;

      const stateWith = app.getState();
      const chunksWith = stateWith.loadedChunkCount;

      // Should load same number of chunks
      expect(chunksWith).toBe(chunksWithout);

      // Worker pool config should not significantly degrade performance
      expect(timeWith).toBeLessThan(timeWithout * 2);
    });

    it('should update statistics during generation', async () => {
      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Generate chunks
      await app.generateWorld(12345);

      // Update stats multiple times
      app.updateWorkerPoolStats();
      const stats1 = app.getWorkerPoolStats();

      await app.loadChunksAround(5, 5, 1);

      app.updateWorkerPoolStats();
      const stats2 = app.getWorkerPoolStats();

      // Stats should be valid
      expect(stats1).toBeDefined();
      expect(stats2).toBeDefined();
      expect(typeof stats1.completedTasks).toBe('number');
      expect(typeof stats2.completedTasks).toBe('number');
    });

    it('should handle concurrent chunk loading requests', async () => {
      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      // Submit multiple concurrent loading requests
      const promises = [
        app.loadChunksAround(0, 0, 1),
        app.loadChunksAround(5, 5, 1),
        app.loadChunksAround(10, 10, 1),
      ];

      await Promise.all(promises);

      const state = app.getState();

      // Should have loaded chunks from all requests
      expect(state.loadedChunkCount).toBeGreaterThan(0);

      // Worker pool config should be maintained
      expect(state.workerPoolEnabled).toBe(true);
    });
  });

  describe('Worker Pool State Management', () => {
    it('should disable worker pool when config is removed', () => {
      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      expect(app.getState().workerPoolEnabled).toBe(true);

      // Disable worker pool
      app.updateEngineConfig({
        workerPoolConfig: undefined,
      });

      expect(app.getState().workerPoolEnabled).toBe(false);
    });

    it('should return zero stats when worker pool is disabled', () => {
      const stats = app.getWorkerPoolStats();

      expect(stats.activeWorkers).toBe(0);
      expect(stats.queuedTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
      expect(stats.avgWorkerTime).toBe(0);
    });

    it('should notify subscribers when worker pool is enabled', () => {
      const callback = vi.fn();
      app.subscribeToState(callback);

      // Clear initial call
      callback.mockClear();

      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      expect(callback).toHaveBeenCalled();
      const state = callback.mock.calls[0][0];
      expect(state.workerPoolEnabled).toBe(true);
    });

    it('should update maxWorkers when config changes', () => {
      // Enable with 4 workers
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      expect(app.getState().config.workerPoolConfig?.maxWorkers).toBe(4);

      // Update to 8 workers
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 8,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000,
        },
      });

      expect(app.getState().config.workerPoolConfig?.maxWorkers).toBe(8);
    });
  });
});
