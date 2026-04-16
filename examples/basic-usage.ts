/**
 * Basic Usage Example
 * 
 * This example demonstrates the most basic usage of the Procedural World Engine.
 * It creates a ChunkManager with minimal configuration and generates a single chunk.
 */

import { ChunkManager, BiomeType, ResourceType, StructureType } from '../src/index';

// Create a ChunkManager with basic configuration
const manager = new ChunkManager({
  seed: 12345,
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
    types: [],
    clusterScale: 20,
    densityThreshold: 0.6,
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

// Generate a chunk at coordinates (0, 0)
const chunk = manager.getChunk(0, 0);

console.log('Chunk generated at:', chunk.x, chunk.y);
console.log('Chunk size:', chunk.size);
console.log('Heightmap length:', chunk.heightmap.length);
console.log('First height value:', chunk.heightmap[0]);

// Access biome information
const firstBiome = chunk.biomeMap[0];
console.log('First tile biome:', BiomeType[firstBiome]);

// The chunk is cached, so subsequent calls return the same object
const cachedChunk = manager.getChunk(0, 0);
console.log('Same chunk?', chunk === cachedChunk); // true
