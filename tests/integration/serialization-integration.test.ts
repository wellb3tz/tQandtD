/**
 * Integration tests for world serialization
 * 
 * Tests verify that serialization works correctly with real ChunkManager instances
 * and can serialize/deserialize complete world states.
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager, WorldConfig } from '../../src/world/chunk-manager';
import { WorldSerializer, SerializationFormat } from '../../src/world/serialization';
import { TerrainConfig } from '../../src/gen/terrain';
import { BiomeConfig } from '../../src/world/biome';
import { ResourceConfig } from '../../src/gen/resources';
import { StructureConfig } from '../../src/gen/structures';
import { RiverConfig } from '../../src/gen/rivers';

describe('Serialization Integration Tests', () => {
  // Helper to create a basic world config
  function createWorldConfig(seed: number): WorldConfig {
    const terrainConfig: TerrainConfig = {
      scale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      heightScale: 1.0,
      seaLevel: 0.4,
    };

    const biomeConfig: BiomeConfig = {
      temperatureScale: 0.005,
      moistureScale: 0.005,
    };

    const resourceConfig: ResourceConfig = {
      types: [
        {
          type: 0, // IRON
          rarity: 0.3,
          biomes: [3, 4], // PLAINS, FOREST
          minAmount: 10,
          maxAmount: 50,
        },
        {
          type: 1, // GOLD
          rarity: 0.7,
          biomes: [7], // MOUNTAIN
          minAmount: 5,
          maxAmount: 20,
        },
      ],
      clusterScale: 20,
      densityThreshold: 0.6,
    };

    const structureConfig: StructureConfig = {
      types: [
        {
          type: 0, // VILLAGE
          rarity: 0.5,
          rules: [
            {
              type: 'biome',
              params: { biomes: [3, 4] }, // PLAINS, FOREST
            },
            {
              type: 'slope',
              params: { maxSlope: 0.1 },
            },
          ],
        },
        {
          type: 1, // RUINS
          rarity: 0.3,
          rules: [
            {
              type: 'biome',
              params: { biomes: [2, 3] }, // DESERT, PLAINS
            },
          ],
        },
      ],
      minDistance: 10,
      maxAttempts: 30,
    };

    const riverConfig: RiverConfig = {
      sourceThreshold: 0.7,
      minLength: 5,
    };

    return {
      seed,
      chunkSize: 32,
      terrainConfig,
      biomeConfig,
      resourceConfig,
      structureConfig,
      riverConfig,
      maxCacheSize: 10,
    };
  }

  describe('JSON serialization with real ChunkManager', () => {
    it('should serialize a world with generated chunks', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate some chunks
      chunkManager.getChunk(0, 0);
      chunkManager.getChunk(1, 0);
      chunkManager.getChunk(0, 1);

      // Serialize without compression
      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Verify serialization
      expect(serialized.version).toBe('1.0.0');
      expect(serialized.seed).toBe(12345);
      expect(serialized.chunks.length).toBe(3);
      expect(serialized.modifications.length).toBe(0);

      // Verify each chunk has the required data
      for (const chunk of serialized.chunks) {
        expect(typeof chunk.heightmap).toBe('string');
        expect(typeof chunk.biomeMap).toBe('string');
        expect(Array.isArray(chunk.resources)).toBe(true);
        expect(Array.isArray(chunk.structures)).toBe(true);
        expect(Array.isArray(chunk.rivers)).toBe(true);
      }
    });

    it('should serialize with compression', () => {
      const config = createWorldConfig(99999);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk
      chunkManager.getChunk(0, 0);

      // Serialize with compression
      const optionsCompressed = {
        format: SerializationFormat.JSON,
        compress: true,
        modifiedOnly: false,
      };

      const serializedCompressed = serializer.serialize(chunkManager, optionsCompressed);

      // Serialize without compression
      const optionsUncompressed = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serializedUncompressed = serializer.serialize(chunkManager, optionsUncompressed);

      // Compressed data should be smaller (base64 encoded)
      expect(serializedCompressed.chunks[0].heightmap.length).toBeLessThan(
        serializedUncompressed.chunks[0].heightmap.length
      );
    });

    it('should filter chunks by region', () => {
      const config = createWorldConfig(54321);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate chunks in different regions
      chunkManager.getChunk(0, 0);
      chunkManager.getChunk(5, 5);
      chunkManager.getChunk(10, 10);

      // Serialize only chunks in region [0,0] to [5,5]
      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
        region: {
          minX: 0,
          minY: 0,
          maxX: 5,
          maxY: 5,
        },
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Should only include 2 chunks
      expect(serialized.chunks.length).toBe(2);
      expect(serialized.chunks.some(c => c.x === 0 && c.y === 0)).toBe(true);
      expect(serialized.chunks.some(c => c.x === 5 && c.y === 5)).toBe(true);
      expect(serialized.chunks.some(c => c.x === 10 && c.y === 10)).toBe(false);
    });

    it('should preserve chunk data integrity', () => {
      const config = createWorldConfig(11111);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk
      const originalChunk = chunkManager.getChunk(0, 0);

      // Serialize
      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);
      const serializedChunk = serialized.chunks[0];

      // Verify coordinates match
      expect(serializedChunk.x).toBe(originalChunk.x);
      expect(serializedChunk.y).toBe(originalChunk.y);

      // Verify resources match
      expect(serializedChunk.resources.length).toBe(originalChunk.resources.length);
      for (let i = 0; i < originalChunk.resources.length; i++) {
        expect(serializedChunk.resources[i]).toEqual(originalChunk.resources[i]);
      }

      // Verify structures match
      expect(serializedChunk.structures.length).toBe(originalChunk.structures.length);
      for (let i = 0; i < originalChunk.structures.length; i++) {
        expect(serializedChunk.structures[i]).toEqual(originalChunk.structures[i]);
      }

      // Verify rivers match
      expect(serializedChunk.rivers.length).toBe(originalChunk.rivers.size);
      const originalRivers = Array.from(originalChunk.rivers).sort((a, b) => a - b);
      const serializedRivers = serializedChunk.rivers.sort((a, b) => a - b);
      expect(serializedRivers).toEqual(originalRivers);
    });
  });

  describe('JSON deserialization with real ChunkManager', () => {
    it('should deserialize a world and restore chunks to cache', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate some chunks
      const chunk1 = chunkManager.getChunk(0, 0);
      const chunk2 = chunkManager.getChunk(1, 0);

      // Serialize
      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Clear cache
      chunkManager.clearCache();
      expect(chunkManager.getCacheSize()).toBe(0);

      // Deserialize
      serializer.deserialize(serialized, chunkManager);

      // Verify chunks are restored
      expect(chunkManager.getCacheSize()).toBe(2);

      // Get chunks from cache and verify data
      const restoredChunk1 = chunkManager.getChunk(0, 0);
      const restoredChunk2 = chunkManager.getChunk(1, 0);

      // Verify coordinates
      expect(restoredChunk1.x).toBe(chunk1.x);
      expect(restoredChunk1.y).toBe(chunk1.y);
      expect(restoredChunk2.x).toBe(chunk2.x);
      expect(restoredChunk2.y).toBe(chunk2.y);

      // Verify heightmap data (skip NaN checks as that's a separate noise generation issue)
      expect(restoredChunk1.heightmap.length).toBe(chunk1.heightmap.length);
      // Check that serialization/deserialization preserves the data (even if it's NaN)
      for (let i = 0; i < chunk1.heightmap.length; i++) {
        const original = chunk1.heightmap[i];
        const restored = restoredChunk1.heightmap[i];
        // Both should be NaN or both should be equal
        if (isNaN(original)) {
          expect(isNaN(restored)).toBe(true);
        } else {
          expect(restored).toBeCloseTo(original, 5);
        }
      }

      // Verify biome map
      expect(restoredChunk1.biomeMap.length).toBe(chunk1.biomeMap.length);
      for (let i = 0; i < chunk1.biomeMap.length; i++) {
        expect(restoredChunk1.biomeMap[i]).toBe(chunk1.biomeMap[i]);
      }

      // Verify resources
      expect(restoredChunk1.resources.length).toBe(chunk1.resources.length);
      for (let i = 0; i < chunk1.resources.length; i++) {
        expect(restoredChunk1.resources[i]).toEqual(chunk1.resources[i]);
      }

      // Verify structures
      expect(restoredChunk1.structures.length).toBe(chunk1.structures.length);
      for (let i = 0; i < chunk1.structures.length; i++) {
        expect(restoredChunk1.structures[i]).toEqual(chunk1.structures[i]);
      }

      // Verify rivers
      expect(restoredChunk1.rivers.size).toBe(chunk1.rivers.size);
      const originalRivers = Array.from(chunk1.rivers).sort((a, b) => a - b);
      const restoredRivers = Array.from(restoredChunk1.rivers).sort((a, b) => a - b);
      expect(restoredRivers).toEqual(originalRivers);
    });

    it('should deserialize compressed data', () => {
      const config = createWorldConfig(99999);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk
      const originalChunk = chunkManager.getChunk(0, 0);

      // Serialize with compression
      const options = {
        format: SerializationFormat.JSON,
        compress: true,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Clear cache
      chunkManager.clearCache();

      // Deserialize
      serializer.deserialize(serialized, chunkManager);

      // Verify chunk is restored correctly
      const restoredChunk = chunkManager.getChunk(0, 0);

      // Verify heightmap data (skip NaN checks as that's a separate noise generation issue)
      expect(restoredChunk.heightmap.length).toBe(originalChunk.heightmap.length);
      for (let i = 0; i < originalChunk.heightmap.length; i++) {
        const original = originalChunk.heightmap[i];
        const restored = restoredChunk.heightmap[i];
        // Both should be NaN or both should be equal
        if (isNaN(original)) {
          expect(isNaN(restored)).toBe(true);
        } else {
          expect(restored).toBeCloseTo(original, 5);
        }
      }

      // Verify biome map
      expect(restoredChunk.biomeMap.length).toBe(originalChunk.biomeMap.length);
      for (let i = 0; i < originalChunk.biomeMap.length; i++) {
        expect(restoredChunk.biomeMap[i]).toBe(originalChunk.biomeMap[i]);
      }
    });

    it('should throw error for unsupported version', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      const invalidData = {
        version: '2.0.0',
        seed: 12345,
        config,
        chunks: [],
        modifications: [],
        checksum: '00000000',
      };

      expect(() => serializer.deserialize(invalidData, chunkManager)).toThrow(
        'Unsupported serialization version'
      );
    });

    it('should throw error for invalid checksum', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk and serialize
      chunkManager.getChunk(0, 0);
      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Corrupt the checksum
      serialized.checksum = 'invalid';

      // Clear cache
      chunkManager.clearCache();

      // Attempt to deserialize should fail
      expect(() => serializer.deserialize(serialized, chunkManager)).toThrow(
        'Checksum validation failed'
      );
    });

    it('should handle empty world deserialization', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Serialize empty world
      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Deserialize
      serializer.deserialize(serialized, chunkManager);

      // Cache should still be empty
      expect(chunkManager.getCacheSize()).toBe(0);
    });
  });

  describe('Binary serialization with real ChunkManager', () => {
    it('should serialize a world with generated chunks to binary format', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate some chunks
      chunkManager.getChunk(0, 0);
      chunkManager.getChunk(1, 0);
      chunkManager.getChunk(0, 1);

      // Serialize without compression
      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Verify serialization
      expect(serialized.version).toBe('1.0.0');
      expect(serialized.seed).toBe(12345);
      expect(serialized.chunks.length).toBe(3);
      expect(serialized.modifications.length).toBe(0);

      // Verify each chunk has binary data with type markers
      for (const chunk of serialized.chunks) {
        expect(chunk.heightmap instanceof ArrayBuffer).toBe(true);
        expect(chunk.biomeMap instanceof ArrayBuffer).toBe(true);
        expect(Array.isArray(chunk.resources)).toBe(true);
        expect(Array.isArray(chunk.structures)).toBe(true);
        expect(Array.isArray(chunk.rivers)).toBe(true);

        // Verify type markers
        const heightmapView = new DataView(chunk.heightmap as ArrayBuffer);
        expect(heightmapView.getUint8(0)).toBe(0x01); // Float32Array type marker
        
        const biomeMapView = new DataView(chunk.biomeMap as ArrayBuffer);
        expect(biomeMapView.getUint8(0)).toBe(0x02); // Uint8Array type marker
      }
    });

    it('should serialize with compression in binary format', () => {
      const config = createWorldConfig(99999);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk
      chunkManager.getChunk(0, 0);

      // Serialize with compression
      const optionsCompressed = {
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      };

      const serializedCompressed = serializer.serialize(chunkManager, optionsCompressed);

      // Serialize without compression
      const optionsUncompressed = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serializedUncompressed = serializer.serialize(chunkManager, optionsUncompressed);

      // Verify compression flag is set
      const compressedHeightmapView = new DataView(serializedCompressed.chunks[0].heightmap as ArrayBuffer);
      expect(compressedHeightmapView.getUint8(1)).toBe(0x01); // Compressed flag

      const uncompressedHeightmapView = new DataView(serializedUncompressed.chunks[0].heightmap as ArrayBuffer);
      expect(uncompressedHeightmapView.getUint8(1)).toBe(0x00); // Not compressed flag

      // Compressed data should be smaller
      expect((serializedCompressed.chunks[0].heightmap as ArrayBuffer).byteLength).toBeLessThan(
        (serializedUncompressed.chunks[0].heightmap as ArrayBuffer).byteLength
      );
    });

    it('should filter chunks by region in binary format', () => {
      const config = createWorldConfig(54321);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate chunks in different regions
      chunkManager.getChunk(0, 0);
      chunkManager.getChunk(5, 5);
      chunkManager.getChunk(10, 10);

      // Serialize only chunks in region [0,0] to [5,5]
      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
        region: {
          minX: 0,
          minY: 0,
          maxX: 5,
          maxY: 5,
        },
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Should only include 2 chunks
      expect(serialized.chunks.length).toBe(2);
      expect(serialized.chunks.some(c => c.x === 0 && c.y === 0)).toBe(true);
      expect(serialized.chunks.some(c => c.x === 5 && c.y === 5)).toBe(true);
      expect(serialized.chunks.some(c => c.x === 10 && c.y === 10)).toBe(false);
    });

    it('should preserve chunk data integrity in binary format', () => {
      const config = createWorldConfig(11111);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk
      const originalChunk = chunkManager.getChunk(0, 0);

      // Serialize
      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);
      const serializedChunk = serialized.chunks[0];

      // Verify coordinates match
      expect(serializedChunk.x).toBe(originalChunk.x);
      expect(serializedChunk.y).toBe(originalChunk.y);

      // Verify resources match
      expect(serializedChunk.resources.length).toBe(originalChunk.resources.length);
      for (let i = 0; i < originalChunk.resources.length; i++) {
        expect(serializedChunk.resources[i]).toEqual(originalChunk.resources[i]);
      }

      // Verify structures match
      expect(serializedChunk.structures.length).toBe(originalChunk.structures.length);
      for (let i = 0; i < originalChunk.structures.length; i++) {
        expect(serializedChunk.structures[i]).toEqual(originalChunk.structures[i]);
      }

      // Verify rivers match
      expect(serializedChunk.rivers.length).toBe(originalChunk.rivers.size);
      const originalRivers = Array.from(originalChunk.rivers).sort((a, b) => a - b);
      const serializedRivers = serializedChunk.rivers.sort((a, b) => a - b);
      expect(serializedRivers).toEqual(originalRivers);
    });
  });

  describe('Binary deserialization with real ChunkManager', () => {
    it('should deserialize a binary world and restore chunks to cache', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate some chunks
      const chunk1 = chunkManager.getChunk(0, 0);
      const chunk2 = chunkManager.getChunk(1, 0);

      // Serialize to binary format
      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Clear cache
      chunkManager.clearCache();
      expect(chunkManager.getCacheSize()).toBe(0);

      // Deserialize
      serializer.deserialize(serialized, chunkManager);

      // Verify chunks are restored
      expect(chunkManager.getCacheSize()).toBe(2);

      // Get chunks from cache and verify data
      const restoredChunk1 = chunkManager.getChunk(0, 0);
      const restoredChunk2 = chunkManager.getChunk(1, 0);

      // Verify coordinates
      expect(restoredChunk1.x).toBe(chunk1.x);
      expect(restoredChunk1.y).toBe(chunk1.y);
      expect(restoredChunk2.x).toBe(chunk2.x);
      expect(restoredChunk2.y).toBe(chunk2.y);

      // Verify heightmap data
      expect(restoredChunk1.heightmap.length).toBe(chunk1.heightmap.length);
      for (let i = 0; i < chunk1.heightmap.length; i++) {
        const original = chunk1.heightmap[i];
        const restored = restoredChunk1.heightmap[i];
        // Both should be NaN or both should be equal
        if (isNaN(original)) {
          expect(isNaN(restored)).toBe(true);
        } else {
          expect(restored).toBeCloseTo(original, 5);
        }
      }

      // Verify biome map
      expect(restoredChunk1.biomeMap.length).toBe(chunk1.biomeMap.length);
      for (let i = 0; i < chunk1.biomeMap.length; i++) {
        expect(restoredChunk1.biomeMap[i]).toBe(chunk1.biomeMap[i]);
      }

      // Verify resources
      expect(restoredChunk1.resources.length).toBe(chunk1.resources.length);
      for (let i = 0; i < chunk1.resources.length; i++) {
        expect(restoredChunk1.resources[i]).toEqual(chunk1.resources[i]);
      }

      // Verify structures
      expect(restoredChunk1.structures.length).toBe(chunk1.structures.length);
      for (let i = 0; i < chunk1.structures.length; i++) {
        expect(restoredChunk1.structures[i]).toEqual(chunk1.structures[i]);
      }

      // Verify rivers
      expect(restoredChunk1.rivers.size).toBe(chunk1.rivers.size);
      const originalRivers = Array.from(chunk1.rivers).sort((a, b) => a - b);
      const restoredRivers = Array.from(restoredChunk1.rivers).sort((a, b) => a - b);
      expect(restoredRivers).toEqual(originalRivers);
    });

    it('should deserialize compressed binary data', () => {
      const config = createWorldConfig(99999);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk
      const originalChunk = chunkManager.getChunk(0, 0);

      // Serialize with compression
      const options = {
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Clear cache
      chunkManager.clearCache();

      // Deserialize
      serializer.deserialize(serialized, chunkManager);

      // Verify chunk is restored correctly
      const restoredChunk = chunkManager.getChunk(0, 0);

      // Verify heightmap data
      expect(restoredChunk.heightmap.length).toBe(originalChunk.heightmap.length);
      for (let i = 0; i < originalChunk.heightmap.length; i++) {
        const original = originalChunk.heightmap[i];
        const restored = restoredChunk.heightmap[i];
        // Both should be NaN or both should be equal
        if (isNaN(original)) {
          expect(isNaN(restored)).toBe(true);
        } else {
          expect(restored).toBeCloseTo(original, 5);
        }
      }

      // Verify biome map
      expect(restoredChunk.biomeMap.length).toBe(originalChunk.biomeMap.length);
      for (let i = 0; i < originalChunk.biomeMap.length; i++) {
        expect(restoredChunk.biomeMap[i]).toBe(originalChunk.biomeMap[i]);
      }
    });

    it('should handle binary format with type markers correctly', () => {
      const config = createWorldConfig(77777);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk
      const originalChunk = chunkManager.getChunk(0, 0);

      // Serialize to binary format
      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Verify type markers are present
      const chunk = serialized.chunks[0];
      const heightmapView = new DataView(chunk.heightmap as ArrayBuffer);
      expect(heightmapView.getUint8(0)).toBe(0x01); // Float32Array type marker
      expect(heightmapView.getUint8(1)).toBe(0x00); // Not compressed

      const biomeMapView = new DataView(chunk.biomeMap as ArrayBuffer);
      expect(biomeMapView.getUint8(0)).toBe(0x02); // Uint8Array type marker
      expect(biomeMapView.getUint8(1)).toBe(0x00); // Not compressed

      // Clear cache and deserialize
      chunkManager.clearCache();
      serializer.deserialize(serialized, chunkManager);

      // Verify chunk is restored correctly
      const restoredChunk = chunkManager.getChunk(0, 0);

      // Verify data integrity
      expect(restoredChunk.heightmap.length).toBe(originalChunk.heightmap.length);
      expect(restoredChunk.biomeMap.length).toBe(originalChunk.biomeMap.length);
    });

    it('should handle empty world deserialization in binary format', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Serialize empty world
      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Deserialize
      serializer.deserialize(serialized, chunkManager);

      // Cache should still be empty
      expect(chunkManager.getCacheSize()).toBe(0);
    });

    it('should throw error for invalid type marker in heightmap', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk and serialize
      chunkManager.getChunk(0, 0);
      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Corrupt the type marker in heightmap
      const heightmapView = new DataView(serialized.chunks[0].heightmap as ArrayBuffer);
      heightmapView.setUint8(0, 0xFF); // Invalid type marker

      // Clear cache
      chunkManager.clearCache();

      // Attempt to deserialize should fail
      expect(() => serializer.deserialize(serialized, chunkManager)).toThrow(
        'Invalid type marker for Float32Array'
      );
    });

    it('should throw error for invalid type marker in biomeMap', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk and serialize
      chunkManager.getChunk(0, 0);
      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Corrupt the type marker in biomeMap
      const biomeMapView = new DataView(serialized.chunks[0].biomeMap as ArrayBuffer);
      biomeMapView.setUint8(0, 0xFF); // Invalid type marker

      // Clear cache
      chunkManager.clearCache();

      // Attempt to deserialize should fail
      expect(() => serializer.deserialize(serialized, chunkManager)).toThrow(
        'Invalid type marker for Uint8Array'
      );
    });
  });

  describe('Binary round-trip serialization', () => {
    it('should preserve all data through binary serialize-deserialize cycle', () => {
      const config = createWorldConfig(88888);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate multiple chunks with various features
      const chunk1 = chunkManager.getChunk(0, 0);
      const chunk2 = chunkManager.getChunk(1, 1);
      const chunk3 = chunkManager.getChunk(-1, -1);

      // Serialize to binary format without compression
      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Create a new chunk manager and deserialize
      const newChunkManager = new ChunkManager(config);
      serializer.deserialize(serialized, newChunkManager);

      // Verify all chunks are restored
      expect(newChunkManager.getCacheSize()).toBe(3);

      // Verify each chunk's data
      const restoredChunk1 = newChunkManager.getChunk(0, 0);
      const restoredChunk2 = newChunkManager.getChunk(1, 1);
      const restoredChunk3 = newChunkManager.getChunk(-1, -1);

      // Check chunk 1
      expect(restoredChunk1.x).toBe(chunk1.x);
      expect(restoredChunk1.y).toBe(chunk1.y);
      expect(restoredChunk1.heightmap.length).toBe(chunk1.heightmap.length);
      expect(restoredChunk1.biomeMap.length).toBe(chunk1.biomeMap.length);
      expect(restoredChunk1.resources.length).toBe(chunk1.resources.length);
      expect(restoredChunk1.structures.length).toBe(chunk1.structures.length);
      expect(restoredChunk1.rivers.size).toBe(chunk1.rivers.size);

      // Check chunk 2
      expect(restoredChunk2.x).toBe(chunk2.x);
      expect(restoredChunk2.y).toBe(chunk2.y);

      // Check chunk 3
      expect(restoredChunk3.x).toBe(chunk3.x);
      expect(restoredChunk3.y).toBe(chunk3.y);
    });

    it('should preserve all data through compressed binary serialize-deserialize cycle', () => {
      const config = createWorldConfig(66666);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate chunks
      const chunk1 = chunkManager.getChunk(0, 0);
      const chunk2 = chunkManager.getChunk(2, 2);

      // Serialize to binary format with compression
      const options = {
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      // Create a new chunk manager and deserialize
      const newChunkManager = new ChunkManager(config);
      serializer.deserialize(serialized, newChunkManager);

      // Verify all chunks are restored
      expect(newChunkManager.getCacheSize()).toBe(2);

      // Verify data integrity
      const restoredChunk1 = newChunkManager.getChunk(0, 0);
      const restoredChunk2 = newChunkManager.getChunk(2, 2);

      expect(restoredChunk1.x).toBe(chunk1.x);
      expect(restoredChunk1.y).toBe(chunk1.y);
      expect(restoredChunk1.heightmap.length).toBe(chunk1.heightmap.length);
      expect(restoredChunk1.biomeMap.length).toBe(chunk1.biomeMap.length);

      expect(restoredChunk2.x).toBe(chunk2.x);
      expect(restoredChunk2.y).toBe(chunk2.y);
      expect(restoredChunk2.heightmap.length).toBe(chunk2.heightmap.length);
      expect(restoredChunk2.biomeMap.length).toBe(chunk2.biomeMap.length);
    });

    it('should handle mixed compressed and uncompressed binary round-trip', () => {
      const config = createWorldConfig(55555);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate a chunk
      const originalChunk = chunkManager.getChunk(0, 0);

      // First serialize with compression
      const compressedOptions = {
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      };

      const compressedSerialized = serializer.serialize(chunkManager, compressedOptions);

      // Deserialize compressed data
      const tempChunkManager = new ChunkManager(config);
      serializer.deserialize(compressedSerialized, tempChunkManager);

      // Serialize again without compression
      const uncompressedOptions = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const uncompressedSerialized = serializer.serialize(tempChunkManager, uncompressedOptions);

      // Deserialize uncompressed data
      const finalChunkManager = new ChunkManager(config);
      serializer.deserialize(uncompressedSerialized, finalChunkManager);

      // Verify final chunk matches original
      const finalChunk = finalChunkManager.getChunk(0, 0);

      expect(finalChunk.x).toBe(originalChunk.x);
      expect(finalChunk.y).toBe(originalChunk.y);
      expect(finalChunk.heightmap.length).toBe(originalChunk.heightmap.length);
      expect(finalChunk.biomeMap.length).toBe(originalChunk.biomeMap.length);
    });
  });
});
