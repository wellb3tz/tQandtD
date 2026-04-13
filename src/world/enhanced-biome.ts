import { BiomeConfig, BiomeSystem } from './biome';
import { BiomeType } from './chunk';
import { NoiseEngine, NoiseConfig } from '../core/noise';

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
  /** Micro-biome frequency (0-1, default: 0.1) */
  microBiomeFrequency: number;
  /** Maximum micro-biome size in tiles (default: 20) */
  microBiomeMaxSize: number;
  
  /** Enable elevation bands in mountains (default: true) */
  enableElevationBands: boolean;
  /** Snow line elevation threshold (default: 0.8) */
  snowLineElevation: number;
  /** Tree line elevation threshold (default: 0.75) */
  treeLineElevation: number;
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
 */
export class EnhancedBiomeSystem extends BiomeSystem {
  private microBiomeNoise: NoiseEngine;
  private enhancedConfig: EnhancedBiomeConfig;

  /**
   * Creates a new EnhancedBiomeSystem with the given seed and configuration.
   * @param seed - Numeric seed for deterministic biome generation
   * @param config - Enhanced biome configuration parameters
   */
  constructor(seed: number, config: EnhancedBiomeConfig) {
    super(seed, config);
    // Use a different seed for micro-biome noise to avoid correlation
    this.microBiomeNoise = new NoiseEngine(seed + 2000);
    this.enhancedConfig = config;
  }

  /**
   * Gets enhanced biome data at a world position.
   * Includes transition zones, micro-biomes, and elevation bands.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param height - Height value at this position (0-1 range)
   * @returns Enhanced biome data with transitions and micro-biomes
   */
  getEnhancedBiome(x: number, y: number, height: number): EnhancedBiomeData {
    // Get base biome and weights
    const biome = this.getBiome(x, y, height);
    const weights = this.enhancedConfig.enableTransitions 
      ? this.getBiomeWeights(x, y, height)
      : new Map([[biome, 1.0]]);

    // Calculate transition factor
    const transitionFactor = this.enhancedConfig.enableTransitions
      ? this.calculateTransitionFactor(x, y, height)
      : 0;

    // Check for micro-biome
    const microBiome = this.enhancedConfig.enableMicroBiomes
      ? this.getMicroBiome(x, y, biome)
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

  /**
   * Determines if a micro-biome should exist at this location.
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param parentBiome - The parent biome type
   * @returns Micro-biome type or undefined
   */
  private getMicroBiome(x: number, y: number, parentBiome: BiomeType): MicroBiomeType | undefined {
    // Sample micro-biome noise
    const noiseConfig: NoiseConfig = {
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 50, // Smaller scale for localized features
    };
    
    const noiseValue = this.microBiomeNoise.fbm(x, y, noiseConfig);
    
    // Check if noise exceeds frequency threshold
    const threshold = 1.0 - this.enhancedConfig.microBiomeFrequency * 2; // Convert 0-1 to -1 to 1 range
    if (noiseValue < threshold) {
      return undefined;
    }

    // Calculate micro-biome size by checking the extent of the high-noise region
    // Sample in multiple directions to estimate the size
    const sampleDirections = 8;
    let maxExtent = 0;
    
    for (let i = 0; i < sampleDirections; i++) {
      const angle = (i / sampleDirections) * Math.PI * 2;
      let extent = 0;
      
      // Sample outward from center until noise drops below threshold
      for (let distance = 1; distance <= this.enhancedConfig.microBiomeMaxSize; distance++) {
        const sampleX = x + Math.cos(angle) * distance;
        const sampleY = y + Math.sin(angle) * distance;
        const sampleNoise = this.microBiomeNoise.fbm(sampleX, sampleY, noiseConfig);
        
        if (sampleNoise >= threshold) {
          extent = distance;
        } else {
          break;
        }
      }
      
      maxExtent = Math.max(maxExtent, extent);
    }
    
    // Enforce maximum size constraint
    // If the micro-biome extends beyond the maximum size, reject it
    if (maxExtent > this.enhancedConfig.microBiomeMaxSize) {
      return undefined;
    }

    // Determine micro-biome type based on parent biome
    switch (parentBiome) {
      case BiomeType.DESERT:
        return MicroBiomeType.OASIS;
      case BiomeType.FOREST:
        return MicroBiomeType.CLEARING;
      case BiomeType.PLAINS:
        return MicroBiomeType.POND;
      case BiomeType.TUNDRA:
        return MicroBiomeType.GROVE;
      default:
        return undefined;
    }
  }

  /**
   * Determines elevation band for mountain terrain.
   * @param height - Height value (0-1 range)
   * @returns Elevation band type
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
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param height - Height value
   * @returns Transition factor (0-1)
   */
  private calculateTransitionFactor(x: number, y: number, height: number): number {
    // Get the primary biome at this position
    const centerBiome = this.getBiome(x, y, height);
    
    // Sample biomes in a small radius to detect boundaries
    const sampleRadius = this.enhancedConfig.transitionWidth;
    const sampleCount = 8; // Sample in 8 directions
    let differentBiomeCount = 0;
    
    for (let i = 0; i < sampleCount; i++) {
      const angle = (i / sampleCount) * Math.PI * 2;
      const sampleX = x + Math.cos(angle) * sampleRadius;
      const sampleY = y + Math.sin(angle) * sampleRadius;
      
      const sampleBiome = this.getBiome(sampleX, sampleY, height);
      if (sampleBiome !== centerBiome) {
        differentBiomeCount++;
      }
    }
    
    // Transition factor is proportional to how many different biomes are nearby
    return differentBiomeCount / sampleCount;
  }
}
