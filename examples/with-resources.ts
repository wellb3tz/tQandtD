/**
 * Resource Generation Example
 * 
 * This example shows how to configure resource generation with different
 * resource types, biome restrictions, and rarity settings.
 */

import { ChunkManager, BiomeType, ResourceType } from '../src/index';

const manager = new ChunkManager({
  seed: 42,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 30,
    heightMultiplier: 1.0,
  },
  biomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5,
  },
  resourceConfig: {
    types: [
      {
        type: ResourceType.STONE,
        rarity: 0.2, // Lower rarity = more common
        biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
        minAmount: 10,
        maxAmount: 50,
      },
      {
        type: ResourceType.WOOD,
        rarity: 0.1,
        biomes: [BiomeType.FOREST, BiomeType.TAIGA],
        minAmount: 5,
        maxAmount: 20,
      },
      {
        type: ResourceType.GOLD,
        rarity: 0.6, // Higher rarity = more rare
        biomes: [BiomeType.MOUNTAIN],
        minAmount: 1,
        maxAmount: 10,
      },
    ],
    clusterScale: 20, // Larger scale = bigger clusters
    densityThreshold: 0.5, // Lower threshold = more resources
  },
  structureConfig: {
    types: [],
    minDistance: 10,
    maxAttempts: 30,
  },
  riverNetworkConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
    enableTributaries: true,
    maxTributaryOrder: 2,
    tributaryProbability: 0.3,
    enableLakes: true,
    lakeDepressionThreshold: 0.05,
    maxLakeSize: 100,
    enableDeltas: true,
    deltaBranchCount: 3,
    deltaSpreadAngle: Math.PI / 3,
    minFlow: 1.0,
    maxFlow: 100.0,
    widthScale: 0.5,
  },
});

// Generate a chunk and examine its resources
const chunk = manager.getChunk(0, 0);

console.log(`Generated ${chunk.resources.length} resources`);

// Group resources by type
const resourcesByType = chunk.resources.reduce((acc, resource) => {
  const typeName = ResourceType[resource.type];
  if (!acc[typeName]) {
    acc[typeName] = [];
  }
  acc[typeName].push(resource);
  return acc;
}, {} as Record<string, typeof chunk.resources>);

// Display resource statistics
for (const [type, resources] of Object.entries(resourcesByType)) {
  const totalAmount = resources.reduce((sum, r) => sum + r.amount, 0);
  console.log(`${type}: ${resources.length} deposits, ${totalAmount} total amount`);
}

// Verify resources are in appropriate biomes
for (const resource of chunk.resources) {
  const index = resource.y * chunk.size + resource.x;
  const biome = chunk.biomeMap[index];
  console.log(
    `Resource ${ResourceType[resource.type]} at (${resource.x}, ${resource.y}) in ${BiomeType[biome]}`
  );
}
