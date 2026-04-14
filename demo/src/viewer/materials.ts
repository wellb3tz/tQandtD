/**
 * Materials and color mapping for biome-based terrain rendering
 * 
 * Provides comprehensive biome color definitions and utilities for
 * smooth color blending between biomes based on blend weights.
 */

import { BiomeType } from '../../../src/world/chunk';
import * as THREE from 'three';

/**
 * RGB color representation
 */
export interface BiomeColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Comprehensive biome color palette
 * Colors are chosen to be visually distinct and represent the biome characteristics
 */
export const BIOME_COLORS: Record<BiomeType, BiomeColor> = {
  [BiomeType.OCEAN]: { r: 0.255, g: 0.412, b: 0.882 },      // Deep blue (#4169E1)
  [BiomeType.BEACH]: { r: 0.941, g: 0.902, b: 0.549 },      // Sandy yellow (#F0E68C)
  [BiomeType.DESERT]: { r: 0.855, g: 0.647, b: 0.125 },     // Golden sand (#DAA520)
  [BiomeType.PLAINS]: { r: 0.565, g: 0.933, b: 0.565 },     // Light green (#90EE90)
  [BiomeType.FOREST]: { r: 0.133, g: 0.545, b: 0.133 },     // Forest green (#228B22)
  [BiomeType.TAIGA]: { r: 0.196, g: 0.502, b: 0.196 },      // Dark green (#326432)
  [BiomeType.TUNDRA]: { r: 0.690, g: 0.769, b: 0.871 },     // Icy blue-gray (#B0C4DE)
  [BiomeType.MOUNTAIN]: { r: 0.439, g: 0.502, b: 0.565 },   // Gray stone (#708090)
};

/**
 * Convert BiomeColor to THREE.Color
 */
export function biomeColorToThree(color: BiomeColor): THREE.Color {
  return new THREE.Color(color.r, color.g, color.b);
}

/**
 * Get the base color for a biome type
 */
export function getBiomeColor(biome: BiomeType): BiomeColor {
  return BIOME_COLORS[biome] || { r: 0.5, g: 0.5, b: 0.5 }; // Default gray
}

/**
 * Blend multiple biome colors based on weights
 * 
 * @param biomeWeights - Map of biome types to their blend weights (should sum to 1.0)
 * @returns Blended color
 */
export function blendBiomeColors(biomeWeights: Map<BiomeType, number>): BiomeColor {
  let r = 0;
  let g = 0;
  let b = 0;
  
  for (const [biome, weight] of biomeWeights.entries()) {
    const color = getBiomeColor(biome);
    r += color.r * weight;
    g += color.g * weight;
    b += color.b * weight;
  }
  
  return { r, g, b };
}

/**
 * Extract biome weights from chunk data for a specific position
 * 
 * @param biomeWeights - Flat array of biome weights from chunk data
 * @param index - Position index in the chunk
 * @param numBiomes - Total number of biome types
 * @returns Map of biome types to their weights at this position
 */
export function extractBiomeWeights(
  biomeWeights: Float32Array,
  index: number,
  numBiomes: number = 8
): Map<BiomeType, number> {
  const weights = new Map<BiomeType, number>();
  
  for (let biome = 0; biome < numBiomes; biome++) {
    const weight = biomeWeights[index * numBiomes + biome];
    if (weight > 0) {
      weights.set(biome as BiomeType, weight);
    }
  }
  
  return weights;
}

/**
 * Calculate smooth color for a position using biome blend weights
 * 
 * @param biomeWeights - Flat array of biome weights from chunk data
 * @param index - Position index in the chunk
 * @param numBiomes - Total number of biome types
 * @returns Blended biome color
 */
export function calculateBlendedColor(
  biomeWeights: Float32Array,
  index: number,
  numBiomes: number = 8
): BiomeColor {
  const weights = extractBiomeWeights(biomeWeights, index, numBiomes);
  
  // If no weights available, fall back to default color
  if (weights.size === 0) {
    return { r: 0.5, g: 0.5, b: 0.5 };
  }
  
  return blendBiomeColors(weights);
}

/**
 * Create a material for terrain rendering with vertex colors
 * 
 * @param wireframe - Whether to render in wireframe mode
 * @returns THREE.js material configured for terrain
 */
export function createTerrainMaterial(wireframe: boolean = false): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    vertexColors: true,
    wireframe,
  });
}

/**
 * Create a material for biome visualization overlay
 * 
 * @param biome - Biome type to visualize
 * @param opacity - Material opacity (0-1)
 * @returns THREE.js material for biome overlay
 */
export function createBiomeOverlayMaterial(
  biome: BiomeType,
  opacity: number = 0.5
): THREE.MeshBasicMaterial {
  const color = biomeColorToThree(getBiomeColor(biome));
  
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
}

/**
 * Convert color to grayscale using luminance formula
 * 
 * @param color - Input color
 * @returns Grayscale color
 */
export function toGrayscale(color: BiomeColor): BiomeColor {
  const gray = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  return { r: gray, g: gray, b: gray };
}

/**
 * Interpolate between two colors
 * 
 * @param color1 - First color
 * @param color2 - Second color
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated color
 */
export function lerpColor(color1: BiomeColor, color2: BiomeColor, t: number): BiomeColor {
  return {
    r: color1.r + (color2.r - color1.r) * t,
    g: color1.g + (color2.g - color1.g) * t,
    b: color1.b + (color2.b - color1.b) * t,
  };
}
