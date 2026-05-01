/**
 * Error handling utilities for chunk generation
 * 
 * Provides custom error types with detailed context for debugging
 * and recovery strategies.
 */

/**
 * Base error class for chunk generation errors
 */
interface ErrorConstructorWithStackTrace extends ErrorConstructor {
  captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
}

export class ChunkGenerationError extends Error {
  constructor(
    message: string,
    public readonly chunkX: number,
    public readonly chunkY: number,
    public readonly stage: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ChunkGenerationError';
    
    // Maintain proper stack trace (V8 only)
    const errorConstructor = Error as ErrorConstructorWithStackTrace;
    if (typeof errorConstructor.captureStackTrace === 'function') {
      errorConstructor.captureStackTrace(this, ChunkGenerationError);
    }
  }

  /**
   * Returns a formatted error message with context
   */
  toString(): string {
    const causeMsg = this.cause ? `\nCaused by: ${this.cause.message}` : '';
    return `${this.name}: Failed to generate chunk (${this.chunkX}, ${this.chunkY}) at stage '${this.stage}': ${this.message}${causeMsg}`;
  }
}

/**
 * Error thrown when terrain generation fails
 */
export class TerrainGenerationError extends ChunkGenerationError {
  constructor(chunkX: number, chunkY: number, cause?: Error) {
    super('Terrain generation failed', chunkX, chunkY, 'terrain', cause);
    this.name = 'TerrainGenerationError';
  }
}

/**
 * Error thrown when biome generation fails
 */
export class BiomeGenerationError extends ChunkGenerationError {
  constructor(chunkX: number, chunkY: number, cause?: Error) {
    super('Biome generation failed', chunkX, chunkY, 'biomes', cause);
    this.name = 'BiomeGenerationError';
  }
}

/**
 * Error thrown when lake generation fails
 */
export class LakeGenerationError extends ChunkGenerationError {
  constructor(chunkX: number, chunkY: number, cause?: Error) {
    super('Lake generation failed', chunkX, chunkY, 'lakes', cause);
    this.name = 'LakeGenerationError';
  }
}

/**
 * Error thrown when resource generation fails
 */
export class ResourceGenerationError extends ChunkGenerationError {
  constructor(chunkX: number, chunkY: number, cause?: Error) {
    super('Resource generation failed', chunkX, chunkY, 'resources', cause);
    this.name = 'ResourceGenerationError';
  }
}

/**
 * Error thrown when structure generation fails
 */
export class StructureGenerationError extends ChunkGenerationError {
  constructor(chunkX: number, chunkY: number, cause?: Error) {
    super('Structure generation failed', chunkX, chunkY, 'structures', cause);
    this.name = 'StructureGenerationError';
  }
}

/**
 * Options for error recovery strategies
 */
export interface ErrorRecoveryOptions {
  /** Whether to retry generation on failure (default: false) */
  retryOnFailure?: boolean;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Whether to return partial chunk on failure (default: false) */
  allowPartialChunks?: boolean;
  /** Custom error handler callback */
  onError?: (error: ChunkGenerationError) => void;
}

/**
 * Default error recovery options
 */
export const DEFAULT_ERROR_RECOVERY: ErrorRecoveryOptions = {
  retryOnFailure: false,
  maxRetries: 3,
  allowPartialChunks: false,
};
