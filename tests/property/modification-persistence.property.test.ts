/**
 * Property-based tests for modification persistence
 * 
 * Tests verify that modifications to chunks (terrain edits and structure changes)
 * persist correctly across serialize-deserialize cycles.
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  WorldSerializer,
  SerializationFormat,
  type SerializationOptions,
  type ChunkModification,
} from '../../src/world/serialization';
import { ResourceType, StructureType, type Structure } from '../../src/world/chunk';

describe('Modification Persistence Property Tests', () => {
  // Feature: 3d-world-generation-enhancements, Property 24: Modification Persistence
  // **Validates: Requirements 14.5**
  test('modifications persist across serialize-deserialize cycle', () => {
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
        // Generate height modifications (tile index -> new height)
        fc.array(
          fc.record({
            index: fc.integer({ min: 0, max: 4095 }),
            height: fc.float({ min: 0, max: 1, noNaN: true }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        // Generate added structures
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
        // Generate removed structure indices
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 0, maxLength: 3 }),
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
          heightModifications,
          addedStructures,
          removedStructureIndices,
          format
        ) => {
          // Always use compression
          const compress = true;
          
          // Ensure arrays match chunk size
          const totalTiles = chunkSize * chunkSize;
          const heightmap = new Float32Array(totalTiles);
          const biomeMap = new Uint8Array(totalTiles);
          
          // Fill with generated data
          for (let i = 0; i < totalTiles; i++) {
            heightmap[i] = heightmapData[i % heightmapData.length];
            biomeMap[i] = biomeMapData[i % biomeMapData.length];
          }
          
          const rivers = new Set(riverIndices);

          // Create modification record
          const heightChanges = new Map<number, number>();
          const modifiedTiles = new Set<number>();
          
          for (const mod of heightModifications) {
            // Ensure tile index is within bounds
            const tileIndex = mod.index % totalTiles;
            heightChanges.set(tileIndex, mod.height);
            modifiedTiles.add(tileIndex);
          }

          // Filter removed structure indices to be within bounds
          const validRemovedIndices = removedStructureIndices.filter(idx => idx < structures.length);

          const modification: ChunkModification = {
            chunkX,
            chunkY,
            timestamp: Date.now(),
            modifiedTiles,
            heightChanges,
            addedStructures: addedStructures as Structure[],
            removedStructures: validRemovedIndices,
          };

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
                  heightmap: heightmap.slice(), // Copy for comparison
                  biomeMap,
                  biomeWeights: new Float32Array(totalTiles * 8),
                  resources: [...resources],
                  structures: [...structures],
                  rivers,
                },
                lastAccessed: 1,
              }],
            ]),
            modifications: new Map([
              [`${chunkX},${chunkY}`, modification],
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

          // Property 1: Modifications are included in serialized data
          const modificationsIncluded = serialized.modifications.length === 1;
          if (!modificationsIncluded) {
            return false;
          }

          const serializedMod = serialized.modifications[0];

          // Property 2: Modification coordinates are preserved
          const coordinatesPreserved = 
            serializedMod.chunkX === chunkX && 
            serializedMod.chunkY === chunkY;

          // Property 3: Timestamp is preserved
          const timestampPreserved = serializedMod.timestamp === modification.timestamp;

          // Property 4: Modified tiles are preserved
          const modifiedTilesPreserved = 
            serializedMod.modifiedTiles.size === modifiedTiles.size &&
            Array.from(serializedMod.modifiedTiles).every(tile => modifiedTiles.has(tile));

          // Property 5: Height changes are preserved
          const heightChangesPreserved = 
            serializedMod.heightChanges.size === heightChanges.size &&
            Array.from(serializedMod.heightChanges.entries()).every(([idx, height]) => {
              const originalHeight = heightChanges.get(idx);
              return originalHeight !== undefined && Math.abs(height - originalHeight) < 0.0001;
            });

          // Property 6: Added structures are preserved
          const addedStructuresPreserved = 
            serializedMod.addedStructures.length === addedStructures.length &&
            serializedMod.addedStructures.every((s, i) => {
              const orig = addedStructures[i];
              return s.x === orig.x && s.y === orig.y && s.type === orig.type;
            });

          // Property 7: Removed structures are preserved
          const removedStructuresPreserved = 
            serializedMod.removedStructures.length === validRemovedIndices.length &&
            serializedMod.removedStructures.every((idx, i) => idx === validRemovedIndices[i]);

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
            modifications: new Map(),
            accessCounter: 0,
            recordModification: function(chunkX: number, chunkY: number, mod: ChunkModification) {
              const key = `${chunkX},${chunkY}`;
              this.modifications.set(key, mod);
            },
          };

          // Deserialize the data
          serializer.deserialize(serialized, newChunkManager);

          // Verify the deserialized chunk has modifications applied
          const deserializedEntry = newChunkManager.cache.get(`${chunkX},${chunkY},0`);
          
          // Property 8: Chunk exists after deserialization
          if (!deserializedEntry) {
            return false;
          }

          const deserializedChunk = deserializedEntry.chunk;

          // Property 9: Height changes are applied to regenerated chunk
          const heightChangesApplied = Array.from(heightChanges.entries()).every(([idx, newHeight]) => {
            const actualHeight = deserializedChunk.heightmap[idx];
            return Math.abs(actualHeight - newHeight) < 0.0001;
          });

          // Property 10: Added structures are present in deserialized chunk
          const addedStructuresPresent = addedStructures.every(added => {
            return deserializedChunk.structures.some((s: Structure) => 
              s.x === added.x && s.y === added.y && s.type === added.type
            );
          });

          // Property 11: Structure removals are applied correctly
          // After deserialization, structures should be: original - removed + added
          // We need to check that the removed structures (by index) are not in the final chunk
          // Note: Removals are applied before additions in applyModifications
          let structureRemovalsCorrect = true;
          if (validRemovedIndices.length > 0) {
            // Create a copy of original structures and apply removals
            const expectedStructures = [...structures];
            const sortedRemovals = [...validRemovedIndices].sort((a, b) => b - a);
            for (const idx of sortedRemovals) {
              if (idx < expectedStructures.length) {
                expectedStructures.splice(idx, 1);
              }
            }
            // Add the added structures
            expectedStructures.push(...addedStructures);
            
            // Check if the deserialized chunk has the expected structure count
            structureRemovalsCorrect = deserializedChunk.structures.length === expectedStructures.length;
          } else {
            // No removals, just check that added structures are present
            const expectedCount = structures.length + addedStructures.length;
            structureRemovalsCorrect = deserializedChunk.structures.length === expectedCount;
          }

          // Property 13: Modification record is stored in new chunk manager
          const modificationStored = newChunkManager.modifications.has(`${chunkX},${chunkY}`);

          // Property 14: Stored modification has correct timestamp
          let storedTimestampCorrect = false;
          if (modificationStored) {
            const storedMod = newChunkManager.modifications.get(`${chunkX},${chunkY}`);
            storedTimestampCorrect = storedMod?.timestamp === modification.timestamp;
          }

          // All properties must hold for modification persistence
          return (
            modificationsIncluded &&
            coordinatesPreserved &&
            timestampPreserved &&
            modifiedTilesPreserved &&
            heightChangesPreserved &&
            addedStructuresPreserved &&
            removedStructuresPreserved &&
            heightChangesApplied &&
            addedStructuresPresent &&
            structureRemovalsCorrect &&
            modificationStored &&
            storedTimestampCorrect
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

