import { BiomeType, ChunkData, Structure, getBiomeWeightsForTile, createSparseBiomeWeights } from './chunk';
import { BiomeSystem, BiomeConfig } from './biome';
import { TerrainGenerator, TerrainConfig } from '../gen/terrain';
import { ResourceGenerator, ResourceConfig } from '../gen/resources';
import { StructurePlacer, StructureConfig } from '../gen/structures';
import { LakeConfig, DEFAULT_LAKE_CONFIG, LakeData } from '../gen/lakes';
import {
  DEFAULT_RIVER_CONFIG,
  createSmoothedRiverPoints,
  getRiverChannelDepth,
  getRiverChannelWidth,
  getRiverValleyDepth,
  getRiverValleyWidth,
  type RiverConfig,
  type RiverData,
  type RiverPoint,
  type WorldRiverData,
} from '../gen/rivers';
import { chunkSeed } from '../core/hash';
import { ChunkModification, WorldSerializer, ChunkManagerSnapshot } from './serialization';
import { NoiseEngine, NoiseConfig } from '../core/noise';
import { EnhancedBiomeConfig, EnhancedBiomeSystem } from './enhanced-biome';
import { WorkerPoolConfig, WorkerPool, WorkerTask } from './worker-pool';
import { LakeManager, WorldLakeData } from './lake-manager';
import { RiverManager } from './river-manager';
import { validateWorldConfig } from '../utils/validation';
import {
  ChunkGenerationError,
  TerrainGenerationError,
  BiomeGenerationError,
  LakeGenerationError,
  RiverGenerationError,
  ResourceGenerationError,
  StructureGenerationError,
  ErrorRecoveryOptions,
  DEFAULT_ERROR_RECOVERY,
} from '../utils/errors';
import { logger, LogCategory } from '../utils/logger';

const SEA_LEVEL = 0.3;
const RIVER_MOUTH_TAPER_HEIGHT = 0.1;
const RIVER_MOUTH_MAX_BELOW_SEA_DEPTH = 0.025;
const RIVER_TERMINAL_CARVE_EXTENSION = 1;
const RIVER_MIN_CHANNEL_CARVE_RADIUS = 1.35;
const RIVER_MIN_CHANNEL_FLOOR_RADIUS = 0.65;
const RIVER_VALLEY_PROFILE_PADDING = 0.5;

/**
 * Configuration for 3D noise generation
 */
export interface Noise3DConfig extends NoiseConfig {
  /** Enable 3D mode (default: false for backward compatibility) */
  enable3D: boolean;
  /** Z-coordinate scale factor for 3D noise */
  zScale?: number;
}

/**
 * Performance metrics for chunk generation
 */
export interface ChunkPerformanceMetrics {
  /** Total time to generate chunk (ms) */
  totalTime: number;
  /** Time spent on terrain generation (ms) */
  terrainTime: number;
  /** Time spent on biome generation (ms) */
  biomeTime: number;
  /** Time spent on biome classification per tile (ms) */
  biomeClassificationTime: number;
  /** Time spent on biome blending / weight sampling (ms) */
  biomeBlendingTime: number;
  /** Time spent on river generation (ms) */
  riverTime: number;
  /** Time spent on lake generation (ms) */
  lakeTime: number;
  /** Time spent on resource generation (ms) */
  resourceTime: number;
  /** Time spent on structure generation (ms) */
  structureTime: number;
}

/**
 * Progress callback for chunk generation
 */
export type ProgressCallback = (stage: string, progress: number) => void;

/**
 * Called when generation discovers that an already cached chunk must be
 * regenerated, for example when a newly found multi-chunk lake crosses into it.
 */
export type ChunkInvalidationCallback = (chunkX: number, chunkY: number) => void;

/**
 * Configuration for world generation
 */
export interface WorldConfig {
  /** World seed for deterministic generation */
  seed: number;
  /** Size of each chunk side in meters. Runtime coordinates use 1 world unit = 1 meter. */
  chunkSize: number;
  /** Terrain generation configuration */
  terrainConfig: TerrainConfig;
  /** Biome generation configuration */
  biomeConfig: BiomeConfig;
  /** Resource generation configuration */
  resourceConfig: ResourceConfig;
  /** Structure placement configuration */
  structureConfig: StructureConfig;
  /** 3D noise configuration (optional) */
  noise3DConfig?: Noise3DConfig;
  /** Enhanced biome configuration (optional) */
  enhancedBiomeConfig?: EnhancedBiomeConfig;
  /** Lake generation configuration (optional, enabled by default) */
  lakeConfig?: LakeConfig;
  /** River generation configuration (optional, enabled by default) */
  riverConfig?: RiverConfig;
  /** Worker pool configuration (optional) */
  workerPoolConfig?: WorkerPoolConfig;
  /** Maximum number of chunks to cache (default: 100) */
  maxCacheSize?: number;
  /** Enable performance timing measurements (default: false) */
  enablePerformanceMetrics?: boolean;
  /** Progress callback for long-running operations */
  onProgress?: ProgressCallback;
  /** Callback for chunks invalidated by cross-chunk generation side effects */
  onChunkInvalidated?: ChunkInvalidationCallback;
  /** Error recovery options (optional) */
  errorRecovery?: ErrorRecoveryOptions;
}

/**
 * LRU cache entry for chunk data
 */
interface CacheEntry {
  chunk: ChunkData;
  lastAccessed: number;
}

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
  private maxCacheSize: number;
  /** Satisfies ChunkManagerSnapshot - mutated by WorldSerializer.addChunkToCache */ accessCounter: number;
  /** Satisfies ChunkManagerSnapshot - readable by WorldSerializer */ readonly modifications: Map<string, ChunkModification>;
  private cacheHits: number;
  private cacheMisses: number;
  private inFlightRequests: Map<string, Promise<ChunkData>>;
  private errorRecovery: ErrorRecoveryOptions;

  /**
   * Creates a new ChunkManager with the given configuration.
   * @param config - World generation configuration
   * @throws {ValidationError} If configuration is invalid
   */
  constructor(config: WorldConfig) {
    // Validate configuration before initialization
    validateWorldConfig(config);
    
    this.config = config;
    this.terrainGenerator = new TerrainGenerator(config.terrainConfig);
    
    // Initialize NoiseEngine3D if 3D noise is enabled (Requirement 1.1)
    this.noiseEngine3D = config.noise3DConfig?.enable3D
      ? new NoiseEngine(config.seed)
      : null;
    
    // Initialize EnhancedBiomeSystem if enhanced biomes are enabled, otherwise use BiomeSystem (Requirement 2.1)
    if (config.enhancedBiomeConfig) {
      this.enhancedBiomeSystem = new EnhancedBiomeSystem(config.seed, config.enhancedBiomeConfig);
      this.biomeSystem = this.enhancedBiomeSystem; // Use enhanced system as base
    } else {
      this.biomeSystem = new BiomeSystem(config.seed, config.biomeConfig);
      this.enhancedBiomeSystem = null;
    }
    
    this.resourceGenerator = new ResourceGenerator(config.resourceConfig);
    this.structurePlacer = new StructurePlacer(config.structureConfig);
    
    // Initialize LakeManager if lakes are enabled (multi-chunk lakes are now the only option)
    const lakeConfig = config.lakeConfig ?? DEFAULT_LAKE_CONFIG;
    // Adjust lake-permitted biomes based on global temperature offset
    const temperatureOffset = config.enhancedBiomeConfig?.worldTemperatureOffset
      ?? config.enhancedBiomeConfig?.climateConfig?.worldTemperatureOffset
      ?? 0;
    const climateLakeBiomes = new Set<BiomeType>(lakeConfig.allowedBiomes);
    if (temperatureOffset > 0.4) {
      // Hot world: tundra and taiga lakes dry out
      climateLakeBiomes.delete(BiomeType.TUNDRA);
      climateLakeBiomes.delete(BiomeType.TAIGA);
    }
    if (temperatureOffset < -0.4) {
      // Cold world: deserts and savannas lose lakes entirely
      climateLakeBiomes.delete(BiomeType.DESERT);
      climateLakeBiomes.delete(BiomeType.SAVANNA);
    }
    const adjustedLakeConfig: LakeConfig = {
      ...lakeConfig,
      allowedBiomes: Array.from(climateLakeBiomes),
    };
    this.lakeManager = lakeConfig.enabled ? new LakeManager(
      config.seed,
      adjustedLakeConfig,
      (worldX: number, worldY: number) => this.terrainGenerator.getHeightAt(worldX, worldY, config.seed),
      (worldX: number, worldY: number) => {
        const height = this.terrainGenerator.getHeightAt(worldX, worldY, config.seed);
        return this.biomeSystem.getBiome(worldX, worldY, height);
      }
    ) : null;

    const riverConfig = config.riverConfig ?? DEFAULT_RIVER_CONFIG;
    this.riverManager = riverConfig.enabled ? new RiverManager(
      config.seed,
      riverConfig,
      (worldX: number, worldY: number) => this.terrainGenerator.getHeightAt(worldX, worldY, config.seed),
      (worldX: number, worldY: number) => {
        const height = this.terrainGenerator.getHeightAt(worldX, worldY, config.seed);
        return this.biomeSystem.getBiome(worldX, worldY, height);
      }
    ) : null;

    // Cross-wire the two managers so lakes never spawn on river corridors
    // and rivers terminate when they reach an existing lake.
    if (this.lakeManager && this.riverManager) {
      this.lakeManager.setRiverTileChecker((x, y) => this.riverManager!.isPointInRiverCorridor(x, y));
      this.riverManager.setLakeTileChecker((x, y) => this.lakeManager!.isPointInLake(x, y));
    }
    
    // Initialize WorkerPool if multi-threading is enabled (Requirement 9.1)
    this.workerPool = config.workerPoolConfig
      ? new WorkerPool({
          ...config.workerPoolConfig,
          worldConfig: config,
        })
      : null;
    
    // Initialize WorldSerializer (always initialized for serialization support) (Requirement 12.1)
    this.worldSerializer = new WorldSerializer();
    
    this.cache = new Map();
    this.maxCacheSize = config.maxCacheSize ?? 100;
    this.accessCounter = 0;
    this.modifications = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.inFlightRequests = new Map();
    this.errorRecovery = { ...DEFAULT_ERROR_RECOVERY, ...config.errorRecovery };
  }

  /**
   * Gets a chunk at the specified coordinates, using cache if available.
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns Promise resolving to the chunk data at the specified coordinates
   */
  async getChunk(chunkX: number, chunkY: number, signal?: AbortSignal, options?: { priority?: number }): Promise<ChunkData> {
    if (signal?.aborted) {
      throw new Error(`Chunk generation aborted for (${chunkX}, ${chunkY})`);
    }

    const key = this.getCacheKey(chunkX, chunkY);
    
    // Check cache
    const cached = this.cache.get(key);
    if (cached) {
      this.reconcileBoundaryHeights(cached.chunk);
      cached.lastAccessed = ++this.accessCounter;
      // Move to the end of the Map to mark as most-recently-used (O(1) LRU)
      this.cache.delete(key);
      this.cache.set(key, cached);
      this.cacheHits++;
      return cached.chunk;
    }

    // If a generation for this chunk is already in-flight, reuse that promise
    const inFlight = this.inFlightRequests.get(key);
    if (inFlight) {
      this.cacheHits++;
      return inFlight;
    }

    // Cache miss - start generation
    this.cacheMisses++;

    // Decide generation strategy based on worker pool availability
    const generationPromise: Promise<ChunkData> = (async () => {
      logger.debug(LogCategory.CHUNK, `Starting generation for chunk (${chunkX}, ${chunkY})`);
      if (signal?.aborted) {
        throw new Error(`Chunk generation aborted for (${chunkX}, ${chunkY})`);
      }
      let chunk: ChunkData;
      if (this.workerPool) {
        chunk = await this.generateChunkAsync(chunkX, chunkY, signal, options?.priority);
      } else {
        if (signal?.aborted) {
          throw new Error(`Chunk generation aborted for (${chunkX}, ${chunkY})`);
        }
        chunk = this.generateChunk(chunkX, chunkY);
      }
      logger.debug(LogCategory.CHUNK, `Finished generation for chunk (${chunkX}, ${chunkY})`);
      // Add to cache and remove from in-flight map
      this.addToCache(key, chunk);
      this.inFlightRequests.delete(key);
      return chunk;
    })();

    this.inFlightRequests.set(key, generationPromise);

    // Ensure we clean up in-flight entry even on error
    generationPromise.catch(() => {
      this.inFlightRequests.delete(key);
    });

    return generationPromise;
  }

  /**
   * Generates a chunk asynchronously using the worker pool.
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param signal - Optional abort signal for cancellation
   * @returns Promise resolving to the generated chunk data
   */
  private generateChunkAsync(chunkX: number, chunkY: number, signal?: AbortSignal, priority?: number): Promise<ChunkData> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: '', // Will be assigned by submitTask
        chunkX,
        chunkY,
        lodLevel: 0, // Always generate at full resolution
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
          // Fallback to synchronous generation on error
          if (signal?.aborted) {
            reject(new Error(`Chunk generation aborted for (${chunkX}, ${chunkY})`));
            return;
          }
          logger.warn(LogCategory.WORKER, `Worker generation failed for chunk (${chunkX}, ${chunkY}), falling back to sync`, error);
          try {
            const syncChunk = this.generateChunk(chunkX, chunkY);
            resolve(syncChunk);
          } catch (syncError) {
            reject(syncError);
          }
        }
      };

      this.workerPool!.submitTask(task);
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
    try {
      return this.generateChunkInternal(chunkX, chunkY).chunk;
    } catch (error) {
      // Convert to ChunkGenerationError if not already
      const chunkError = error instanceof ChunkGenerationError
        ? error
        : new ChunkGenerationError(
            error instanceof Error ? error.message : 'Unknown error',
            chunkX,
            chunkY,
            'unknown',
            error instanceof Error ? error : undefined
          );

      // Call custom error handler if provided
      if (this.errorRecovery.onError) {
        try {
          this.errorRecovery.onError(chunkError);
        } catch (handlerError) {
          logger.error(LogCategory.CHUNK, 'Error in custom error handler', handlerError);
        }
      }

      // Log error with context
      logger.error(LogCategory.CHUNK, chunkError.toString());
      if (chunkError.cause) {
        logger.debug(LogCategory.CHUNK, 'Stack trace', chunkError.cause.stack);
      }

      // Retry logic
      if (this.errorRecovery.retryOnFailure && retryCount < (this.errorRecovery.maxRetries ?? 3)) {
        logger.warn(LogCategory.CHUNK, `Retrying chunk (${chunkX}, ${chunkY}) generation, attempt ${retryCount + 1}/${this.errorRecovery.maxRetries}`);
        return this.generateChunk(chunkX, chunkY, retryCount + 1);
      }

      // Return partial chunk if allowed
      if (this.errorRecovery.allowPartialChunks) {
        logger.warn(LogCategory.CHUNK, `Returning partial chunk for (${chunkX}, ${chunkY})`);
        return this.createEmptyChunk(chunkX, chunkY);
      }

      // Re-throw if no recovery strategy
      throw chunkError;
    }
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
    const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
    const metrics: Partial<ChunkPerformanceMetrics> = {};

    // Compute unique seed for this chunk
    const seed = chunkSeed(this.config.seed, chunkX, chunkY);

    // Step 1: Generate heightmap using terrain generator
    let heightmap: Float32Array;
    try {
      this.config.onProgress?.('terrain', 0.2);
      const terrainStart = this.config.enablePerformanceMetrics ? performance.now() : 0;
      
      heightmap = this.noiseEngine3D
        ? this.terrainGenerator.generateHeightmap(this.config.seed, this.config.chunkSize, chunkX, chunkY, this.noiseEngine3D)
        : this.terrainGenerator.generateHeightmap(this.config.seed, this.config.chunkSize, chunkX, chunkY);
      
      if (this.config.enablePerformanceMetrics) {
        metrics.terrainTime = performance.now() - terrainStart;
      }

      // Validate heightmap
      if (!heightmap || heightmap.length === 0) {
        throw new Error('Generated heightmap is empty');
      }
      
      const expectedSize = (this.config.chunkSize + 1) * (this.config.chunkSize + 1);
      if (heightmap.length !== expectedSize) {
        throw new Error(`Invalid heightmap size: expected ${expectedSize}, got ${heightmap.length}`);
      }
    } catch (error) {
      throw new TerrainGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
    }

    // Step 2: Generate biome data
    let biomeMap: Uint8Array;
    let sparseBiomeTypes: Uint8Array;
    let sparseBiomeWeights: Float32Array;
    let sparseBiomeOffsets: Uint16Array;
    let temperatureMap: Float32Array;
    
    try {
      this.config.onProgress?.('biomes', 0.4);
      const biomeStart = this.config.enablePerformanceMetrics ? performance.now() : 0;
      
      const biomeData = this.generateBiomeData(chunkX, chunkY, heightmap);
      biomeMap = biomeData.biomeMap;
      sparseBiomeTypes = biomeData.sparseBiomeTypes;
      sparseBiomeWeights = biomeData.sparseBiomeWeights;
      sparseBiomeOffsets = biomeData.sparseBiomeOffsets;
      temperatureMap = biomeData.temperatureMap;
      
      if (this.config.enablePerformanceMetrics) {
        metrics.biomeTime = performance.now() - biomeStart;
        metrics.biomeClassificationTime = biomeData.metrics.classificationTime;
        metrics.biomeBlendingTime = biomeData.metrics.blendingTime;
      }

      // Validate biome data
      if (!biomeMap || biomeMap.length === 0) {
        throw new Error('Generated biome map is empty');
      }
    } catch (error) {
      throw new BiomeGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
    }

    // Compute dynamic climate thresholds (uniform across the world because the
    // offset is global, but we store them per-chunk so the renderer sees them)
    let climateSnowLine: number | undefined;
    let climateTreeLine: number | undefined;
    let worldTemperatureOffset: number | undefined;
    if (this.enhancedBiomeSystem) {
      climateSnowLine = this.enhancedBiomeSystem.getClimateSnowLine();
      climateTreeLine = this.enhancedBiomeSystem.getClimateTreeLine();
      worldTemperatureOffset = this.enhancedBiomeSystem.getWorldTemperatureOffset();
    }

    // Initialize chunk data with terrain and biomes
    const chunk: ChunkData = {
      x: chunkX,
      y: chunkY,
      size: this.config.chunkSize,
      heightmap,
      biomeMap,
      sparseBiomeTypes,
      sparseBiomeWeights,
      sparseBiomeOffsets,
      climateSnowLine,
      climateTreeLine,
      worldTemperatureOffset,
      temperatureMap,
      lakes: [],
      rivers: [],
      resources: [],
      structures: [],
    };

    // Step 3: Generate rivers using multi-chunk river manager
    try {
      this.config.onProgress?.('rivers', 0.55);
      const riverStart = this.config.enablePerformanceMetrics ? performance.now() : 0;

      if (this.riverManager) {
        const worldRivers = this.riverManager.getRiversForChunk(
          chunkX,
          chunkY,
          this.config.chunkSize
        );
        // Compute per-river climate states once per chunk
        const riverStateMap = new Map<string, 'flowing' | 'frozen' | 'dry'>();
        for (const river of worldRivers) {
          riverStateMap.set(river.id, this.determineRiverState(river));
        }
        chunk.rivers = this.convertWorldRiversToChunkRivers(worldRivers, chunkX, chunkY, this.config.chunkSize, riverStateMap);

        if (chunk.rivers.length > 0) {
          this.carveTerrainForRivers(chunk.rivers, heightmap, this.config.chunkSize);
          this.fixBiomesAfterHeightChange(chunk);
        }
      }

      if (this.config.enablePerformanceMetrics) {
        metrics.riverTime = performance.now() - riverStart;
      }
    } catch (error) {
      logger.warn(LogCategory.RIVER, `River generation failed for chunk (${chunkX}, ${chunkY}), continuing without rivers`, error);
      chunk.rivers = [];

      if (!this.errorRecovery.allowPartialChunks) {
        throw new RiverGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
      }
    }

    // Step 4: Generate lakes using multi-chunk lake manager
    try {
      this.config.onProgress?.('lakes', 0.58);
      const lakeStart = this.config.enablePerformanceMetrics ? performance.now() : 0;

      if (this.lakeManager) {
        const worldLakes = this.lakeManager.getLakesForChunk(
          chunkX,
          chunkY,
          this.config.chunkSize,
          (cx: number, cy: number) => {
            const key = this.getCacheKey(cx, cy);
            const wasInCache = this.cache.has(key);
            this.cache.delete(key);
            logger.debug(LogCategory.CACHE, `Cache invalidation for chunk (${cx}, ${cy}): wasInCache=${wasInCache}`);
            this.config.onChunkInvalidated?.(cx, cy);
          }
        );

        chunk.lakes = this.convertWorldLakesToChunkLakes(worldLakes, chunkX, chunkY, this.config.chunkSize, heightmap);

        if (worldLakes.length > 0) {
          this.carveTerrainForWorldLakes(worldLakes, chunkX, chunkY, this.config.chunkSize, heightmap);
          this.fixBiomesAfterHeightChange(chunk);
        }
      }

      if (this.config.enablePerformanceMetrics) {
        metrics.lakeTime = performance.now() - lakeStart;
      }
    } catch (error) {
      // Lakes are optional - log error but continue
      logger.warn(LogCategory.LAKE, `Lake generation failed for chunk (${chunkX}, ${chunkY}), continuing without lakes`, error);
      chunk.lakes = [];

      // Only throw if error recovery doesn't allow partial chunks
      if (!this.errorRecovery.allowPartialChunks) {
        throw new LakeGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
      }
    }

    // Step 5: Generate resources based on biomes and noise
    try {
      this.config.onProgress?.('resources', 0.6);
      const resourceStart = this.config.enablePerformanceMetrics ? performance.now() : 0;
      
      chunk.resources = this.resourceGenerator.generateResources(chunk, seed);
      
      if (this.config.enablePerformanceMetrics) {
        metrics.resourceTime = performance.now() - resourceStart;
      }
    } catch (error) {
      // Resources are optional - log error but continue
      logger.warn(LogCategory.CHUNK, `Resource generation failed for chunk (${chunkX}, ${chunkY}), continuing without resources`, error);
      chunk.resources = [];
      
      if (!this.errorRecovery.allowPartialChunks) {
        throw new ResourceGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
      }
    }

    // Step 6: Generate structures using Poisson Disk Sampling
    try {
      this.config.onProgress?.('structures', 0.8);
      const structureStart = this.config.enablePerformanceMetrics ? performance.now() : 0;
      
      chunk.structures = this.structurePlacer.generateStructures(chunk, seed);
      
      if (this.config.enablePerformanceMetrics) {
        metrics.structureTime = performance.now() - structureStart;
      }
    } catch (error) {
      // Structures are optional - log error but continue
      logger.warn(LogCategory.CHUNK, `Structure generation failed for chunk (${chunkX}, ${chunkY}), continuing without structures`, error);
      chunk.structures = [];
      
      if (!this.errorRecovery.allowPartialChunks) {
        throw new StructureGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
      }
    }

    this.config.onProgress?.('complete', 1.0);

    // Log performance metrics if enabled
    if (this.config.enablePerformanceMetrics) {
      metrics.totalTime = performance.now() - startTime;
      if (metrics.totalTime > 100) {
        logger.info(LogCategory.PERFORMANCE, `Chunk (${chunkX}, ${chunkY}) generation metrics`, metrics);
      }
    }

    return {
      chunk,
      metrics: {
        totalTime: metrics.totalTime ?? 0,
        terrainTime: metrics.terrainTime ?? 0,
        biomeTime: metrics.biomeTime ?? 0,
        biomeClassificationTime: metrics.biomeClassificationTime ?? 0,
        biomeBlendingTime: metrics.biomeBlendingTime ?? 0,
        riverTime: metrics.riverTime ?? 0,
        lakeTime: metrics.lakeTime ?? 0,
        resourceTime: metrics.resourceTime ?? 0,
        structureTime: metrics.structureTime ?? 0,
      },
    };
  }

  /**
   * Re-evaluates biome classification for tiles whose height has changed
   * after river / lake carving or boundary reconciliation.
   * Any tile whose average corner height is below sea level is forced to OCEAN.
   */
  private fixBiomesAfterHeightChange(chunk: ChunkData): void {
    const size = chunk.size;
    const vertexCount = size + 1;
    const seaLevel = SEA_LEVEL;
    let changed = false;

    // Reconstruct per-tile weight maps from the sparse arrays.
    const tileWeights: Map<BiomeType, number>[] = [];
    const tileCount = size * size;
    for (let i = 0; i < tileCount; i++) {
      tileWeights.push(getBiomeWeightsForTile(chunk, i));
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tileIdx = y * size + x;
        const h00 = chunk.heightmap[y * vertexCount + x];
        const h10 = chunk.heightmap[y * vertexCount + (x + 1)];
        const h01 = chunk.heightmap[(y + 1) * vertexCount + x];
        const h11 = chunk.heightmap[(y + 1) * vertexCount + (x + 1)];
        const avgHeight = (h00 + h10 + h01 + h11) / 4;

        const currentBiome = chunk.biomeMap[tileIdx];

        if (avgHeight < seaLevel && currentBiome !== BiomeType.OCEAN) {
          chunk.biomeMap[tileIdx] = BiomeType.OCEAN;
          tileWeights[tileIdx] = new Map([[BiomeType.OCEAN, 1.0]]);
          if (chunk.temperatureMap) {
            chunk.temperatureMap[tileIdx] = 0;
          }
          changed = true;
        }
      }
    }

    if (changed) {
      const sparse = createSparseBiomeWeights(tileWeights, tileCount);
      chunk.sparseBiomeTypes = sparse.types;
      chunk.sparseBiomeWeights = sparse.weights;
      chunk.sparseBiomeOffsets = sparse.offsets;
    }
  }

  /**
   * Creates an empty chunk with default values (used for error recovery)
   */
  private createEmptyChunk(chunkX: number, chunkY: number): ChunkData {
    const size = this.config.chunkSize;
    const vertexCount = size + 1;
    const tileCount = size * size;

    // Create sparse biome weights for ocean (all tiles have 100% ocean weight)
    const types: number[] = [];
    const weights: number[] = [];
    const offsets: number[] = [];
    
    for (let i = 0; i < tileCount; i++) {
      offsets.push(types.length);
      types.push(0); // BiomeType.OCEAN
      weights.push(1.0);
    }

    return {
      x: chunkX,
      y: chunkY,
      size,
      heightmap: new Float32Array(vertexCount * vertexCount).fill(0.3), // Sea level
      biomeMap: new Uint8Array(tileCount).fill(0), // OCEAN
      sparseBiomeTypes: new Uint8Array(types),
      sparseBiomeWeights: new Float32Array(weights),
      sparseBiomeOffsets: new Uint16Array(offsets),
      lakes: [],
      rivers: [],
      resources: [],
      structures: [],
    };
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
    return this.cache.size;
  }

  /**
   * Gets cache statistics.
   * @returns Object with cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate
    };
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
   * Generates biome data for a chunk.
   * Uses EnhancedBiomeSystem if available, otherwise falls back to BiomeSystem.
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param heightmap - The heightmap for this chunk
   * @returns Biome map and biome weights arrays
   */
  private generateBiomeData(
    chunkX: number,
    chunkY: number,
    heightmap: Float32Array
  ): { 
    biomeMap: Uint8Array; 
    sparseBiomeTypes: Uint8Array;
    sparseBiomeWeights: Float32Array;
    sparseBiomeOffsets: Uint16Array;
    temperatureMap: Float32Array;
    metrics: { classificationTime: number; blendingTime: number };
  } {
    const size = this.config.chunkSize;
    const biomeMap = new Uint8Array(size * size);
    const temperatureMap = new Float32Array(size * size);


    // Collect weight maps for all tiles (will convert to sparse at the end)
    const tileWeights: Map<number, number>[] = [];

    // Convert chunk coordinates to world coordinates
    const worldX = chunkX * size;
    const worldY = chunkY * size;

    // Heightmap has (size+1) x (size+1) vertices for seamless boundaries
    const vertexCount = size + 1;

    // Create height sampling callback that handles both current chunk and neighboring positions
    const getHeight = (worldPosX: number, worldPosY: number): number => {
      // Convert world coordinates to chunk coordinates
      const targetChunkX = Math.floor(worldPosX / size);
      const targetChunkY = Math.floor(worldPosY / size);

      // If sampling from current chunk, use heightmap directly
      if (targetChunkX === chunkX && targetChunkY === chunkY) {
        const localX = worldPosX - worldX;
        const localY = worldPosY - worldY;
        // Check if within heightmap bounds (0 to size inclusive for vertices)
        if (localX >= 0 && localX <= size && localY >= 0 && localY <= size) {
          return heightmap[localY * vertexCount + localX];
        }
      }

      // For neighboring chunks, generate height on-demand using terrain generator
      return this.terrainGenerator.getHeightAt(worldPosX, worldPosY, this.config.seed);
    };

    // ---- Grid-based fast lookup for blending samples ----
    // All float coordinates sampled by getBiomeWeightsWithRadius have the form
    //   worldX + tileX + k * blendRadius/3
    // We pre-compute height and biome on a dense grid and use O(1) array indexing
    // instead of expensive Map<string> hashing + string allocation.
    const blendRadius = this.config.biomeConfig.blendRadius;
    const step = blendRadius / 3;               // sampling step inside blending
    const stepInv = 3 / blendRadius;            // 1/step
    const pad = Math.ceil(blendRadius) + 1;

    const gridMinX = worldX - pad;
    const gridMinY = worldY - pad;
    const gridMaxX = worldX + size + pad;
    const gridMaxY = worldY + size + pad;
    const gridW = Math.ceil((gridMaxX - gridMinX) * stepInv) + 1;
    const gridH = Math.ceil((gridMaxY - gridMinY) * stepInv) + 1;

    const gridHeight = new Float32Array(gridW * gridH);
    const gridBiome  = new Uint8Array(gridW * gridH);
    const gridFilled = new Uint8Array(gridW * gridH);

    const gridIndex = (gx: number, gy: number): number => {
      const ix = Math.round((gx - gridMinX) * stepInv);
      const iy = Math.round((gy - gridMinY) * stepInv);
      return iy * gridW + ix;
    };

    const getHeightFast = (gx: number, gy: number): number => {
      const idx = gridIndex(gx, gy);
      if (gridFilled[idx]) return gridHeight[idx];
      const h = getHeight(gx, gy);
      gridHeight[idx] = h;
      gridFilled[idx] = 1;
      return h;
    };

    // Temperature / moisture caches shared across the whole chunk
    const tempCache = new Map<string, number>();
    const moistureCache = new Map<string, number>();

    const getBiomeFast = (gx: number, gy: number, gh: number): number => {
      const idx = gridIndex(gx, gy);
      if (gridFilled[idx]) return gridBiome[idx];
      const b = this.biomeSystem.getBiome(gx, gy, gh, tempCache, moistureCache);
      gridBiome[idx] = b;
      gridFilled[idx] = 1;
      return b;
    };

    // Legacy biomeCache used only to satisfy the API; grid-based lookup is faster
    const biomeCache = new Map<string, number>();

    const enableTiming = this.config.enablePerformanceMetrics;
    let classificationTime = 0;
    let blendingTime = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = y * size + x;
        // Sample height from heightmap (using vertex coordinates)
        const height = heightmap[y * vertexCount + x];

        // Get world position for this tile
        const wx = worldX + x;
        const wy = worldY + y;

        // Use EnhancedBiomeSystem if available (Requirement 2.1), otherwise use BiomeSystem
        if (this.enhancedBiomeSystem) {
          // Get enhanced biome data with transitions and elevation bands
          const t0 = enableTiming ? performance.now() : 0;
          const enhancedData = this.enhancedBiomeSystem.getEnhancedBiome(wx, wy, getHeightFast);
          if (enableTiming) blendingTime += performance.now() - t0;

          biomeMap[index] = enhancedData.biome;

          // Store weights for sparse conversion
          tileWeights.push(enhancedData.weights);

          // Sample local temperature for snow calculations
          const climate = this.enhancedBiomeSystem.sampleClimate(wx, wy, height, getHeightFast);
          temperatureMap[index] = climate ? climate.temperature : 0;
        } else {
          // Use base BiomeSystem (backward compatible)
          const tClass = enableTiming ? performance.now() : 0;
          const biome = getBiomeFast(wx, wy, height);
          if (enableTiming) classificationTime += performance.now() - tClass;

          biomeMap[index] = biome;

          // Cache the centre tile biome so getBiomeWeights doesn't recompute it
          biomeCache.set(`${wx},${wy}`, biome);

          // Get biome blend weights with cross-tile caching
          const tBlend = enableTiming ? performance.now() : 0;
          const weights = this.biomeSystem.getBiomeWeights(wx, wy, getHeightFast, biomeCache);
          if (enableTiming) blendingTime += performance.now() - tBlend;

          // Store weights for sparse conversion
          tileWeights.push(weights);

          // Sample local temperature for snow calculations
          temperatureMap[index] = this.biomeSystem.getTemperature(wx, wy);
        }
      }
    }

    // Convert dense weight maps to sparse representation
    const types: number[] = [];
    const weights: number[] = [];
    const offsets: number[] = [];
    
    for (let i = 0; i < size * size; i++) {
      // Record start offset for this tile
      offsets.push(types.length);
      
      const tileWeightMap = tileWeights[i];
      
      // Add non-zero weights (filter out very small weights to save space)
      for (const [biomeType, weight] of tileWeightMap.entries()) {
        if (weight > 0.001) {  // Threshold to ignore negligible weights
          types.push(biomeType);
          weights.push(weight);
        }
      }
    }

    return { 
      biomeMap, 
      sparseBiomeTypes: new Uint8Array(types),
      sparseBiomeWeights: new Float32Array(weights),
      sparseBiomeOffsets: new Uint16Array(offsets),
      temperatureMap,
      metrics: { classificationTime, blendingTime },
    };
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
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value as string | undefined;

      if (oldestKey) {
        // Notify LakeManager about eviction so it can clean up
        const [evictedChunkX, evictedChunkY] = oldestKey.split(',').map(Number);
        if (this.lakeManager) {
          this.lakeManager.notifyChunkEvicted(evictedChunkX, evictedChunkY);
        }
        this.riverManager?.notifyChunkEvicted(evictedChunkX, evictedChunkY);

        this.cache.delete(oldestKey);
      }
    }

    // Add new entry with incremented counter.
    // Reconcile the new chunk against existing neighbours first, then ask
    // existing neighbours to reconcile themselves against the new chunk.
    this.reconcileBoundaryHeights(chunk);
    this.cache.set(key, {
      chunk,
      lastAccessed: ++this.accessCounter,
    });
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
    const size = chunk.size;
    const vertexSize = size + 1;
    const epsilon = 1e-6;
    const invalidatedNeighbours = new Set<string>();

    const reconcileVertical = (
      neighbourChunk: ChunkData,
      currentX: number,
      neighbourX: number
    ): void => {
      let neighbourNeedsUpdate = false;
      for (let y = 0; y <= size; y++) {
        const currentIndex = y * vertexSize + currentX;
        const neighbourIndex = y * vertexSize + neighbourX;
        const sharedHeight = Math.min(chunk.heightmap[currentIndex], neighbourChunk.heightmap[neighbourIndex]);
        if (Math.abs(chunk.heightmap[currentIndex] - sharedHeight) > epsilon) {
          chunk.heightmap[currentIndex] = sharedHeight;
        }
        // Do NOT mutate the neighbour's heightmap here. Only record that the
        // neighbour needs to be refreshed so it can reconcile itself later.
        if (Math.abs(neighbourChunk.heightmap[neighbourIndex] - sharedHeight) > epsilon) {
          neighbourNeedsUpdate = true;
        }
      }
      if (neighbourNeedsUpdate) {
        invalidatedNeighbours.add(this.getCacheKey(neighbourChunk.x, neighbourChunk.y));
      }
    };

    const reconcileHorizontal = (
      neighbourChunk: ChunkData,
      currentY: number,
      neighbourY: number
    ): void => {
      let neighbourNeedsUpdate = false;
      for (let x = 0; x <= size; x++) {
        const currentIndex = currentY * vertexSize + x;
        const neighbourIndex = neighbourY * vertexSize + x;
        const sharedHeight = Math.min(chunk.heightmap[currentIndex], neighbourChunk.heightmap[neighbourIndex]);
        if (Math.abs(chunk.heightmap[currentIndex] - sharedHeight) > epsilon) {
          chunk.heightmap[currentIndex] = sharedHeight;
        }
        if (Math.abs(neighbourChunk.heightmap[neighbourIndex] - sharedHeight) > epsilon) {
          neighbourNeedsUpdate = true;
        }
      }
      if (neighbourNeedsUpdate) {
        invalidatedNeighbours.add(this.getCacheKey(neighbourChunk.x, neighbourChunk.y));
      }
    };

    const left = this.cache.get(this.getCacheKey(chunk.x - 1, chunk.y))?.chunk;
    if (left) reconcileVertical(left, 0, size);

    const right = this.cache.get(this.getCacheKey(chunk.x + 1, chunk.y))?.chunk;
    if (right) reconcileVertical(right, size, 0);

    const top = this.cache.get(this.getCacheKey(chunk.x, chunk.y - 1))?.chunk;
    if (top) reconcileHorizontal(top, 0, size);

    const bottom = this.cache.get(this.getCacheKey(chunk.x, chunk.y + 1))?.chunk;
    if (bottom) reconcileHorizontal(bottom, size, 0);

    for (const key of invalidatedNeighbours) {
      const [cx, cy] = key.split(',').map(Number);
      this.config.onChunkInvalidated?.(cx, cy);
    }

    // Boundary heights may have dropped below sea level - reclassify affected biomes.
    this.fixBiomesAfterHeightChange(chunk);
  }

  /**
   * After a new chunk has been added to the cache, trigger reconciliation
   * for any already-cached neighbours so they can update their own boundary
   * heights. This complements `reconcileBoundaryHeights` (which is side-effect
   * free w.r.t. neighbours) by explicitly asking each neighbour to reconcile
   * itself against the newly added chunk.
   */
  private reconcileNeighbourBoundaries(chunk: ChunkData): void {
    const left = this.cache.get(this.getCacheKey(chunk.x - 1, chunk.y))?.chunk;
    if (left) this.reconcileBoundaryHeights(left);

    const right = this.cache.get(this.getCacheKey(chunk.x + 1, chunk.y))?.chunk;
    if (right) this.reconcileBoundaryHeights(right);

    const top = this.cache.get(this.getCacheKey(chunk.x, chunk.y - 1))?.chunk;
    if (top) this.reconcileBoundaryHeights(top);

    const bottom = this.cache.get(this.getCacheKey(chunk.x, chunk.y + 1))?.chunk;
    if (bottom) this.reconcileBoundaryHeights(bottom);
  }

  /**
   * Records a modification to a chunk for persistence tracking.
   * Tracks height changes in a sparse map and structure additions/removals.
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param modification - Modification data to record
   * 
   * @remarks
   * This method enables modification tracking for world persistence (Requirement 14.1).
   * Modifications are stored separately from generated data to support delta compression.
   * Multiple modifications to the same chunk are merged into a single record.
   */
  recordModification(chunkX: number, chunkY: number, modification: ChunkModification): void {
    const key = `${chunkX},${chunkY}`;
    
    // Get existing modification record or create new one
    const existing = this.modifications.get(key);
    
    if (existing) {
      // Merge with existing modification
      // Update timestamp to latest
      existing.timestamp = modification.timestamp;
      
      // Merge modifiedTiles sets
      for (const tile of modification.modifiedTiles) {
        existing.modifiedTiles.add(tile);
      }
      
      // Merge heightChanges maps (newer values override older ones)
      for (const [index, height] of modification.heightChanges) {
        existing.heightChanges.set(index, height);
      }
      
      // Merge addedStructures arrays
      existing.addedStructures.push(...modification.addedStructures);
      
      // Merge removedStructures arrays
      existing.removedStructures.push(...modification.removedStructures);
    } else {
      // Create new modification record
      this.modifications.set(key, {
        chunkX,
        chunkY,
        timestamp: modification.timestamp,
        modifiedTiles: new Set(modification.modifiedTiles),
        heightChanges: new Map(modification.heightChanges),
        addedStructures: [...modification.addedStructures],
        removedStructures: [...modification.removedStructures],
      });
    }
  }

  /**
   * Records the addition of a structure to a chunk.
   * Creates a ChunkModification object tracking the added structure.
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param structure - Structure that was added
   * 
   * @remarks
   * This helper method simplifies recording structure additions (Requirement 14.3).
   * The structure's position should be relative to the chunk's origin.
   * 
   * @example
   * ```typescript
   * // Add a village structure at position (5, 10) in chunk (0, 0)
   * const structure = { x: 5, y: 10, type: StructureType.VILLAGE };
   * chunkManager.recordStructureAddition(0, 0, structure);
   * ```
   */
  recordStructureAddition(chunkX: number, chunkY: number, structure: Structure): void {
    const modification: ChunkModification = {
      chunkX,
      chunkY,
      timestamp: Date.now(),
      modifiedTiles: new Set(),
      heightChanges: new Map(),
      addedStructures: [structure],
      removedStructures: [],
    };

    this.recordModification(chunkX, chunkY, modification);
  }

  /**
   * Records the removal of a structure from a chunk.
   * Creates a ChunkModification object tracking the removed structure by its index.
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param structureIndex - Index of the structure in the chunk's structures array
   * 
   * @remarks
   * This helper method simplifies recording structure removals (Requirement 14.3).
   * The structure index refers to the position in the chunk's structures array.
   * 
   * @example
   * ```typescript
   * // Remove the structure at index 2 from chunk (0, 0)
   * chunkManager.recordStructureRemoval(0, 0, 2);
   * ```
   */
  recordStructureRemoval(chunkX: number, chunkY: number, structureIndex: number): void {
    const modification: ChunkModification = {
      chunkX,
      chunkY,
      timestamp: Date.now(),
      modifiedTiles: new Set(),
      heightChanges: new Map(),
      addedStructures: [],
      removedStructures: [structureIndex],
    };

    this.recordModification(chunkX, chunkY, modification);
  }

  /**
   * Records multiple structure changes (additions and removals) in a single operation.
   * Creates a ChunkModification object tracking all structure changes.
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param addedStructures - Array of structures that were added
   * @param removedStructures - Array of structure indices that were removed
   * 
   * @remarks
   * This helper method is more efficient than calling recordStructureAddition and
   * recordStructureRemoval multiple times when making multiple structure changes (Requirement 14.3).
   * 
   * @example
   * ```typescript
   * // Add two structures and remove one in chunk (0, 0)
   * const added = [
   *   { x: 5, y: 10, type: StructureType.VILLAGE },
   *   { x: 15, y: 20, type: StructureType.TOWER },
   * ];
   * const removed = [0]; // Remove structure at index 0
   * chunkManager.recordStructureChanges(0, 0, added, removed);
   * ```
   */
  recordStructureChanges(
    chunkX: number,
    chunkY: number,
    addedStructures: Structure[],
    removedStructures: number[]
  ): void {
    const modification: ChunkModification = {
      chunkX,
      chunkY,
      timestamp: Date.now(),
      modifiedTiles: new Set(),
      heightChanges: new Map(),
      addedStructures: [...addedStructures],
      removedStructures: [...removedStructures],
    };

    this.recordModification(chunkX, chunkY, modification);
  }

  /**
   * Saves the world state to a serialized format.
   * Convenience method that wraps WorldSerializer.serialize().
   * 
   * @param options - Serialization options controlling format, compression, and region
   * @returns Serialized world data ready for storage
   * 
   * @remarks
   * This method provides a convenient way to serialize the entire world state
   * including all cached chunks, configuration, and modifications (Requirements 12.1, 13.1, 15.1).
   * 
   * Supports both JSON and binary formats with optional compression.
   * Can selectively export specific regions or chunks with recorded system deltas.
   * 
   * @example
   * ```typescript
   * // Save entire world in JSON format with compression
   * const serialized = chunkManager.saveWorld({
   *   format: SerializationFormat.JSON,
   *   compress: true,
   *   modifiedOnly: false,
   * });
   * 
   * // Save only chunks with recorded system deltas in a specific region
   * const serialized = chunkManager.saveWorld({
   *   format: SerializationFormat.BINARY,
   *   compress: true,
   *   modifiedOnly: true,
   *   region: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
   * });
   * ```
   */
  saveWorld(options: import('./serialization').SerializationOptions): import('./serialization').SerializedWorld {
    return this.worldSerializer.serialize(this, options);
  }

  /**
   * Loads a previously saved world state.
   * Convenience method that wraps WorldSerializer.deserialize().
   * 
   * @param data - Serialized world data to load
   * 
   * @remarks
   * This method restores a previously serialized world state to the chunk manager
   * (Requirements 12.1, 13.1, 15.1).
   * 
   * Validates version compatibility and checksum before loading.
   * Restores all chunks to the cache and applies recorded modifications.
   * 
   * @throws Error if version is incompatible or checksum validation fails
   * 
   * @example
   * ```typescript
   * // Load a previously saved world
   * const serialized = loadFromStorage(); // Get serialized data from storage
   * chunkManager.loadWorld(serialized);
   * 
   * // Now chunks are restored and can be accessed normally
   * const chunk = chunkManager.getChunk(0, 0);
   * ```
   */
  loadWorld(data: import('./serialization').SerializedWorld): void {
    this.worldSerializer.deserialize(data, this);
  }

  /**
   * Convert world-space lakes to chunk-local lake data.
   * Filters tiles to only include those within the chunk bounds.
   * 
   * @param worldLakes - Lakes in world coordinates
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param chunkSize - Size of the chunk
   * @returns Array of LakeData with chunk-local tile indices
   */
  private convertWorldLakesToChunkLakes(
    worldLakes: WorldLakeData[],
    chunkX: number,
    chunkY: number,
    chunkSize: number,
    heightmap: Float32Array
  ): LakeData[] {
    const chunkWorldX = chunkX * chunkSize;
    const chunkWorldY = chunkY * chunkSize;
    const result: LakeData[] = [];

    for (const worldLake of worldLakes) {
      const chunkTiles = new Set<number>();

      // Convert world tiles to chunk-local tiles
      for (const tileKey of worldLake.tiles) {
        const [worldX, worldY] = tileKey.split(',').map(Number);
        
        // Check if tile is within this chunk
        if (
          worldX >= chunkWorldX &&
          worldX < chunkWorldX + chunkSize &&
          worldY >= chunkWorldY &&
          worldY < chunkWorldY + chunkSize
        ) {
          const localX = worldX - chunkWorldX;
          const localY = worldY - chunkWorldY;
          const localIdx = localY * chunkSize + localX;
          chunkTiles.add(localIdx);
        }
      }

      // Only include lake if it has tiles in this chunk
      if (chunkTiles.size > 0) {
        // Determine lake state based on climate
        const lakeState = this.determineLakeState(worldLake);
        
        const lakeData: LakeData = {
          waterLevel: worldLake.waterLevel,
          tiles: chunkTiles,
          maxDepth: worldLake.maxDepth,
          minTerrainHeight: worldLake.minTerrainHeight,
          state: lakeState,
        };
        
        logger.debug(LogCategory.LAKE, `Converting world lake to chunk (${chunkX}, ${chunkY})`, {
          waterLevel: worldLake.waterLevel,
          minTerrainHeight: worldLake.minTerrainHeight,
          chunkTileCount: chunkTiles.size,
        });
        
        result.push(lakeData);
      }
    }

    return result;
  }

  /**
   * Carve terrain depression for world-space lakes.
   * Works with world coordinates to ensure consistent carving across chunk boundaries.
   * 
   * @param worldLakes - Lakes in world coordinates
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param chunkSize - Size of the chunk
   * @param heightmap - Heightmap to modify
   */
  private carveTerrainForWorldLakes(
    worldLakes: WorldLakeData[],
    chunkX: number,
    chunkY: number,
    chunkSize: number,
    heightmap: Float32Array
  ): void {
    const chunkWorldX = chunkX * chunkSize;
    const chunkWorldY = chunkY * chunkSize;
    const vSize = chunkSize + 1;
    const CARVE_DEPTH = 0.04; // how deep to dig in [0,1] heightmap space

    logger.debug(LogCategory.LAKE, `Carving terrain for chunk (${chunkX}, ${chunkY}), ${worldLakes.length} lake(s)`);

    for (const worldLake of worldLakes) {
      let verticesCarved = 0;
      const targetHeight = Math.max(0, worldLake.waterLevel - CARVE_DEPTH);

      // Carve by world vertex, not by tile corner count. This keeps duplicated
      // boundary vertices identical across neighbouring chunk meshes.
      for (let localY = 0; localY <= chunkSize; localY++) {
        const worldVertexY = chunkWorldY + localY;

        for (let localX = 0; localX <= chunkSize; localX++) {
          const worldVertexX = chunkWorldX + localX;
          const touchesLake =
            worldLake.tiles.has(`${worldVertexX},${worldVertexY}`) ||
            worldLake.tiles.has(`${worldVertexX - 1},${worldVertexY}`) ||
            worldLake.tiles.has(`${worldVertexX},${worldVertexY - 1}`) ||
            worldLake.tiles.has(`${worldVertexX - 1},${worldVertexY - 1}`);

          if (!touchesLake) continue;

          const vi = localY * vSize + localX;
          const carvedHeight = Math.min(heightmap[vi], targetHeight);
          if (carvedHeight < heightmap[vi]) {
            heightmap[vi] = carvedHeight;
            verticesCarved++;
          }
        }
      }
      
      logger.debug(LogCategory.LAKE, `Lake ${worldLake.id}: carved ${verticesCarved} vertices`);
    }
  }

  /**
   * Determines the climate-driven state of a river based on average temperature
   * and moisture along its main path. Requires EnhancedBiomeSystem with ClimateSystem.
   */
  private determineRiverState(river: WorldRiverData): 'flowing' | 'frozen' | 'dry' {
    if (!this.enhancedBiomeSystem) return 'flowing';

    // Sample climate along the main path to get average conditions
    const points = river.mainPath;
    const sampleCount = Math.min(points.length, 12);
    const step = Math.max(1, Math.floor(points.length / sampleCount));
    
    let totalTemp = 0;
    let totalMoisture = 0;
    let sampled = 0;

    for (let i = 0; i < points.length && sampled < sampleCount; i += step) {
      const point = points[i];
      const climate = this.enhancedBiomeSystem.sampleClimate(
        point.x,
        point.y,
        point.height,
        (wx, wy) => this.terrainGenerator.getHeightAt(wx, wy, this.config.seed),
      );
      if (climate) {
        totalTemp += climate.temperature;
        totalMoisture += climate.moisture;
        sampled++;
      }
    }

    if (sampled === 0) return 'flowing';
    
    const avgTemp = totalTemp / sampled;
    const avgMoisture = totalMoisture / sampled;

    if (avgTemp < -0.4) return 'frozen';
    if (avgTemp > 0.4 && avgMoisture < -0.2) return 'dry';
    return 'flowing';
  }

  /**
   * Determines the climate-driven state of a lake based on average temperature
   * across its tiles. Requires EnhancedBiomeSystem with ClimateSystem.
   */
  private determineLakeState(lake: WorldLakeData): 'filled' | 'dry' {
    if (!this.enhancedBiomeSystem) return 'filled';

    // Sample temperature at multiple points across the lake
    const sampleCount = Math.min(lake.tiles.size, 9);
    const tileArray = Array.from(lake.tiles);
    let totalTemp = 0;
    let totalMoisture = 0;
    let sampled = 0;

    const step = Math.max(1, Math.floor(tileArray.length / sampleCount));
    for (let i = 0; i < tileArray.length && sampled < sampleCount; i += step) {
      const [wx, wy] = tileArray[i].split(',').map(Number);
      const height = this.terrainGenerator.getHeightAt(wx, wy, this.config.seed);
      const climate = this.enhancedBiomeSystem.sampleClimate(
        wx,
        wy,
        height,
        (x, y) => this.terrainGenerator.getHeightAt(x, y, this.config.seed),
      );
      if (climate) {
        totalTemp += climate.temperature;
        totalMoisture += climate.moisture;
        sampled++;
      }
    }

    if (sampled === 0) return 'filled';
    const avgTemp = totalTemp / sampled;
    const avgMoisture = totalMoisture / sampled;

    // Lake dries out in hot, dry climates
    if (avgTemp > 0.4 && avgMoisture < -0.2) return 'dry';
    return 'filled';
  }

  private convertWorldRiversToChunkRivers(
    worldRivers: WorldRiverData[],
    chunkX: number,
    chunkY: number,
    chunkSize: number,
    stateMap?: Map<string, 'flowing' | 'frozen' | 'dry'>,
  ): RiverData[] {
    const chunkWorldX = chunkX * chunkSize;
    const chunkWorldY = chunkY * chunkSize;
    const result: RiverData[] = [];

    const convertPath = (
      riverId: string,
      pathId: string,
      isTributary: boolean,
      points: RiverPoint[]
    ): void => {
      const smoothed = createSmoothedRiverPoints(points);
      const selectedRuns: RiverPoint[][] = [];
      let currentRun: RiverPoint[] | null = null;

      const flushCurrentRun = (): void => {
        if (currentRun && currentRun.length >= 2) {
          selectedRuns.push(currentRun);
        }
        currentRun = null;
      };

      for (let i = 0; i < smoothed.length - 1; i++) {
        const a = smoothed[i];
        const b = smoothed[i + 1];
        const valleyRadius = Math.max(getRiverValleyWidth(a), getRiverValleyWidth(b)) * 0.5;
        const segmentMinX = Math.min(a.x, b.x) - valleyRadius;
        const segmentMaxX = Math.max(a.x, b.x) + valleyRadius;
        const segmentMinY = Math.min(a.y, b.y) - valleyRadius;
        const segmentMaxY = Math.max(a.y, b.y) + valleyRadius;
        const intersectsChunk =
          segmentMaxX >= chunkWorldX &&
          segmentMinX <= chunkWorldX + chunkSize &&
          segmentMaxY >= chunkWorldY &&
          segmentMinY <= chunkWorldY + chunkSize;

        if (intersectsChunk) {
          if (!currentRun) {
            currentRun = [a, b];
          } else {
            currentRun.push(b);
          }
        } else {
          flushCurrentRun();
        }
      }

      flushCurrentRun();

      const localRuns = selectedRuns
        .map(run => run.map(point => ({
          ...point,
          x: point.x - chunkWorldX,
          y: point.y - chunkWorldY,
        })))
        .filter(run => run.length >= 2);

      localRuns.forEach((local, index) => {
        const xs = local.map(point => point.x);
        const ys = local.map(point => point.y);
        result.push({
          riverId,
          pathId: localRuns.length === 1 ? pathId : `${pathId}:span${index}`,
          isTributary,
          points: local,
          state: stateMap?.get(riverId),
          bounds: {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
          },
        });
      });
    };

    for (const river of worldRivers) {
      convertPath(river.id, `${river.id}:main`, false, this.extendRiverPathToMouth(river.mainPath, river.mouth));
      for (const tributary of river.tributaries) {
        convertPath(river.id, tributary.id, true, tributary.points);
      }
    }

    return result;
  }

  private extendRiverPathToMouth(
    points: RiverPoint[],
    mouth: { x: number; y: number }
  ): RiverPoint[] {
    if (points.length === 0) return points;

    const last = points[points.length - 1];
    const toMouthX = mouth.x - last.x;
    const toMouthY = mouth.y - last.y;
    const toMouthLength = Math.hypot(toMouthX, toMouthY);

    if (toMouthLength < 0.001) {
      return points;
    }

    return [
      ...points,
      {
        ...last,
        x: mouth.x,
        y: mouth.y,
        height: Math.min(last.height, SEA_LEVEL),
        surfaceLevel: SEA_LEVEL,
        flowX: toMouthX,
        flowY: toMouthY,
      },
    ];
  }

  private carveTerrainForRivers(
    rivers: RiverData[],
    heightmap: Float32Array,
    chunkSize: number
  ): void {
    const vertexSize = chunkSize + 1;

    for (const river of rivers) {
      const points = river.points;
      const maxValleyRadius = points.reduce(
        (max, point) => Math.max(max, getRiverValleyWidth(point) * 0.5),
        this.config.riverConfig?.carveBankWidth ?? DEFAULT_RIVER_CONFIG.carveBankWidth
      );
      const minPointX = Math.min(...points.map(point => point.x));
      const maxPointX = Math.max(...points.map(point => point.x));
      const minPointY = Math.min(...points.map(point => point.y));
      const maxPointY = Math.max(...points.map(point => point.y));
      const minX = Math.max(0, Math.floor(minPointX - maxValleyRadius));
      const maxX = Math.min(chunkSize, Math.ceil(maxPointX + maxValleyRadius));
      const minY = Math.max(0, Math.floor(minPointY - maxValleyRadius));
      const maxY = Math.min(chunkSize, Math.ceil(maxPointY + maxValleyRadius));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const sample = this.closestRiverSample(x, y, points, RIVER_TERMINAL_CARVE_EXTENSION);
          if (!sample) continue;

          const rawChannelRadius = Math.max(getRiverChannelWidth(sample) * 0.5, 0);
          const channelRadius = rawChannelRadius > 0
            ? Math.max(rawChannelRadius, RIVER_MIN_CHANNEL_CARVE_RADIUS)
            : 0;
          const valleyRadius = Math.max(
            getRiverValleyWidth(sample) * 0.5 + (rawChannelRadius > 0 ? RIVER_VALLEY_PROFILE_PADDING : 0),
            channelRadius,
          );
          if (sample.distance > valleyRadius) continue;

          const index = y * vertexSize + x;
          if (heightmap[index] < SEA_LEVEL) continue;

          let target: number;
          const mouthT = Math.min(Math.max((sample.surfaceLevel - SEA_LEVEL) / RIVER_MOUTH_TAPER_HEIGHT, 0), 1);
          const mouthDepthScale = mouthT * mouthT * (3 - 2 * mouthT);

          if (channelRadius > 0) {
            const channelTarget = Math.max(0, sample.surfaceLevel - getRiverChannelDepth(sample) * mouthDepthScale);
            const bankDepth = Math.min(getRiverChannelDepth(sample) * 0.6, getRiverValleyDepth(sample) * 1.2);
            const bankTarget = Math.max(0, sample.surfaceLevel - bankDepth * mouthDepthScale);
            target = this.calculateRiverChannelProfileHeight(
              heightmap[index],
              sample.distance,
              channelRadius,
              valleyRadius,
              channelTarget,
              bankTarget,
            );
          } else if (channelRadius === 0 && sample.distance === 0) {
            target = Math.max(0, sample.surfaceLevel - getRiverChannelDepth(sample) * mouthDepthScale);
          } else {
            const valleyT = 1 - Math.min(sample.distance / valleyRadius, 1);
            const valleyFalloff = valleyT * valleyT * (3 - 2 * valleyT);
            const valleyTarget = Math.max(0, sample.surfaceLevel - getRiverValleyDepth(sample) * mouthDepthScale);
            target = heightmap[index] * (1 - valleyFalloff) + valleyTarget * valleyFalloff;
          }

          if (heightmap[index] < SEA_LEVEL + RIVER_MOUTH_TAPER_HEIGHT) {
            const coastalT = Math.min(Math.max((heightmap[index] - SEA_LEVEL) / RIVER_MOUTH_TAPER_HEIGHT, 0), 1);
            const coastalDepthScale = coastalT * coastalT * (3 - 2 * coastalT);
            const coastalFloor = SEA_LEVEL - RIVER_MOUTH_MAX_BELOW_SEA_DEPTH * coastalDepthScale;
            target = Math.max(target, coastalFloor);
          }

          heightmap[index] = Math.min(heightmap[index], target);
        }
      }
    }
  }

  private closestRiverSample(
    x: number,
    y: number,
    points: RiverPoint[],
    terminalExtension = 0
  ): (RiverPoint & { distance: number }) | null {
    if (points.length < 2) return null;

    let best: (RiverPoint & { distance: number }) | null = null;

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const lenSq = vx * vx + vy * vy || 1;
      const length = Math.sqrt(lenSq);
      const maxT = i === points.length - 2 ? 1 + terminalExtension / length : 1;
      const t = Math.max(0, Math.min(maxT, ((x - a.x) * vx + (y - a.y) * vy) / lenSq));
      const attributeT = Math.min(t, 1);
      const px = a.x + vx * t;
      const py = a.y + vy * t;
      const distance = Math.hypot(x - px, y - py);
      const sample = {
        ...a,
        x: px,
        y: py,
        height: a.height + (b.height - a.height) * attributeT,
        surfaceLevel: a.surfaceLevel + (b.surfaceLevel - a.surfaceLevel) * attributeT,
        depth: a.depth + (b.depth - a.depth) * attributeT,
        width: a.width + (b.width - a.width) * attributeT,
        flow: this.interpolateOptional(a.flow, b.flow, attributeT),
        channelWidth: this.interpolateOptional(a.channelWidth, b.channelWidth, attributeT),
        valleyWidth: this.interpolateOptional(a.valleyWidth, b.valleyWidth, attributeT),
        channelDepth: this.interpolateOptional(a.channelDepth, b.channelDepth, attributeT),
        valleyDepth: this.interpolateOptional(a.valleyDepth, b.valleyDepth, attributeT),
        flowX: a.flowX + (b.flowX - a.flowX) * attributeT,
        flowY: a.flowY + (b.flowY - a.flowY) * attributeT,
        distance,
      };

      if (!best || sample.distance < best.distance) {
        best = sample;
      }
    }

    return best;
  }

  private calculateRiverChannelProfileHeight(
    originalHeight: number,
    distance: number,
    channelRadius: number,
    valleyRadius: number,
    channelTarget: number,
    bankTarget: number,
  ): number {
    if (valleyRadius <= 0) return originalHeight;

    if (channelRadius >= valleyRadius - 1e-6) {
      const t = this.smoothStep(Math.min(Math.max(distance / valleyRadius, 0), 1));
      return channelTarget * (1 - t) + originalHeight * t;
    }

    const floorRadius = Math.min(
      Math.max(channelRadius * 0.35, RIVER_MIN_CHANNEL_FLOOR_RADIUS),
      channelRadius * 0.7,
    );
    if (distance <= floorRadius) {
      return channelTarget;
    }

    if (distance <= channelRadius) {
      const channelWallT = this.smoothStep(
        Math.min(Math.max((distance - floorRadius) / (channelRadius - floorRadius), 0), 1),
      );
      return channelTarget * (1 - channelWallT) + bankTarget * channelWallT;
    }

    const outerT = Math.min(Math.max((distance - channelRadius) / (valleyRadius - channelRadius), 0), 1);
    return bankTarget * (1 - outerT) + originalHeight * outerT;
  }

  private smoothStep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  private interpolateOptional(a: number | undefined, b: number | undefined, t: number): number | undefined {
    if (!Number.isFinite(a) && !Number.isFinite(b)) return undefined;
    const start = Number.isFinite(a) ? (a as number) : (b as number);
    const end = Number.isFinite(b) ? (b as number) : start;
    return start + (end - start) * t;
  }

  /**
   * Exports the world state to a file-compatible format.
   * Convenience method that wraps WorldSerializer.export().
   * 
   * @param options - Serialization options controlling format, compression, and region
   * @returns Blob (for binary format) or string (for JSON format) ready for file export
   * 
   * @remarks
   * This method provides a convenient way to export world data for file storage
   * or transfer to external tools (Requirements 12.1, 13.1, 15.1).
   * 
   * JSON format returns a formatted string suitable for text files.
   * Binary format returns a Blob suitable for binary file download.
   * 
   * Includes format version metadata and integrity checksums.
   * 
   * @example
   * ```typescript
   * // Export world as JSON file
   * const jsonString = chunkManager.exportWorld({
   *   format: SerializationFormat.JSON,
   *   compress: true,
   *   modifiedOnly: false,
   * });
   * // Save jsonString to file
   * 
   * // Export world as binary file
   * const blob = chunkManager.exportWorld({
   *   format: SerializationFormat.BINARY,
   *   compress: true,
   *   modifiedOnly: false,
   * });
   * // Create download link with blob
   * ```
   */
  exportWorld(options: import('./serialization').SerializationOptions): Blob | string {
    return this.worldSerializer.export(this, options);
  }
}
