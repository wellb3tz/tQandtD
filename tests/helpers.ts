/**
 * Shared test helpers
 *
 * makeMinimalConfig - returns a valid WorldConfig with sensible defaults.
 * Keeps individual test files free of boilerplate.
 */

import { WorldConfig } from '../src/world/chunk-manager';
import { ResourceType, BiomeType } from '../src/world/chunk';

export function makeMinimalConfig(seed: number): WorldConfig {
  return {
    seed,
    chunkSize: 16, // smaller than production (32) for faster tests
    terrainConfig: {
      baseScale: 0.02,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
      enableContinentalness: false, // off by default - faster, simpler
    },
    biomeConfig: {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 2,
    },
    resourceConfig: {
      types: [
        {
          type: ResourceType.STONE,
          rarity: 0.3,
          biomes: [BiomeType.PLAINS, BiomeType.MOUNTAIN, BiomeType.FOREST],
          minAmount: 1,
          maxAmount: 5,
        },
      ],
      clusterScale: 10,
      densityThreshold: 0.6,
    },
    structureConfig: {
      types: [
        {
          type: 0, // VILLAGE
          rarity: 1.0,
          rules: [],
        },
      ],
      minDistance: 8,
      maxAttempts: 10,
    },
    maxCacheSize: 50,
  };
}
