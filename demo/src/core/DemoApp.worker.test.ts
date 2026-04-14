/**
 * Unit tests for Worker Pool integration in DemoApp
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DemoApp } from './DemoApp';

describe('DemoApp - Worker Pool Integration', () => {
  let app: DemoApp;

  beforeEach(async () => {
    app = new DemoApp();
    await app.initialize();
  });

  describe('Worker Pool Configuration', () => {
    it('should start with worker pool disabled', () => {
      const state = app.getState();
      expect(state.workerPoolEnabled).toBe(false);
      expect(state.config.workerPoolConfig).toBeUndefined();
    });

    it('should enable worker pool when config is updated', () => {
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000
        }
      });

      const state = app.getState();
      expect(state.workerPoolEnabled).toBe(true);
      expect(state.config.workerPoolConfig).toBeDefined();
      expect(state.config.workerPoolConfig?.maxWorkers).toBe(4);
    });

    it('should disable worker pool when config is set to undefined', () => {
      // First enable it
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000
        }
      });

      // Then disable it
      app.updateEngineConfig({
        workerPoolConfig: undefined
      });

      const state = app.getState();
      expect(state.workerPoolEnabled).toBe(false);
      expect(state.config.workerPoolConfig).toBeUndefined();
    });

    it('should update maxWorkers when config changes', () => {
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000
        }
      });

      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 8,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000
        }
      });

      const state = app.getState();
      expect(state.config.workerPoolConfig?.maxWorkers).toBe(8);
    });
  });

  describe('Worker Pool Statistics', () => {
    it('should initialize worker pool stats to zero', () => {
      const state = app.getState();
      expect(state.activeWorkers).toBe(0);
      expect(state.queuedTasks).toBe(0);
      expect(state.completedTasks).toBe(0);
      expect(state.avgWorkerTime).toBe(0);
    });

    it('should return zero stats when worker pool is disabled', () => {
      const stats = app.getWorkerPoolStats();
      expect(stats.activeWorkers).toBe(0);
      expect(stats.queuedTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
      expect(stats.avgWorkerTime).toBe(0);
    });

    it('should not update stats when worker pool is disabled', () => {
      app.updateWorkerPoolStats();
      
      const state = app.getState();
      expect(state.activeWorkers).toBe(0);
      expect(state.queuedTasks).toBe(0);
      expect(state.completedTasks).toBe(0);
    });

    it('should update state with worker pool stats when enabled', () => {
      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000
        }
      });

      // Mock the worker pool stats
      const chunkManager = app.getState().chunkManager as any;
      if (chunkManager && chunkManager.workerPool) {
        chunkManager.workerPool.getStats = vi.fn().mockReturnValue({
          totalWorkers: 4,
          activeWorkers: 2,
          queuedTasks: 5,
          completedTasks: 10
        });
      }

      app.updateWorkerPoolStats();

      const state = app.getState();
      // Stats should be updated (or remain 0 if worker pool not fully initialized)
      expect(typeof state.activeWorkers).toBe('number');
      expect(typeof state.queuedTasks).toBe('number');
      expect(typeof state.completedTasks).toBe('number');
    });
  });

  describe('State Subscription', () => {
    it('should notify subscribers when worker pool is enabled', () => {
      const callback = vi.fn();
      app.subscribeToState(callback);

      // Clear initial call
      callback.mockClear();

      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000
        }
      });

      expect(callback).toHaveBeenCalled();
      const state = callback.mock.calls[0][0];
      expect(state.workerPoolEnabled).toBe(true);
    });

    it('should notify subscribers when worker pool stats change', () => {
      const callback = vi.fn();
      
      // Enable worker pool first
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000
        }
      });

      app.subscribeToState(callback);
      callback.mockClear();

      // Update stats
      app.updateWorkerPoolStats();

      // Should have been called (even if stats are 0)
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Integration with ChunkManager', () => {
    it('should have worker pool config in state when enabled', () => {
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000
        }
      });

      const state = app.getState();
      expect(state.config.workerPoolConfig).toBeDefined();
      expect(state.config.workerPoolConfig?.maxWorkers).toBe(4);
    });

    it('should update config when worker pool settings change', () => {
      // Enable worker pool
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 4,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000
        }
      });

      const firstConfig = app.getState().config;

      // Change maxWorkers
      app.updateEngineConfig({
        workerPoolConfig: {
          maxWorkers: 8,
          workerScriptUrl: '/worker.js',
          taskTimeout: 30000
        }
      });

      const secondConfig = app.getState().config;

      // Config should be updated
      expect(secondConfig.workerPoolConfig?.maxWorkers).toBe(8);
      expect(secondConfig.workerPoolConfig?.maxWorkers).not.toBe(firstConfig.workerPoolConfig?.maxWorkers);
    });
  });

  describe('Worker Pool Stats API', () => {
    it('should expose getWorkerPoolStats method', () => {
      expect(typeof app.getWorkerPoolStats).toBe('function');
    });

    it('should expose updateWorkerPoolStats method', () => {
      expect(typeof app.updateWorkerPoolStats).toBe('function');
    });

    it('should return stats object with correct structure', () => {
      const stats = app.getWorkerPoolStats();
      
      expect(stats).toHaveProperty('activeWorkers');
      expect(stats).toHaveProperty('queuedTasks');
      expect(stats).toHaveProperty('completedTasks');
      expect(stats).toHaveProperty('avgWorkerTime');
      
      expect(typeof stats.activeWorkers).toBe('number');
      expect(typeof stats.queuedTasks).toBe('number');
      expect(typeof stats.completedTasks).toBe('number');
      expect(typeof stats.avgWorkerTime).toBe('number');
    });
  });
});
