import { ChunkManager, WorldConfig } from './src/world/chunk-manager';
import { TerrainGenerator } from './src/gen/terrain';

const config: WorldConfig = {
  seed: 1000,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 10,
    heightMultiplier: 1.0,
  },
  biomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 10,
  },
  resourceConfig: {
    types: [],
    clusterScale: 20,
    densityThreshold: 0.5,
  },
  structureConfig: {
    types: [],
    minDistance: 10,
    maxAttempts: 30,
  },
  riverConfig: {
    sourceElevation: 0.7,
    minFlowLength: 5,
    flowWidth: 2,
  },
};

const manager = new ChunkManager(config);
const terrainGen = new TerrainGenerator(config.terrainConfig);

// Test the specific failing case
const chunk1 = manager.generateChunk(0, 1);
const chunk2 = manager.generateChunk(1, 1);

const boundaryY = 18;
const size = 32;

// World positions
const worldX1 = 0 * size + 31; // = 31
const worldY1 = 1 * size + 18; // = 50
const worldX2 = 1 * size + 0;  // = 32
const worldY2 = 1 * size + 18; // = 50

console.log(`World positions:`);
console.log(`  Chunk1 boundary: (${worldX1}, ${worldY1})`);
console.log(`  Chunk2 boundary: (${worldX2}, ${worldY2})`);

// Get heights from heightmaps
const vertexCount = size + 1;
const height1FromMap = chunk1.heightmap[boundaryY * vertexCount + 31];
const height2FromMap = chunk2.heightmap[boundaryY * vertexCount + 0];

console.log(`\nHeights from heightmaps:`);
console.log(`  Chunk1: ${height1FromMap.toFixed(4)}`);
console.log(`  Chunk2: ${height2FromMap.toFixed(4)}`);

// Get heights using getHeightAt
const height1Direct = terrainGen.getHeightAt(worldX1, worldY1, config.seed);
const height2Direct = terrainGen.getHeightAt(worldX2, worldY2, config.seed);

console.log(`\nHeights from getHeightAt:`);
console.log(`  Position (${worldX1}, ${worldY1}): ${height1Direct.toFixed(4)}`);
console.log(`  Position (${worldX2}, ${worldY2}): ${height2Direct.toFixed(4)}`);

// Sample heights in the blend radius around position 1
console.log(`\nSampling heights around position 1 (${worldX1}, ${worldY1}) with blend radius 10:`);
const blendRadius = 10;
for (let dx = -blendRadius; dx <= blendRadius; dx += 5) {
  const sampleX = worldX1 + dx;
  const sampleY = worldY1;
  const h = terrainGen.getHeightAt(sampleX, sampleY, config.seed);
  console.log(`  (${sampleX}, ${sampleY}): ${h.toFixed(4)}`);
}
