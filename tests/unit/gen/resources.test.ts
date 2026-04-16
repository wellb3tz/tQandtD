// Unit tests for resource generation

import { describe, test, expect } from 'vitest';
import { ResourceGenerator, ResourceConfig } from '../../../src/gen/resources.js';
import { BiomeType, ChunkData, ResourceType } from '../../../src/world/chunk.js';

describe('ResourceGenerator', () => {
  test('generates resources in valid positions within chunk bounds', () => {
    const config: ResourceConfig = {
      types: [
        {
          type: ResourceType.IRON,
          rarity: 0.1,
          biomes: [BiomeType.MOUNTAIN],
          minAmount: 5,
          maxAmount: 15,
        },
      ],
      clusterScale: 20,
      densityThreshold: 0.3,
    };

    const generator = new ResourceGenerator(config);
    const chunkSize = 32;

    const chunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.MOUNTAIN),
      biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
      resources: [],
      structures: [],
      rivers: new Set(),
    };

    const resources = generator.generateResources(chunkData, 12345);

    // All resources should be within chunk bounds
    for (const resource of resources) {
      expect(resource.x).toBeGreaterThanOrEqual(0);
      expect(resource.x).toBeLessThan(chunkSize);
      expect(resource.y).toBeGreaterThanOrEqual(0);
      expect(resource.y).toBeLessThan(chunkSize);
    }
  });

  test('resource amounts are within configured ranges', () => {
    const minAmount = 10;
    const maxAmount = 20;

    const config: ResourceConfig = {
      types: [
        {
          type: ResourceType.GOLD,
          rarity: 0.1,
          biomes: [BiomeType.MOUNTAIN, BiomeType.DESERT],
          minAmount,
          maxAmount,
        },
      ],
      clusterScale: 15,
      densityThreshold: 0.2,
    };

    const generator = new ResourceGenerator(config);
    const chunkSize = 32;

    const chunkData: ChunkData = {
      x: 5,
      y: 5,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.MOUNTAIN),
      biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
      resources: [],
      structures: [],
      rivers: new Set(),
    };

    const resources = generator.generateResources(chunkData, 54321);

    // All resource amounts should be within range
    for (const resource of resources) {
      expect(resource.amount).toBeGreaterThanOrEqual(minAmount);
      expect(resource.amount).toBeLessThanOrEqual(maxAmount);
    }
  });

  test('supports multiple resource types', () => {
    const config: ResourceConfig = {
      types: [
        {
          type: ResourceType.IRON,
          rarity: 0.2,
          biomes: [BiomeType.MOUNTAIN],
          minAmount: 5,
          maxAmount: 10,
        },
        {
          type: ResourceType.COAL,
          rarity: 0.3,
          biomes: [BiomeType.MOUNTAIN],
          minAmount: 3,
          maxAmount: 8,
        },
        {
          type: ResourceType.STONE,
          rarity: 0.1,
          biomes: [BiomeType.MOUNTAIN],
          minAmount: 10,
          maxAmount: 30,
        },
      ],
      clusterScale: 20,
      densityThreshold: 0.3,
    };

    const generator = new ResourceGenerator(config);
    const chunkSize = 32;

    const chunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.MOUNTAIN),
      biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
      resources: [],
      structures: [],
      rivers: new Set(),
    };

    const resources = generator.generateResources(chunkData, 99999);

    // Should have resources of different types
    const types = new Set(resources.map((r) => r.type));
    expect(types.size).toBeGreaterThan(0);

    // All types should be from the configured list
    for (const resource of resources) {
      expect([ResourceType.IRON, ResourceType.COAL, ResourceType.STONE]).toContain(
        resource.type
      );
    }
  });

  test('respects biome constraints - no resources in wrong biomes', () => {
    const config: ResourceConfig = {
      types: [
        {
          type: ResourceType.WOOD,
          rarity: 0.1,
          biomes: [BiomeType.FOREST], // Only in forest
          minAmount: 5,
          maxAmount: 15,
        },
      ],
      clusterScale: 20,
      densityThreshold: 0.2,
    };

    const generator = new ResourceGenerator(config);
    const chunkSize = 32;

    const chunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.DESERT), // All desert
      biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
      resources: [],
      structures: [],
      rivers: new Set(),
    };

    const resources = generator.generateResources(chunkData, 11111);

    // Should have no wood resources in desert
    expect(resources.length).toBe(0);
  });

  test('generates resources in allowed biomes', () => {
    const config: ResourceConfig = {
      types: [
        {
          type: ResourceType.WOOD,
          rarity: 0.1,
          biomes: [BiomeType.FOREST],
          minAmount: 5,
          maxAmount: 15,
        },
      ],
      clusterScale: 20,
      densityThreshold: 0.2,
    };

    const generator = new ResourceGenerator(config);
    const chunkSize = 32;

    const chunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.FOREST),
      biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
      resources: [],
      structures: [],
      rivers: new Set(),
    };

    const resources = generator.generateResources(chunkData, 22222);

    // Should have some wood resources in forest
    expect(resources.length).toBeGreaterThan(0);
    expect(resources.every((r) => r.type === ResourceType.WOOD)).toBe(true);
  });
});

