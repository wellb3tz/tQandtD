import type { ChunkData } from '../chunk';
import type { WorkerPool, WorkerTask } from '../worker-pool';
import { logger, LogCategory } from '../../utils/logger';

export interface ChunkWorkerGenerationOptions {
  workerPool: WorkerPool;
  chunkX: number;
  chunkY: number;
  signal?: AbortSignal;
  priority?: number;
  fallback: () => ChunkData;
}

export function generateChunkWithWorkerPool({
  workerPool,
  chunkX,
  chunkY,
  signal,
  priority,
  fallback,
}: ChunkWorkerGenerationOptions): Promise<ChunkData> {
  return new Promise((resolve, reject) => {
    const task: WorkerTask = {
      id: '',
      chunkX,
      chunkY,
      lodLevel: 0,
      priority: priority ?? 0,
      signal,
      onComplete: (chunk: ChunkData) => {
        if (signal?.aborted) {
          reject(new Error(`Chunk generation aborted for (${chunkX}, ${chunkY})`));
          return;
        }
        resolve(chunk);
      },
      onError: (error: Error) => {
        if (signal?.aborted) {
          reject(new Error(`Chunk generation aborted for (${chunkX}, ${chunkY})`));
          return;
        }
        if (isCancellationError(error)) {
          reject(error);
          return;
        }
        logger.warn(LogCategory.WORKER, `Worker generation failed for chunk (${chunkX}, ${chunkY}), falling back to sync`, error);
        try {
          resolve(fallback());
        } catch (syncError) {
          reject(syncError);
        }
      },
    };

    workerPool.submitTask(task);
  });
}

function isCancellationError(error: Error): boolean {
  return /abort|cancel|shut down/i.test(error.message);
}
