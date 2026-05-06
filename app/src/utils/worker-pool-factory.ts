/**
 * Factory for creating WorkerPool with proper worker loading
 * Handles both development (Vite worker import) and production (built worker.js)
 */

import { WorkerPool, WorkerPoolConfig } from '@engine/index';
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
  const isViteWorker = config.workerScriptUrl === '__VITE_WORKER__';
  
  if (isViteWorker) {
    return new WorkerPool({
      ...config,
      createWorker: () => createWorker(),
    });
  }
  
  return new WorkerPool(config);
}
