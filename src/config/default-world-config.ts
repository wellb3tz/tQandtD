import { DEFAULT_RIVER_CONFIG } from '../gen/rivers';
import { DEFAULT_DIRECTIONAL_CLIMATE_CONFIG } from '../world/climate';
import { BiomeType, ResourceType } from '../world/chunk';
import type { WorldConfig } from '../world/world-config';

export type WorldConfigOverrides = Omit<
  Partial<WorldConfig>,
  | 'terrainConfig'
  | 'biomeConfig'
  | 'enhancedBiomeConfig'
  | 'resourceConfig'
  | 'structureConfig'
  | 'lakeConfig'
  | 'riverConfig'
> & {
  terrainConfig?: Partial<WorldConfig['terrainConfig']>;
  biomeConfig?: Partial<WorldConfig['biomeConfig']>;
  enhancedBiomeConfig?: Partial<NonNullable<WorldConfig['enhancedBiomeConfig']>>;
  resourceConfig?: Partial<WorldConfig['resourceConfig']>;
  structureConfig?: Partial<WorldConfig['structureConfig']>;
  lakeConfig?: Partial<NonNullable<WorldConfig['lakeConfig']>>;
  riverConfig?: Partial<NonNullable<WorldConfig['riverConfig']>>;
};

export function createDefaultWorldConfig(overrides: WorldConfigOverrides = {}): WorldConfig {
  return prepareWorldConfig(mergeWorldConfig(createBaseWorldConfig(), overrides));
}

export function cloneWorldConfig(config: WorldConfig): WorldConfig {
  return {
    ...config,
    terrainConfig: clonePlainValue(config.terrainConfig),
    biomeConfig: clonePlainValue(config.biomeConfig),
    resourceConfig: {
      ...config.resourceConfig,
      types: config.resourceConfig.types.map(type => ({
        ...type,
        biomes: [...type.biomes],
      })),
    },
    structureConfig: {
      ...config.structureConfig,
      types: config.structureConfig.types.map(type => ({
        ...type,
        rules: type.rules.map(rule => ({
          ...rule,
          params: clonePlainValue(rule.params),
        })),
      })),
    },
    noise3DConfig: config.noise3DConfig ? { ...config.noise3DConfig } : undefined,
    enhancedBiomeConfig: config.enhancedBiomeConfig ? clonePlainValue(config.enhancedBiomeConfig) : undefined,
    lakeConfig: config.lakeConfig
      ? {
          ...config.lakeConfig,
          allowedBiomes: [...config.lakeConfig.allowedBiomes],
        }
      : undefined,
    riverConfig: config.riverConfig
      ? {
          ...config.riverConfig,
          allowedSourceBiomes: [...config.riverConfig.allowedSourceBiomes],
        }
      : undefined,
    workerPoolConfig: config.workerPoolConfig ? { ...config.workerPoolConfig } : undefined,
  };
}

export function mergeWorldConfig(base: WorldConfig, overrides: WorldConfigOverrides = {}): WorldConfig {
  const merged = cloneWorldConfig(base);

  assignIfDefined(merged, overrides, 'seed');
  assignIfDefined(merged, overrides, 'chunkSize');
  assignIfDefined(merged, overrides, 'noise3DConfig');
  assignIfDefined(merged, overrides, 'workerPoolConfig');
  assignIfDefined(merged, overrides, 'maxCacheSize');
  assignIfDefined(merged, overrides, 'enablePerformanceMetrics');
  assignIfDefined(merged, overrides, 'onProgress');
  assignIfDefined(merged, overrides, 'onChunkInvalidated');
  assignIfDefined(merged, overrides, 'errorRecovery');

  if (overrides.terrainConfig) {
    merged.terrainConfig = {
      ...clonePlainValue(base.terrainConfig),
      ...overrides.terrainConfig,
    };
  }

  if (overrides.biomeConfig) {
    merged.biomeConfig = {
      ...clonePlainValue(base.biomeConfig),
      ...overrides.biomeConfig,
    };
  }

  if (overrides.enhancedBiomeConfig) {
    merged.enhancedBiomeConfig = base.enhancedBiomeConfig
      ? {
          ...clonePlainValue(base.enhancedBiomeConfig),
          ...overrides.enhancedBiomeConfig,
        }
      : clonePlainValue(overrides.enhancedBiomeConfig) as NonNullable<WorldConfig['enhancedBiomeConfig']>;
  }

  if (overrides.resourceConfig) {
    merged.resourceConfig = {
      ...base.resourceConfig,
      ...overrides.resourceConfig,
      types: (overrides.resourceConfig.types ?? base.resourceConfig.types).map(type => ({
        ...type,
        biomes: [...type.biomes],
      })),
    };
  }

  if (overrides.structureConfig) {
    merged.structureConfig = {
      ...base.structureConfig,
      ...overrides.structureConfig,
      types: (overrides.structureConfig.types ?? base.structureConfig.types).map(type => ({
        ...type,
        rules: type.rules.map(rule => ({
          ...rule,
          params: clonePlainValue(rule.params),
        })),
      })),
    };
  }

  if (overrides.lakeConfig) {
    merged.lakeConfig = base.lakeConfig
      ? {
          ...base.lakeConfig,
          ...overrides.lakeConfig,
          allowedBiomes: [...(overrides.lakeConfig.allowedBiomes ?? base.lakeConfig.allowedBiomes)],
        }
      : (overrides.lakeConfig as NonNullable<WorldConfig['lakeConfig']>);
  }

  if (overrides.riverConfig) {
    merged.riverConfig = {
      ...(base.riverConfig ?? DEFAULT_RIVER_CONFIG),
      ...overrides.riverConfig,
      allowedSourceBiomes: [
        ...(overrides.riverConfig.allowedSourceBiomes ?? base.riverConfig?.allowedSourceBiomes ?? DEFAULT_RIVER_CONFIG.allowedSourceBiomes),
      ],
    };
  }

  return merged;
}

export function deriveNoise3DConfig(
  terrainConfig: WorldConfig['terrainConfig']
): WorldConfig['noise3DConfig'] | undefined {
  if (!terrainConfig.enable3D) {
    return undefined;
  }

  return {
    enable3D: true,
    octaves: terrainConfig.octaves,
    persistence: terrainConfig.persistence,
    lacunarity: terrainConfig.lacunarity,
    scale: terrainConfig.baseScale,
    zScale: terrainConfig.zScale ?? 0.5,
  };
}

export function prepareWorldConfig(
  config: WorldConfig,
  overrides: WorldConfigOverrides = {}
): WorldConfig {
  const prepared = mergeWorldConfig(config, overrides);
  prepared.noise3DConfig = deriveNoise3DConfig(prepared.terrainConfig);
  return prepared;
}

function createBaseWorldConfig(): WorldConfig {
  return {
    seed: 12345,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 0.2,
      heightMultiplier: 2.0,
      enable3D: false,
      zScale: 0.5,
      enableContinentalness: true,
      continentalScale: 0.002,
      continentalStrength: 0.45,
      enableCliffs: true,
      cliffStrength: 0.42,
      cliffElevationStart: 0.52,
      enableCanyons: true,
      canyonStrength: 0.9,
      canyonDepth: 0.28,
      directionalClimateConfig: {
        ...DEFAULT_DIRECTIONAL_CLIMATE_CONFIG,
        enabled: true,
      },
    },
    biomeConfig: {
      temperatureScale: 0.001,
      moistureScale: 0.001,
      blendRadius: 0.5,
      directionalClimateConfig: {
        ...DEFAULT_DIRECTIONAL_CLIMATE_CONFIG,
        enabled: true,
      },
    },
    enhancedBiomeConfig: {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 0.5,
      enableTransitions: false,
      transitionWidth: 4,
      enableElevationBands: true,
      snowLineElevation: 0.8,
      treeLineElevation: 0.75,
      worldTemperatureOffset: 0,
      worldMoistureOffset: 0,
      directionalClimateConfig: {
        ...DEFAULT_DIRECTIONAL_CLIMATE_CONFIG,
        enabled: true,
      },
    },
    resourceConfig: {
      types: [
        { type: ResourceType.IRON, rarity: 0.5, biomes: [BiomeType.TUNDRA, BiomeType.MOUNTAIN, BiomeType.SAVANNA, BiomeType.STEPPE], minAmount: 1, maxAmount: 5 },
        { type: ResourceType.GOLD, rarity: 0.5, biomes: [BiomeType.TUNDRA, BiomeType.MOUNTAIN, BiomeType.POLAR], minAmount: 1, maxAmount: 3 },
        { type: ResourceType.COAL, rarity: 0.5, biomes: [BiomeType.PLAINS, BiomeType.FOREST, BiomeType.TAIGA, BiomeType.TUNDRA, BiomeType.DRY_FOREST], minAmount: 2, maxAmount: 6 },
        { type: ResourceType.STONE, rarity: 0.5, biomes: [BiomeType.TUNDRA, BiomeType.MOUNTAIN, BiomeType.SAVANNA, BiomeType.STEPPE, BiomeType.POLAR], minAmount: 3, maxAmount: 8 },
        { type: ResourceType.WOOD, rarity: 0.5, biomes: [BiomeType.FOREST, BiomeType.TAIGA, BiomeType.SWAMP, BiomeType.RAINFOREST, BiomeType.DRY_FOREST], minAmount: 1, maxAmount: 4 },
      ],
      clusterScale: 20,
      densityThreshold: 0.6,
    },
    structureConfig: {
      types: [
        { type: 0, rarity: 1.0, rules: [] },
        { type: 1, rarity: 1.0, rules: [] },
        { type: 2, rarity: 1.0, rules: [] },
      ],
      minDistance: 30,
      maxAttempts: 30,
    },
    lakeConfig: {
      enabled: true,
      useMultiChunk: true,
      noiseScale: 0.01,
      noiseThreshold: 0.62,
      minElevation: 0.32,
      maxElevation: 0.72,
      allowedBiomes: [
        BiomeType.PLAINS,
        BiomeType.FOREST,
        BiomeType.DRY_FOREST,
        BiomeType.STEPPE,
        BiomeType.TAIGA,
        BiomeType.TUNDRA,
        BiomeType.MOUNTAIN,
        BiomeType.SWAMP,
        BiomeType.SAVANNA,
      ],
      maxLakeTiles: 80,
      maxFillDepth: 0.06,
    },
    riverConfig: { ...DEFAULT_RIVER_CONFIG },
    maxCacheSize: 1000,
    enablePerformanceMetrics: true,
  };
}

function clonePlainValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => clonePlainValue(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, clonePlainValue(entry)])
    ) as T;
  }

  return value;
}

function assignIfDefined<K extends keyof WorldConfig>(
  target: WorldConfig,
  source: WorldConfigOverrides,
  key: K
): void {
  const value = source[key] as WorldConfig[K] | undefined;
  if (value !== undefined) {
    target[key] = value;
  }
}
