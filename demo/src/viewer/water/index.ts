/**
 * Water system module exports
 * 
 * Water rendering system for ocean water.
 */

// Type definitions
export type {
  WaterConfig,
  OceanConfig,
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
} from './config';

// Material factory
export {
  createOceanMaterial,
} from './WaterMaterialFactory';

// Ocean mesh generator
export {
  identifyOceanTiles,
  buildOceanGeometry,
} from './OceanMeshGenerator';

// Underwater terrain processor
export type {
  UnderwaterAdjustmentConfig,
  UnderwaterColorAdjustment,
} from './UnderwaterTerrainProcessor';

export {
  darkenColor,
  desaturateColor,
  applyDepthGradient,
  adjustUnderwaterColor,
  adjustUnderwaterColors,
} from './UnderwaterTerrainProcessor';

// Water layer manager
export {
  WaterLayerManager,
} from './WaterLayerManager';
