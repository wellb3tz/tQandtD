/**
 * Analysis of test expectations for chunk boundary biome continuity
 * 
 * The test checks adjacent tiles at chunk boundaries:
 * - Chunk 1, last tile (x=31 in chunk 0) -> world position (31, y)
 * - Chunk 2, first tile (x=0 in chunk 1) -> world position (32, y)
 * 
 * These are ADJACENT tiles, not the same tile.
 * 
 * Question: What should "seamless" mean for adjacent tiles?
 * 
 * Option A: Adjacent tiles should have nearly identical blend weights
 *   - This would mean biomes transition very slowly
 *   - Tolerance: ~5-10% difference
 *   - Problem: Doesn't account for terrain variation
 * 
 * Option B: Adjacent tiles should have smoothly transitioning weights
 *   - This means weights can differ more if terrain changes
 *   - Tolerance: ~15-25% difference
 *   - More realistic for varied terrain
 * 
 * Option C: The test should check the SHARED VERTEX, not adjacent tiles
 *   - Shared vertex is at x=32 (right edge of chunk 0, left edge of chunk 1)
 *   - This vertex should have IDENTICAL biome data in both chunks
 *   - This is what "seamless boundaries" actually means
 */

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

const chunkX = 0;
const chunkY = -2;

const chunk1 = manager.generateChunk(chunkX, chunkY);
const chunk2 = manager.generateChunk(chunkX + 1, chunkY);

const size = config.chunkSize;
const vertexCount = size + 1;

console.log('=== Analysis of Chunk Boundary Biome Data ===\n');

console.log('Current test checks ADJACENT TILES:');
console.log('  Chunk 1, tile at local x=31 (world x=31)');
console.log('  Chunk 2, tile at local x=0 (world x=32)');
console.log('  These are different tiles, so biomes CAN differ\n');

// Check what the test is currently checking
const boundaryY = 0;
const index1 = boundaryY * size + (size - 1);  // Last tile in chunk1
const index2 = boundaryY * size + 0;  // First tile in chunk2

const biome1 = chunk1.biomeMap[index1];
const biome2 = chunk2.biomeMap[index2];

console.log(`Tile biomes: ${biome1} vs ${biome2}`);

const numBiomes = 8;
const weights1 = new Map<number, number>();
const weights2 = new Map<number, number>();

for (let b = 0; b < numBiomes; b++) {
  const w1 = chunk1.biomeWeights[index1 * numBiomes + b];
  const w2 = chunk2.biomeWeights[index2 * numBiomes + b];
  if (w1 > 0) weights1.set(b, w1);
  if (w2 > 0) weights2.set(b, w2);
}

console.log(`Tile weights:`);
console.log(`  Chunk 1:`, Array.from(weights1.entries()).map(([b, w]) => `${b}:${w.toFixed(3)}`).join(', '));
console.log(`  Chunk 2:`, Array.from(weights2.entries()).map(([b, w]) => `${b}:${w.toFixed(3)}`).join(', '));

// Now check what SHOULD be checked: the shared vertex
console.log('\n=== What SHOULD be checked: SHARED VERTEX ===\n');
console.log('The shared vertex is at:');
console.log('  Chunk 1, vertex at local x=32 (world x=32)');
console.log('  Chunk 2, vertex at local x=0 (world x=32)');
console.log('  This is the SAME world position, so data MUST match\n');

// Note: Vertices are in the heightmap, but biome data is per-tile, not per-vertex
// So we can't directly compare biome data at vertices

console.log('PROBLEM: Biome data is stored per-TILE, not per-VERTEX');
console.log('  - Heightmap has (size+1) x (size+1) vertices');
console.log('  - Biome map has size x size tiles');
console.log('  - There is no "shared biome vertex" to compare\n');

console.log('CONCLUSION:');
console.log('  The test is checking adjacent tiles, which is correct');
console.log('  But the tolerance might need adjustment');
console.log('  OR the test expectations need to be reconsidered\n');

console.log('OPTIONS:');
console.log('  1. Increase tolerance to 20-25% to account for terrain variation');
console.log('  2. Change test to only check cases where heights are similar');
console.log('  3. Accept that rapid transitions are okay when terrain changes significantly');
