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
   * @param chunkSeed - Unique seed for this chunk
   * @param chunkSize - Size of the chunk (width and height)
   * @returns Float32Array containing height values in [0, 1] range
   */
  generateHeightmap(chunkSeed: number, chunkSize: number): Float32Array {
    const heightmap = new Float32Array(chunkSize * chunkSize);
    const noise = new NoiseEngine(chunkSeed);

    for (let y = 0; y < chunkSize; y++) {
      for (let x = 0; x < chunkSize; x++) {
        const index = y * chunkSize + x;
        heightmap[index] = this.getHeightInternal(x, y, noise);
      }
    }

    return heightmap;
  }

  /**
   * Gets height at a specific world position.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param seed - Seed for noise generation
   * @returns Height value in [0, 1] range
   */
  getHeight(x: number, y: number, seed: number): number {
    const noise = new NoiseEngine(seed);
    return this.getHeightInternal(x, y, noise);
  }

  /**
   * Internal method to compute height at a position using a noise engine.
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param noise - NoiseEngine instance to use
   * @returns Height value in [0, 1] range
   */
  private getHeightInternal(x: number, y: number, noise: NoiseEngine): number {
    // Apply domain warping to coordinates for organic patterns
    const [warpedX, warpedY] = noise.domainWarp(x, y, this.config.warpStrength);

    // Configure fBM parameters
    const noiseConfig: NoiseConfig = {
      octaves: this.config.octaves,
      persistence: this.config.persistence,
      lacunarity: this.config.lacunarity,
      scale: this.config.baseScale,
    };

    // Sample fBM noise at warped coordinates
    const noiseValue = noise.fbm(warpedX, warpedY, noiseConfig);

    // Normalize from [-1, 1] to [0, 1] and apply height multiplier
    let height = (noiseValue + 1) * 0.5 * this.config.heightMultiplier;

    // Clamp to [0, 1] range
    height = Math.max(0, Math.min(1, height));

    return height;
  }
}
