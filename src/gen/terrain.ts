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
  /**
   * Enable continental noise layer (default: true).
   * Adds a large-scale low-frequency noise pass that creates broad ocean basins
   * and continental landmasses, preventing the "lakes everywhere" look.
   */
  enableContinentalness?: boolean;
  /**
   * Scale of the continental noise (default: 0.002).
   * Lower values = larger continents and ocean basins.
   * Typical range: 0.001 (huge continents) – 0.005 (smaller islands).
   */
  continentalScale?: number;
  /**
   * How strongly the continental layer influences the final height (default: 0.6).
   * 0 = no effect, 1 = continental layer fully controls ocean/land split.
   */
  continentalStrength?: number;
}

/**
 * Terrain heightmap generator using multi-layer noise with domain warping.
 * Generates realistic terrain heightmaps for chunks.
 */
export class TerrainGenerator {
  private config: TerrainConfig;
  /** Separate noise engine for continental-scale variation (seed offset +7777). */
  private continentalNoise: NoiseEngine | null = null;
  /** High-frequency noise for coastline erosion / jaggedness (seed offset +8888). */
  private coastlineNoise: NoiseEngine | null = null;

  constructor(config: TerrainConfig) {
    this.config = config;
  }

  /**
   * Initialises the continental noise engine with the world seed.
   * Must be called once before generateHeightmap() when continentalness is enabled.
   * Separated from the constructor so the seed (world-level) can be passed in.
   */
  initContinentalNoise(worldSeed: number): void {
    if (this.config.enableContinentalness !== false) {
      this.continentalNoise = new NoiseEngine(worldSeed + 7777);
      this.coastlineNoise   = new NoiseEngine(worldSeed + 8888);
    }
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

    // Lazily initialise continental noise on first call (needs world seed)
    if (this.continentalNoise === null && this.config.enableContinentalness !== false) {
      this.initContinentalNoise(worldSeed);
    }

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
   * Uses the same noise configuration as generateHeightmap() for consistency.
   * This method is deterministic: same world position and seed always returns same height.
   * 
   * @param worldX - World X coordinate
   * @param worldY - World Y coordinate
   * @param seed - Seed for noise generation (should match world seed)
   * @returns Height value in [0, 1] range
   */
  getHeightAt(worldX: number, worldY: number, seed: number): number {
    const noise = new NoiseEngine(seed);
    const use3D = this.config.enable3D ?? false;
    return this.getHeightInternal(worldX, worldY, noise, use3D);
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
      // Use 3D noise with zScale controlling the Z-axis slice of the noise volume.
      // Different zScale values sample different "layers" of the 3D noise field,
      // producing visually distinct terrain shapes.
      // zScale also scales X/Y coordinates in Z-space for more variation at higher values.
      const zScale = this.config.zScale ?? 0.5;
      const z = zScale; // Use zScale directly as the Z coordinate — non-zero so it has effect
      const [warpedX, warpedY, warpedZ] = noise.domainWarp3D(x, y, z, this.config.warpStrength);
      
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

    // Apply continental noise as a BASE LAYER.
    //
    // Key design: use a CONTINUOUS remapping curve (no hard ocean/land split)
    // so the terrain slopes gradually from deep ocean up to the shoreline.
    // This eliminates vertical cliff walls at continental edges.
    //
    // The curve has three zones:
    //   deep ocean  [0, seaLevel-shelf]  → maps to [0, seaLevel-0.08]   (flat deep floor)
    //   shelf       [seaLevel-shelf, seaLevel+shelf] → smooth S-curve    (gradual slope)
    //   land        [seaLevel+shelf, 1]  → maps to [seaLevel, 1]         (full terrain)
    //
    if (this.continentalNoise !== null && this.coastlineNoise !== null) {
      const cScale    = this.config.continentalScale    ?? 0.002;
      const cStrength = this.config.continentalStrength ?? 0.6;
      const seaLevel  = 0.3;

      // --- Layer 1: large-scale continental shape ---
      const rawContinental = this.continentalNoise.fbm(x, y, {
        octaves: 2,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: cScale,
      });
      const continental = (rawContinental + 1) * 0.5; // [0,1]

      // --- Layer 2: coastline erosion noise ---
      const rawCoast = this.coastlineNoise.fbm(x, y, {
        octaves: 4,
        persistence: 0.55,
        lacunarity: 2.1,
        scale: cScale * 5,
      });
      const coastNoise = (rawCoast + 1) * 0.5; // [0,1]

      // Erode shoreline: apply coastline noise strongest at the shore boundary
      const distToShore = Math.abs(continental - cStrength);
      const shoreWidth  = 0.18;
      const shoreFactor = Math.max(0, 1.0 - distToShore / shoreWidth);
      const eroded = continental + (coastNoise - 0.5) * 0.22 * shoreFactor;

      // --- Continuous remapping: single smooth curve across the entire ocean/land range ---
      // t < 0 = ocean side, t > 0 = land side, t=0 = shoreline
      // Map t from [-1, +1] to a height value with no discontinuities.
      //
      // Ocean (t < 0): smoothly rises from 0 (far ocean) to seaLevel (shore)
      // Land  (t > 0): starts at seaLevel and rises to 1.0 inland
      //
      // We use a single smooth-step across the full [-1, +1] range so there
      // are no zone boundaries and therefore no visible seams.

      let base: number;

      // Normalise eroded relative to shore threshold: -1 = far ocean, 0 = shore, +1 = far inland
      const t = (eroded - cStrength) / cStrength;

      // Remap t from [-1,1] to s in [0,1]
      const tClamped = Math.max(-1.0, Math.min(1.0, t));
      const s = (tClamped + 1.0) * 0.5; // 0 = far ocean, 0.5 = shore, 1 = far inland

      // Smooth-step: 3s²-2s³  (zero derivative at s=0 and s=1)
      const smooth = s * s * (3.0 - 2.0 * s);

      if (s < 0.5) {
        // Ocean side: map [0, 0.5] → [0, seaLevel)
        // smooth goes 0→0.5 here, remap to 0→seaLevel
        base = smooth * seaLevel * 2.0; // 0 → seaLevel
        base = Math.min(seaLevel - 0.001, base);
      } else {
        // Land side: map [0.5, 1] → [seaLevel, 1]
        // smooth goes 0.5→1 here, remap to seaLevel→1
        base = seaLevel + (smooth - 0.5) * 2.0 * (1.0 - seaLevel);
      }

      if (base < seaLevel) {
        // Ocean: detail noise adds very subtle variation, stays below sea level
        height = Math.min(seaLevel - 0.001, base + height * 0.04);
      } else {
        // Land: detail noise runs in full range [seaLevel, 1.0].
        // landT: 0 at shore, 1 far inland
        const landT = Math.min(1.0, (s - 0.5) / 0.5);

        // detailAmp ramps from 0 at shore to 1 inland (narrow ramp = thin flat beach)
        const landRise = Math.min(1.0, landT / 0.12);

        // height (detail noise) is in [0,1]. Remap to [seaLevel, 1.0] with amplitude scaling.
        // At shore (landRise=0): flat seaLevel. Inland (landRise=1): full [seaLevel, 1.0].
        // No base added to height — avoids the base+detail > 1.0 clamp that flattens peaks.
        const lo = seaLevel;
        const hi = 1.0;
        height = lo + height * (hi - lo) * landRise;
        height = Math.max(seaLevel + 0.001, height);
      }
    }

    // Clamp to [0, 1] range
    height = Math.max(0, Math.min(1, height));

    return height;
  }
}
