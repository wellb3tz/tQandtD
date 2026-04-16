/**
 * Integration tests for modification persistence in save/load cycles
 * Tests verify that terrain modifications made through TerrainEditor persist
 * correctly when saving and loading worlds through WorldManager
 * 
 * **Validates: Requirements 12.9, 12.10**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DemoApp, TerrainTool } from './DemoApp';
import { WorldViewer } from '../viewer/WorldViewer';
import { TerrainEditor } from '../editor/TerrainEditor';
import { SerializationFormat } from '../../../src/world/serialization';

// Mock Three.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('three', (): any => {
  return {
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn(),
      background: null
    })),
    Mesh: vi.fn().mockImplementation(() => ({
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      visible: false,
      geometry: { dispose: vi.fn() },
      material: { dispose: vi.fn() }
    })),
    MeshBasicMaterial: vi.fn().mockImplementation(() => ({
      dispose: vi.fn()
    })),
    LineBasicMaterial: vi.fn().mockImplementation(() => ({
      dispose: vi.fn()
    })),
    RingGeometry: vi.fn().mockImplementation(() => ({
      dispose: vi.fn()
    })),
    EdgesGeometry: vi.fn().mockImplementation(() => ({
      dispose: vi.fn()
    })),
    BoxGeometry: vi.fn().mockImplementation(() => ({
      dispose: vi.fn()
    })),
    PlaneGeometry: vi.fn().mockImplementation(() => ({
      dispose: vi.fn()
    })),
    LineSegments: vi.fn().mockImplementation(() => ({
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      visible: false,
      geometry: { dispose: vi.fn() },
      material: { dispose: vi.fn() }
    })),
    Raycaster: vi.fn().mockImplementation(() => ({
      setFromCamera: vi.fn(),
      intersectObjects: vi.fn(() => [])
    })),
    Vector2: vi.fn().mockImplementation(() => ({ x: 0, y: 0 })),
    Vector3: vi.fn().mockImplementation(() => ({ x: 0, y: 0, z: 0 })),
    DoubleSide: 2,
    FrontSide: 0,
    BackSide: 1
  };
});

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn().mockImplementation(() => ({
    update: vi.fn(),
    dispose: vi.fn(),
    target: { set: vi.fn(), x: 0, y: 0, z: 0 },
    enableDamping: false
  }))
}));

describe('DemoApp Modification Persistence Integration', () => {
  let app: DemoApp;
  let viewer: Partial<WorldViewer>;
  let editor: TerrainEditor;

  beforeEach(async () => {
    app = new DemoApp();
    await app.initialize();
    await app.generateWorld(12345);

    // Create mock viewer with raycasting
    viewer = {
      raycastTerrain: vi.fn((screenX: number, screenY: number) => {
        // Mock raycast hit at chunk (0, 0), position (16, 16)
        return {
          point: { x: 16, y: 25, z: 16 },
          chunkX: 0,
          chunkY: 0,
          localX: 16,
          localY: 16,
          height: 0.5,
          distance: 100
        };
      }),
      updateChunk: vi.fn(),
      getScene: vi.fn(() => ({
        add: vi.fn(),
        remove: vi.fn()
      })),
      getCanvas: vi.fn(() => ({
        width: 800,
        height: 600
      })),
      getCamera: vi.fn(() => ({}))
    };

    editor = new TerrainEditor();
    editor.initialize(app, viewer as WorldViewer);
  });

  describe('JSON Format Save/Load with Modifications', () => {
    it('should preserve terrain modifications through JSON save/load cycle', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Get initial chunk and record initial heights
      const initialChunk = chunkManager.getChunk(0, 0);
      const centerIndex = 16 * 32 + 16;
      const initialHeight = initialChunk.heightmap[centerIndex];

      // Apply terrain modification using RAISE tool
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);

      app.handleTerrainClick(400, 300, viewer, editor);

      // Verify modification was applied
      const modifiedChunk = chunkManager.getChunk(0, 0);
      const modifiedHeight = modifiedChunk.heightmap[centerIndex];
      expect(modifiedHeight).toBeGreaterThan(initialHeight);

      // Save world to JSON format
      const saveOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Verify modifications are included in serialized data
      expect(serialized.modifications.length).toBeGreaterThan(0);
      const modification = serialized.modifications.find(
        m => m.chunkX === 0 && m.chunkY === 0
      );
      expect(modification).toBeDefined();
      expect(modification!.heightChanges.size).toBeGreaterThan(0);

      // Create new app and load the saved world
      const newApp = new DemoApp();
      await newApp.initialize();

      const newState = newApp.getState();
      const newChunkManager = newState.chunkManager!;

      // Load the serialized world
      newChunkManager.loadWorld(serialized);

      // Verify chunk is restored
      const restoredChunk = newChunkManager.getChunk(0, 0);

      // Verify terrain modification is preserved
      const restoredHeight = restoredChunk.heightmap[centerIndex];
      expect(restoredHeight).toBeCloseTo(modifiedHeight, 5);
      expect(restoredHeight).toBeGreaterThan(initialHeight);
    });

    it('should preserve multiple terrain modifications through JSON save/load', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Apply multiple modifications at different positions
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);
      editor.setBrushStrength(1.0);

      // Modification 1: position (16, 16)
      viewer.raycastTerrain = vi.fn(() => ({
        point: { x: 16, y: 25, z: 16 },
        chunkX: 0,
        chunkY: 0,
        localX: 16,
        localY: 16,
        height: 0.5,
        distance: 100
      }));
      app.handleTerrainClick(400, 300, viewer, editor);

      // Modification 2: position (20, 20)
      viewer.raycastTerrain = vi.fn(() => ({
        point: { x: 20, y: 25, z: 20 },
        chunkX: 0,
        chunkY: 0,
        localX: 20,
        localY: 20,
        height: 0.5,
        distance: 100
      }));
      app.handleTerrainClick(450, 350, viewer, editor);

      // Record modified heights
      const modifiedChunk = chunkManager.getChunk(0, 0);
      const height1 = modifiedChunk.heightmap[16 * 32 + 16];
      const height2 = modifiedChunk.heightmap[20 * 32 + 20];

      // Save and load
      const saveOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Verify both modifications are preserved
      const restoredChunk = newChunkManager.getChunk(0, 0);
      expect(restoredChunk.heightmap[16 * 32 + 16]).toBeCloseTo(height1, 5);
      expect(restoredChunk.heightmap[20 * 32 + 20]).toBeCloseTo(height2, 5);
    });

    it('should preserve modifications across multiple chunks', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Modify chunk (0, 0)
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);
      editor.setBrushStrength(1.0);

      viewer.raycastTerrain = vi.fn(() => ({
        point: { x: 16, y: 25, z: 16 },
        chunkX: 0,
        chunkY: 0,
        localX: 16,
        localY: 16,
        height: 0.5,
        distance: 100
      }));
      app.handleTerrainClick(400, 300, viewer, editor);

      const chunk00Height = chunkManager.getChunk(0, 0).heightmap[16 * 32 + 16];

      // Modify chunk (1, 0)
      viewer.raycastTerrain = vi.fn(() => ({
        point: { x: 48, y: 25, z: 16 },
        chunkX: 1,
        chunkY: 0,
        localX: 16,
        localY: 16,
        height: 0.5,
        distance: 100
      }));
      app.handleTerrainClick(500, 300, viewer, editor);

      const chunk10Height = chunkManager.getChunk(1, 0).heightmap[16 * 32 + 16];

      // Save and load
      const saveOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Verify modifications for both chunks are included
      expect(serialized.modifications.length).toBe(2);

      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Verify both chunks have modifications preserved
      const restoredChunk00 = newChunkManager.getChunk(0, 0);
      const restoredChunk10 = newChunkManager.getChunk(1, 0);

      expect(restoredChunk00.heightmap[16 * 32 + 16]).toBeCloseTo(chunk00Height, 5);
      expect(restoredChunk10.heightmap[16 * 32 + 16]).toBeCloseTo(chunk10Height, 5);
    });
  });

  describe('Binary Format Save/Load with Modifications', () => {
    it('should preserve terrain modifications through binary save/load cycle', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Apply terrain modification
      app.updateState({ selectedTool: TerrainTool.LOWER });
      editor.setTool(TerrainTool.LOWER);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);

      const initialChunk = chunkManager.getChunk(0, 0);
      const centerIndex = 16 * 32 + 16;
      const initialHeight = initialChunk.heightmap[centerIndex];

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedChunk = chunkManager.getChunk(0, 0);
      const modifiedHeight = modifiedChunk.heightmap[centerIndex];
      expect(modifiedHeight).toBeLessThan(initialHeight);

      // Save world to binary format
      const saveOptions = {
        format: SerializationFormat.BINARY,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Verify modifications are included
      expect(serialized.modifications.length).toBeGreaterThan(0);

      // Load into new app
      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Verify modification is preserved
      const restoredChunk = newChunkManager.getChunk(0, 0);
      const restoredHeight = restoredChunk.heightmap[centerIndex];
      expect(restoredHeight).toBeCloseTo(modifiedHeight, 5);
      expect(restoredHeight).toBeLessThan(initialHeight);
    });

    it('should preserve modifications with compression enabled', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Apply modification
      app.updateState({ selectedTool: TerrainTool.FLATTEN });
      editor.setTool(TerrainTool.FLATTEN);
      editor.setBrushSize(4);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedChunk = chunkManager.getChunk(0, 0);
      const centerIndex = 16 * 32 + 16;
      const modifiedHeight = modifiedChunk.heightmap[centerIndex];

      // Save with compression
      const saveOptions = {
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Load into new app
      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Verify modification is preserved despite compression
      const restoredChunk = newChunkManager.getChunk(0, 0);
      expect(restoredChunk.heightmap[centerIndex]).toBeCloseTo(modifiedHeight, 5);
    });
  });

  describe('Different Tool Modifications Persistence', () => {
    it('should preserve RAISE tool modifications', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      const initialChunk = chunkManager.getChunk(0, 0);
      const centerIndex = 16 * 32 + 16;
      const initialHeight = initialChunk.heightmap[centerIndex];

      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);
      editor.setBrushStrength(1.5);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];

      // Save and load
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      });

      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      const restoredHeight = newChunkManager.getChunk(0, 0).heightmap[centerIndex];
      expect(restoredHeight).toBeCloseTo(modifiedHeight, 5);
      expect(restoredHeight).toBeGreaterThan(initialHeight);
    });

    it('should preserve LOWER tool modifications', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      const initialChunk = chunkManager.getChunk(0, 0);
      const centerIndex = 16 * 32 + 16;
      const initialHeight = initialChunk.heightmap[centerIndex];

      app.updateState({ selectedTool: TerrainTool.LOWER });
      editor.setTool(TerrainTool.LOWER);
      editor.setBrushSize(2);
      editor.setBrushStrength(1.5);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];

      // Save and load
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      });

      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      const restoredHeight = newChunkManager.getChunk(0, 0).heightmap[centerIndex];
      expect(restoredHeight).toBeCloseTo(modifiedHeight, 5);
      expect(restoredHeight).toBeLessThan(initialHeight);
    });

    it('should preserve SMOOTH tool modifications', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Record initial heights in the brush area
      const initialChunk = chunkManager.getChunk(0, 0);
      const indices = [
        15 * 32 + 15, 15 * 32 + 16, 15 * 32 + 17,
        16 * 32 + 15, 16 * 32 + 16, 16 * 32 + 17,
        17 * 32 + 15, 17 * 32 + 16, 17 * 32 + 17,
      ];
      const initialHeights = indices.map(i => initialChunk.heightmap[i]);

      app.updateState({ selectedTool: TerrainTool.SMOOTH });
      editor.setTool(TerrainTool.SMOOTH);
      editor.setBrushSize(3);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedChunk = chunkManager.getChunk(0, 0);
      const modifiedHeights = indices.map(i => modifiedChunk.heightmap[i]);

      // Save and load
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      });

      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      const restoredChunk = newChunkManager.getChunk(0, 0);
      const restoredHeights = indices.map(i => restoredChunk.heightmap[i]);

      // Verify all modified heights are preserved
      for (let i = 0; i < indices.length; i++) {
        expect(restoredHeights[i]).toBeCloseTo(modifiedHeights[i], 5);
      }
    });
  });

  describe('Complete Save/Load Workflow', () => {
    it('should preserve modifications through complete save/load workflow', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Generate multiple chunks
      chunkManager.getChunk(0, 0);
      chunkManager.getChunk(1, 0);
      chunkManager.getChunk(0, 1);

      // Apply various modifications
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);

      // Modify chunk (0, 0)
      viewer.raycastTerrain = vi.fn(() => ({
        point: { x: 16, y: 25, z: 16 },
        chunkX: 0,
        chunkY: 0,
        localX: 16,
        localY: 16,
        height: 0.5,
        distance: 100
      }));
      app.handleTerrainClick(400, 300, viewer, editor);

      // Switch to LOWER tool and modify chunk (1, 0)
      app.updateState({ selectedTool: TerrainTool.LOWER });
      editor.setTool(TerrainTool.LOWER);

      viewer.raycastTerrain = vi.fn(() => ({
        point: { x: 48, y: 25, z: 16 },
        chunkX: 1,
        chunkY: 0,
        localX: 16,
        localY: 16,
        height: 0.5,
        distance: 100
      }));
      app.handleTerrainClick(500, 300, viewer, editor);

      // Record all modified heights
      const chunk00 = chunkManager.getChunk(0, 0);
      const chunk10 = chunkManager.getChunk(1, 0);
      const chunk01 = chunkManager.getChunk(0, 1);

      const centerIndex = 16 * 32 + 16;
      const height00 = chunk00.heightmap[centerIndex];
      const height10 = chunk10.heightmap[centerIndex];

      // Save to JSON
      const jsonSerialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: true,
        modifiedOnly: false,
      });

      // Verify modifications are included
      expect(jsonSerialized.modifications.length).toBe(2);
      // generateWorld loads a 3x3 grid (9 chunks), so we expect 9 chunks
      expect(jsonSerialized.chunks.length).toBe(9);

      // Load into new app
      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(jsonSerialized);

      // Verify all chunks are restored
      expect(newChunkManager.getCacheSize()).toBe(9);

      // Verify modifications are preserved
      const restoredChunk00 = newChunkManager.getChunk(0, 0);
      const restoredChunk10 = newChunkManager.getChunk(1, 0);
      const restoredChunk01 = newChunkManager.getChunk(0, 1);

      expect(restoredChunk00.heightmap[centerIndex]).toBeCloseTo(height00, 5);
      expect(restoredChunk10.heightmap[centerIndex]).toBeCloseTo(height10, 5);

      // Verify unmodified chunk is also restored correctly
      expect(restoredChunk01.x).toBe(chunk01.x);
      expect(restoredChunk01.y).toBe(chunk01.y);
      expect(restoredChunk01.heightmap.length).toBe(chunk01.heightmap.length);

      // Now save to binary and verify again
      const binarySerialized = newChunkManager.saveWorld({
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      });

      const finalApp = new DemoApp();
      await finalApp.initialize();
      const finalChunkManager = finalApp.getState().chunkManager!;
      finalChunkManager.loadWorld(binarySerialized);

      // Verify modifications are still preserved after binary round-trip
      const finalChunk00 = finalChunkManager.getChunk(0, 0);
      const finalChunk10 = finalChunkManager.getChunk(1, 0);

      expect(finalChunk00.heightmap[centerIndex]).toBeCloseTo(height00, 5);
      expect(finalChunk10.heightmap[centerIndex]).toBeCloseTo(height10, 5);
    });

    it('should handle save/load with no modifications', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Generate chunks without modifications
      const chunk00 = chunkManager.getChunk(0, 0);
      const chunk10 = chunkManager.getChunk(1, 0);

      const centerIndex = 16 * 32 + 16;
      const originalHeight00 = chunk00.heightmap[centerIndex];
      const originalHeight10 = chunk10.heightmap[centerIndex];

      // Save without any modifications
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      });

      // Should have no modifications
      expect(serialized.modifications.length).toBe(0);

      // Load into new app
      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Verify chunks are restored with original heights
      const restoredChunk00 = newChunkManager.getChunk(0, 0);
      const restoredChunk10 = newChunkManager.getChunk(1, 0);

      expect(restoredChunk00.heightmap[centerIndex]).toBeCloseTo(originalHeight00, 5);
      expect(restoredChunk10.heightmap[centerIndex]).toBeCloseTo(originalHeight10, 5);
    });
  });

  describe('Modification Metadata Preservation', () => {
    it('should preserve modification timestamps', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Apply modification
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);
      editor.setBrushStrength(1.0);

      const beforeTimestamp = Date.now();
      app.handleTerrainClick(400, 300, viewer, editor);
      const afterTimestamp = Date.now();

      // Save
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      });

      // Verify timestamp is within expected range
      const modification = serialized.modifications[0];
      expect(modification.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(modification.timestamp).toBeLessThanOrEqual(afterTimestamp);

      // Load and verify timestamp is preserved
      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Access the modifications map to verify timestamp
      const modificationsMap = (newChunkManager as any).modifications as Map<string, any>;
      const restoredMod = modificationsMap.get('0,0');
      expect(restoredMod).toBeDefined();
      expect(restoredMod.timestamp).toBe(modification.timestamp);
    });

    it('should preserve modification tile indices', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Apply modification with specific brush size
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);

      app.handleTerrainClick(400, 300, viewer, editor);

      // Save
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      });

      const modification = serialized.modifications[0];
      const originalModifiedTiles = new Set(modification.modifiedTiles);
      const originalHeightChanges = new Map(modification.heightChanges);

      // Load
      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Verify all modified tiles are tracked
      const modificationsMap = (newChunkManager as any).modifications as Map<string, any>;
      const restoredMod = modificationsMap.get('0,0');

      expect(restoredMod.modifiedTiles.size).toBe(originalModifiedTiles.size);
      for (const tile of originalModifiedTiles) {
        expect(restoredMod.modifiedTiles.has(tile)).toBe(true);
      }

      expect(restoredMod.heightChanges.size).toBe(originalHeightChanges.size);
      for (const [index, height] of originalHeightChanges) {
        expect(restoredMod.heightChanges.has(index)).toBe(true);
        expect(restoredMod.heightChanges.get(index)).toBeCloseTo(height, 5);
      }
    });
  });
});
