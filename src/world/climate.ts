import { NoiseEngine } from '../core/noise';

/**
 * Configuration for the ClimateSystem.
 * All fields have safe defaults via DEFAULT_CLIMATE_CONFIG.
 */
export interface ClimateConfig {
  /** Latitude gradient strength [0-1], default 0.5.
   *  Controls how strongly world Y (latitude) influences temperature. */
  latitudeGradientStrength: number;
  /** Large-scale climate noise scale, default 0.001 */
  climateScale: number;
  /** Small-scale detail noise scale, default 0.005 */
  detailScale: number;
  /** Detail layer blend weight [0-1], default 0.3.
   *  Detail layer contributes this fraction; climate layer contributes (1 - blend). */
  climateDetailBlend: number;
  /** Height threshold above which altitude cooling begins [0-1], default 0.6 */
  altitudeCoolingThreshold: number;
  /** Temperature reduction rate above threshold [0-2], default 1.0 */
  altitudeCoolingRate: number;
  /** Gradient magnitude below which valley moisture bonus applies [0-1], default 0.05 */
  valleyGradientThreshold: number;
  /** Maximum moisture bonus in flat/valley areas [0-1], default 0.3 */
  valleyMoistureBonus: number;

  /** Global temperature offset [-1-1], default 0.
   *  Shifts all temperatures up (positive) or down (negative). */
  worldTemperatureOffset: number;

  /** Global moisture offset [-1-1], default 0.
   *  Shifts all moisture values up (positive) or down (negative). */
  worldMoistureOffset: number;
}

/**
 * Default values for ClimateConfig.
 */
export const DEFAULT_CLIMATE_CONFIG: ClimateConfig = {
  latitudeGradientStrength: 0.5,
  climateScale: 0.001,
  detailScale: 0.005,
  climateDetailBlend: 0.3,
  altitudeCoolingThreshold: 0.6,
  altitudeCoolingRate: 1.0,
  valleyGradientThreshold: 0.05,
  valleyMoistureBonus: 0.3,
  worldTemperatureOffset: 0,
  worldMoistureOffset: 0,
};

/**
 * Half-height of the world used to normalise the latitude gradient.
 * Positions range from -WORLD_HALF_HEIGHT to +WORLD_HALF_HEIGHT in Y.
 */
const WORLD_HALF_HEIGHT = 10000;

/**
 * ClimateSystem computes geographically plausible temperature and moisture values
 * incorporating latitude gradient, altitude cooling, multi-scale noise, and valley
 * moisture accumulation.
 *
 * Hot-path methods (getTemperature, getMoisture, computeGradient) allocate no heap
 * objects; all intermediate values are stack-local numeric variables.
 */
export class ClimateSystem {
  private readonly tempClimate: NoiseEngine;
  private readonly tempDetail: NoiseEngine;
  private readonly moistClimate: NoiseEngine;
  private readonly moistDetail: NoiseEngine;
  private readonly config: ClimateConfig;

  /**
   * Creates a new ClimateSystem.
   * @param seed   - Numeric seed for deterministic noise generation.
   * @param config - Climate configuration parameters.
   * @throws {Error} If any config field is out of its valid range.
   */
  constructor(seed: number, config: ClimateConfig) {
    ClimateSystem.validateConfig(config);

    this.config = config;

    // Seed offsets 3000-3003 avoid collision with BiomeSystem (0, +1000) and
    // EnhancedBiomeSystem (+2000).
    this.tempClimate  = new NoiseEngine(seed + 3000);
    this.tempDetail   = new NoiseEngine(seed + 3001);
    this.moistClimate = new NoiseEngine(seed + 3002);
    this.moistDetail  = new NoiseEngine(seed + 3003);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns the dynamic snow-line elevation for the current climate config.
   *
   * Formula: 0.76 + worldTemperatureOffset x 0.15, clamped to [0.4, 1.0].
   * When the world is hotter the snow line rises (fewer snowy peaks);
   * when colder it drops (snow covers lower elevations).
   */
  getDynamicSnowLine(): number {
    return ClimateSystem.clamp(
      0.76 + this.config.worldTemperatureOffset * 0.15,
      0.4,
      1.0,
    );
  }

  /**
   * Returns the dynamic tree-line elevation for the current climate config.
   *
   * Formula: 0.75 + worldTemperatureOffset x 0.12, clamped to [0.35, 0.95].
   */
  getDynamicTreeLine(): number {
    return ClimateSystem.clamp(
      0.75 + this.config.worldTemperatureOffset * 0.12,
      0.35,
      0.95,
    );
  }

  /**
   * Returns temperature in [-1, 1] at the given world position.
   *
   * Incorporates:
   * - Latitudinal gradient (higher Y -> colder)
   * - Multi-scale noise blend (climate + detail layers)
   * - Altitude cooling above `altitudeCoolingThreshold`
   *
   * @param x      - World X coordinate.
   * @param y      - World Y coordinate.
   * @param height - Terrain height at (x, y) in [0, 1].
   * @returns Temperature clamped to [-1, 1].
   */
  getTemperature(x: number, y: number, height: number): number {
    const cfg = this.config;

    // Latitude base: higher Y -> more negative (colder)
    const latitudeBase = -y * cfg.latitudeGradientStrength / WORLD_HALF_HEIGHT;

    // Multi-scale noise blend
    const climateNoise = this.tempClimate.fbm(x, y, {
      octaves: 4, persistence: 0.5, lacunarity: 2.0, scale: cfg.climateScale,
    });
    const detailNoise = this.tempDetail.fbm(x, y, {
      octaves: 4, persistence: 0.5, lacunarity: 2.0, scale: cfg.detailScale,
    });
    const blendedNoise = climateNoise * (1 - cfg.climateDetailBlend) + detailNoise * cfg.climateDetailBlend;

    // Combine latitude base with noise contribution
    const rawTemp = latitudeBase + blendedNoise * (1 - cfg.latitudeGradientStrength);

    // Altitude cooling
    const altitudeDelta = height > cfg.altitudeCoolingThreshold
      ? (height - cfg.altitudeCoolingThreshold) * cfg.altitudeCoolingRate
      : 0;

    return ClimateSystem.clamp(rawTemp - altitudeDelta + cfg.worldTemperatureOffset, -1, 1);
  }

  /**
   * Returns moisture in [-1, 1] at the given world position.
   *
   * Incorporates:
   * - Multi-scale noise blend (climate + detail layers)
   * - Valley moisture bonus for low-gradient (flat/valley) terrain
   *
   * @param x         - World X coordinate.
   * @param y         - World Y coordinate.
   * @param height    - Terrain height at (x, y) in [0, 1].
   * @param getHeight - Callback to sample terrain height at neighbouring positions.
   * @returns Moisture clamped to [-1, 1].
   */
  getMoisture(
    x: number,
    y: number,
    height: number,
    getHeight: (wx: number, wy: number) => number,
  ): number {
    const cfg = this.config;

    // Multi-scale noise blend
    const climateNoise = this.moistClimate.fbm(x, y, {
      octaves: 4, persistence: 0.5, lacunarity: 2.0, scale: cfg.climateScale,
    });
    const detailNoise = this.moistDetail.fbm(x, y, {
      octaves: 4, persistence: 0.5, lacunarity: 2.0, scale: cfg.detailScale,
    });
    const blendedNoise = climateNoise * (1 - cfg.climateDetailBlend) + detailNoise * cfg.climateDetailBlend;

    // Valley moisture bonus
    const gradient = this.computeGradient(x, y, getHeight);
    const valleyBonus = gradient < cfg.valleyGradientThreshold
      ? (cfg.valleyGradientThreshold - gradient) / cfg.valleyGradientThreshold * cfg.valleyMoistureBonus
      : 0;

    return ClimateSystem.clamp(blendedNoise + valleyBonus + cfg.worldMoistureOffset, -1, 1);
  }

  /**
   * Computes terrain gradient magnitude at (x, y) using the RMS of height
   * differences to four cardinal neighbours.
   *
   * @param x         - World X coordinate.
   * @param y         - World Y coordinate.
   * @param getHeight - Callback to sample terrain height at neighbouring positions.
   * @param step      - Sampling distance in world units (default 1).
   * @returns Gradient magnitude >= 0.
   */
  computeGradient(
    x: number,
    y: number,
    getHeight: (wx: number, wy: number) => number,
    step = 1,
  ): number {
    const height = getHeight(x, y);
    const dx1 = getHeight(x + step, y) - height;
    const dx2 = getHeight(x - step, y) - height;
    const dy1 = getHeight(x, y + step) - height;
    const dy2 = getHeight(x, y - step) - height;
    return Math.sqrt((dx1 * dx1 + dx2 * dx2 + dy1 * dy1 + dy2 * dy2) / 4);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Clamps `value` to the closed interval [min, max]. */
  private static clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
  }

  /**
   * Validates all ClimateConfig fields and throws a descriptive Error for any
   * out-of-range value. Called once at construction time.
   */
  private static validateConfig(cfg: ClimateConfig): void {
    if (cfg.latitudeGradientStrength < 0 || cfg.latitudeGradientStrength > 1) {
      throw new Error(
        `ClimateConfig: latitudeGradientStrength must be in [0, 1], got ${cfg.latitudeGradientStrength}`,
      );
    }
    if (cfg.climateDetailBlend < 0 || cfg.climateDetailBlend > 1) {
      throw new Error(
        `ClimateConfig: climateDetailBlend must be in [0, 1], got ${cfg.climateDetailBlend}`,
      );
    }
    if (cfg.altitudeCoolingThreshold < 0 || cfg.altitudeCoolingThreshold > 1) {
      throw new Error(
        `ClimateConfig: altitudeCoolingThreshold must be in [0, 1], got ${cfg.altitudeCoolingThreshold}`,
      );
    }
    if (cfg.altitudeCoolingRate < 0 || cfg.altitudeCoolingRate > 2) {
      throw new Error(
        `ClimateConfig: altitudeCoolingRate must be in [0, 2], got ${cfg.altitudeCoolingRate}`,
      );
    }
    if (cfg.valleyGradientThreshold < 0 || cfg.valleyGradientThreshold > 1) {
      throw new Error(
        `ClimateConfig: valleyGradientThreshold must be in [0, 1], got ${cfg.valleyGradientThreshold}`,
      );
    }
    if (cfg.valleyMoistureBonus < 0 || cfg.valleyMoistureBonus > 1) {
      throw new Error(
        `ClimateConfig: valleyMoistureBonus must be in [0, 1], got ${cfg.valleyMoistureBonus}`,
      );
    }
    if (cfg.worldTemperatureOffset < -1 || cfg.worldTemperatureOffset > 1) {
      throw new Error(
        `ClimateConfig: worldTemperatureOffset must be in [-1, 1], got ${cfg.worldTemperatureOffset}`,
      );
    }
    if (cfg.worldMoistureOffset < -1 || cfg.worldMoistureOffset > 1) {
      throw new Error(
        `ClimateConfig: worldMoistureOffset must be in [-1, 1], got ${cfg.worldMoistureOffset}`,
      );
    }
    if (cfg.climateScale <= 0) {
      throw new Error(
        `ClimateConfig: climateScale must be > 0, got ${cfg.climateScale}`,
      );
    }
    if (cfg.detailScale <= 0) {
      throw new Error(
        `ClimateConfig: detailScale must be > 0, got ${cfg.detailScale}`,
      );
    }
  }
}
