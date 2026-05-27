import { chunkSeed } from '../core/hash';
import type { NoiseEngine } from '../core/noise';
import type { ResourceGenerator } from '../gen/resources';
import type { StructurePlacer } from '../gen/structures';
import type { TerrainGenerator } from '../gen/terrain';
import type { BiomeSystem } from './biome';
import type { ChunkData } from './chunk';
import { fixBiomesAfterHeightChange, generateChunkBiomeData } from './chunk-biome-processing';
import type { ChunkPerformanceMetrics, WorldConfig } from './world-config';
import type { EnhancedBiomeSystem } from './enhanced-biome';
import { carveTerrainForWorldLakes, convertWorldLakesToChunkLakes, determineLakeState } from './lake-chunk-processing';
import type { LakeManager } from './lake-manager';
import { carveTerrainForRivers, convertWorldRiversToChunkRivers, determineRiverState } from './river-chunk-processing';
import type { RiverManager } from './river-manager';
import {
  BiomeGenerationError,
  LakeGenerationError,
  RiverGenerationError,
  ResourceGenerationError,
  StructureGenerationError,
  TerrainGenerationError,
  type ErrorRecoveryOptions,
} from '../utils/errors';
import { logger, LogCategory } from '../utils/logger';

export interface ChunkGenerationPipelineDependencies {
  config: WorldConfig;
  terrainGenerator: TerrainGenerator;
  biomeSystem: BiomeSystem;
  resourceGenerator: ResourceGenerator;
  structurePlacer: StructurePlacer;
  noiseEngine3D: NoiseEngine | null;
  enhancedBiomeSystem: EnhancedBiomeSystem | null;
  lakeManager: LakeManager | null;
  riverManager: RiverManager | null;
  errorRecovery: ErrorRecoveryOptions;
  invalidateCachedChunk: (chunkX: number, chunkY: number) => boolean;
}

export function generateChunkThroughPipeline(
  chunkX: number,
  chunkY: number,
  dependencies: ChunkGenerationPipelineDependencies
): { chunk: ChunkData; metrics: ChunkPerformanceMetrics } {
  const { config } = dependencies;
  const startTime = config.enablePerformanceMetrics ? performance.now() : 0;
  const metrics: Partial<ChunkPerformanceMetrics> = {};
  const seed = chunkSeed(config.seed, chunkX, chunkY);

  let heightmap: Float32Array;
  try {
    config.onProgress?.('terrain', 0.2);
    const terrainStart = config.enablePerformanceMetrics ? performance.now() : 0;
    heightmap = dependencies.noiseEngine3D
      ? dependencies.terrainGenerator.generateHeightmap(
          config.seed,
          config.chunkSize,
          chunkX,
          chunkY,
          dependencies.noiseEngine3D
        )
      : dependencies.terrainGenerator.generateHeightmap(config.seed, config.chunkSize, chunkX, chunkY);

    if (config.enablePerformanceMetrics) {
      metrics.terrainTime = performance.now() - terrainStart;
    }

    const expectedSize = (config.chunkSize + 1) * (config.chunkSize + 1);
    if (!heightmap || heightmap.length === 0) {
      throw new Error('Generated heightmap is empty');
    }
    if (heightmap.length !== expectedSize) {
      throw new Error(`Invalid heightmap size: expected ${expectedSize}, got ${heightmap.length}`);
    }
  } catch (error) {
    throw new TerrainGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
  }

  let biomeData;
  try {
    config.onProgress?.('biomes', 0.4);
    const biomeStart = config.enablePerformanceMetrics ? performance.now() : 0;
    biomeData = generateChunkBiomeData(chunkX, chunkY, heightmap, {
      chunkSize: config.chunkSize,
      worldSeed: config.seed,
      biomeConfig: config.biomeConfig,
      biomeSystem: dependencies.biomeSystem,
      enhancedBiomeSystem: dependencies.enhancedBiomeSystem,
      getTerrainHeightAt: (worldX, worldY, worldSeed) =>
        dependencies.terrainGenerator.getHeightAt(worldX, worldY, worldSeed),
      enablePerformanceMetrics: config.enablePerformanceMetrics ?? false,
    });

    if (config.enablePerformanceMetrics) {
      metrics.biomeTime = performance.now() - biomeStart;
      metrics.biomeClassificationTime = biomeData.metrics.classificationTime;
      metrics.biomeBlendingTime = biomeData.metrics.blendingTime;
    }
    if (biomeData.biomeMap.length === 0) {
      throw new Error('Generated biome map is empty');
    }
  } catch (error) {
    throw new BiomeGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
  }

  const enhancedBiomes = dependencies.enhancedBiomeSystem;
  const chunk: ChunkData = {
    x: chunkX,
    y: chunkY,
    size: config.chunkSize,
    heightmap,
    biomeMap: biomeData.biomeMap,
    sparseBiomeTypes: biomeData.sparseBiomeTypes,
    sparseBiomeWeights: biomeData.sparseBiomeWeights,
    sparseBiomeOffsets: biomeData.sparseBiomeOffsets,
    climateSnowLine: enhancedBiomes?.getClimateSnowLine(),
    climateTreeLine: enhancedBiomes?.getClimateTreeLine(),
    worldTemperatureOffset: enhancedBiomes?.getWorldTemperatureOffset(),
    temperatureMap: biomeData.temperatureMap,
    lakes: [],
    rivers: [],
    resources: [],
    structures: [],
  };

  try {
    config.onProgress?.('rivers', 0.55);
    const riverStart = config.enablePerformanceMetrics ? performance.now() : 0;
    if (dependencies.riverManager) {
      const worldRivers = dependencies.riverManager.getRiversForChunk(chunkX, chunkY, config.chunkSize);
      const riverStateMap = new Map<string, 'flowing' | 'frozen' | 'dry'>();
      for (const river of worldRivers) {
        riverStateMap.set(
          river.id,
          determineRiverState(
            river,
            enhancedBiomes
              ? point => enhancedBiomes.sampleClimate(
                  point.x,
                  point.y,
                  point.height,
                  (worldX, worldY) => dependencies.terrainGenerator.getHeightAt(worldX, worldY, config.seed),
                )
              : undefined
          )
        );
      }
      chunk.rivers = convertWorldRiversToChunkRivers(
        worldRivers,
        chunkX,
        chunkY,
        config.chunkSize,
        config.riverConfig?.splineResolution,
        riverStateMap
      );
      if (chunk.rivers.length > 0) {
        carveTerrainForRivers(chunk.rivers, heightmap, config.chunkSize, config.riverConfig?.carveBankWidth);
        fixBiomesAfterHeightChange(chunk);
      }
    }
    if (config.enablePerformanceMetrics) {
      metrics.riverTime = performance.now() - riverStart;
    }
  } catch (error) {
    logger.warn(LogCategory.RIVER, `River generation failed for chunk (${chunkX}, ${chunkY}), continuing without rivers`, error);
    chunk.rivers = [];
    if (!dependencies.errorRecovery.allowPartialChunks) {
      throw new RiverGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
    }
  }

  try {
    config.onProgress?.('lakes', 0.58);
    const lakeStart = config.enablePerformanceMetrics ? performance.now() : 0;
    if (dependencies.lakeManager) {
      const worldLakes = dependencies.lakeManager.getLakesForChunk(
        chunkX,
        chunkY,
        config.chunkSize,
        (invalidatedX, invalidatedY) => {
          const wasInCache = dependencies.invalidateCachedChunk(invalidatedX, invalidatedY);
          logger.debug(
            LogCategory.CACHE,
            `Cache invalidation for chunk (${invalidatedX}, ${invalidatedY}): wasInCache=${wasInCache}`
          );
          config.onChunkInvalidated?.(invalidatedX, invalidatedY);
        }
      );
      const lakeClimateSampler = enhancedBiomes
        ? (worldX: number, worldY: number) => {
            const height = dependencies.terrainGenerator.getHeightAt(worldX, worldY, config.seed);
            return enhancedBiomes.sampleClimate(
              worldX,
              worldY,
              height,
              (sampleX, sampleY) => dependencies.terrainGenerator.getHeightAt(sampleX, sampleY, config.seed),
            );
          }
        : undefined;
      chunk.lakes = convertWorldLakesToChunkLakes(
        worldLakes,
        chunkX,
        chunkY,
        config.chunkSize,
        lake => determineLakeState(lake, lakeClimateSampler)
      );
      if (worldLakes.length > 0) {
        carveTerrainForWorldLakes(worldLakes, chunkX, chunkY, config.chunkSize, heightmap);
        fixBiomesAfterHeightChange(chunk);
      }
    }
    if (config.enablePerformanceMetrics) {
      metrics.lakeTime = performance.now() - lakeStart;
    }
  } catch (error) {
    logger.warn(LogCategory.LAKE, `Lake generation failed for chunk (${chunkX}, ${chunkY}), continuing without lakes`, error);
    chunk.lakes = [];
    if (!dependencies.errorRecovery.allowPartialChunks) {
      throw new LakeGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
    }
  }

  try {
    config.onProgress?.('resources', 0.6);
    const resourceStart = config.enablePerformanceMetrics ? performance.now() : 0;
    chunk.resources = dependencies.resourceGenerator.generateResources(chunk, seed);
    if (config.enablePerformanceMetrics) {
      metrics.resourceTime = performance.now() - resourceStart;
    }
  } catch (error) {
    logger.warn(LogCategory.CHUNK, `Resource generation failed for chunk (${chunkX}, ${chunkY}), continuing without resources`, error);
    chunk.resources = [];
    if (!dependencies.errorRecovery.allowPartialChunks) {
      throw new ResourceGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
    }
  }

  try {
    config.onProgress?.('structures', 0.8);
    const structureStart = config.enablePerformanceMetrics ? performance.now() : 0;
    chunk.structures = dependencies.structurePlacer.generateStructures(chunk, seed);
    if (config.enablePerformanceMetrics) {
      metrics.structureTime = performance.now() - structureStart;
    }
  } catch (error) {
    logger.warn(LogCategory.CHUNK, `Structure generation failed for chunk (${chunkX}, ${chunkY}), continuing without structures`, error);
    chunk.structures = [];
    if (!dependencies.errorRecovery.allowPartialChunks) {
      throw new StructureGenerationError(chunkX, chunkY, error instanceof Error ? error : undefined);
    }
  }

  config.onProgress?.('complete', 1);
  if (config.enablePerformanceMetrics) {
    metrics.totalTime = performance.now() - startTime;
    if (metrics.totalTime > 100) {
      logger.info(LogCategory.PERFORMANCE, `Chunk (${chunkX}, ${chunkY}) generation metrics`, metrics);
    }
  }

  return {
    chunk,
    metrics: {
      totalTime: metrics.totalTime ?? 0,
      terrainTime: metrics.terrainTime ?? 0,
      biomeTime: metrics.biomeTime ?? 0,
      biomeClassificationTime: metrics.biomeClassificationTime ?? 0,
      biomeBlendingTime: metrics.biomeBlendingTime ?? 0,
      riverTime: metrics.riverTime ?? 0,
      lakeTime: metrics.lakeTime ?? 0,
      resourceTime: metrics.resourceTime ?? 0,
      structureTime: metrics.structureTime ?? 0,
    },
  };
}
