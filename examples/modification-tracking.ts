/**
 * Example: Modification Tracking
 * 
 * This example demonstrates how to track modifications to generated chunks
 * for world persistence. Modifications include terrain edits and structure changes.
 */

import { ChunkManager, WorldConfig, StructureType } from '../src';

// Create a world configuration
const config: WorldConfig = {
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
};

// Create chunk manager
const chunkManager = new ChunkManager(config);

// Generate a chunk
const chunk = chunkManager.getChunk(0, 0);
console.log(`Generated chunk at (0, 0) with ${chunk.structures.length} structures`);

// Example 1: Record a single terrain edit
// Edit the height at tile position (5, 10)
const tileX = 5;
const tileY = 10;
const tileIndex = tileY * config.chunkSize + tileX;
const newHeight = 0.75;

console.log('\nExample 1: Single terrain edit');
console.log(`Editing terrain at tile (${tileX}, ${tileY}) to height ${newHeight}`);
chunkManager.recordTerrainEdit(0, 0, tileIndex, newHeight);

// Example 2: Record multiple terrain edits at once
// Edit a 3x3 area of terrain
const heightChanges = new Map<number, number>();
for (let y = 15; y < 18; y++) {
  for (let x = 15; x < 18; x++) {
    const index = y * config.chunkSize + x;
    const height = 0.5 + Math.random() * 0.3; // Random height between 0.5 and 0.8
    heightChanges.set(index, height);
  }
}

console.log('\nExample 2: Multiple terrain edits');
console.log(`Editing ${heightChanges.size} tiles in a 3x3 area`);
chunkManager.recordTerrainEdits(0, 0, heightChanges);

// Example 3: Record structure addition
// Add a new village structure
const newStructure = {
  x: 20,
  y: 20,
  type: StructureType.VILLAGE,
};

console.log('\nExample 3: Structure addition');
console.log(`Adding ${StructureType[newStructure.type]} at (${newStructure.x}, ${newStructure.y})`);
chunkManager.recordStructureAddition(0, 0, newStructure);

// Example 4: Record structure removal
// Remove the first structure in the chunk
if (chunk.structures.length > 0) {
  const structureIndex = 0;
  const removedStructure = chunk.structures[structureIndex];
  
  console.log('\nExample 4: Structure removal');
  console.log(`Removing ${StructureType[removedStructure.type]} at index ${structureIndex}`);
  chunkManager.recordStructureRemoval(0, 0, structureIndex);
}

// Example 5: Record multiple structure changes at once
// Add two structures and remove one
const addedStructures = [
  { x: 25, y: 25, type: StructureType.TOWER },
  { x: 28, y: 28, type: StructureType.RUINS },
];
const removedStructures = chunk.structures.length > 1 ? [1] : [];

console.log('\nExample 5: Multiple structure changes');
console.log(`Adding ${addedStructures.length} structures and removing ${removedStructures.length} structures`);
chunkManager.recordStructureChanges(0, 0, addedStructures, removedStructures);

// Example 6: Complex modification scenario
// Simulate a player terraforming an area and building structures
console.log('\nExample 6: Complex modification scenario');
console.log('Simulating player terraforming and building...');

// Flatten a 5x5 area for building
const flattenArea = new Map<number, number>();
const flatHeight = 0.6;
for (let y = 10; y < 15; y++) {
  for (let x = 10; x < 15; x++) {
    const index = y * config.chunkSize + x;
    flattenArea.set(index, flatHeight);
  }
}
chunkManager.recordTerrainEdits(0, 0, flattenArea);
console.log(`Flattened ${flattenArea.size} tiles to height ${flatHeight}`);

// Build structures on the flattened area
const buildStructures = [
  { x: 11, y: 11, type: StructureType.VILLAGE },
  { x: 13, y: 13, type: StructureType.TOWER },
];
chunkManager.recordStructureChanges(0, 0, buildStructures, []);
console.log(`Built ${buildStructures.length} structures on the flattened area`);

console.log('\nAll modifications have been recorded!');
console.log('These modifications will be included when serializing the world.');

// Example 7: Serialize world with modifications
console.log('\nExample 7: Serialize world with modifications');

// Import WorldSerializer
import { WorldSerializer, SerializationFormat } from '../src/world/serialization';

const serializer = new WorldSerializer();

// Serialize to JSON format
const serialized = serializer.serialize(chunkManager, {
  format: SerializationFormat.JSON,
  compress: false,
  modifiedOnly: false,
});

console.log(`Serialized world with ${serialized.chunks.length} chunks`);
console.log(`Modifications recorded: ${serialized.modifications.length}`);

if (serialized.modifications.length > 0) {
  const mod = serialized.modifications[0];
  console.log(`\nFirst modification details:`);
  console.log(`  Chunk: (${mod.chunkX}, ${mod.chunkY})`);
  console.log(`  Modified tiles: ${mod.modifiedTiles.size}`);
  console.log(`  Height changes: ${mod.heightChanges.size}`);
  console.log(`  Added structures: ${mod.addedStructures.length}`);
  console.log(`  Removed structures: ${mod.removedStructures.length}`);
  console.log(`  Timestamp: ${new Date(mod.timestamp).toISOString()}`);
}

console.log('\nModifications are now persisted and can be restored when deserializing!');

// Example 8: Deserialize world and apply modifications
console.log('\nExample 8: Deserialize world and apply modifications');

// Create a new chunk manager for deserialization
const newChunkManager = new ChunkManager(config);

// Deserialize the world (this will restore chunks and apply modifications)
serializer.deserialize(serialized, newChunkManager);

console.log('World deserialized successfully!');
console.log(`Restored ${newChunkManager.getCacheSize()} chunks`);

// Verify modifications were applied
const restoredChunk = newChunkManager.getChunk(0, 0);
console.log(`\nRestored chunk at (0, 0):`);
console.log(`  Structures: ${restoredChunk.structures.length}`);

// Check if the flattened area was restored
const checkIndex = 12 * config.chunkSize + 12; // Middle of flattened area
console.log(`  Height at flattened area (12, 12): ${restoredChunk.heightmap[checkIndex].toFixed(2)}`);
console.log(`  Expected height: ${flatHeight.toFixed(2)}`);

if (Math.abs(restoredChunk.heightmap[checkIndex] - flatHeight) < 0.01) {
  console.log('  ✓ Terrain modifications were successfully applied!');
} else {
  console.log('  ✗ Terrain modifications were not applied correctly');
}

// Verify structure modifications
const hasVillage = restoredChunk.structures.some(s => s.type === StructureType.VILLAGE && s.x === 11 && s.y === 11);
const hasTower = restoredChunk.structures.some(s => s.type === StructureType.TOWER && s.x === 13 && s.y === 13);

if (hasVillage && hasTower) {
  console.log('  ✓ Structure modifications were successfully applied!');
} else {
  console.log('  ✗ Structure modifications were not applied correctly');
}

console.log('\nModification tracking example complete!');
console.log('This demonstrates how modifications persist across save/load cycles.');
