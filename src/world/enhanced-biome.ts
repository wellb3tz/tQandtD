import { BiomeConfig, BiomeSystem } from './biome';
import { BiomeType } from './chunk';
import { NoiseEngine, NoiseConfig } from '../core/noise';
import { ClimateSystem, ClimateConfig, DEFAULT_CLIMATE_CONFIG } from './climate';
import { BiomeCompatibilityMatrix } from './biome-compatibility';

/**
 * Enhanced biome configuration extending base BiomeConfig
 */
export interface EnhancedBiomeConfig extends BiomeConfig {
  /** Enable transition zones (default: true) */
  enableTransitions: boolean;
  /** Transition zone width in world units (default: 10) */
  transitionWidth: number;

  /** Enable micro-biomes (default: true) */
  enableMicroBiomes: boolean;
  /**
   * Micro-biome placement density parameter.
   *
   * Valid range: [0.0, 0.5]
   * - 0.0: No micro-biomes are placed
   * - 0.25: Moderate density (~50% of noise range passes threshold)
   * - 0.5: Maximum density (~100% of noise range passes threshold)
   *
   * Higher values increase the probability that a position passes the noise threshold check.
   * Actual placement is further constrained by terrain-aware conditions:
   * - OASIS/POND require depressions (height below neighbourhood average)
   * - CLEARING/GROVE require flat terrain (low gradient)
   *
   * Default: 0.1
   */
  microBiomeFrequency: number;
  /** Maximum micro-biome size in tiles (default: 20) */
  microBiomeMaxSize: number;

  /** Enable elevation bands in mountains (default: true) */
  enableElevationBands: boolean;
  /** Snow line elevation threshold (default: 0.8) */
  snowLineElevation: number;
  /** Tree line elevation threshold (default: 0.75) */
  treeLineElevation: number;

  // -------------------------------------------------------------------------
  // New climate / compatibility fields (all optional, default false / undefined)
  // -------------------------------------------------------------------------

  /**
   * Activates ClimateSystem for temperature and moisture computation.
   * When false (default), the existing BiomeSystem noise-only path is used,
   * producing bit-identical results to the pre-feature implementation.
   */
  enableClimateSystem?: boolean;

  /**
   * Activates biome compatibility enforcement via BiomeCompatibilityMatrix.
   * When false (default), blend weights are identical to the current behaviour.
   */
  enableCompatibilityMatrix?: boolean;

  /**
   * All ClimateSystem parameters.
   * When enableClimateSystem is true and this is absent, DEFAULT_CLIMATE_CONFIG is used.
   */
  climateConfig?: ClimateConfig;

  /**
   * Minimum depression depth for OASIS / POND micro-biome placement.
   *
   * A position is classified as a depression when:
   * (centerHeight - neighbourAvg) < -depressionDepthThreshold
   *
   * where neighbourAvg is the average height of the four cardinal neighbours (±1 world unit).
   *
   * Recommended range: [0.03, 0.08]
   * - Lower values (0.03): More sensitive, detects shallow depressions
   * - Higher values (0.08): Less sensitive, only deep depressions qualify
   * - 0.0: All positions are potential depressions (falls back to noise-only placement)
   *
   * Default: 0.05
   */
  depressionDepthThreshold?: number;

  /**
   * Maximum terrain gradient for CLEARING / GROVE micro-biome placement.
   *
   * A position is classified as flat terrain when:
   * gradient < clearingGradientThreshold
   *
   * where gradient is the root-mean-square of height differences to the four cardinal neighbours:
   * sqrt((dx1² + dx2² + dy1² + dy2²) / 4)
   *
   * Recommended range: [0.02, 0.05]
   * - Lower values (0.02): Stricter, only very flat terrain qualifies
   * - Higher values (0.05): More permissive, allows gentle slopes
   * - Very high values (e.g., 1.0): All positions are flat (falls back to noise-only placement)
   *
   * Default: 0.03
   */
  clearingGradientThreshold?: number;

  /**
   * When true, uses the legacy (buggy) threshold formula
   * `threshold = 1.0 - microBiomeFrequency * 2` for backward compatibility
   * with worlds generated before this fix.
   *
   * @deprecated Will be removed in the next major version.
   *             Migrate to the corrected formula by setting this to false (default).
   */
  useLegacyMicroBiomeThreshold?: boolean;
}

/**
 * Micro-biome types
 */
export enum MicroBiomeType {
  OASIS = 0,        // In deserts
  CLEARING = 1,     // In forests
  POND = 2,         // In plains
  GROVE = 3,        // In tundra
}

/**
 * Elevation band types for mountains
 */
export enum ElevationBand {
  FOOTHILLS = 0,    // Below tree line, forested
  SLOPES = 1,       // Above tree line, rocky
  PEAKS = 2,        // Above snow line, snowy
}

/**
 * Enhanced biome data with additional information
 */
export interface EnhancedBiomeData {
  /** Primary biome type */
  biome: BiomeType;
  /** Biome blend weights for smooth transitions */
  weights: Map<BiomeType, number>;
  /** Micro-biome type if present */
  microBiome?: MicroBiomeType;
  /** Elevation band for mountain biomes */
  elevationBand?: ElevationBand;
  /** Transition factor (0 = pure biome, 1 = full transition) */
  transitionFactor: number;
}

/**
 * Enhanced biome system with transition zones, micro-biomes, and elevation bands.
 * Extends the base BiomeSystem with additional features for more realistic biome generation.
 *
 * New opt-in features (all disabled by default for backward compatibility):
 * - ClimateSystem: geographically plausible temperature/moisture
 * - BiomeCompatibilityMatrix: prevents impossible biome neighbours
 * - Terrain-aware micro-biome placement
 */
export class EnhancedBiomeSystem extends BiomeSystem {
  private microBiomeNoise: NoiseEngine;
  private enhancedConfig: EnhancedBiomeConfig;

  /** ClimateSystem instance, or null when enableClimateSystem is false. */
  private climateSystem: ClimateSystem | null;
  /** BiomeCompatibilityMatrix instance, or null when enableCompatibilityMatrix is false. */
  private compatibilityMatrix: BiomeCompatibilityMatrix | null;

  /** Cached noise config for micro-biome sampling — avoids per-tile object allocation. */
  private readonly microBiomeNoiseConfig: NoiseConfig = {
    octaves: 3,
    persistence: 0.5,
    lacunarity: 2.0,
    scale: 50,
  };

  /**
   * Creates a new EnhancedBiomeSystem with the given seed and configuration.
   * @param seed   - Numeric seed for deterministic biome generation.
   * @param config - Enhanced biome configuration parameters.
   */
  constructor(seed: number, config: EnhancedBiomeConfig) {
    super(seed, config);
    // Use a different seed for micro-biome noise to avoid correlation
    this.microBiomeNoise = new NoiseEngine(seed + 2000);
    this.enhancedConfig = config;

    // Instantiate ClimateSystem when opted in
    this.climateSystem = config.enableClimateSystem === true
      ? new ClimateSystem(seed, config.climateConfig ?? DEFAULT_CLIMATE_CONFIG)
      : null;

    // Instantiate BiomeCompatibilityMatrix when opted in
    this.compatibilityMatrix = config.enableCompatibilityMatrix === true
      ? new BiomeCompatibilityMatrix()
      : null;
  }

  /**
   * Gets enhanced biome data at a world position.
   * Includes transition zones, micro-biomes, and elevation bands.
   * @param x         - World X coordinate.
   * @param y         - World Y coordinate.
   * @param getHeight - Callback function to get height at any world position.
   * @returns Enhanced biome data with transitions and micro-biomes.
   */
  getEnhancedBiome(
    x: number,
    y: number,
    getHeight: (worldX: number, worldY: number) => number,
  ): EnhancedBiomeData {
    // Sample height at center position for primary biome classification
    const height = getHeight(x, y);

    // Compute temperature and moisture — use ClimateSystem when enabled,
    // otherwise fall through to the parent BiomeSystem noise-only path via getBiome.
    let biome: BiomeType;
    if (this.climateSystem !== null) {
      const temperature = this.climateSystem.getTemperature(x, y, height);
      const moisture    = this.climateSystem.getMoisture(x, y, height, getHeight);
      biome = this.classifyBiomeFromClimate(height, temperature, moisture);
    } else {
      biome = this.getBiome(x, y, height);
    }

    // Calculate transition factor first (needed for adaptive blending)
    const transitionFactor = this.enhancedConfig.enableTransitions
      ? this.calculateTransitionFactor(x, y, getHeight)
      : 0;

    // Get blend weights
    // Strategy: preserve center biome color, blend only at edges
    let weights: Map<BiomeType, number>;
    if (!this.enhancedConfig.enableTransitions) {
      // No transitions: pure biome colors
      weights = new Map([[biome, 1.0]]);
    } else {
      // Transitions enabled: blend on boundaries while preserving center
      // Calculate how much to blend based on distance to boundary
      const blendAmount = transitionFactor * Math.min(this.enhancedConfig.transitionWidth / 10, 1.0);
      
      if (blendAmount < 0.1) {
        // Very low blend: keep pure color
        weights = new Map([[biome, 1.0]]);
      } else {
        // Blend with neighbors, but keep strong center bias
        // Use small radius to only sample immediate neighbors
        const sampleRadius = 2.0 + blendAmount * 3.0; // 2-5 units
        const neighborWeights = this.getBiomeWeightsWithRadius(x, y, getHeight, sampleRadius);
        
        // Boost center biome weight to preserve it
        const centerBoost = 1.0 - blendAmount * 0.5; // 0.5-1.0
        const centerWeight = neighborWeights.get(biome) || 0;
        neighborWeights.set(biome, centerWeight + centerBoost);
        
        // Renormalize
        let total = 0;
        for (const w of neighborWeights.values()) total += w;
        weights = new Map();
        for (const [b, w] of neighborWeights.entries()) {
          weights.set(b, w / total);
        }
      }
    }

    // Apply compatibility matrix weight correction when enabled
    if (this.compatibilityMatrix !== null) {
      this.applyCompatibilityCorrection(weights);
    }

    // Check for micro-biome (terrain-aware when getHeight is available)
    const microBiome = this.enhancedConfig.enableMicroBiomes
      ? this.getMicroBiome(x, y, biome, getHeight, height)
      : undefined;

    // Determine elevation band for mountains
    const elevationBand = this.enhancedConfig.enableElevationBands && biome === BiomeType.MOUNTAIN
      ? this.getElevationBand(height)
      : undefined;

    return {
      biome,
      weights,
      microBiome,
      elevationBand,
      transitionFactor,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Classifies a biome from pre-computed climate values.
   * Mirrors the logic in BiomeSystem.getBiome but accepts explicit temperature/moisture.
   */
  private classifyBiomeFromClimate(height: number, temperature: number, moisture: number): BiomeType {
    if (height < 0.3) return BiomeType.OCEAN;
    if (height < 0.35) return BiomeType.BEACH;
    if (height > 0.7) return BiomeType.MOUNTAIN;

    if (temperature < -0.3) {
      return moisture > 0.2 ? BiomeType.TAIGA : BiomeType.TUNDRA;
    } else if (temperature > 0.3) {
      return moisture < -0.2 ? BiomeType.DESERT : BiomeType.PLAINS;
    } else {
      return moisture > 0.2 ? BiomeType.FOREST : BiomeType.PLAINS;
    }
  }

  /**
   * Applies BiomeCompatibilityMatrix weight correction in-place.
   * For each non-primary biome that is incompatible with the primary biome,
   * its weight is zeroed and transferred to the intermediate biome.
   */
  private applyCompatibilityCorrection(weights: Map<BiomeType, number>): void {
    if (weights.size === 0) return;

    // Find primary biome (highest weight)
    let primaryBiome: BiomeType = BiomeType.PLAINS;
    let primaryWeight = -1;
    for (const [biome, weight] of weights) {
      if (weight > primaryWeight) {
        primaryWeight = weight;
        primaryBiome = biome;
      }
    }

    const matrix = this.compatibilityMatrix!;

    // Two-pass: first accumulate onto intermediates, then zero incompatible biomes.
    // This avoids allocating a temporary array.
    for (const [biome, weight] of weights) {
      if (biome === primaryBiome || weight === 0) continue;
      if (!matrix.isCompatible(primaryBiome, biome)) {
        const intermediate = matrix.getIntermediate(primaryBiome, biome);
        if (intermediate !== undefined) {
          weights.set(intermediate, (weights.get(intermediate) ?? 0) + weight);
        }
      }
    }
    // Zero out incompatible biomes in a second pass
    for (const [biome] of weights) {
      if (biome === primaryBiome) continue;
      if (!matrix.isCompatible(primaryBiome, biome)) {
        weights.set(biome, 0);
      }
    }
  }

  /**
   * Determines if a micro-biome should exist at this location.
   * Applies terrain-aware placement conditions before the noise threshold check.
   *
   * @param x          - World X coordinate.
   * @param y          - World Y coordinate.
   * @param parentBiome - The parent biome type.
   * @param getHeight  - Callback to sample terrain height.
   * @param height     - Pre-sampled height at (x, y).
   * @returns Micro-biome type or undefined.
   */
  private getMicroBiome(
    x: number,
    y: number,
    parentBiome: BiomeType,
    getHeight: (worldX: number, worldY: number) => number,
    height: number,
  ): MicroBiomeType | undefined {
    const depressionThreshold = this.enhancedConfig.depressionDepthThreshold ?? 0.05;
    const gradientThreshold   = this.enhancedConfig.clearingGradientThreshold ?? 0.03;

    // Terrain-aware pre-checks per micro-biome type
    switch (parentBiome) {
      case BiomeType.DESERT:
      case BiomeType.PLAINS: {
        // OASIS / POND: only in terrain depressions
        // Sample heights at cardinal neighbours using stack-local variables (no heap allocation)
        const h_xp = getHeight(x + 1, y);
        const h_xm = getHeight(x - 1, y);
        const h_yp = getHeight(x, y + 1);
        const h_ym = getHeight(x, y - 1);
        const neighbourAvg = (h_xp + h_xm + h_yp + h_ym) / 4;
        // Gate OASIS/POND placement: only in depressions
        // When depressionDepthThreshold is 0.0, all positions pass (noise-only fallback)
        if ((height - neighbourAvg) >= -depressionThreshold) return undefined;
        break;
      }
      case BiomeType.FOREST:
      case BiomeType.TUNDRA: {
        // CLEARING / GROVE: only on low-gradient (flat) terrain
        // Compute gradient using stack-local variables (no heap allocation)
        const dx1 = getHeight(x + 1, y) - height;
        const dx2 = getHeight(x - 1, y) - height;
        const dy1 = getHeight(x, y + 1) - height;
        const dy2 = getHeight(x, y - 1) - height;
        const gradient = Math.sqrt((dx1 * dx1 + dx2 * dx2 + dy1 * dy1 + dy2 * dy2) / 4);
        // Gate CLEARING/GROVE placement: only on flat terrain
        // When clearingGradientThreshold is very high (e.g. 1.0), all positions pass (noise-only fallback)
        if (gradient >= gradientThreshold) return undefined;
        break;
      }
      default:
        break;
    }

    // Noise threshold check (existing logic) — use cached config to avoid per-tile allocation
    const noiseValue = this.microBiomeNoise.fbm(x, y, this.microBiomeNoiseConfig);
    
    // Clamp microBiomeFrequency to [0.0, 0.5] to prevent threshold overflow
    const clampedFrequency = Math.max(0.0, Math.min(0.5, this.enhancedConfig.microBiomeFrequency));
    
    // Compute threshold: legacy path uses * 2, corrected path uses * 4
    const threshold = this.enhancedConfig.useLegacyMicroBiomeThreshold === true
      ? 1.0 - clampedFrequency * 2  // legacy (buggy)
      : 1.0 - clampedFrequency * 4; // corrected
    
    if (noiseValue < threshold) return undefined;

    // Size check — pre-compute trig values to avoid per-iteration Math.cos/sin calls
    const sampleDirections = 8;
    let maxExtent = 0;
    for (let i = 0; i < sampleDirections; i++) {
      const angle = (i / sampleDirections) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      let extent = 0;
      for (let distance = 1; distance <= this.enhancedConfig.microBiomeMaxSize; distance++) {
        const sampleX = x + cosA * distance;
        const sampleY = y + sinA * distance;
        const sampleNoise = this.microBiomeNoise.fbm(sampleX, sampleY, this.microBiomeNoiseConfig);
        if (sampleNoise >= threshold) {
          extent = distance;
        } else {
          break;
        }
      }
      maxExtent = Math.max(maxExtent, extent);
    }
    if (maxExtent > this.enhancedConfig.microBiomeMaxSize) return undefined;

    // Map parent biome to micro-biome type
    switch (parentBiome) {
      case BiomeType.DESERT:  return MicroBiomeType.OASIS;
      case BiomeType.FOREST:  return MicroBiomeType.CLEARING;
      case BiomeType.PLAINS:  return MicroBiomeType.POND;
      case BiomeType.TUNDRA:  return MicroBiomeType.GROVE;
      default:                return undefined;
    }
  }

  /**
   * Computes terrain gradient magnitude using the ClimateSystem if available,
   * otherwise uses the same inline RMS formula.
   */
  private computeGradientLocal(
    x: number,
    y: number,
    getHeight: (wx: number, wy: number) => number,
    height: number,
  ): number {
    if (this.climateSystem !== null) {
      return this.climateSystem.computeGradient(x, y, getHeight);
    }
    // Inline RMS formula (same as ClimateSystem.computeGradient with step=1)
    const dx1 = getHeight(x + 1, y) - height;
    const dx2 = getHeight(x - 1, y) - height;
    const dy1 = getHeight(x, y + 1) - height;
    const dy2 = getHeight(x, y - 1) - height;
    return Math.sqrt((dx1 * dx1 + dx2 * dx2 + dy1 * dy1 + dy2 * dy2) / 4);
  }

  /**
   * Determines elevation band for mountain terrain.
   * @param height - Height value (0-1 range).
   * @returns Elevation band type.
   */
  private getElevationBand(height: number): ElevationBand {
    if (height >= this.enhancedConfig.snowLineElevation) {
      return ElevationBand.PEAKS;
    } else if (height >= this.enhancedConfig.treeLineElevation) {
      return ElevationBand.SLOPES;
    } else {
      return ElevationBand.FOOTHILLS;
    }
  }

  /**
   * Calculates transition factor based on distance to biome boundaries.
   * Uses fixed detection radius to identify boundaries, transitionWidth only affects blend strength.
   * @param x         - World X coordinate.
   * @param y         - World Y coordinate.
   * @param getHeight - Callback function to get height at any world position.
   * @returns Transition factor (0-1), where 1 = on boundary, 0 = center of biome.
   */
  private calculateTransitionFactor(
    x: number,
    y: number,
    getHeight: (worldX: number, worldY: number) => number,
  ): number {
    const centerHeight = getHeight(x, y);
    const centerBiome  = this.getBiome(x, y, centerHeight);

    // Fixed detection radius to identify biome boundaries
    const detectionRadius = 8;
    const sampleCount  = 8;
    let differentBiomeCount = 0;

    for (let i = 0; i < sampleCount; i++) {
      const angle   = (i / sampleCount) * Math.PI * 2;
      const sampleX = x + Math.cos(angle) * detectionRadius;
      const sampleY = y + Math.sin(angle) * detectionRadius;
      const sampleHeight = getHeight(sampleX, sampleY);
      const sampleBiome  = this.getBiome(sampleX, sampleY, sampleHeight);
      if (sampleBiome !== centerBiome) {
        differentBiomeCount++;
      }
    }

    // Return 0-1 factor: 0 = pure biome center, 1 = on boundary
    return differentBiomeCount / sampleCount;
  }
}
