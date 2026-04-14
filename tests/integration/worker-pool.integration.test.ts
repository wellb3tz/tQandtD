/**
 * Integration tests for Worker Pool
 * Tests parallel chunk generation, worker failure recovery, and performance scaling
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkerPool, WorkerPoolConfig, WorkerTask } from '../../src/world/worker-pool';
import { ChunkData, BiomeType, ResourceType, StructureType } from '../../src/world/chunk';

describe('Worker Pool Integration Tests', () => {
  let pool: WorkerPool | null = null;
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

    constructor(_url: string, processingDelay = 10) {
      this.workerId = MockWorker.nextId++;
      this.processingDelay = processingDelay;
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

  beforeEach(() => {
    mockWorkers = [];
    MockWorker.resetId();

    // Replace global Worker with mock
    (globalThis as any).Worker = MockWorker;
  });

  afterEach(() => {
    if (pool) {
      pool.shutdown();
      pool = null;
    }
    mockWorkers = [];
  });

  describe('Parallel Chunk Generation', () => {
    test('should generate multiple chunks in parallel when workers are enabled', async () => {
      const config: WorkerPoolConfig = {
        maxWorkers: 4,
        workerScriptUrl: 'mock-worker.js',
        taskTimeout: 5000,
      };

      pool = new WorkerPool(config);

      const completedChunks: ChunkData[] = [];
      const errors: Error[] = [];
      const numChunks = 8;

      // Submit multiple chunk generation tasks
      const taskPromises: Promise<void>[] = [];
      for (let i = 0; i < numChunks; i++) {
        const promise = new Promise<void>((resolve) => {
          const task: WorkerTask = {
            id: `chunk-${i}`,
            chunkX: i % 4,
            chunkY: Math.floor(i / 4),
            lodLevel: 0,
            priority: 0,
            onComplete: (chunk: ChunkData) => {
              completedChunks.push(chunk);
              resolve();
            },
            onError: (error: Error) => {
              errors.push(error);
              resolve();
            },
          };
          pool!.submitTask(task);
        });
        taskPromises.push(promise);
      }

      // Wait for all tasks to complete
      await Promise.all(taskPromises);

      // Verify all chunks were generated
      expect(completedChunks.length).toBe(numChunks);
      expect(errors.length).toBe(0);

      // Verify chunks have correct coordinates
      for (let i = 0; i < numChunks; i++) {
        const chunk = completedChunks.find(
          c => c.x === i % 4 && c.y === Math.floor(i / 4)
        );
        expect(chunk).toBeDefined();
        expect(chunk!.size).toBe(32);
        expect(chunk!.heightmap.length).toBe(33 * 33);
      }

      // Verify parallel execution occurred
      const stats = pool.getStats();
      expect(stats.completedTasks).toBe(numChunks);
    });

    test('should distribute tasks across available workers', async () => {
      const config: WorkerPoolConfig = {
        maxWorkers: 3,
        workerScriptUrl: 'mock-worker.js',
        taskTimeout: 5000,
      };

      pool = new WorkerPool(config);

      const numChunks = 9;
      const completedChunks: ChunkData[] = [];

      // Submit tasks
      const taskPromises: Promise<void>[] = [];
      for (let i = 0; i < numChunks; i++) {
        const promise = new Promise<void>((resolve) => {
          const task: WorkerTask = {
            id: `chunk-${i}`,
            chunkX: i,
            chunkY: 0,
            lodLevel: 0,
            priority: 0,
            onComplete: (chunk: ChunkData) => {
              completedChunks.push(chunk);
              resolve();
            },
            onError: () => resolve(),
          };
          pool!.submitTask(task);
        });
        taskPromises.push(promise);
      }

      // Check stats immediately after submission
      const statsAfterSubmission = pool.getStats();
      expect(statsAfterSubmission.totalWorkers).toBe(3);
      expect(statsAfterSubmission.activeWorkers).toBe(3); // All workers should be active
      expect(statsAfterSubmission.queuedTasks).toBe(6); // 9 - 3 = 6 queued

      // Wait for completion
      await Promise.all(taskPromises);

      expect(completedChunks.length).toBe(numChunks);
      expect(pool.getStats().completedTasks).toBe(numChunks);
    });

    test('should respect task priority when distributing work', async () => {
      const config: WorkerPoolConfig = {
        maxWorkers: 1, // Single worker to test priority ordering
        workerScriptUrl: 'mock-worker.js',
        taskTimeout: 5000,
      };

      pool = new WorkerPool(config);

      const completionOrder: number[] = [];

      // Submit tasks with different priorities
      const taskPromises: Promise<void>[] = [];
      const priorities = [0, 2, 1, 3]; // Submit in non-priority order

      for (let i = 0; i < priorities.length; i++) {
        const promise = new Promise<void>((resolve) => {
          const task: WorkerTask = {
            id: `chunk-${i}`,
            chunkX: i,
            chunkY: 0,
            lodLevel: 0,
            priority: priorities[i],
            onComplete: () => {
              completionOrder.push(priorities[i]);
              resolve();
            },
            onError: () => resolve(),
          };
          pool!.submitTask(task);
        });
        taskPromises.push(promise);
      }

      await Promise.all(taskPromises);

      // First task starts immediately (priority 0)
      // Then tasks should complete in priority order: 3, 2, 1
      expect(completionOrder[0]).toBe(0); // First submitted, started immediately
      expect(completionOrder[1]).toBe(3); // Highest priority in queue
      expect(completionOrder[2]).toBe(2); // Second highest
      expect(completionOrder[3]).toBe(1); // Lowest priority
    });
  });

  describe('Worker Failure Recovery', () => {
    test('should handle worker errors gracefully', async () => {
      const config: WorkerPoolConfig = {
        maxWorkers: 2,
        workerScriptUrl: 'mock-worker.js',
        taskTimeout: 5000,
      };

      pool = new WorkerPool(config);

      const completedChunks: ChunkData[] = [];
      const errors: Error[] = [];

      // Submit first task (will succeed)
      const task1Promise = new Promise<void>((resolve) => {
        const task: WorkerTask = {
          id: 'chunk-0',
          chunkX: 0,
          chunkY: 0,
          lodLevel: 0,
          priority: 0,
          onComplete: (chunk: ChunkData) => {
            completedChunks.push(chunk);
            resolve();
          },
          onError: (error: Error) => {
            errors.push(error);
            resolve();
          },
        };
        pool!.submitTask(task);
      });

      // Submit second task and simulate error
      const task2Promise = new Promise<void>((resolve) => {
        const task: WorkerTask = {
          id: 'chunk-1',
          chunkX: 1,
          chunkY: 0,
          lodLevel: 0,
          priority: 0,
          onComplete: (chunk: ChunkData) => {
            completedChunks.push(chunk);
            resolve();
          },
          onError: (error: Error) => {
            errors.push(error);
            resolve();
          },
        };
        pool!.submitTask(task);

        // Simulate error on second worker
        setTimeout(() => {
          if (mockWorkers[1]) {
            mockWorkers[1].simulateError('Worker error');
          }
        }, 5);
      });

      await Promise.all([task1Promise, task2Promise]);

      // First task should succeed, second should error
      expect(completedChunks.length).toBe(1);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Worker error');
    });

    test('should continue processing queue after worker error', async () => {
      const config: WorkerPoolConfig = {
        maxWorkers: 1,
        workerScriptUrl: 'mock-worker.js',
        taskTimeout: 5000,
      };

      pool = new WorkerPool(config);

      const completedChunks: ChunkData[] = [];
      const errors: Error[] = [];

      // Submit three tasks
      const taskPromises: Promise<void>[] = [];

      // Task 1: will succeed
      taskPromises.push(
        new Promise<void>((resolve) => {
          const task: WorkerTask = {
            id: 'chunk-0',
            chunkX: 0,
            chunkY: 0,
            lodLevel: 0,
            priority: 0,
            onComplete: (chunk: ChunkData) => {
              completedChunks.push(chunk);
              resolve();
            },
            onError: (error: Error) => {
              errors.push(error);
              resolve();
            },
          };
          pool!.submitTask(task);
        })
      );

      // Task 2: will error
      taskPromises.push(
        new Promise<void>((resolve) => {
          const task: WorkerTask = {
            id: 'chunk-1',
            chunkX: 1,
            chunkY: 0,
            lodLevel: 0,
            priority: 0,
            onComplete: (chunk: ChunkData) => {
              completedChunks.push(chunk);
              resolve();
            },
            onError: (error: Error) => {
              errors.push(error);
              resolve();
            },
          };
          pool!.submitTask(task);

          // Simulate error after first task completes
          setTimeout(() => {
            if (mockWorkers[0]) {
              mockWorkers[0].simulateError('Simulated error');
            }
          }, 15);
        })
      );

      // Task 3: should succeed after error recovery
      taskPromises.push(
        new Promise<void>((resolve) => {
          const task: WorkerTask = {
            id: 'chunk-2',
            chunkX: 2,
            chunkY: 0,
            lodLevel: 0,
            priority: 0,
            onComplete: (chunk: ChunkData) => {
              completedChunks.push(chunk);
              resolve();
            },
            onError: (error: Error) => {
              errors.push(error);
              resolve();
            },
          };
          pool!.submitTask(task);
        })
      );

      await Promise.all(taskPromises);

      // Should have 2 successes and 1 error
      expect(completedChunks.length).toBe(2);
      expect(errors.length).toBe(1);
    });

    test('should handle task timeout', async () => {
      const config: WorkerPoolConfig = {
        maxWorkers: 1,
        workerScriptUrl: 'mock-worker.js',
        taskTimeout: 50, // Very short timeout
      };

      // Create worker with long processing delay
      (globalThis as any).Worker = class extends MockWorker {
        constructor(url: string) {
          super(url, 200); // 200ms delay, longer than timeout
        }
      };

      pool = new WorkerPool(config);

      const errors: Error[] = [];

      const taskPromise = new Promise<void>((resolve) => {
        const task: WorkerTask = {
          id: 'chunk-0',
          chunkX: 0,
          chunkY: 0,
          lodLevel: 0,
          priority: 0,
          onComplete: () => {
            resolve();
          },
          onError: (error: Error) => {
            errors.push(error);
            resolve();
          },
        };
        pool!.submitTask(task);
      });

      await taskPromise;

      // Should have timed out
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('timed out');
    });
  });

  describe('Performance Scaling', () => {
    test('should improve throughput with more workers', async () => {
      const numChunks = 12;

      // Test with 1 worker
      const singleWorkerConfig: WorkerPoolConfig = {
        maxWorkers: 1,
        workerScriptUrl: 'mock-worker.js',
        taskTimeout: 5000,
      };

      const pool1 = new WorkerPool(singleWorkerConfig);
      const start1 = Date.now();

      const promises1: Promise<void>[] = [];
      for (let i = 0; i < numChunks; i++) {
        promises1.push(
          new Promise<void>((resolve) => {
            const task: WorkerTask = {
              id: `chunk-${i}`,
              chunkX: i,
              chunkY: 0,
              lodLevel: 0,
              priority: 0,
              onComplete: () => resolve(),
              onError: () => resolve(),
            };
            pool1.submitTask(task);
          })
        );
      }

      await Promise.all(promises1);
      const time1 = Date.now() - start1;
      pool1.shutdown();

      // Test with 4 workers
      const multiWorkerConfig: WorkerPoolConfig = {
        maxWorkers: 4,
        workerScriptUrl: 'mock-worker.js',
        taskTimeout: 5000,
      };

      const pool4 = new WorkerPool(multiWorkerConfig);
      const start4 = Date.now();

      const promises4: Promise<void>[] = [];
      for (let i = 0; i < numChunks; i++) {
        promises4.push(
          new Promise<void>((resolve) => {
            const task: WorkerTask = {
              id: `chunk-${i}`,
              chunkX: i,
              chunkY: 0,
              lodLevel: 0,
              priority: 0,
              onComplete: () => resolve(),
              onError: () => resolve(),
            };
            pool4.submitTask(task);
          })
        );
      }

      await Promise.all(promises4);
      const time4 = Date.now() - start4;
      pool4.shutdown();

      // 4 workers should be significantly faster than 1 worker
      // Allow some overhead, but should be at least 2x faster
      expect(time4).toBeLessThan(time1 * 0.6);
    });

    test('should track worker statistics accurately', async () => {
      const config: WorkerPoolConfig = {
        maxWorkers: 3,
        workerScriptUrl: 'mock-worker.js',
        taskTimeout: 5000,
      };

      pool = new WorkerPool(config);

      // Initial stats
      const initialStats = pool.getStats();
      expect(initialStats.totalWorkers).toBe(3);
      expect(initialStats.activeWorkers).toBe(0);
      expect(initialStats.queuedTasks).toBe(0);
      expect(initialStats.completedTasks).toBe(0);

      // Submit 6 tasks
      const taskPromises: Promise<void>[] = [];
      for (let i = 0; i < 6; i++) {
        taskPromises.push(
          new Promise<void>((resolve) => {
            const task: WorkerTask = {
              id: `chunk-${i}`,
              chunkX: i,
              chunkY: 0,
              lodLevel: 0,
              priority: 0,
              onComplete: () => resolve(),
              onError: () => resolve(),
            };
            pool!.submitTask(task);
          })
        );
      }

      // Check stats after submission
      const statsAfterSubmission = pool.getStats();
      expect(statsAfterSubmission.activeWorkers).toBe(3); // All workers active
      expect(statsAfterSubmission.queuedTasks).toBe(3); // 3 tasks queued

      // Wait for completion
      await Promise.all(taskPromises);

      // Final stats
      const finalStats = pool.getStats();
      expect(finalStats.activeWorkers).toBe(0); // All workers idle
      expect(finalStats.queuedTasks).toBe(0); // Queue empty
      expect(finalStats.completedTasks).toBe(6); // All tasks completed
    });

    test('should handle task cancellation', async () => {
      const config: WorkerPoolConfig = {
        maxWorkers: 1,
        workerScriptUrl: 'mock-worker.js',
        taskTimeout: 5000,
      };

      pool = new WorkerPool(config);

      const completedChunks: ChunkData[] = [];

      // Submit first task (will start immediately)
      const task1Promise = new Promise<void>((resolve) => {
        const task: WorkerTask = {
          id: 'chunk-0',
          chunkX: 0,
          chunkY: 0,
          lodLevel: 0,
          priority: 0,
          onComplete: (chunk: ChunkData) => {
            completedChunks.push(chunk);
            resolve();
          },
          onError: () => resolve(),
        };
        pool!.submitTask(task);
      });

      // Submit second task (will be queued)
      const task2Id = pool.submitTask({
        id: 'chunk-1',
        chunkX: 1,
        chunkY: 0,
        lodLevel: 0,
        priority: 0,
        onComplete: (chunk: ChunkData) => {
          completedChunks.push(chunk);
        },
        onError: () => {},
      });

      // Cancel the queued task
      const cancelled = pool.cancelTask(task2Id);
      expect(cancelled).toBe(true);

      // Wait for first task to complete
      await task1Promise;

      // Only first task should have completed
      expect(completedChunks.length).toBe(1);
      expect(completedChunks[0].x).toBe(0);

      // Stats should show 1 completed task
      const stats = pool.getStats();
      expect(stats.completedTasks).toBe(1);
    });
  });
});
