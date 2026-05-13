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
  /** Mountain mask: mid-scale noise that determines where tall mountain ranges appear (seed offset +9999). */
  private mountainMaskNoise: NoiseEngine | null = null;
  /** Ridge noise engine for sharp mountain peaks (seed offset +6666). */
  private ridgeNoise: NoiseEngine | null = null;
  /**
   * Cached primary noise engine keyed by world seed.
   * Avoids allocating a new NoiseEngine on every getHeightAt() call —
   * the hot path during biome generation for neighbouring chunks.
   */
  private cachedNoise: NoiseEngine | null = null;
  private cachedNoiseSeed: number | null = null;
  
  // Pre-allocated noise configs to avoid object creation in hot path
  private readonly noiseConfig: NoiseConfig;
  private readonly continentalConfig: NoiseConfig;
  private readonly coastlineConfig: NoiseConfig;
  private readonly mountainMaskConfig: NoiseConfig;
  private readonly ridgeConfig: NoiseConfig;

  constructor(config: TerrainConfig) {
    this.config = config;
    
    // Pre-allocate noise configs (reused in getHeightInternal)
    this.noiseConfig = {
      octaves: config.octaves,
      persistence: config.persistence,
      lacunarity: config.lacunarity,
      scale: config.baseScale,
    };
    
    this.continentalConfig = {
      octaves: 2,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: config.continentalScale ?? 0.002,
    };
    
    this.coastlineConfig = {
      octaves: 4,
      persistence: 0.55,
      lacunarity: 2.1,
      scale: (config.continentalScale ?? 0.002) * 5,
    };
    
    this.mountainMaskConfig = {
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: (config.continentalScale ?? 0.002) * 4,
    };
    
    this.ridgeConfig = {
      octaves: 5,
      persistence: 0.5,
      lacunarity: 2.1,
      scale: config.baseScale * 1.5,
    };
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
      this.mountainMaskNoise = new NoiseEngine(worldSeed + 9999);
      this.ridgeNoise        = new NoiseEngine(worldSeed + 6666);
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

    // Reuse cached NoiseEngine for the same seed instead of allocating a new one
    // on every call. The hot path (biome generation) already uses this cache,
    // so generating the heightmap should benefit from it too.
    let noise: NoiseEngine;
    if (noiseEngine3D) {
      noise = noiseEngine3D;
    } else if (this.cachedNoiseSeed === worldSeed && this.cachedNoise) {
      noise = this.cachedNoise;
    } else {
      noise = new NoiseEngine(worldSeed);
      this.cachedNoise = noise;
      this.cachedNoiseSeed = worldSeed;
    }

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
    // Reuse cached NoiseEngine for the same seed — avoids per-call allocation
    // which is critical when getHeightAt is called ~32 000 times per chunk
    // during biome generation for neighbouring positions.
    if (this.cachedNoiseSeed !== seed) {
      this.cachedNoise = new NoiseEngine(seed);
      this.cachedNoiseSeed = seed;
    }
    const use3D = this.config.enable3D ?? false;
    return this.getHeightInternal(worldX, worldY, this.cachedNoise!, use3D);
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
    // Use pre-allocated noise config (no object creation in hot path)
    // Config values are already set in constructor
    let noiseValue: number;

    if (use3D) {
      // Use 3D noise with zScale controlling the Z-axis slice of the noise volume.
      const zScale = this.config.zScale ?? 0.5;
      const z = zScale;
      const [warpedX, warpedY, warpedZ] = noise.domainWarp3D(x, y, z, this.config.warpStrength);
      
      // Sample 3D fBM noise at warped coordinates
      noiseValue = noise.fbm3D(warpedX, warpedY, warpedZ, this.noiseConfig);
    } else {
      // Use 2D noise (backward compatible)
      const [warpedX, warpedY] = noise.domainWarp(x, y, this.config.warpStrength);
      
      // Sample 2D fBM noise at warped coordinates
      noiseValue = noise.fbm(warpedX, warpedY, this.noiseConfig);
    }

    // Normalize from [-1, 1] to [0, 1] and apply height multiplier
    let height = (noiseValue + 1) * 0.5 * this.config.heightMultiplier;

    // Apply continental noise as a BASE LAYER
    if (this.continentalNoise !== null && this.coastlineNoise !== null) {
      const seaLevel  = 0.3;
      const cStrength = this.config.continentalStrength ?? 0.6;

      // --- Layer 1: large-scale continental shape ---
      const rawContinental = this.continentalNoise.fbm(x, y, this.continentalConfig);
      const continental = (rawContinental + 1) * 0.5; // [0,1]

      // --- Layer 2: coastline erosion noise ---
      const rawCoast = this.coastlineNoise.fbm(x, y, this.coastlineConfig);
      const coastNoise = (rawCoast + 1) * 0.5; // [0,1]

      // Erode shoreline: apply coastline noise strongest at the shore boundary
      const distToShore = Math.abs(continental - cStrength);
      const shoreWidth  = 0.18;
      const shoreFactor = Math.max(0, 1.0 - distToShore / shoreWidth);
      const eroded = continental + (coastNoise - 0.5) * 0.22 * shoreFactor;

      // Continuous remapping
      let base: number;
      const t = (eroded - cStrength) / cStrength;
      const tClamped = Math.max(-1.0, Math.min(1.0, t));
      const s = (tClamped + 1.0) * 0.5;
      const smooth = s * s * (3.0 - 2.0 * s);

      if (s < 0.5) {
        // Ocean side
        base = smooth * seaLevel * 2.0;
        base = Math.min(seaLevel - 0.001, base);
      } else {
        // Land side
        base = seaLevel + (smooth - 0.5) * 2.0 * (1.0 - seaLevel);
      }

      if (base < seaLevel) {
        // Ocean bathymetry
        const shelfT = Math.min(s / 0.5, 1.0);
        const seabedRise = shelfT * shelfT * (seaLevel * 0.85);
        height = Math.min(seaLevel - 0.001, seabedRise + height * 0.12);
      } else {
        // Land
        const landT = Math.min(1.0, (s - 0.5) / 0.5);
        const landRise = Math.min(1.0, landT / 0.12);

        // --- Mountain mask ---
        let mountainMask = 0;
        if (this.mountainMaskNoise !== null) {
          const rawMask = this.mountainMaskNoise.fbm(x, y, this.mountainMaskConfig);
          const maskRaw = (rawMask + 1) * 0.5;
          mountainMask = Math.max(0, Math.min(1, (maskRaw - 0.55) / 0.20));
        }

        // --- Ridge noise ---
        let ridgeContrib = 0;
        if (this.ridgeNoise !== null && mountainMask > 0) {
          ridgeContrib = this.ridgeNoise.ridgeFbm(x, y, this.ridgeConfig);
        }

        // Blend detail and ridge noise
        const blendedDetail = height * (1.0 - mountainMask * 0.7) + ridgeContrib * mountainMask * 0.7;
        const hiLand = seaLevel + (0.35 + mountainMask * 0.65) * (1.0 - seaLevel);
        const lo = seaLevel;
        height = lo + blendedDetail * (hiLand - lo) * landRise;
        height = Math.max(seaLevel + 0.001, height);
      }
    }

    // Clamp to [0, 1] range
    height = Math.max(0, Math.min(1, height));

    return height;
  }
}
