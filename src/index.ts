/**
 * tQandtD project
 * 
 * A TypeScript-based procedural world generation engine for browser-based applications.
 * Generates infinite, deterministic worlds using seed-based random number generation,
 * chunk-based loading, and multi-layer noise functions.
 * 
 * @example
 * ```typescript
 * import { ChunkManager, BiomeType, ResourceType, StructureType } from 'procedural-world-engine';
 * 
 * const manager = new ChunkManager({
 *   seed: 12345,
 *   chunkSize: 32,
 *   terrainConfig: {
 *     baseScale: 0.01,
 *     octaves: 4,
 *     persistence: 0.5,
 *     lacunarity: 2.0,
 *     warpStrength: 30,
 *     heightMultiplier: 1.0
 *   },
 *   biomeConfig: {
 *     temperatureScale: 0.005,
 *     moistureScale: 0.005,
 *     blendRadius: 5
 *   },
 *   resourceConfig: {
 *     types: [
 *       {
 *         type: ResourceType.STONE,
 *         rarity: 0.3,
 *         biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
 *         minAmount: 10,
 *         maxAmount: 50
 *       }
 *     ],
 *     clusterScale: 20,
 *     densityThreshold: 0.6
 *   },
 *   structureConfig: {
 *     types: [
 *       {
 *         type: StructureType.VILLAGE,
 *         rarity: 1.0,
 *         rules: [
 *           { type: 'biome', params: { biomes: [BiomeType.PLAINS] } },
 *           { type: 'slope', params: { maxSlope: 0.1 } }
 *         ]
 *       }
 *     ],
 *     minDistance: 10,
 *     maxAttempts: 30
 *   }
 * });
 * 
 * const chunk = manager.getChunk(0, 0);
 * console.log(chunk.heightmap);
 * console.log(chunk.resources);
 * console.log(chunk.structures);
 * ```
 */

// Core utilities
export { SeededRNG } from './core/rng';
export { NoiseEngine, type NoiseConfig } from './core/noise';
export { hash, chunkSeed } from './core/hash';

// World management
export { ChunkManager, type WorldConfig, type ChunkPerformanceMetrics, type ProgressCallback, type Noise3DConfig } from './world/chunk-manager';
export {
  cloneWorldConfig,
  createDefaultWorldConfig,
  deriveNoise3DConfig,
  mergeWorldConfig,
  prepareWorldConfig,
  type WorldConfigOverrides,
} from './config/default-world-config';
export { BiomeSystem, type BiomeConfig } from './world/biome';
export {
  EnhancedBiomeSystem,
  type EnhancedBiomeConfig,
  type EnhancedBiomeData,
  ElevationBand,
} from './world/enhanced-biome';
export {
  ClimateSystem,
  type ClimateConfig,
  DEFAULT_CLIMATE_CONFIG,
} from './world/climate';
export {
  BiomeCompatibilityMatrix,
  type SerializedCompatibilityMatrix,
} from './world/biome-compatibility';
export {
  type ChunkData,
  type Resource,
  type Structure,
  BiomeType,
  ResourceType,
  StructureType,
  worldToChunk,
  chunkToWorld,
  worldToLocal,
  localToIndex,
  indexToLocal,
  type ChunkEdge,
  getBoundaryVertex,
  getWorldCoordinate,
  getBiomeWeightsForTile,
  getBiomeWeightForTile,
  createSparseBiomeWeights,
} from './world/chunk';
export { WorkerPool, type WorkerPoolConfig } from './world/worker-pool';
export {
  WorldSerializer,
  SerializationFormat,
  type SerializationOptions,
  type SerializedWorld,
  type ChunkModification,
} from './world/serialization';
export { LakeManager, type WorldLakeData } from './world/lake-manager';
export { RiverManager } from './world/river-manager';

// Rendering data helpers
export {
  createIndexedGeometryData,
  getIndexedGeometryVertexCount,
  type IndexedGeometryData,
} from './rendering/geometry';
export {
  buildLakeGeometryData,
  buildOceanGeometryData,
  buildRiverGeometryData,
  identifyLakeSurfaceTiles,
  identifyOceanSurfaceTiles,
  type WaterGeometryOptions,
  type WaterSurfaceTile,
} from './rendering/water-geometry';
export {
  buildTerrainGridGeometryData,
  type TerrainGridGeometryData,
  type TerrainGridGeometryOptions,
} from './rendering/terrain-geometry';
export {
  RIVER_TRENCH_DARKEN_STRENGTH,
  calculateFrozenRiverInfluence,
  calculateRiverbedInfluence,
  calculateRiverTrenchInfluence,
  getRiverbedDarkening,
  getRiverTrenchDarkening,
} from './rendering/terrain-detail';
export {
  SHRUB_PROTOTYPE_MIN_Y,
  planFoliagePlacements,
  type FoliagePlacement,
  type FoliagePlacementPlan,
  type FoliageProfile,
  type TerrainPropPlacement,
  type TreePlacement,
  type TreeVariant,
} from './rendering/foliage-placement';
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
} from './rendering/chunk-overlays';
export {
  RenderLayer,
  applyChunkVisibility,
  applyRenderLayerVisibility,
  isRenderLayerVisible,
  type RenderLayerChunk,
  type RenderLayerVisibilityState,
  type VisibleObject,
} from './rendering/render-layers';
export {
  RenderStatsCache,
  calculateRenderStats,
  type RenderStats,
  type RenderStatsChunk,
  type RenderStatsGeometry,
  type RenderStatsGeometryAttribute,
  type RenderStatsGroup,
  type RenderStatsMesh,
  type RenderStatsNowProvider,
  type RenderStatsObject,
} from './rendering/render-stats';

// Runtime engine shell
export {
  Entity,
  EntityManager,
  EngineRuntime,
  EngineRuntimeState,
  ChunkStreamingSystem,
  CAMERA_COMPONENT,
  CHUNK_STREAMING_TARGET_COMPONENT,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_MOVEMENT_ACTIONS,
  INPUT_ACTION_BACKWARD,
  INPUT_ACTION_DOWN,
  INPUT_ACTION_FORWARD,
  INPUT_ACTION_LEFT,
  INPUT_ACTION_RIGHT,
  INPUT_ACTION_SPRINT,
  INPUT_ACTION_UP,
  InputState,
  InputSystem,
  MOVEMENT_COMPONENT,
  MovementSystem,
  RenderSyncSystem,
  TRANSFORM_COMPONENT,
  WorldScene,
  WorldSession,
  createCameraComponent,
  createChunkStreamingTargetComponent,
  createMovementComponent,
  createTransformComponent,
  createVector3,
  type CameraComponent,
  type ChunkCoordinate,
  type ChunkStreamingSystemOptions,
  type ChunkStreamingTargetComponent,
  type ComponentKey,
  type EngineRuntimeOptions,
  type EntityId,
  type InputAction,
  type InputAxis,
  type InputEventTarget,
  type InputSystemOptions,
  type KeyBinding,
  type MovementActionMap,
  type MovementComponent,
  type MovementSystemOptions,
  type RendererAdapter,
  type RenderSyncSystemOptions,
  type RuntimeClock,
  type RuntimeSystem,
  type RuntimeUpdateContext,
  type TransformComponent,
  type Vector3,
  type WorldSceneOptions,
  type WorldScenePlayerOptions,
  type WorldSessionCacheClearedEvent,
  type WorldSessionCacheStats,
  type WorldSessionChunkEntry,
  type WorldSessionConfigChangedEvent,
  type WorldSessionEvent,
  type WorldSessionEventCallback,
  type WorldSessionEventMap,
  type WorldSessionExportResult,
  type WorldSessionLoadChunksOptions,
  type WorldSessionLoadChunksResult,
  type WorldSessionLoadOptions,
  type WorldSessionOptions,
  type WorldSessionRegenerateOptions,
  type WorldSessionSceneOptions,
  type WorldSessionUnloadChunksOptions,
  type WorldSessionUnloadChunksResult,
  type WorldSessionUnsubscribe,
  type WorldSessionUpdateConfigOptions,
  type WorldSessionUpdateConfigResult,
  type WorldSessionWorldChangedEvent,
  type WorldSessionWorldLoadedEvent,
  type WorldSessionWorldStats,
  type WorldSessionWorkerPoolStats,
} from './runtime';

// Generators
export { TerrainGenerator, type TerrainConfig } from './gen/terrain';
export { ResourceGenerator, type ResourceConfig, type ResourceTypeConfig } from './gen/resources';
export { StructurePlacer, type StructureConfig, type StructureTypeConfig, type PlacementRule } from './gen/structures';
export { LakeGenerator, type LakeConfig, type LakeData, DEFAULT_LAKE_CONFIG } from './gen/lakes';
export {
  type RiverConfig,
  type RiverData,
  type RiverPath,
  type RiverPoint,
  type RiverState,
  type WorldRiverData,
  createRiverCorridorPoints,
  createSmoothedRiverPoints,
  DEFAULT_RIVER_CONFIG,
  getRiverChannelDepth,
  getRiverChannelWidth,
  getRiverFlow,
  getRiverValleyDepth,
  getRiverValleyWidth,
  getRiverWaterLevel,
} from './gen/rivers';

// Utilities
export { poissonDiskSampling, type PoissonConfig } from './utils/poisson';
export { validateWorldConfig, ValidationError } from './utils/validation';
export {
  ChunkGenerationError,
  TerrainGenerationError,
  BiomeGenerationError,
  LakeGenerationError,
  RiverGenerationError,
  ResourceGenerationError,
  StructureGenerationError,
  type ErrorRecoveryOptions,
  DEFAULT_ERROR_RECOVERY,
} from './utils/errors';
export {
  logger,
  configureLogger,
  LogLevel,
  LogCategory,
  type LoggerConfig,
} from './utils/logger';

// Web Worker support
export {
  serializeChunkData,
  deserializeChunkData,
  handleWorkerMessage,
  installWorkerHandler,
  resetWorkerState,
  setMessagePoster,
  type WorkerRequest,
  type WorkerResponse,
  type InitMessage,
  type GenerateChunkMessage,
  type ClearCacheMessage,
  type ReadyResponse,
  type ChunkReadyResponse,
  type CacheClearedResponse,
  type ErrorResponse,
  type SerializedChunkData,
} from './worker';
