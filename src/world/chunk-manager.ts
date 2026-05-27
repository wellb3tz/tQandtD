import { ChunkData, Structure } from './chunk';
import { BiomeSystem } from './biome';
import { TerrainGenerator } from '../gen/terrain';
import { ResourceGenerator } from '../gen/resources';
import { StructurePlacer } from '../gen/structures';
import {
  ChunkModification,
  WorldSerializer,
  ChunkManagerSnapshot,
  type SerializationOptions,
  type SerializedWorld,
} from './serialization';
import { NoiseEngine } from '../core/noise';
import { EnhancedBiomeSystem } from './enhanced-biome';
import { WorkerPool } from './worker-pool';
import { LakeManager } from './lake-manager';
import { RiverManager } from './river-manager';
import { reconcileBoundaryHeights, reconcileNeighbourBoundaries } from './chunk-boundary-reconciliation';
import { fixBiomesAfterHeightChange } from './chunk-biome-processing';
import { ChunkCacheStore, InFlightChunkRequests, type CacheEntry } from './chunk-cache-store';
import { generateChunkWithErrorRecovery } from './chunk-error-recovery';
import { createChunkGenerationDependencies } from './chunk-generation-dependencies';
import { generateChunkThroughPipeline } from './chunk-generation-pipeline';
import { createStructureModification, mergeChunkModification } from './chunk-modification-tracker';
import { getChunkThroughCoordinator } from './chunk-request-coordinator';
import { createHydrologyManagers } from './hydrology-manager-factory';
import type { ChunkPerformanceMetrics, WorldConfig } from './world-config';
import { validateWorldConfig } from '../utils/validation';
import {
  ErrorRecoveryOptions,
  DEFAULT_ERROR_RECOVERY,
} from '../utils/errors';
import { logger, LogCategory } from '../utils/logger';

export type {
  ChunkInvalidationCallback,
  ChunkPerformanceMetrics,
  Noise3DConfig,
  ProgressCallback,
  WorldConfig,
} from './world-config';

/**
 * Manages chunk generation and caching for the procedural world.
 * Orchestrates all generators to create complete chunks with terrain, biomes, resources, and structures.
 * Implements ChunkManagerSnapshot so WorldSerializer can read state without any-casts.
 */
export class ChunkManager implements ChunkManagerSnapshot {
  readonly config: WorldConfig;
  private terrainGenerator: TerrainGenerator;
  private biomeSystem: BiomeSystem;
  private resourceGenerator: ResourceGenerator;
  private structurePlacer: StructurePlacer;
  private noiseEngine3D: NoiseEngine | null;
  private enhancedBiomeSystem: EnhancedBiomeSystem | null;
  private lakeManager: LakeManager | null;
  private riverManager: RiverManager | null;
  /** @internal exposed for WorkerPool shutdown in WorldApp */ workerPool: WorkerPool | null;
  private worldSerializer: WorldSerializer;
  /** Satisfies ChunkManagerSnapshot - readable by WorldSerializer */ readonly cache: Map<string, CacheEntry>;
  private cacheStore: ChunkCacheStore;
  private maxCacheSize: number;
  /** Satisfies ChunkManagerSnapshot - mutated by WorldSerializer.addChunkToCache */ accessCounter: number;
  /** Satisfies ChunkManagerSnapshot - readable by WorldSerializer */ readonly modifications: Map<string, ChunkModification>;
  private inFlightRequests: InFlightChunkRequests;
  private errorRecovery: ErrorRecoveryOptions;

  /**
   * Creates a new ChunkManager with the given configuration.
   * @param config - World generation configuration
   * @throws {ValidationError} If configuration is invalid
   */
  constructor(config: WorldConfig) {
    validateWorldConfig(config);
    
    this.config = config;
    const dependencies = createChunkGenerationDependencies(config);
    this.terrainGenerator = dependencies.terrainGenerator;
    this.biomeSystem = dependencies.biomeSystem;
    this.resourceGenerator = dependencies.resourceGenerator;
    this.structurePlacer = dependencies.structurePlacer;
    this.noiseEngine3D = dependencies.noiseEngine3D;
    this.enhancedBiomeSystem = dependencies.enhancedBiomeSystem;
    
    const hydrologyManagers = createHydrologyManagers({
      seed: config.seed,
      lakeConfig: config.lakeConfig,
      riverConfig: config.riverConfig,
      enhancedBiomeConfig: config.enhancedBiomeConfig,
      terrainGenerator: this.terrainGenerator,
      biomeSystem: this.biomeSystem,
    });
    this.lakeManager = hydrologyManagers.lakeManager;
    this.riverManager = hydrologyManagers.riverManager;
    
    this.workerPool = config.workerPoolConfig
      ? new WorkerPool({
          ...config.workerPoolConfig,
          worldConfig: config,
        })
      : null;
    
    this.worldSerializer = new WorldSerializer();
    
    this.cache = new Map();
    this.maxCacheSize = config.maxCacheSize ?? 100;
    this.accessCounter = 0;
    this.modifications = new Map();
    this.cacheStore = new ChunkCacheStore(
      this.cache,
      () => this.accessCounter,
      value => { this.accessCounter = value; },
      this.maxCacheSize,
      (evictedChunkX, evictedChunkY) => {
        this.lakeManager?.notifyChunkEvicted(evictedChunkX, evictedChunkY);
        this.riverManager?.notifyChunkEvicted(evictedChunkX, evictedChunkY);
      }
    );
    this.inFlightRequests = new InFlightChunkRequests();
    this.errorRecovery = { ...DEFAULT_ERROR_RECOVERY, ...config.errorRecovery };
  }

  /**
   * Gets a chunk at the specified coordinates, using cache if available.
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns Promise resolving to the chunk data at the specified coordinates
   */
  async getChunk(chunkX: number, chunkY: number, signal?: AbortSignal, options?: { priority?: number }): Promise<ChunkData> {
    return getChunkThroughCoordinator({
      chunkX,
      chunkY,
      signal,
      priority: options?.priority,
      cacheStore: this.cacheStore,
      inFlightRequests: this.inFlightRequests,
      workerPool: this.workerPool,
      getCacheKey: (x, y) => this.getCacheKey(x, y),
      reconcileCachedChunk: chunk => this.reconcileBoundaryHeights(chunk),
      generateChunk: (x, y) => this.generateChunk(x, y),
      addToCache: (key, chunk) => this.addToCache(key, chunk),
    });
  }

  /**
   * Generates a chunk at the specified coordinates without caching.
   * Includes comprehensive error handling with recovery strategies.
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param retryCount - Current retry attempt (internal use)
   * @returns The generated chunk data
   * @throws {ChunkGenerationError} If generation fails and recovery is not enabled
   */
  generateChunk(chunkX: number, chunkY: number, retryCount = 0): ChunkData {
    return generateChunkWithErrorRecovery({
      chunkX,
      chunkY,
      chunkSize: this.config.chunkSize,
      retryCount,
      errorRecovery: this.errorRecovery,
      generate: () => this.generateChunkInternal(chunkX, chunkY).chunk,
    });
  }

  /**
   * Generates a chunk and returns it together with per-stage timing metrics.
   * Useful for profiling and benchmarking.
   */
  generateChunkWithMetrics(chunkX: number, chunkY: number): { chunk: ChunkData; metrics: ChunkPerformanceMetrics } {
    const previousValue = this.config.enablePerformanceMetrics;
    this.config.enablePerformanceMetrics = true;
    try {
      return this.generateChunkInternal(chunkX, chunkY);
    } finally {
      this.config.enablePerformanceMetrics = previousValue;
    }
  }

  /**
   * Internal chunk generation with granular error handling
   */
  private generateChunkInternal(chunkX: number, chunkY: number): { chunk: ChunkData; metrics: ChunkPerformanceMetrics } {
    return generateChunkThroughPipeline(chunkX, chunkY, {
      config: this.config,
      terrainGenerator: this.terrainGenerator,
      biomeSystem: this.biomeSystem,
      resourceGenerator: this.resourceGenerator,
      structurePlacer: this.structurePlacer,
      noiseEngine3D: this.noiseEngine3D,
      enhancedBiomeSystem: this.enhancedBiomeSystem,
      lakeManager: this.lakeManager,
      riverManager: this.riverManager,
      errorRecovery: this.errorRecovery,
      invalidateCachedChunk: (invalidatedX, invalidatedY) => {
        const key = this.getCacheKey(invalidatedX, invalidatedY);
        const wasInCache = this.cache.has(key);
        this.cache.delete(key);
        return wasInCache;
      },
    });
  }

  /**
   * Clears all cached chunks.
   */
  clearCache(): void {
    this.cache.clear();
    this.inFlightRequests.clear();
    this.riverManager?.clear();
  }

  /**
   * Releases background generation resources and clears transient world state.
   */
  dispose(): void {
    this.workerPool?.shutdown();
    this.workerPool = null;
    this.clearCache();
    this.modifications.clear();
  }

  /**
   * Gets the current cache size.
   * @returns Number of chunks currently cached
   */
  getCacheSize(): number {
    return this.cacheStore.size;
  }

  /**
   * Gets cache statistics.
   * @returns Object with cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return this.cacheStore.stats();
  }

  hasWorkerPool(): boolean {
    return this.workerPool !== null;
  }

  getWorkerPoolInitializationError(): Error | null {
    return this.workerPool?.getInitializationError() ?? null;
  }

  getWorkerPoolStats(): {
    totalWorkers: number;
    activeWorkers: number;
    queuedTasks: number;
    completedTasks: number;
  } | null {
    return this.workerPool?.getStats() ?? null;
  }

  /**
   * Generates a cache key for chunk coordinates.
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns Cache key string
   */
  private getCacheKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }

  /**
   * Adds a chunk to the cache with LRU eviction.
   * @param key - Cache key
   * @param chunk - Chunk data to cache
   */
  private addToCache(key: string, chunk: ChunkData): void {
    logger.debug(LogCategory.CACHE, `Adding chunk (${chunk.x}, ${chunk.y}) to cache`);

    // If cache is full, evict the least recently used entry.
    // Map preserves insertion order, so the first key is the oldest.
    // Add new entry with incremented counter.
    // Reconcile the new chunk against existing neighbours first, then ask
    // existing neighbours to reconcile themselves against the new chunk.
    this.reconcileBoundaryHeights(chunk);
    this.cacheStore.set(key, chunk);
    this.reconcileNeighbourBoundaries(chunk);
  }

  /**
   * Keep duplicated boundary vertices identical when a newly generated chunk
   * meets an already cached neighbour. Terrain generation is naturally seamless;
   * lake carving can be discovered from either side later, so the lower carved
   * height wins and is copied to both chunk meshes.
   *
   * IMPORTANT: This method only mutates the `chunk` passed as the argument.
   * Neighbouring chunks are NEVER modified directly here. If a neighbour's
   * boundary height differs from the shared height, it is marked for lazy
   * invalidation via `onChunkInvalidated`. When the neighbour is later
   * retrieved (cache hit) or when `reconcileNeighbourBoundaries` is called,
   * `reconcileBoundaryHeights` will be invoked for *that* chunk and it will
   * apply the shared height to itself. This eliminates hidden side-effects
   * on cached objects belonging to other chunks.
   */
  private reconcileBoundaryHeights(chunk: ChunkData): void {
    reconcileBoundaryHeights(
      chunk,
      this.cache,
      this.config.onChunkInvalidated,
      reconciledChunk => fixBiomesAfterHeightChange(reconciledChunk)
    );
  }

  /**
   * After a new chunk has been added to the cache, trigger reconciliation
   * for any already-cached neighbours so they can update their own boundary
   * heights. This complements `reconcileBoundaryHeights` (which is side-effect
   * free w.r.t. neighbours) by explicitly asking each neighbour to reconcile
   * itself against the newly added chunk.
   */
  private reconcileNeighbourBoundaries(chunk: ChunkData): void {
    reconcileNeighbourBoundaries(
      chunk,
      this.cache,
      this.config.onChunkInvalidated,
      reconciledChunk => fixBiomesAfterHeightChange(reconciledChunk)
    );
  }

  recordModification(chunkX: number, chunkY: number, modification: ChunkModification): void {
    mergeChunkModification(this.modifications, chunkX, chunkY, modification);
  }

  recordStructureAddition(chunkX: number, chunkY: number, structure: Structure): void {
    this.recordModification(chunkX, chunkY, createStructureModification(chunkX, chunkY, [structure], []));
  }

  recordStructureRemoval(chunkX: number, chunkY: number, structureIndex: number): void {
    this.recordModification(chunkX, chunkY, createStructureModification(chunkX, chunkY, [], [structureIndex]));
  }

  recordStructureChanges(
    chunkX: number,
    chunkY: number,
    addedStructures: Structure[],
    removedStructures: number[]
  ): void {
    this.recordModification(
      chunkX,
      chunkY,
      createStructureModification(chunkX, chunkY, addedStructures, removedStructures)
    );
  }

  saveWorld(options: SerializationOptions): SerializedWorld {
    return this.worldSerializer.serialize(this, options);
  }

  loadWorld(data: SerializedWorld): void {
    this.worldSerializer.deserialize(data, this);
  }

  exportWorld(options: SerializationOptions): Blob | string {
    return this.worldSerializer.export(this, options);
  }
}
