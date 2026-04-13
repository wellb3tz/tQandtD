/**
 * Unit tests for serialization data structures
 * 
 * Tests verify that the serialization interfaces and enums are correctly
 * defined and can be used to create valid serialization objects.
 */

import { describe, it, expect } from 'vitest';
import {
  SerializationFormat,
  SerializationOptions,
  ChunkModification,
  SerializedWorld,
  SerializedChunk,
  WorldSerializer,
} from '../../../src/world/serialization';
import { ResourceType, StructureType } from '../../../src/world/chunk';

describe('Serialization Data Structures', () => {
  describe('SerializationFormat enum', () => {
    it('should have JSON format', () => {
      expect(SerializationFormat.JSON).toBe('json');
    });

    it('should have BINARY format', () => {
      expect(SerializationFormat.BINARY).toBe('binary');
    });
  });

  describe('SerializationOptions interface', () => {
    it('should create valid options with all fields', () => {
      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: true,
        modifiedOnly: false,
        region: {
          minX: 0,
          minY: 0,
          maxX: 10,
          maxY: 10,
        },
      };

      expect(options.format).toBe(SerializationFormat.JSON);
      expect(options.compress).toBe(true);
      expect(options.modifiedOnly).toBe(false);
      expect(options.region).toBeDefined();
      expect(options.region?.minX).toBe(0);
      expect(options.region?.maxX).toBe(10);
    });

    it('should create valid options without region', () => {
      const options: SerializationOptions = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: true,
      };

      expect(options.format).toBe(SerializationFormat.BINARY);
      expect(options.compress).toBe(false);
      expect(options.modifiedOnly).toBe(true);
      expect(options.region).toBeUndefined();
    });
  });

  describe('ChunkModification interface', () => {
    it('should create valid modification record', () => {
      const modification: ChunkModification = {
        chunkX: 5,
        chunkY: 10,
        timestamp: Date.now(),
        modifiedTiles: new Set([0, 1, 2, 10, 20]),
        heightChanges: new Map([
          [0, 0.5],
          [1, 0.75],
          [2, 0.25],
        ]),
        addedStructures: [
          { x: 5, y: 5, type: StructureType.VILLAGE },
          { x: 10, y: 15, type: StructureType.TOWER },
        ],
        removedStructures: [0, 3],
      };

      expect(modification.chunkX).toBe(5);
      expect(modification.chunkY).toBe(10);
      expect(modification.modifiedTiles.size).toBe(5);
      expect(modification.heightChanges.size).toBe(3);
      expect(modification.addedStructures.length).toBe(2);
      expect(modification.removedStructures.length).toBe(2);
    });

    it('should handle empty modifications', () => {
      const modification: ChunkModification = {
        chunkX: 0,
        chunkY: 0,
        timestamp: Date.now(),
        modifiedTiles: new Set(),
        heightChanges: new Map(),
        addedStructures: [],
        removedStructures: [],
      };

      expect(modification.modifiedTiles.size).toBe(0);
      expect(modification.heightChanges.size).toBe(0);
      expect(modification.addedStructures.length).toBe(0);
      expect(modification.removedStructures.length).toBe(0);
    });
  });

  describe('SerializedChunk interface', () => {
    it('should create valid serialized chunk with string data (JSON format)', () => {
      const chunk: SerializedChunk = {
        x: 3,
        y: 7,
        heightmap: 'base64encodeddata',
        biomeMap: 'base64encodeddata',
        resources: [
          { x: 5, y: 10, type: ResourceType.IRON, amount: 50 },
          { x: 15, y: 20, type: ResourceType.GOLD, amount: 25 },
        ],
        structures: [
          { x: 8, y: 12, type: StructureType.RUINS },
        ],
        rivers: [10, 11, 12, 20, 21],
      };

      expect(chunk.x).toBe(3);
      expect(chunk.y).toBe(7);
      expect(typeof chunk.heightmap).toBe('string');
      expect(typeof chunk.biomeMap).toBe('string');
      expect(chunk.resources.length).toBe(2);
      expect(chunk.structures.length).toBe(1);
      expect(chunk.rivers.length).toBe(5);
    });

    it('should create valid serialized chunk with ArrayBuffer data (binary format)', () => {
      const heightmapBuffer = new ArrayBuffer(1024);
      const biomeMapBuffer = new ArrayBuffer(256);

      const chunk: SerializedChunk = {
        x: 0,
        y: 0,
        heightmap: heightmapBuffer,
        biomeMap: biomeMapBuffer,
        resources: [],
        structures: [],
        rivers: [],
      };

      expect(chunk.heightmap instanceof ArrayBuffer).toBe(true);
      expect(chunk.biomeMap instanceof ArrayBuffer).toBe(true);
      expect(chunk.resources.length).toBe(0);
      expect(chunk.structures.length).toBe(0);
      expect(chunk.rivers.length).toBe(0);
    });
  });

  describe('SerializedWorld interface', () => {
    it('should create valid serialized world', () => {
      const world: SerializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'data1',
            biomeMap: 'data2',
            resources: [],
            structures: [],
            rivers: [],
          },
          {
            x: 1,
            y: 0,
            heightmap: 'data3',
            biomeMap: 'data4',
            resources: [{ x: 5, y: 5, type: ResourceType.COAL, amount: 100 }],
            structures: [],
            rivers: [5, 6, 7],
          },
        ],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set([10]),
            heightChanges: new Map([[10, 0.8]]),
            addedStructures: [],
            removedStructures: [],
          },
        ],
        checksum: 'abc123def456',
      };

      expect(world.version).toBe('1.0.0');
      expect(world.seed).toBe(12345);
      expect(world.config.seed).toBe(12345);
      expect(world.chunks.length).toBe(2);
      expect(world.modifications.length).toBe(1);
      expect(world.checksum).toBe('abc123def456');
    });

    it('should create valid serialized world with no modifications', () => {
      const world: SerializedWorld = {
        version: '1.0.0',
        seed: 99999,
        config: {
          seed: 99999,
          chunkSize: 64,
          maxCacheSize: 50,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        chunks: [],
        modifications: [],
        checksum: 'empty',
      };

      expect(world.chunks.length).toBe(0);
      expect(world.modifications.length).toBe(0);
    });
  });
});


describe('WorldSerializer class', () => {
  describe('constructor', () => {
    it('should create a WorldSerializer instance', () => {
      const serializer = new WorldSerializer();
      expect(serializer).toBeDefined();
      expect(serializer).toBeInstanceOf(WorldSerializer);
    });
  });

  describe('method signatures', () => {
    it('should have serialize method', () => {
      const serializer = new WorldSerializer();
      expect(typeof serializer.serialize).toBe('function');
    });

    it('should have deserialize method', () => {
      const serializer = new WorldSerializer();
      expect(typeof serializer.deserialize).toBe('function');
    });

    it('should have export method', () => {
      const serializer = new WorldSerializer();
      expect(typeof serializer.export).toBe('function');
    });

    it('should have import method', () => {
      const serializer = new WorldSerializer();
      expect(typeof serializer.import).toBe('function');
    });
  });

  describe('JSON serialization', () => {
    it('should serialize a world with chunks to JSON format', () => {
      const serializer = new WorldSerializer();
      
      // Create a mock chunk manager with cache
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4]),
              biomeMap: new Uint8Array([0, 1, 2, 3]),
              biomeWeights: new Float32Array(8),
              resources: [{ x: 5, y: 10, type: ResourceType.IRON, amount: 50 }],
              structures: [{ x: 8, y: 12, type: StructureType.RUINS }],
              rivers: new Set([10, 11, 12]),
            },
            lastAccessed: 1,
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);

      // Verify structure
      expect(result.version).toBe('1.0.0');
      expect(result.seed).toBe(12345);
      expect(result.config.seed).toBe(12345);
      expect(result.chunks.length).toBe(1);
      expect(result.modifications.length).toBe(0);
      // Verify checksum is a valid 8-character hex string (CRC32)
      expect(result.checksum).toMatch(/^[0-9a-f]{8}$/);

      // Verify chunk data
      const chunk = result.chunks[0];
      expect(chunk.x).toBe(0);
      expect(chunk.y).toBe(0);
      expect(typeof chunk.heightmap).toBe('string');
      expect(typeof chunk.biomeMap).toBe('string');
      expect(chunk.resources.length).toBe(1);
      expect(chunk.structures.length).toBe(1);
      expect(chunk.rivers.length).toBe(3);
    });

    it('should serialize with compression enabled', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 99999,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array(1024).fill(0.5),
              biomeMap: new Uint8Array(1024).fill(1),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: true,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);

      expect(result.chunks.length).toBe(1);
      expect(typeof result.chunks[0].heightmap).toBe('string');
      expect(typeof result.chunks[0].biomeMap).toBe('string');
      // Compressed data should be base64 encoded
      expect(result.chunks[0].heightmap.length).toBeGreaterThan(0);
    });

    it('should filter chunks by region', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
          ['5,5,0', {
            chunk: {
              x: 5,
              y: 5,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 2,
          }],
          ['10,10,0', {
            chunk: {
              x: 10,
              y: 10,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 3,
          }],
        ]),
      };

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

      const result = serializer.serialize(mockChunkManager, options);

      // Should only include chunks (0,0) and (5,5), not (10,10)
      expect(result.chunks.length).toBe(2);
      expect(result.chunks.some(c => c.x === 0 && c.y === 0)).toBe(true);
      expect(result.chunks.some(c => c.x === 5 && c.y === 5)).toBe(true);
      expect(result.chunks.some(c => c.x === 10 && c.y === 10)).toBe(false);
    });

    it('should handle empty world', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map(),
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);

      expect(result.chunks.length).toBe(0);
      expect(result.seed).toBe(12345);
      // Verify checksum is a valid 8-character hex string (CRC32)
      expect(result.checksum).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe('binary serialization', () => {
    it('should serialize a world with chunks to binary format', () => {
      const serializer = new WorldSerializer();
      
      // Create a mock chunk manager with cache
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4]),
              biomeMap: new Uint8Array([0, 1, 2, 3]),
              biomeWeights: new Float32Array(8),
              resources: [{ x: 5, y: 10, type: ResourceType.IRON, amount: 50 }],
              structures: [{ x: 8, y: 12, type: StructureType.RUINS }],
              rivers: new Set([10, 11, 12]),
            },
            lastAccessed: 1,
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);

      // Verify structure
      expect(result.version).toBe('1.0.0');
      expect(result.seed).toBe(12345);
      expect(result.config.seed).toBe(12345);
      expect(result.chunks.length).toBe(1);
      expect(result.modifications.length).toBe(0);
      // Verify checksum is a valid 8-character hex string (CRC32)
      expect(result.checksum).toMatch(/^[0-9a-f]{8}$/);

      // Verify chunk data is in binary format
      const chunk = result.chunks[0];
      expect(chunk.x).toBe(0);
      expect(chunk.y).toBe(0);
      expect(chunk.heightmap instanceof ArrayBuffer).toBe(true);
      expect(chunk.biomeMap instanceof ArrayBuffer).toBe(true);
      expect(chunk.resources.length).toBe(1);
      expect(chunk.structures.length).toBe(1);
      expect(chunk.rivers.length).toBe(3);
    });

    it('should serialize with compression enabled', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 99999,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array(1024).fill(0.5),
              biomeMap: new Uint8Array(1024).fill(1),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);

      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0].heightmap instanceof ArrayBuffer).toBe(true);
      expect(result.chunks[0].biomeMap instanceof ArrayBuffer).toBe(true);
      
      // Verify binary format has type markers
      const heightmapView = new DataView(result.chunks[0].heightmap as ArrayBuffer);
      expect(heightmapView.getUint8(0)).toBe(0x01); // Float32Array type marker
      expect(heightmapView.getUint8(1)).toBe(0x01); // Compressed flag
    });

    it('should filter chunks by region', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
          ['5,5,0', {
            chunk: {
              x: 5,
              y: 5,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 2,
          }],
          ['10,10,0', {
            chunk: {
              x: 10,
              y: 10,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 3,
          }],
        ]),
      };

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

      const result = serializer.serialize(mockChunkManager, options);

      // Should only include chunks (0,0) and (5,5), not (10,10)
      expect(result.chunks.length).toBe(2);
      expect(result.chunks.some(c => c.x === 0 && c.y === 0)).toBe(true);
      expect(result.chunks.some(c => c.x === 5 && c.y === 5)).toBe(true);
      expect(result.chunks.some(c => c.x === 10 && c.y === 10)).toBe(false);
    });

    it('should handle empty world', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map(),
      };

      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);

      expect(result.chunks.length).toBe(0);
      expect(result.seed).toBe(12345);
      // Verify checksum is a valid 8-character hex string (CRC32)
      expect(result.checksum).toMatch(/^[0-9a-f]{8}$/);
    });

    it('should include type markers in binary format', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2]),
              biomeMap: new Uint8Array([0, 1]),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);
      const chunk = result.chunks[0];

      // Verify heightmap has Float32Array type marker (0x01)
      const heightmapView = new DataView(chunk.heightmap as ArrayBuffer);
      expect(heightmapView.getUint8(0)).toBe(0x01);
      expect(heightmapView.getUint8(1)).toBe(0x00); // Not compressed
      expect(heightmapView.getUint32(2, true)).toBe(2); // Length = 2

      // Verify biomeMap has Uint8Array type marker (0x02)
      const biomeMapView = new DataView(chunk.biomeMap as ArrayBuffer);
      expect(biomeMapView.getUint8(0)).toBe(0x02);
      expect(biomeMapView.getUint8(1)).toBe(0x00); // Not compressed
      expect(biomeMapView.getUint32(2, true)).toBe(2); // Length = 2
    });
  });

  describe('checksum functionality', () => {
    it('should generate consistent checksums for identical data', () => {
      const serializer = new WorldSerializer();
      const mockChunkManager = {
        config: { seed: 12345, chunkSize: 32 },
        cache: new Map([
          ['0,0', {
            chunk: {
              x: 0,
              y: 0,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4]),
              biomeMap: new Uint8Array([0, 1]),
              resources: [{ type: 0, x: 5, y: 5, amount: 100 }],
              structures: [{ type: 0, x: 10, y: 10, width: 5, height: 5 }],
              rivers: new Set([15]),
            },
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const result1 = serializer.serialize(mockChunkManager, options);
      const result2 = serializer.serialize(mockChunkManager, options);

      // Same data should produce same checksum
      expect(result1.checksum).toBe(result2.checksum);
    });

    it('should generate different checksums for different data', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager1 = {
        config: { seed: 12345, chunkSize: 32 },
        cache: new Map([
          ['0,0', {
            chunk: {
              x: 0,
              y: 0,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4]),
              biomeMap: new Uint8Array([0, 1]),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
          }],
        ]),
      };

      const mockChunkManager2 = {
        config: { seed: 54321, chunkSize: 32 },
        cache: new Map([
          ['0,0', {
            chunk: {
              x: 0,
              y: 0,
              heightmap: new Float32Array([0.5, 0.6, 0.7, 0.8]),
              biomeMap: new Uint8Array([2, 3]),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const result1 = serializer.serialize(mockChunkManager1, options);
      const result2 = serializer.serialize(mockChunkManager2, options);

      // Different data should produce different checksums
      expect(result1.checksum).not.toBe(result2.checksum);
    });

    it('should generate valid hex checksums', () => {
      const serializer = new WorldSerializer();
      const mockChunkManager = {
        config: { seed: 12345, chunkSize: 32 },
        cache: new Map([
          ['0,0', {
            chunk: {
              x: 0,
              y: 0,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4]),
              biomeMap: new Uint8Array([0, 1]),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);

      // Checksum should be 8-character hex string
      expect(result.checksum).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe('stub methods', () => {

    it('should validate version compatibility on deserialize', () => {
      const serializer = new WorldSerializer();
      const data = {
        version: '2.0.0', // Unsupported version
        seed: 12345,
        config: {} as any,
        chunks: [],
        modifications: [],
        checksum: 'test',
      };
      expect(() => serializer.deserialize(data, {} as any)).toThrow('Unsupported serialization version');
    });

    it('should validate checksum on deserialize', () => {
      const serializer = new WorldSerializer();
      const data = {
        version: '1.0.0',
        seed: 12345,
        config: {} as any,
        chunks: [],
        modifications: [],
        checksum: 'invalid',
      };
      expect(() => serializer.deserialize(data, {} as any)).toThrow('Checksum validation failed');
    });

    it('should export to JSON string format', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4]),
              biomeMap: new Uint8Array([0, 1, 2, 3]),
              biomeWeights: new Float32Array(8),
              resources: [{ x: 5, y: 10, type: ResourceType.IRON, amount: 50 }],
              structures: [{ x: 8, y: 12, type: StructureType.RUINS }],
              rivers: new Set([10, 11, 12]),
            },
            lastAccessed: 1,
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.export(mockChunkManager, options);

      // Should return a string for JSON format
      expect(typeof result).toBe('string');
      
      // Should be valid JSON
      const parsed = JSON.parse(result as string);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.seed).toBe(12345);
      expect(parsed.chunks.length).toBe(1);
    });

    it('should export to Blob for binary format', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4]),
              biomeMap: new Uint8Array([0, 1, 2, 3]),
              biomeWeights: new Float32Array(8),
              resources: [{ x: 5, y: 10, type: ResourceType.IRON, amount: 50 }],
              structures: [{ x: 8, y: 12, type: StructureType.RUINS }],
              rivers: new Set([10, 11, 12]),
            },
            lastAccessed: 1,
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.export(mockChunkManager, options);

      // Should return a Blob for binary format
      expect(result instanceof Blob).toBe(true);
      expect((result as Blob).type).toBe('application/octet-stream');
      expect((result as Blob).size).toBeGreaterThan(0);
    });

    it('should export with selective region', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
          ['10,10,0', {
            chunk: {
              x: 10,
              y: 10,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 2,
          }],
        ]),
      };

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

      const result = serializer.export(mockChunkManager, options);
      const parsed = JSON.parse(result as string);

      // Should only include chunk (0,0), not (10,10)
      expect(parsed.chunks.length).toBe(1);
      expect(parsed.chunks[0].x).toBe(0);
      expect(parsed.chunks[0].y).toBe(0);
    });

    it('should include format version metadata in export', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map(),
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.export(mockChunkManager, options);
      const parsed = JSON.parse(result as string);

      // Should include version metadata
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.checksum).toMatch(/^[0-9a-f]{8}$/);
    });

  });

  describe('import functionality', () => {
    it('should import JSON string format', async () => {
      const serializer = new WorldSerializer();
      
      // Create a valid serialized world JSON
      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'AQAAAAAAAAAAAIA/AAAAQAAAQEA=', // base64 encoded Float32Array
            biomeMap: 'AAECAw==', // base64 encoded Uint8Array
            resources: [{ x: 5, y: 10, type: ResourceType.IRON, amount: 50 }],
            structures: [{ x: 8, y: 12, type: StructureType.RUINS }],
            rivers: [10, 11, 12],
          },
        ],
        modifications: [],
        checksum: 'abc12345',
      };

      const jsonString = JSON.stringify(serializedWorld);
      const result = await serializer.import(jsonString, SerializationFormat.JSON);

      expect(result.version).toBe('1.0.0');
      expect(result.seed).toBe(12345);
      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0].x).toBe(0);
      expect(result.chunks[0].y).toBe(0);
      expect(result.modifications.length).toBe(0);
      expect(result.checksum).toBe('abc12345');
    });

    it('should import JSON Blob format', async () => {
      const serializer = new WorldSerializer();
      
      const serializedWorld = {
        version: '1.0.0',
        seed: 54321,
        config: {
          seed: 54321,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        chunks: [],
        modifications: [],
        checksum: 'def67890',
      };

      const jsonString = JSON.stringify(serializedWorld);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const result = await serializer.import(blob, SerializationFormat.JSON);

      expect(result.version).toBe('1.0.0');
      expect(result.seed).toBe(54321);
      expect(result.chunks.length).toBe(0);
      expect(result.checksum).toBe('def67890');
    });

    it('should import JSON with modifications', async () => {
      const serializer = new WorldSerializer();
      
      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        chunks: [],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: 1234567890,
            modifiedTiles: [10, 20, 30],
            heightChanges: { '10': 0.5, '20': 0.75 },
            addedStructures: [{ x: 5, y: 5, type: StructureType.VILLAGE }],
            removedStructures: [0, 1],
          },
        ],
        checksum: 'test1234',
      };

      const jsonString = JSON.stringify(serializedWorld);
      const result = await serializer.import(jsonString, SerializationFormat.JSON);

      expect(result.modifications.length).toBe(1);
      expect(result.modifications[0].chunkX).toBe(0);
      expect(result.modifications[0].chunkY).toBe(0);
      expect(result.modifications[0].modifiedTiles).toBeInstanceOf(Set);
      expect(result.modifications[0].modifiedTiles.size).toBe(3);
      expect(result.modifications[0].heightChanges).toBeInstanceOf(Map);
      expect(result.modifications[0].heightChanges.size).toBe(2);
      expect(result.modifications[0].heightChanges.get(10)).toBe(0.5);
      expect(result.modifications[0].addedStructures.length).toBe(1);
      expect(result.modifications[0].removedStructures.length).toBe(2);
    });

    it('should throw error for invalid JSON', async () => {
      const serializer = new WorldSerializer();
      
      await expect(
        serializer.import('invalid json {', SerializationFormat.JSON)
      ).rejects.toThrow('Invalid JSON format');
    });

    it('should throw error for missing required fields', async () => {
      const serializer = new WorldSerializer();
      
      const invalidData = {
        version: '1.0.0',
        // Missing seed
        config: {},
        chunks: [],
        modifications: [],
        checksum: 'test',
      };

      await expect(
        serializer.import(JSON.stringify(invalidData), SerializationFormat.JSON)
      ).rejects.toThrow('Invalid serialized world');
    });

    it('should throw error for invalid chunk structure', async () => {
      const serializer = new WorldSerializer();
      
      const invalidData = {
        version: '1.0.0',
        seed: 12345,
        config: {},
        chunks: [
          {
            // Missing x coordinate
            y: 0,
            heightmap: 'data',
            biomeMap: 'data',
            resources: [],
            structures: [],
            rivers: [],
          },
        ],
        modifications: [],
        checksum: 'test',
      };

      await expect(
        serializer.import(JSON.stringify(invalidData), SerializationFormat.JSON)
      ).rejects.toThrow('Invalid chunk');
    });

    it('should import binary Blob format', async () => {
      const serializer = new WorldSerializer();
      
      // First export to binary to get valid binary data
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4]),
              biomeMap: new Uint8Array([0, 1, 2, 3]),
              biomeWeights: new Float32Array(8),
              resources: [{ x: 5, y: 10, type: ResourceType.IRON, amount: 50 }],
              structures: [{ x: 8, y: 12, type: StructureType.RUINS }],
              rivers: new Set([10, 11, 12]),
            },
            lastAccessed: 1,
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const blob = serializer.export(mockChunkManager, options) as Blob;
      const result = await serializer.import(blob, SerializationFormat.BINARY);

      expect(result.version).toBe('1.0.0');
      expect(result.seed).toBe(12345);
      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0].x).toBe(0);
      expect(result.chunks[0].y).toBe(0);
      expect(result.chunks[0].heightmap).toBeInstanceOf(ArrayBuffer);
      expect(result.chunks[0].biomeMap).toBeInstanceOf(ArrayBuffer);
    });

    it('should throw error for invalid binary magic number', async () => {
      const serializer = new WorldSerializer();
      
      // Create invalid binary data with wrong magic number
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setUint32(0, 0x12345678, true); // Wrong magic number
      
      const blob = new Blob([buffer]);
      
      await expect(
        serializer.import(blob, SerializationFormat.BINARY)
      ).rejects.toThrow('Invalid binary format: magic number mismatch');
    });

    it('should throw error for unsupported format', async () => {
      const serializer = new WorldSerializer();
      
      await expect(
        serializer.import('{}', 'unsupported' as SerializationFormat)
      ).rejects.toThrow('Unsupported import format');
    });

    it('should handle round-trip export and import for JSON', async () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 99999,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4]),
              biomeMap: new Uint8Array([0, 1, 2, 3]),
              biomeWeights: new Float32Array(8),
              resources: [{ x: 5, y: 10, type: ResourceType.IRON, amount: 50 }],
              structures: [{ x: 8, y: 12, type: StructureType.RUINS }],
              rivers: new Set([10, 11, 12]),
            },
            lastAccessed: 1,
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      // Export
      const exported = serializer.export(mockChunkManager, options) as string;
      
      // Import
      const imported = await serializer.import(exported, SerializationFormat.JSON);

      // Verify data integrity
      expect(imported.version).toBe('1.0.0');
      expect(imported.seed).toBe(99999);
      expect(imported.chunks.length).toBe(1);
      expect(imported.chunks[0].x).toBe(0);
      expect(imported.chunks[0].y).toBe(0);
      expect(imported.chunks[0].resources.length).toBe(1);
      expect(imported.chunks[0].structures.length).toBe(1);
      expect(imported.chunks[0].rivers.length).toBe(3);
    });

    it('should handle round-trip export and import for binary', async () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 77777,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.5, 0.6, 0.7, 0.8]),
              biomeMap: new Uint8Array([2, 3, 4, 5]),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      // Export
      const exported = serializer.export(mockChunkManager, options) as Blob;
      
      // Import
      const imported = await serializer.import(exported, SerializationFormat.BINARY);

      // Verify data integrity
      expect(imported.version).toBe('1.0.0');
      expect(imported.seed).toBe(77777);
      expect(imported.chunks.length).toBe(1);
      expect(imported.chunks[0].x).toBe(0);
      expect(imported.chunks[0].y).toBe(0);
      expect(imported.chunks[0].heightmap).toBeInstanceOf(ArrayBuffer);
      expect(imported.chunks[0].biomeMap).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('serialization edge cases', () => {
    describe('empty world', () => {
      it('should serialize empty world to JSON', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map(),
        };

        const options = {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
        };

        const result = serializer.serialize(mockChunkManager, options);

        expect(result.version).toBe('1.0.0');
        expect(result.seed).toBe(12345);
        expect(result.chunks.length).toBe(0);
        expect(result.modifications.length).toBe(0);
        expect(result.checksum).toMatch(/^[0-9a-f]{8}$/);
      });

      it('should serialize empty world to binary', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 54321,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map(),
        };

        const options = {
          format: SerializationFormat.BINARY,
          compress: false,
          modifiedOnly: false,
        };

        const result = serializer.serialize(mockChunkManager, options);

        expect(result.version).toBe('1.0.0');
        expect(result.seed).toBe(54321);
        expect(result.chunks.length).toBe(0);
        expect(result.modifications.length).toBe(0);
        expect(result.checksum).toMatch(/^[0-9a-f]{8}$/);
      });

      it('should deserialize empty world from JSON', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map(),
          accessCounter: 0,
        };

        const options = {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
        };

        const serialized = serializer.serialize(mockChunkManager, options);
        
        // Clear cache and deserialize
        mockChunkManager.cache.clear();
        serializer.deserialize(serialized, mockChunkManager);

        expect(mockChunkManager.cache.size).toBe(0);
      });

      it('should round-trip empty world through export/import', async () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 99999,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map(),
        };

        const options = {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
        };

        const exported = serializer.export(mockChunkManager, options) as string;
        const imported = await serializer.import(exported, SerializationFormat.JSON);

        expect(imported.seed).toBe(99999);
        expect(imported.chunks.length).toBe(0);
        expect(imported.modifications.length).toBe(0);
      });
    });

    describe('world with no chunks in cache', () => {
      it('should handle world with initialized but empty cache', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 11111,
            chunkSize: 64,
            maxCacheSize: 200,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map(),
        };

        const options = {
          format: SerializationFormat.JSON,
          compress: true,
          modifiedOnly: false,
        };

        const result = serializer.serialize(mockChunkManager, options);

        expect(result.chunks).toEqual([]);
        expect(result.config.chunkSize).toBe(64);
        expect(result.config.maxCacheSize).toBe(200);
      });

      it('should export world with no chunks to JSON string', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 22222,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map(),
        };

        const options = {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
        };

        const result = serializer.export(mockChunkManager, options);

        expect(typeof result).toBe('string');
        const parsed = JSON.parse(result as string);
        expect(parsed.chunks).toEqual([]);
        expect(parsed.seed).toBe(22222);
      });

      it('should export world with no chunks to binary Blob', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 33333,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map(),
        };

        const options = {
          format: SerializationFormat.BINARY,
          compress: false,
          modifiedOnly: false,
        };

        const result = serializer.export(mockChunkManager, options);

        expect(result instanceof Blob).toBe(true);
        expect((result as Blob).size).toBeGreaterThan(0);
      });
    });

    describe('selective region export', () => {
      it('should filter chunks by region boundaries', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map([
            ['0,0,0', {
              chunk: {
                x: 0,
                y: 0,
                size: 32,
                heightmap: new Float32Array(4),
                biomeMap: new Uint8Array(4),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 1,
            }],
            ['5,5,0', {
              chunk: {
                x: 5,
                y: 5,
                size: 32,
                heightmap: new Float32Array(4),
                biomeMap: new Uint8Array(4),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 2,
            }],
            ['10,10,0', {
              chunk: {
                x: 10,
                y: 10,
                size: 32,
                heightmap: new Float32Array(4),
                biomeMap: new Uint8Array(4),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 3,
            }],
            ['-5,-5,0', {
              chunk: {
                x: -5,
                y: -5,
                size: 32,
                heightmap: new Float32Array(4),
                biomeMap: new Uint8Array(4),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 4,
            }],
          ]),
        };

        const options = {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
          region: {
            minX: 0,
            minY: 0,
            maxX: 7,
            maxY: 7,
          },
        };

        const result = serializer.serialize(mockChunkManager, options);

        // Should include (0,0) and (5,5), but not (10,10) or (-5,-5)
        expect(result.chunks.length).toBe(2);
        expect(result.chunks.some(c => c.x === 0 && c.y === 0)).toBe(true);
        expect(result.chunks.some(c => c.x === 5 && c.y === 5)).toBe(true);
        expect(result.chunks.some(c => c.x === 10 && c.y === 10)).toBe(false);
        expect(result.chunks.some(c => c.x === -5 && c.y === -5)).toBe(false);
      });

      it('should handle region with no matching chunks', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map([
            ['0,0,0', {
              chunk: {
                x: 0,
                y: 0,
                size: 32,
                heightmap: new Float32Array(4),
                biomeMap: new Uint8Array(4),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 1,
            }],
          ]),
        };

        const options = {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
          region: {
            minX: 100,
            minY: 100,
            maxX: 200,
            maxY: 200,
          },
        };

        const result = serializer.serialize(mockChunkManager, options);

        expect(result.chunks.length).toBe(0);
      });

      it('should export selective region correctly', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map([
            ['0,0,0', {
              chunk: {
                x: 0,
                y: 0,
                size: 32,
                heightmap: new Float32Array(4),
                biomeMap: new Uint8Array(4),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 1,
            }],
            ['20,20,0', {
              chunk: {
                x: 20,
                y: 20,
                size: 32,
                heightmap: new Float32Array(4),
                biomeMap: new Uint8Array(4),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 2,
            }],
          ]),
        };

        const options = {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
          region: {
            minX: -5,
            minY: -5,
            maxX: 5,
            maxY: 5,
          },
        };

        const exported = serializer.export(mockChunkManager, options) as string;
        const parsed = JSON.parse(exported);

        expect(parsed.chunks.length).toBe(1);
        expect(parsed.chunks[0].x).toBe(0);
        expect(parsed.chunks[0].y).toBe(0);
      });
    });

    describe('version incompatibility handling', () => {
      it('should throw error for unsupported version on deserialize', () => {
        const serializer = new WorldSerializer();
        
        const data = {
          version: '2.0.0',
          seed: 12345,
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          chunks: [],
          modifications: [],
          checksum: '00000000',
        };

        const mockChunkManager = {
          config: data.config,
          cache: new Map(),
          accessCounter: 0,
        };

        expect(() => serializer.deserialize(data, mockChunkManager)).toThrow(
          'Unsupported serialization version: 2.0.0. Expected 1.0.0'
        );
      });

      it('should throw error for future version', () => {
        const serializer = new WorldSerializer();
        
        const data = {
          version: '99.99.99',
          seed: 12345,
          config: {} as any,
          chunks: [],
          modifications: [],
          checksum: '00000000',
        };

        const mockChunkManager = {
          config: {} as any,
          cache: new Map(),
          accessCounter: 0,
        };

        expect(() => serializer.deserialize(data, mockChunkManager)).toThrow(
          'Unsupported serialization version'
        );
      });

      it('should throw error for invalid version format', () => {
        const serializer = new WorldSerializer();
        
        const data = {
          version: 'invalid',
          seed: 12345,
          config: {} as any,
          chunks: [],
          modifications: [],
          checksum: '00000000',
        };

        const mockChunkManager = {
          config: {} as any,
          cache: new Map(),
          accessCounter: 0,
        };

        expect(() => serializer.deserialize(data, mockChunkManager)).toThrow(
          'Unsupported serialization version'
        );
      });

      it('should accept current version 1.0.0', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map(),
          accessCounter: 0,
        };

        const serialized = serializer.serialize(mockChunkManager, {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
        });

        expect(() => serializer.deserialize(serialized, mockChunkManager)).not.toThrow();
      });
    });

    describe('checksum mismatch handling', () => {
      it('should throw error for invalid checksum', () => {
        const serializer = new WorldSerializer();
        
        const data = {
          version: '1.0.0',
          seed: 12345,
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          chunks: [],
          modifications: [],
          checksum: 'ffffffff',
        };

        const mockChunkManager = {
          config: data.config,
          cache: new Map(),
          accessCounter: 0,
        };

        expect(() => serializer.deserialize(data, mockChunkManager)).toThrow(
          'Checksum validation failed. Data may be corrupted.'
        );
      });

      it('should throw error for corrupted chunk data', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map([
            ['0,0,0', {
              chunk: {
                x: 0,
                y: 0,
                size: 32,
                heightmap: new Float32Array([0.1, 0.2]),
                biomeMap: new Uint8Array([0, 1]),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 1,
            }],
          ]),
          accessCounter: 0,
        };

        const serialized = serializer.serialize(mockChunkManager, {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
        });

        // Corrupt the checksum
        serialized.checksum = '12345678';

        expect(() => serializer.deserialize(serialized, mockChunkManager)).toThrow(
          'Checksum validation failed'
        );
      });

      it('should detect modified data through checksum', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map([
            ['0,0,0', {
              chunk: {
                x: 0,
                y: 0,
                size: 32,
                heightmap: new Float32Array([0.5]),
                biomeMap: new Uint8Array([1]),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 1,
            }],
          ]),
          accessCounter: 0,
        };

        const serialized = serializer.serialize(mockChunkManager, {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
        });

        // Modify the seed (simulating data corruption)
        serialized.seed = 99999;

        expect(() => serializer.deserialize(serialized, mockChunkManager)).toThrow(
          'Checksum validation failed'
        );
      });

      it('should pass validation for unmodified data', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map([
            ['0,0,0', {
              chunk: {
                x: 0,
                y: 0,
                size: 32,
                heightmap: new Float32Array([0.1, 0.2]),
                biomeMap: new Uint8Array([0, 1]),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 1,
            }],
          ]),
          accessCounter: 0,
        };

        const serialized = serializer.serialize(mockChunkManager, {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
        });

        expect(() => serializer.deserialize(serialized, mockChunkManager)).not.toThrow();
      });
    });

    describe('compression edge cases', () => {
      it('should handle compression of empty data', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map(),
        };

        const options = {
          format: SerializationFormat.JSON,
          compress: true,
          modifiedOnly: false,
        };

        const result = serializer.serialize(mockChunkManager, options);

        expect(result.chunks.length).toBe(0);
        expect(result.checksum).toMatch(/^[0-9a-f]{8}$/);
      });

      it('should handle compression of very small chunks', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map([
            ['0,0,0', {
              chunk: {
                x: 0,
                y: 0,
                size: 32,
                heightmap: new Float32Array([0.5]),
                biomeMap: new Uint8Array([1]),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 1,
            }],
          ]),
        };

        const options = {
          format: SerializationFormat.JSON,
          compress: true,
          modifiedOnly: false,
        };

        const result = serializer.serialize(mockChunkManager, options);

        expect(result.chunks.length).toBe(1);
        expect(typeof result.chunks[0].heightmap).toBe('string');
        expect(typeof result.chunks[0].biomeMap).toBe('string');
      });

      it('should handle decompression of compressed data', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map([
            ['0,0,0', {
              chunk: {
                x: 0,
                y: 0,
                size: 32,
                heightmap: new Float32Array(1024).fill(0.5),
                biomeMap: new Uint8Array(1024).fill(1),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 1,
            }],
          ]),
          accessCounter: 0,
        };

        const serialized = serializer.serialize(mockChunkManager, {
          format: SerializationFormat.JSON,
          compress: true,
          modifiedOnly: false,
        });

        mockChunkManager.cache.clear();
        
        expect(() => serializer.deserialize(serialized, mockChunkManager)).not.toThrow();
        expect(mockChunkManager.cache.size).toBe(1);
      });

      it('should handle binary compression', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map([
            ['0,0,0', {
              chunk: {
                x: 0,
                y: 0,
                size: 32,
                heightmap: new Float32Array(1024).fill(0.7),
                biomeMap: new Uint8Array(1024).fill(2),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 1,
            }],
          ]),
        };

        const options = {
          format: SerializationFormat.BINARY,
          compress: true,
          modifiedOnly: false,
        };

        const result = serializer.serialize(mockChunkManager, options);

        expect(result.chunks.length).toBe(1);
        expect(result.chunks[0].heightmap instanceof ArrayBuffer).toBe(true);
        expect(result.chunks[0].biomeMap instanceof ArrayBuffer).toBe(true);
        
        // Verify compression flag is set
        const heightmapView = new DataView(result.chunks[0].heightmap as ArrayBuffer);
        expect(heightmapView.getUint8(1)).toBe(0x01); // Compressed flag
      });

      it('should round-trip compressed data correctly', () => {
        const serializer = new WorldSerializer();
        
        const mockChunkManager = {
          config: {
            seed: 12345,
            chunkSize: 32,
            maxCacheSize: 100,
            terrainConfig: {} as any,
            biomeConfig: {} as any,
            resourceConfig: {} as any,
            structureConfig: {} as any,
            riverConfig: {} as any,
          },
          cache: new Map([
            ['0,0,0', {
              chunk: {
                x: 0,
                y: 0,
                size: 32,
                heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
                biomeMap: new Uint8Array([0, 1, 2, 3, 4]),
                biomeWeights: new Float32Array(8),
                resources: [],
                structures: [],
                rivers: new Set(),
              },
              lastAccessed: 1,
            }],
          ]),
          accessCounter: 0,
        };

        const serialized = serializer.serialize(mockChunkManager, {
          format: SerializationFormat.JSON,
          compress: true,
          modifiedOnly: false,
        });

        mockChunkManager.cache.clear();
        serializer.deserialize(serialized, mockChunkManager);

        expect(mockChunkManager.cache.size).toBe(1);
        const entry = mockChunkManager.cache.get('0,0,0');
        expect(entry).toBeDefined();
        expect(entry.chunk.heightmap.length).toBe(5);
        expect(entry.chunk.biomeMap.length).toBe(5);
      });
    });
  });

  describe('modification tracking integration', () => {
    it('should serialize modifications from ChunkManager', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4]),
              biomeMap: new Uint8Array([0, 1, 2, 3]),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
        modifications: new Map([
          ['0,0', {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set([10, 20, 30]),
            heightChanges: new Map([[10, 0.75], [20, 0.85]]),
            addedStructures: [{ x: 5, y: 5, type: StructureType.VILLAGE }],
            removedStructures: [0],
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);

      // Verify modifications are included
      expect(result.modifications.length).toBe(1);
      expect(result.modifications[0].chunkX).toBe(0);
      expect(result.modifications[0].chunkY).toBe(0);
      expect(result.modifications[0].modifiedTiles.size).toBe(3);
      expect(result.modifications[0].heightChanges.size).toBe(2);
      expect(result.modifications[0].addedStructures.length).toBe(1);
      expect(result.modifications[0].removedStructures.length).toBe(1);
    });

    it('should filter modifications by region', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map(),
        modifications: new Map([
          ['0,0', {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set([10]),
            heightChanges: new Map([[10, 0.75]]),
            addedStructures: [],
            removedStructures: [],
          }],
          ['5,5', {
            chunkX: 5,
            chunkY: 5,
            timestamp: Date.now(),
            modifiedTiles: new Set([20]),
            heightChanges: new Map([[20, 0.85]]),
            addedStructures: [],
            removedStructures: [],
          }],
          ['10,10', {
            chunkX: 10,
            chunkY: 10,
            timestamp: Date.now(),
            modifiedTiles: new Set([30]),
            heightChanges: new Map([[30, 0.95]]),
            addedStructures: [],
            removedStructures: [],
          }],
        ]),
      };

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

      const result = serializer.serialize(mockChunkManager, options);

      // Should only include modifications for chunks (0,0) and (5,5), not (10,10)
      expect(result.modifications.length).toBe(2);
      expect(result.modifications.some(m => m.chunkX === 0 && m.chunkY === 0)).toBe(true);
      expect(result.modifications.some(m => m.chunkX === 5 && m.chunkY === 5)).toBe(true);
      expect(result.modifications.some(m => m.chunkX === 10 && m.chunkY === 10)).toBe(false);
    });

    it('should serialize modifications in binary format', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map(),
        modifications: new Map([
          ['0,0', {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set([10, 20]),
            heightChanges: new Map([[10, 0.75], [20, 0.85]]),
            addedStructures: [{ x: 5, y: 5, type: StructureType.TOWER }],
            removedStructures: [1, 2],
          }],
        ]),
      };

      const options = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);

      // Verify modifications are included
      expect(result.modifications.length).toBe(1);
      expect(result.modifications[0].chunkX).toBe(0);
      expect(result.modifications[0].chunkY).toBe(0);
      expect(result.modifications[0].modifiedTiles.size).toBe(2);
      expect(result.modifications[0].heightChanges.size).toBe(2);
      expect(result.modifications[0].addedStructures.length).toBe(1);
      expect(result.modifications[0].removedStructures.length).toBe(2);
    });

    it('should handle ChunkManager without modifications property', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map(),
        // No modifications property
      };

      const options = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const result = serializer.serialize(mockChunkManager, options);

      // Should return empty modifications array
      expect(result.modifications.length).toBe(0);
    });
  });
});

describe('Modification Application on Deserialization', () => {
  describe('applyModifications', () => {
    it('should apply height changes to chunk heightmap', () => {
      const serializer = new WorldSerializer();
      
      // Create a chunk manager with a chunk
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map(),
        accessCounter: 0,
        modifications: new Map(),
        recordModification: function(chunkX: number, chunkY: number, modification: ChunkModification) {
          this.modifications.set(`${chunkX},${chunkY}`, modification);
        },
      };

      // Create serialized world with modifications
      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: mockChunkManager.config,
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'zczMPM3MTD2amZk9zczMPQ==', // [0.1, 0.2, 0.3, 0.4, 0.5] as Float32Array
            biomeMap: 'AAECAwQ=', // [0, 1, 2, 3, 4] as Uint8Array
            resources: [],
            structures: [],
            rivers: [],
          },
        ],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set([1, 3]),
            heightChanges: new Map([[1, 0.75], [3, 0.85]]),
            addedStructures: [],
            removedStructures: [],
          },
        ],
        checksum: '',
      };

      // Calculate valid checksum
      serializedWorld.checksum = (serializer as any).calculateChecksum(serializedWorld);

      // Deserialize (which should apply modifications)
      serializer.deserialize(serializedWorld, mockChunkManager);

      // Verify height changes were applied
      const chunk = mockChunkManager.cache.get('0,0,0')?.chunk;
      expect(chunk).toBeDefined();
      // Check that the modified indices have the new values
      expect(chunk.heightmap[1]).toBeCloseTo(0.75, 5);
      expect(chunk.heightmap[3]).toBeCloseTo(0.85, 5);
      // Verify heightmap has expected length
      expect(chunk.heightmap.length).toBeGreaterThan(3);
    });

    it('should apply structure additions to chunk', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [
                { x: 10, y: 10, type: StructureType.RUINS },
              ],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
        accessCounter: 1,
        modifications: new Map(),
        recordModification: function(chunkX: number, chunkY: number, modification: ChunkModification) {
          this.modifications.set(`${chunkX},${chunkY}`, modification);
        },
      };

      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: mockChunkManager.config,
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'AQAAAAAAAAAAAIA/AAAAQAAAQEA=',
            biomeMap: 'AAECAw==',
            resources: [],
            structures: [{ x: 10, y: 10, type: StructureType.RUINS }],
            rivers: [],
          },
        ],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set(),
            heightChanges: new Map(),
            addedStructures: [
              { x: 5, y: 5, type: StructureType.VILLAGE },
              { x: 15, y: 15, type: StructureType.TOWER },
            ],
            removedStructures: [],
          },
        ],
        checksum: '',
      };

      serializedWorld.checksum = (serializer as any).calculateChecksum(serializedWorld);

      serializer.deserialize(serializedWorld, mockChunkManager);

      const chunk = mockChunkManager.cache.get('0,0,0')?.chunk;
      expect(chunk).toBeDefined();
      expect(chunk.structures.length).toBe(3); // 1 original + 2 added
      expect(chunk.structures.some((s: any) => s.x === 5 && s.y === 5 && s.type === StructureType.VILLAGE)).toBe(true);
      expect(chunk.structures.some((s: any) => s.x === 15 && s.y === 15 && s.type === StructureType.TOWER)).toBe(true);
    });

    it('should apply structure removals from chunk', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [
                { x: 5, y: 5, type: StructureType.VILLAGE },
                { x: 10, y: 10, type: StructureType.RUINS },
                { x: 15, y: 15, type: StructureType.TOWER },
              ],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
        accessCounter: 1,
        modifications: new Map(),
        recordModification: function(chunkX: number, chunkY: number, modification: ChunkModification) {
          this.modifications.set(`${chunkX},${chunkY}`, modification);
        },
      };

      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: mockChunkManager.config,
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'AQAAAAAAAAAAAIA/AAAAQAAAQEA=',
            biomeMap: 'AAECAw==',
            resources: [],
            structures: [
              { x: 5, y: 5, type: StructureType.VILLAGE },
              { x: 10, y: 10, type: StructureType.RUINS },
              { x: 15, y: 15, type: StructureType.TOWER },
            ],
            rivers: [],
          },
        ],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set(),
            heightChanges: new Map(),
            addedStructures: [],
            removedStructures: [0, 2], // Remove first and third structures
          },
        ],
        checksum: '',
      };

      serializedWorld.checksum = (serializer as any).calculateChecksum(serializedWorld);

      serializer.deserialize(serializedWorld, mockChunkManager);

      const chunk = mockChunkManager.cache.get('0,0,0')?.chunk;
      expect(chunk).toBeDefined();
      expect(chunk.structures.length).toBe(1); // Only middle structure remains
      expect(chunk.structures[0].x).toBe(10);
      expect(chunk.structures[0].y).toBe(10);
      expect(chunk.structures[0].type).toBe(StructureType.RUINS);
    });

    it('should preserve modification timestamps', () => {
      const serializer = new WorldSerializer();
      
      const timestamp = 1234567890;
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
        accessCounter: 1,
        modifications: new Map(),
        recordModification: function(chunkX: number, chunkY: number, modification: ChunkModification) {
          this.modifications.set(`${chunkX},${chunkY}`, modification);
        },
      };

      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: mockChunkManager.config,
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'AQAAAAAAAAAAAIA/AAAAQAAAQEA=',
            biomeMap: 'AAECAw==',
            resources: [],
            structures: [],
            rivers: [],
          },
        ],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: timestamp,
            modifiedTiles: new Set([10]),
            heightChanges: new Map([[10, 0.5]]),
            addedStructures: [],
            removedStructures: [],
          },
        ],
        checksum: '',
      };

      serializedWorld.checksum = (serializer as any).calculateChecksum(serializedWorld);

      serializer.deserialize(serializedWorld, mockChunkManager);

      // Verify modification was recorded with timestamp
      const modification = mockChunkManager.modifications.get('0,0');
      expect(modification).toBeDefined();
      expect(modification.timestamp).toBe(timestamp);
    });

    it('should apply multiple modifications to same chunk', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
              biomeMap: new Uint8Array(5),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [
                { x: 10, y: 10, type: StructureType.RUINS },
              ],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
        accessCounter: 1,
        modifications: new Map(),
        recordModification: function(chunkX: number, chunkY: number, modification: ChunkModification) {
          this.modifications.set(`${chunkX},${chunkY}`, modification);
        },
      };

      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: mockChunkManager.config,
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'AQAAAAAAAAAAAIA/AAAAQAAAQEA=',
            biomeMap: 'AAECAw==',
            resources: [],
            structures: [{ x: 10, y: 10, type: StructureType.RUINS }],
            rivers: [],
          },
        ],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set([1, 3]),
            heightChanges: new Map([[1, 0.75], [3, 0.85]]),
            addedStructures: [{ x: 5, y: 5, type: StructureType.VILLAGE }],
            removedStructures: [0],
          },
        ],
        checksum: '',
      };

      serializedWorld.checksum = (serializer as any).calculateChecksum(serializedWorld);

      serializer.deserialize(serializedWorld, mockChunkManager);

      const chunk = mockChunkManager.cache.get('0,0,0')?.chunk;
      expect(chunk).toBeDefined();
      
      // Verify height changes
      expect(chunk.heightmap[1]).toBeCloseTo(0.75, 5);
      expect(chunk.heightmap[3]).toBeCloseTo(0.85, 5);
      
      // Verify structure changes
      expect(chunk.structures.length).toBe(1); // 1 original removed, 1 added
      expect(chunk.structures[0].x).toBe(5);
      expect(chunk.structures[0].type).toBe(StructureType.VILLAGE);
    });

    it('should handle modifications for multiple chunks', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2]),
              biomeMap: new Uint8Array(2),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
          ['1,1,0', {
            chunk: {
              x: 1,
              y: 1,
              size: 32,
              heightmap: new Float32Array([0.3, 0.4]),
              biomeMap: new Uint8Array(2),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 2,
          }],
        ]),
        accessCounter: 2,
        modifications: new Map(),
        recordModification: function(chunkX: number, chunkY: number, modification: ChunkModification) {
          this.modifications.set(`${chunkX},${chunkY}`, modification);
        },
      };

      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: mockChunkManager.config,
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'AQAAAAAAAAAAAIA/',
            biomeMap: 'AAE=',
            resources: [],
            structures: [],
            rivers: [],
          },
          {
            x: 1,
            y: 1,
            heightmap: 'AQAAAAAAAAAAAIA/',
            biomeMap: 'AAE=',
            resources: [],
            structures: [],
            rivers: [],
          },
        ],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set([0]),
            heightChanges: new Map([[0, 0.9]]),
            addedStructures: [],
            removedStructures: [],
          },
          {
            chunkX: 1,
            chunkY: 1,
            timestamp: Date.now(),
            modifiedTiles: new Set([1]),
            heightChanges: new Map([[1, 0.95]]),
            addedStructures: [],
            removedStructures: [],
          },
        ],
        checksum: '',
      };

      serializedWorld.checksum = (serializer as any).calculateChecksum(serializedWorld);

      serializer.deserialize(serializedWorld, mockChunkManager);

      // Verify modifications were applied to both chunks
      const chunk1 = mockChunkManager.cache.get('0,0,0')?.chunk;
      expect(chunk1).toBeDefined();
      expect(chunk1.heightmap[0]).toBeCloseTo(0.9, 5);

      const chunk2 = mockChunkManager.cache.get('1,1,0')?.chunk;
      expect(chunk2).toBeDefined();
      expect(chunk2.heightmap[1]).toBeCloseTo(0.95, 5);
    });

    it('should skip modifications for chunks not in cache', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array([0.1, 0.2]),
              biomeMap: new Uint8Array(2),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
        accessCounter: 1,
        modifications: new Map(),
        recordModification: function(chunkX: number, chunkY: number, modification: ChunkModification) {
          this.modifications.set(`${chunkX},${chunkY}`, modification);
        },
      };

      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: mockChunkManager.config,
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'AQAAAAAAAAAAAIA/',
            biomeMap: 'AAE=',
            resources: [],
            structures: [],
            rivers: [],
          },
        ],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set([0]),
            heightChanges: new Map([[0, 0.9]]),
            addedStructures: [],
            removedStructures: [],
          },
          {
            chunkX: 5,
            chunkY: 5,
            timestamp: Date.now(),
            modifiedTiles: new Set([0]),
            heightChanges: new Map([[0, 0.5]]),
            addedStructures: [],
            removedStructures: [],
          },
        ],
        checksum: '',
      };

      serializedWorld.checksum = (serializer as any).calculateChecksum(serializedWorld);

      // Should not throw error, just skip the missing chunk
      expect(() => serializer.deserialize(serializedWorld, mockChunkManager)).not.toThrow();

      // Verify modification was applied to existing chunk
      const chunk = mockChunkManager.cache.get('0,0,0')?.chunk;
      expect(chunk).toBeDefined();
      expect(chunk.heightmap[0]).toBeCloseTo(0.9, 5);
    });

    it('should handle invalid tile indices gracefully', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map(),
        accessCounter: 0,
        modifications: new Map(),
        recordModification: function(chunkX: number, chunkY: number, modification: ChunkModification) {
          this.modifications.set(`${chunkX},${chunkY}`, modification);
        },
      };

      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: mockChunkManager.config,
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'zczMPM3MTD2amZk9', // [0.1, 0.2, 0.3] as Float32Array
            biomeMap: 'AAEC', // [0, 1, 2] as Uint8Array
            resources: [],
            structures: [],
            rivers: [],
          },
        ],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set([1, 999]), // 999 is out of bounds
            heightChanges: new Map([[1, 0.75], [999, 0.5]]),
            addedStructures: [],
            removedStructures: [],
          },
        ],
        checksum: '',
      };

      serializedWorld.checksum = (serializer as any).calculateChecksum(serializedWorld);

      // Should not throw error, just skip invalid indices
      expect(() => serializer.deserialize(serializedWorld, mockChunkManager)).not.toThrow();

      const chunk = mockChunkManager.cache.get('0,0,0')?.chunk;
      expect(chunk).toBeDefined();
      expect(chunk.heightmap[1]).toBeCloseTo(0.75, 5); // Valid index applied
      // Verify heightmap has expected length
      expect(chunk.heightmap.length).toBeGreaterThan(1);
    });

    it('should handle invalid structure indices gracefully', () => {
      const serializer = new WorldSerializer();
      
      const mockChunkManager = {
        config: {
          seed: 12345,
          chunkSize: 32,
          maxCacheSize: 100,
          terrainConfig: {} as any,
          biomeConfig: {} as any,
          resourceConfig: {} as any,
          structureConfig: {} as any,
          riverConfig: {} as any,
        },
        cache: new Map([
          ['0,0,0', {
            chunk: {
              x: 0,
              y: 0,
              size: 32,
              heightmap: new Float32Array(4),
              biomeMap: new Uint8Array(4),
              biomeWeights: new Float32Array(8),
              resources: [],
              structures: [
                { x: 5, y: 5, type: StructureType.VILLAGE },
              ],
              rivers: new Set(),
            },
            lastAccessed: 1,
          }],
        ]),
        accessCounter: 1,
        modifications: new Map(),
        recordModification: function(chunkX: number, chunkY: number, modification: ChunkModification) {
          this.modifications.set(`${chunkX},${chunkY}`, modification);
        },
      };

      const serializedWorld = {
        version: '1.0.0',
        seed: 12345,
        config: mockChunkManager.config,
        chunks: [
          {
            x: 0,
            y: 0,
            heightmap: 'AQAAAAAAAAAAAIA/',
            biomeMap: 'AAE=',
            resources: [],
            structures: [{ x: 5, y: 5, type: StructureType.VILLAGE }],
            rivers: [],
          },
        ],
        modifications: [
          {
            chunkX: 0,
            chunkY: 0,
            timestamp: Date.now(),
            modifiedTiles: new Set(),
            heightChanges: new Map(),
            addedStructures: [],
            removedStructures: [999], // Out of bounds
          },
        ],
        checksum: '',
      };

      serializedWorld.checksum = (serializer as any).calculateChecksum(serializedWorld);

      // Should not throw error, just skip invalid indices
      expect(() => serializer.deserialize(serializedWorld, mockChunkManager)).not.toThrow();

      const chunk = mockChunkManager.cache.get('0,0,0')?.chunk;
      expect(chunk).toBeDefined();
      expect(chunk.structures.length).toBe(1); // Structure not removed
    });
  });
});
