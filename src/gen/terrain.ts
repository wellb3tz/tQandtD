import { NoiseEngine, NoiseConfig } from '../core/noise';

/**
 * Configuration for terrain generation
 */
export interface TerrainConfig {
  /** Base scale factor for noise coordinates */
  baseScale: number;
  /** Number of noise octaves to combine */
  octaves: number;
  /** Amplitude multiplier for each successive octave */
  persistence: number;
  /** Frequency multiplier for each successive octave */
  lacunarity: number;
  /** Strength of domain warping effect */
  warpStrength: number;
  /** Multiplier for final height values */
  heightMultiplier: number;
  /** Enable 3D noise for terrain generation (optional) */
  enable3D?: boolean;
  /** Z-axis scale for 3D noise (optional) */
  zScale?: number;
}

/**
 * Terrain heightmap generator using multi-layer noise with domain warping.
 * Generates realistic terrain heightmaps for chunks.
 */
export class TerrainGenerator {
  private config: TerrainConfig;

  /**
   * Creates a new TerrainGenerator with the given configuration.
   * @param config - Terrain generation parameters
   */
  constructor(config: TerrainConfig) {
    this.config = config;
  }

  /**
   * Generates a complete heightmap for a chunk.
   * Creates (chunkSize + 1) x (chunkSize + 1) vertices to enable seamless boundaries.
   * The extra row and column of vertices overlap with adjacent chunks, ensuring
   * boundary vertices share identical world coordinates and heights.
   * 
   * @param worldSeed - World seed for noise generation (must be same for all chunks)
   * @param chunkSize - Size of the chunk (width and height)
   * @param chunkX - Chunk X coordinate (for world coordinate calculation)
   * @param chunkY - Chunk Y coordinate (for world coordinate calculation)
   * @param noiseEngine3D - Optional 3D noise engine for enhanced terrain generation
   * @returns Float32Array containing height values in [0, 1] range
   */
  generateHeightmap(worldSeed: number, chunkSize: number, chunkX: number = 0, chunkY: number = 0, noiseEngine3D?: NoiseEngine): Float32Array {
    // Generate (chunkSize + 1) x (chunkSize + 1) vertices for seamless boundaries
    const vertexCount = chunkSize + 1;
    const heightmap = new Float32Array(vertexCount * vertexCount);
    // Use world seed (not chunk seed) to ensure seamless boundaries across chunks
    const noise = noiseEngine3D || new NoiseEngine(worldSeed);
    
    // Check if 3D noise is enabled in config
    const use3D = this.config.enable3D ?? (noiseEngine3D !== undefined);

    // Iterate from 0 to chunkSize (inclusive) to create overlapping boundary vertices
    for (let y = 0; y <= chunkSize; y++) {
      for (let x = 0; x <= chunkSize; x++) {
        // Convert local coordinates to world coordinates for seamless boundaries
        const worldX = chunkX * chunkSize + x;
        const worldY = chunkY * chunkSize + y;
        
        const index = y * vertexCount + x;
        heightmap[index] = this.getHeightInternal(worldX, worldY, noise, use3D);
      }
    }

    return heightmap;
  }

  /**
   * Gets height at a specific world position.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param seed - Seed for noise generation
   * @param use3D - Whether to use 3D noise (default: false)
   * @returns Height value in [0, 1] range
   */
  getHeight(x: number, y: number, seed: number, use3D: boolean = false): number {
    const noise = new NoiseEngine(seed);
    return this.getHeightInternal(x, y, noise, use3D);
  }

  /**
   * Internal method to compute height at a position using a noise engine.
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param noise - NoiseEngine instance to use
   * @param use3D - Whether to use 3D noise for enhanced terrain generation
   * @returns Height value in [0, 1] range
   */
  private getHeightInternal(x: number, y: number, noise: NoiseEngine, use3D: boolean = false): number {
    // Configure fBM parameters
    const noiseConfig: NoiseConfig = {
      octaves: this.config.octaves,
      persistence: this.config.persistence,
      lacunarity: this.config.lacunarity,
      scale: this.config.baseScale,
    };

    let noiseValue: number;

    if (use3D) {
      // Use 3D noise with z-coordinate as a variation parameter
      // Apply domain warping in 3D space for organic patterns
      const zScale = this.config.zScale ?? 0.5; // Default to 0.5 if not specified
      const z = 0; // Use z=0 as base, could be varied for different terrain layers
      const [warpedX, warpedY, warpedZ] = noise.domainWarp3D(x, y, z * zScale, this.config.warpStrength);
      
      // Sample 3D fBM noise at warped coordinates
      noiseValue = noise.fbm3D(warpedX, warpedY, warpedZ, noiseConfig);
    } else {
      // Use 2D noise (backward compatible)
      // Apply domain warping to coordinates for organic patterns
      const [warpedX, warpedY] = noise.domainWarp(x, y, this.config.warpStrength);
      
      // Sample 2D fBM noise at warped coordinates
      noiseValue = noise.fbm(warpedX, warpedY, noiseConfig);
    }

    // Normalize from [-1, 1] to [0, 1] and apply height multiplier
    let height = (noiseValue + 1) * 0.5 * this.config.heightMultiplier;

    // Clamp to [0, 1] range
    height = Math.max(0, Math.min(1, height));

    return height;
  }
}
