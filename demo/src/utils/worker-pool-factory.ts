/**
 * Factory for creating WorkerPool with proper worker loading
 * Handles both development (Vite worker import) and production (built worker.js)
 */

import { WorkerPool, WorkerPoolConfig } from '@engine/world/worker-pool';
import { createWorker } from '../../worker-loader';

/**
 * Creates a WorkerPool that works in both development and production
 * 
 * In development: Uses Vite's ?worker import
 * In production: Uses built worker.js
 * 
 * @param config - Worker pool configuration
 * @returns WorkerPool instance
 */
export function createWorkerPool(config: WorkerPoolConfig): WorkerPool {
  // Check if we're using the Vite worker marker
  const isViteWorker = config.workerScriptUrl === '__VITE_WORKER__';
  
  if (isViteWorker) {
    // In development, we need to create a custom WorkerPool
    // that uses our createWorker() function instead of new Worker(url)
    return new ViteWorkerPool(config);
  }
  
  // In production, use the standard WorkerPool
  return new WorkerPool(config);
}

/**
 * WorkerPool that uses Vite's worker import in development
 */
class ViteWorkerPool extends WorkerPool {
  constructor(config: WorkerPoolConfig) {
    // Create a modified config with a dummy URL
    // We'll override worker creation below
    super({ ...config, workerScriptUrl: 'dummy.js' });
    
    // Replace the workers with Vite-compiled ones
    this.replaceWorkersWithViteWorkers(config.maxWorkers);
  }
  
  private replaceWorkersWithViteWorkers(maxWorkers: number): void {
    // Access the private workers array via type assertion
    const pool = this as any;
    
    // Terminate existing dummy workers
    if (pool.workers) {
      for (const workerState of pool.workers) {
        workerState.worker.terminate();
      }
    }
    
    // Create new workers using Vite's import
    pool.workers = [];
    for (let i = 0; i < maxWorkers; i++) {
      const worker = createWorker();
      
      // Set up message handler
      worker.onmessage = (event: MessageEvent) => {
        pool.handleTaskComplete(i, event.data);
      };
      
      // Set up error handler
      worker.onerror = (error: ErrorEvent) => {
        pool.handleTaskError(i, new Error(error.message));
      };
      
      pool.workers.push({
        worker,
        currentTask: null,
        completedTasks: 0,
      });
    }
  }
}
