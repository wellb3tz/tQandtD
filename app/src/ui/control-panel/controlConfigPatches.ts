import {
  DEFAULT_CLIMATE_CONFIG,
  DEFAULT_RIVER_CONFIG,
  type WorldConfig,
  type WorldConfigOverrides,
} from '@engine/index';
import {
  DEFAULT_RESOURCE_BIOMES,
  RESOURCE_TYPE_BY_CONTROL_ID,
  STRUCTURE_TYPE_BY_CONTROL_ID,
} from './controlSchemas';

const ENHANCED_BIOME_FEATURES = new Set([
  'enableTransitions',
  'transitionWidth',
  'enableElevationBands',
  'snowLineElevation',
  'treeLineElevation',
  'worldTemperatureOffset',
  'worldMoistureOffset',
]);

export function buildTerrainConfigPatch(
  config: WorldConfig,
  patch: Record<string, number | boolean>,
): WorldConfigOverrides {
  return {
    terrainConfig: {
      ...config.terrainConfig,
      ...patch,
    },
  };
}

export function buildBiomeUpdateConfig(
  config: WorldConfig,
  key: string,
  value: number | boolean,
): WorldConfigOverrides {
  if (ENHANCED_BIOME_FEATURES.has(key)) {
    const currentEnhancedConfig = config.enhancedBiomeConfig || {
      ...config.biomeConfig,
      enableTransitions: true,
      transitionWidth: 10,
      enableElevationBands: false,
      snowLineElevation: 0.8,
      treeLineElevation: 0.75,
    };

    return {
      enhancedBiomeConfig: {
        ...currentEnhancedConfig,
        [key]: value,
      },
    };
  }

  if (key === 'temperatureScale' || key === 'moistureScale') {
    const newConfig = buildBiomeConfigPatch(config, { [key]: value });

    if (config.enhancedBiomeConfig) {
      const climateConfigKey = key === 'temperatureScale' ? 'climateScale' : 'detailScale';
      newConfig.enhancedBiomeConfig = {
        ...config.enhancedBiomeConfig,
        climateConfig: {
          ...DEFAULT_CLIMATE_CONFIG,
          ...config.enhancedBiomeConfig.climateConfig,
          [climateConfigKey]: value,
        },
      };
    }

    return newConfig;
  }

  return buildBiomeConfigPatch(config, { [key]: value });
}

export function buildBiomeConfigPatch(
  config: WorldConfig,
  patch: Record<string, number | boolean>,
): WorldConfigOverrides {
  const newConfig: WorldConfigOverrides = {
    biomeConfig: {
      ...config.biomeConfig,
      ...patch,
    },
  };

  if (config.enhancedBiomeConfig) {
    newConfig.enhancedBiomeConfig = {
      ...config.enhancedBiomeConfig,
      ...patch,
    };
  }

  return newConfig;
}

export function buildResourceConfigPatch(config: WorldConfig, patch: Record<string, unknown>): WorldConfigOverrides {
  return {
    resourceConfig: {
      ...config.resourceConfig,
      ...patch,
    },
  };
}

export function buildResourceTypePatch(
  config: WorldConfig,
  key: string,
  enabled: boolean,
): Record<string, unknown> | null {
  const resourceTypeIndex = RESOURCE_TYPE_BY_CONTROL_ID[key];
  if (resourceTypeIndex === undefined) return null;

  const currentTypes = config.resourceConfig?.types || [];
  let updatedTypes = [...currentTypes];

  if (enabled) {
    if (!updatedTypes.some(t => t.type === resourceTypeIndex)) {
      updatedTypes.push({
        type: resourceTypeIndex,
        rarity: 0.5,
        biomes: DEFAULT_RESOURCE_BIOMES[resourceTypeIndex] || [3, 4, 5, 6],
        minAmount: 1,
        maxAmount: 5,
      });
    }
  } else {
    updatedTypes = updatedTypes.filter(t => t.type !== resourceTypeIndex);
  }

  return { types: updatedTypes };
}

export function buildStructureConfigPatch(config: WorldConfig, patch: Record<string, unknown>): WorldConfigOverrides {
  return {
    structureConfig: {
      ...config.structureConfig,
      ...patch,
    },
  };
}

export function buildStructureTypePatch(
  config: WorldConfig,
  key: string,
  enabled: boolean,
): Record<string, unknown> | null {
  const structureTypeIndex = STRUCTURE_TYPE_BY_CONTROL_ID[key];
  if (structureTypeIndex === undefined) return null;

  const currentTypes = config.structureConfig?.types || [];
  let updatedTypes = [...currentTypes];

  if (enabled) {
    if (!updatedTypes.some(t => t.type === structureTypeIndex)) {
      updatedTypes.push({
        type: structureTypeIndex,
        rarity: 1.0,
        rules: [],
      });
    }
  } else {
    updatedTypes = updatedTypes.filter(t => t.type !== structureTypeIndex);
  }

  return { types: updatedTypes };
}

export function buildLakeConfigPatch(
  config: WorldConfig,
  patch: Record<string, boolean>,
): WorldConfigOverrides {
  const currentLakeConfig = config.lakeConfig || {
    enabled: true,
    useMultiChunk: false,
    noiseScale: 0.01,
    noiseThreshold: 0.62,
    minElevation: 0.32,
    maxElevation: 0.72,
    allowedBiomes: [3, 4, 5, 6, 7, 8, 9],
    maxLakeTiles: 80,
    maxFillDepth: 0.06,
  };

  return {
    lakeConfig: {
      ...currentLakeConfig,
      ...patch,
    },
  };
}

export function buildRiverConfigPatch(
  config: WorldConfig,
  patch: Record<string, boolean | number>,
): WorldConfigOverrides {
  return {
    riverConfig: {
      ...(config.riverConfig || DEFAULT_RIVER_CONFIG),
      ...patch,
    },
  };
}
