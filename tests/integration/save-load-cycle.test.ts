/**
 * Integration test for save/load cycle with modifications
 * 
 * Tests verify that the serialization system can:
 * - Save worlds with modifications to both JSON and binary formats
 * - Load worlds from both formats
 * - Preserve all world state including modifications through the save/load cycle
 * 
 * **Validates: Requirements 12.1, 13.1, 14.1**
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager, WorldConfig } from '../../src/world/chunk-manager';
import { WorldSerializer, SerializationFormat } from '../../src/world/serialization';
import { TerrainConfig } from '../../src/gen/terrain';
import { BiomeConfig } from '../../src/world/biome';
import { ResourceConfig } from '../../src/gen/resources';
import { StructureConfig, Structure } from '../../src/gen/structures';
import { RiverNetworkConfig } from '../../src/gen/rivers';

describe('Save/Load Cycle Integration Tests', () => {
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

    const riverNetworkConfig: RiverNetworkConfig = {
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

  describe('JSON format save/load cycle with modifications', () => {
    it('should preserve world state with terrain modifications through JSON save/load', () => {
      const config = createWorldConfig(12345);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate some chunks
      const chunk1 = chunkManager.getChunk(0, 0);
      const chunk2 = chunkManager.getChunk(1, 0);
      const chunk3 = chunkManager.getChunk(0, 1);

      // Make terrain modifications
      chunkManager.recordTerrainEdit(0, 0, 100, 0.8);
      chunkManager.recordTerrainEdit(0, 0, 200, 0.3);
      chunkManager.recordTerrainEdit(1, 0, 50, 0.9);

      // Save to JSON format
      const saveOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Verify modifications are included
      expect(serialized.modifications.length).toBe(2); // Two chunks modified

      // Create a new chunk manager and load
      const newChunkManager = new ChunkManager(config);
      newChunkManager.loadWorld(serialized);

      // Verify chunks are restored
      expect(newChunkManager.getCacheSize()).toBe(3);

      // Get chunks and verify data
      const restoredChunk1 = newChunkManager.getChunk(0, 0);
      const restoredChunk2 = newChunkManager.getChunk(1, 0);
      const restoredChunk3 = newChunkManager.getChunk(0, 1);

      // Verify coordinates
      expect(restoredChunk1.x).toBe(chunk1.x);
      expect(restoredChunk1.y).toBe(chunk1.y);
      expect(restoredChunk2.x).toBe(chunk2.x);
      expect(restoredChunk2.y).toBe(chunk2.y);
      expect(restoredChunk3.x).toBe(chunk3.x);
      expect(restoredChunk3.y).toBe(chunk3.y);

      // Verify terrain modifications are applied
      expect(restoredChunk1.heightmap[100]).toBeCloseTo(0.8, 5);
      expect(restoredChunk1.heightmap[200]).toBeCloseTo(0.3, 5);
      expect(restoredChunk2.heightmap[50]).toBeCloseTo(0.9, 5);

      // Verify other data is preserved
      expect(restoredChunk1.biomeMap.length).toBe(chunk1.biomeMap.length);
      expect(restoredChunk1.resources.length).toBe(chunk1.resources.length);
      expect(restoredChunk1.structures.length).toBe(chunk1.structures.length);
    });

    it('should preserve structure additions through JSON save/load', () => {
      const config = createWorldConfig(54321);
      const chunkManager = new ChunkManager(config);
      const serializer = new WorldSerializer();

      // Generate chunks
      const chunk1 = chunkManager.getChunk(0, 0);
      const originalStructureCount = chunk1.structures.length;

      // Add new structures
      const newStructure1: Structure = {
        type: 0,
        x: 10,
        y: 10,
      };
      const newStructure2: Structure = {
        type: 1,
        x: 20,
        y: 20,
      };

      chunkManager.recordStructureAddition(0, 0, newStructure1);
      chunkManager.recordStructureAddition(0, 0, newStructure2);

      // Save to JSON
      const saveOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Verify modifications are included
      expect(serialized.modifications.length).toBe(1);
      expect(serialized.modifications[0].addedStructures.length).toBe(2);

      // Load into new chunk manager
      const newChunkManager = new ChunkManager(config);
      newChunkManager.loadWorld(serialized);

      // Verify structures are added
      const restoredChunk = newChunkManager.getChunk(0, 0);
      expect(restoredChunk.structures.length).toBe(originalStructureCount + 2);

      // Verify the added structures are present
      const addedStructures = restoredChunk.structures.slice(originalStructureCount);
      expect(addedStructures).toContainEqual(newStructure1);
      expect(addedStructures).toContainEqual(newStructure2);
    });

    it('should preserve structure removals through JSON save/load', () => {
      const config = createWorldConfig(99999);
      const chunkManager = new ChunkManager(config);

      // Generate chunk with structures
      const chunk1 = chunkManager.getChunk(0, 0);
      const originalStructureCount = chunk1.structures.length;

      // Only test if there are structures to remove
      if (originalStructureCount > 0) {
        // Remove first structure
        chunkManager.recordStructureRemoval(0, 0, 0);

        // Save to JSON
        const saveOptions = {
          format: SerializationFormat.JSON,
          compress: false,
          modifiedOnly: false,
        };

        const serialized = chunkManager.saveWorld(saveOptions);

        // Verify modifications are included
        expect(serialized.modifications.length).toBe(1);
        expect(serialized.modifications[0].removedStructures.length).toBe(1);

        // Load into new chunk manager
        const newChunkManager = new ChunkManager(config);
        newChunkManager.loadWorld(serialized);

        // Verify structure is removed
        const restoredChunk = newChunkManager.getChunk(0, 0);
        expect(restoredChunk.structures.length).toBe(originalStructureCount - 1);
      }
    });

    it('should preserve mixed modifications through JSON save/load', () => {
      const config = createWorldConfig(11111);
      const chunkManager = new ChunkManager(config);

      // Generate chunks
      const chunk1 = chunkManager.getChunk(0, 0);
      const chunk2 = chunkManager.getChunk(1, 1);

      // Make mixed modifications
      // Terrain edits on chunk 1
      chunkManager.recordTerrainEdit(0, 0, 100, 0.75);
      chunkManager.recordTerrainEdit(0, 0, 200, 0.25);

      // Structure addition on chunk 1
      const newStructure: Structure = {
        type: 0,
        x: 15,
        y: 15,
      };
      chunkManager.recordStructureAddition(0, 0, newStructure);

      // Terrain edit on chunk 2
      chunkManager.recordTerrainEdit(1, 1, 300, 0.6);

      // Save to JSON
      const saveOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Verify modifications
      expect(serialized.modifications.length).toBe(2);

      // Load into new chunk manager
      const newChunkManager = new ChunkManager(config);
      newChunkManager.loadWorld(serialized);

      // Verify all modifications are applied
      const restoredChunk1 = newChunkManager.getChunk(0, 0);
      const restoredChunk2 = newChunkManager.getChunk(1, 1);

      // Check terrain modifications
      expect(restoredChunk1.heightmap[100]).toBeCloseTo(0.75, 5);
      expect(restoredChunk1.heightmap[200]).toBeCloseTo(0.25, 5);
      expect(restoredChunk2.heightmap[300]).toBeCloseTo(0.6, 5);

      // Check structure addition
      expect(restoredChunk1.structures).toContainEqual(newStructure);
    });
  });

  describe('Binary format save/load cycle with modifications', () => {
    it('should preserve world state with terrain modifications through binary save/load', () => {
      const config = createWorldConfig(22222);
      const chunkManager = new ChunkManager(config);

      // Generate chunks
      const chunk1 = chunkManager.getChunk(0, 0);
      const chunk2 = chunkManager.getChunk(1, 0);

      // Make terrain modifications
      chunkManager.recordTerrainEdit(0, 0, 150, 0.85);
      chunkManager.recordTerrainEdit(1, 0, 250, 0.35);

      // Save to binary format
      const saveOptions = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Verify modifications are included
      expect(serialized.modifications.length).toBe(2);

      // Load into new chunk manager
      const newChunkManager = new ChunkManager(config);
      newChunkManager.loadWorld(serialized);

      // Verify chunks are restored
      expect(newChunkManager.getCacheSize()).toBe(2);

      // Verify terrain modifications are applied
      const restoredChunk1 = newChunkManager.getChunk(0, 0);
      const restoredChunk2 = newChunkManager.getChunk(1, 0);

      expect(restoredChunk1.heightmap[150]).toBeCloseTo(0.85, 5);
      expect(restoredChunk2.heightmap[250]).toBeCloseTo(0.35, 5);
    });

    it('should preserve structure modifications through binary save/load', () => {
      const config = createWorldConfig(33333);
      const chunkManager = new ChunkManager(config);

      // Generate chunk
      const chunk1 = chunkManager.getChunk(0, 0);
      const originalStructureCount = chunk1.structures.length;

      // Add structure
      const newStructure: Structure = {
        type: 1,
        x: 25,
        y: 25,
      };
      chunkManager.recordStructureAddition(0, 0, newStructure);

      // Save to binary
      const saveOptions = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Load into new chunk manager
      const newChunkManager = new ChunkManager(config);
      newChunkManager.loadWorld(serialized);

      // Verify structure is added
      const restoredChunk = newChunkManager.getChunk(0, 0);
      expect(restoredChunk.structures.length).toBe(originalStructureCount + 1);
      expect(restoredChunk.structures).toContainEqual(newStructure);
    });

    it('should preserve mixed modifications through compressed binary save/load', () => {
      const config = createWorldConfig(44444);
      const chunkManager = new ChunkManager(config);

      // Generate chunks
      chunkManager.getChunk(0, 0);
      chunkManager.getChunk(1, 1);
      chunkManager.getChunk(2, 2);

      // Make various modifications
      chunkManager.recordTerrainEdit(0, 0, 100, 0.7);
      chunkManager.recordTerrainEdit(1, 1, 200, 0.4);

      const newStructure: Structure = {
        type: 0,
        x: 30,
        y: 30,
      };
      chunkManager.recordStructureAddition(2, 2, newStructure);

      // Save to compressed binary
      const saveOptions = {
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Load into new chunk manager
      const newChunkManager = new ChunkManager(config);
      newChunkManager.loadWorld(serialized);

      // Verify all modifications are applied
      const restoredChunk1 = newChunkManager.getChunk(0, 0);
      const restoredChunk2 = newChunkManager.getChunk(1, 1);
      const restoredChunk3 = newChunkManager.getChunk(2, 2);

      expect(restoredChunk1.heightmap[100]).toBeCloseTo(0.7, 5);
      expect(restoredChunk2.heightmap[200]).toBeCloseTo(0.4, 5);
      expect(restoredChunk3.structures).toContainEqual(newStructure);
    });
  });

  describe('Cross-format save/load cycle', () => {
    it('should preserve modifications when saving to JSON and loading to binary', () => {
      const config = createWorldConfig(55555);
      const chunkManager = new ChunkManager(config);

      // Generate and modify
      chunkManager.getChunk(0, 0);
      chunkManager.recordTerrainEdit(0, 0, 100, 0.65);

      // Save to JSON
      const jsonOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const jsonSerialized = chunkManager.saveWorld(jsonOptions);

      // Load into new manager
      const newChunkManager = new ChunkManager(config);
      newChunkManager.loadWorld(jsonSerialized);

      // Save to binary
      const binaryOptions = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const binarySerialized = newChunkManager.saveWorld(binaryOptions);

      // Load into final manager
      const finalChunkManager = new ChunkManager(config);
      finalChunkManager.loadWorld(binarySerialized);

      // Verify modification is preserved
      const finalChunk = finalChunkManager.getChunk(0, 0);
      expect(finalChunk.heightmap[100]).toBeCloseTo(0.65, 5);
    });

    it('should preserve modifications when saving to binary and loading to JSON', () => {
      const config = createWorldConfig(66666);
      const chunkManager = new ChunkManager(config);

      // Generate and modify
      chunkManager.getChunk(0, 0);
      const newStructure: Structure = {
        type: 1,
        x: 12,
        y: 12,
      };
      chunkManager.recordStructureAddition(0, 0, newStructure);

      // Save to binary
      const binaryOptions = {
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      };

      const binarySerialized = chunkManager.saveWorld(binaryOptions);

      // Load into new manager
      const newChunkManager = new ChunkManager(config);
      newChunkManager.loadWorld(binarySerialized);

      // Save to JSON
      const jsonOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const jsonSerialized = newChunkManager.saveWorld(jsonOptions);

      // Load into final manager
      const finalChunkManager = new ChunkManager(config);
      finalChunkManager.loadWorld(jsonSerialized);

      // Verify modification is preserved
      const finalChunk = finalChunkManager.getChunk(0, 0);
      expect(finalChunk.structures).toContainEqual(newStructure);
    });
  });

  describe('Complete world state preservation', () => {
    it('should preserve all world state including modifications through complete save/load cycle', () => {
      const config = createWorldConfig(77777);
      const chunkManager = new ChunkManager(config);

      // Generate multiple chunks
      const chunk1 = chunkManager.getChunk(0, 0);
      const chunk2 = chunkManager.getChunk(1, 0);
      const chunk3 = chunkManager.getChunk(0, 1);
      const chunk4 = chunkManager.getChunk(-1, -1);

      // Make comprehensive modifications
      // Terrain edits
      const terrainEdits = new Map<number, number>([
        [100, 0.8],
        [200, 0.3],
        [300, 0.6],
      ]);
      chunkManager.recordTerrainEdits(0, 0, terrainEdits);
      chunkManager.recordTerrainEdit(1, 0, 50, 0.9);

      // Structure additions
      const structure1: Structure = { type: 0, x: 10, y: 10 };
      const structure2: Structure = { type: 1, x: 20, y: 20 };
      chunkManager.recordStructureAddition(0, 1, structure1);
      chunkManager.recordStructureAddition(0, 1, structure2);

      // Structure removal (if structures exist)
      if (chunk4.structures.length > 0) {
        chunkManager.recordStructureRemoval(-1, -1, 0);
      }

      // Save to JSON with compression
      const jsonOptions = {
        format: SerializationFormat.JSON,
        compress: true,
        modifiedOnly: false,
      };

      const jsonSerialized = chunkManager.saveWorld(jsonOptions);

      // Verify serialization includes all data
      expect(jsonSerialized.chunks.length).toBe(4);
      expect(jsonSerialized.modifications.length).toBeGreaterThan(0);
      expect(jsonSerialized.seed).toBe(77777);

      // Load into new manager
      const jsonChunkManager = new ChunkManager(config);
      jsonChunkManager.loadWorld(jsonSerialized);

      // Verify JSON load
      expect(jsonChunkManager.getCacheSize()).toBe(4);

      const jsonChunk1 = jsonChunkManager.getChunk(0, 0);
      const jsonChunk2 = jsonChunkManager.getChunk(1, 0);
      const jsonChunk3 = jsonChunkManager.getChunk(0, 1);
      const jsonChunk4 = jsonChunkManager.getChunk(-1, -1);

      // Verify terrain modifications
      expect(jsonChunk1.heightmap[100]).toBeCloseTo(0.8, 5);
      expect(jsonChunk1.heightmap[200]).toBeCloseTo(0.3, 5);
      expect(jsonChunk1.heightmap[300]).toBeCloseTo(0.6, 5);
      expect(jsonChunk2.heightmap[50]).toBeCloseTo(0.9, 5);

      // Verify structure additions
      expect(jsonChunk3.structures).toContainEqual(structure1);
      expect(jsonChunk3.structures).toContainEqual(structure2);

      // Verify structure removal
      if (chunk4.structures.length > 0) {
        expect(jsonChunk4.structures.length).toBe(chunk4.structures.length - 1);
      }

      // Now save to binary and verify again
      const binaryOptions = {
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      };

      const binarySerialized = jsonChunkManager.saveWorld(binaryOptions);

      // Load into final manager
      const binaryChunkManager = new ChunkManager(config);
      binaryChunkManager.loadWorld(binarySerialized);

      // Verify binary load
      expect(binaryChunkManager.getCacheSize()).toBe(4);

      const binaryChunk1 = binaryChunkManager.getChunk(0, 0);
      const binaryChunk2 = binaryChunkManager.getChunk(1, 0);
      const binaryChunk3 = binaryChunkManager.getChunk(0, 1);
      const binaryChunk4 = binaryChunkManager.getChunk(-1, -1);

      // Verify all modifications are still preserved
      expect(binaryChunk1.heightmap[100]).toBeCloseTo(0.8, 5);
      expect(binaryChunk1.heightmap[200]).toBeCloseTo(0.3, 5);
      expect(binaryChunk1.heightmap[300]).toBeCloseTo(0.6, 5);
      expect(binaryChunk2.heightmap[50]).toBeCloseTo(0.9, 5);
      expect(binaryChunk3.structures).toContainEqual(structure1);
      expect(binaryChunk3.structures).toContainEqual(structure2);

      if (chunk4.structures.length > 0) {
        expect(binaryChunk4.structures.length).toBe(chunk4.structures.length - 1);
      }

      // Verify all other data is preserved
      expect(binaryChunk1.x).toBe(chunk1.x);
      expect(binaryChunk1.y).toBe(chunk1.y);
      expect(binaryChunk1.biomeMap.length).toBe(chunk1.biomeMap.length);
      expect(binaryChunk1.resources.length).toBe(chunk1.resources.length);
    });
  });
});

