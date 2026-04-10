import { ChunkData } from './chunk';
import { BiomeSystem, BiomeConfig } from './biome';
import { TerrainGenerator, TerrainConfig } from '../gen/terrain';
import { ResourceGenerator, ResourceConfig } from '../gen/resources';
import { StructurePlacer, StructureConfig } from '../gen/structures';
import { RiverGenerator, RiverConfig } from '../gen/rivers';
import { chunkSeed } from '../core/hash';

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
  /** Time spent on river generation (ms) */
  riverTime: number;
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
  /** River generation configuration */
  riverConfig: RiverConfig;
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
  private riverGenerator: RiverGenerator;
  private cache: Map<string, CacheEntry>;
  private maxCacheSize: number;
  private accessCounter: number;

  /**
   * Creates a new ChunkManager with the given configuration.
   * @param config - World generation configuration
   */
  constructor(config: WorldConfig) {
    this.config = config;
    this.terrainGenerator = new TerrainGenerator(config.terrainConfig);
    this.biomeSystem = new BiomeSystem(config.seed, config.biomeConfig);
    this.resourceGenerator = new ResourceGenerator(config.resourceConfig);
    this.structurePlacer = new StructurePlacer(config.structureConfig);
    this.riverGenerator = new RiverGenerator(config.riverConfig);
    this.cache = new Map();
    this.maxCacheSize = config.maxCacheSize ?? 100;
    this.accessCounter = 0;
  }

  /**
   * Gets a chunk at the specified coordinates, using cache if available.
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @returns The chunk data at the specified coordinates
   */
  getChunk(chunkX: number, chunkY: number): ChunkData {
    const key = this.getCacheKey(chunkX, chunkY);
    
    // Check cache
    const cached = this.cache.get(key);
    if (cached) {
      cached.lastAccessed = ++this.accessCounter;
      return cached.chunk;
    }

    // Generate new chunk
    const chunk = this.generateChunk(chunkX, chunkY);

    // Add to cache with LRU eviction
    this.addToCache(key, chunk);

    return chunk;
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
    const heightmap = this.terrainGenerator.generateHeightmap(seed, this.config.chunkSize);
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

    // Step 5: Generate rivers using downhill flow
    this.config.onProgress?.('rivers', 0.9);
    const riverStart = this.config.enablePerformanceMetrics ? performance.now() : 0;
    chunk.rivers = this.riverGenerator.generateRivers(chunk, seed);
    if (this.config.enablePerformanceMetrics) {
      metrics.riverTime = performance.now() - riverStart;
    }

    this.config.onProgress?.('complete', 1.0);

    // Log performance metrics if enabled
    if (this.config.enablePerformanceMetrics) {
      metrics.totalTime = performance.now() - startTime;
      console.log(`Chunk (${chunkX}, ${chunkY}) generation metrics:`, metrics);
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
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }

  /**
   * Generates biome data for a chunk.
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

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = y * size + x;
        const height = heightmap[index];
        
        // Get world position for this tile
        const wx = worldX + x;
        const wy = worldY + y;

        // Determine biome at this position
        const biome = this.biomeSystem.getBiome(wx, wy, height);
        biomeMap[index] = biome;

        // Get biome blend weights
        const weights = this.biomeSystem.getBiomeWeights(wx, wy, height);
        
        // Store weights in the array
        const weightOffset = index * numBiomes;
        for (let b = 0; b < numBiomes; b++) {
          biomeWeights[weightOffset + b] = weights.get(b) || 0;
        }
      }
    }

    return { biomeMap, biomeWeights };
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
}
