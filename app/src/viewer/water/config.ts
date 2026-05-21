/**
 * Water system configuration and constants
 * 
 * Provides default configuration for ocean water rendering
 * and validation utilities.
 */

import type { WaterConfig } from './types';
import { TERRAIN_HEIGHT_SCALE_METERS, TERRAIN_TILE_SIZE_METERS } from '@engine/index';

/**
 * Height scale factor used for terrain rendering
 * MUST match WorldViewer's heightScale for proper water-terrain alignment
 * 
 * This constant is centralized to ensure consistency across:
 * - Ocean mesh generation
 * - Water elevation validation
 * - Property-based tests
 */
export const HEIGHT_SCALE = TERRAIN_HEIGHT_SCALE_METERS;
export const HORIZONTAL_SCALE = TERRAIN_TILE_SIZE_METERS;

/**
 * Default ocean configuration
 */
export const DEFAULT_OCEAN_CONFIG = {
  enabled: true,
  color: 0x0d4f66,
  opacity: 0.66,
  shininess: 95,
  enableWaves: true,
  waveHeight: 0.65,
  waveSpeed: 1.05,
};

/**
 * Default lake render configuration.
 *
 * Freshwater palette: shallow cyan-teal #4fc3d4, distinct from ocean (navy-blue).
 * The `color` field tints the material base; vertex colors carry the depth gradient.
 */
export const DEFAULT_LAKE_RENDER_CONFIG = {
  enabled: true,
  color: 0x4fc3d4,  // light cyan-teal - freshwater, distinct from ocean navy
  opacity: 0.80,
  shininess: 60,
};

export const DEFAULT_RIVER_RENDER_CONFIG = {
  enabled: true,
  color: 0x5ab5c8, // freshwater turquoise - distinct from ocean navy and lake cyan
  opacity: 0.82,
  shininess: 75,
};

/**
 * Default water system configuration
 * 
 * Provides sensible defaults for ocean water rendering
 * with performance optimizations and visual settings.
 */
export const DEFAULT_WATER_CONFIG: WaterConfig = {
  enabled: true, // Enable water rendering by default
  seaLevel: 0.3,
  ocean: DEFAULT_OCEAN_CONFIG,
  lake: DEFAULT_LAKE_RENDER_CONFIG,
  river: DEFAULT_RIVER_RENDER_CONFIG,
  rendering: {
    waterOffset: 0.1,
    underwaterDarkenFactor: 0.4,
    underwaterDesaturationFactor: 0.5,
    enableDepthGradient: true,
  },
  performance: {
    enableFrustumCulling: false,
  },
};

/**
 * Clamp a value between min and max with optional warning
 */
function clamp(value: number, min: number, max: number, name?: string): number {
  if (value < min || value > max) {
    if (name) {
      console.warn(`${name} ${value} out of range [${min}, ${max}], clamping to valid range`);
    }
    return Math.max(min, Math.min(max, value));
  }
  return value;
}

/**
 * Validate and apply defaults to water configuration
 * 
 * Validates ocean water configuration parameters and applies
 * defaults for missing values. Clamps numeric values to valid
 * ranges and logs warnings for out-of-range values.
 * 
 * @param config - Partial water configuration to validate
 * @returns Complete validated water configuration
 */
export function validateWaterConfig(config: Partial<WaterConfig> = {}): WaterConfig {
  // Validate seaLevel with special handling - use default if out of range
  let seaLevel = config.seaLevel ?? DEFAULT_WATER_CONFIG.seaLevel;
  if (seaLevel < 0 || seaLevel > 1) {
    console.warn(`Sea level ${seaLevel} out of range [0, 1], using default ${DEFAULT_WATER_CONFIG.seaLevel}`);
    seaLevel = DEFAULT_WATER_CONFIG.seaLevel;
  }

  const validated: WaterConfig = {
    enabled: config.enabled ?? DEFAULT_WATER_CONFIG.enabled,
    seaLevel,
    ocean: {
      enabled: config.ocean?.enabled ?? DEFAULT_OCEAN_CONFIG.enabled,
      color: config.ocean?.color ?? DEFAULT_OCEAN_CONFIG.color,
      opacity: clamp(
        config.ocean?.opacity ?? DEFAULT_OCEAN_CONFIG.opacity,
        0,
        1,
        'Ocean opacity'
      ),
      shininess: clamp(
        config.ocean?.shininess ?? DEFAULT_OCEAN_CONFIG.shininess,
        0,
        100,
        'Ocean shininess'
      ),
      enableWaves: config.ocean?.enableWaves ?? DEFAULT_OCEAN_CONFIG.enableWaves,
      waveHeight: Math.max(0, config.ocean?.waveHeight ?? DEFAULT_OCEAN_CONFIG.waveHeight),
      waveSpeed: Math.max(0, config.ocean?.waveSpeed ?? DEFAULT_OCEAN_CONFIG.waveSpeed),
      normalMap: config.ocean?.normalMap,
    },
    lake: {
      enabled: config.lake?.enabled ?? DEFAULT_LAKE_RENDER_CONFIG.enabled,
      color: config.lake?.color ?? DEFAULT_LAKE_RENDER_CONFIG.color,
      opacity: clamp(
        config.lake?.opacity ?? DEFAULT_LAKE_RENDER_CONFIG.opacity,
        0,
        1,
        'Lake opacity'
      ),
      shininess: clamp(
        config.lake?.shininess ?? DEFAULT_LAKE_RENDER_CONFIG.shininess,
        0,
        100,
        'Lake shininess'
      ),
    },
    river: {
      enabled: config.river?.enabled ?? DEFAULT_RIVER_RENDER_CONFIG.enabled,
      color: config.river?.color ?? DEFAULT_RIVER_RENDER_CONFIG.color,
      opacity: clamp(
        config.river?.opacity ?? DEFAULT_RIVER_RENDER_CONFIG.opacity,
        0,
        1,
        'River opacity'
      ),
      shininess: clamp(
        config.river?.shininess ?? DEFAULT_RIVER_RENDER_CONFIG.shininess,
        0,
        100,
        'River shininess'
      ),
      normalMap: config.river?.normalMap,
    },
    rendering: {
      waterOffset: Math.max(
        0,
        config.rendering?.waterOffset ?? DEFAULT_WATER_CONFIG.rendering.waterOffset
      ),
      underwaterDarkenFactor: clamp(
        config.rendering?.underwaterDarkenFactor ?? DEFAULT_WATER_CONFIG.rendering.underwaterDarkenFactor,
        0,
        1,
        'Underwater darken factor'
      ),
      underwaterDesaturationFactor: clamp(
        config.rendering?.underwaterDesaturationFactor ?? DEFAULT_WATER_CONFIG.rendering.underwaterDesaturationFactor,
        0,
        1,
        'Underwater desaturation factor'
      ),
      enableDepthGradient: config.rendering?.enableDepthGradient ?? DEFAULT_WATER_CONFIG.rendering.enableDepthGradient,
    },
    performance: {
      enableFrustumCulling: config.performance?.enableFrustumCulling ?? DEFAULT_WATER_CONFIG.performance.enableFrustumCulling,
    },
  };

  return validated;
}
