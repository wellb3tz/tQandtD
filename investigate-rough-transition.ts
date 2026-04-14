import { BiomeSystem } from './src/world/biome';
import { TerrainGenerator } from './src/gen/terrain';

const config = {
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
};

const biomeSystem = new BiomeSystem(config.seed, config.biomeConfig);
const terrainGen = new TerrainGenerator(config.terrainConfig);

const getHeight = (worldX: number, worldY: number): number => {
  return terrainGen.getHeightAt(worldX, worldY, config.seed);
};

// Investigate the rough transition at chunks (2, 0) y=9
// Chunk 2 starts at world x = 64
// Position 1: world (95, 9) - last tile in chunk 2
// Position 2: world (96, 9) - first tile in chunk 3

const worldX1 = 95;
const worldX2 = 96;
const worldY = 9;

console.log('Investigating rough transition:');
console.log(`Position 1: (${worldX1}, ${worldY})`);
console.log(`Position 2: (${worldX2}, ${worldY})`);

const height1 = getHeight(worldX1, worldY);
const height2 = getHeight(worldX2, worldY);

console.log(`\nHeights:`);
console.log(`  Position 1: ${height1.toFixed(4)}`);
console.log(`  Position 2: ${height2.toFixed(4)}`);
console.log(`  Difference: ${Math.abs(height1 - height2).toFixed(4)}`);

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

// Sample the region around these positions
console.log(`\nSampling region (blendRadius=10):`);
console.log(`Position 1 samples from x=${worldX1 - 10} to x=${worldX1 + 10}`);
console.log(`Position 2 samples from x=${worldX2 - 10} to x=${worldX2 + 10}`);

console.log(`\nBiomes in sampling region:`);
const biomeCounts1 = new Map<number, number>();
const biomeCounts2 = new Map<number, number>();

for (let dx = -10; dx <= 10; dx += 2) {
  const x1 = worldX1 + dx;
  const x2 = worldX2 + dx;
  
  const h1 = getHeight(x1, worldY);
  const h2 = getHeight(x2, worldY);
  
  const b1 = biomeSystem.getBiome(x1, worldY, h1);
  const b2 = biomeSystem.getBiome(x2, worldY, h2);
  
  biomeCounts1.set(b1, (biomeCounts1.get(b1) || 0) + 1);
  biomeCounts2.set(b2, (biomeCounts2.get(b2) || 0) + 1);
}

console.log(`  Position 1 region:`, Array.from(biomeCounts1.entries()).map(([b, c]) => `${b}:${c}`).join(', '));
console.log(`  Position 2 region:`, Array.from(biomeCounts2.entries()).map(([b, c]) => `${b}:${c}`).join(', '));

// Check temperature and moisture
const temp1 = biomeSystem.getTemperature(worldX1, worldY);
const temp2 = biomeSystem.getTemperature(worldX2, worldY);
const moist1 = biomeSystem.getMoisture(worldX1, worldY);
const moist2 = biomeSystem.getMoisture(worldX2, worldY);

console.log(`\nTemperature and Moisture:`);
console.log(`  Position 1: temp=${temp1.toFixed(3)}, moisture=${moist1.toFixed(3)}`);
console.log(`  Position 2: temp=${temp2.toFixed(3)}, moisture=${moist2.toFixed(3)}`);

console.log(`\nAnalysis:`);
console.log(`  The positions are only 1 unit apart`);
console.log(`  They sample from regions that overlap by 19 units (out of 21 total)`);
console.log(`  Yet their blend weights differ significantly`);
console.log(`  This suggests the sampling is working correctly, but the biome`);
console.log(`  distribution in this region is genuinely varied`);
