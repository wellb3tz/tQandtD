/**
 * Coordinate Utilities Example
 * 
 * This example demonstrates how to use the coordinate conversion utilities
 * to work with world, chunk, and local coordinates.
 */

import { worldToChunk, chunkToWorld, worldToLocal, localToIndex, indexToLocal } from '../src/index';

const chunkSize = 32;

// Example 1: Convert world coordinates to chunk coordinates
console.log('=== World to Chunk Conversion ===');
const worldX = 100;
const worldY = 200;
const [chunkX, chunkY] = worldToChunk(worldX, worldY, chunkSize);
console.log(`World position (${worldX}, ${worldY}) is in chunk (${chunkX}, ${chunkY})`);

// Example 2: Convert chunk coordinates back to world coordinates
console.log('\n=== Chunk to World Conversion ===');
const [originX, originY] = chunkToWorld(chunkX, chunkY, chunkSize);
console.log(`Chunk (${chunkX}, ${chunkY}) starts at world position (${originX}, ${originY})`);

// Example 3: Get local coordinates within a chunk
console.log('\n=== World to Local Conversion ===');
const [localX, localY] = worldToLocal(worldX, worldY, chunkSize);
console.log(`World position (${worldX}, ${worldY}) is at local position (${localX}, ${localY}) within its chunk`);

// Verify the conversion
console.log(`Verification: ${originX} + ${localX} = ${originX + localX} (should be ${worldX})`);
console.log(`Verification: ${originY} + ${localY} = ${originY + localY} (should be ${worldY})`);

// Example 4: Convert local coordinates to array index
console.log('\n=== Local to Index Conversion ===');
const index = localToIndex(localX, localY, chunkSize);
console.log(`Local position (${localX}, ${localY}) corresponds to array index ${index}`);

// Example 5: Convert array index back to local coordinates
console.log('\n=== Index to Local Conversion ===');
const [recoveredX, recoveredY] = indexToLocal(index, chunkSize);
console.log(`Array index ${index} corresponds to local position (${recoveredX}, ${recoveredY})`);

// Example 6: Working with negative coordinates
console.log('\n=== Negative Coordinates ===');
const negWorldX = -50;
const negWorldY = -75;
const [negChunkX, negChunkY] = worldToChunk(negWorldX, negWorldY, chunkSize);
const [negLocalX, negLocalY] = worldToLocal(negWorldX, negWorldY, chunkSize);
console.log(`World position (${negWorldX}, ${negWorldY})`);
console.log(`  -> Chunk: (${negChunkX}, ${negChunkY})`);
console.log(`  -> Local: (${negLocalX}, ${negLocalY})`);

// Example 7: Practical usage - accessing heightmap data
console.log('\n=== Practical Usage ===');
import { ChunkManager } from '../src/index';

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
  riverConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
  },
});

// Get height at a specific world position
function getHeightAtWorldPosition(worldX: number, worldY: number): number {
  const [chunkX, chunkY] = worldToChunk(worldX, worldY, chunkSize);
  const chunk = manager.getChunk(chunkX, chunkY);
  const [localX, localY] = worldToLocal(worldX, worldY, chunkSize);
  const index = localToIndex(localX, localY, chunkSize);
  return chunk.heightmap[index];
}

const height = getHeightAtWorldPosition(100, 200);
console.log(`Height at world position (100, 200): ${height.toFixed(3)}`);
