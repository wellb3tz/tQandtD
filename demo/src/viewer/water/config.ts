/**
 * Water system configuration and constants
 * 
 * Provides default configuration for ocean water rendering
 * and validation utilities.
 */

import type { WaterConfig } from './types';

/**
 * Height scale factor used for terrain rendering
 * MUST match WorldViewer's heightScale for proper water-terrain alignment
 * 
 * This constant is centralized to ensure consistency across:
 * - Ocean mesh generation
 * - Water elevation validation
 * - Property-based tests
 */
export const HEIGHT_SCALE = 50;

/**
 * Default ocean configuration
 */
export const DEFAULT_OCEAN_CONFIG = {
  enabled: true,
  color: 0x1e90ff,
  opacity: 0.6,
  shininess: 100,
  enableWaves: false,
  waveHeight: 0.5,
  waveSpeed: 1.0,
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
