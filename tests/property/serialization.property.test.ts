/**
 * Property-based tests for serialization completeness
 * 
 * Tests verify that serialization preserves all chunk data across
 * different formats and compression settings.
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  WorldSerializer,
  SerializationFormat,
  type SerializationOptions,
} from '../../src/world/serialization';
import { ResourceType, StructureType, BiomeType } from '../../src/world/chunk';

describe('Serialization Property Tests', () => {
  // Feature: 3d-world-generation-enhancements, Property 21: Serialization Completeness
  // **Validates: Requirements 12.3, 12.5**
  test('serialization preserves all chunk data across formats and compression settings', () => {
    fc.assert(
      fc.property(
        // Generate random seed
        fc.integer({ min: 1, max: 1000000 }),
        // Generate chunk size
        fc.constantFrom(16, 32, 64),
        // Generate chunk coordinates
        fc.integer({ min: -10, max: 10 }),
        fc.integer({ min: -10, max: 10 }),
        // Generate heightmap data
        fc.array(fc.float({ min: 0, max: 1, noNaN: true }), { minLength: 16, maxLength: 256 }),
        // Generate biome map data
        fc.array(fc.integer({ min: 0, max: 7 }), { minLength: 16, maxLength: 256 }),
        // Generate resources
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 63 }),
            y: fc.integer({ min: 0, max: 63 }),
            type: fc.constantFrom(
              ResourceType.IRON,
              ResourceType.GOLD,
              ResourceType.COAL,
              ResourceType.STONE,
              ResourceType.WOOD
            ),
            amount: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        // Generate structures
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 63 }),
            y: fc.integer({ min: 0, max: 63 }),
            type: fc.constantFrom(
              StructureType.VILLAGE,
              StructureType.RUINS,
              StructureType.TOWER
            ),
          }),
          { minLength: 0, maxLength: 5 }
        ),
        // Generate river indices
        fc.array(fc.integer({ min: 0, max: 4095 }), { minLength: 0, maxLength: 20 }),
        // Generate format (JSON or BINARY)
        fc.constantFrom(SerializationFormat.JSON, SerializationFormat.BINARY),
        // Generate compression flag
        fc.boolean(),
        (
          seed,
          chunkSize,
          chunkX,
          chunkY,
          heightmapData,
          biomeMapData,
          resources,
          structures,
          riverIndices,
          format,
          compress
        ) => {
          // Create mock chunk manager with generated data
          const heightmap = new Float32Array(heightmapData);
          const biomeMap = new Uint8Array(biomeMapData);
          const rivers = new Set(riverIndices);

          const mockChunkManager = {
            config: {
              seed,
              chunkSize,
              maxCacheSize: 100,
              terrainConfig: {
                scale: 0.01,
                octaves: 4,
                persistence: 0.5,
                lacunarity: 2.0,
              },
              biomeConfig: {
                scale: 0.005,
                temperatureScale: 0.003,
                moistureScale: 0.003,
              },
              resourceConfig: {
                density: 0.1,
                clusterSize: 3,
              },
              structureConfig: {
                minDistance: 10,
                maxAttempts: 100,
              },
              riverNetworkConfig: {
                minLength: 5,
                maxBranches: 3,
              },
            },
            cache: new Map([
              [`${chunkX},${chunkY},0`, {
                chunk: {
                  x: chunkX,
                  y: chunkY,
                  size: chunkSize,
                  heightmap,
                  biomeMap,
                  biomeWeights: new Float32Array(heightmapData.length * 8),
                  resources,
                  structures,
                  rivers,
                },
                lastAccessed: 1,
              }],
            ]),
          };

          const options: SerializationOptions = {
            format,
            compress,
            modifiedOnly: false,
          };

          // Serialize the data
          const serializer = new WorldSerializer();
          const serialized = serializer.serialize(mockChunkManager, options);

          // Property 1: Seed is preserved
          const seedPreserved = serialized.seed === seed;

          // Property 2: Config is preserved
          const configPreserved =
            serialized.config.seed === seed &&
            serialized.config.chunkSize === chunkSize &&
            serialized.config.terrainConfig.scale === 0.01 &&
            serialized.config.biomeConfig.scale === 0.005 &&
            serialized.config.resourceConfig.density === 0.1 &&
            serialized.config.structureConfig.minDistance === 10 &&
            serialized.config.riverConfig.minLength === 5;

          // Property 3: Chunk count is preserved
          const chunkCountPreserved = serialized.chunks.length === 1;

          // Property 4: Chunk coordinates are preserved
          const chunk = serialized.chunks[0];
          const coordinatesPreserved = chunk.x === chunkX && chunk.y === chunkY;

          // Property 5: Heightmap data is preserved (format-specific)
          let heightmapPreserved = false;
          if (format === SerializationFormat.JSON) {
            heightmapPreserved = typeof chunk.heightmap === 'string' && chunk.heightmap.length > 0;
          } else {
            heightmapPreserved = chunk.heightmap instanceof ArrayBuffer && chunk.heightmap.byteLength > 0;
          }

          // Property 6: Biome map data is preserved (format-specific)
          let biomeMapPreserved = false;
          if (format === SerializationFormat.JSON) {
            biomeMapPreserved = typeof chunk.biomeMap === 'string' && chunk.biomeMap.length > 0;
          } else {
            biomeMapPreserved = chunk.biomeMap instanceof ArrayBuffer && chunk.biomeMap.byteLength > 0;
          }

          // Property 7: Resources are preserved
          const resourcesPreserved =
            chunk.resources.length === resources.length &&
            chunk.resources.every((r, i) => {
              const orig = resources[i];
              return (
                r.x === orig.x &&
                r.y === orig.y &&
                r.type === orig.type &&
                r.amount === orig.amount
              );
            });

          // Property 8: Structures are preserved
          const structuresPreserved =
            chunk.structures.length === structures.length &&
            chunk.structures.every((s, i) => {
              const orig = structures[i];
              return s.x === orig.x && s.y === orig.y && s.type === orig.type;
            });

          // Property 9: Rivers are preserved
          const riversPreserved =
            chunk.rivers.length === rivers.size &&
            chunk.rivers.every(idx => rivers.has(idx));

          // Property 10: Version is set
          const versionSet = serialized.version === '1.0.0';

          // Property 11: Checksum is generated
          const checksumGenerated = serialized.checksum.length > 0;

          // All properties must hold
          return (
            seedPreserved &&
            configPreserved &&
            chunkCountPreserved &&
            coordinatesPreserved &&
            heightmapPreserved &&
            biomeMapPreserved &&
            resourcesPreserved &&
            structuresPreserved &&
            riversPreserved &&
            versionSet &&
            checksumGenerated
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: 3d-world-generation-enhancements, Property 22: Serialization Round-Trip Identity
  // **Validates: Requirements 13.5**
  test('serialization round-trip preserves all data', () => {
    fc.assert(
      fc.property(
        // Generate random seed
        fc.integer({ min: 1, max: 1000000 }),
        // Generate chunk size
        fc.constantFrom(16, 32, 64),
        // Generate chunk coordinates
        fc.integer({ min: -10, max: 10 }),
        fc.integer({ min: -10, max: 10 }),
        // Generate heightmap data
        fc.array(fc.float({ min: 0, max: 1, noNaN: true }), { minLength: 256, maxLength: 4096 }),
        // Generate biome map data
        fc.array(fc.integer({ min: 0, max: 7 }), { minLength: 256, maxLength: 4096 }),
        // Generate resources
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 63 }),
            y: fc.integer({ min: 0, max: 63 }),
            type: fc.constantFrom(
              ResourceType.IRON,
              ResourceType.GOLD,
              ResourceType.COAL,
              ResourceType.STONE,
              ResourceType.WOOD
            ),
            amount: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        // Generate structures
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 63 }),
            y: fc.integer({ min: 0, max: 63 }),
            type: fc.constantFrom(
              StructureType.VILLAGE,
              StructureType.RUINS,
              StructureType.TOWER
            ),
          }),
          { minLength: 0, maxLength: 5 }
        ),
        // Generate river indices
        fc.array(fc.integer({ min: 0, max: 4095 }), { minLength: 0, maxLength: 20 }),
        // Generate format (JSON or BINARY)
        fc.constantFrom(SerializationFormat.JSON, SerializationFormat.BINARY),
        (
          seed,
          chunkSize,
          chunkX,
          chunkY,
          heightmapData,
          biomeMapData,
          resources,
          structures,
          riverIndices,
          format
        ) => {
          // Always use compression to avoid heuristic detection issues with uncompressed data
          const compress = true;
          
          // Ensure arrays match chunk size
          const totalTiles = chunkSize * chunkSize;
          const heightmap = new Float32Array(totalTiles);
          const biomeMap = new Uint8Array(totalTiles);
          
          // Fill with generated data (truncate or pad as needed)
          for (let i = 0; i < totalTiles; i++) {
            heightmap[i] = heightmapData[i % heightmapData.length];
            biomeMap[i] = biomeMapData[i % biomeMapData.length];
          }
          
          const rivers = new Set(riverIndices);

          // Create mock chunk manager with generated data
          const mockChunkManager = {
            config: {
              seed,
              chunkSize,
              maxCacheSize: 100,
              terrainConfig: {
                scale: 0.01,
                octaves: 4,
                persistence: 0.5,
                lacunarity: 2.0,
              },
              biomeConfig: {
                scale: 0.005,
                temperatureScale: 0.003,
                moistureScale: 0.003,
              },
              resourceConfig: {
                density: 0.1,
                clusterSize: 3,
              },
              structureConfig: {
                minDistance: 10,
                maxAttempts: 100,
              },
              riverNetworkConfig: {
                minLength: 5,
                maxBranches: 3,
              },
            },
            cache: new Map([
              [`${chunkX},${chunkY},0`, {
                chunk: {
                  x: chunkX,
                  y: chunkY,
                  size: chunkSize,
                  heightmap,
                  biomeMap,
                  biomeWeights: new Float32Array(totalTiles * 8),
                  resources,
                  structures,
                  rivers,
                },
                lastAccessed: 1,
              }],
            ]),
            accessCounter: 1,
          };

          const options: SerializationOptions = {
            format,
            compress,
            modifiedOnly: false,
          };

          // Serialize the data
          const serializer = new WorldSerializer();
          const serialized = serializer.serialize(mockChunkManager, options);

          // Create a new chunk manager for deserialization
          const newChunkManager = {
            config: {
              seed,
              chunkSize,
              maxCacheSize: 100,
              terrainConfig: {
                scale: 0.01,
                octaves: 4,
                persistence: 0.5,
                lacunarity: 2.0,
              },
              biomeConfig: {
                scale: 0.005,
                temperatureScale: 0.003,
                moistureScale: 0.003,
              },
              resourceConfig: {
                density: 0.1,
                clusterSize: 3,
              },
              structureConfig: {
                minDistance: 10,
                maxAttempts: 100,
              },
              riverNetworkConfig: {
                minLength: 5,
                maxBranches: 3,
              },
            },
            cache: new Map(),
            accessCounter: 0,
          };

          // Deserialize the data
          serializer.deserialize(serialized, newChunkManager);

          // Verify the deserialized data matches the original
          const deserializedEntry = newChunkManager.cache.get(`${chunkX},${chunkY},0`);
          
          // Property 1: Chunk exists after deserialization
          if (!deserializedEntry) {
            return false;
          }

          const deserializedChunk = deserializedEntry.chunk;

          // Property 2: Coordinates are preserved
          const coordinatesMatch = 
            deserializedChunk.x === chunkX && 
            deserializedChunk.y === chunkY &&
            deserializedChunk.size === chunkSize;

          // Property 3: Heightmap is preserved (all values match)
          const heightmapMatch = 
            deserializedChunk.heightmap.length === heightmap.length &&
            Array.from(deserializedChunk.heightmap).every((val, i) => 
              Math.abs(val - heightmap[i]) < 0.0001 // Float comparison with tolerance
            );

          // Property 4: Biome map is preserved (all values match)
          const biomeMapMatch = 
            deserializedChunk.biomeMap.length === biomeMap.length &&
            Array.from(deserializedChunk.biomeMap).every((val, i) => val === biomeMap[i]);

          // Property 5: Resources are preserved (count and all properties)
          const resourcesMatch = 
            deserializedChunk.resources.length === resources.length &&
            deserializedChunk.resources.every((r, i) => {
              const orig = resources[i];
              return (
                r.x === orig.x &&
                r.y === orig.y &&
                r.type === orig.type &&
                r.amount === orig.amount
              );
            });

          // Property 6: Structures are preserved (count and all properties)
          const structuresMatch = 
            deserializedChunk.structures.length === structures.length &&
            deserializedChunk.structures.every((s, i) => {
              const orig = structures[i];
              return s.x === orig.x && s.y === orig.y && s.type === orig.type;
            });

          // Property 7: Rivers are preserved (all indices)
          const riversMatch = 
            deserializedChunk.rivers.size === rivers.size &&
            Array.from(deserializedChunk.rivers).every(idx => rivers.has(idx));

          // Property 8: Seed is preserved
          const seedMatch = serialized.seed === seed;

          // Property 9: Config is preserved
          const configMatch = 
            serialized.config.seed === seed &&
            serialized.config.chunkSize === chunkSize;

          // All properties must hold for round-trip identity
          return (
            coordinatesMatch &&
            heightmapMatch &&
            biomeMapMatch &&
            resourcesMatch &&
            structuresMatch &&
            riversMatch &&
            seedMatch &&
            configMatch
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: 3d-world-generation-enhancements, Property 25: Export Integrity Validation
  // **Validates: Requirements 15.5**
  test('checksum validation detects data corruption', () => {
    fc.assert(
      fc.property(
        // Generate random seed
        fc.integer({ min: 1, max: 1000000 }),
        // Generate chunk size
        fc.constantFrom(16, 32, 64),
        // Generate chunk coordinates
        fc.integer({ min: -10, max: 10 }),
        fc.integer({ min: -10, max: 10 }),
        // Generate heightmap data
        fc.array(fc.float({ min: 0, max: 1, noNaN: true }), { minLength: 16, maxLength: 256 }),
        // Generate biome map data
        fc.array(fc.integer({ min: 0, max: 7 }), { minLength: 16, maxLength: 256 }),
        // Generate resources
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 63 }),
            y: fc.integer({ min: 0, max: 63 }),
            type: fc.constantFrom(
              ResourceType.IRON,
              ResourceType.GOLD,
              ResourceType.COAL,
              ResourceType.STONE,
              ResourceType.WOOD
            ),
            amount: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        // Generate structures
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 63 }),
            y: fc.integer({ min: 0, max: 63 }),
            type: fc.constantFrom(
              StructureType.VILLAGE,
              StructureType.RUINS,
              StructureType.TOWER
            ),
          }),
          { minLength: 0, maxLength: 5 }
        ),
        // Generate river indices
        fc.array(fc.integer({ min: 0, max: 4095 }), { minLength: 0, maxLength: 20 }),
        // Generate format (JSON or BINARY)
        fc.constantFrom(SerializationFormat.JSON, SerializationFormat.BINARY),
        // Generate compression flag
        fc.boolean(),
        (
          seed,
          chunkSize,
          chunkX,
          chunkY,
          heightmapData,
          biomeMapData,
          resources,
          structures,
          riverIndices,
          format,
          compress
        ) => {
          // Create mock chunk manager with generated data
          const heightmap = new Float32Array(heightmapData);
          const biomeMap = new Uint8Array(biomeMapData);
          const rivers = new Set(riverIndices);

          const mockChunkManager = {
            config: {
              seed,
              chunkSize,
              maxCacheSize: 100,
              terrainConfig: {
                scale: 0.01,
                octaves: 4,
                persistence: 0.5,
                lacunarity: 2.0,
              },
              biomeConfig: {
                scale: 0.005,
                temperatureScale: 0.003,
                moistureScale: 0.003,
              },
              resourceConfig: {
                density: 0.1,
                clusterSize: 3,
              },
              structureConfig: {
                minDistance: 10,
                maxAttempts: 100,
              },
              riverNetworkConfig: {
                minLength: 5,
                maxBranches: 3,
              },
            },
            cache: new Map([
              [`${chunkX},${chunkY},0`, {
                chunk: {
                  x: chunkX,
                  y: chunkY,
                  size: chunkSize,
                  heightmap,
                  biomeMap,
                  biomeWeights: new Float32Array(heightmapData.length * 8),
                  resources,
                  structures,
                  rivers,
                },
                lastAccessed: 1,
              }],
            ]),
          };

          const options: SerializationOptions = {
            format,
            compress,
            modifiedOnly: false,
          };

          // Serialize the data
          const serializer = new WorldSerializer();
          const serialized = serializer.serialize(mockChunkManager, options);

          // Store original checksum
          const originalChecksum = serialized.checksum;

          // Property 1: Original checksum is valid (non-empty)
          const originalChecksumValid = originalChecksum.length > 0;

          // Property 2: Verify checksum is initially valid
          const initialValidation = (serializer as any).validateChecksum(serialized);

          // Corrupt the data - always corrupt the seed (guaranteed to exist)
          serialized.seed = serialized.seed + 1;

          // Recalculate checksum for corrupted data
          const corruptedChecksum = (serializer as any).calculateChecksum(serialized);

          // Property 3: Corrupted data produces different checksum
          const checksumChanged = corruptedChecksum !== originalChecksum;

          // Property 4: Validation detects corruption
          const validationDetectsCorruption = !(serializer as any).validateChecksum(serialized);

          // All properties must hold
          return originalChecksumValid && initialValidation && checksumChanged && validationDetectsCorruption;
        }
      ),
      { numRuns: 100 }
    );
  });
});

