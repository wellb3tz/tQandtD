/**
 * Water system module exports
 * 
 * Water rendering system for ocean and lake water.
 */

// Type definitions
export type {
  WaterConfig,
  OceanConfig,
  LakeRenderConfig,
  PerformanceConfig,
  RenderingConfig,
  WaterType,
  WaterMesh,
  WaterLayerData,
  OceanTile,
  LakeTile,
} from './types';

// Configuration and validation
export {
  validateWaterConfig,
  DEFAULT_WATER_CONFIG,
  DEFAULT_OCEAN_CONFIG,
  DEFAULT_LAKE_RENDER_CONFIG,
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

// Lake mesh generator
export {
  identifyLakeTiles,
  buildLakeGeometry,
  createLakeMaterial,
} from './LakeMeshGenerator';

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
