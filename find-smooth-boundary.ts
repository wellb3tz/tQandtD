import { ChunkManager, WorldConfig } from './src/world/chunk-manager';

const config: WorldConfig = {
  seed: 12345,
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

// Test multiple chunk boundaries to find cases with similar heights
console.log('Searching for boundary positions with similar heights...\n');

let smoothCount = 0;
let roughCount = 0;

for (let chunkY = 0; chunkY < 3; chunkY++) {
  for (let chunkX = 0; chunkX < 3; chunkX++) {
    const chunk1 = manager.generateChunk(chunkX, chunkY);
    const chunk2 = manager.generateChunk(chunkX + 1, chunkY);
    
    const size = config.chunkSize;
    const vertexCount = size + 1;
    
    for (let y = 0; y < size; y++) {
      const index1 = y * size + (size - 1);
      const index2 = y * size + 0;
      
      const height1 = chunk1.heightmap[y * vertexCount + (size - 1)];
      const height2 = chunk2.heightmap[y * vertexCount + 0];
      const heightDiff = Math.abs(height1 - height2);
      
      const biome1 = chunk1.biomeMap[index1];
      const biome2 = chunk2.biomeMap[index2];
      
      const numBiomes = 8;
      const weights1 = new Map<number, number>();
      const weights2 = new Map<number, number>();
      
      for (let b = 0; b < numBiomes; b++) {
        const w1 = chunk1.biomeWeights[index1 * numBiomes + b];
        const w2 = chunk2.biomeWeights[index2 * numBiomes + b];
        if (w1 > 0) weights1.set(b, w1);
        if (w2 > 0) weights2.set(b, w2);
      }
      
      let maxWeightDiff = 0;
      for (let b = 0; b < numBiomes; b++) {
        const w1 = weights1.get(b) || 0;
        const w2 = weights2.get(b) || 0;
        const diff = Math.abs(w1 - w2);
        maxWeightDiff = Math.max(maxWeightDiff, diff);
      }
      
      if (heightDiff < 0.05) {
        // Similar heights
        if (maxWeightDiff < 0.15) {
          smoothCount++;
        } else {
          roughCount++;
          if (roughCount <= 3) {
            console.log(`Rough transition at chunks (${chunkX}, ${chunkY}) y=${y}:`);
            console.log(`  Heights: ${height1.toFixed(4)} vs ${height2.toFixed(4)} (diff: ${heightDiff.toFixed(4)})`);
            console.log(`  Biomes: ${biome1} vs ${biome2}`);
            console.log(`  Max weight diff: ${maxWeightDiff.toFixed(3)}`);
            console.log(`  Weights1:`, Array.from(weights1.entries()).map(([b, w]) => `${b}:${w.toFixed(3)}`).join(', '));
            console.log(`  Weights2:`, Array.from(weights2.entries()).map(([b, w]) => `${b}:${w.toFixed(3)}`).join(', '));
            console.log();
          }
        }
      }
    }
  }
}

console.log(`\nResults for boundaries with similar heights (diff < 0.05):`);
console.log(`  Smooth transitions (weight diff < 0.15): ${smoothCount}`);
console.log(`  Rough transitions (weight diff >= 0.15): ${roughCount}`);
console.log(`  Ratio: ${(smoothCount / (smoothCount + roughCount) * 100).toFixed(1)}% smooth`);
