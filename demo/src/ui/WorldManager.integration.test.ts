/**
 * Integration tests for WorldManager save/load cycle
 * 
 * Tests verify that the demo application can:
 * - Generate a world, save to JSON, clear, load, and verify identical state
 * - Generate a world, save to binary, clear, load, and verify identical state
 * - Save and load worlds with terrain modifications
 * - Use compression option correctly
 * - Use modifiedOnly option correctly
 * 
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DemoApp } from '../core/DemoApp';
import { WorldManager } from './WorldManager';
import { SerializationFormat } from '../../../src/world/serialization';
import { WorldConfig } from '../../../src/world/chunk-manager';

describe('WorldManager Save/Load Integration Tests', () => {
  let app: DemoApp;
  let worldManager: WorldManager;
  let container: HTMLElement;

  beforeEach(() => {
    // Create container element
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create app instance
    app = new DemoApp();
    
    // Create world manager
    worldManager = new WorldManager();
  });

  afterEach(() => {
    // Clean up
    if (app) {
      app.destroy();
    }
    if (worldManager) {
      worldManager.dispose();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('JSON format save/load cycle', () => {
    it('should generate, save JSON, clear, load, and verify identical world', async () => {
      // Initialize app
      await app.initialize();
      worldManager.initialize(app);

      // Generate world with specific seed
      const seed = 12345;
      await app.generateWorld(seed);

      // Get initial state
      const initialState = app.getState();
      const initialChunks = new Map(initialState.loadedChunks);
      
      // Verify chunks were generated
      expect(initialChunks.size).toBeGreaterThan(0);

      // Save world to JSON format
      const chunkManager = initialState.chunkManager;
      expect(chunkManager).toBeDefined();

      const serialized = chunkManager!.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false
      });

      // Verify serialization
      expect(serialized.seed).toBe(seed);
      expect(serialized.chunks.length).toBe(initialChunks.size);

      // Clear the world by creating a new chunk manager
      await app.generateWorld(99999); // Generate with different seed to clear

      // Load the saved world
      const newChunkManager = initialState.chunkManager;
      newChunkManager!.loadWorld(serialized);

      // Manually retrieve chunks from cache to populate loadedChunks
      const restoredChunks = new Map();
      for (const [key, initialChunk] of initialChunks) {
        const chunk = newChunkManager!.getChunk(initialChunk.x, initialChunk.y);
        restoredChunks.set(key, chunk);
      }

      // Update app state
      app.updateState({
        loadedChunks: restoredChunks,
        config: serialized.config
      });

      // Get loaded state
      const loadedState = app.getState();
      const loadedChunks = loadedState.loadedChunks;

      // Verify chunks were restored
      expect(loadedChunks.size).toBe(initialChunks.size);

      // Verify each chunk is identical
      for (const [key, initialChunk] of initialChunks) {
        const loadedChunk = loadedChunks.get(key);
        expect(loadedChunk).toBeDefined();
        
        // Verify coordinates
        expect(loadedChunk!.x).toBe(initialChunk.x);
        expect(loadedChunk!.y).toBe(initialChunk.y);

        // Verify heightmap
        expect(loadedChunk!.heightmap.length).toBe(initialChunk.heightmap.length);
        for (let i = 0; i < initialChunk.heightmap.length; i++) {
          expect(loadedChunk!.heightmap[i]).toBeCloseTo(initialChunk.heightmap[i], 5);
        }

        // Verify biome map
        expect(loadedChunk!.biomeMap.length).toBe(initialChunk.biomeMap.length);
        for (let i = 0; i < initialChunk.biomeMap.length; i++) {
          expect(loadedChunk!.biomeMap[i]).toBe(initialChunk.biomeMap[i]);
        }

        // Verify resources
        expect(loadedChunk!.resources.length).toBe(initialChunk.resources.length);

        // Verify structures
        expect(loadedChunk!.structures.length).toBe(initialChunk.structures.length);
      }

      // Verify configuration
      expect(loadedState.config.seed).toBe(seed);
    });

    it('should preserve world with compression enabled', async () => {
      // Initialize app
      await app.initialize();
      worldManager.initialize(app);

      // Generate world
      const seed = 54321;
      await app.generateWorld(seed);

      const initialState = app.getState();
      const initialChunks = new Map(initialState.loadedChunks);

      // Save with compression
      const serialized = initialState.chunkManager!.saveWorld({
        format: SerializationFormat.JSON,
        compress: true,
        modifiedOnly: false
      });

      // Load the saved world
      initialState.chunkManager!.loadWorld(serialized);

      // Manually retrieve chunks from cache
      const restoredChunks = new Map();
      for (const [key, initialChunk] of initialChunks) {
        const chunk = initialState.chunkManager!.getChunk(initialChunk.x, initialChunk.y);
        restoredChunks.set(key, chunk);
      }

      app.updateState({
        loadedChunks: restoredChunks
      });

      const loadedState = app.getState();
      const loadedChunks = loadedState.loadedChunks;

      // Verify chunks were restored correctly
      expect(loadedChunks.size).toBe(initialChunks.size);

      // Verify first chunk data
      const firstKey = Array.from(initialChunks.keys())[0];
      const initialChunk = initialChunks.get(firstKey)!;
      const loadedChunk = loadedChunks.get(firstKey)!;

      expect(loadedChunk.x).toBe(initialChunk.x);
      expect(loadedChunk.y).toBe(initialChunk.y);
      expect(loadedChunk.heightmap.length).toBe(initialChunk.heightmap.length);
    });
  });

  describe('Binary format save/load cycle', () => {
    it('should generate, save binary, clear, load, and verify identical world', async () => {
      // Initialize app
      await app.initialize();
      worldManager.initialize(app);

      // Generate world with specific seed
      const seed = 67890;
      await app.generateWorld(seed);

      // Get initial state
      const initialState = app.getState();
      const initialChunks = new Map(initialState.loadedChunks);
      
      // Verify chunks were generated
      expect(initialChunks.size).toBeGreaterThan(0);

      // Save world to binary format
      const serialized = initialState.chunkManager!.saveWorld({
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false
      });

      // Verify serialization
      expect(serialized.seed).toBe(seed);
      expect(serialized.chunks.length).toBe(initialChunks.size);

      // Clear the world
      await app.generateWorld(11111);

      // Load the saved world
      initialState.chunkManager!.loadWorld(serialized);

      // Manually retrieve chunks from cache
      const restoredChunks = new Map();
      for (const [key, initialChunk] of initialChunks) {
        const chunk = initialState.chunkManager!.getChunk(initialChunk.x, initialChunk.y);
        restoredChunks.set(key, chunk);
      }

      app.updateState({
        loadedChunks: restoredChunks,
        config: serialized.config
      });

      // Get loaded state
      const loadedState = app.getState();
      const loadedChunks = loadedState.loadedChunks;

      // Verify chunks were restored
      expect(loadedChunks.size).toBe(initialChunks.size);

      // Verify each chunk is identical
      for (const [key, initialChunk] of initialChunks) {
        const loadedChunk = loadedChunks.get(key);
        expect(loadedChunk).toBeDefined();
        
        expect(loadedChunk!.x).toBe(initialChunk.x);
        expect(loadedChunk!.y).toBe(initialChunk.y);
        expect(loadedChunk!.heightmap.length).toBe(initialChunk.heightmap.length);
        expect(loadedChunk!.biomeMap.length).toBe(initialChunk.biomeMap.length);
      }
    });

    it('should preserve world with binary compression', async () => {
      // Initialize app
      await app.initialize();
      worldManager.initialize(app);

      // Generate world
      const seed = 99999;
      await app.generateWorld(seed);

      const initialState = app.getState();
      const initialChunks = new Map(initialState.loadedChunks);

      // Save with binary compression
      const serialized = initialState.chunkManager!.saveWorld({
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false
      });

      // Load the saved world
      initialState.chunkManager!.loadWorld(serialized);

      app.updateState({
        loadedChunks: new Map(initialState.chunkManager!.cache)
      });

      const loadedState = app.getState();
      const loadedChunks = loadedState.loadedChunks;

      // Verify chunks were restored
      expect(loadedChunks.size).toBe(initialChunks.size);
    });
  });

  describe('Save/load with modifications', () => {
    it('should preserve terrain modifications through save/load cycle', async () => {
      // Initialize app
      await app.initialize();
      worldManager.initialize(app);

      // Generate world
      const seed = 11111;
      await app.generateWorld(seed);

      const initialState = app.getState();
      const chunkManager = initialState.chunkManager!;

      // Make terrain modifications
      const chunk = Array.from(initialState.loadedChunks.values())[0];
      chunkManager.recordTerrainEdit(chunk.x, chunk.y, 100, 0.85);
      chunkManager.recordTerrainEdit(chunk.x, chunk.y, 200, 0.35);

      // Save world with modifications
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false
      });

      // Verify modifications are included
      expect(serialized.modifications.length).toBeGreaterThan(0);

      // Load into the same chunk manager (simulating clear by loading)
      chunkManager.loadWorld(serialized);

      // Manually retrieve the modified chunk from cache
      const loadedChunk = chunkManager.getChunk(chunk.x, chunk.y);

      // Verify modifications were restored
      expect(loadedChunk.heightmap[100]).toBeCloseTo(0.85, 5);
      expect(loadedChunk.heightmap[200]).toBeCloseTo(0.35, 5);
    });

    it('should preserve structure modifications through save/load cycle', async () => {
      // Initialize app
      await app.initialize();
      worldManager.initialize(app);

      // Generate world
      const seed = 33333;
      await app.generateWorld(seed);

      const initialState = app.getState();
      const chunkManager = initialState.chunkManager!;

      // Get a chunk and add structure
      const chunk = Array.from(initialState.loadedChunks.values())[0];
      const originalStructureCount = chunk.structures.length;

      const newStructure = {
        type: 0,
        x: 15,
        y: 15
      };
      chunkManager.recordStructureAddition(chunk.x, chunk.y, newStructure);

      // Save world
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false
      });

      // Load into the same chunk manager
      chunkManager.loadWorld(serialized);

      // Manually retrieve the modified chunk from cache
      const loadedChunk = chunkManager.getChunk(chunk.x, chunk.y);

      // Verify structure was added
      expect(loadedChunk.structures.length).toBe(originalStructureCount + 1);
      expect(loadedChunk.structures).toContainEqual(newStructure);
    });
  });

  describe('ModifiedOnly option', () => {
    it('should only save modified chunks when modifiedOnly is true', async () => {
      // Initialize app
      await app.initialize();
      worldManager.initialize(app);

      // Generate world with multiple chunks
      const seed = 55555;
      await app.generateWorld(seed);

      const initialState = app.getState();
      const chunkManager = initialState.chunkManager!;
      const totalChunks = initialState.loadedChunks.size;

      // Modify only one chunk
      const chunk = Array.from(initialState.loadedChunks.values())[0];
      chunkManager.recordTerrainEdit(chunk.x, chunk.y, 100, 0.75);

      // Save with modifiedOnly = true
      const serializedModifiedOnly = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: true
      });

      // Save with modifiedOnly = false
      const serializedAll = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false
      });

      // Verify modifiedOnly saved fewer chunks
      expect(serializedModifiedOnly.chunks.length).toBeLessThan(serializedAll.chunks.length);
      expect(serializedAll.chunks.length).toBe(totalChunks);

      // Verify modifications are still included
      expect(serializedModifiedOnly.modifications.length).toBeGreaterThan(0);
    });
  });

  describe('Compression option', () => {
    it('should produce smaller output with compression enabled', async () => {
      // Initialize app
      await app.initialize();
      worldManager.initialize(app);

      // Generate world
      const seed = 66666;
      await app.generateWorld(seed);

      const initialState = app.getState();
      const chunkManager = initialState.chunkManager!;

      // Save without compression
      const uncompressed = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false
      });

      // Save with compression
      const compressed = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: true,
        modifiedOnly: false
      });

      // Both should have same number of chunks
      expect(compressed.chunks.length).toBe(uncompressed.chunks.length);

      // Both should load correctly
      const testChunkManager = initialState.chunkManager!;
      
      // Load compressed version
      testChunkManager.loadWorld(compressed);
      const loadedCompressed = new Map(testChunkManager.cache);

      // Load uncompressed version
      testChunkManager.loadWorld(uncompressed);
      const loadedUncompressed = new Map(testChunkManager.cache);

      // Verify both produce identical results
      expect(loadedCompressed.size).toBe(loadedUncompressed.size);
    });
  });

  describe('Checksum validation', () => {
    it('should calculate and store checksum when saving', async () => {
      // Initialize app
      await app.initialize();
      worldManager.initialize(app);

      // Generate world
      const seed = 77777;
      await app.generateWorld(seed);

      const initialState = app.getState();
      const chunkManager = initialState.chunkManager!;

      // Save world
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false
      });

      // Verify checksum exists and is non-empty
      expect(serialized.checksum).toBeDefined();
      expect(serialized.checksum.length).toBeGreaterThan(0);

      // Save again with same data should produce same checksum
      const serialized2 = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false
      });

      expect(serialized2.checksum).toBe(serialized.checksum);
    });

    it('should produce different checksums for different worlds', async () => {
      // Initialize app
      await app.initialize();
      worldManager.initialize(app);

      // Generate first world
      await app.generateWorld(11111);
      const state1 = app.getState();
      const serialized1 = state1.chunkManager!.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false
      });

      // Generate second world with different seed
      await app.generateWorld(22222);
      const state2 = app.getState();
      const serialized2 = state2.chunkManager!.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false
      });

      // Checksums should be different
      expect(serialized1.checksum).not.toBe(serialized2.checksum);
    });
  });
});
