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
export { BiomeSystem, type BiomeConfig } from './world/biome';
export {
  EnhancedBiomeSystem,
  type EnhancedBiomeConfig,
  type EnhancedBiomeData,
  MicroBiomeType,
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
} from './world/chunk';
export { WorkerPool, type WorkerPoolConfig } from './world/worker-pool';
export {
  WorldSerializer,
  SerializationFormat,
  type SerializationOptions,
  type SerializedWorld,
  type ChunkModification,
} from './world/serialization';

// Generators
export { TerrainGenerator, type TerrainConfig } from './gen/terrain';
export { ResourceGenerator, type ResourceConfig, type ResourceTypeConfig } from './gen/resources';
export { StructurePlacer, type StructureConfig, type StructureTypeConfig, type PlacementRule } from './gen/structures';
export { LakeGenerator, type LakeConfig, type LakeData, DEFAULT_LAKE_CONFIG } from './gen/lakes';

// Utilities
export { poissonDiskSampling, type PoissonConfig } from './utils/poisson';

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
