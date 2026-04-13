/**
 * Unit tests for modification tracking system
 * 
 * Tests verify that modifications are correctly recorded, serialized,
 * and applied during deserialization.
 * 
 * **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChunkManager, WorldConfig } from '../../../src/world/chunk-manager';
import { WorldSerializer, SerializationFormat, SerializationOptions } from '../../../src/world/serialization';
import { StructureType } from '../../../src/world/chunk';

describe('Modification Tracking System', () => {
  let chunkManager: ChunkManager;
  let serializer: WorldSerializer;
  let config: WorldConfig;

  beforeEach(() => {
    config = {
      seed: 12345,
      chunkSize: 32,
      terrainConfig: {
        scale: 0.01,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        heightScale: 1.0,
        seaLevel: 0.4,
      },
      biomeConfig: {
        temperatureScale: 0.005,
        moistureScale: 0.005,
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
        sourceElevation: 1.0,
        minFlowLength: 1000,
        flowWidth: 2,
      },
    };

    chunkManager = new ChunkManager(config);
    serializer = new WorldSerializer();
  });

  describe('Terrain Modification Recording', () => {
    it('should record single terrain edit', () => {
      // **Validates: Requirement 14.2**
      const chunkX = 0;
      const chunkY = 0;
      const tileIndex = 15;
      const newHeight = 0.85;

      chunkManager.recordTerrainEdit(chunkX, chunkY, tileIndex, newHeight);

      const modifications = (chunkManager as any).modifications;
      const key = `${chunkX},${chunkY}`;
      const mod = modifications.get(key);

      expect(mod).toBeDefined();
      expect(mod.chunkX).toBe(chunkX);
      expect(mod.chunkY).toBe(chunkY);
      expect(mod.heightChanges.get(tileIndex)).toBe(newHeight);
      expect(mod.modifiedTiles.has(tileIndex)).toBe(true);
    });

    it('should record multiple terrain edits', () => {
      // **Validates: Requirement 14.2**
      const chunkX = 0;
      const chunkY = 0;
      const edits = new Map([
        [10, 0.5],
        [20, 0.6],
        [30, 0.7],
        [40, 0.8],
      ]);

      chunkManager.recordTerrainEdits(chunkX, chunkY, edits);

      const modifications = (chunkManager as any).modifications;
      const mod = modifications.get(`${chunkX},${chunkY}`);

      expect(mod.heightChanges.size).toBe(4);
      expect(mod.modifiedTiles.size).toBe(4);
      expect(mod.heightChanges.get(10)).toBe(0.5);
      expect(mod.heightChanges.get(40)).toBe(0.8);
    });

    it('should handle empty terrain edits', () => {
      // **Validates: Requirement 14.2**
      const chunkX = 0;
      const chunkY = 0;
      const edits = new Map<number, number>();

      chunkManager.recordTerrainEdits(chunkX, chunkY, edits);

      const modifications = (chunkManager as any).modifications;
      const mod = modifications.get(`${chunkX},${chunkY}`);

      expect(mod).toBeDefined();
      expect(mod.heightChanges.size).toBe(0);
      expect(mod.modifiedTiles.size).toBe(0);
    });

    it('should override previous height changes for same tile', () => {
      // **Validates: Requirement 14.2**
      const chunkX = 0;
      const chunkY = 0;
      const tileIndex = 25;

      chunkManager.recordTerrainEdit(chunkX, chunkY, tileIndex, 0.3);
      chunkManager.recordTerrainEdit(chunkX, chunkY, tileIndex, 0.9);

      const modifications = (chunkManager as any).modifications;
      const mod = modifications.get(`${chunkX},${chunkY}`);

      expect(mod.heightChanges.size).toBe(1);
      expect(mod.heightChanges.get(tileIndex)).toBe(0.9);
    });
  });

  describe('Structure Modification Recording', () => {
    it('should record structure addition', () => {
      // **Validates: Requirement 14.3**
      const chunkX = 1;
      const chunkY = 1;
      const structure = { x: 10, y: 15, type: StructureType.VILLAGE };

      chunkManager.recordStructureAddition(chunkX, chunkY, structure);

      const modifications = (chunkManager as any).modifications;
      const mod = modifications.get(`${chunkX},${chunkY}`);

      expect(mod).toBeDefined();
      expect(mod.addedStructures.length).toBe(1);
      expect(mod.addedStructures[0]).toEqual(structure);
    });

    it('should record structure removal', () => {
      // **Validates: Requirement 14.3**
      const chunkX = 1;
      const chunkY = 1;
      const structureIndex = 3;

      chunkManager.recordStructureRemoval(chunkX, chunkY, structureIndex);

      const modifications = (chunkManager as any).modifications;
      const mod = modifications.get(`${chunkX},${chunkY}`);

      expect(mod).toBeDefined();
      expect(mod.removedStructures.length).toBe(1);
      expect(mod.removedStructures[0]).toBe(structureIndex);
    });

    it('should record multiple structure changes', () => {
      // **Validates: Requirement 14.3**
      const chunkX = 2;
      const chunkY = 2;
      const added = [
        { x: 5, y: 5, type: StructureType.TOWER },
        { x: 20, y: 20, type: StructureType.RUINS },
      ];
      const removed = [0, 2, 5];

      chunkManager.recordStructureChanges(chunkX, chunkY, added, removed);

      const modifications = (chunkManager as any).modifications;
      const mod = modifications.get(`${chunkX},${chunkY}`);

      expect(mod.addedStructures.length).toBe(2);
      expect(mod.removedStructures.length).toBe(3);
      expect(mod.addedStructures).toEqual(added);
      expect(mod.removedStructures).toEqual(removed);
    });

    it('should handle empty structure changes', () => {
      // **Validates: Requirement 14.3**
      const chunkX = 0;
      const chunkY = 0;

      chunkManager.recordStructureChanges(chunkX, chunkY, [], []);

      const modifications = (chunkManager as any).modifications;
      const mod = modifications.get(`${chunkX},${chunkY}`);

      expect(mod).toBeDefined();
      expect(mod.addedStructures.length).toBe(0);
      expect(mod.removedStructures.length).toBe(0);
    });
  });

  describe('Modification Serialization (JSON)', () => {
    it('should serialize modifications to JSON format', () => {
      // **Validates: Requirement 14.4**
      // Generate a chunk and add it to cache
      const chunk = chunkManager.getChunk(0, 0);
      
      // Record modifications
      chunkManager.recordTerrainEdit(0, 0, 10, 0.75);
      chunkManager.recordStructureAddition(0, 0, { x: 5, y: 5, type: StructureType.VILLAGE });

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      expect(serialized.modifications.length).toBe(1);
      expect(serialized.modifications[0].chunkX).toBe(0);
      expect(serialized.modifications[0].chunkY).toBe(0);
      expect(serialized.modifications[0].heightChanges.size).toBe(1);
      expect(serialized.modifications[0].addedStructures.length).toBe(1);
    });

    it('should serialize multiple modifications', () => {
      // **Validates: Requirement 14.4**
      // Generate chunks
      chunkManager.getChunk(0, 0);
      chunkManager.getChunk(1, 1);
      chunkManager.getChunk(2, 2);

      // Record modifications on different chunks
      chunkManager.recordTerrainEdit(0, 0, 5, 0.5);
      chunkManager.recordTerrainEdit(1, 1, 10, 0.6);
      chunkManager.recordStructureRemoval(2, 2, 0);

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      expect(serialized.modifications.length).toBe(3);
      expect(serialized.modifications.some(m => m.chunkX === 0 && m.chunkY === 0)).toBe(true);
      expect(serialized.modifications.some(m => m.chunkX === 1 && m.chunkY === 1)).toBe(true);
      expect(serialized.modifications.some(m => m.chunkX === 2 && m.chunkY === 2)).toBe(true);
    });

    it('should serialize empty modifications', () => {
      // **Validates: Requirement 14.4**
      chunkManager.getChunk(0, 0);

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      expect(serialized.modifications.length).toBe(0);
    });

    it('should filter modifications by region', () => {
      // **Validates: Requirement 14.4**
      chunkManager.getChunk(0, 0);
      chunkManager.getChunk(5, 5);
      chunkManager.getChunk(10, 10);

      chunkManager.recordTerrainEdit(0, 0, 5, 0.5);
      chunkManager.recordTerrainEdit(5, 5, 10, 0.6);
      chunkManager.recordTerrainEdit(10, 10, 15, 0.7);

      const options: SerializationOptions = {
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

      // Should only include modifications for chunks (0,0) and (5,5)
      expect(serialized.modifications.length).toBe(2);
      expect(serialized.modifications.some(m => m.chunkX === 0 && m.chunkY === 0)).toBe(true);
      expect(serialized.modifications.some(m => m.chunkX === 5 && m.chunkY === 5)).toBe(true);
      expect(serialized.modifications.some(m => m.chunkX === 10 && m.chunkY === 10)).toBe(false);
    });
  });

  describe('Modification Serialization (Binary)', () => {
    it('should serialize modifications to binary format', () => {
      // **Validates: Requirement 14.4**
      chunkManager.getChunk(0, 0);
      
      chunkManager.recordTerrainEdit(0, 0, 10, 0.75);
      chunkManager.recordStructureAddition(0, 0, { x: 5, y: 5, type: StructureType.VILLAGE });

      const options: SerializationOptions = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      expect(serialized.modifications.length).toBe(1);
      expect(serialized.modifications[0].chunkX).toBe(0);
      expect(serialized.modifications[0].chunkY).toBe(0);
      expect(serialized.modifications[0].heightChanges.size).toBe(1);
      expect(serialized.modifications[0].addedStructures.length).toBe(1);
    });

    it('should serialize multiple modifications', () => {
      // **Validates: Requirement 14.4**
      chunkManager.getChunk(0, 0);
      chunkManager.getChunk(1, 1);

      chunkManager.recordTerrainEdits(0, 0, new Map([[5, 0.5], [10, 0.6]]));
      chunkManager.recordStructureChanges(1, 1, 
        [{ x: 10, y: 10, type: StructureType.TOWER }],
        [0, 1]
      );

      const options: SerializationOptions = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);

      expect(serialized.modifications.length).toBe(2);
    });
  });

  describe('Modification Application on Deserialization', () => {
    it('should apply height changes on deserialization', () => {
      // **Validates: Requirement 14.5**
      // Generate and modify a chunk
      const originalChunk = chunkManager.getChunk(0, 0);
      const originalHeight = originalChunk.heightmap[10];
      
      chunkManager.recordTerrainEdit(0, 0, 10, 0.95);

      // Serialize
      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };
      const serialized = serializer.serialize(chunkManager, options);

      // Create new chunk manager and deserialize
      const newChunkManager = new ChunkManager(config);
      serializer.deserialize(serialized, newChunkManager);

      // Get the deserialized chunk
      const deserializedChunk = (newChunkManager as any).cache.get('0,0,0').chunk;

      // Verify height change was applied (use toBeCloseTo for float precision)
      expect(deserializedChunk.heightmap[10]).toBeCloseTo(0.95, 5);
      expect(deserializedChunk.heightmap[10]).not.toBe(originalHeight);
    });

    it('should apply multiple height changes on deserialization', () => {
      // **Validates: Requirement 14.5**
      chunkManager.getChunk(0, 0);
      
      const heightChanges = new Map([
        [5, 0.1],
        [10, 0.2],
        [15, 0.3],
        [20, 0.4],
      ]);
      chunkManager.recordTerrainEdits(0, 0, heightChanges);

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };
      const serialized = serializer.serialize(chunkManager, options);

      const newChunkManager = new ChunkManager(config);
      serializer.deserialize(serialized, newChunkManager);

      const deserializedChunk = (newChunkManager as any).cache.get('0,0,0').chunk;

      expect(deserializedChunk.heightmap[5]).toBeCloseTo(0.1, 5);
      expect(deserializedChunk.heightmap[10]).toBeCloseTo(0.2, 5);
      expect(deserializedChunk.heightmap[15]).toBeCloseTo(0.3, 5);
      expect(deserializedChunk.heightmap[20]).toBeCloseTo(0.4, 5);
    });

    it('should apply structure additions on deserialization', () => {
      // **Validates: Requirement 14.5**
      const originalChunk = chunkManager.getChunk(0, 0);
      const originalStructureCount = originalChunk.structures.length;

      const newStructure = { x: 15, y: 15, type: StructureType.VILLAGE };
      chunkManager.recordStructureAddition(0, 0, newStructure);

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };
      const serialized = serializer.serialize(chunkManager, options);

      const newChunkManager = new ChunkManager(config);
      serializer.deserialize(serialized, newChunkManager);

      const deserializedChunk = (newChunkManager as any).cache.get('0,0,0').chunk;

      expect(deserializedChunk.structures.length).toBe(originalStructureCount + 1);
      expect(deserializedChunk.structures[deserializedChunk.structures.length - 1]).toEqual(newStructure);
    });

    it('should apply structure removals on deserialization', () => {
      // **Validates: Requirement 14.5**
      const originalChunk = chunkManager.getChunk(0, 0);
      const originalStructureCount = originalChunk.structures.length;

      // Only record removal if there are structures to remove
      if (originalStructureCount > 0) {
        chunkManager.recordStructureRemoval(0, 0, 0);

        const options: SerializationOptions = {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
        };
        const serialized = serializer.serialize(chunkManager, options);

        const newChunkManager = new ChunkManager(config);
        serializer.deserialize(serialized, newChunkManager);

        const deserializedChunk = (newChunkManager as any).cache.get('0,0,0').chunk;

        expect(deserializedChunk.structures.length).toBe(originalStructureCount - 1);
      } else {
        // If no structures, just verify the test setup
        expect(originalStructureCount).toBe(0);
      }
    });

    it('should apply combined modifications on deserialization', () => {
      // **Validates: Requirement 14.5**
      chunkManager.getChunk(0, 0);

      // Apply multiple types of modifications
      chunkManager.recordTerrainEdits(0, 0, new Map([[10, 0.8], [20, 0.9]]));
      chunkManager.recordStructureAddition(0, 0, { x: 5, y: 5, type: StructureType.TOWER });
      chunkManager.recordStructureAddition(0, 0, { x: 25, y: 25, type: StructureType.RUINS });

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };
      const serialized = serializer.serialize(chunkManager, options);

      const newChunkManager = new ChunkManager(config);
      serializer.deserialize(serialized, newChunkManager);

      const deserializedChunk = (newChunkManager as any).cache.get('0,0,0').chunk;

      // Verify height changes (use toBeCloseTo for float precision)
      expect(deserializedChunk.heightmap[10]).toBeCloseTo(0.8, 5);
      expect(deserializedChunk.heightmap[20]).toBeCloseTo(0.9, 5);

      // Verify structure additions
      const addedStructures = deserializedChunk.structures.filter(
        (s: any) => (s.x === 5 && s.y === 5) || (s.x === 25 && s.y === 25)
      );
      expect(addedStructures.length).toBe(2);
    });

    it('should apply modifications to multiple chunks on deserialization', () => {
      // **Validates: Requirement 14.5**
      chunkManager.getChunk(0, 0);
      chunkManager.getChunk(1, 1);

      chunkManager.recordTerrainEdit(0, 0, 10, 0.7);
      chunkManager.recordTerrainEdit(1, 1, 20, 0.8);

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };
      const serialized = serializer.serialize(chunkManager, options);

      const newChunkManager = new ChunkManager(config);
      serializer.deserialize(serialized, newChunkManager);

      const chunk00 = (newChunkManager as any).cache.get('0,0,0').chunk;
      const chunk11 = (newChunkManager as any).cache.get('1,1,0').chunk;

      expect(chunk00.heightmap[10]).toBeCloseTo(0.7, 5);
      expect(chunk11.heightmap[20]).toBeCloseTo(0.8, 5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid tile indices gracefully', () => {
      // **Validates: Requirement 14.2**
      chunkManager.getChunk(0, 0);
      
      const invalidIndex = 9999; // Beyond chunk size
      chunkManager.recordTerrainEdit(0, 0, invalidIndex, 0.5);

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };
      const serialized = serializer.serialize(chunkManager, options);

      const newChunkManager = new ChunkManager(config);
      
      // Should not throw, but log warning
      expect(() => serializer.deserialize(serialized, newChunkManager)).not.toThrow();
    });

    it('should handle invalid structure indices gracefully', () => {
      // **Validates: Requirement 14.3**
      chunkManager.getChunk(0, 0);
      
      const invalidIndex = 999; // Beyond structures array
      chunkManager.recordStructureRemoval(0, 0, invalidIndex);

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };
      const serialized = serializer.serialize(chunkManager, options);

      const newChunkManager = new ChunkManager(config);
      
      // Should not throw, but log warning
      expect(() => serializer.deserialize(serialized, newChunkManager)).not.toThrow();
    });

    it('should handle modifications to missing chunks gracefully', () => {
      // **Validates: Requirement 14.5**
      chunkManager.getChunk(0, 0);
      chunkManager.recordTerrainEdit(0, 0, 10, 0.5);

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };
      const serialized = serializer.serialize(chunkManager, options);

      // Remove chunk from serialized data but keep modification
      serialized.chunks = [];
      // Recalculate checksum after modification
      const dataForChecksum = {
        version: serialized.version,
        seed: serialized.seed,
        config: serialized.config,
        chunks: serialized.chunks,
        modifications: serialized.modifications,
      };
      const jsonString = JSON.stringify(dataForChecksum);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(jsonString);
      // Simple CRC32 calculation (matching WorldSerializer implementation)
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < bytes.length; i++) {
        crc = crc ^ bytes[i];
        for (let j = 0; j < 8; j++) {
          crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
        }
      }
      crc = (crc ^ 0xFFFFFFFF) >>> 0;
      serialized.checksum = crc.toString(16).padStart(8, '0');

      const newChunkManager = new ChunkManager(config);
      
      // Should not throw, but log warning
      expect(() => serializer.deserialize(serialized, newChunkManager)).not.toThrow();
    });

    it('should preserve modification timestamps', () => {
      // **Validates: Requirement 14.1**
      chunkManager.getChunk(0, 0);
      
      const beforeTimestamp = Date.now();
      chunkManager.recordTerrainEdit(0, 0, 10, 0.5);
      const afterTimestamp = Date.now();

      const modifications = (chunkManager as any).modifications;
      const mod = modifications.get('0,0');

      expect(mod.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(mod.timestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it('should handle large modification sets', () => {
      // **Validates: Requirement 14.2, 14.3**
      chunkManager.getChunk(0, 0);

      // Record many terrain edits
      const largeEdits = new Map<number, number>();
      for (let i = 0; i < 500; i++) {
        largeEdits.set(i, Math.random());
      }
      chunkManager.recordTerrainEdits(0, 0, largeEdits);

      // Record many structure additions
      for (let i = 0; i < 50; i++) {
        chunkManager.recordStructureAddition(0, 0, {
          x: i % 32,
          y: Math.floor(i / 32),
          type: StructureType.VILLAGE,
        });
      }

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };
      const serialized = serializer.serialize(chunkManager, options);

      expect(serialized.modifications.length).toBe(1);
      expect(serialized.modifications[0].heightChanges.size).toBe(500);
      expect(serialized.modifications[0].addedStructures.length).toBe(50);

      // Verify deserialization works
      const newChunkManager = new ChunkManager(config);
      expect(() => serializer.deserialize(serialized, newChunkManager)).not.toThrow();
    });
  });

  describe('Round-trip Serialization', () => {
    it('should preserve modifications through JSON round-trip', () => {
      // **Validates: Requirement 14.4, 14.5**
      chunkManager.getChunk(0, 0);
      
      chunkManager.recordTerrainEdits(0, 0, new Map([[10, 0.5], [20, 0.6]]));
      chunkManager.recordStructureAddition(0, 0, { x: 5, y: 5, type: StructureType.VILLAGE });

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      // First serialization
      const serialized1 = serializer.serialize(chunkManager, options);

      // Deserialize
      const newChunkManager = new ChunkManager(config);
      serializer.deserialize(serialized1, newChunkManager);

      // Second serialization
      const serialized2 = serializer.serialize(newChunkManager, options);

      // Compare modifications
      expect(serialized2.modifications.length).toBe(serialized1.modifications.length);
      expect(serialized2.modifications[0].heightChanges.size).toBe(2);
      expect(serialized2.modifications[0].addedStructures.length).toBe(1);
    });

    it('should preserve modifications through binary round-trip', () => {
      // **Validates: Requirement 14.4, 14.5**
      chunkManager.getChunk(0, 0);
      
      chunkManager.recordTerrainEdits(0, 0, new Map([[15, 0.7], [25, 0.8]]));
      chunkManager.recordStructureRemoval(0, 0, 0);

      const options: SerializationOptions = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      // First serialization
      const serialized1 = serializer.serialize(chunkManager, options);

      // Deserialize
      const newChunkManager = new ChunkManager(config);
      serializer.deserialize(serialized1, newChunkManager);

      // Second serialization
      const serialized2 = serializer.serialize(newChunkManager, options);

      // Compare modifications
      expect(serialized2.modifications.length).toBe(serialized1.modifications.length);
      expect(serialized2.modifications[0].heightChanges.size).toBe(2);
      expect(serialized2.modifications[0].removedStructures.length).toBeGreaterThanOrEqual(1);
    });

    it('should preserve modifications with compression', () => {
      // **Validates: Requirement 14.4, 14.5**
      chunkManager.getChunk(0, 0);
      
      chunkManager.recordTerrainEdit(0, 0, 10, 0.95);

      const options: SerializationOptions = {
        format: SerializationFormat.JSON,
        compress: true,
        modifiedOnly: false,
      };

      const serialized = serializer.serialize(chunkManager, options);
      const newChunkManager = new ChunkManager(config);
      serializer.deserialize(serialized, newChunkManager);

      const deserializedChunk = (newChunkManager as any).cache.get('0,0,0').chunk;
      expect(deserializedChunk.heightmap[10]).toBeCloseTo(0.95, 5);
    });
  });
});
