/**
 * Example: Binary Serialization
 * 
 * Demonstrates how to serialize world data to binary format with compression.
 * Binary format uses a custom protocol with type markers for efficient storage.
 */

import { ChunkManager } from '../src/world/chunk-manager';
import { WorldSerializer, SerializationFormat } from '../src/world/serialization';

// Create a chunk manager with a simple configuration
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  maxCacheSize: 100,
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

// Generate some chunks
console.log('Generating chunks...');
chunkManager.getChunk(0, 0);
chunkManager.getChunk(1, 0);
chunkManager.getChunk(0, 1);
chunkManager.getChunk(1, 1);

// Create serializer
const serializer = new WorldSerializer();

// Serialize to binary format without compression
console.log('\n=== Binary Serialization (Uncompressed) ===');
const uncompressedResult = serializer.serialize(chunkManager, {
  format: SerializationFormat.BINARY,
  compress: false,
  modifiedOnly: false,
});

console.log(`Version: ${uncompressedResult.version}`);
console.log(`Seed: ${uncompressedResult.seed}`);
console.log(`Chunks: ${uncompressedResult.chunks.length}`);
console.log(`Checksum: ${uncompressedResult.checksum}`);

// Inspect first chunk's binary data
const firstChunk = uncompressedResult.chunks[0];
console.log(`\nFirst chunk (${firstChunk.x}, ${firstChunk.y}):`);
console.log(`  Heightmap size: ${(firstChunk.heightmap as ArrayBuffer).byteLength} bytes`);
console.log(`  BiomeMap size: ${(firstChunk.biomeMap as ArrayBuffer).byteLength} bytes`);
console.log(`  Resources: ${firstChunk.resources.length}`);
console.log(`  Structures: ${firstChunk.structures.length}`);
console.log(`  Rivers: ${firstChunk.rivers.length} tiles`);

// Inspect binary format structure
const heightmapView = new DataView(firstChunk.heightmap as ArrayBuffer);
console.log(`\nBinary format structure (heightmap):`);
console.log(`  Type marker: 0x${heightmapView.getUint8(0).toString(16).padStart(2, '0')} (0x01 = Float32Array)`);
console.log(`  Compressed flag: 0x${heightmapView.getUint8(1).toString(16).padStart(2, '0')} (0x00 = uncompressed)`);
console.log(`  Array length: ${heightmapView.getUint32(2, true)} elements`);

// Serialize to binary format with compression
console.log('\n=== Binary Serialization (Compressed) ===');
const compressedResult = serializer.serialize(chunkManager, {
  format: SerializationFormat.BINARY,
  compress: true,
  modifiedOnly: false,
});

const compressedChunk = compressedResult.chunks[0];
console.log(`First chunk (${compressedChunk.x}, ${compressedChunk.y}):`);
console.log(`  Heightmap size: ${(compressedChunk.heightmap as ArrayBuffer).byteLength} bytes`);
console.log(`  BiomeMap size: ${(compressedChunk.biomeMap as ArrayBuffer).byteLength} bytes`);

// Calculate compression ratio
const uncompressedSize = (firstChunk.heightmap as ArrayBuffer).byteLength + 
                         (firstChunk.biomeMap as ArrayBuffer).byteLength;
const compressedSize = (compressedChunk.heightmap as ArrayBuffer).byteLength + 
                       (compressedChunk.biomeMap as ArrayBuffer).byteLength;
const compressionRatio = ((1 - compressedSize / uncompressedSize) * 100).toFixed(2);

console.log(`\nCompression ratio: ${compressionRatio}% reduction`);
console.log(`  Uncompressed: ${uncompressedSize} bytes`);
console.log(`  Compressed: ${compressedSize} bytes`);

// Inspect compressed binary format
const compressedHeightmapView = new DataView(compressedChunk.heightmap as ArrayBuffer);
console.log(`\nBinary format structure (compressed heightmap):`);
console.log(`  Type marker: 0x${compressedHeightmapView.getUint8(0).toString(16).padStart(2, '0')}`);
console.log(`  Compressed flag: 0x${compressedHeightmapView.getUint8(1).toString(16).padStart(2, '0')} (0x01 = compressed)`);
console.log(`  Original length: ${compressedHeightmapView.getUint32(2, true)} elements`);
console.log(`  Compressed length: ${compressedHeightmapView.getUint32(6, true)} bytes`);

// Serialize with region filter
console.log('\n=== Binary Serialization (Region Filter) ===');
const regionResult = serializer.serialize(chunkManager, {
  format: SerializationFormat.BINARY,
  compress: true,
  modifiedOnly: false,
  region: {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  },
});

console.log(`Chunks in region (0,0) to (0,0): ${regionResult.chunks.length}`);
console.log(`Filtered chunks: ${regionResult.chunks.map(c => `(${c.x},${c.y})`).join(', ')}`);

console.log('\n✓ Binary serialization complete!');

// Demonstrate the new convenience methods
console.log('\n=== Using ChunkManager Convenience Methods ===');

// Using saveWorld() convenience method
console.log('\nUsing saveWorld() method:');
const savedWorld = chunkManager.saveWorld({
  format: SerializationFormat.BINARY,
  compress: true,
  modifiedOnly: false,
});

console.log(`  Saved ${savedWorld.chunks.length} chunks`);
console.log(`  Checksum: ${savedWorld.checksum}`);

// Using exportWorld() convenience method
console.log('\nUsing exportWorld() method:');
const exportedBlob = chunkManager.exportWorld({
  format: SerializationFormat.BINARY,
  compress: true,
  modifiedOnly: false,
});

console.log(`  Exported as Blob: ${exportedBlob instanceof Blob}`);
console.log(`  Blob size: ${(exportedBlob as Blob).size} bytes`);
console.log(`  Blob type: ${(exportedBlob as Blob).type}`);

// Using loadWorld() convenience method
console.log('\nUsing loadWorld() method:');
const newChunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  maxCacheSize: 100,
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

newChunkManager.loadWorld(savedWorld);
console.log(`  Loaded ${newChunkManager.getCacheSize()} chunks into cache`);

// Verify loaded data
const loadedChunk = newChunkManager.getChunk(0, 0);
console.log(`  Verified chunk (0,0): ${loadedChunk.heightmap.length} heightmap values`);

console.log('\n✓ Convenience methods demonstration complete!');

