import { DEFAULT_LAKE_CONFIG, type LakeConfig } from '../gen/lakes';
import { DEFAULT_RIVER_CONFIG, type RiverConfig } from '../gen/rivers';
import type { TerrainGenerator } from '../gen/terrain';
import type { BiomeSystem } from './biome';
import { BiomeType } from './chunk';
import type { EnhancedBiomeConfig } from './enhanced-biome';
import { LakeManager } from './lake-manager';
import { RiverManager } from './river-manager';

export interface HydrologyManagerFactoryConfig {
  seed: number;
  lakeConfig?: LakeConfig;
  riverConfig?: RiverConfig;
  enhancedBiomeConfig?: EnhancedBiomeConfig;
  terrainGenerator: TerrainGenerator;
  biomeSystem: BiomeSystem;
}

export interface HydrologyManagers {
  lakeManager: LakeManager | null;
  riverManager: RiverManager | null;
}

export function createHydrologyManagers({
  seed,
  lakeConfig: configuredLakeConfig,
  riverConfig: configuredRiverConfig,
  enhancedBiomeConfig,
  terrainGenerator,
  biomeSystem,
}: HydrologyManagerFactoryConfig): HydrologyManagers {
  const getHeightAt = (worldX: number, worldY: number) => terrainGenerator.getHeightAt(worldX, worldY, seed);
  const getBiomeAt = (worldX: number, worldY: number) => {
    const height = getHeightAt(worldX, worldY);
    return biomeSystem.getBiome(worldX, worldY, height);
  };

  const lakeConfig = configuredLakeConfig ?? DEFAULT_LAKE_CONFIG;
  const adjustedLakeConfig = adjustLakeConfigForClimate(lakeConfig, enhancedBiomeConfig);
  const lakeManager = lakeConfig.enabled
    ? new LakeManager(seed, adjustedLakeConfig, getHeightAt, getBiomeAt)
    : null;

  const riverConfig = configuredRiverConfig ?? DEFAULT_RIVER_CONFIG;
  const riverManager = riverConfig.enabled
    ? new RiverManager(seed, riverConfig, getHeightAt, getBiomeAt)
    : null;

  if (lakeManager && riverManager) {
    lakeManager.setRiverTileChecker((x, y) => riverManager.isPointInRiverCorridor(x, y));
    riverManager.setLakeTileChecker((x, y) => lakeManager.isPointInLake(x, y));
  }

  return { lakeManager, riverManager };
}

function adjustLakeConfigForClimate(lakeConfig: LakeConfig, enhancedBiomeConfig?: EnhancedBiomeConfig): LakeConfig {
  const temperatureOffset = enhancedBiomeConfig?.worldTemperatureOffset
    ?? enhancedBiomeConfig?.climateConfig?.worldTemperatureOffset
    ?? 0;
  const allowedBiomes = new Set<BiomeType>(lakeConfig.allowedBiomes);

  if (temperatureOffset > 0.4) {
    allowedBiomes.delete(BiomeType.TUNDRA);
    allowedBiomes.delete(BiomeType.TAIGA);
    allowedBiomes.delete(BiomeType.POLAR);
  }

  if (temperatureOffset < -0.4) {
    allowedBiomes.delete(BiomeType.DESERT);
    allowedBiomes.delete(BiomeType.SAVANNA);
    allowedBiomes.delete(BiomeType.DRY_FOREST);
  }

  return {
    ...lakeConfig,
    allowedBiomes: Array.from(allowedBiomes),
  };
}
