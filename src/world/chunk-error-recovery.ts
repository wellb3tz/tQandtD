import type { ChunkData } from './chunk';
import { createOceanFallbackChunk } from './chunk-biome-processing';
import {
  ChunkGenerationError,
  type ErrorRecoveryOptions,
} from '../utils/errors';
import { logger, LogCategory } from '../utils/logger';

export interface ChunkErrorRecoveryOptions {
  chunkX: number;
  chunkY: number;
  chunkSize: number;
  retryCount?: number;
  errorRecovery: ErrorRecoveryOptions;
  generate: () => ChunkData;
}

export function generateChunkWithErrorRecovery({
  chunkX,
  chunkY,
  chunkSize,
  retryCount = 0,
  errorRecovery,
  generate,
}: ChunkErrorRecoveryOptions): ChunkData {
  try {
    return generate();
  } catch (error) {
    const chunkError = error instanceof ChunkGenerationError
      ? error
      : new ChunkGenerationError(
          error instanceof Error ? error.message : 'Unknown error',
          chunkX,
          chunkY,
          'unknown',
          error instanceof Error ? error : undefined
        );

    if (errorRecovery.onError) {
      try {
        errorRecovery.onError(chunkError);
      } catch (handlerError) {
        logger.error(LogCategory.CHUNK, 'Error in custom error handler', handlerError);
      }
    }

    logger.error(LogCategory.CHUNK, chunkError.toString());
    if (chunkError.cause) {
      logger.debug(LogCategory.CHUNK, 'Stack trace', chunkError.cause.stack);
    }

    if (errorRecovery.retryOnFailure && retryCount < (errorRecovery.maxRetries ?? 3)) {
      logger.warn(LogCategory.CHUNK, `Retrying chunk (${chunkX}, ${chunkY}) generation, attempt ${retryCount + 1}/${errorRecovery.maxRetries}`);
      return generateChunkWithErrorRecovery({
        chunkX,
        chunkY,
        chunkSize,
        retryCount: retryCount + 1,
        errorRecovery,
        generate,
      });
    }

    if (errorRecovery.allowPartialChunks) {
      logger.warn(LogCategory.CHUNK, `Returning partial chunk for (${chunkX}, ${chunkY})`);
      return createOceanFallbackChunk(chunkX, chunkY, chunkSize);
    }

    throw chunkError;
  }
}

