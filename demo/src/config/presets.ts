/**
 * Preset Configurations for Demo Application
 * 
 * Provides ready-to-use world configurations that showcase different
 * terrain types and engine capabilities.
 */

import { WorldConfig, BiomeType, ResourceType, StructureType } from '../../../src/index';
import { getWorkerUrl } from '../../worker-loader';

/**
 * Preset configuration interface
 */
export interface PresetConfig {
  name: string;
  description: string;
  config: WorldConfig;
}

/**
 * Mountainous preset - Dramatic mountain ranges with high peaks
 */
const MOUNTAINOUS_PRESET: PresetConfig = {
  name: 'Mountainous',
  description: 'Dramatic mountain ranges with high peaks and deep valleys',
  config: {
    seed: 12345,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.005,
      octaves: 6,
      persistence: 0.6,
      lacunarity: 2.5,
      warpStrength: 50,
      heightMultiplier: 1.5
    },
    biomeConfig: {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 5
    },
    resourceConfig: {
      types: [
        { type: ResourceType.IRON, rarity: 0.5, biomes: [BiomeType.MOUNTAIN] },
        { type: ResourceType.GOLD, rarity: 0.3, biomes: [BiomeType.MOUNTAIN] },
        { type: ResourceType.STONE, rarity: 0.7, biomes: [BiomeType.MOUNTAIN, BiomeType.HILLS] }
      ],
      clusterScale: 20,
      densityThreshold: 0.6
    },
    structureConfig: {
      types: [
        { type: StructureType.TOWER, rarity: 1.0, rules: [] }
      ],
      minDistance: 15,
      maxAttempts: 30
    },
    riverConfig: {
      sourceElevation: 0.8,
      minFlowLength: 20,
      flowWidth: 2
    }
  }
};

/**
 * Flat Plains preset - Gentle rolling plains with minimal elevation
 */
const FLAT_PLAINS_PRESET: PresetConfig = {
  name: 'Flat Plains',
  description: 'Gentle rolling plains with minimal elevation changes',
  config: {
    seed: 54321,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.02,
      octaves: 2,
      persistence: 0.3,
      lacunarity: 1.8,
      warpStrength: 10,
      heightMultiplier: 0.5
    },
    biomeConfig: {
      temperatureScale: 0.008,
      moistureScale: 0.008,
      blendRadius: 8
    },
    resourceConfig: {
      types: [
        { type: ResourceType.WOOD, rarity: 0.6, biomes: [BiomeType.FOREST, BiomeType.PLAINS] },
        { type: ResourceType.COAL, rarity: 0.5, biomes: [BiomeType.PLAINS] },
        { type: ResourceType.STONE, rarity: 0.4, biomes: [BiomeType.PLAINS] }
      ],
      clusterScale: 25,
      densityThreshold: 0.5
    },
    structureConfig: {
      types: [
        { type: StructureType.VILLAGE, rarity: 1.0, rules: [] },
        { type: StructureType.RUINS, rarity: 0.8, rules: [] }
      ],
      minDistance: 10,
      maxAttempts: 30
    },
    riverConfig: {
      sourceElevation: 0.6,
      minFlowLength: 10,
      flowWidth: 3
    }
  }
};

/**
 * Island World preset - Archipelago with ocean and beaches
 */
const ISLAND_WORLD_PRESET: PresetConfig = {
  name: 'Island World',
  description: 'Archipelago with islands, ocean, and beaches',
  config: {
    seed: 99999,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.008,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 40,
      heightMultiplier: 0.8
    },
    biomeConfig: {
      temperatureScale: 0.008,
      moistureScale: 0.008,
      blendRadius: 8
    },
    enhancedBiomeConfig: {
      enableTransitions: true,
      transitionWidth: 12,
      enableMicroBiomes: true,
      microBiomeFrequency: 0.15,
      enableElevationBands: true,
      snowLineElevation: 0.85
    },
    resourceConfig: {
      types: [
        { type: ResourceType.WOOD, rarity: 0.5, biomes: [BiomeType.FOREST] },
        { type: ResourceType.STONE, rarity: 0.6, biomes: [BiomeType.MOUNTAIN] },
        { type: ResourceType.GOLD, rarity: 0.2, biomes: [BiomeType.DESERT] }
      ],
      clusterScale: 20,
      densityThreshold: 0.6
    },
    structureConfig: {
      types: [
        { type: StructureType.VILLAGE, rarity: 0.8, rules: [] },
        { type: StructureType.TOWER, rarity: 0.5, rules: [] }
      ],
      minDistance: 12,
      maxAttempts: 30
    },
    riverConfig: {
      sourceElevation: 0.7,
      minFlowLength: 8,
      flowWidth: 2
    }
  }
};

/**
 * River Valley preset - Dense river networks with tributaries
 */
const RIVER_VALLEY_PRESET: PresetConfig = {
  name: 'River Valley',
  description: 'Dense river networks with tributaries and lakes',
  config: {
    seed: 77777,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 30,
      heightMultiplier: 1.0
    },
    biomeConfig: {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 5
    },
    resourceConfig: {
      types: [
        { type: ResourceType.WOOD, rarity: 0.7, biomes: [BiomeType.FOREST] },
        { type: ResourceType.COAL, rarity: 0.5, biomes: [BiomeType.PLAINS, BiomeType.FOREST] },
        { type: ResourceType.IRON, rarity: 0.4, biomes: [BiomeType.HILLS] }
      ],
      clusterScale: 20,
      densityThreshold: 0.6
    },
    structureConfig: {
      types: [
        { type: StructureType.VILLAGE, rarity: 1.0, rules: [] },
        { type: StructureType.RUINS, rarity: 0.6, rules: [] }
      ],
      minDistance: 10,
      maxAttempts: 30
    },
    riverConfig: {
      sourceElevation: 0.6,
      minFlowLength: 15,
      flowWidth: 3
    },
    riverNetworkConfig: {
      enableTributaries: true,
      tributaryProbability: 0.4,
      enableLakes: true,
      enableDeltas: true,
      minTributaryLength: 5,
      maxTributaryBranches: 3
    }
  }
};

/**
 * Performance Test preset - Optimized for performance testing with LOD and Worker Pool
 */
const PERFORMANCE_TEST_PRESET: PresetConfig = {
  name: 'Performance Test',
  description: 'Optimized configuration for performance testing with LOD and Worker Pool',
  config: {
    seed: 11111,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 30,
      heightMultiplier: 1.0
    },
    biomeConfig: {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 5
    },
    resourceConfig: {
      types: [
        { type: ResourceType.IRON, rarity: 0.5, biomes: [] },
        { type: ResourceType.GOLD, rarity: 0.3, biomes: [] },
        { type: ResourceType.COAL, rarity: 0.5, biomes: [] }
      ],
      clusterScale: 20,
      densityThreshold: 0.6
    },
    structureConfig: {
      types: [
        { type: StructureType.VILLAGE, rarity: 1.0, rules: [] }
      ],
      minDistance: 10,
      maxAttempts: 30
    },
    riverConfig: {
      sourceElevation: 0.7,
      minFlowLength: 10,
      flowWidth: 2
    },
    lodConfig: {
      distances: [2, 5],
      meshResolutions: [1.0, 0.5, 0.25],
      featureDensities: [1.0, 0.5, 0.1]
    },
    workerPoolConfig: {
      maxWorkers: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
      workerScriptUrl: getWorkerUrl()
    },
    incrementalConfig: {
      timeBudgetMs: 16,
      stageOrder: ['terrain', 'biomes', 'rivers', 'resources', 'structures']
    },
    enablePerformanceMetrics: true
  }
};

/**
 * All available presets
 */
export const PRESETS: PresetConfig[] = [
  MOUNTAINOUS_PRESET,
  FLAT_PLAINS_PRESET,
  ISLAND_WORLD_PRESET,
  RIVER_VALLEY_PRESET,
  PERFORMANCE_TEST_PRESET
];

/**
 * Get preset by name
 */
export function getPresetByName(name: string): PresetConfig | undefined {
  return PRESETS.find(preset => preset.name === name);
}

/**
 * Get all preset names
 */
export function getPresetNames(): string[] {
  return PRESETS.map(preset => preset.name);
}
