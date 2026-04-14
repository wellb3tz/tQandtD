import { ChunkManager, WorldConfig } from './src/world/chunk-manager';
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

const manager = new ChunkManager(config);
const terrainGen = new TerrainGenerator(config.terrainConfig);

// Test case from failing test: [1006,0,-2,0]
const chunkX = 0;
const chunkY = -2;
const boundaryY = 0;

console.log(`Testing heightmap boundary between chunks (${chunkX}, ${chunkY}) and (${chunkX + 1}, ${chunkY})`);

const chunk1 = manager.generateChunk(chunkX, chunkY);
const chunk2 = manager.generateChunk(chunkX + 1, chunkY);

const size = config.chunkSize;
const vertexCount = size + 1;

// Check the rightmost column of chunk1 and leftmost column of chunk2
console.log(`\nChecking boundary vertices (should match):`);
console.log(`Chunk 1 right edge (local x=${size}) vs Chunk 2 left edge (local x=0):`);

for (let y = 0; y < 5; y++) {
  const worldX1 = chunkX * size + size;  // Right edge of chunk1
  const worldX2 = (chunkX + 1) * size + 0;  // Left edge of chunk2
  const worldY = chunkY * size + y;
  
  const height1 = chunk1.heightmap[y * vertexCount + size];
  const height2 = chunk2.heightmap[y * vertexCount + 0];
  
  const match = Math.abs(height1 - height2) < 0.0001;
  
  console.log(`  y=${y}: world(${worldX1}, ${worldY}) -> chunk1=${height1.toFixed(4)}, chunk2=${height2.toFixed(4)} ${match ? '✓' : '✗'}`);
}

// Now check what getHeightAt returns for these positions
console.log(`\nChecking getHeightAt for boundary positions:`);
for (let y = 0; y < 5; y++) {
  const worldX1 = chunkX * size + size;
  const worldX2 = (chunkX + 1) * size + 0;
  const worldY = chunkY * size + y;
  
  const heightDirect1 = terrainGen.getHeightAt(worldX1, worldY, config.seed);
  const heightDirect2 = terrainGen.getHeightAt(worldX2, worldY, config.seed);
  
  const match = Math.abs(heightDirect1 - heightDirect2) < 0.0001;
  
  console.log(`  y=${y}: getHeightAt(${worldX1}, ${worldY})=${heightDirect1.toFixed(4)}, getHeightAt(${worldX2}, ${worldY})=${heightDirect2.toFixed(4)} ${match ? '✓' : '✗'}`);
}

// Check the specific boundary position from the test
console.log(`\nSpecific test case (boundaryY=${boundaryY}):`);
const worldX1 = chunkX * size + (size - 1);  // Last tile in chunk1
const worldX2 = (chunkX + 1) * size + 0;  // First tile in chunk2
const worldY = chunkY * size + boundaryY;

console.log(`Chunk 1 last tile: world(${worldX1}, ${worldY})`);
console.log(`Chunk 2 first tile: world(${worldX2}, ${worldY})`);

// These are ADJACENT tiles, not the same tile
// So their heights can be different
const height1Tile = chunk1.heightmap[boundaryY * vertexCount + (size - 1)];
const height2Tile = chunk2.heightmap[boundaryY * vertexCount + 0];

console.log(`  Chunk 1 tile height: ${height1Tile.toFixed(4)}`);
console.log(`  Chunk 2 tile height: ${height2Tile.toFixed(4)}`);
console.log(`  These are ADJACENT tiles, so heights can differ`);

// The SHARED VERTEX is at worldX = chunkX * size + size = (chunkX + 1) * size
const sharedWorldX = chunkX * size + size;
const sharedWorldY = worldY;

const sharedHeight1 = chunk1.heightmap[boundaryY * vertexCount + size];
const sharedHeight2 = chunk2.heightmap[boundaryY * vertexCount + 0];

console.log(`\nShared vertex at world(${sharedWorldX}, ${sharedWorldY}):`);
console.log(`  From chunk 1: ${sharedHeight1.toFixed(4)}`);
console.log(`  From chunk 2: ${sharedHeight2.toFixed(4)}`);
console.log(`  Match: ${Math.abs(sharedHeight1 - sharedHeight2) < 0.0001 ? '✓' : '✗'}`);
