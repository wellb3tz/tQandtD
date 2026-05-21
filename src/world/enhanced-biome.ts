import { BiomeConfig, BiomeSystem } from './biome';
import { BiomeType } from './chunk';
import { ClimateSystem, ClimateConfig, DEFAULT_CLIMATE_CONFIG } from './climate';
import { BiomeCompatibilityMatrix } from './biome-compatibility';
import { NoiseEngine, type NoiseConfig } from '../core/noise';

/**
 * Enhanced biome configuration extending base BiomeConfig
 */
export interface EnhancedBiomeConfig extends BiomeConfig {
  /** Enable transition zones (default: true) */
  enableTransitions: boolean;
  /** Transition zone width in meters (default: 10) */
  transitionWidth: number;


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
   * When true (default), uses geographically plausible temperature/moisture
   * with latitude gradient, altitude cooling, and valley moisture bonus.
   * Set to false to use the legacy noise-only path for backward compatibility.
   */
  enableClimateSystem?: boolean;

  /**
   * Activates biome compatibility enforcement via BiomeCompatibilityMatrix.
   * When true (default), prevents impossible biome transitions.
   * Set to false to disable compatibility enforcement.
   */
  enableCompatibilityMatrix?: boolean;

  /**
   * All ClimateSystem parameters.
   * When enableClimateSystem is true and this is absent, DEFAULT_CLIMATE_CONFIG is used.
   */
  climateConfig?: ClimateConfig;

  /** Global temperature offset applied by ClimateSystem [-1, 1]. Default 0. */
  worldTemperatureOffset?: number;
  /** Global moisture offset applied by ClimateSystem [-1, 1]. Default 0. */
  worldMoistureOffset?: number;

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
  /** Elevation band for mountain biomes */
  elevationBand?: ElevationBand;
  /** Transition factor (0 = pure biome, 1 = full transition) */
  transitionFactor: number;
  /** Dynamic snow-line used for this tile [0-1] */
  dynamicSnowLine: number;
  /** Dynamic tree-line used for this tile [0-1] */
  dynamicTreeLine: number;
}

/**
 * Enhanced biome system with transition zones and elevation bands.
 * Extends the base BiomeSystem with additional features for more realistic biome generation.
 *
 * New opt-in features (all disabled by default for backward compatibility):
 * - ClimateSystem: geographically plausible temperature/moisture
 * - BiomeCompatibilityMatrix: prevents impossible biome neighbours
 */
export class EnhancedBiomeSystem extends BiomeSystem {
  private enhancedConfig: EnhancedBiomeConfig;

  /** Cached global temperature offset for fast access. */
  private readonly worldTemperatureOffset: number;
  /** ClimateSystem instance, or null when enableClimateSystem is false. */
  private climateSystem: ClimateSystem | null;
  /** BiomeCompatibilityMatrix instance, or null when enableCompatibilityMatrix is false. */
  private compatibilityMatrix: BiomeCompatibilityMatrix | null;
  /** Noise source for volcanic activity (active vs dormant peaks). */
  private readonly volcanoActivityNoise: NoiseEngine;
  /** Re-used noise config to avoid per-call allocations. */
  private readonly volcanoNoiseConfig: NoiseConfig;

  /**
   * Creates a new EnhancedBiomeSystem with the given seed and configuration.
   * @param seed   - Numeric seed for deterministic biome generation.
   * @param config - Enhanced biome configuration parameters.
   */
  constructor(seed: number, config: EnhancedBiomeConfig) {
    super(seed, config);
    this.enhancedConfig = config;

    // Build ClimateConfig, merging optional offsets into defaults.
    const climateCfg: ClimateConfig = {
      ...DEFAULT_CLIMATE_CONFIG,
      ...config.climateConfig,
      worldTemperatureOffset: config.worldTemperatureOffset ?? config.climateConfig?.worldTemperatureOffset ?? DEFAULT_CLIMATE_CONFIG.worldTemperatureOffset,
      worldMoistureOffset: config.worldMoistureOffset ?? config.climateConfig?.worldMoistureOffset ?? DEFAULT_CLIMATE_CONFIG.worldMoistureOffset,
    };

    // Instantiate ClimateSystem when opted in (default: true)
    this.climateSystem = config.enableClimateSystem !== false
      ? new ClimateSystem(seed, climateCfg)
      : null;

    this.worldTemperatureOffset = climateCfg.worldTemperatureOffset;

    // Instantiate BiomeCompatibilityMatrix when opted in (default: true)
    this.compatibilityMatrix = config.enableCompatibilityMatrix !== false
      ? new BiomeCompatibilityMatrix()
      : null;

    // Volcano activity noise - seed offset 4000 avoids collision with other systems.
    this.volcanoActivityNoise = new NoiseEngine(seed + 4000);
    this.volcanoNoiseConfig = {
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 0.002,
    };
  }

  /**
   * Samples temperature and moisture at a world position using the active
   * ClimateSystem. Returns null when ClimateSystem is disabled.
   */
  sampleClimate(
    x: number,
    y: number,
    height: number,
    getHeight: (wx: number, wy: number) => number,
  ): { temperature: number; moisture: number } | null {
    if (this.climateSystem === null) return null;
    return {
      temperature: this.climateSystem.getTemperature(x, y, height),
      moisture: this.climateSystem.getMoisture(x, y, height, getHeight),
    };
  }

  /**
   * Returns the global temperature offset used by the climate system.
   * Returns 0 when ClimateSystem is disabled.
   */
  getWorldTemperatureOffset(): number {
    return this.worldTemperatureOffset;
  }

  /**
   * Returns the dynamic snow-line for the current global climate [0-1].
   * Falls back to config value when ClimateSystem is disabled.
   */
  getClimateSnowLine(): number {
    return this.climateSystem !== null
      ? this.climateSystem.getDynamicSnowLine()
      : this.enhancedConfig.snowLineElevation;
  }

  /**
   * Returns the dynamic tree-line for the current global climate [0-1].
   * Falls back to config value when ClimateSystem is disabled.
   */
  getClimateTreeLine(): number {
    return this.climateSystem !== null
      ? this.climateSystem.getDynamicTreeLine()
      : this.enhancedConfig.treeLineElevation;
  }

  /**
   * Gets enhanced biome data at a world position.
   * Includes transition zones and elevation bands.
   * @param x         - World X coordinate.
   * @param y         - World Y coordinate.
   * @param getHeight - Callback function to get height at any world position.
   * @returns Enhanced biome data with transitions and elevation bands.
   */
  getEnhancedBiome(
    x: number,
    y: number,
    getHeight: (worldX: number, worldY: number) => number,
  ): EnhancedBiomeData {
    // Sample height at center position for primary biome classification
    const height = getHeight(x, y);

    // Compute temperature and moisture - use ClimateSystem when enabled,
    // otherwise fall through to the parent BiomeSystem noise-only path via getBiome.
    let biome: BiomeType;
    if (this.climateSystem !== null) {
      const temperature = this.climateSystem.getTemperature(x, y, height);
      const moisture    = this.climateSystem.getMoisture(x, y, height, getHeight);
      biome = this.classifyBiomeFromClimate(height, temperature, moisture, x, y, getHeight);
    } else {
      biome = this.getBiome(x, y, height);
    }

    // Ocean is absolute - never blend land biomes into it.
    if (biome === BiomeType.OCEAN) {
      return {
        biome: BiomeType.OCEAN,
        weights: new Map([[BiomeType.OCEAN, 1.0]]),
        elevationBand: undefined,
        transitionFactor: 0,
        dynamicSnowLine: this.climateSystem !== null
          ? this.climateSystem.getDynamicSnowLine()
          : this.enhancedConfig.snowLineElevation,
        dynamicTreeLine: this.climateSystem !== null
          ? this.climateSystem.getDynamicTreeLine()
          : this.enhancedConfig.treeLineElevation,
      };
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
        const sampleRadius = 2.0 + blendAmount * 3.0; // 2-5 meters

        // Use the same climate-aware classifier for neighbour samples so that
        // blending never mixes in biomes computed with the legacy noise path.
        const biomeLookup = this.climateSystem !== null
          ? (sx: number, sy: number, sh: number): BiomeType => {
              const t = this.climateSystem!.getTemperature(sx, sy, sh);
              const m = this.climateSystem!.getMoisture(sx, sy, sh, getHeight);
              return this.classifyBiomeFromClimate(sh, t, m, sx, sy, getHeight);
            }
          : undefined;

        const neighborWeights = this.getBiomeWeightsWithRadius(
          x, y, getHeight, sampleRadius, undefined, biomeLookup,
        );

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


    // Compute dynamic elevation thresholds from climate when available
    const dynamicSnowLine = this.climateSystem !== null
      ? this.climateSystem.getDynamicSnowLine()
      : this.enhancedConfig.snowLineElevation;
    const dynamicTreeLine = this.climateSystem !== null
      ? this.climateSystem.getDynamicTreeLine()
      : this.enhancedConfig.treeLineElevation;

    // Determine elevation band for mountains
    const elevationBand = this.enhancedConfig.enableElevationBands && biome === BiomeType.MOUNTAIN
      ? this.getElevationBand(height, dynamicSnowLine, dynamicTreeLine)
      : undefined;

    return {
      biome,
      weights,
      elevationBand,
      transitionFactor,
      dynamicSnowLine,
      dynamicTreeLine,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Classifies a biome from pre-computed climate values.
   * Mirrors the logic in BiomeSystem.getBiome but accepts explicit temperature/moisture
   * and supports all 13 biome types including the extended set.
   *
   * @param height      - Terrain height [0,1]
   * @param temperature - Climate temperature [-1,1]
   * @param moisture    - Climate moisture [-1,1]
   * @param x           - World X (used for water-proximity beach check)
   * @param y           - World Y (used for water-proximity beach check)
   * @param getHeight   - Height sampler (used for water-proximity beach check)
   */
  private classifyBiomeFromClimate(
    height: number,
    temperature: number,
    moisture: number,
    x: number,
    y: number,
    getHeight: (wx: number, wy: number) => number,
  ): BiomeType {
    if (height < 0.3)  return BiomeType.OCEAN;
    if (height > 0.7) {
      if (height > 0.85) {
        // Active volcanoes stay volcanic regardless of temperature (magma heat);
        // dormant ones only classify as volcanic when it's warm enough.
        const isActive = this.isActiveVolcano(x, y);
        if (isActive || temperature > 0.2) {
          return BiomeType.VOLCANIC;
        }
      }
      return BiomeType.MOUNTAIN;
    }

    // Coastal zone: height 0.30-0.42.
    // Only assign BEACH if ocean water is reachable within a short radius.
    // This prevents inland "beaches" on plateaus at the same height.
    if (height < 0.42) {
      if (this.isNearWater(x, y, getHeight, 24)) {
        // Steep coastal cliffs -> rocky shore instead of sand
        const dx1 = getHeight(x + 2, y) - height;
        const dx2 = getHeight(x - 2, y) - height;
        const dy1 = getHeight(x, y + 2) - height;
        const dy2 = getHeight(x, y - 2) - height;
        const gradient = Math.sqrt((dx1*dx1 + dx2*dx2 + dy1*dy1 + dy2*dy2) / 4);
        // Very steep coast -> mountain/rock biome, gentle coast -> beach
        return gradient > 0.08 ? BiomeType.MOUNTAIN : BiomeType.BEACH;
      }
      // Not near water - fall through to climate-based classification
    }

    if (temperature < -0.5) {
      if (height > 0.6) return BiomeType.GLACIER;
      return moisture > 0.1 ? BiomeType.TAIGA : BiomeType.TUNDRA;
    } else if (temperature < -0.3) {
      return moisture > 0.2 ? BiomeType.TAIGA : BiomeType.TUNDRA;
    } else if (temperature > 0.5) {
      if (moisture > 0.4)  return BiomeType.RAINFOREST;
      if (moisture < -0.2) return BiomeType.DESERT;
      return BiomeType.SAVANNA;
    } else if (temperature > 0.3) {
      if (moisture < -0.2) return BiomeType.DESERT;
      if (moisture > 0.5)  return BiomeType.RAINFOREST;
      return BiomeType.PLAINS;
    } else {
      if (moisture > 0.5)  return BiomeType.SWAMP;
      if (moisture > 0.2)  return BiomeType.FOREST;
      return BiomeType.PLAINS;
    }
  }

  /**
   * Returns true when the peak at (x, y) is an active volcano.
   * Active volcanoes (~20 % of qualifying peaks) remain volcanic even in
   * cold climates because subsurface magma keeps the summit warm.
   */
  private isActiveVolcano(x: number, y: number): boolean {
    const raw = this.volcanoActivityNoise.fbm(x, y, this.volcanoNoiseConfig);
    const activity = (raw + 1) * 0.5; // map to [0, 1]
    return activity > 0.8; // top 20 % are active
  }

  /**
   * Returns true if any tile within `radius` meters is ocean (height < 0.3).
   * Uses a sparse 8-direction sample for performance.
   */
  private isNearWater(
    x: number,
    y: number,
    getHeight: (wx: number, wy: number) => number,
    radius: number,
  ): boolean {
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const sx = x + Math.cos(angle) * radius;
      const sy = y + Math.sin(angle) * radius;
      if (getHeight(sx, sy) < 0.3) return true;
    }
    // Also check at half radius for closer water
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2 + Math.PI / steps;
      const sx = x + Math.cos(angle) * (radius * 0.4);
      const sy = y + Math.sin(angle) * (radius * 0.4);
      if (getHeight(sx, sy) < 0.3) return true;
    }
    return false;
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
   * Determines elevation band for mountain terrain using dynamic thresholds.
   * @param height      - Height value (0-1 range).
   * @param snowLine    - Dynamic snow-line elevation.
   * @param treeLine    - Dynamic tree-line elevation.
   * @returns Elevation band type.
   */
  private getElevationBand(height: number, snowLine: number, treeLine: number): ElevationBand {
    if (height >= snowLine) {
      return ElevationBand.PEAKS;
    } else if (height >= treeLine) {
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
    const centerBiome  = this.getTransitionBiome(x, y, centerHeight, getHeight);

    // Fixed detection radius to identify biome boundaries
    const detectionRadius = 8;
    const sampleCount  = 8;
    let differentBiomeCount = 0;

    for (let i = 0; i < sampleCount; i++) {
      const angle   = (i / sampleCount) * Math.PI * 2;
      const sampleX = x + Math.cos(angle) * detectionRadius;
      const sampleY = y + Math.sin(angle) * detectionRadius;
      const sampleHeight = getHeight(sampleX, sampleY);
      const sampleBiome  = this.getTransitionBiome(sampleX, sampleY, sampleHeight, getHeight);
      if (sampleBiome !== centerBiome) {
        differentBiomeCount++;
      }
    }

    // Return 0-1 factor: 0 = pure biome center, 1 = on boundary
    return differentBiomeCount / sampleCount;
  }

  private getTransitionBiome(
    x: number,
    y: number,
    height: number,
    getHeight: (worldX: number, worldY: number) => number,
  ): BiomeType {
    if (this.climateSystem === null) {
      return this.getBiome(x, y, height);
    }

    const temperature = this.climateSystem.getTemperature(x, y, height);
    const moisture = this.climateSystem.getMoisture(x, y, height, getHeight);
    return this.classifyBiomeFromClimate(height, temperature, moisture, x, y, getHeight);
  }
}
