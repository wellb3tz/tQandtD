import { NoiseEngine, NoiseConfig } from '../core/noise';
import { sampleDirectionalClimateField, type DirectionalClimateConfig, type DirectionalClimateSample } from '../world/climate';

const DIRECTIONAL_HEIGHT_MULTIPLIER_SCALE = 0.12;

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
  /** Optional world-axis terrain/climate field shared with biome generation. */
  directionalClimateConfig?: DirectionalClimateConfig;
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
   * Typical range: 0.001 (huge continents) - 0.005 (smaller islands).
   */
  continentalScale?: number;
  /**
   * How strongly the continental layer influences the final height (default: 0.6).
   * 0 = no effect, 1 = continental layer fully controls ocean/land split.
   */
  continentalStrength?: number;
  /**
   * Enable deterministic cliff and escarpment shaping on land (default: true).
   * This is layered on top of the existing continental/mountain terrain rather
   * than replacing mountain generation.
   */
  enableCliffs?: boolean;
  /**
   * Strength of geometric cliff and ledge shaping in highlands and steep coasts
   * (default: 0.42). Higher values create sharper escarpment walls.
   */
  cliffStrength?: number;
  /**
   * Elevation where inland cliff shaping starts to become visible (default: 0.52).
   */
  cliffElevationStart?: number;
  /**
   * Noise scale for cliff belts and broken escarpment fields (default: continentalScale * 9).
   */
  cliffScale?: number;
  /**
   * Enable deterministic canyon carving on land (default: true).
   * This subtractive layer is applied after mountain/cliff shaping.
   */
  enableCanyons?: boolean;
  /**
   * Overall canyon carving strength (default: 0.55).
   */
  canyonStrength?: number;
  /**
   * Maximum normalized depth removed by major canyon corridors (default: 0.28).
   */
  canyonDepth?: number;
  /**
   * Noise scale for large canyon corridors (default: continentalScale * 2.4).
   */
  canyonScale?: number;
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
  /** Ridge noise engine for mountain ridges (seed offset +6666). */
  private ridgeNoise: NoiseEngine | null = null;
  /** Cliff belt noise for escarpments and coastal rock faces (seed offset +5555). */
  private cliffNoise: NoiseEngine | null = null;
  /** Fine fracture noise for broken cliff faces (seed offset +4444). */
  private cliffFractureNoise: NoiseEngine | null = null;
  /** Regional mask that makes canyons appear in clusters (seed offset +2222). */
  private canyonRegionNoise: NoiseEngine | null = null;
  /** Long linear canyon corridor noise (seed offset +3333). */
  private canyonNoise: NoiseEngine | null = null;
  /**
   * Cached primary noise engine keyed by world seed.
   * Avoids allocating a new NoiseEngine on every getHeightAt() call -
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
  private readonly mountainDetailConfig: NoiseConfig;
  private readonly desertDuneConfig: NoiseConfig;
  private readonly desertBasinConfig: NoiseConfig;
  private readonly cliffConfig: NoiseConfig;
  private readonly cliffFractureConfig: NoiseConfig;
  private readonly canyonRegionConfig: NoiseConfig;
  private readonly canyonConfig: NoiseConfig;

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
      persistence: 0.52,
      lacunarity: 2.08,
      scale: config.baseScale * 1.62,
    };

    this.mountainDetailConfig = {
      octaves: 4,
      persistence: 0.46,
      lacunarity: 2.35,
      scale: config.baseScale * 3.1,
    };

    this.desertDuneConfig = {
      octaves: 4,
      persistence: 0.56,
      lacunarity: 2.08,
      scale: config.baseScale * 0.42,
    };

    this.desertBasinConfig = {
      octaves: 3,
      persistence: 0.54,
      lacunarity: 2.0,
      scale: config.baseScale * 0.16,
    };

    this.cliffConfig = {
      octaves: 4,
      persistence: 0.52,
      lacunarity: 2.05,
      scale: config.cliffScale ?? (config.continentalScale ?? 0.002) * 9,
    };

    this.cliffFractureConfig = {
      octaves: 3,
      persistence: 0.48,
      lacunarity: 2.3,
      scale: (config.cliffScale ?? (config.continentalScale ?? 0.002) * 9) * 3.6,
    };

    const canyonScale = config.canyonScale ?? (config.continentalScale ?? 0.002) * 2.4;
    this.canyonRegionConfig = {
      octaves: 2,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: canyonScale * 0.42,
    };

    this.canyonConfig = {
      octaves: 4,
      persistence: 0.54,
      lacunarity: 2.12,
      scale: canyonScale,
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
      this.cliffNoise        = new NoiseEngine(worldSeed + 5555);
      this.cliffFractureNoise = new NoiseEngine(worldSeed + 4444);
      this.canyonRegionNoise = new NoiseEngine(worldSeed + 2222);
      this.canyonNoise       = new NoiseEngine(worldSeed + 3333);
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
    // Reuse cached NoiseEngine for the same seed - avoids per-call allocation
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
    const seaLevel = 0.3;

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

    // Normalize from [-1, 1] to [0, 1] and apply height multiplier.
    const directional = sampleDirectionalClimateField(x, y, this.config.directionalClimateConfig);
    const desertDuneBlend = this.getDesertDuneBlend(directional);
    const effectiveHeightMultiplier = this.config.heightMultiplier *
      (1 + directional.heightMultiplier * DIRECTIONAL_HEIGHT_MULTIPLIER_SCALE);
    let height = (noiseValue + 1) * 0.5 * effectiveHeightMultiplier;

    // Apply continental noise as a BASE LAYER
    if (this.continentalNoise !== null && this.coastlineNoise !== null) {
      const baseContinentalStrength = this.config.continentalStrength ?? 0.6;
      const cStrength = directional.oceanCoverageWeight > 0
        ? lerp(baseContinentalStrength, directional.oceanCoverage, directional.oceanCoverageWeight)
        : baseContinentalStrength;

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
        const shelfSmooth = shelfT * shelfT * (3.0 - 2.0 * shelfT);
        const nearShoreFade = 1.0 - Math.max(0, Math.min(1, (shelfT - 0.76) / 0.24));
        const detailAmplitude = 0.12 * (0.35 + (1.0 - shelfSmooth) * 0.65) * nearShoreFade;
        const seabedRise = Math.min(seaLevel - 0.001, smooth * seaLevel * 1.96);
        height = Math.max(0, Math.min(seaLevel - 0.001, seabedRise + (height - 0.5) * detailAmplitude));
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
          ridgeContrib = this.getAlpineRidgeContribution(x, y, mountainMask);
        }

        // Blend detail and ridge noise
        const blendedDetail = height * (1.0 - mountainMask * 0.74) + ridgeContrib * mountainMask * 0.74;
        const hiLand = seaLevel + (0.35 + mountainMask * 0.65) * (1.0 - seaLevel);
        const lo = seaLevel;
        height = lo + blendedDetail * (hiLand - lo) * landRise;
        height = Math.max(seaLevel + 0.001, height);
        height = this.applyCliffLandforms(x, y, height, mountainMask, shoreFactor, seaLevel);
        height = this.applyCanyonLandforms(x, y, height, mountainMask, shoreFactor, seaLevel);
      }
    }

    if (desertDuneBlend > 0 && height >= seaLevel) {
      height = this.applyDesertDunes(x, y, height, noise, desertDuneBlend, seaLevel);
    }

    // Clamp to [0, 1] range
    height = Math.max(0, Math.min(1, height));

    return height;
  }

  private getAlpineRidgeContribution(x: number, y: number, mountainMask: number): number {
    if (this.ridgeNoise === null) {
      return 0;
    }

    const center = this.ridgeNoise.ridgeFbm(x, y, this.ridgeConfig);
    const shoulderOffset = 3.5;
    const skirtOffset = 7;
    const shoulders = (
      this.ridgeNoise.ridgeFbm(x - shoulderOffset, y, this.ridgeConfig) +
      this.ridgeNoise.ridgeFbm(x + shoulderOffset, y, this.ridgeConfig) +
      this.ridgeNoise.ridgeFbm(x, y - shoulderOffset, this.ridgeConfig) +
      this.ridgeNoise.ridgeFbm(x, y + shoulderOffset, this.ridgeConfig)
    ) * 0.25;
    const skirt = (
      this.ridgeNoise.ridgeFbm(x - skirtOffset, y - skirtOffset, this.ridgeConfig) +
      this.ridgeNoise.ridgeFbm(x + skirtOffset, y - skirtOffset, this.ridgeConfig) +
      this.ridgeNoise.ridgeFbm(x - skirtOffset, y + skirtOffset, this.ridgeConfig) +
      this.ridgeNoise.ridgeFbm(x + skirtOffset, y + skirtOffset, this.ridgeConfig)
    ) * 0.25;
    const cross = this.ridgeNoise.ridgeFbm(x + 37.0, y - 19.0, this.ridgeConfig);
    const cragNoise = (this.ridgeNoise.fbm(x + 91.0, y - 53.0, this.mountainDetailConfig) + 1) * 0.5;
    const massedRidge = center * 0.52 + shoulders * 0.30 + skirt * 0.12 + cross * 0.06;
    const sharpened = Math.pow(Math.max(0, Math.min(1, massedRidge)), 0.88);
    const brokenRidge = sharpened + (cragNoise - 0.5) * 0.055 * mountainMask;
    return Math.max(0, Math.min(0.94, brokenRidge));
  }

  private applyCliffLandforms(
    x: number,
    y: number,
    height: number,
    mountainMask: number,
    shoreFactor: number,
    seaLevel: number,
  ): number {
    if (this.config.enableCliffs === false || this.cliffNoise === null || this.cliffFractureNoise === null) {
      return height;
    }

    const cliffStrength = Math.max(0, Math.min(1, this.config.cliffStrength ?? 0.42));
    if (cliffStrength <= 0) {
      return height;
    }

    const elevationStart = this.config.cliffElevationStart ?? 0.52;
    const highlandFactor = smoothstep(elevationStart, 0.82, height);
    const coastalFactor = shoreFactor * smoothstep(seaLevel + 0.045, seaLevel + 0.20, height);
    const beltNoise = (this.cliffNoise.fbm(x, y, this.cliffConfig) + 1) * 0.5;
    const fractureNoise = (this.cliffFractureNoise.fbm(x, y, this.cliffFractureConfig) + 1) * 0.5;

    const mountainCliffFactor = highlandFactor * smoothstep(0.22, 0.62, mountainMask);
    const coastalCliffFactor = coastalFactor * smoothstep(0.46, 0.82, fractureNoise) * 0.44;
    const beltMask = smoothstep(0.52, 0.82, beltNoise);
    const cliffMask = Math.max(
      beltMask * mountainCliffFactor,
      coastalCliffFactor,
    );

    if (cliffMask <= 0.01) {
      return height;
    }

    const relative = Math.max(0, height - seaLevel);
    const ledgeCount = 3 + Math.floor(fractureNoise * 2) + Math.floor(mountainMask * 2);
    const ledgeStep = (1 - seaLevel) / ledgeCount;
    const ledgePosition = relative / ledgeStep;
    const ledgeBase = Math.floor(ledgePosition);
    const ledgeT = ledgePosition - ledgeBase;
    const smoothedLedgeT = smoothstep(0.80, 0.90, ledgeT);
    const terracedHeight = seaLevel + (ledgeBase + smoothedLedgeT) * ledgeStep;

    const fractureOffset = (fractureNoise - 0.5) * 0.012 * (0.35 + mountainMask);
    const shaped = terracedHeight + fractureOffset * cliffMask;
    const terraceBlendFactor = Math.min(1, cliffMask * cliffStrength * 1.65);
    const terraceBlend = height + (shaped - height) * terraceBlendFactor;
    return Math.max(seaLevel + 0.001, Math.min(1, terraceBlend));
  }

  private applyCanyonLandforms(
    x: number,
    y: number,
    height: number,
    mountainMask: number,
    shoreFactor: number,
    seaLevel: number,
  ): number {
    if (this.config.enableCanyons === false || this.canyonNoise === null || this.canyonRegionNoise === null) {
      return height;
    }

    const strength = Math.max(0, Math.min(1, this.config.canyonStrength ?? 0.55));
    if (strength <= 0) {
      return height;
    }

    const elevationFactor = smoothstep(seaLevel + 0.12, 0.76, height);
    const shoreSuppression = 1 - Math.max(0, Math.min(1, shoreFactor * 1.2));
    if (elevationFactor <= 0 || shoreSuppression <= 0) {
      return height;
    }

    const region = (this.canyonRegionNoise.fbm(x, y, this.canyonRegionConfig) + 1) * 0.5;
    const regionMask = 0.42 + smoothstep(0.40, 0.76, region) * 0.58;
    const majorLine = this.canyonNoise.ridgeFbm(x, y, this.canyonConfig);

    const canyonFloor = smoothstep(0.58, 0.84, majorLine);
    const canyonWall = smoothstep(0.34, 0.68, majorLine) * (1 - canyonFloor * 0.22);
    const canyonProfile = Math.max(canyonFloor, canyonWall * 0.58);

    const highlandBoost = 0.86 + mountainMask * 0.42;
    const canyonDepth = this.config.canyonDepth ?? 0.28;
    const downwardPull = canyonProfile *
      canyonDepth *
      highlandBoost *
      regionMask *
      elevationFactor *
      shoreSuppression *
      strength;

    if (downwardPull <= 0.0005) {
      return height;
    }

    const floorHeight = seaLevel + 0.035 + mountainMask * 0.018;
    const antiMountainTarget = floorHeight + (height - floorHeight) * (1 - Math.min(0.92, canyonFloor * strength));
    const carved = height + (antiMountainTarget - height) * Math.min(1, canyonProfile * regionMask * strength * 1.18);
    return Math.max(floorHeight, Math.min(height - downwardPull * 0.18, carved));
  }

  private getDesertDuneBlend(directional: DirectionalClimateSample): number {
    const heat = Math.max(0, Math.min(1, (directional.temperature - 0.48) / 0.34));
    const dryness = Math.max(0, Math.min(1, (-directional.moisture - 0.24) / 0.48));
    return Math.max(0, Math.min(1, heat * 0.66 + dryness * 0.72 - 0.08));
  }

  private applyDesertDunes(
    x: number,
    y: number,
    height: number,
    noise: NoiseEngine,
    desertBlend: number,
    seaLevel: number,
  ): number {
    const ridge = noise.ridgeFbm(x + 27.0, y - 19.0, this.desertDuneConfig);
    const ripples = (noise.fbm(x - 113.0, y + 71.0, this.desertDuneConfig) + 1) * 0.5;
    const duneProfile = Math.max(0, Math.min(1, ridge * 0.84 + ripples * 0.16));
    const duneTarget = seaLevel + 0.035 + duneProfile * 0.19;
    const blend = Math.min(1, desertBlend * (0.58 + Math.max(0, height - seaLevel) * 1.15));
    let sculpted = height + (duneTarget - height) * blend;

    const basinCellSize = 56.0;
    const basinCellX = Math.floor(x / basinCellSize);
    const basinCellY = Math.floor(y / basinCellSize);
    const basinGate = (noise.fbm(basinCellX * 1.71 - 37.0, basinCellY * 1.71 + 53.0, this.desertBasinConfig) + 1) * 0.5;
    const basinChance = smoothstep(0.74, 0.94, basinGate);
    if (basinChance > 0) {
      const centerOffsetX = ((noise.fbm(basinCellX * 2.13 + 19.0, basinCellY * 2.13 - 29.0, this.desertBasinConfig) + 1) * 0.5 - 0.5) * 0.28;
      const centerOffsetY = ((noise.fbm(basinCellX * 2.17 - 11.0, basinCellY * 2.17 + 41.0, this.desertBasinConfig) + 1) * 0.5 - 0.5) * 0.28;
      const localX = x / basinCellSize - basinCellX - 0.5 - centerOffsetX;
      const localY = y / basinCellSize - basinCellY - 0.5 - centerOffsetY;
      const distance = Math.hypot(localX, localY);
      const innerRadius = 0.12 + basinGate * 0.05;
      const outerRadius = innerRadius + 0.42;
      const bowl = 1 - smoothstep(innerRadius, outerRadius, distance);
      const basinFloor = seaLevel + 0.018 + basinGate * 0.014;
      const basinDepth = (0.032 + basinGate * 0.05) * desertBlend;
      const basinTarget = Math.max(basinFloor, sculpted - basinDepth);
      sculpted = sculpted + (basinTarget - sculpted) * bowl * basinChance;
    }
    const ceiling = 0.685 - desertBlend * 0.02;
    const capped = Math.min(ceiling, sculpted);
    return Math.max(seaLevel + 0.01, capped);
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
