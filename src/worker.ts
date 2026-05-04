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
import { ChunkData } from './world/chunk';

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
 * Serialized chunk data that can be transferred via postMessage.
 * TypedArrays are sent as ArrayBuffers so Worker postMessage can transfer
 * ownership instead of cloning large numeric arrays.
 */
export interface SerializedChunkData {
  x: number;
  y: number;
  size: number;
  heightmap: ArrayBuffer | ArrayLike<number>;
  biomeMap: ArrayBuffer | ArrayLike<number>;
  sparseBiomeTypes: ArrayBuffer | ArrayLike<number>;
  sparseBiomeWeights: ArrayBuffer | ArrayLike<number>;
  sparseBiomeOffsets: ArrayBuffer | ArrayLike<number>;
  /** Serialized lake bodies — tiles stored as plain number arrays */
  lakes: Array<{
    waterLevel: number;
    tiles: number[];
    maxDepth: number;
    minTerrainHeight?: number; // Optional for backward compatibility
  }>;
  rivers: Array<{
    riverId: string;
    pathId: string;
    isTributary: boolean;
    points: Array<{
      x: number;
      y: number;
      height: number;
      surfaceLevel: number;
      width: number;
      depth: number;
      flow?: number;
      channelWidth?: number;
      valleyWidth?: number;
      channelDepth?: number;
      valleyDepth?: number;
      flowX: number;
      flowY: number;
    }>;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
  }>;
  resources: Array<{
    x: number;
    y: number;
    type: number;
    amount: number;
  }>;
  structures: Array<{
    x: number;
    y: number;
    type: number;
  }>;
}

function toTransferableBuffer(view: ArrayBufferView): ArrayBuffer {
  if (
    view.buffer instanceof ArrayBuffer &&
    view.byteOffset === 0 &&
    view.byteLength === view.buffer.byteLength
  ) {
    return view.buffer;
  }

  const bytes = new Uint8Array(view.byteLength);
  bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return bytes.buffer;
}

/**
 * Serializes ChunkData for transfer via postMessage
 * Keeps TypedArray backing buffers transferable.
 * 
 * @param chunk - The chunk data to serialize
 * @returns Serialized chunk data that can be transferred
 */
export function serializeChunkData(chunk: ChunkData): SerializedChunkData {
  return {
    x: chunk.x,
    y: chunk.y,
    size: chunk.size,
    heightmap: toTransferableBuffer(chunk.heightmap),
    biomeMap: toTransferableBuffer(chunk.biomeMap),
    sparseBiomeTypes: toTransferableBuffer(chunk.sparseBiomeTypes),
    sparseBiomeWeights: toTransferableBuffer(chunk.sparseBiomeWeights),
    sparseBiomeOffsets: toTransferableBuffer(chunk.sparseBiomeOffsets),
    lakes: (chunk.lakes ?? []).map(lake => ({
      waterLevel: lake.waterLevel,
      tiles: Array.from(lake.tiles),
      maxDepth: lake.maxDepth,
      minTerrainHeight: lake.minTerrainHeight,
    })),
    rivers: (chunk.rivers ?? []).map(river => ({
      riverId: river.riverId,
      pathId: river.pathId,
      isTributary: river.isTributary,
      points: river.points.map(point => ({ ...point })),
      bounds: river.bounds,
    })),
    resources: chunk.resources.map(r => ({
      x: r.x,
      y: r.y,
      type: r.type,
      amount: r.amount,
    })),
    structures: chunk.structures.map(s => ({
      x: s.x,
      y: s.y,
      type: s.type,
    })),
  };
}

/**
 * Returns transferable buffers for a serialized chunk payload.
 */
export function getChunkTransferList(serialized: SerializedChunkData): Transferable[] {
  const transfer: Transferable[] = [];
  const maybeAdd = (value: ArrayBuffer | ArrayLike<number>): void => {
    if (value instanceof ArrayBuffer) {
      transfer.push(value);
    }
  };

  maybeAdd(serialized.heightmap);
  maybeAdd(serialized.biomeMap);
  maybeAdd(serialized.sparseBiomeTypes);
  maybeAdd(serialized.sparseBiomeWeights);
  maybeAdd(serialized.sparseBiomeOffsets);

  return transfer;
}

/**
 * Deserializes chunk data received from worker
 * Converts transferred ArrayBuffers or legacy arrays back to TypedArrays.
 * 
 * @param serialized - The serialized chunk data
 * @returns Deserialized chunk data
 */
export function deserializeChunkData(serialized: SerializedChunkData): ChunkData {
  return {
    x: serialized.x,
    y: serialized.y,
    size: serialized.size,
    heightmap: new Float32Array(serialized.heightmap),
    biomeMap: new Uint8Array(serialized.biomeMap),
    sparseBiomeTypes: new Uint8Array(serialized.sparseBiomeTypes),
    sparseBiomeWeights: new Float32Array(serialized.sparseBiomeWeights),
    sparseBiomeOffsets: new Uint16Array(serialized.sparseBiomeOffsets),
    lakes: (serialized.lakes ?? []).map(lake => ({
      waterLevel: lake.waterLevel,
      tiles: new Set(lake.tiles),
      maxDepth: lake.maxDepth,
      minTerrainHeight: lake.minTerrainHeight,
    })),
    rivers: (serialized.rivers ?? []).map(river => ({
      riverId: river.riverId,
      pathId: river.pathId,
      isTributary: river.isTributary,
      points: river.points.map(point => ({ ...point })),
      bounds: river.bounds,
    })),
    resources: serialized.resources,
    structures: serialized.structures,
  };
}

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
 * import { installWorkerHandler } from 'procedural-world-engine/worker';
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
