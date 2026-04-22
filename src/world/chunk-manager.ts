import { ChunkData, PartialChunkData, IncrementalConfig, Structure } from './chunk';
import { BiomeSystem, BiomeConfig } from './biome';
import { TerrainGenerator, TerrainConfig } from '../gen/terrain';
import { ResourceGenerator, ResourceConfig } from '../gen/resources';
import { StructurePlacer, StructureConfig } from '../gen/structures';
import { chunkSeed } from '../core/hash';
import { LODManager, LODConfig, LODLevel } from './lod';
import { IncrementalGenerator } from './incremental-generator';
import { ChunkModification, WorldSerializer } from './serialization';
import { NoiseEngine, NoiseConfig } from '../core/noise';
import { EnhancedBiomeConfig, EnhancedBiomeSystem } from './enhanced-biome';
import { WorkerPoolConfig, WorkerPool, WorkerTask } from './worker-pool';

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
  /** Worker pool configuration (optional) */
  workerPoolConfig?: WorkerPoolConfig;
  /** LOD configuration (optional) */
  lodConfig?: LODConfig;
  /** Incremental generation configuration (optional) */
  incrementalConfig?: IncrementalConfig;
  /** Maximum number of chunks to cache (default: 100) */
  maxCacheSize?: number;
  /** Enable performance timing measurements (default: false) */
  enablePerformanceMetrics?: boolean;
  /** Progress callback for long-running operations */
  onProgress?: ProgressCallback;
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
 * Orchestrates all generators to create complete chunks with terrain, biomes, resources, structures, and rivers.
 */
export class ChunkManager {
  private config: WorldConfig;
  private terrainGenerator: TerrainGenerator;
  private biomeSystem: BiomeSystem;
  private resourceGenerator: ResourceGenerator;
  private structurePlacer: StructurePlacer;
  private noiseEngine3D: NoiseEngine | null;
  private enhancedBiomeSystem: EnhancedBiomeSystem | null;
  private workerPool: WorkerPool | null;
  private lodManager: LODManager | null;
  private incrementalGenerator: IncrementalGenerator | null;
  private worldSerializer: WorldSerializer;
  private cache: Map<string, CacheEntry>;
  private maxCacheSize: number;
  private accessCounter: number;
  private modifications: Map<string, ChunkModification>;
  private cacheHits: number;
  private cacheMisses: number;

  /**
   * Creates a new ChunkManager with the given configuration.
   * @param config - World generation configuration
   */
  constructor(config: WorldConfig) {
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
    
    // Initialize WorkerPool if multi-threading is enabled (Requirement 9.1)
    this.workerPool = config.workerPoolConfig
      ? new WorkerPool({
          ...config.workerPoolConfig,
          worldConfig: config,
        })
      : null;
    
    // Initialize LODManager if LOD is enabled (Requirement 10.1)
    this.lodManager = config.lodConfig ? new LODManager(config.lodConfig) : null;
    
    // Initialize IncrementalGenerator if incremental generation is enabled (Requirement 11.1)
    this.incrementalGenerator = config.incrementalConfig?.enabled
      ? new IncrementalGenerator(
          config.incrementalConfig,
          config,
          this.terrainGenerator,
          this.biomeSystem,
          this.resourceGenerator,
          this.structurePlacer
        )
      : null;
    
    // Initialize WorldSerializer (always initialized for serialization support) (Requirement 12.1)
    this.worldSerializer = new WorldSerializer();
    
    this.cache = new Map();
    this.maxCacheSize = config.maxCacheSize ?? 100;
    this.accessCounter = 0;
    this.modifications = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Gets a chunk at the specified coordinates, using cache if available.
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param lodLevel - LOD level for the chunk (default: HIGH)
   * @returns Promise resolving to the chunk data at the specified coordinates
   */
  async getChunk(chunkX: number, chunkY: number, lodLevel: LODLevel = LODLevel.HIGH): Promise<ChunkData> {
    const key = this.getCacheKey(chunkX, chunkY, lodLevel);
    
    // Check cache
    const cached = this.cache.get(key);
    if (cached) {
      cached.lastAccessed = ++this.accessCounter;
      this.cacheHits++;
      return cached.chunk;
    }

    // Cache miss
    this.cacheMisses++;

    // Decide generation strategy based on worker pool availability
    let chunk: ChunkData;
    
    if (this.workerPool) {
      // Asynchronous generation via worker pool
      chunk = await this.generateChunkAsync(chunkX, chunkY);
    } else {
      // Synchronous generation on main thread
      chunk = this.generateChunk(chunkX, chunkY);
    }

    // Apply LOD if LODManager is configured and LOD level is not HIGH
    const lodChunk = this.lodManager && lodLevel !== LODLevel.HIGH
      ? this.lodManager.applyLOD(chunk, lodLevel)
      : chunk;

    // Add to cache with LRU eviction
    this.addToCache(key, lodChunk);

    return lodChunk;
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
        lodLevel: LODLevel.HIGH, // Always generate at full resolution
        priority: 0, // Default priority
        onComplete: (chunk: ChunkData) => {
          resolve(chunk);
        },
        onError: (error: Error) => {
          // Fallback to synchronous generation on error
          console.warn(`Worker generation failed for chunk (${chunkX}, ${chunkY}), falling back to sync:`, error);
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
   * Gets a chunk using incremental generation, allowing access to partial data.
   * Returns a PartialChunkData object that updates as generation progresses.
   * Call continueGeneration() repeatedly until complete.
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns Partial chunk data that updates as generation progresses
   * @throws Error if incremental generation is not enabled
   */
  getChunkIncremental(chunkX: number, chunkY: number): PartialChunkData {
    if (!this.incrementalGenerator) {
      throw new Error('Incremental generation is not enabled. Set incrementalConfig.enabled to true in WorldConfig.');
    }

    // Start or get existing incremental generation
    return this.incrementalGenerator.startGeneration(chunkX, chunkY);
  }

  /**
   * Continues incremental generation for a chunk.
   * Call repeatedly until it returns true (generation complete).
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns True if generation is complete, false if more work remains
   * @throws Error if incremental generation is not enabled or not started
   */
  continueGeneration(chunkX: number, chunkY: number): boolean {
    if (!this.incrementalGenerator) {
      throw new Error('Incremental generation is not enabled. Set incrementalConfig.enabled to true in WorldConfig.');
    }

    return this.incrementalGenerator.continueGeneration(chunkX, chunkY);
  }

  /**
   * Gets the current generation stage for a chunk.
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns Current generation stage or undefined if not generating
   */
  getGenerationStage(chunkX: number, chunkY: number): number | undefined {
    if (!this.incrementalGenerator) {
      return undefined;
    }

    return this.incrementalGenerator.getStage(chunkX, chunkY);
  }

  /**
   * Cancels incremental generation for a chunk.
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   */
  cancelIncrementalGeneration(chunkX: number, chunkY: number): void {
    if (this.incrementalGenerator) {
      this.incrementalGenerator.cancelGeneration(chunkX, chunkY);
    }
  }

  /**
   * Generates a chunk at the specified coordinates without caching.
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns The generated chunk data
   */
  generateChunk(chunkX: number, chunkY: number): ChunkData {
    const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
    const metrics: Partial<ChunkPerformanceMetrics> = {};

    // Compute unique seed for this chunk
    const seed = chunkSeed(this.config.seed, chunkX, chunkY);

    // Step 1: Generate heightmap using terrain generator
    this.config.onProgress?.('terrain', 0.2);
    const terrainStart = this.config.enablePerformanceMetrics ? performance.now() : 0;
    // Use 3D noise if noiseEngine3D is available (Requirement 1.3)
    // Pass world seed (not chunk seed) to ensure seamless boundaries across chunks
    const heightmap = this.noiseEngine3D
      ? this.terrainGenerator.generateHeightmap(this.config.seed, this.config.chunkSize, chunkX, chunkY, this.noiseEngine3D)
      : this.terrainGenerator.generateHeightmap(this.config.seed, this.config.chunkSize, chunkX, chunkY);
    if (this.config.enablePerformanceMetrics) {
      metrics.terrainTime = performance.now() - terrainStart;
    }

    // Step 2: Generate biome data
    this.config.onProgress?.('biomes', 0.4);
    const biomeStart = this.config.enablePerformanceMetrics ? performance.now() : 0;
    const { biomeMap, biomeWeights } = this.generateBiomeData(chunkX, chunkY, heightmap);
    if (this.config.enablePerformanceMetrics) {
      metrics.biomeTime = performance.now() - biomeStart;
    }

    // Initialize chunk data with terrain and biomes
    const chunk: ChunkData = {
      x: chunkX,
      y: chunkY,
      size: this.config.chunkSize,
      heightmap,
      biomeMap,
      biomeWeights,
      resources: [],
      structures: [],
      rivers: new Set<number>(),
    };

    // Step 3: Generate resources based on biomes and noise
    this.config.onProgress?.('resources', 0.6);
    const resourceStart = this.config.enablePerformanceMetrics ? performance.now() : 0;
    chunk.resources = this.resourceGenerator.generateResources(chunk, seed);
    if (this.config.enablePerformanceMetrics) {
      metrics.resourceTime = performance.now() - resourceStart;
    }

    // Step 4: Generate structures using Poisson Disk Sampling
    this.config.onProgress?.('structures', 0.8);
    const structureStart = this.config.enablePerformanceMetrics ? performance.now() : 0;
    chunk.structures = this.structurePlacer.generateStructures(chunk, seed);
    if (this.config.enablePerformanceMetrics) {
      metrics.structureTime = performance.now() - structureStart;
    }

    this.config.onProgress?.('complete', 1.0);

    // Log performance metrics if enabled
    if (this.config.enablePerformanceMetrics) {
      metrics.totalTime = performance.now() - startTime;
      // Only log if total time is unusually high (> 100ms)
      if (metrics.totalTime > 100) {
        console.log(`Chunk (${chunkX}, ${chunkY}) generation metrics:`, metrics);
      }
    }

    return chunk;
  }

  /**
   * Clears all cached chunks.
   */
  clearCache(): void {
    this.cache.clear();
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
  ): { biomeMap: Uint8Array; biomeWeights: Float32Array } {
    const size = this.config.chunkSize;
    const biomeMap = new Uint8Array(size * size);
    
    // Calculate number of biome types for weights array
    const numBiomes = 8; // BiomeType enum has 8 values (0-7)
    const biomeWeights = new Float32Array(size * size * numBiomes);

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
          
          // Store weights from enhanced biome data
          const weightOffset = index * numBiomes;
          for (let b = 0; b < numBiomes; b++) {
            biomeWeights[weightOffset + b] = enhancedData.weights.get(b) || 0;
          }
        } else {
          // Use base BiomeSystem (backward compatible)
          const biome = this.biomeSystem.getBiome(wx, wy, height);
          biomeMap[index] = biome;

          // Get biome blend weights
          const weights = this.biomeSystem.getBiomeWeights(wx, wy, getHeight);
          
          // Store weights in the array
          const weightOffset = index * numBiomes;
          for (let b = 0; b < numBiomes; b++) {
            biomeWeights[weightOffset + b] = weights.get(b) || 0;
          }
        }
      }
    }

    return { biomeMap, biomeWeights };
  }

  /**
   * Generates a cache key for chunk coordinates and LOD level.
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param lodLevel - LOD level (default: HIGH)
   * @returns Cache key string
   */
  private getCacheKey(chunkX: number, chunkY: number, lodLevel: LODLevel = LODLevel.HIGH): string {
    return `${chunkX},${chunkY},${lodLevel}`;
  }

  /**
   * Adds a chunk to the cache with LRU eviction.
   * @param key - Cache key
   * @param chunk - Chunk data to cache
   */
  private addToCache(key: string, chunk: ChunkData): void {
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
