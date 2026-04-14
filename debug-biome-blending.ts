import { ChunkManager, WorldConfig } from './src/world/chunk-manager';
import { BiomeSystem } from './src/world/biome';
import { TerrainGenerator } from './src/gen/terrain';

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

const biomeSystem = new BiomeSystem(config.seed, config.biomeConfig);
const terrainGen = new TerrainGenerator(config.terrainConfig);

// Create a height callback that uses getHeightAt
const getHeight = (worldX: number, worldY: number): number => {
  return terrainGen.getHeightAt(worldX, worldY, config.seed);
};

// Test adjacent positions at chunk boundary
const worldX1 = 31;  // Last tile in chunk 0
const worldX2 = 32;  // First tile in chunk 1
const worldY = -64;

console.log(`Testing biome blending at adjacent positions:`);
console.log(`Position 1: (${worldX1}, ${worldY})`);
console.log(`Position 2: (${worldX2}, ${worldY})`);

const height1 = getHeight(worldX1, worldY);
const height2 = getHeight(worldX2, worldY);

console.log(`\nHeights:`);
console.log(`  Position 1: ${height1.toFixed(4)}`);
console.log(`  Position 2: ${height2.toFixed(4)}`);

const biome1 = biomeSystem.getBiome(worldX1, worldY, height1);
const biome2 = biomeSystem.getBiome(worldX2, worldY, height2);

console.log(`\nBiomes:`);
console.log(`  Position 1: ${biome1}`);
console.log(`  Position 2: ${biome2}`);

const weights1 = biomeSystem.getBiomeWeights(worldX1, worldY, getHeight);
const weights2 = biomeSystem.getBiomeWeights(worldX2, worldY, getHeight);

console.log(`\nBlend weights:`);
console.log(`  Position 1:`, Array.from(weights1.entries()).map(([b, w]) => `${b}:${w.toFixed(3)}`).join(', '));
console.log(`  Position 2:`, Array.from(weights2.entries()).map(([b, w]) => `${b}:${w.toFixed(3)}`).join(', '));

// Analyze the sampling regions
console.log(`\nSampling analysis (blendRadius=${config.biomeConfig.blendRadius}):`);
console.log(`  Position 1 samples from x=${worldX1 - 10} to x=${worldX1 + 10}`);
console.log(`  Position 2 samples from x=${worldX2 - 10} to x=${worldX2 + 10}`);
console.log(`  Overlap: x=${worldX2 - 10} to x=${worldX1 + 10} (19 units)`);

// Sample some positions in the overlap region
console.log(`\nSampling biomes in overlap region:`);
for (let x = worldX2 - 10; x <= worldX1 + 10; x += 5) {
  const h = getHeight(x, worldY);
  const b = biomeSystem.getBiome(x, worldY, h);
  console.log(`  x=${x}: height=${h.toFixed(4)}, biome=${b}`);
}

// Check weight differences
console.log(`\nWeight differences:`);
const numBiomes = 8;
for (let b = 0; b < numBiomes; b++) {
  const w1 = weights1.get(b) || 0;
  const w2 = weights2.get(b) || 0;
  const diff = Math.abs(w1 - w2);
  if (diff > 0.001) {
    console.log(`  Biome ${b}: w1=${w1.toFixed(3)}, w2=${w2.toFixed(3)}, diff=${diff.toFixed(3)}`);
  }
}
