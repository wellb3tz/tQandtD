/**
 * Multi-chunk lake management system.
 *
 * Manages lakes that can span multiple chunks, using world-space coordinates
 * and flood-fill algorithm that crosses chunk boundaries.
 */

import { NoiseEngine, type NoiseConfig } from '../core/noise';
import { BiomeType } from './chunk';
import type { LakeConfig } from '../gen/lakes';
import { logger, LogCategory } from '../utils/logger';
import { evictOldLakeCacheEntries, type LakeCacheState } from './lake-cache-eviction';
import type { WorldLakeData } from './lake-manager-types';
import {
  decodeLakeTile,
  encodeLakeTile,
  getAffectedLakeChunkBounds,
  getLakeChunkKey,
  indexLakeTiles,
  registerLakeChunks,
  unindexLakeTiles,
} from './lake-spatial-index';

export type { LakeState, WorldLakeData } from './lake-manager-types';

/**
 * Manages lakes across multiple chunks.
 * Generates lakes in world space and provides chunk-specific views.
 */
export class LakeManager {
  private readonly noise: NoiseEngine;
  private readonly config: LakeConfig;
  private readonly worldSeed: number;
  private readonly allowedBiomes: Set<number>;
  private readonly lakeNoiseConfig: NoiseConfig;
  private readonly sizeNoiseConfig: NoiseConfig;
  /** Map of lake ID to lake data */
  private lakes: Map<string, WorldLakeData>;
  /** Map of chunk key to lake IDs that intersect that chunk */
  private chunkToLakes: Map<string, Set<string>>;
  /** Chunk regions whose own lake candidates have already been evaluated */
  private generatedRegions: Set<string>;
  /** Map of lake ID to last access timestamp for LRU eviction */
  private lakeAccessTime: Map<string, number>;
  /** Map of chunk key to last access timestamp for LRU eviction */
  private chunkAccessTime: Map<string, number>;
  /**
   * Global tile -> lake-ID index for O(1) membership checks.
   * Replaces the previous O(lakes) linear scan in isTileInAnyLake().
   */
  private tileToLakeId: Map<string, string>;
  /** Maximum number of lakes to cache (default: 500) */
  private readonly maxLakes: number;
  /** Maximum number of chunk entries to cache (default: 1000) */
  private readonly maxChunkEntries: number;
  /** Monotonic counter for LRU tracking */
  private accessCounter: number;
  /** Pending cache invalidations (deferred to avoid race conditions) */
  private pendingInvalidations: Set<string>;
  /** Callback to get height at world coordinates */
  private getHeightAt: (worldX: number, worldY: number) => number;
  /** Callback to get biome at world coordinates */
  private getBiomeAt: (worldX: number, worldY: number) => BiomeType;
  /** Callback that returns true when a world tile is occupied by a river corridor */
  private isRiverTile?: (worldX: number, worldY: number) => boolean;

  constructor(
    worldSeed: number,
    config: LakeConfig,
    getHeightAt: (worldX: number, worldY: number) => number,
    getBiomeAt: (worldX: number, worldY: number) => BiomeType,
    maxLakes: number = 500,
    maxChunkEntries: number = 1000
  ) {
    this.worldSeed = worldSeed;
    this.noise = new NoiseEngine(worldSeed + 54321);
    this.config = config;
    this.allowedBiomes = new Set<number>(config.allowedBiomes);
    this.lakeNoiseConfig = {
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: config.noiseScale,
    };
    this.sizeNoiseConfig = {
      octaves: 2,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: config.noiseScale * 0.3,
    };
    this.lakes = new Map();
    this.chunkToLakes = new Map();
    this.generatedRegions = new Set();
    this.lakeAccessTime = new Map();
    this.chunkAccessTime = new Map();
    this.tileToLakeId = new Map();
    this.maxLakes = maxLakes;
    this.maxChunkEntries = maxChunkEntries;
    this.accessCounter = 0;
    this.pendingInvalidations = new Set();
    this.getHeightAt = getHeightAt;
    this.getBiomeAt = getBiomeAt;
  }

  private getChunkKey(chunkX: number, chunkY: number): string {
    return getLakeChunkKey(chunkX, chunkY);
  }

  private encodeTile(worldX: number, worldY: number): string {
    return encodeLakeTile(worldX, worldY);
  }

  private decodeTile(key: string): [number, number] {
    return decodeLakeTile(key);
  }

  /**
   * Get lakes that intersect a specific chunk.
   * Generates lakes on-demand if not already generated for this region.
   * Also checks neighboring chunks for lakes that might extend into this chunk.
   *
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param chunkSize - Size of the chunk
   * @param onInvalidateChunk - Optional callback to invalidate cached chunks when new lakes are found
   * @returns Array of lakes that intersect this chunk
   */
  getLakesForChunk(
    chunkX: number, 
    chunkY: number, 
    chunkSize: number,
    onInvalidateChunk?: (cx: number, cy: number) => void
  ): WorldLakeData[] {
    const chunkKey = this.getChunkKey(chunkX, chunkY);
    
    // Update access time for LRU tracking
    this.chunkAccessTime.set(chunkKey, ++this.accessCounter);
    
    // Track which chunks had new lakes generated
    const chunksWithNewLakes = new Set<string>();
    
    // Generate lake candidates for this chunk and its immediate neighbours.
    // A multi-chunk lake can be seeded just across a chunk boundary while still
    // covering the requested chunk; evaluating the 3x3 ring here prevents the
    // requested chunk from briefly rendering a clipped lake edge.
    for (let regionY = chunkY - 1; regionY <= chunkY + 1; regionY++) {
      for (let regionX = chunkX - 1; regionX <= chunkX + 1; regionX++) {
        const regionKey = this.getChunkKey(regionX, regionY);
        if (this.generatedRegions.has(regionKey)) continue;

        this.generateLakesForRegion(regionX, regionY, chunkSize);
        this.generatedRegions.add(regionKey);
        chunksWithNewLakes.add(regionKey);
      }
    }

    // If new lakes were generated, defer invalidations to avoid race conditions
    if (chunksWithNewLakes.size > 0 && onInvalidateChunk) {
      // For each new lake, collect chunks that need invalidation
      for (const lake of this.lakes.values()) {
        const { minChunkX, maxChunkX, minChunkY, maxChunkY } = this.getAffectedChunkBounds(lake, chunkSize);
        
        // Check if this lake was just generated
        let isNewLake = false;
        for (let cy = minChunkY; cy <= maxChunkY; cy++) {
          for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            if (chunksWithNewLakes.has(this.getChunkKey(cx, cy))) {
              isNewLake = true;
              break;
            }
          }
          if (isNewLake) break;
        }
        
        // If it's a new lake, mark chunks for deferred invalidation
        if (isNewLake) {
          for (let cy = minChunkY; cy <= maxChunkY; cy++) {
            for (let cx = minChunkX; cx <= maxChunkX; cx++) {
              // Don't invalidate the chunk we're currently generating
              if (cx !== chunkX || cy !== chunkY) {
                this.pendingInvalidations.add(this.getChunkKey(cx, cy));
              }
            }
          }
        }
      }
      
      // Process pending invalidations before returning so subsequent getChunk()
      // calls cannot observe stale heightmaps along lake-carved boundaries.
      if (this.pendingInvalidations.size > 0) {
        for (const key of this.pendingInvalidations) {
          const [cx, cy] = key.split(',').map(Number);
          onInvalidateChunk(cx, cy);
        }
        this.pendingInvalidations.clear();
      }
    }

    // Collect all lakes that intersect this chunk (or whose boundary vertices touch it).
    // We expand the check by +1 on the max side so that a lake whose rightmost/bottom
    // tile sits in the adjacent chunk still gets included here - its boundary vertex
    // (tile+1) lands exactly on this chunk's left/top edge and must be carved/rendered.
    const result: WorldLakeData[] = [];
    const chunkWorldX = chunkX * chunkSize;
    const chunkWorldY = chunkY * chunkSize;
    // +1: a lake tile at (chunkWorldX-1) has its right vertex at chunkWorldX, which
    // belongs to this chunk's heightmap and must be carved.
    const chunkMaxX = chunkWorldX + chunkSize; // inclusive of boundary vertex column
    const chunkMaxY = chunkWorldY + chunkSize; // inclusive of boundary vertex row

    // Check all lakes to see if they intersect this chunk
    for (const lake of this.lakes.values()) {
      // Quick bounds check (lake.bounds uses tile coords; a tile at maxX has its
      // right vertex at maxX+1, hence the >= chunkWorldX - 1 on the min side too)
      if (
        lake.bounds.maxX + 1 >= chunkWorldX &&
        lake.bounds.minX <= chunkMaxX &&
        lake.bounds.maxY + 1 >= chunkWorldY &&
        lake.bounds.minY <= chunkMaxY
      ) {
        result.push(lake);
        // Update lake access time for LRU tracking
        this.lakeAccessTime.set(lake.id, ++this.accessCounter);
      }
    }

    return result;
  }

  /**
   * Generate lakes for a region around a chunk.
   * Uses flood-fill that can cross chunk boundaries.
   * Optimized to only search the requested chunk, not surrounding chunks.
   */
  private generateLakesForRegion(chunkX: number, chunkY: number, chunkSize: number): void {
    if (!this.config.enabled) return;

    const seaLevel = 0.3;
    const heightCache = new Map<string, number>();

    // Only search in the requested chunk for performance
    // Lakes from neighboring chunks will be detected when those chunks are generated
    const candidates: Array<[number, number]> = [];
    const worldXStart = chunkX * chunkSize;
    const worldYStart = chunkY * chunkSize;

    // Sample every 4th tile for performance (reduces candidates by 16x)
    const step = 4;
    for (let ty = 0; ty < chunkSize; ty += step) {
      for (let tx = 0; tx < chunkSize; tx += step) {
        const worldX = worldXStart + tx;
        const worldY = worldYStart + ty;
        const tileKey = this.encodeTile(worldX, worldY);

        // Skip if already part of a lake or a river corridor
        if (this.isTileInAnyLake(tileKey)) continue;
        if (this.isRiverTile?.(worldX, worldY)) continue;

        const biome = this.getBiomeAt(worldX, worldY);
        if (!this.allowedBiomes.has(biome)) continue;

        const h = this.getTileHeightCached(worldX, worldY, heightCache);
        if (h < this.config.minElevation || h > this.config.maxElevation) continue;
        if (h <= seaLevel) continue;

        // Check lake noise
        const wx = worldX + 0.5;
        const wy = worldY + 0.5;
        const raw = this.noise.fbm(wx, wy, this.lakeNoiseConfig);
        const noiseVal = (raw + 1) * 0.5;

        if (noiseVal >= this.config.noiseThreshold) {
          candidates.push([worldX, worldY]);
        }
      }
    }

    // Limit number of candidates to process
    const maxCandidates = 5;
    const candidatesToProcess = candidates.slice(0, maxCandidates);

    // Flood-fill from each candidate
    for (const [seedX, seedY] of candidatesToProcess) {
      const tileKey = this.encodeTile(seedX, seedY);
      if (this.isTileInAnyLake(tileKey)) continue;

      const seedH = this.getTileHeightCached(seedX, seedY, heightCache);

      // Determine lake size category using a second noise layer
      // This creates variety: some lakes are small, some are huge
      const wx = seedX + 0.5;
      const wy = seedY + 0.5;
      const sizeNoise = this.noise.fbm(wx * 0.5, wy * 0.5, this.sizeNoiseConfig);
      const sizeValue = (sizeNoise + 1) * 0.5; // [0, 1]

      // Categorize lake size based on noise
      let maxLakeSize: number;
      let lakeSizeCategory: string;
      
      if (sizeValue < 0.5) {
        // 50% chance: Small lake (1-2 chunks)
        maxLakeSize = 100;
        lakeSizeCategory = 'small';
      } else if (sizeValue < 0.85) {
        // 35% chance: Medium lake (2-4 chunks)
        maxLakeSize = 300;
        lakeSizeCategory = 'medium';
      } else {
        // 15% chance: Large lake (4-6 chunks)
        maxLakeSize = 800;
        lakeSizeCategory = 'large';
      }

      // Reduce water level steps for performance
      const waterLevelSteps = 4;
      let foundLake: WorldLakeData | null = null;

      for (let step = 1; step <= waterLevelSteps; step++) {
        const waterLevel = seedH + (this.config.maxFillDepth * step) / waterLevelSteps;
        if (waterLevel > this.config.maxElevation) break;

        const tiles = this.floodFillWorld(seedX, seedY, waterLevel, maxLakeSize, heightCache);

        if (tiles !== null && tiles.size >= 2) {
          // Compute bounds and max depth
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          let minH = waterLevel;

          for (const tileKey of tiles) {
            const [wx, wy] = this.decodeTile(tileKey);
            minX = Math.min(minX, wx);
            maxX = Math.max(maxX, wx);
            minY = Math.min(minY, wy);
            maxY = Math.max(maxY, wy);

            const h = this.getTileHeightCached(wx, wy, heightCache);
            if (h < minH) minH = h;
          }

          const lakeId = `lake_${seedX}_${seedY}_${waterLevel.toFixed(4)}`;
          foundLake = {
            id: lakeId,
            waterLevel,
            tiles,
            maxDepth: waterLevel - minH,
            minTerrainHeight: minH,
            bounds: { minX, maxX, minY, maxY },
          };
          
          // Calculate approximate chunk span
          const chunkSpanX = Math.floor((maxX - minX) / chunkSize) + 1;
          const chunkSpanY = Math.floor((maxY - minY) / chunkSize) + 1;
          const totalChunks = chunkSpanX * chunkSpanY;
          
          logger.info(LogCategory.LAKE, `Created ${lakeSizeCategory} lake ${lakeId}`, {
            waterLevel,
            minTerrainHeight: minH,
            maxDepth: waterLevel - minH,
            tileCount: tiles.size,
            maxAllowed: maxLakeSize,
            chunkSpan: `${chunkSpanX}x${chunkSpanY} (${totalChunks} chunks)`,
          });
          
          break;
        }
      }

      if (foundLake) {
        this.addLake(foundLake, chunkSize);
      }
    }
  }

  /**
   * Check if a tile is already part of any lake.
   * O(1) lookup via the tileToLakeId index.
   */
  private isTileInAnyLake(tileKey: string): boolean {
    return this.tileToLakeId.has(tileKey);
  }

  /**
   * Get average height of a tile in world coordinates.
   */
  private getTileHeight(worldX: number, worldY: number): number {
    // Sample the four corners of the tile
    const h00 = this.getHeightAt(worldX, worldY);
    const h10 = this.getHeightAt(worldX + 1, worldY);
    const h01 = this.getHeightAt(worldX, worldY + 1);
    const h11 = this.getHeightAt(worldX + 1, worldY + 1);
    return (h00 + h10 + h01 + h11) * 0.25;
  }

  /**
   * Cached tile-height lookup for a single lake-generation pass. Flood-fill
   * revisits neighbouring basin walls many times across water-level attempts,
   * so memoizing these four-corner samples cuts a large amount of terrain work.
   */
  private getTileHeightCached(worldX: number, worldY: number, cache: Map<string, number>): number {
    const key = this.encodeTile(worldX, worldY);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const height = this.getTileHeight(worldX, worldY);
    cache.set(key, height);
    return height;
  }

  /**
   * Flood-fill in world space, can cross chunk boundaries.
   * Returns null if the lake is too large or open (no natural spill point found).
   *
   * Uses a plain array as a queue - push/shift is avoided by tracking a head
   * index, giving O(1) dequeue without a fixed-size pre-allocation.
   *
   * @param startX     - Starting world X coordinate
   * @param startY     - Starting world Y coordinate
   * @param waterLevel - Water level to fill to
   * @param maxSize    - Maximum lake size in tiles (optional, uses config default if not provided)
   */
  private floodFillWorld(
    startX: number,
    startY: number,
    waterLevel: number,
    maxSize?: number,
    heightCache?: Map<string, number>
  ): Set<string> | null {
    const visited = new Set<string>();

    // Dynamic arrays - grow as needed, no fixed upper bound.
    const queueX: number[] = [];
    const queueY: number[] = [];
    let queueHead = 0;

    const startKey = this.encodeTile(startX, startY);

    const getHeight = heightCache
      ? (x: number, y: number) => this.getTileHeightCached(x, y, heightCache)
      : (x: number, y: number) => this.getTileHeight(x, y);

    if (getHeight(startX, startY) >= waterLevel) return null;

    visited.add(startKey);
    queueX.push(startX);
    queueY.push(startY);

    const dx = [0, 0, -1, 1];
    const dy = [-1, 1, 0, 0];

    // Use provided maxSize or fall back to config default (x2 for world-space lakes).
    const maxLakeTiles = maxSize ?? (this.config.maxLakeTiles * 2);

    while (queueHead < queueX.length) {
      const cx = queueX[queueHead];
      const cy = queueY[queueHead];
      queueHead++;

      for (let d = 0; d < 4; d++) {
        const nx = cx + dx[d];
        const ny = cy + dy[d];
        const nKey = this.encodeTile(nx, ny);

        if (visited.has(nKey)) continue;
        if (this.tileToLakeId.has(nKey)) continue; // O(1) - replaces isTileInAnyLake

        const nh = getHeight(nx, ny);
        if (nh < waterLevel) {
          if (this.isRiverTile?.(nx, ny)) {
            return null; // River drains the basin - treat as open
          }

          visited.add(nKey);

          if (visited.size > maxLakeTiles) {
            return null; // Lake too large - treat as open basin
          }

          queueX.push(nx);
          queueY.push(ny);
        }
      }
    }

    return visited;
  }

  /**
   * Add a lake to the manager, merging it with any existing lakes whose tile
   * sets overlap or are 4-connected adjacent (same physical basin found from a
   * different seed or chunk).  Merging keeps the higher waterLevel and recomputes
   * all derived fields so every chunk sees a single consistent water surface.
   * 
   * Implements LRU eviction to prevent unbounded memory growth.
   */
  private addLake(lake: WorldLakeData, chunkSize: number): void {
    // Evict old lakes if we're at capacity
    evictOldLakeCacheEntries(this.getCacheState());
    // Find all existing lakes that share tiles or are 4-adjacent to the new lake.
    const toMerge: WorldLakeData[] = [];

    // Build a quick lookup of the new lake's tiles
    const newTileSet = lake.tiles;

    for (const existing of this.lakes.values()) {
      // Quick bounding-box pre-check (+/-1 for adjacency)
      if (
        existing.bounds.maxX + 1 < lake.bounds.minX ||
        existing.bounds.minX - 1 > lake.bounds.maxX ||
        existing.bounds.maxY + 1 < lake.bounds.minY ||
        existing.bounds.minY - 1 > lake.bounds.maxY
      ) {
        continue;
      }

      // Check for shared or adjacent tiles
      let shouldMerge = false;
      outer: for (const key of newTileSet) {
        if (existing.tiles.has(key)) { shouldMerge = true; break; }
        const [wx, wy] = this.decodeTile(key);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
          if (existing.tiles.has(this.encodeTile(wx + dx, wy + dy))) {
            shouldMerge = true;
            break outer;
          }
        }
      }

      if (shouldMerge) toMerge.push(existing);
    }

    if (toMerge.length === 0) {
      // No overlap - just register the new lake as-is.
      this.lakes.set(lake.id, lake);
      this._indexTiles(lake);
      this._registerChunks(lake, chunkSize);
      return;
    }

    // Merge: union all tile sets, keep the highest waterLevel.
    const mergedTiles = new Set<string>(lake.tiles);
    let waterLevel = lake.waterLevel;
    let minTerrainHeight = lake.minTerrainHeight;
    let minX = lake.bounds.minX, maxX = lake.bounds.maxX;
    let minY = lake.bounds.minY, maxY = lake.bounds.maxY;

    for (const existing of toMerge) {
      for (const t of existing.tiles) mergedTiles.add(t);
      if (existing.waterLevel > waterLevel) waterLevel = existing.waterLevel;
      if (existing.minTerrainHeight < minTerrainHeight) minTerrainHeight = existing.minTerrainHeight;
      minX = Math.min(minX, existing.bounds.minX);
      maxX = Math.max(maxX, existing.bounds.maxX);
      minY = Math.min(minY, existing.bounds.minY);
      maxY = Math.max(maxY, existing.bounds.maxY);

      // Remove old lake and its chunk registrations
      this._unindexTiles(existing);
      this.lakes.delete(existing.id);
      for (const chunkLakes of this.chunkToLakes.values()) {
        chunkLakes.delete(existing.id);
      }
    }

    // Recompute maxDepth from the merged tile set
    let minH = waterLevel;
    for (const tileKey of mergedTiles) {
      const [wx, wy] = this.decodeTile(tileKey);
      const h = this.getTileHeight(wx, wy);
      if (h < minH) minH = h;
    }

    // Use the id of the first (lowest waterLevel) lake as the canonical id
    const canonicalId = toMerge.reduce(
      (best, l) => (l.waterLevel <= best.waterLevel ? l : best),
      lake
    ).id;

    const merged: WorldLakeData = {
      id: canonicalId,
      waterLevel,
      tiles: mergedTiles,
      maxDepth: waterLevel - minH,
      minTerrainHeight: minH,
      bounds: { minX, maxX, minY, maxY },
    };

    this.lakes.set(merged.id, merged);
    this.lakeAccessTime.set(merged.id, ++this.accessCounter);
    this._indexTiles(merged);
    this._registerChunks(merged, chunkSize);
  }

  /**
   * Notify that a chunk has been evicted from ChunkManager cache.
   * Marks the chunk entry as the oldest in the LRU so it will be the first
   * candidate for eviction when the chunk-entry limit is reached.
   *
   * We do not delete immediately because the chunk may be re-requested soon
   * (e.g. the player moves back), and regenerating lake data is expensive.
   *
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   */
  notifyChunkEvicted(chunkX: number, chunkY: number): void {
    const chunkKey = this.getChunkKey(chunkX, chunkY);
    // Set access time to 0 so this entry is the first evicted under LRU pressure.
    if (this.chunkAccessTime.has(chunkKey)) {
      this.chunkAccessTime.set(chunkKey, 0);
    }
  }

  /**
   * Register a callback that returns true when a world tile is already
   * occupied by a river corridor.  Used to prevent lakes from spawning
   * on top of rivers.
   */
  setRiverTileChecker(checker: (worldX: number, worldY: number) => boolean): void {
    this.isRiverTile = checker;
  }

  /**
   * Returns true if the world-space point lies inside any lake.
   * Used by RiverManager to terminate rivers at lake shores.
   */
  isPointInLake(worldX: number, worldY: number): boolean {
    return this.tileToLakeId.has(this.encodeTile(worldX, worldY));
  }

  /**
   * Add all tiles of a lake to the global tile -> lake-ID index.
   * Must be called whenever a lake is stored in `this.lakes`.
   */
  private _indexTiles(lake: WorldLakeData): void {
    indexLakeTiles(this.tileToLakeId, lake);
  }

  /**
   * Remove all tiles of a lake from the global tile -> lake-ID index.
   * Must be called before a lake is removed from `this.lakes`.
   */
  private _unindexTiles(lake: WorldLakeData): void {
    unindexLakeTiles(this.tileToLakeId, lake);
  }

  /** Register a lake's chunk intersections in chunkToLakes. */
  private _registerChunks(lake: WorldLakeData, chunkSize: number): void {
    registerLakeChunks(this.chunkToLakes, lake, chunkSize, chunkKey => {
      this.chunkAccessTime.set(chunkKey, ++this.accessCounter);
    });
  }

  private getAffectedChunkBounds(
    lake: WorldLakeData,
    chunkSize: number
  ): { minChunkX: number; maxChunkX: number; minChunkY: number; maxChunkY: number } {
    return getAffectedLakeChunkBounds(lake, chunkSize);
  }

  private getCacheState(): LakeCacheState {
    return {
      lakes: this.lakes,
      chunkToLakes: this.chunkToLakes,
      lakeAccessTime: this.lakeAccessTime,
      chunkAccessTime: this.chunkAccessTime,
      tileToLakeId: this.tileToLakeId,
      maxLakes: this.maxLakes,
      maxChunkEntries: this.maxChunkEntries,
    };
  }

  /**
   * Get all lakes in the world.
   */
  getAllLakes(): WorldLakeData[] {
    return Array.from(this.lakes.values());
  }

  /**
   * Clear all lakes (useful for regeneration).
   */
  clear(): void {
    this.lakes.clear();
    this.chunkToLakes.clear();
    this.generatedRegions.clear();
    this.tileToLakeId.clear();
    this.lakeAccessTime.clear();
    this.chunkAccessTime.clear();
  }
}
