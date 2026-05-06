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
 * Apply depth-based gradient to darkening factor.
 * Deeper tiles get significantly darker than shallower tiles.
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
  // Normalise depth to 0-1 range
  const normalizedDepth = Math.min(depth / seaLevel, 1);

  // Quadratic curve — shallow areas stay relatively bright,
  // deep areas get much darker (up to 2× the base factor)
  const depthMultiplier = 1 + normalizedDepth * normalizedDepth * 1.5;

  return Math.min(baseDarkenFactor * depthMultiplier, 0.92);
}

/**
 * Adjust underwater terrain color.
 *
 * Applies darkening, desaturation, and a depth-based blue tint to create
 * a realistic underwater appearance. Shallow areas retain some of their
 * original colour; deep areas shift strongly towards dark navy blue.
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
  const depth = config.seaLevel - terrainHeight;

  if (depth <= 0) {
    return originalColor;
  }

  // Depth gradient darkening
  let darkenFactor = config.darkenFactor;
  if (config.enableDepthGradient) {
    darkenFactor = applyDepthGradient(darkenFactor, depth, config.seaLevel);
  }

  // Darken
  let adjustedColor = darkenColor(originalColor, darkenFactor);

  // Desaturate
  adjustedColor = desaturateColor(adjustedColor, config.desaturationFactor);

  // Blue tint — deeper = stronger shift towards dark ocean blue
  // Shallow (t≈0): subtle tint; deep (t≈1): moderate navy overlay
  const t = Math.min(depth / config.seaLevel, 1.0);
  const tintStrength = t * t * 0.30; // quadratic, max 30% tint at full depth

  // Target tint colour: dark navy #0a1a3a
  const tintR = 0.04;
  const tintG = 0.10;
  const tintB = 0.23;

  adjustedColor = {
    r: adjustedColor.r * (1 - tintStrength) + tintR * tintStrength,
    g: adjustedColor.g * (1 - tintStrength) + tintG * tintStrength,
    b: adjustedColor.b * (1 - tintStrength) + tintB * tintStrength,
  };

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
  chunkData: any, // ChunkData with sparse biome weights
  chunkSize: number,
  config: UnderwaterAdjustmentConfig
): (BiomeColor | null)[] {
  const colors: (BiomeColor | null)[] = [];
  
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
      
      // Extract biome weights for this tile from sparse representation
      const start = chunkData.sparseBiomeOffsets[tileIndex];
      const end = tileIndex < chunkData.sparseBiomeOffsets.length - 1
        ? chunkData.sparseBiomeOffsets[tileIndex + 1]
        : chunkData.sparseBiomeTypes.length;
      
      // Calculate base color from biome weights, excluding ocean biome
      let baseColor: BiomeColor = { r: 0, g: 0, b: 0 };
      let totalWeight = 0;
      
      for (let i = start; i < end; i++) {
        const biome = chunkData.sparseBiomeTypes[i] as BiomeType;
        const weight = chunkData.sparseBiomeWeights[i];
        
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
