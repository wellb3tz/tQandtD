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

  // Skewing and unskewing factors for 3D simplex grid
  private static readonly F3 = 1.0 / 3.0;
  private static readonly G3 = 1.0 / 6.0;

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
   * Generates 3D Simplex noise at the given coordinates.
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param z - Z coordinate
   * @returns Noise value in range [-1, 1]
   */
  noise3D(x: number, y: number, z: number): number {
    // Handle invalid coordinates gracefully
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return 0;
    }

    const F3 = NoiseEngine.F3;
    const G3 = NoiseEngine.G3;

    // Skew the input space to determine which simplex cell we're in
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;

    // Unskew the cell origin back to (x,y,z) space
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;

    // The x,y,z distances from the cell origin
    const x0 = x - X0;
    const y0 = y - Y0;
    const z0 = z - Z0;

    // Determine which simplex we are in
    let i1: number, j1: number, k1: number; // Offsets for second corner
    let i2: number, j2: number, k2: number; // Offsets for third corner

    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; // X Y Z order
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; // X Z Y order
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; // Z X Y order
      }
    } else {
      if (y0 < z0) {
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; // Z Y X order
      } else if (x0 < z0) {
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; // Y Z X order
      } else {
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; // Y X Z order
      }
    }

    // Offsets for second corner in (x,y,z) unskewed coords
    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;

    // Offsets for third corner in (x,y,z) unskewed coords
    const x2 = x0 - i2 + 2.0 * G3;
    const y2 = y0 - j2 + 2.0 * G3;
    const z2 = z0 - k2 + 2.0 * G3;

    // Offsets for last corner in (x,y,z) unskewed coords
    const x3 = x0 - 1.0 + 3.0 * G3;
    const y3 = y0 - 1.0 + 3.0 * G3;
    const z3 = z0 - 1.0 + 3.0 * G3;

    // Work out the hashed gradient indices of the four simplex corners
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
    const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
    const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];

    // Calculate the contribution from the four corners
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot3(NoiseEngine.GRAD3[gi0], x0, y0, z0);
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot3(NoiseEngine.GRAD3[gi1], x1, y1, z1);
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot3(NoiseEngine.GRAD3[gi2], x2, y2, z2);
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 >= 0) {
      t3 *= t3;
      n3 = t3 * t3 * this.dot3(NoiseEngine.GRAD3[gi3], x3, y3, z3);
    }

    // Add contributions from each corner and scale to [-1, 1]
    return 32.0 * (n0 + n1 + n2 + n3);
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
   * Generates 3D fractional Brownian motion (fBM) noise.
   * Combines multiple octaves of 3D noise for more natural-looking patterns.
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param z - Z coordinate
   * @param config - Noise configuration
   * @returns Noise value in range approximately [-1, 1]
   * @throws {Error} If config parameters are invalid
   */
  fbm3D(x: number, y: number, z: number, config: NoiseConfig): number {
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
      total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;

      maxValue += amplitude;
      amplitude *= config.persistence;
      frequency *= config.lacunarity;
    }

    // Normalize to [-1, 1] range
    return total / maxValue;
  }

  /**
   * Generates ridge (inverted absolute) fractional Brownian motion noise.
   * Produces sharp mountain ridges instead of smooth hills by folding the
   * noise: each octave contributes `1 - |noise|` instead of `noise`.
   * Result is in approximately [0, 1] range (higher = ridge peak).
   */
  ridgeFbm(x: number, y: number, config: NoiseConfig): number {
    if (config.octaves < 1) throw new Error('Invalid config: octaves must be at least 1');
    if (config.persistence <= 0) throw new Error('Invalid config: persistence must be greater than 0');
    if (config.lacunarity <= 0) throw new Error('Invalid config: lacunarity must be greater than 0');

    let total = 0;
    let frequency = config.scale;
    let amplitude = 1;
    let maxValue = 0;
    let prev = 1.0; // weight from previous octave for sharpening

    for (let i = 0; i < config.octaves; i++) {
      // Fold: 1 - |n| turns valleys into ridges
      const n = 1.0 - Math.abs(this.noise2D(x * frequency, y * frequency));
      // Square to sharpen the ridge peaks
      const ridge = n * n;
      // Weight by previous octave so fine detail only appears on ridges
      total += ridge * amplitude * prev;
      prev = ridge;

      maxValue += amplitude;
      amplitude *= config.persistence;
      frequency *= config.lacunarity;
    }

    return total / maxValue; // approximately [0, 1]
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
   * Applies 3D domain warping to coordinates for more organic noise patterns.
   * Distorts the input coordinates using 3D noise before sampling.
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param z - Z coordinate
   * @param strength - Warping strength multiplier
   * @returns Warped [x, y, z] coordinates
   */
  domainWarp3D(x: number, y: number, z: number, strength: number): [number, number, number] {
    // Use offset noise samples to warp the coordinates in 3D space
    const offsetX = this.noise3D(x + 0.1, y + 0.1, z + 0.1) * strength;
    const offsetY = this.noise3D(x + 5.2, y + 5.2, z + 5.2) * strength;
    const offsetZ = this.noise3D(x + 9.7, y + 9.7, z + 9.7) * strength;
    
    return [x + offsetX, y + offsetY, z + offsetZ];
  }

  /**
   * Helper function to compute dot product for 2D gradient.
   */
  private dot2(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }

  /**
   * Helper function to compute dot product for 3D gradient.
   */
  private dot3(g: number[], x: number, y: number, z: number): number {
    return g[0] * x + g[1] * y + g[2] * z;
  }
}
