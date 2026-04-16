/**
 * Water system configuration and constants
 */

import type { WaterConfig } from './types';

/**
 * Height scale factor used for terrain rendering
 * MUST match WorldViewer's heightScale for proper water-terrain alignment
 * 
 * This constant is centralized to ensure consistency across:
 * - Ocean mesh generation
 * - River mesh generation
 * - Lake mesh generation
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
 * Default river configuration
 */
export const DEFAULT_RIVER_CONFIG = {
  enabled: true,
  color: 0x4682b4,
  opacity: 0.7,
  shininess: 80,
  enableFlowAnimation: false,
  flowSpeed: 1.0,
};

/**
 * Default lake configuration
 */
export const DEFAULT_LAKE_CONFIG = {
  enabled: true,
  color: 0x4169e1,
  opacity: 0.65,
  shininess: 90,
};

/**
 * Default water system configuration
 */
export const DEFAULT_WATER_CONFIG: WaterConfig = {
  enabled: true, // Enable water rendering by default
  seaLevel: 0.3,
  ocean: DEFAULT_OCEAN_CONFIG,
  river: DEFAULT_RIVER_CONFIG,
  lake: DEFAULT_LAKE_CONFIG,
  rendering: {
    waterOffset: 0.1,
    underwaterDarkenFactor: 0.4,
    underwaterDesaturationFactor: 0.5,
    enableDepthGradient: true,
  },
  performance: {
    enableGeometryPooling: true,
    enableMeshMerging: true,
    enableLOD: false,
    enableFrustumCulling: false, // Temporarily disabled for debugging
    useInstancedRendering: false,
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
    river: {
      enabled: config.river?.enabled ?? DEFAULT_RIVER_CONFIG.enabled,
      color: config.river?.color ?? DEFAULT_RIVER_CONFIG.color,
      opacity: clamp(
        config.river?.opacity ?? DEFAULT_RIVER_CONFIG.opacity,
        0,
        1,
        'River opacity'
      ),
      shininess: clamp(
        config.river?.shininess ?? DEFAULT_RIVER_CONFIG.shininess,
        0,
        100,
        'River shininess'
      ),
      enableFlowAnimation: config.river?.enableFlowAnimation ?? DEFAULT_RIVER_CONFIG.enableFlowAnimation,
      flowSpeed: Math.max(0, config.river?.flowSpeed ?? DEFAULT_RIVER_CONFIG.flowSpeed),
    },
    lake: {
      enabled: config.lake?.enabled ?? DEFAULT_LAKE_CONFIG.enabled,
      color: config.lake?.color ?? DEFAULT_LAKE_CONFIG.color,
      opacity: clamp(
        config.lake?.opacity ?? DEFAULT_LAKE_CONFIG.opacity,
        0,
        1,
        'Lake opacity'
      ),
      shininess: clamp(
        config.lake?.shininess ?? DEFAULT_LAKE_CONFIG.shininess,
        0,
        100,
        'Lake shininess'
      ),
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
      enableGeometryPooling: config.performance?.enableGeometryPooling ?? DEFAULT_WATER_CONFIG.performance.enableGeometryPooling,
      enableMeshMerging: config.performance?.enableMeshMerging ?? DEFAULT_WATER_CONFIG.performance.enableMeshMerging,
      enableLOD: config.performance?.enableLOD ?? DEFAULT_WATER_CONFIG.performance.enableLOD,
      enableFrustumCulling: config.performance?.enableFrustumCulling ?? DEFAULT_WATER_CONFIG.performance.enableFrustumCulling,
      useInstancedRendering: config.performance?.useInstancedRendering ?? DEFAULT_WATER_CONFIG.performance.useInstancedRendering,
    },
  };

  return validated;
}
