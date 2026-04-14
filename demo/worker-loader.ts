/**
 * Worker URL helper for development and production
 * 
 * In development: Uses Vite's ?worker&url import to get worker URL
 * In production: Uses the built worker.js file
 */

// Import worker URL using Vite's special ?worker&url syntax
// In dev: Vite provides a URL to the compiled worker
// In prod: This will be replaced with the actual worker.js path
import workerUrl from '../src/worker?worker&url';

/**
 * Gets the worker script URL for the current environment
 * 
 * @returns Worker script URL that works in both dev and production
 */
export function getWorkerUrl(): string {
  // Vite's ?worker&url import provides the correct URL for both environments
  // Dev: Returns a blob URL or dev server URL
  // Prod: Returns the path to the built worker.js
  return workerUrl;
}

/**
 * Creates a worker instance for the current environment
 * 
 * @returns Worker instance
 */
export function createWorker(): Worker {
  return new Worker(getWorkerUrl(), { type: 'module' });
}


