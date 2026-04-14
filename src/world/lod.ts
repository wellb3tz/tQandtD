// Level of Detail (LOD) system for chunk generation

/**
 * LOD level enumeration
 * Determines the level of geometric detail for chunk generation
 */
export enum LODLevel {
  /** Full detail, close to viewer */
  HIGH = 0,
  /** Reduced detail, medium distance */
  MEDIUM = 1,
  /** Minimal detail, far distance */
  LOW = 2,
}

/**
 * LOD configuration
 * Controls how LOD levels are selected and applied
 */
export interface LODConfig {
  /** 
   * LOD distance thresholds (in chunks)
   * Array of distances that define LOD level boundaries
   * Example: [2, 5] means HIGH for 0-2 chunks, MEDIUM for 2-5 chunks, LOW for 5+ chunks
   */
  distances: number[];
  
  /** 
   * Mesh resolution multipliers for each LOD (1.0 = full resolution)
   * Array indexed by LODLevel, values should be in range (0, 1]
   * Lower values mean lower resolution heightmaps
   */
  meshResolutions: number[];
  
  /** 
   * Feature density multipliers for each LOD (1.0 = full density)
   * Array indexed by LODLevel, values should be in range (0, 1]
   * Lower values mean fewer resources and structures
   */
  featureDensities: number[];
}

/**
 * LODManager manages level-of-detail selection and application for chunk generation
 * Determines appropriate LOD level based on distance from viewer
 */
export class LODManager {
  private config: LODConfig;

  /**
   * Creates a new LODManager
   * @param config - LOD configuration with distance thresholds and quality settings
   */
  constructor(config: LODConfig) {
    this.config = config;
  }

  /**
   * Determines appropriate LOD level based on distance from viewer
   * Uses Euclidean distance to calculate chunk distance from viewer position
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkY - Chunk Y coordinate
   * @param viewerX - Viewer X coordinate (in chunks)
   * @param viewerY - Viewer Y coordinate (in chunks)
   * @returns LOD level (HIGH, MEDIUM, or LOW)
   * 
   * @example
   * const manager = new LODManager({ distances: [2, 5], ... });
   * const level = manager.getLODLevel(10, 10, 8, 8);
   * // Returns LODLevel.MEDIUM (distance = 2.83, which is between 2 and 5)
   */
  getLODLevel(chunkX: number, chunkY: number, viewerX: number, viewerY: number): LODLevel {
    // Calculate Euclidean distance from viewer to chunk
    const dx = chunkX - viewerX;
    const dy = chunkY - viewerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Determine LOD level based on distance thresholds
    // If no thresholds configured, default to HIGH
    if (this.config.distances.length === 0) {
      return LODLevel.HIGH;
    }

    // Check each threshold to find appropriate LOD level
    for (let i = 0; i < this.config.distances.length; i++) {
      if (distance < this.config.distances[i]) {
        return i as LODLevel;
      }
    }

    // If distance exceeds all thresholds, use lowest LOD
    return this.config.distances.length as LODLevel;
  }

  /**
   * Gets mesh resolution multiplier for a LOD level
   * @param level - LOD level
   * @returns Resolution multiplier (0-1), defaults to 1.0 if not configured
   */
  getMeshResolution(level: LODLevel): number {
    return this.config.meshResolutions[level] ?? 1.0;
  }

  /**
   * Gets feature density multiplier for a LOD level
   * @param level - LOD level
   * @returns Density multiplier (0-1), defaults to 1.0 if not configured
   */
  getFeatureDensity(level: LODLevel): number {
    return this.config.featureDensities[level] ?? 1.0;
  }

  /**
   * Applies LOD to chunk data by reducing mesh resolution and feature density
   * Creates a new ChunkData object with LOD-adjusted heightmap and features
   * 
   * **IMPORTANT**: This method updates both the heightmap AND the chunk size to maintain
   * consistency. The downsampled heightmap will have (newSize + 1) x (newSize + 1) vertices
   * to preserve seamless boundaries between chunks.
   * 
   * @param chunk - Full-resolution chunk data
   * @param level - Target LOD level
   * @returns LOD-adjusted chunk data with updated size and downsampled heightmap
   * 
   * @example
   * const manager = new LODManager({ 
   *   distances: [2, 5],
   *   meshResolutions: [1.0, 0.5, 0.25],
   *   featureDensities: [1.0, 0.5, 0.1]
   * });
   * 
   * // Original chunk: size=32, heightmap=33x33 (1089 vertices)
   * const lodChunk = manager.applyLOD(fullChunk, LODLevel.MEDIUM);
   * // Result: size=16, heightmap=17x17 (289 vertices), 50% features
   * 
   * @since 1.0.0 - Fixed to update chunk.size after downsampling
   */
  applyLOD(chunk: any, level: LODLevel): any {
    const resolution = this.getMeshResolution(level);
    const density = this.getFeatureDensity(level);

    // If LOD is HIGH (full resolution), return chunk as-is
    if (level === LODLevel.HIGH) {
      return chunk;
    }

    // Calculate new size after downsampling
    const newSize = Math.max(1, Math.floor(chunk.size * resolution));

    // Create LOD-adjusted chunk
    // CRITICAL: Update chunk.size to match the downsampled heightmap dimensions
    const lodChunk = {
      ...chunk,
      size: newSize,
      heightmap: this.downsampleHeightmap(chunk.heightmap, chunk.size, resolution),
      resources: this.filterFeatures(chunk.resources, density, chunk.x * 1000 + chunk.y),
      structures: this.filterFeatures(chunk.structures, density, chunk.x * 2000 + chunk.y),
    };

    return lodChunk;
  }

  /**
   * Reduces heightmap resolution using bilinear interpolation
   * Downsamples the heightmap to a lower resolution based on the resolution multiplier
   * 
   * **CRITICAL**: Preserves seamless boundaries structure by maintaining (newSize + 1) x (newSize + 1) size.
   * This ensures that adjacent chunks at the same LOD level share edge vertices, preventing gaps or seams
   * in the rendered terrain.
   * 
   * **Algorithm**:
   * 1. Calculate new chunk size: newSize = floor(size * resolution)
   * 2. Create heightmap with (newSize + 1) x (newSize + 1) vertices
   * 3. For each vertex in new heightmap, map to original coordinates
   * 4. Use bilinear interpolation to sample height from 4 neighboring vertices
   * 
   * **Special Case**: For 1x1 chunks (2x2 heightmap), all vertices are set to the center value
   * of the original heightmap to avoid interpolation artifacts.
   * 
   * @param heightmap - Full-resolution heightmap with size (size + 1) x (size + 1)
   * @param size - Original chunk size (heightmap has size + 1 vertices per side)
   * @param resolution - Target resolution multiplier (0-1)
   * @returns Downsampled heightmap with size (newSize + 1) x (newSize + 1)
   * 
   * @example
   * // Downsample 32x32 chunk (33x33 heightmap) to 50% resolution
   * const downsampled = manager.downsampleHeightmap(heightmap, 32, 0.5);
   * // Returns 17x17 heightmap (16+1) with bilinear interpolation
   * 
   * @example
   * // Downsample to 1x1 chunk (2x2 heightmap)
   * const downsampled = manager.downsampleHeightmap(heightmap, 32, 0.03125);
   * // Returns 2x2 heightmap with all vertices set to center value
   * 
   * @since 1.0.0 - Fixed to generate (newSize + 1) x (newSize + 1) heightmap for seamless boundaries
   */
  private downsampleHeightmap(
    heightmap: Float32Array,
    size: number,
    resolution: number
  ): Float32Array {
    // Calculate new chunk size based on resolution multiplier
    const newSize = Math.max(1, Math.floor(size * resolution));
    
    // Heightmap must have (newSize + 1) x (newSize + 1) vertices for seamless boundaries
    const newVerticesPerSide = newSize + 1;
    const newHeightmap = new Float32Array(newVerticesPerSide * newVerticesPerSide);

    // Special case for 1x1 chunk - heightmap should be 2x2
    if (newSize === 1) {
      const oldVerticesPerSide = size + 1;
      const centerIdx = Math.floor(oldVerticesPerSide / 2) * oldVerticesPerSide + Math.floor(oldVerticesPerSide / 2);
      const centerValue = heightmap[centerIdx];
      // Fill all 4 vertices with the center value
      newHeightmap[0] = centerValue;
      newHeightmap[1] = centerValue;
      newHeightmap[2] = centerValue;
      newHeightmap[3] = centerValue;
      return newHeightmap;
    }

    // Downsample using bilinear interpolation
    const oldVerticesPerSide = size + 1;
    
    // Iterate over all vertices in the new heightmap (newSize + 1 per side)
    for (let y = 0; y <= newSize; y++) {
      for (let x = 0; x <= newSize; x++) {
        // Map new vertex coordinates to original heightmap coordinates
        const srcX = (x / newSize) * size;
        const srcY = (y / newSize) * size;

        // Get integer and fractional parts for bilinear interpolation
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, size);
        const y1 = Math.min(y0 + 1, size);
        const fx = srcX - x0;
        const fy = srcY - y0;

        // Sample four neighboring points from original heightmap
        const h00 = heightmap[y0 * oldVerticesPerSide + x0];
        const h10 = heightmap[y0 * oldVerticesPerSide + x1];
        const h01 = heightmap[y1 * oldVerticesPerSide + x0];
        const h11 = heightmap[y1 * oldVerticesPerSide + x1];

        // Bilinear interpolation
        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;
        const h = h0 * (1 - fy) + h1 * fy;

        newHeightmap[y * newVerticesPerSide + x] = h;
      }
    }

    return newHeightmap;
  }

  /**
   * Reduces feature count based on density multiplier using deterministic selection
   * Uses seeded random selection to consistently filter features at the same LOD level
   * 
   * @param features - Array of resources or structures
   * @param density - Target density multiplier (0-1)
   * @param seed - Random seed for consistent selection
   * @returns Filtered feature array
   * 
   * @example
   * const filtered = manager.filterFeatures(resources, 0.25, 12345);
   * // Returns approximately 25% of resources, deterministically selected based on seed
   */
  private filterFeatures<T>(features: T[], density: number, seed: number): T[] {
    // If density is 1.0 or higher, return all features
    if (density >= 1.0) {
      return features;
    }

    // If density is 0 or negative, return empty array
    if (density <= 0) {
      return [];
    }

    // Simple LCG (Linear Congruential Generator) for deterministic random selection
    // Using constants from Numerical Recipes
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    let rng = seed;

    const nextRandom = (): number => {
      rng = (a * rng + c) % m;
      return rng / m;
    };

    // Filter features based on density
    return features.filter(() => nextRandom() < density);
  }
}
