/**
 * Lake generation system using noise-guided flood-fill.
 *
 * Strategy (Variant C):
 *  1. A low-frequency "lake noise" identifies candidate regions on land where
 *     lakes are geographically plausible (correct biome, elevation band).
 *  2. Inside each candidate region a flood-fill (fill-to-spill) finds the
 *     actual closed depression in the heightmap and computes the water level
 *     as the height of the lowest escape point (spill point).
 *  3. The result is a list of LakeData objects stored on ChunkData.
 *
 * The algorithm is fully deterministic: same seed + same heightmap -> same lakes.
 */

import { NoiseEngine } from '../core/noise';
import { BiomeType } from '../world/chunk';

// --- Public types ------------------------------------------------------------

export type LakeState = 'filled' | 'frozen' | 'dry';

/**
 * A single lake body detected inside a chunk.
 */
export interface LakeData {
  /** Water surface elevation in [0, 1] heightmap space */
  waterLevel: number;
  /**
   * Set of tile indices (row-major, size x size) that are covered by this lake.
   * A tile is covered when its average corner height is below waterLevel.
   */
  tiles: Set<number>;
  /**
   * Optional render footprint for the lake surface inside this chunk.
   * Multi-chunk lakes use this to include shoreline and boundary cells whose
   * vertices touch the lake even when the cell itself is outside the basin.
   */
  surfaceTiles?: Set<number>;
  /** Maximum depth of the lake (waterLevel - min terrain height inside lake) */
  maxDepth: number;
  /** Minimum terrain height inside the lake (for consistent water positioning across chunks) */
  minTerrainHeight?: number;
  /** Climate-driven lake state; undefined when climate system is disabled. */
  state?: LakeState;
}

/**
 * Configuration for lake generation.
 */
export interface LakeConfig {
  /**
   * Enable lake generation (default: true).
   */
  enabled: boolean;

  /**
   * Use multi-chunk lake system (default: false for performance).
   * When false, uses the original single-chunk lake generator.
   * When true, lakes can span multiple chunks but generation is slower.
   */
  useMultiChunk?: boolean;

  /**
   * Noise scale for the lake-candidate mask.
   * Lower = larger lake regions, higher = smaller scattered pockets.
   * Typical range: 0.005 - 0.02.  Default: 0.01.
   */
  noiseScale: number;

  /**
   * Noise threshold above which a position is a lake candidate.
   * Range [0, 1].  Higher = fewer but more concentrated lakes.
   * Default: 0.62.
   */
  noiseThreshold: number;

  /**
   * Minimum terrain height for a lake seed (must be above sea level).
   * Prevents lakes from forming in ocean zones.
   * Default: 0.32 (just above seaLevel = 0.3).
   */
  minElevation: number;

  /**
   * Maximum terrain height for a lake seed.
   * Prevents lakes from forming on steep mountain peaks.
   * Default: 0.72.
   */
  maxElevation: number;

  /**
   * Biomes in which lakes are allowed to form.
   * Default: PLAINS, FOREST, DRY_FOREST, STEPPE, TAIGA, TUNDRA, MOUNTAIN, SWAMP, SAVANNA.
   */
  allowedBiomes: BiomeType[];

  /**
   * Maximum number of tiles a single lake may occupy inside one chunk.
   * Limits flood-fill cost.  Default: 80.
   */
  maxLakeTiles: number;

  /**
   * Maximum water level rise above the seed tile height during flood-fill.
   * Prevents the fill from swallowing entire hillsides.
   * Default: 0.06.
   */
  maxFillDepth: number;
}

/** Default lake configuration. */
export const DEFAULT_LAKE_CONFIG: LakeConfig = {
  enabled: true,
  useMultiChunk: true, // Enabled by default - multi-chunk lakes are now the standard
  noiseScale: 0.01,
  noiseThreshold: 0.62,
  minElevation: 0.32,
  maxElevation: 0.72,
  allowedBiomes: [
    BiomeType.PLAINS,
    BiomeType.FOREST,
    BiomeType.DRY_FOREST,
    BiomeType.STEPPE,
    BiomeType.TAIGA,
    BiomeType.TUNDRA,
    BiomeType.MOUNTAIN,
    BiomeType.SWAMP,
    BiomeType.SAVANNA,
  ],
  maxLakeTiles: 80,
  maxFillDepth: 0.06,
};

// --- LakeGenerator -----------------------------------------------------------

/**
 * Generates lake bodies for a single chunk.
 *
 * Usage:
 * ```ts
 * const gen = new LakeGenerator(worldSeed, lakeConfig);
 * const lakes = gen.generateLakes(chunkX, chunkY, chunkSize, heightmap, biomeMap);
 * ```
 */
export class LakeGenerator {
  private readonly noise: NoiseEngine;
  private readonly config: LakeConfig;

  constructor(worldSeed: number, config: LakeConfig = DEFAULT_LAKE_CONFIG) {
    // Offset seed so lake noise is independent from terrain / biome noise.
    this.noise = new NoiseEngine(worldSeed + 54321);
    this.config = config;
  }

  /**
   * Generate lakes for a chunk.
   *
   * @param chunkX    - Chunk X coordinate
   * @param chunkY    - Chunk Y coordinate
   * @param chunkSize - Chunk size (tiles per side)
   * @param heightmap - (chunkSize+1)^2 vertex heights in [0,1]
   * @param biomeMap  - chunkSize^2 biome types (Uint8Array)
   * @returns Array of detected lake bodies (may be empty)
   */
  generateLakes(
    chunkX: number,
    chunkY: number,
    chunkSize: number,
    heightmap: Float32Array,
    biomeMap: Uint8Array,
  ): LakeData[] {
    if (!this.config.enabled) return [];

    const size = chunkSize;
    const vertexSize = size + 1;
    const seaLevel = 0.3; // must match terrain generator constant

    // -- Helper: average height of the four corners of tile (tx, ty) ----------
    const tileHeight = (tx: number, ty: number): number => {
      const v00 = heightmap[ty * vertexSize + tx];
      const v10 = heightmap[ty * vertexSize + (tx + 1)];
      const v01 = heightmap[(ty + 1) * vertexSize + tx];
      const v11 = heightmap[(ty + 1) * vertexSize + (tx + 1)];
      return (v00 + v10 + v01 + v11) * 0.25;
    };

    // -- Step 1: collect candidate seed tiles ---------------------------------
    // A tile is a candidate when:
    //   - its biome is in allowedBiomes
    //   - its height is in [minElevation, maxElevation]
    //   - the lake noise at its world position exceeds noiseThreshold

    const allowedSet = new Set<number>(this.config.allowedBiomes);
    const candidates: number[] = []; // tile indices

    for (let ty = 0; ty < size; ty++) {
      for (let tx = 0; tx < size; tx++) {
        const idx = ty * size + tx;
        const biome = biomeMap[idx] as BiomeType;
        if (!allowedSet.has(biome)) continue;

        const h = tileHeight(tx, ty);
        if (h < this.config.minElevation || h > this.config.maxElevation) continue;
        if (h <= seaLevel) continue; // never below sea level

        // World position of tile centre
        const wx = chunkX * size + tx + 0.5;
        const wy = chunkY * size + ty + 0.5;

        const raw = this.noise.fbm(wx, wy, {
          octaves: 3,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: this.config.noiseScale,
        });
        const noiseVal = (raw + 1) * 0.5; // [0,1]

        if (noiseVal >= this.config.noiseThreshold) {
          candidates.push(idx);
        }
      }
    }

    if (candidates.length === 0) return [];

    // -- Step 2: flood-fill from each candidate seed ---------------------------
    // We use a simple BFS fill-to-spill:
    //   - Start from the seed tile.
    //   - Expand to 4-connected neighbours whose height <= current water level.
    //   - If we hit the chunk boundary we consider the lake "open" (drains out)
    //     and abort - no lake forms from this seed.
    //   - The water level starts at the seed height and rises by small increments
    //     until either the fill is closed or maxFillDepth is exceeded.
    //
    // To avoid redundant work, tiles already assigned to a lake are skipped.

    const assignedTiles = new Uint8Array(size * size); // 0 = free, 1 = assigned
    const lakes: LakeData[] = [];

    for (const seedIdx of candidates) {
      if (assignedTiles[seedIdx]) continue;

      const seedTx = seedIdx % size;
      const seedTy = Math.floor(seedIdx / size);
      const seedH = tileHeight(seedTx, seedTy);

      // Try increasing water levels until we find a closed basin or exceed maxFillDepth
      const waterLevelSteps = 8;
      let foundLake: LakeData | null = null;

      for (let step = 1; step <= waterLevelSteps; step++) {
        const waterLevel = seedH + (this.config.maxFillDepth * step) / waterLevelSteps;
        if (waterLevel > this.config.maxElevation) break;

        const result = this.floodFill(
          seedTx, seedTy,
          waterLevel,
          size,
          heightmap,
          assignedTiles,
        );

        if (result !== null) {
          // Closed basin found - compute max depth
          let minH = waterLevel;
          for (const tileIdx of result) {
            const tx = tileIdx % size;
            const ty = Math.floor(tileIdx / size);
            const h = tileHeight(tx, ty);
            if (h < minH) minH = h;
          }

          foundLake = {
            waterLevel,
            tiles: result,
            maxDepth: waterLevel - minH,
          };
          break; // Use the smallest water level that closes the basin
        }
      }

      if (foundLake !== null && foundLake.tiles.size >= 2) {
        // Mark tiles as assigned
        for (const tileIdx of foundLake.tiles) {
          assignedTiles[tileIdx] = 1;
        }
        lakes.push(foundLake);
      }
    }

    // -- Step 3: merge overlapping / adjacent lakes ----------------------------
    // Multiple seed tiles inside the same physical depression can produce
    // separate LakeData objects with slightly different waterLevels.
    // We union any two lakes whose tile sets share at least one tile, keeping
    // the higher waterLevel (the larger basin wins) and recomputing maxDepth.
    return this.mergeLakes(lakes, heightmap, size);
  }

  /**
   * Merge lake bodies whose tile sets overlap OR are 4-connected adjacent.
   *
   * Two lakes that share a tile boundary (even without overlapping tiles) are
   * almost certainly the same physical depression found by different seeds at
   * slightly different water levels.  We union them, keep the max waterLevel,
   * and recompute maxDepth.
   *
   * Uses Union-Find (disjoint set) for efficiency.
   */
  private mergeLakes(
    lakes: LakeData[],
    heightmap: Float32Array,
    size: number,
  ): LakeData[] {
    if (lakes.length <= 1) return lakes;

    const vertexSize = size + 1;

    // parent[i] = representative index for lake i
    const parent = lakes.map((_, i) => i);

    const find = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };

    const union = (a: number, b: number): void => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    // Build map: tileIndex -> lake index (for overlap detection)
    const tileOwner = new Map<number, number>();
    for (let i = 0; i < lakes.length; i++) {
      for (const tileIdx of lakes[i].tiles) {
        const existing = tileOwner.get(tileIdx);
        if (existing !== undefined) {
          union(i, existing);
        } else {
          tileOwner.set(tileIdx, i);
        }
      }
    }

    // Also union lakes whose tiles are 4-connected adjacent
    const dx = [1, 0, -1, 0];
    const dy = [0, 1, 0, -1];

    for (let i = 0; i < lakes.length; i++) {
      for (const tileIdx of lakes[i].tiles) {
        const tx = tileIdx % size;
        const ty = Math.floor(tileIdx / size);

        for (let d = 0; d < 4; d++) {
          const nx = tx + dx[d];
          const ny = ty + dy[d];
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;

          const neighborIdx = ny * size + nx;
          const neighborOwner = tileOwner.get(neighborIdx);
          if (neighborOwner !== undefined && neighborOwner !== i) {
            union(i, neighborOwner);
          }
        }
      }
    }

    // Group lakes by their root representative
    const groups = new Map<number, number[]>();
    for (let i = 0; i < lakes.length; i++) {
      const root = find(i);
      const g = groups.get(root);
      if (g) g.push(i); else groups.set(root, [i]);
    }

    const tileHeight = (tx: number, ty: number): number => {
      const v00 = heightmap[ty * vertexSize + tx];
      const v10 = heightmap[ty * vertexSize + (tx + 1)];
      const v01 = heightmap[(ty + 1) * vertexSize + tx];
      const v11 = heightmap[(ty + 1) * vertexSize + (tx + 1)];
      return (v00 + v10 + v01 + v11) * 0.25;
    };

    const merged: LakeData[] = [];

    for (const group of groups.values()) {
      if (group.length === 1) {
        merged.push(lakes[group[0]]);
        continue;
      }

      // Merge tile sets; take the maximum waterLevel
      const mergedTiles = new Set<number>();
      let maxWaterLevel = -Infinity;

      for (const idx of group) {
        const lake = lakes[idx];
        if (lake.waterLevel > maxWaterLevel) maxWaterLevel = lake.waterLevel;
        for (const t of lake.tiles) mergedTiles.add(t);
      }

      // Recompute maxDepth from the merged tile set
      let minH = maxWaterLevel;
      for (const tileIdx of mergedTiles) {
        const tx = tileIdx % size;
        const ty = Math.floor(tileIdx / size);
        const h = tileHeight(tx, ty);
        if (h < minH) minH = h;
      }

      merged.push({
        waterLevel: maxWaterLevel,
        tiles: mergedTiles,
        maxDepth: maxWaterLevel - minH,
      });
    }

    return merged;
  }

  /**
   * BFS flood-fill from (startX, startY) up to waterLevel.
   *
   * Returns the set of tile indices if the fill is fully contained within the
   * chunk (closed basin), or null if it touches a chunk boundary (open basin).
   *
   * @param startX       - Seed tile X
   * @param startY       - Seed tile Y
   * @param waterLevel   - Water surface elevation to fill to
   * @param size         - Chunk size
   * @param heightmap    - Vertex heightmap
   * @param assignedTiles - Already-assigned tile mask (read-only here)
   */
  private floodFill(
    startX: number,
    startY: number,
    waterLevel: number,
    size: number,
    heightmap: Float32Array,
    assignedTiles: Uint8Array,
  ): Set<number> | null {
    const vertexSize = size + 1;

    const tileHeight = (tx: number, ty: number): number => {
      const v00 = heightmap[ty * vertexSize + tx];
      const v10 = heightmap[ty * vertexSize + (tx + 1)];
      const v01 = heightmap[(ty + 1) * vertexSize + tx];
      const v11 = heightmap[(ty + 1) * vertexSize + (tx + 1)];
      return (v00 + v10 + v01 + v11) * 0.25;
    };

    const visited = new Set<number>();
    const queue: Array<[number, number]> = [[startX, startY]];
    const startIdx = startY * size + startX;

    // Seed must be below water level
    if (tileHeight(startX, startY) >= waterLevel) return null;

    visited.add(startIdx);

    const dx = [0, 0, -1, 1];
    const dy = [-1, 1, 0, 0];

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;

      for (let d = 0; d < 4; d++) {
        const nx = cx + dx[d];
        const ny = cy + dy[d];

        // Touching chunk boundary -> open basin, abort
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
          return null;
        }

        const nIdx = ny * size + nx;
        if (visited.has(nIdx)) continue;
        if (assignedTiles[nIdx]) continue;

        const nh = tileHeight(nx, ny);
        if (nh < waterLevel) {
          visited.add(nIdx);

          // Respect max lake size
          if (visited.size > this.config.maxLakeTiles) {
            return null;
          }

          queue.push([nx, ny]);
        }
        // Tiles at or above waterLevel form the basin wall - don't expand there
      }
    }

    return visited;
  }
}
