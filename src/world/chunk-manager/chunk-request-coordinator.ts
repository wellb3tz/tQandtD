import type { ChunkData } from '../chunk';
import type { ChunkCacheStore, InFlightChunkRequests } from './chunk-cache-store';
import { generateChunkWithWorkerPool } from './chunk-worker-generation';
import type { WorkerPool } from '../worker-pool';
import { logger, LogCategory } from '../../utils/logger';

export interface ChunkRequestCoordinatorOptions {
  chunkX: number;
  chunkY: number;
  signal?: AbortSignal;
  priority?: number;
  cacheStore: ChunkCacheStore;
  inFlightRequests: InFlightChunkRequests;
  workerPool: WorkerPool | null;
  getCacheKey: (chunkX: number, chunkY: number) => string;
  reconcileCachedChunk: (chunk: ChunkData) => void;
  generateChunk: (chunkX: number, chunkY: number) => ChunkData;
  addToCache: (key: string, chunk: ChunkData) => void;
}

export function getChunkThroughCoordinator({
  chunkX,
  chunkY,
  signal,
  priority,
  cacheStore,
  inFlightRequests,
  workerPool,
  getCacheKey,
  reconcileCachedChunk,
  generateChunk,
  addToCache,
}: ChunkRequestCoordinatorOptions): Promise<ChunkData> {
  if (signal?.aborted) {
    throw new Error(`Chunk generation aborted for (${chunkX}, ${chunkY})`);
  }

  const key = getCacheKey(chunkX, chunkY);
  const cached = cacheStore.touch(key);
  if (cached) {
    reconcileCachedChunk(cached);
    return Promise.resolve(cached);
  }

  const inFlight = inFlightRequests.get(key);
  if (inFlight) {
    cacheStore.recordHit();
    return inFlight;
  }

  cacheStore.recordMiss();
  const generationPromise = generateAndCacheChunk({
    chunkX,
    chunkY,
    signal,
    priority,
    workerPool,
    generateChunk,
    addToCache: chunk => addToCache(key, chunk),
    clearInFlight: () => inFlightRequests.delete(key),
  });

  inFlightRequests.set(key, generationPromise);
  return generationPromise;
}

interface GenerateAndCacheOptions {
  chunkX: number;
  chunkY: number;
  signal?: AbortSignal;
  priority?: number;
  workerPool: WorkerPool | null;
  generateChunk: (chunkX: number, chunkY: number) => ChunkData;
  addToCache: (chunk: ChunkData) => void;
  clearInFlight: () => void;
}

async function generateAndCacheChunk({
  chunkX,
  chunkY,
  signal,
  priority,
  workerPool,
  generateChunk,
  addToCache,
  clearInFlight,
}: GenerateAndCacheOptions): Promise<ChunkData> {
  logger.debug(LogCategory.CHUNK, `Starting generation for chunk (${chunkX}, ${chunkY})`);
  if (signal?.aborted) {
    throw new Error(`Chunk generation aborted for (${chunkX}, ${chunkY})`);
  }

  const chunk = workerPool
    ? await generateChunkWithWorkerPool({
        workerPool,
        chunkX,
        chunkY,
        signal,
        priority,
        fallback: () => generateChunk(chunkX, chunkY),
      })
    : generateChunk(chunkX, chunkY);

  if (signal?.aborted) {
    throw new Error(`Chunk generation aborted for (${chunkX}, ${chunkY})`);
  }

  logger.debug(LogCategory.CHUNK, `Finished generation for chunk (${chunkX}, ${chunkY})`);
  addToCache(chunk);
  clearInFlight();
  return chunk;
}
