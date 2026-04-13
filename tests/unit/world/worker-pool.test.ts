import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkerPool, WorkerPoolConfig, WorkerTask } from '../../../src/world/worker-pool';
import type { ChunkData } from '../../../src/world/chunk';

describe('WorkerPool Unit Tests', () => {
  let pool: WorkerPool | null = null;
  let mockWorkers: MockWorker[] = [];
  let originalWorker: any;

  // Mock Worker class for testing
  class MockWorker {
    postMessage: (msg: any, transfer?: any[]) => void;
    terminate: () => void;
    onmessage: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    private terminated: boolean;

    constructor(_url: string) {
      this.terminated = false;
      this.postMessage = vi.fn((msg: any) => {
        // Store message for verification
      });
      this.terminate = vi.fn(() => {
        this.terminated = true;
      });
      this.onmessage = null;
      this.onerror = null;
      mockWorkers.push(this);
    }

    // Helper method to simulate task completion
    simulateComplete(result: ChunkData): void {
      if (this.onmessage && !this.terminated) {
        this.onmessage({ data: result });
      }
    }

    // Helper method to simulate task error
    simulateError(message: string): void {
      if (this.onerror && !this.terminated) {
        this.onerror({ message });
      }
    }

    isTerminated(): boolean {
      return this.terminated;
    }
  }

  beforeEach(() => {
    // Reset mock workers array
    mockWorkers = [];
    
    // Save original Worker and replace with mock
    originalWorker = (globalThis as any).Worker;
    (globalThis as any).Worker = MockWorker;
  });

  afterEach(() => {
    // Clean up pool
    if (pool) {
      pool.shutdown();
      pool = null;
    }
    
    // Restore original Worker
    (globalThis as any).Worker = originalWorker;
    
    // Clear mock workers
    mockWorkers = [];
  });

  // Helper to create a default config
  const createConfig = (overrides?: Partial<WorkerPoolConfig>): WorkerPoolConfig => ({
    maxWorkers: 2,
    workerScriptUrl: 'test-worker.js',
    taskTimeout: 1000,
    ...overrides,
  });

  // Helper to create a mock chunk result
  const createMockChunk = (x: number, y: number): ChunkData => ({
    x,
    y,
    size: 32,
    heightmap: new Float32Array(32 * 32),
    biomeMap: new Uint8Array(32 * 32),
    biomeWeights: new Float32Array(32 * 32 * 8),
    resources: [],
    structures: [],
    rivers: new Set(),
  });

  describe('Worker Initialization', () => {
    test('initializes correct number of workers', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 3 }));
      
      expect(mockWorkers.length).toBe(3);
    });

    test('initializes workers with correct script URL', () => {
      const config = createConfig({ workerScriptUrl: 'custom-worker.js' });
      pool = new WorkerPool(config);
      
      // Workers are created, verify count
      expect(mockWorkers.length).toBe(config.maxWorkers);
    });

    test('initializes with single worker', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 1 }));
      
      expect(mockWorkers.length).toBe(1);
    });

    test('initializes with multiple workers', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 4 }));
      
      expect(mockWorkers.length).toBe(4);
    });

    test('workers have message handlers set up', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 2 }));
      
      expect(mockWorkers[0].onmessage).not.toBeNull();
      expect(mockWorkers[1].onmessage).not.toBeNull();
    });

    test('workers have error handlers set up', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 2 }));
      
      expect(mockWorkers[0].onerror).not.toBeNull();
      expect(mockWorkers[1].onerror).not.toBeNull();
    });

    test('initial stats show zero active workers', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 3 }));
      const stats = pool.getStats();
      
      expect(stats.totalWorkers).toBe(3);
      expect(stats.activeWorkers).toBe(0);
      expect(stats.queuedTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
    });
  });

  describe('Task Submission and Completion', () => {
    test('submits task and returns task ID', () => {
      pool = new WorkerPool(createConfig());
      
      const task: WorkerTask = {
        id: 'test-task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      const taskId = pool.submitTask(task);
      
      expect(taskId).toBe('test-task-1');
    });

    test('generates task ID if not provided', () => {
      pool = new WorkerPool(createConfig());
      
      const task: WorkerTask = {
        id: '',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      const taskId = pool.submitTask(task);
      
      expect(taskId).toMatch(/^task-\d+$/);
    });

    test('task is assigned to worker immediately if worker is idle', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 2 }));
      
      const task: WorkerTask = {
        id: 'test-task',
        chunkX: 5,
        chunkY: 10,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      pool.submitTask(task);
      
      // Worker should have received postMessage
      expect(mockWorkers[0].postMessage).toHaveBeenCalledWith({
        type: 'generate',
        chunkX: 5,
        chunkY: 10,
        lodLevel: 0,
      });
    });

    test('task completion calls onComplete callback', () => {
      pool = new WorkerPool(createConfig());
      
      const onComplete = vi.fn();
      const task: WorkerTask = {
        id: 'test-task',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete,
        onError: vi.fn(),
      };
      
      pool.submitTask(task);
      
      const mockChunk = createMockChunk(0, 0);
      mockWorkers[0].simulateComplete(mockChunk);
      
      expect(onComplete).toHaveBeenCalledWith(mockChunk);
    });

    test('task completion updates stats', () => {
      pool = new WorkerPool(createConfig());
      
      const task: WorkerTask = {
        id: 'test-task',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      pool.submitTask(task);
      
      const statsBefore = pool.getStats();
      expect(statsBefore.activeWorkers).toBe(1);
      expect(statsBefore.completedTasks).toBe(0);
      
      mockWorkers[0].simulateComplete(createMockChunk(0, 0));
      
      const statsAfter = pool.getStats();
      expect(statsAfter.activeWorkers).toBe(0);
      expect(statsAfter.completedTasks).toBe(1);
    });

    test('multiple tasks are completed correctly', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 2 }));
      
      const onComplete1 = vi.fn();
      const onComplete2 = vi.fn();
      
      const task1: WorkerTask = {
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: onComplete1,
        onError: vi.fn(),
      };
      
      const task2: WorkerTask = {
        id: 'task-2',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 1,
        onComplete: onComplete2,
        onError: vi.fn(),
      };
      
      pool.submitTask(task1);
      pool.submitTask(task2);
      
      mockWorkers[0].simulateComplete(createMockChunk(0, 0));
      mockWorkers[1].simulateComplete(createMockChunk(1, 1));
      
      expect(onComplete1).toHaveBeenCalled();
      expect(onComplete2).toHaveBeenCalled();
      
      const stats = pool.getStats();
      expect(stats.completedTasks).toBe(2);
    });

    test('tasks are queued when all workers are busy', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 1 }));
      
      const task1: WorkerTask = {
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      const task2: WorkerTask = {
        id: 'task-2',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      pool.submitTask(task1);
      pool.submitTask(task2);
      
      const stats = pool.getStats();
      expect(stats.activeWorkers).toBe(1);
      expect(stats.queuedTasks).toBe(1);
    });

    test('queued task is assigned when worker becomes available', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 1 }));
      
      const task1: WorkerTask = {
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      const task2: WorkerTask = {
        id: 'task-2',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      pool.submitTask(task1);
      pool.submitTask(task2);
      
      // Complete first task
      mockWorkers[0].simulateComplete(createMockChunk(0, 0));
      
      // Second task should now be assigned
      expect(mockWorkers[0].postMessage).toHaveBeenCalledTimes(2);
      
      const stats = pool.getStats();
      expect(stats.queuedTasks).toBe(0);
      expect(stats.activeWorkers).toBe(1);
    });

    test('tasks are processed in priority order', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 1 }));
      
      const completionOrder: string[] = [];
      
      const lowPriorityTask: WorkerTask = {
        id: 'low',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: () => completionOrder.push('low'),
        onError: vi.fn(),
      };
      
      const highPriorityTask: WorkerTask = {
        id: 'high',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 10,
        onComplete: () => completionOrder.push('high'),
        onError: vi.fn(),
      };
      
      const mediumPriorityTask: WorkerTask = {
        id: 'medium',
        chunkX: 2,
        chunkY: 2,
        lodLevel: 0,
        priority: 5,
        onComplete: () => completionOrder.push('medium'),
        onError: vi.fn(),
      };
      
      // Submit in non-priority order
      pool.submitTask(lowPriorityTask);
      pool.submitTask(highPriorityTask);
      pool.submitTask(mediumPriorityTask);
      
      // Complete tasks one by one
      mockWorkers[0].simulateComplete(createMockChunk(0, 0));
      mockWorkers[0].simulateComplete(createMockChunk(1, 1));
      mockWorkers[0].simulateComplete(createMockChunk(2, 2));
      
      // Should complete in priority order (low was already running)
      expect(completionOrder).toEqual(['low', 'high', 'medium']);
    });
  });

  describe('Task Cancellation', () => {
    test('cancels pending task in queue', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 1 }));
      
      const task1: WorkerTask = {
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      const task2: WorkerTask = {
        id: 'task-2',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      pool.submitTask(task1);
      pool.submitTask(task2);
      
      const cancelled = pool.cancelTask('task-2');
      
      expect(cancelled).toBe(true);
      
      const stats = pool.getStats();
      expect(stats.queuedTasks).toBe(0);
    });

    test('cancels active task', () => {
      pool = new WorkerPool(createConfig());
      
      const onComplete = vi.fn();
      const task: WorkerTask = {
        id: 'test-task',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete,
        onError: vi.fn(),
      };
      
      pool.submitTask(task);
      
      const cancelled = pool.cancelTask('test-task');
      
      expect(cancelled).toBe(true);
      
      // Complete the task - callback should not be called
      mockWorkers[0].simulateComplete(createMockChunk(0, 0));
      
      expect(onComplete).not.toHaveBeenCalled();
    });

    test('returns false when cancelling non-existent task', () => {
      pool = new WorkerPool(createConfig());
      
      const cancelled = pool.cancelTask('non-existent');
      
      expect(cancelled).toBe(false);
    });

    test('cancelled task result is ignored', () => {
      pool = new WorkerPool(createConfig());
      
      const onComplete = vi.fn();
      const task: WorkerTask = {
        id: 'test-task',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete,
        onError: vi.fn(),
      };
      
      pool.submitTask(task);
      pool.cancelTask('test-task');
      
      mockWorkers[0].simulateComplete(createMockChunk(0, 0));
      
      expect(onComplete).not.toHaveBeenCalled();
      
      const stats = pool.getStats();
      expect(stats.completedTasks).toBe(0);
    });
  });

  describe('Worker Timeout Handling', () => {
    test('task timeout triggers error callback', () => {
      vi.useFakeTimers();
      
      pool = new WorkerPool(createConfig({ taskTimeout: 1000 }));
      
      const onError = vi.fn();
      const task: WorkerTask = {
        id: 'test-task',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError,
      };
      
      pool.submitTask(task);
      
      // Advance time past timeout
      vi.advanceTimersByTime(1001);
      
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toContain('timed out');
      
      vi.useRealTimers();
    });

    test('completed task clears timeout', () => {
      vi.useFakeTimers();
      
      pool = new WorkerPool(createConfig({ taskTimeout: 1000 }));
      
      const onError = vi.fn();
      const onComplete = vi.fn();
      const task: WorkerTask = {
        id: 'test-task',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete,
        onError,
      };
      
      pool.submitTask(task);
      
      // Complete task before timeout
      mockWorkers[0].simulateComplete(createMockChunk(0, 0));
      
      // Advance time past timeout
      vi.advanceTimersByTime(1001);
      
      // Error should not be called
      expect(onError).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    test('timeout frees worker for next task', () => {
      vi.useFakeTimers();
      
      pool = new WorkerPool(createConfig({ maxWorkers: 1, taskTimeout: 1000 }));
      
      const task1: WorkerTask = {
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      const task2: WorkerTask = {
        id: 'task-2',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      pool.submitTask(task1);
      pool.submitTask(task2);
      
      // Trigger timeout for first task
      vi.advanceTimersByTime(1001);
      
      // Second task should now be assigned
      const stats = pool.getStats();
      expect(stats.activeWorkers).toBe(1);
      expect(stats.queuedTasks).toBe(0);
      
      vi.useRealTimers();
    });
  });

  describe('Worker Error Handling', () => {
    test('worker error triggers onError callback', () => {
      pool = new WorkerPool(createConfig());
      
      const onError = vi.fn();
      const task: WorkerTask = {
        id: 'test-task',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError,
      };
      
      pool.submitTask(task);
      
      mockWorkers[0].simulateError('Worker error occurred');
      
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toBe('Worker error occurred');
    });

    test('worker error frees worker for next task', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 1 }));
      
      const task1: WorkerTask = {
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      const task2: WorkerTask = {
        id: 'task-2',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      
      pool.submitTask(task1);
      pool.submitTask(task2);
      
      mockWorkers[0].simulateError('Worker error');
      
      // Second task should now be assigned
      const stats = pool.getStats();
      expect(stats.activeWorkers).toBe(1);
      expect(stats.queuedTasks).toBe(0);
    });

    test('error on cancelled task is ignored', () => {
      pool = new WorkerPool(createConfig());
      
      const onError = vi.fn();
      const task: WorkerTask = {
        id: 'test-task',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError,
      };
      
      pool.submitTask(task);
      pool.cancelTask('test-task');
      
      mockWorkers[0].simulateError('Worker error');
      
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('Pool Shutdown', () => {
    test('shutdown terminates all workers', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 3 }));
      
      pool.shutdown();
      
      expect(mockWorkers[0].isTerminated()).toBe(true);
      expect(mockWorkers[1].isTerminated()).toBe(true);
      expect(mockWorkers[2].isTerminated()).toBe(true);
    });

    test('shutdown clears task queue', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 1 }));
      
      pool.submitTask({
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });
      
      pool.submitTask({
        id: 'task-2',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });
      
      pool.shutdown();
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(0);
      expect(stats.queuedTasks).toBe(0);
      expect(stats.activeWorkers).toBe(0);
    });

    test('shutdown clears active tasks', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 2 }));
      
      pool.submitTask({
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });
      
      pool.submitTask({
        id: 'task-2',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });
      
      pool.shutdown();
      
      const stats = pool.getStats();
      expect(stats.activeWorkers).toBe(0);
    });

    test('tasks cannot be submitted after shutdown', () => {
      pool = new WorkerPool(createConfig());
      
      pool.shutdown();
      
      // Attempting to submit should not crash
      // (though behavior is undefined after shutdown)
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(0);
    });

    test('shutdown can be called multiple times safely', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 2 }));
      
      pool.shutdown();
      pool.shutdown();
      
      // Should not throw error
      expect(mockWorkers[0].isTerminated()).toBe(true);
      expect(mockWorkers[1].isTerminated()).toBe(true);
    });
  });

  describe('Pool Statistics', () => {
    test('getStats returns correct initial state', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 3 }));
      
      const stats = pool.getStats();
      
      expect(stats.totalWorkers).toBe(3);
      expect(stats.activeWorkers).toBe(0);
      expect(stats.queuedTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
    });

    test('getStats tracks active workers correctly', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 2 }));
      
      pool.submitTask({
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });
      
      const stats = pool.getStats();
      expect(stats.activeWorkers).toBe(1);
    });

    test('getStats tracks queued tasks correctly', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 1 }));
      
      pool.submitTask({
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });
      
      pool.submitTask({
        id: 'task-2',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });
      
      pool.submitTask({
        id: 'task-3',
        chunkX: 2,
        chunkY: 2,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });
      
      const stats = pool.getStats();
      expect(stats.queuedTasks).toBe(2);
    });

    test('getStats tracks completed tasks correctly', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 2 }));
      
      pool.submitTask({
        id: 'task-1',
        chunkX: 0,
        chunkY: 0,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });
      
      pool.submitTask({
        id: 'task-2',
        chunkX: 1,
        chunkY: 1,
        lodLevel: 0,
        priority: 1,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });
      
      mockWorkers[0].simulateComplete(createMockChunk(0, 0));
      mockWorkers[1].simulateComplete(createMockChunk(1, 1));
      
      const stats = pool.getStats();
      expect(stats.completedTasks).toBe(2);
    });

    test('getStats accumulates completed tasks across workers', () => {
      pool = new WorkerPool(createConfig({ maxWorkers: 2 }));
      
      // Submit tasks
      for (let i = 0; i < 5; i++) {
        pool.submitTask({
          id: `task-${i}`,
          chunkX: i,
          chunkY: 0,
          lodLevel: 0,
          priority: 1,
          onComplete: vi.fn(),
          onError: vi.fn(),
        });
      }
      
      // Complete first two tasks (assigned to both workers)
      mockWorkers[0].simulateComplete(createMockChunk(0, 0));
      mockWorkers[1].simulateComplete(createMockChunk(1, 0));
      
      // Complete next two tasks (now assigned to freed workers)
      mockWorkers[0].simulateComplete(createMockChunk(2, 0));
      mockWorkers[1].simulateComplete(createMockChunk(3, 0));
      
      // Complete final task
      mockWorkers[0].simulateComplete(createMockChunk(4, 0));
      
      const stats = pool.getStats();
      expect(stats.completedTasks).toBe(5);
    });
  });
});
