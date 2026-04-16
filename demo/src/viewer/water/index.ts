/**
 * Water system module exports
 * 
 * Comprehensive water rendering system for oceans, rivers, and lakes.
 */

// Type definitions
export type {
  WaterConfig,
  OceanConfig,
  RiverConfig,
  LakeConfig,
  PerformanceConfig,
  RenderingConfig,
  WaterType,
  WaterMesh,
  WaterLayerData,
  OceanTile,
} from './types';

// Configuration and validation
export {
  validateWaterConfig,
  DEFAULT_WATER_CONFIG,
  DEFAULT_OCEAN_CONFIG,
  DEFAULT_RIVER_CONFIG,
  DEFAULT_LAKE_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
  DEFAULT_RENDERING_CONFIG,
} from './config';

// Material factory
export {
  createOceanMaterial,
  createRiverMaterial,
  createLakeMaterial,
} from './WaterMaterialFactory';

// Ocean mesh generator
export {
  identifyOceanTiles,
  buildOceanGeometry,
} from './OceanMeshGenerator';

// River mesh generator
export {
  generateRiverMeshes,
} from './RiverMeshGenerator';

// Lake mesh generator
export {
  generateLakeMeshes,
} from './LakeMeshGenerator';

// Underwater terrain processor
export type {
  UnderwaterAdjustmentConfig,
  UnderwaterColorAdjustment,
} from './UnderwaterTerrainProcessor';

export {
  calculateSaturation,
  calculateBrightness,
  darkenColor,
  desaturateColor,
  applyDepthGradient,
  adjustUnderwaterColor,
  adjustUnderwaterColors,
  getUnderwaterAdjustmentDetails,
} from './UnderwaterTerrainProcessor';

// Water layer manager
export {
  WaterLayerManager,
} from './WaterLayerManager';
