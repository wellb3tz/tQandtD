/**
 * Web Worker wrapper for non-blocking chunk generation
 * 
 * This module provides Web Worker support for the tQandtD project,
 * enabling chunk generation to run in a background thread without blocking
 * the main browser thread.
 * 
 * @example
 * ```typescript
 * // In main thread:
 * const worker = new Worker('worker.js');
 * 
 * worker.postMessage({
 *   type: 'init',
 *   config: worldConfig
 * });
 * 
 * worker.postMessage({
 *   type: 'generateChunk',
 *   chunkX: 0,
 *   chunkY: 0
 * });
 * 
 * worker.onmessage = (e) => {
 *   if (e.data.type === 'chunkReady') {
 *     const chunk = deserializeChunkData(e.data.chunk);
 *     // Use chunk data...
 *   }
 * };
 * ```
 */

import { ChunkManager, WorldConfig } from './world/chunk-manager';
import {
  getChunkTransferList,
  serializeChunkData,
  type SerializedChunkData,
} from './worker-codec';

export {
  deserializeChunkData,
  getChunkTransferList,
  serializeChunkData,
  type SerializedChunkData,
} from './worker-codec';

/**
 * Interface for posting messages (allows dependency injection for testing)
 */
interface MessagePoster {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
}

// Default message poster using globalThis
const defaultPoster: MessagePoster = {
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).postMessage(message, transfer ?? []);
  },
};

// Current message poster (can be overridden for testing)
let messagePoster: MessagePoster = defaultPoster;

/**
 * Message types for worker communication
 */
export type WorkerMessageType = 'init' | 'generateChunk' | 'clearCache';

/**
 * Message sent to worker to initialize with configuration
 */
export interface InitMessage {
  type: 'init';
  config: WorldConfig;
}

/**
 * Message sent to worker to generate a chunk
 */
export interface GenerateChunkMessage {
  type: 'generateChunk';
  chunkX: number;
  chunkY: number;
}

/**
 * Message sent to worker to clear the chunk cache
 */
export interface ClearCacheMessage {
  type: 'clearCache';
}

/**
 * Union type of all messages that can be sent to the worker
 */
export type WorkerRequest = InitMessage | GenerateChunkMessage | ClearCacheMessage;

/**
 * Response message types from worker
 */
export type WorkerResponseType = 'ready' | 'chunkReady' | 'cacheCleared' | 'error';

/**
 * Response sent when worker is initialized
 */
export interface ReadyResponse {
  type: 'ready';
}

/**
 * Response sent when chunk generation is complete
 */
export interface ChunkReadyResponse {
  type: 'chunkReady';
  chunkX: number;
  chunkY: number;
  chunk: SerializedChunkData;
}

/**
 * Response sent when cache is cleared
 */
export interface CacheClearedResponse {
  type: 'cacheCleared';
}

/**
 * Response sent when an error occurs
 */
export interface ErrorResponse {
  type: 'error';
  message: string;
  stack?: string;
}

/**
 * Union type of all responses that can be sent from the worker
 */
export type WorkerResponse = ReadyResponse | ChunkReadyResponse | CacheClearedResponse | ErrorResponse;

/**
 * Worker state
 */
let chunkManager: ChunkManager | null = null;

/**
 * Reset worker state (primarily for testing)
 * @internal
 */
export function resetWorkerState(): void {
  chunkManager = null;
}

/**
 * Set message poster (primarily for testing)
 * @internal
 */
export function setMessagePoster(poster: MessagePoster): void {
  messagePoster = poster;
}

/**
 * Worker message handler
 * Processes messages from the main thread and generates chunks
 */
export function handleWorkerMessage(event: { data: WorkerRequest }): void {
  const message = event.data;

  try {
    switch (message.type) {
      case 'init': {
        // Initialize the chunk manager with provided configuration
        chunkManager = new ChunkManager(message.config);
        
        const response: ReadyResponse = { type: 'ready' };
        messagePoster.postMessage(response);
        break;
      }

      case 'generateChunk': {
        // Ensure worker is initialized
        if (!chunkManager) {
          throw new Error('Worker not initialized. Send "init" message first.');
        }

        // Generate the requested chunk
        const chunk = chunkManager.generateChunk(message.chunkX, message.chunkY);
        
        // Serialize and send back to main thread
        const serialized = serializeChunkData(chunk);
        const transfer = getChunkTransferList(serialized);
        const response: ChunkReadyResponse = {
          type: 'chunkReady',
          chunkX: message.chunkX,
          chunkY: message.chunkY,
          chunk: serialized,
        };
        messagePoster.postMessage(response, transfer);
        break;
      }

      case 'clearCache': {
        // Ensure worker is initialized
        if (!chunkManager) {
          throw new Error('Worker not initialized. Send "init" message first.');
        }

        // Clear the chunk cache
        chunkManager.clearCache();
        
        const response: CacheClearedResponse = { type: 'cacheCleared' };
        messagePoster.postMessage(response);
        break;
      }

      default: {
        // Handle unknown message types
        throw new Error(`Unknown message type: ${(message as any).type}`);
      }
    }
  } catch (error) {
    // Send error response back to main thread
    const errorResponse: ErrorResponse = {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    messagePoster.postMessage(errorResponse);
  }
}

/**
 * Install the worker message handler
 * Call this in your worker script to enable message handling
 * 
 * @example
 * ```typescript
 * // worker.js
 * import { installWorkerHandler } from 'tqandtd-project/worker';
 * installWorkerHandler();
 * ```
 */
export function installWorkerHandler(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerSelf = globalThis as any;
  if (workerSelf && workerSelf.addEventListener) {
    workerSelf.addEventListener('message', handleWorkerMessage);
  }
}

// Auto-install handler if running in worker context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ((globalThis as any).importScripts) {
  installWorkerHandler();
}
