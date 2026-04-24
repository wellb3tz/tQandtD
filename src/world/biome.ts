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
  }

  /**
   * Generates temperature value at world position.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @returns Temperature value in range [-1, 1]
   */
  getTemperature(x: number, y: number): number {
    const noiseConfig: NoiseConfig = {
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: this.config.temperatureScale,
    };
    
    return this.temperatureNoise.fbm(x, y, noiseConfig);
  }

  /**
   * Generates moisture value at world position.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @returns Moisture value in range [-1, 1]
   */
  getMoisture(x: number, y: number): number {
    const noiseConfig: NoiseConfig = {
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: this.config.moistureScale,
    };
    
    return this.moistureNoise.fbm(x, y, noiseConfig);
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
    if (height < 0.35) {
      return BiomeType.BEACH;
    }
    if (height > 0.85) {
      return BiomeType.VOLCANIC; // Extreme peaks become volcanic
    }
    if (height > 0.7) {
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
    const weights = new Map<BiomeType, number>();
    const samples = 9; // 3x3 grid of samples
    
    // Get center biome first
    const centerHeight = getHeight(x, y);
    const centerBiome = this.getBiome(x, y, centerHeight);
    
    // Sample biomes in a grid around the position
    const step = radius / Math.sqrt(samples);
    let totalWeight = 0;
    
    for (let dy = -radius; dy <= radius; dy += step) {
      for (let dx = -radius; dx <= radius; dx += step) {
        const sampleX = x + dx;
        const sampleY = y + dy;
        
        // Get height at this sampled position
        const sampleHeight = getHeight(sampleX, sampleY);
        
        // Get biome at sample position using its own height
        const biome = this.getBiome(sampleX, sampleY, sampleHeight);
        
        // Calculate weight based on distance with exponential falloff
        // This gives much stronger weight to center, preserving narrow biomes
        const distance = Math.sqrt(dx * dx + dy * dy);
        const normalizedDist = distance / radius; // 0 to ~1.4
        const weight = distance === 0 ? 4.0 : Math.exp(-normalizedDist * 3.0);
        
        // Accumulate weight for this biome
        const currentWeight = weights.get(biome) || 0;
        weights.set(biome, currentWeight + weight);
        totalWeight += weight;
      }
    }
    
    // Normalize weights to sum to 1.0
    if (totalWeight > 0) {
      for (const [biome, weight] of weights.entries()) {
        weights.set(biome, weight / totalWeight);
      }
    }
    
    return weights;
  }
}
