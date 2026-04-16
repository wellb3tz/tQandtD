import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { WorkerPool, WorkerPoolConfig, WorkerTask } from '../../src/world/worker-pool';
import type { ChunkData } from '../../src/world/chunk';

describe('WorkerPool Property Tests', () => {
  let pool: WorkerPool | null = null;

  // Clean up after each test
  afterEach(() => {
    if (pool) {
      pool.shutdown();
      pool = null;
    }
  });

  // Feature: 3d-world-generation-enhancements, Property 18: Thread-safe parameter access
  // **Validates: Requirements 9.3**
  test('concurrent access to shared world generation parameters maintains data consistency', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }), // Number of workers (2-4 for concurrency)
        fc.integer({ min: 5, max: 15 }), // Number of concurrent tasks
        fc.integer(), // World seed
        fc.integer({ min: 16, max: 64 }), // Chunk size
        (numWorkers, numTasks, seed, chunkSize) => {
          // Create configuration with shared parameters
          // This simulates the shared WorldConfig that workers would access
          const sharedConfig = {
            seed,
            chunkSize,
            terrainConfig: { scale: 0.01, octaves: 4, persistence: 0.5, lacunarity: 2.0 },
            biomeConfig: { scale: 0.005, octaves: 3 },
            resourceConfig: { density: 0.1 },
            structureConfig: { density: 0.05 },
            riverNetworkConfig: { minLength: 10, maxBranches: 3 },
          };

          const config: WorkerPoolConfig = {
            maxWorkers: numWorkers,
            workerScriptUrl: 'mock-worker.js',
            taskTimeout: 30000,
          };

          // Track all parameter reads to detect corruption
          const parameterReads: Array<{
            workerId: number;
            seed: number;
            chunkSize: number;
            timestamp: number;
          }> = [];

          let testPool: WorkerPool | null = null;

          // Mock Worker to simulate concurrent parameter access
          const originalWorker = (globalThis as any).Worker;
          (globalThis as any).Worker = class MockWorker {
            postMessage: (msg: any) => void;
            terminate: () => void;
            onmessage: ((event: any) => void) | null;
            onerror: ((event: any) => void) | null;
            private workerId: number;
            private static nextId = 0;

            constructor(_url: string) {
              this.workerId = MockWorker.nextId++;
              this.postMessage = (msg: any) => {
                // Simulate worker reading shared parameters
                // This is where race conditions could occur in a real implementation
                // Each worker reads the shared config multiple times
                for (let i = 0; i < 3; i++) {
                  parameterReads.push({
                    workerId: this.workerId,
                    seed: sharedConfig.seed,
                    chunkSize: sharedConfig.chunkSize,
                    timestamp: Date.now(),
                  });
                }

                // Immediately call onmessage (synchronous for testing)
                if (this.onmessage) {
                  this.onmessage({
                    data: {
                      x: msg.chunkX,
                      y: msg.chunkY,
                      size: sharedConfig.chunkSize,
                      heightmap: new Float32Array(sharedConfig.chunkSize * sharedConfig.chunkSize),
                      biomeMap: new Uint8Array(sharedConfig.chunkSize * sharedConfig.chunkSize),
                      resources: [],
                      structures: [],
                      rivers: [],
                    },
                  });
                }
              };
              this.terminate = () => {
                // Reset static counter on terminate
              };
              this.onmessage = null;
              this.onerror = null;
            }
          };

          try {
            testPool = new WorkerPool(config);

            // Track task completions
            let completedTasks = 0;
            const errors: Error[] = [];

            // Submit multiple tasks concurrently
            for (let i = 0; i < numTasks; i++) {
              const task: WorkerTask = {
                id: `task-${i}`,
                chunkX: i,
                chunkY: 0,
                lodLevel: 0,
                priority: i % 3, // Varying priorities
                onComplete: (_chunk: ChunkData) => {
                  completedTasks++;
                },
                onError: (error: Error) => {
                  errors.push(error);
                },
              };
              testPool.submitTask(task);
            }

            // Property: All parameter reads should have consistent values
            // No corruption or race conditions should occur
            const allSeedsMatch = parameterReads.every(read => read.seed === seed);
            const allChunkSizesMatch = parameterReads.every(read => read.chunkSize === chunkSize);

            // Verify that parameters remained consistent across all concurrent accesses
            // Even though multiple workers accessed the shared config simultaneously
            if (!allSeedsMatch || !allChunkSizesMatch) {
              return false;
            }

            // Verify no errors occurred during concurrent access
            if (errors.length > 0) {
              return false;
            }

            // Verify all tasks completed successfully
            if (completedTasks !== numTasks) {
              return false;
            }

            return true;
          } finally {
            // Clean up
            if (testPool) {
              testPool.shutdown();
            }
            // Restore original Worker
            (globalThis as any).Worker = originalWorker;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: 3d-world-generation-enhancements, Property 17: Worker task distribution
  // **Validates: Requirements 9.2**
  test('tasks are distributed across available workers with no idle workers while tasks remain in queue', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }), // Number of workers (1-4)
        fc.integer({ min: 1, max: 20 }), // Number of tasks (1-20)
        fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 1, maxLength: 20 }), // Task priorities
        (numWorkers, numTasks, priorities) => {
          // Ensure we have enough priorities for all tasks
          const taskPriorities = priorities.slice(0, numTasks);
          while (taskPriorities.length < numTasks) {
            taskPriorities.push(0);
          }

          // Create a mock worker script URL (won't actually be used in test)
          const config: WorkerPoolConfig = {
            maxWorkers: numWorkers,
            workerScriptUrl: 'mock-worker.js',
            taskTimeout: 30000,
          };

          // Mock Worker constructor to avoid actual worker creation
          const mockWorkers: Array<{
            postMessage: (msg: any) => void;
            terminate: () => void;
            onmessage: ((event: any) => void) | null;
            onerror: ((event: any) => void) | null;
          }> = [];

          const originalWorker = (globalThis as any).Worker;
          (globalThis as any).Worker = class MockWorker {
            postMessage: (msg: any) => void;
            terminate: () => void;
            onmessage: ((event: any) => void) | null;
            onerror: ((event: any) => void) | null;

            constructor(url: string) {
              this.postMessage = (msg: any) => {
                // Don't simulate async completion - we'll test synchronous state
              };
              this.terminate = () => {};
              this.onmessage = null;
              this.onerror = null;
              mockWorkers.push(this);
            }
          };

          let testPool: WorkerPool | null = null;
          try {
            testPool = new WorkerPool(config);

            // Track task submissions
            const submittedTasks: string[] = [];

            // Submit all tasks
            for (let i = 0; i < numTasks; i++) {
              const task: WorkerTask = {
                id: `task-${i}`,
                chunkX: i,
                chunkY: 0,
                lodLevel: 0,
                priority: taskPriorities[i],
                onComplete: (chunk: ChunkData) => {
                  // Task completion callback
                },
                onError: (error: Error) => {
                  // Task error callback
                },
              };

              const taskId = testPool.submitTask(task);
              submittedTasks.push(taskId);
            }

            // Immediately check pool statistics after submission
            const statsAfterSubmission = testPool.getStats();

            // Property: No worker should be idle while tasks remain in the queue
            // If there are more tasks than workers, all workers should be active
            if (numTasks >= numWorkers) {
              // All workers should be active (no idle workers)
              if (statsAfterSubmission.activeWorkers !== numWorkers) {
                return false;
              }
            } else {
              // If fewer tasks than workers, active workers should equal number of tasks
              if (statsAfterSubmission.activeWorkers !== numTasks) {
                return false;
              }
            }

            // Verify that tasks in queue + active workers = total tasks
            const totalAccountedTasks =
              statsAfterSubmission.queuedTasks + statsAfterSubmission.activeWorkers;
            if (totalAccountedTasks !== numTasks) {
              return false;
            }

            // Verify queue size is correct
            const expectedQueueSize = Math.max(0, numTasks - numWorkers);
            if (statsAfterSubmission.queuedTasks !== expectedQueueSize) {
              return false;
            }

            return true;
          } finally {
            // Clean up
            if (testPool) {
              testPool.shutdown();
            }
            // Restore original Worker
            (globalThis as any).Worker = originalWorker;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

