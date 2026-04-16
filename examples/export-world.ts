/**
 * Example: Exporting World Data
 * 
 * This example demonstrates how to export generated world data to file-compatible
 * formats (JSON string or binary Blob) for saving to disk or transferring over network.
 */

import { ChunkManager, WorldSerializer, SerializationFormat } from '../src/index';

// Create a chunk manager with a simple configuration
const chunkManager = new ChunkManager({
  seed: 12345,
  chunkSize: 32,
  maxCacheSize: 100,
  terrainConfig: {
    scale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    heightScale: 100,
  },
  biomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
  },
  resourceConfig: {
    density: 0.01,
  },
  structureConfig: {
    density: 0.001,
  },
  riverNetworkConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
    enableTributaries: true,
    maxTributaryOrder: 2,
    tributaryProbability: 0.3,
    enableLakes: true,
    lakeDepressionThreshold: 0.05,
    maxLakeSize: 100,
    enableDeltas: true,
    deltaBranchCount: 3,
    deltaSpreadAngle: Math.PI / 3,
    minFlow: 1.0,
    maxFlow: 100.0,
    widthScale: 0.5,
  },
});

// Generate some chunks
console.log('Generating chunks...');
for (let x = 0; x < 3; x++) {
  for (let y = 0; y < 3; y++) {
    chunkManager.getChunk(x, y);
  }
}
console.log('Generated 9 chunks');

// Create a serializer
const serializer = new WorldSerializer();

// Example 1: Export to JSON string
console.log('\n--- Example 1: Export to JSON ---');
const jsonExport = serializer.export(chunkManager, {
  format: SerializationFormat.JSON,
  compress: false,
  modifiedOnly: false,
});

console.log('Export type:', typeof jsonExport);
console.log('Export size:', (jsonExport as string).length, 'characters');
console.log('First 200 characters:', (jsonExport as string).substring(0, 200) + '...');

// In a real application, you would save this to a file:
// fs.writeFileSync('world.json', jsonExport);

// Example 2: Export to JSON with compression
console.log('\n--- Example 2: Export to JSON with compression ---');
const jsonCompressedExport = serializer.export(chunkManager, {
  format: SerializationFormat.JSON,
  compress: true,
  modifiedOnly: false,
});

console.log('Compressed export size:', (jsonCompressedExport as string).length, 'characters');
console.log('Compression ratio:', 
  ((1 - (jsonCompressedExport as string).length / (jsonExport as string).length) * 100).toFixed(2) + '%');

// Example 3: Export to binary Blob
console.log('\n--- Example 3: Export to binary Blob ---');
const binaryExport = serializer.export(chunkManager, {
  format: SerializationFormat.BINARY,
  compress: false,
  modifiedOnly: false,
});

console.log('Export type:', binaryExport.constructor.name);
console.log('Blob size:', (binaryExport as Blob).size, 'bytes');
console.log('Blob type:', (binaryExport as Blob).type);

// In a browser, you could create a download link:
// const url = URL.createObjectURL(binaryExport);
// const a = document.createElement('a');
// a.href = url;
// a.download = 'world.bin';
// a.click();

// Example 4: Export selective region
console.log('\n--- Example 4: Export selective region ---');
const regionExport = serializer.export(chunkManager, {
  format: SerializationFormat.JSON,
  compress: false,
  modifiedOnly: false,
  region: {
    minX: 0,
    minY: 0,
    maxX: 1,
    maxY: 1,
  },
});

const regionData = JSON.parse(regionExport as string);
console.log('Full world chunks:', JSON.parse(jsonExport as string).chunks.length);
console.log('Region export chunks:', regionData.chunks.length);
console.log('Region chunks coordinates:', 
  regionData.chunks.map((c: any) => `(${c.x},${c.y})`).join(', '));

// Example 5: Verify format version metadata
console.log('\n--- Example 5: Format version metadata ---');
const metadata = JSON.parse(jsonExport as string);
console.log('Format version:', metadata.version);
console.log('World seed:', metadata.seed);
console.log('Chunk size:', metadata.config.chunkSize);
console.log('Checksum:', metadata.checksum);

console.log('\n✓ Export examples completed successfully!');
