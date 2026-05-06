export {
  createIndexedGeometryData,
  getIndexedGeometryVertexCount,
  type IndexedGeometryData,
} from './geometry';
export {
  buildLakeGeometryData,
  buildOceanGeometryData,
  buildRiverGeometryData,
  identifyLakeSurfaceTiles,
  identifyOceanSurfaceTiles,
  type WaterGeometryOptions,
  type WaterSurfaceTile,
} from './water-geometry';
export {
  buildTerrainGridGeometryData,
  type TerrainGridGeometryData,
  type TerrainGridGeometryOptions,
} from './terrain-geometry';
export {
  RIVER_TRENCH_DARKEN_STRENGTH,
  calculateRiverTrenchInfluence,
  getRiverTrenchDarkening,
} from './terrain-detail';
export {
  SHRUB_PROTOTYPE_MIN_Y,
  planFoliagePlacements,
  type FoliagePlacement,
  type FoliagePlacementPlan,
  type FoliageProfile,
  type TerrainPropPlacement,
  type TreePlacement,
  type TreeVariant,
} from './foliage-placement';
export {
  buildChunkBoundaryLineData,
  buildResourceMarkerPlacements,
  buildStructureMarkerPlacements,
  getResourceMarkerColor,
  getStructureMarkerColor,
  type ChunkBoundaryLineData,
  type ChunkOverlayOptions,
  type MarkerPlacementData,
  type StructureMarkerGeometryKind,
  type StructureMarkerPlacementData,
} from './chunk-overlays';
export {
  RenderLayer,
  applyChunkVisibility,
  applyRenderLayerVisibility,
  isRenderLayerVisible,
  type RenderLayerChunk,
  type RenderLayerVisibilityState,
  type VisibleObject,
} from './render-layers';
export {
  RenderStatsCache,
  calculateMicroBiomeCount,
  calculateRenderStats,
  type RenderStats,
  type RenderStatsChunk,
  type RenderStatsGeometry,
  type RenderStatsGeometryAttribute,
  type RenderStatsGroup,
  type RenderStatsMesh,
  type RenderStatsNowProvider,
  type RenderStatsObject,
} from './render-stats';
