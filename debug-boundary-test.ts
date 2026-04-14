import { ChunkManager, WorldConfig } from './src/world/chunk-manager';

const config: WorldConfig = {
  seed: 1006,
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

// Test case from failing test: [1006,0,-2,0]
const chunkX = 0;
const chunkY = -2;
const boundaryY = 0;

console.log(`Testing boundary between chunks (${chunkX}, ${chunkY}) and (${chunkX + 1}, ${chunkY})`);
console.log(`Boundary Y position: ${boundaryY}`);

const chunk1 = manager.generateChunk(chunkX, chunkY);
const chunk2 = manager.generateChunk(chunkX + 1, chunkY);

const size = config.chunkSize;

// Right edge of chunk1 (local x = 31)
const index1 = boundaryY * size + (size - 1);
const biome1 = chunk1.biomeMap[index1];
const height1 = chunk1.heightmap[boundaryY * (size + 1) + (size - 1)];

// Left edge of chunk2 (local x = 0)
const index2 = boundaryY * size + 0;
const biome2 = chunk2.biomeMap[index2];
const height2 = chunk2.heightmap[boundaryY * (size + 1) + 0];

console.log(`\nChunk 1 (right edge):`);
console.log(`  Biome: ${biome1}`);
console.log(`  Height: ${height1.toFixed(4)}`);

console.log(`\nChunk 2 (left edge):`);
console.log(`  Biome: ${biome2}`);
console.log(`  Height: ${height2.toFixed(4)}`);

// Get blend weights
const numBiomes = 8;
const weights1 = new Map<number, number>();
const weights2 = new Map<number, number>();

for (let b = 0; b < numBiomes; b++) {
  const w1 = chunk1.biomeWeights[index1 * numBiomes + b];
  const w2 = chunk2.biomeWeights[index2 * numBiomes + b];
  if (w1 > 0) weights1.set(b, w1);
  if (w2 > 0) weights2.set(b, w2);
}

console.log(`\nWeights 1:`, Array.from(weights1.entries()).map(([b, w]) => `${b}:${w.toFixed(3)}`).join(', '));
console.log(`Weights 2:`, Array.from(weights2.entries()).map(([b, w]) => `${b}:${w.toFixed(3)}`).join(', '));

// Check continuity
const biomesMatch = biome1 === biome2;
let weightsContinuous = true;
const tolerance = 0.15;

for (let b = 0; b < numBiomes; b++) {
  const w1 = weights1.get(b) || 0;
  const w2 = weights2.get(b) || 0;
  const diff = Math.abs(w1 - w2);
  
  if (diff > tolerance) {
    console.log(`\nWeight difference for biome ${b}: ${diff.toFixed(3)} (exceeds tolerance ${tolerance})`);
    weightsContinuous = false;
  }
}

console.log(`\nBiomes match: ${biomesMatch}`);
console.log(`Weights continuous: ${weightsContinuous}`);
console.log(`Is seamless: ${biomesMatch || weightsContinuous}`);

// Check if the boundary heights match
const worldX1 = chunkX * size + (size - 1);
const worldY1 = chunkY * size + boundaryY;
const worldX2 = (chunkX + 1) * size + 0;
const worldY2 = chunkY * size + boundaryY;

console.log(`\nWorld coordinates:`);
console.log(`  Chunk 1 boundary: (${worldX1}, ${worldY1})`);
console.log(`  Chunk 2 boundary: (${worldX2}, ${worldY2})`);
console.log(`  These should be adjacent positions`);
