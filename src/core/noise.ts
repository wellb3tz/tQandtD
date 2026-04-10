import { SeededRNG } from './rng';

/**
 * Configuration for noise generation with fractional Brownian motion.
 */
export interface NoiseConfig {
  /** Number of noise octaves to combine */
  octaves: number;
  /** Amplitude multiplier for each successive octave (typically 0.5) */
  persistence: number;
  /** Frequency multiplier for each successive octave (typically 2.0) */
  lacunarity: number;
  /** Base scale factor for noise coordinates */
  scale: number;
}

/**
 * Noise generation engine using Simplex noise algorithm.
 * Provides deterministic noise generation with seed support.
 */
export class NoiseEngine {
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  // Simplex noise gradient vectors
  private static readonly GRAD3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];

  // Skewing and unskewing factors for 2D simplex grid
  private static readonly F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  private static readonly G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

  /**
   * Creates a new NoiseEngine with the given seed.
   * @param seed - Numeric seed for deterministic noise generation
   */
  constructor(seed: number) {
    // Initialize permutation table using seeded RNG
    const rng = new SeededRNG(seed);
    const p = new Uint8Array(256);
    
    // Fill with values 0-255
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    
    // Shuffle using Fisher-Yates with seeded RNG
    for (let i = 255; i > 0; i--) {
      const j = rng.nextInt(0, i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    // Duplicate permutation table
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  /**
   * Generates 2D Simplex noise at the given coordinates.
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Noise value in range [-1, 1]
   */
  noise2D(x: number, y: number): number {
    // Handle invalid coordinates gracefully
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return 0;
    }

    const F2 = NoiseEngine.F2;
    const G2 = NoiseEngine.G2;

    // Skew the input space to determine which simplex cell we're in
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    
    // Unskew the cell origin back to (x,y) space
    const X0 = i - t;
    const Y0 = j - t;
    
    // The x,y distances from the cell origin
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine which simplex we are in
    let i1: number, j1: number;
    if (x0 > y0) {
      i1 = 1; j1 = 0; // Lower triangle, XY order: (0,0)->(1,0)->(1,1)
    } else {
      i1 = 0; j1 = 1; // Upper triangle, YX order: (0,0)->(0,1)->(1,1)
    }

    // Offsets for middle corner in (x,y) unskewed coords
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    
    // Offsets for last corner in (x,y) unskewed coords
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    // Work out the hashed gradient indices of the three simplex corners
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    // Calculate the contribution from the three corners
    let n0 = 0, n1 = 0, n2 = 0;
    
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot2(NoiseEngine.GRAD3[gi0], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot2(NoiseEngine.GRAD3[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot2(NoiseEngine.GRAD3[gi2], x2, y2);
    }

    // Add contributions from each corner and scale to [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * Generates fractional Brownian motion (fBM) noise.
   * Combines multiple octaves of noise for more natural-looking patterns.
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param config - Noise configuration
   * @returns Noise value in range approximately [-1, 1]
   * @throws {Error} If config parameters are invalid
   */
  fbm(x: number, y: number, config: NoiseConfig): number {
    if (config.octaves < 1) {
      throw new Error('Invalid config: octaves must be at least 1');
    }
    if (config.persistence <= 0) {
      throw new Error('Invalid config: persistence must be greater than 0');
    }
    if (config.lacunarity <= 0) {
      throw new Error('Invalid config: lacunarity must be greater than 0');
    }

    let total = 0;
    let frequency = config.scale;
    let amplitude = 1;
    let maxValue = 0; // Used for normalizing result to [-1, 1]

    for (let i = 0; i < config.octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      
      maxValue += amplitude;
      amplitude *= config.persistence;
      frequency *= config.lacunarity;
    }

    // Normalize to [-1, 1] range
    return total / maxValue;
  }

  /**
   * Applies domain warping to coordinates for more organic noise patterns.
   * Distorts the input coordinates using noise before sampling.
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param strength - Warping strength multiplier
   * @returns Warped [x, y] coordinates
   */
  domainWarp(x: number, y: number, strength: number): [number, number] {
    // Use offset noise samples to warp the coordinates
    const offsetX = this.noise2D(x + 0.1, y + 0.1) * strength;
    const offsetY = this.noise2D(x + 5.2, y + 5.2) * strength;
    
    return [x + offsetX, y + offsetY];
  }

  /**
   * Helper function to compute dot product for 2D gradient.
   */
  private dot2(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }
}
