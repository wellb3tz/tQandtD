import { NoiseEngine, NoiseConfig } from '../core/noise';
import { BiomeType, NUM_BIOMES } from './chunk';
import {
  sampleDirectionalClimateBlend,
  sampleDirectionalClimateField,
  type DirectionalClimateConfig,
} from './climate';

/**
 * Configuration for biome generation
 */
export interface BiomeConfig {
  /** Scale factor for temperature noise */
  temperatureScale: number;
  /** Scale factor for moisture noise */
  moistureScale: number;
  /** Radius for biome blending in meters */
  blendRadius: number;
  /** Optional world-axis climate field shared with terrain generation. */
  directionalClimateConfig?: DirectionalClimateConfig;
}

/**
 * Classifies land biomes from normalized climate values after water/elevation
 * overrides have been handled by the caller.
 */
export function classifyLandBiomeFromClimate(
  temperature: number,
  moisture: number,
): BiomeType {
  if (temperature >= 0.55) {
    if (moisture < -0.55) return BiomeType.DESERT;
    if (moisture < 0.25) return BiomeType.SAVANNA;
    return BiomeType.RAINFOREST;
  }

  if (temperature >= 0.25) {
    if (moisture < -0.55) return BiomeType.DESERT;
    if (moisture < -0.15) return BiomeType.STEPPE;
    if (moisture < 0.25) return BiomeType.DRY_FOREST;
    if (moisture < 0.60) return BiomeType.FOREST;
    return BiomeType.SWAMP;
  }

  if (temperature >= -0.10) {
    if (moisture < -0.55) return BiomeType.STEPPE;
    if (moisture < -0.15) return BiomeType.PLAINS;
    if (moisture < 0.60) return BiomeType.FOREST;
    return BiomeType.SWAMP;
  }

  if (temperature >= -0.45) {
    if (moisture < -0.55) return BiomeType.TUNDRA;
    if (moisture < -0.15) return BiomeType.STEPPE;
    return BiomeType.TAIGA;
  }

  if (temperature >= -0.75) {
    if (moisture < -0.55) return BiomeType.POLAR;
    if (moisture < 0.25) return BiomeType.TUNDRA;
    return BiomeType.TAIGA;
  }

  if (moisture < 0.25) return BiomeType.POLAR;
  return BiomeType.TUNDRA;
}

/**
 * Biome classification and blending system.
 * Determines biome types based on height, temperature, and moisture values.
 */
export class BiomeSystem {
  private temperatureNoise: NoiseEngine;
  private moistureNoise: NoiseEngine;
  private config: BiomeConfig;

  /** Pre-allocated noise configs - avoids per-call object creation in hot paths. */
  private readonly temperatureNoiseConfig: NoiseConfig;
  private readonly moistureNoiseConfig: NoiseConfig;

  /**
   * Creates a new BiomeSystem with the given seed and configuration.
   * @param seed - Numeric seed for deterministic biome generation
   * @param config - Biome configuration parameters
   */
  constructor(seed: number, config: BiomeConfig) {
    // Use different seeds for temperature and moisture to avoid correlation
    this.temperatureNoise = new NoiseEngine(seed);
    this.moistureNoise = new NoiseEngine(seed + 1000);
    this.config = config;

    // Pre-allocate configs once - reused on every getTemperature/getMoisture call.
    this.temperatureNoiseConfig = {
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: config.temperatureScale,
    };
    this.moistureNoiseConfig = {
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: config.moistureScale,
    };
  }

  /**
   * Generates temperature value at world position.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @returns Temperature value in range [-1, 1]
   */
  getTemperature(x: number, y: number): number {
    const temperature = this.temperatureNoise.fbm(x, y, this.temperatureNoiseConfig);
    const directional = sampleDirectionalClimateField(x, y, this.config.directionalClimateConfig);
    const blend = sampleDirectionalClimateBlend(x, y, this.config.directionalClimateConfig);

    if (blend > 0) {
      return clamp(temperature * (1 - blend) + directional.temperature * blend, -1, 1);
    }

    return clamp(temperature + directional.temperature, -1, 1);
  }

  /**
   * Generates moisture value at world position.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @returns Moisture value in range [-1, 1]
   */
  getMoisture(x: number, y: number): number {
    const moisture = this.moistureNoise.fbm(x, y, this.moistureNoiseConfig);
    const directional = sampleDirectionalClimateField(x, y, this.config.directionalClimateConfig);
    const blend = sampleDirectionalClimateBlend(x, y, this.config.directionalClimateConfig);

    if (blend > 0) {
      return clamp(moisture * (1 - blend) + directional.moisture * blend, -1, 1);
    }

    return clamp(moisture + directional.moisture, -1, 1);
  }

  /**
   * Determines the biome type at a world position based on height, temperature, and moisture.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param height - Height value at this position (0-1 range)
   * @returns The biome type at this position
   */
  getBiome(
    x: number,
    y: number,
    height: number,
    tempCache?: Map<string, number>,
    moistureCache?: Map<string, number>,
  ): BiomeType {
    const cacheKey = `${x},${y}`;

    // Height-based biomes (override temperature/moisture)
    if (height < 0.3) {
      return BiomeType.OCEAN;
    }
    if (height < 0.42) {
      // Coastal zone - BEACH only if actually near water.
      // Without a getHeight callback here we use a wider band as approximation;
      // the enhanced system overrides this with a proper proximity check.
      return BiomeType.BEACH;
    }
    if (height > 0.7) {
      // High elevation - check temperature to decide mountain vs volcanic
      let temperature = tempCache?.get(cacheKey);
      if (temperature === undefined) {
        temperature = this.getTemperature(x, y);
        tempCache?.set(cacheKey, temperature);
      }
      if (height > 0.85 && temperature > 0.2) {
        // Extreme peaks in warm regions = volcanic
        return BiomeType.VOLCANIC;
      }
      if (height > 0.82 && temperature < -0.55) {
        return BiomeType.POLAR;
      }
      return BiomeType.MOUNTAIN;
    }

    // Temperature and moisture based biomes
    let temperature = tempCache?.get(cacheKey);
    if (temperature === undefined) {
      temperature = this.getTemperature(x, y);
      tempCache?.set(cacheKey, temperature);
    }

    let moisture = moistureCache?.get(cacheKey);
    if (moisture === undefined) {
      moisture = this.getMoisture(x, y);
      moistureCache?.set(cacheKey, moisture);
    }

    if (height < 0.48 && moisture >= 0.60 && temperature > -0.10) {
      return BiomeType.SWAMP;
    }

    return classifyLandBiomeFromClimate(temperature, moisture);
  }

  /**
   * Calculates biome blend weights for smooth transitions between biomes.
   * Samples nearby positions and returns weighted biome distribution.
   * Uses stronger center bias to preserve narrow biomes like beaches.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param getHeight - Callback function to get height at any world position
   * @returns Map of biome types to their blend weights (sum to 1.0)
   */
  getBiomeWeights(
    x: number,
    y: number,
    getHeight: (worldX: number, worldY: number) => number,
    biomeCache?: Map<string, BiomeType>,
  ): Map<BiomeType, number> {
    return this.getBiomeWeightsWithRadius(x, y, getHeight, this.config.blendRadius, biomeCache);
  }

  /**
   * Calculates biome blend weights with custom radius.
   * Used by EnhancedBiomeSystem for transition-aware blending.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param getHeight - Callback function to get height at any world position
   * @param radius - Custom blend radius
   * @returns Map of biome types to their blend weights (sum to 1.0)
   */
  getBiomeWeightsWithRadius(
    x: number,
    y: number,
    getHeight: (worldX: number, worldY: number) => number,
    radius: number,
    biomeCache?: Map<string, BiomeType>,
    biomeLookup?: (x: number, y: number, height: number) => BiomeType,
  ): Map<BiomeType, number> {
    // Use a fixed-size Float64Array indexed by BiomeType to
    // accumulate weights without allocating a Map per sample point.
    // The final Map is built once at the end - one allocation per tile instead of
    // one per sample (was 9 Map.get/set calls x 1024 tiles = 9 216 ops per chunk).
    const accumulator = new Float64Array(NUM_BIOMES);

    const step = radius / Math.sqrt(9); // 3x3 grid
    let totalWeight = 0;

    // Optional caches for temperature/moisture to avoid redundant fBM calls
    const tempCache = new Map<string, number>();
    const moistureCache = new Map<string, number>();
    const getBiomeFn = biomeLookup ?? ((sx: number, sy: number, sh: number) => this.getBiome(sx, sy, sh, tempCache, moistureCache));

    for (let dy = -radius; dy <= radius; dy += step) {
      for (let dx = -radius; dx <= radius; dx += step) {
        const sampleX = x + dx;
        const sampleY = y + dy;

        const sampleHeight = getHeight(sampleX, sampleY);
        const cacheKey = `${sampleX},${sampleY}`;
        let biome = biomeCache?.get(cacheKey);
        if (biome === undefined) {
          biome = getBiomeFn(sampleX, sampleY, sampleHeight);
          biomeCache?.set(cacheKey, biome);
        }

        const distance = Math.sqrt(dx * dx + dy * dy);
        const normalizedDist = distance / radius;
        const weight = distance === 0 ? 4.0 : Math.exp(-normalizedDist * 3.0);

        accumulator[biome] += weight;
        totalWeight += weight;
      }
    }

    // Build the result Map - only include non-zero entries.
    const weights = new Map<BiomeType, number>();
    if (totalWeight > 0) {
      const inv = 1.0 / totalWeight;
      for (let b = 0; b < NUM_BIOMES; b++) {
        if (accumulator[b] > 0) {
          weights.set(b as BiomeType, accumulator[b] * inv);
        }
      }
    }

    return weights;
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
