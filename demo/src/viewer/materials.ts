/**
 * Materials and color mapping for biome-based terrain rendering
 * 
 * Provides comprehensive biome color definitions and utilities for
 * smooth color blending between biomes based on blend weights.
 */

import { BiomeType } from '@engine/world/chunk';
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
  // Base biomes — refined for better visual realism
  [BiomeType.OCEAN]:      { r: 0.094, g: 0.314, b: 0.588 },  // Deep ocean blue (#185090)
  [BiomeType.BEACH]:      { r: 0.918, g: 0.855, b: 0.647 },  // Warm sand (#EAD9A5)
  [BiomeType.DESERT]:     { r: 0.871, g: 0.722, b: 0.353 },  // Warm golden sand (#DEA85A)
  [BiomeType.PLAINS]:     { r: 0.529, g: 0.737, b: 0.255 },  // Grass green (#87BC41)
  [BiomeType.FOREST]:     { r: 0.118, g: 0.431, b: 0.118 },  // Deep forest green (#1E6E1E)
  [BiomeType.TAIGA]:      { r: 0.157, g: 0.392, b: 0.275 },  // Dark pine green (#285F46)
  [BiomeType.TUNDRA]:     { r: 0.718, g: 0.773, b: 0.718 },  // Pale gray-green (#B7C5B7)
  [BiomeType.MOUNTAIN]:   { r: 0.502, g: 0.502, b: 0.502 },  // Neutral stone gray (#808080)
  // Extended biomes
  [BiomeType.SAVANNA]:    { r: 0.804, g: 0.718, b: 0.314 },  // Dry golden grass (#CDB750)
  [BiomeType.SWAMP]:      { r: 0.235, g: 0.353, b: 0.196 },  // Dark murky green (#3C5A32)
  [BiomeType.RAINFOREST]: { r: 0.047, g: 0.314, b: 0.094 },  // Lush deep green (#0A5018)
  [BiomeType.VOLCANIC]:   { r: 0.314, g: 0.118, b: 0.039 },  // Dark volcanic rock (#500A0A) with red tint
  [BiomeType.GLACIER]:    { r: 0.839, g: 0.918, b: 0.957 },  // Icy pale blue-white (#D6EAF4)
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
  numBiomes: number = 13
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
  numBiomes: number = 13
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
