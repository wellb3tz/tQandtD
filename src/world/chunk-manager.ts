import { ChunkData, Structure } from './chunk';
import { BiomeSystem, BiomeConfig } from './biome';
import { TerrainGenerator, TerrainConfig } from '../gen/terrain';
import { ResourceGenerator, ResourceConfig } from '../gen/resources';
import { StructurePlacer, StructureConfig } from '../gen/structures';
import { LakeConfig, DEFAULT_LAKE_CONFIG, LakeData } from '../gen/lakes';
import { chunkSeed } from '../core/hash';
import { ChunkModification, WorldSerializer, ChunkManagerSnapshot } from './serialization';
import { NoiseEngine, NoiseConfig } from '../core/noise';
import { EnhancedBiomeConfig, EnhancedBiomeSystem } from './enhanced-biome';
import { WorkerPoolConfig, WorkerPool, WorkerTask } from './worker-pool';
import { LakeManager, WorldLakeData } from './lake-manager';
import { validateWorldConfig } from '../utils/validation';
import {
  ChunkGenerationError,
  TerrainGenerationError,
  BiomeGenerationError,
  LakeGenerationError,
  ResourceGenerationError,
  StructureGenerationError,
  ErrorRecoveryOptions,
  DEFAULT_ERROR_RECOVERY,
} from '../utils/errors';
import { logger, LogCategory } from '../utils/logger';

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
 * Configuration for world generation
 */
export interface WorldConfig {
  /** World seed for deterministic generation */
  seed: number;
  /** Size of each chunk (width and height) */
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
  /** Worker pool configuration (optional) */
  workerPoolConfig?: WorkerPoolConfig;
  /** Maximum number of chunks to cache (default: 100) */
  maxCacheSize?: number;
  /** Enable performance timing measurements (default: false) */
  enablePerformanceMetrics?: boolean;
  /** Progress callback for long-running operations */
  onProgress?: ProgressCallback;
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
  /** @internal exposed for WorkerPool shutdown in DemoApp */ workerPool: WorkerPool | null;
  private worldSerializer: WorldSerializer;
  /** Satisfies ChunkManagerSnapshot — readable by WorldSerializer */ readonly cache: Map<string, CacheEntry>;
  private maxCacheSize: number;
  /** Satisfies ChunkManagerSnapshot — mutated by WorldSerializer.addChunkToCache */ accessCounter: number;
  /** Satisfies ChunkManagerSnapshot — readable by WorldSerializer */ readonly modifications: Map<string, ChunkModification>;
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
    this.lakeManager = lakeConfig.enabled ? new LakeManager(
      config.seed,
      lakeConfig,
      (worldX: number, worldY: number) => this.terrainGenerator.getHeightAt(worldX, worldY, config.seed),
      (worldX: number, worldY: number) => {
        const height = this.terrainGenerator.getHeightAt(worldX, worldY, config.seed);
        return this.biomeSystem.getBiome(worldX, worldY, height);
      }
    ) : null;
    
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
  async getChunk(chunkX: number, chunkY: number): Promise<ChunkData> {
    const key = this.getCacheKey(chunkX, chunkY);
    
    // Check cache
    const cached = this.cache.get(key);
    if (cached) {
      cached.lastAccessed = ++this.accessCounter;
      this.cacheHits++;
      return cached.chunk;
    }

    // If a generation for this chunk is already in-flight, reuse that promise
    const inFlight = this.inFlightRequests.get(key);
    if (inFlight) {
      this.cacheHits++;
      return inFlight;
    }

    // Cache miss — start generation
    this.cacheMisses++;

    // Decide generation strategy based on worker pool availability
    const generationPromise: Promise<ChunkData> = (async () => {
      logger.debug(LogCategory.CHUNK, `Starting generation for chunk (${chunkX}, ${chunkY})`);
      let chunk: ChunkData;
      if (this.workerPool) {
        chunk = await this.generateChunkAsync(chunkX, chunkY);
      } else {
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
   * @returns Promise resolving to the generated chunk data
   */
  private generateChunkAsync(chunkX: number, chunkY: number): Promise<ChunkData> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: '', // Will be assigned by submitTask
        chunkX,
        chunkY,
        lodLevel: 0, // Always generate at full resolution
        priority: 0, // Default priority
        onComplete: (chunk: ChunkData) => {
          resolve(chunk);
        },
        onError: (error: Error) => {
          // Fallback to synchronous generation on error
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
      return this.generateChunkInternal(chunkX, chunkY);
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
   * Internal chunk generation with granular error handling
   */
  private generateChunkInternal(chunkX: number, chunkY: number): ChunkData {
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
    let microBiomeMap: Uint8Array | undefined;
    
    try {
      this.config.onProgress?.('biomes', 0.4);
      const biomeStart = this.config.enablePerformanceMetrics ? performance.now() : 0;
      
      const biomeData = this.generateBiomeData(chunkX, chunkY, heightmap);
      biomeMap = biomeData.biomeMap;
      sparseBiomeTypes = biomeData.sparseBiomeTypes;
      sparseBiomeWeights = biomeData.sparseBiomeWeights;
      sparseBiomeOffsets = biomeData.sparseBiomeOffsets;
      microBiomeMap = biomeData.microBiomeMap;
      
      if (this.config.enablePerformanceMetrics) {
        metrics.biomeTime = performance.now() - biomeStart;
      }

      // Validate biome data
      if (!biomeMap || biomeMap.length === 0) {
        throw new Error('Generated biome map is empty');
      }
    } catch (error) {
      throw new BiomeGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
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
      microBiomeMap,
      lakes: [],
      resources: [],
      structures: [],
    };

    // Step 3: Generate lakes using multi-chunk lake manager
    try {
      this.config.onProgress?.('lakes', 0.55);
      
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
          }
        );
        
        chunk.lakes = this.convertWorldLakesToChunkLakes(worldLakes, chunkX, chunkY, this.config.chunkSize, heightmap);
        
        if (worldLakes.length > 0) {
          this.carveTerrainForWorldLakes(worldLakes, chunkX, chunkY, this.config.chunkSize, heightmap);
        }
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

    // Step 4: Generate resources based on biomes and noise
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

    // Step 5: Generate structures using Poisson Disk Sampling
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

    return chunk;
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
    microBiomeMap?: Uint8Array;
  } {
    const size = this.config.chunkSize;
    const biomeMap = new Uint8Array(size * size);

    // Initialize micro-biome map if enhanced biome system is available
    const microBiomeMap = this.enhancedBiomeSystem ? new Uint8Array(size * size).fill(255) : undefined;

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
          // Get enhanced biome data with transitions and micro-biomes
          const enhancedData = this.enhancedBiomeSystem.getEnhancedBiome(wx, wy, getHeight);
          biomeMap[index] = enhancedData.biome;
          
          // Store micro-biome data if present
          if (microBiomeMap && enhancedData.microBiome !== undefined) {
            microBiomeMap[index] = enhancedData.microBiome;
          }
          
          // Store weights for sparse conversion
          tileWeights.push(enhancedData.weights);
        } else {
          // Use base BiomeSystem (backward compatible)
          const biome = this.biomeSystem.getBiome(wx, wy, height);
          biomeMap[index] = biome;

          // Get biome blend weights
          const weights = this.biomeSystem.getBiomeWeights(wx, wy, getHeight);
          
          // Store weights for sparse conversion
          tileWeights.push(weights);
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
      microBiomeMap 
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
    
    // If cache is full, evict least recently used entry
    if (this.cache.size >= this.maxCacheSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, entry] of this.cache.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        // Notify LakeManager about eviction so it can clean up
        const [evictedChunkX, evictedChunkY] = oldestKey.split(',').map(Number);
        if (this.lakeManager) {
          this.lakeManager.notifyChunkEvicted(evictedChunkX, evictedChunkY);
        }
        
        this.cache.delete(oldestKey);
      }
    }

    // Add new entry with incremented counter
    this.cache.set(key, {
      chunk,
      lastAccessed: ++this.accessCounter,
    });
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
   * Records terrain height modifications for a chunk.
   * Creates a ChunkModification object tracking height changes at specific tile indices.
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param tileIndex - Flat index of the modified tile within the chunk
   * @param newHeight - New height value for the tile
   * 
   * @remarks
   * This helper method simplifies recording terrain edits (Requirement 14.2).
   * Multiple terrain edits can be batched by calling this method multiple times
   * before the modifications are serialized.
   * 
   * @example
   * ```typescript
   * // Edit terrain at tile (5, 10) in chunk (0, 0)
   * const tileIndex = 10 * chunkSize + 5;
   * chunkManager.recordTerrainEdit(0, 0, tileIndex, 0.75);
   * ```
   */
  recordTerrainEdit(chunkX: number, chunkY: number, tileIndex: number, newHeight: number): void {
    const modification: ChunkModification = {
      chunkX,
      chunkY,
      timestamp: Date.now(),
      modifiedTiles: new Set([tileIndex]),
      heightChanges: new Map([[tileIndex, newHeight]]),
      addedStructures: [],
      removedStructures: [],
    };

    this.recordModification(chunkX, chunkY, modification);
  }

  /**
   * Records multiple terrain height modifications for a chunk in a single operation.
   * Creates a ChunkModification object tracking multiple height changes.
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param heightChanges - Map of tile indices to new height values
   * 
   * @remarks
   * This helper method is more efficient than calling recordTerrainEdit multiple times
   * when editing multiple tiles at once (Requirement 14.2).
   * 
   * @example
   * ```typescript
   * // Edit multiple terrain tiles in chunk (0, 0)
   * const changes = new Map([
   *   [10, 0.75],  // tile 10 -> height 0.75
   *   [11, 0.80],  // tile 11 -> height 0.80
   *   [20, 0.65],  // tile 20 -> height 0.65
   * ]);
   * chunkManager.recordTerrainEdits(0, 0, changes);
   * ```
   */
  recordTerrainEdits(chunkX: number, chunkY: number, heightChanges: Map<number, number>): void {
    const modification: ChunkModification = {
      chunkX,
      chunkY,
      timestamp: Date.now(),
      modifiedTiles: new Set(heightChanges.keys()),
      heightChanges: new Map(heightChanges),
      addedStructures: [],
      removedStructures: [],
    };

    this.recordModification(chunkX, chunkY, modification);
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
   * Can selectively export specific regions or only modified chunks.
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
   * // Save only modified chunks in a specific region
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
    const vertexSize = chunkSize + 1;
    const result: LakeData[] = [];

    // Helper: average height of tile (localX, localY) using chunk heightmap
    const tileHeight = (localX: number, localY: number): number => {
      const v00 = heightmap[localY * vertexSize + localX];
      const v10 = heightmap[localY * vertexSize + (localX + 1)];
      const v01 = heightmap[(localY + 1) * vertexSize + localX];
      const v11 = heightmap[(localY + 1) * vertexSize + (localX + 1)];
      return (v00 + v10 + v01 + v11) * 0.25;
    };

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

      // Add boundary tiles: for lake tiles in adjacent chunks that share a vertex
      // with this chunk's edge, add the corresponding edge tile of this chunk if it
      // is below the water level.  This closes the gap that appears when a lake ends
      // exactly on a chunk boundary.
      for (const tileKey of worldLake.tiles) {
        const [worldX, worldY] = tileKey.split(',').map(Number);

        // Tile is just outside this chunk on the right edge
        if (worldX === chunkWorldX + chunkSize &&
            worldY >= chunkWorldY && worldY < chunkWorldY + chunkSize) {
          const localX = chunkSize - 1;
          const localY = worldY - chunkWorldY;
          const localIdx = localY * chunkSize + localX;
          if (!chunkTiles.has(localIdx) && tileHeight(localX, localY) < worldLake.waterLevel) {
            chunkTiles.add(localIdx);
          }
        }

        // Tile is just outside this chunk on the bottom edge
        if (worldY === chunkWorldY + chunkSize &&
            worldX >= chunkWorldX && worldX < chunkWorldX + chunkSize) {
          const localX = worldX - chunkWorldX;
          const localY = chunkSize - 1;
          const localIdx = localY * chunkSize + localX;
          if (!chunkTiles.has(localIdx) && tileHeight(localX, localY) < worldLake.waterLevel) {
            chunkTiles.add(localIdx);
          }
        }

        // Tile is just outside this chunk on the left edge
        if (worldX === chunkWorldX - 1 &&
            worldY >= chunkWorldY && worldY < chunkWorldY + chunkSize) {
          const localX = 0;
          const localY = worldY - chunkWorldY;
          const localIdx = localY * chunkSize + localX;
          if (!chunkTiles.has(localIdx) && tileHeight(localX, localY) < worldLake.waterLevel) {
            chunkTiles.add(localIdx);
          }
        }

        // Tile is just outside this chunk on the top edge
        if (worldY === chunkWorldY - 1 &&
            worldX >= chunkWorldX && worldX < chunkWorldX + chunkSize) {
          const localX = worldX - chunkWorldX;
          const localY = 0;
          const localIdx = localY * chunkSize + localX;
          if (!chunkTiles.has(localIdx) && tileHeight(localX, localY) < worldLake.waterLevel) {
            chunkTiles.add(localIdx);
          }
        }
      }

      // Only include lake if it has tiles in this chunk
      if (chunkTiles.size > 0) {
        const lakeData = {
          waterLevel: worldLake.waterLevel,
          tiles: chunkTiles,
          maxDepth: worldLake.maxDepth,
          minTerrainHeight: worldLake.minTerrainHeight,
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
    const CARVE_DEPTH = 0.02; // how deep to dig in [0,1] heightmap space

    logger.debug(LogCategory.LAKE, `Carving terrain for chunk (${chunkX}, ${chunkY}), ${worldLakes.length} lake(s)`);

    for (const worldLake of worldLakes) {
      let verticesCarved = 0;
      let verticesSkipped = 0;
      
      // Process each tile in the lake
      for (const tileKey of worldLake.tiles) {
        const [worldTileX, worldTileY] = tileKey.split(',').map(Number);
        
        // Check if this tile affects the current chunk's vertices
        // A tile affects vertices from (tileX, tileY) to (tileX+1, tileY+1)
        for (let dv = 0; dv <= 1; dv++) {
          for (let du = 0; du <= 1; du++) {
            const worldVertexX = worldTileX + du;
            const worldVertexY = worldTileY + dv;
            
            // Convert to chunk-local vertex coordinates
            const localVertexX = worldVertexX - chunkWorldX;
            const localVertexY = worldVertexY - chunkWorldY;
            
            // Check if vertex is within this chunk's heightmap bounds
            if (
              localVertexX >= 0 && localVertexX <= chunkSize &&
              localVertexY >= 0 && localVertexY <= chunkSize
            ) {
              const vi = localVertexY * vSize + localVertexX;
              heightmap[vi] = Math.max(0, heightmap[vi] - CARVE_DEPTH);
              verticesCarved++;
            } else {
              verticesSkipped++;
            }
          }
        }
      }
      
      logger.debug(LogCategory.LAKE, `Lake ${worldLake.id}: carved ${verticesCarved} vertices, skipped ${verticesSkipped} (outside chunk)`);
    }
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
