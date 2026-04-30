import { NoiseEngine, NoiseConfig } from '../core/noise';
import { BiomeType } from './chunk';

/**
 * Configuration for biome generation
 */
export interface BiomeConfig {
  /** Scale factor for temperature noise */
  temperatureScale: number;
  /** Scale factor for moisture noise */
  moistureScale: number;
  /** Radius for biome blending (in world units) */
  blendRadius: number;
}

/**
 * Biome classification and blending system.
 * Determines biome types based on height, temperature, and moisture values.
 */
export class BiomeSystem {
  private temperatureNoise: NoiseEngine;
  private moistureNoise: NoiseEngine;
  private config: BiomeConfig;

  /** Pre-allocated noise configs — avoids per-call object creation in hot paths. */
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

    // Pre-allocate configs once — reused on every getTemperature/getMoisture call.
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
    return this.temperatureNoise.fbm(x, y, this.temperatureNoiseConfig);
  }

  /**
   * Generates moisture value at world position.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @returns Moisture value in range [-1, 1]
   */
  getMoisture(x: number, y: number): number {
    return this.moistureNoise.fbm(x, y, this.moistureNoiseConfig);
  }

  /**
   * Determines the biome type at a world position based on height, temperature, and moisture.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param height - Height value at this position (0-1 range)
   * @returns The biome type at this position
   */
  getBiome(x: number, y: number, height: number): BiomeType {
    // Height-based biomes (override temperature/moisture)
    if (height < 0.3) {
      return BiomeType.OCEAN;
    }
    if (height < 0.42) {
      // Coastal zone — BEACH only if actually near water.
      // Without a getHeight callback here we use a wider band as approximation;
      // the enhanced system overrides this with a proper proximity check.
      return BiomeType.BEACH;
    }
    if (height > 0.7) {
      // High elevation — check temperature to decide mountain vs volcanic
      const temperature = this.getTemperature(x, y);
      if (height > 0.85 && temperature > 0.2) {
        // Extreme peaks in warm regions = volcanic
        return BiomeType.VOLCANIC;
      }
      return BiomeType.MOUNTAIN;
    }

    // Temperature and moisture based biomes
    const temperature = this.getTemperature(x, y);
    const moisture = this.getMoisture(x, y);

    // Classify based on temperature and moisture
    // Temperature: -1 (cold) to 1 (hot)
    // Moisture: -1 (dry) to 1 (wet)

    if (temperature < -0.5) {
      // Very cold regions
      if (height > 0.6) {
        return BiomeType.GLACIER; // Cold + elevated = glacier
      }
      return moisture > 0.1 ? BiomeType.TAIGA : BiomeType.TUNDRA;
    } else if (temperature < -0.3) {
      // Cold regions
      return moisture > 0.2 ? BiomeType.TAIGA : BiomeType.TUNDRA;
    } else if (temperature > 0.5) {
      // Very hot regions
      if (moisture > 0.4) {
        return BiomeType.RAINFOREST; // Hot + very wet
      } else if (moisture < -0.2) {
        return BiomeType.DESERT; // Hot + dry
      } else {
        return BiomeType.SAVANNA; // Hot + moderate moisture
      }
    } else if (temperature > 0.3) {
      // Hot regions
      if (moisture < -0.2) {
        return BiomeType.DESERT; // Hot and dry
      } else if (moisture > 0.5) {
        return BiomeType.RAINFOREST; // Hot and very wet
      } else {
        return BiomeType.PLAINS; // Hot and moderate moisture
      }
    } else {
      // Temperate regions
      if (moisture > 0.5) {
        return BiomeType.SWAMP; // Temperate + very wet + low elevation
      } else if (moisture > 0.2) {
        return BiomeType.FOREST; // Temperate and wet
      } else {
        return BiomeType.PLAINS; // Temperate and moderate/dry
      }
    }
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
  getBiomeWeights(x: number, y: number, getHeight: (worldX: number, worldY: number) => number): Map<BiomeType, number> {
    return this.getBiomeWeightsWithRadius(x, y, getHeight, this.config.blendRadius);
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
  getBiomeWeightsWithRadius(x: number, y: number, getHeight: (worldX: number, worldY: number) => number, radius: number): Map<BiomeType, number> {
    // Use a fixed-size Float64Array indexed by BiomeType (13 values, 0-12) to
    // accumulate weights without allocating a Map per sample point.
    // The final Map is built once at the end — one allocation per tile instead of
    // one per sample (was 9 Map.get/set calls × 1024 tiles = 9 216 ops per chunk).
    const NUM_BIOMES = 13;
    const accumulator = new Float64Array(NUM_BIOMES);

    const step = radius / Math.sqrt(9); // 3×3 grid
    let totalWeight = 0;

    for (let dy = -radius; dy <= radius; dy += step) {
      for (let dx = -radius; dx <= radius; dx += step) {
        const sampleX = x + dx;
        const sampleY = y + dy;

        const sampleHeight = getHeight(sampleX, sampleY);
        const biome = this.getBiome(sampleX, sampleY, sampleHeight);

        const distance = Math.sqrt(dx * dx + dy * dy);
        const normalizedDist = distance / radius;
        const weight = distance === 0 ? 4.0 : Math.exp(-normalizedDist * 3.0);

        accumulator[biome] += weight;
        totalWeight += weight;
      }
    }

    // Build the result Map — only include non-zero entries.
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
