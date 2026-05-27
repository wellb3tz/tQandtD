import type { BiomeConfig } from './biome';
import type { EnhancedBiomeConfig } from './enhanced-biome';
import type { LakeConfig } from '../gen/lakes';
import type { ResourceConfig } from '../gen/resources';
import type { RiverConfig } from '../gen/rivers';
import type { StructureConfig } from '../gen/structures';
import type { TerrainConfig } from '../gen/terrain';
import type { NoiseConfig } from '../core/noise';
import type { WorkerPoolConfig } from './worker-pool';
import type { ErrorRecoveryOptions } from '../utils/errors';

export interface Noise3DConfig extends NoiseConfig {
  enable3D: boolean;
  zScale?: number;
}

export interface ChunkPerformanceMetrics {
  totalTime: number;
  terrainTime: number;
  biomeTime: number;
  biomeClassificationTime: number;
  biomeBlendingTime: number;
  riverTime: number;
  lakeTime: number;
  resourceTime: number;
  structureTime: number;
}

export type ProgressCallback = (stage: string, progress: number) => void;

export type ChunkInvalidationCallback = (chunkX: number, chunkY: number) => void;

export interface WorldConfig {
  seed: number;
  chunkSize: number;
  terrainConfig: TerrainConfig;
  biomeConfig: BiomeConfig;
  resourceConfig: ResourceConfig;
  structureConfig: StructureConfig;
  noise3DConfig?: Noise3DConfig;
  enhancedBiomeConfig?: EnhancedBiomeConfig;
  lakeConfig?: LakeConfig;
  riverConfig?: RiverConfig;
  workerPoolConfig?: WorkerPoolConfig;
  maxCacheSize?: number;
  enablePerformanceMetrics?: boolean;
  onProgress?: ProgressCallback;
  onChunkInvalidated?: ChunkInvalidationCallback;
  errorRecovery?: ErrorRecoveryOptions;
}

