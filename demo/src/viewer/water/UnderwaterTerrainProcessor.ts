/**
 * Underwater terrain color processing
 * 
 * Adjusts terrain colors for tiles below sea level to create realistic
 * underwater appearance with darkening, desaturation, and depth-based gradients.
 */

import type { BiomeColor } from '../materials';
import { BiomeType } from '@engine/world/chunk';
import { BIOME_COLORS } from '../materials';

/**
 * Configuration for underwater color adjustments
 */
export interface UnderwaterAdjustmentConfig {
  /** Sea level elevation (default: 0.3) */
  seaLevel: number;
  /** Darkening factor (0-1, default: 0.4 = 40% darkening) */
  darkenFactor: number;
  /** Desaturation factor (0-1, default: 0.5) */
  desaturationFactor: number;
  /** Enable depth-based gradient */
  enableDepthGradient: boolean;
}

/**
 * Result of underwater color adjustment
 */
export interface UnderwaterColorAdjustment {
  /** Original biome color */
  originalColor: BiomeColor;
  /** Adjusted underwater color */
  adjustedColor: BiomeColor;
  /** Depth below sea level */
  depth: number;
  /** Applied darkening factor */
  darkenFactor: number;
  /** Applied desaturation factor */
  desaturationFactor: number;
}

/**
 * Calculate color saturation (0-1)
 */
export function calculateSaturation(color: BiomeColor): number {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  
  if (max === 0) {
    return 0;
  }
  
  return (max - min) / max;
}

/**
 * Calculate color brightness (0-1)
 */
export function calculateBrightness(color: BiomeColor): number {
  return Math.max(color.r, color.g, color.b);
}

/**
 * Darken a color by a factor
 * 
 * @param color - Input color
 * @param factor - Darkening factor (0-1, where 0.4 = 40% darkening)
 * @returns Darkened color
 */
export function darkenColor(color: BiomeColor, factor: number): BiomeColor {
  const multiplier = 1 - factor;
  return {
    r: color.r * multiplier,
    g: color.g * multiplier,
    b: color.b * multiplier,
  };
}

/**
 * Desaturate a color by a factor
 * 
 * @param color - Input color
 * @param factor - Desaturation factor (0-1, where 1 = full desaturation to grayscale)
 * @returns Desaturated color
 */
export function desaturateColor(color: BiomeColor, factor: number): BiomeColor {
  // Calculate luminance using standard formula
  const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  
  // Interpolate between original color and grayscale
  return {
    r: color.r + (luminance - color.r) * factor,
    g: color.g + (luminance - color.g) * factor,
    b: color.b + (luminance - color.b) * factor,
  };
}

/**
 * Apply depth-based gradient to darkening factor
 * Deeper tiles get darker than shallower tiles
 * 
 * @param baseDarkenFactor - Base darkening factor (0.3-0.5)
 * @param depth - Depth below sea level (0-1)
 * @param seaLevel - Sea level elevation
 * @returns Adjusted darkening factor
 */
export function applyDepthGradient(
  baseDarkenFactor: number,
  depth: number,
  seaLevel: number
): number {
  // Normalize depth to 0-1 range (assuming max depth is seaLevel)
  const normalizedDepth = Math.min(depth / seaLevel, 1);
  
  // Increase darkening factor based on depth
  // Deeper areas get up to 20% more darkening
  const depthMultiplier = 1 + (normalizedDepth * 0.2);
  
  return Math.min(baseDarkenFactor * depthMultiplier, 1);
}

/**
 * Adjust underwater terrain color
 * 
 * Applies darkening, desaturation, and optional depth-based gradient
 * to create realistic underwater appearance.
 * 
 * @param originalColor - Original biome color
 * @param terrainHeight - Height of the terrain tile
 * @param config - Underwater adjustment configuration
 * @returns Adjusted underwater color
 */
export function adjustUnderwaterColor(
  originalColor: BiomeColor,
  terrainHeight: number,
  config: UnderwaterAdjustmentConfig
): BiomeColor {
  // Calculate depth below sea level
  const depth = config.seaLevel - terrainHeight;
  
  // If not underwater, return original color
  if (depth <= 0) {
    return originalColor;
  }
  
  // Apply depth-based gradient to darkening factor if enabled
  let darkenFactor = config.darkenFactor;
  if (config.enableDepthGradient) {
    darkenFactor = applyDepthGradient(darkenFactor, depth, config.seaLevel);
  }
  
  // Apply darkening
  let adjustedColor = darkenColor(originalColor, darkenFactor);
  
  // Apply desaturation
  adjustedColor = desaturateColor(adjustedColor, config.desaturationFactor);
  
  return adjustedColor;
}

/**
 * Adjust underwater terrain colors for a chunk
 * 
 * Processes all terrain tiles in a chunk, applying underwater color adjustments
 * to tiles below sea level. Excludes ocean biome colors from underwater terrain.
 * Returns null for above-water tiles to preserve original biome blending.
 * 
 * @param heightmap - Heightmap data (flat array, (chunkSize+1) x (chunkSize+1))
 * @param biomeWeights - Biome weights data (flat array, chunkSize x chunkSize x 8)
 * @param chunkSize - Size of the chunk
 * @param config - Underwater adjustment configuration
 * @returns Array of adjusted colors for each tile (null = use original biome color)
 */
export function adjustUnderwaterColors(
  heightmap: Float32Array,
  biomeWeights: Float32Array,
  chunkSize: number,
  config: UnderwaterAdjustmentConfig
): (BiomeColor | null)[] {
  const colors: (BiomeColor | null)[] = [];
  const numBiomes = 13;
  
  for (let y = 0; y < chunkSize; y++) {
    for (let x = 0; x < chunkSize; x++) {
      const tileIndex = y * chunkSize + x;
      
      // Get height from heightmap (use top-left vertex of tile)
      const heightIndex = y * (chunkSize + 1) + x;
      const height = heightmap[heightIndex];
      
      // If not underwater, return null to use original biome color
      if (height >= config.seaLevel) {
        colors.push(null);
        continue;
      }
      
      // Extract biome weights for this tile
      const weights = new Map<BiomeType, number>();
      for (let biome = 0; biome < numBiomes; biome++) {
        const weight = biomeWeights[tileIndex * numBiomes + biome];
        if (weight > 0) {
          weights.set(biome as BiomeType, weight);
        }
      }
      
      // Calculate base color from biome weights, excluding ocean biome
      let baseColor: BiomeColor = { r: 0, g: 0, b: 0 };
      let totalWeight = 0;
      
      for (const [biome, weight] of weights.entries()) {
        // Exclude ocean biome from underwater terrain colors
        if (biome === BiomeType.OCEAN) {
          continue;
        }
        
        const biomeColor = BIOME_COLORS[biome];
        baseColor.r += biomeColor.r * weight;
        baseColor.g += biomeColor.g * weight;
        baseColor.b += biomeColor.b * weight;
        totalWeight += weight;
      }
      
      // Normalize if we have non-ocean biomes
      if (totalWeight > 0) {
        baseColor.r /= totalWeight;
        baseColor.g /= totalWeight;
        baseColor.b /= totalWeight;
      } else {
        // Fallback to beach color if only ocean biome present
        baseColor = BIOME_COLORS[BiomeType.BEACH];
      }
      
      // Apply underwater adjustments
      baseColor = adjustUnderwaterColor(baseColor, height, config);
      
      colors.push(baseColor);
    }
  }
  
  return colors;
}

/**
 * Get detailed adjustment information for a single tile
 * 
 * Useful for testing and debugging underwater color adjustments.
 * 
 * @param originalColor - Original biome color
 * @param terrainHeight - Height of the terrain tile
 * @param config - Underwater adjustment configuration
 * @returns Detailed adjustment information
 */
export function getUnderwaterAdjustmentDetails(
  originalColor: BiomeColor,
  terrainHeight: number,
  config: UnderwaterAdjustmentConfig
): UnderwaterColorAdjustment {
  const depth = config.seaLevel - terrainHeight;
  
  let darkenFactor = config.darkenFactor;
  if (config.enableDepthGradient && depth > 0) {
    darkenFactor = applyDepthGradient(darkenFactor, depth, config.seaLevel);
  }
  
  const adjustedColor = adjustUnderwaterColor(originalColor, terrainHeight, config);
  
  return {
    originalColor,
    adjustedColor,
    depth: Math.max(0, depth),
    darkenFactor,
    desaturationFactor: config.desaturationFactor,
  };
}
