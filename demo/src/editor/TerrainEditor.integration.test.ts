/**
 * Integration tests for terrain modification flow
 * Tests the complete workflow: tool selection, terrain modification, mesh updates,
 * persistence through save/load, and undo/redo functionality
 * 
 * **Validates: Requirements 12.1, 12.6, 12.7, 12.8, 12.9, 12.10**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DemoApp, TerrainTool } from '../core/DemoApp';
import { WorldViewer } from '../viewer/WorldViewer';
import { TerrainEditor } from './TerrainEditor';
import { SerializationFormat } from '../../../src/world/serialization';

describe('Terrain Modification Flow Integration', () => {
  let app: DemoApp;
  let viewer: Partial<WorldViewer>;
  let editor: TerrainEditor;

  beforeEach(async () => {
    app = new DemoApp();
    await app.initialize();
    await app.generateWorld(54321);

    // Create mock viewer with raycasting and mesh update tracking
    viewer = {
      raycastTerrain: vi.fn((screenX: number, screenY: number) => {
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

  describe('Tool Selection and Terrain Modification', () => {
    it('should complete full workflow: select tool → modify terrain → verify mesh update', () => {
      let state = app.getState();
      const chunkManager = state.chunkManager!;

      // Step 1: Select RAISE tool
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);

      // Get updated state
      state = app.getState();

      expect(editor.getTool()).toBe(TerrainTool.RAISE);
      expect(state.selectedTool).toBe(TerrainTool.RAISE);

      // Get initial terrain state
      const initialChunk = chunkManager.getChunk(0, 0);
      const centerIndex = 16 * 32 + 16;
      const initialHeight = initialChunk.heightmap[centerIndex];

      // Step 2: Modify terrain by clicking
      const screenX = 400;
      const screenY = 300;

      app.handleTerrainClick(screenX, screenY, viewer, editor);

      // Step 3: Verify terrain was modified
      const modifiedChunk = chunkManager.getChunk(0, 0);
      const modifiedHeight = modifiedChunk.heightmap[centerIndex];

      expect(modifiedHeight).toBeGreaterThan(initialHeight);
      expect(modifiedHeight - initialHeight).toBeGreaterThan(0.01);

      // Step 4: Verify mesh update was triggered (Requirement 12.8)
      expect(viewer.updateChunk).toHaveBeenCalled();
      expect(viewer.updateChunk).toHaveBeenCalledWith(0, 0, expect.any(Object));
    });

    it('should update mesh within 100ms after modification', () => {
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(5);
      editor.setBrushStrength(1.5);

      const startTime = performance.now();
      app.handleTerrainClick(400, 300, viewer, editor);
      const endTime = performance.now();

      const updateTime = endTime - startTime;

      // Requirement 12.8: mesh update within 100ms
      expect(updateTime).toBeLessThan(100);
      expect(viewer.updateChunk).toHaveBeenCalled();
    });

    it('should work with different tools in sequence', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;
      const centerIndex = 16 * 32 + 16;

      // Get initial height
      const initialChunk = chunkManager.getChunk(0, 0);
      const initialHeight = initialChunk.heightmap[centerIndex];

      // Step 1: Raise terrain
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);
      editor.setBrushStrength(1.0);
      app.handleTerrainClick(400, 300, viewer, editor);

      const raisedHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];
      expect(raisedHeight).toBeGreaterThan(initialHeight);

      // Step 2: Lower terrain
      app.updateState({ selectedTool: TerrainTool.LOWER });
      editor.setTool(TerrainTool.LOWER);
      editor.setBrushStrength(0.5);
      app.handleTerrainClick(400, 300, viewer, editor);

      const loweredHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];
      expect(loweredHeight).toBeLessThan(raisedHeight);

      // Step 3: Flatten terrain
      app.updateState({ selectedTool: TerrainTool.FLATTEN });
      editor.setTool(TerrainTool.FLATTEN);
      app.handleTerrainClick(400, 300, viewer, editor);

      // Verify mesh was updated for each modification
      expect(viewer.updateChunk).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid successive modifications', () => {
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);
      editor.setBrushStrength(0.5);

      const modifications = 5;
      const startTime = performance.now();

      for (let i = 0; i < modifications; i++) {
        // Simulate clicks at slightly different positions
        viewer.raycastTerrain = vi.fn(() => ({
          point: { x: 16 + i, y: 25, z: 16 + i },
          chunkX: 0,
          chunkY: 0,
          localX: 16 + i,
          localY: 16 + i,
          height: 0.5,
          distance: 100
        }));

        app.handleTerrainClick(400 + i * 5, 300 + i * 5, viewer, editor);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / modifications;

      // Each modification should be fast
      expect(avgTime).toBeLessThan(100);
      expect(viewer.updateChunk).toHaveBeenCalledTimes(modifications);
    });
  });

  describe('Save/Load Persistence', () => {
    it('should persist modifications through save → load cycle', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Step 1: Modify terrain
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);

      const initialChunk = chunkManager.getChunk(0, 0);
      const centerIndex = 16 * 32 + 16;
      const initialHeight = initialChunk.heightmap[centerIndex];

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedChunk = chunkManager.getChunk(0, 0);
      const modifiedHeight = modifiedChunk.heightmap[centerIndex];

      expect(modifiedHeight).toBeGreaterThan(initialHeight);

      // Step 2: Save world
      const saveOptions = {
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      };

      const serialized = chunkManager.saveWorld(saveOptions);

      // Verify modifications are included (Requirement 12.9)
      expect(serialized.modifications.length).toBeGreaterThan(0);
      const modification = serialized.modifications.find(
        m => m.chunkX === 0 && m.chunkY === 0
      );
      expect(modification).toBeDefined();
      expect(modification!.heightChanges.size).toBeGreaterThan(0);

      // Step 3: Load into new app
      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;

      newChunkManager.loadWorld(serialized);

      // Step 4: Verify modifications persisted (Requirement 12.10)
      const restoredChunk = newChunkManager.getChunk(0, 0);
      const restoredHeight = restoredChunk.heightmap[centerIndex];

      expect(restoredHeight).toBeCloseTo(modifiedHeight, 5);
      expect(restoredHeight).toBeGreaterThan(initialHeight);
    });

    it('should persist multiple modifications across different chunks', async () => {
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

      const chunk10Height = chunkManager.getChunk(1, 0).heightmap[16 * 32 + 16];

      // Save and load
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      });

      expect(serialized.modifications.length).toBe(2);

      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Verify both modifications persisted
      const restoredChunk00 = newChunkManager.getChunk(0, 0);
      const restoredChunk10 = newChunkManager.getChunk(1, 0);

      expect(restoredChunk00.heightmap[16 * 32 + 16]).toBeCloseTo(chunk00Height, 5);
      expect(restoredChunk10.heightmap[16 * 32 + 16]).toBeCloseTo(chunk10Height, 5);
    });

    it('should persist modifications through binary format save/load', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Modify terrain
      app.updateState({ selectedTool: TerrainTool.FLATTEN });
      editor.setTool(TerrainTool.FLATTEN);
      editor.setBrushSize(4);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedChunk = chunkManager.getChunk(0, 0);
      const centerIndex = 16 * 32 + 16;
      const modifiedHeight = modifiedChunk.heightmap[centerIndex];

      // Save to binary format
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      });

      // Load into new app
      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Verify modification persisted
      const restoredChunk = newChunkManager.getChunk(0, 0);
      expect(restoredChunk.heightmap[centerIndex]).toBeCloseTo(modifiedHeight, 5);
    });

    it('should handle save/load with compression enabled', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Apply multiple modifications
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);

      const positions = [
        { x: 16, y: 16 },
        { x: 20, y: 20 },
        { x: 24, y: 24 }
      ];

      const modifiedHeights: number[] = [];

      for (const pos of positions) {
        viewer.raycastTerrain = vi.fn(() => ({
          point: { x: pos.x, y: 25, z: pos.y },
          chunkX: 0,
          chunkY: 0,
          localX: pos.x,
          localY: pos.y,
          height: 0.5,
          distance: 100
        }));

        app.handleTerrainClick(400, 300, viewer, editor);
        modifiedHeights.push(chunkManager.getChunk(0, 0).heightmap[pos.y * 32 + pos.x]);
      }

      // Save with compression
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: true,
        modifiedOnly: false,
      });

      // Load and verify
      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      const restoredChunk = newChunkManager.getChunk(0, 0);

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const index = pos.y * 32 + pos.x;
        expect(restoredChunk.heightmap[index]).toBeCloseTo(modifiedHeights[i], 5);
      }
    });
  });

  describe('Undo/Redo Functionality', () => {
    it('should support undo after terrain modification', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      const initialChunk = chunkManager.getChunk(0, 0);
      const centerIndex = 16 * 32 + 16;
      const initialHeight = initialChunk.heightmap[centerIndex];

      // Modify terrain
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);
      editor.setBrushStrength(1.0);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];
      expect(modifiedHeight).toBeGreaterThan(initialHeight);

      // Verify undo is available (Requirement 12.7)
      expect(editor.canUndo()).toBe(true);

      // Perform undo
      editor.undo();

      // Verify terrain was restored
      const restoredChunk = chunkManager.getChunk(0, 0);
      const restoredHeight = restoredChunk.heightmap[centerIndex];

      expect(restoredHeight).toBeCloseTo(initialHeight, 5);
      expect(editor.canUndo()).toBe(false);
    });

    it('should support redo after undo', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      const centerIndex = 16 * 32 + 16;
      const initialHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];

      // Modify terrain
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);
      editor.setBrushStrength(1.0);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];

      // Undo
      editor.undo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(initialHeight, 5);

      // Verify redo is available
      expect(editor.canRedo()).toBe(true);

      // Perform redo
      editor.redo();

      // Verify modification was reapplied
      const redoneHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];
      expect(redoneHeight).toBeCloseTo(modifiedHeight, 5);
      expect(editor.canRedo()).toBe(false);
    });

    it('should support multiple undo/redo operations', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      const centerIndex = 16 * 32 + 16;
      const initialHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];

      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      editor.setBrushStrength(0.5);

      // Apply 3 modifications
      const heights: number[] = [initialHeight];

      for (let i = 0; i < 3; i++) {
        app.handleTerrainClick(400, 300, viewer, editor);
        heights.push(chunkManager.getChunk(0, 0).heightmap[centerIndex]);
      }

      // Undo all modifications
      editor.undo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(heights[2], 5);

      editor.undo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(heights[1], 5);

      editor.undo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(heights[0], 5);

      expect(editor.canUndo()).toBe(false);

      // Redo all modifications
      editor.redo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(heights[1], 5);

      editor.redo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(heights[2], 5);

      editor.redo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(heights[3], 5);

      expect(editor.canRedo()).toBe(false);
    });

    it('should clear redo stack when new modification is made after undo', () => {
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);

      // First modification
      app.handleTerrainClick(400, 300, viewer, editor);

      // Second modification
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

      // Undo second modification
      editor.undo();
      expect(editor.canRedo()).toBe(true);

      // Make new modification (should clear redo stack)
      viewer.raycastTerrain = vi.fn(() => ({
        point: { x: 24, y: 25, z: 24 },
        chunkX: 0,
        chunkY: 0,
        localX: 24,
        localY: 24,
        height: 0.5,
        distance: 100
      }));
      app.handleTerrainClick(500, 400, viewer, editor);

      // Redo should no longer be available
      expect(editor.canRedo()).toBe(false);
    });

    it('should trigger mesh update on undo/redo', () => {
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);

      // Clear previous calls
      vi.clearAllMocks();

      // Modify terrain
      app.handleTerrainClick(400, 300, viewer, editor);
      expect(viewer.updateChunk).toHaveBeenCalledTimes(1);

      // Undo should trigger mesh update
      editor.undo();
      expect(viewer.updateChunk).toHaveBeenCalledTimes(2);

      // Redo should trigger mesh update
      editor.redo();
      expect(viewer.updateChunk).toHaveBeenCalledTimes(3);
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should handle complete workflow: modify → undo → redo → save → load', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      const centerIndex = 16 * 32 + 16;
      const initialHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];

      // Step 1: Modify terrain
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];
      expect(modifiedHeight).toBeGreaterThan(initialHeight);

      // Step 2: Undo
      editor.undo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(initialHeight, 5);

      // Step 3: Redo
      editor.redo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(modifiedHeight, 5);

      // Step 4: Save
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      });

      // Step 5: Load into new app
      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Step 6: Verify modification persisted
      const restoredChunk = newChunkManager.getChunk(0, 0);
      expect(restoredChunk.heightmap[centerIndex]).toBeCloseTo(modifiedHeight, 5);
    });

    it('should handle workflow with multiple tools and save/load', async () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      const centerIndex = 16 * 32 + 16;

      // Raise terrain
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);
      editor.setBrushStrength(1.0);
      app.handleTerrainClick(400, 300, viewer, editor);

      const raisedHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];

      // Smooth terrain
      app.updateState({ selectedTool: TerrainTool.SMOOTH });
      editor.setTool(TerrainTool.SMOOTH);
      editor.setBrushSize(3);
      app.handleTerrainClick(400, 300, viewer, editor);

      const smoothedHeight = chunkManager.getChunk(0, 0).heightmap[centerIndex];

      // Verify undo works
      editor.undo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(raisedHeight, 5);

      editor.redo();
      expect(chunkManager.getChunk(0, 0).heightmap[centerIndex]).toBeCloseTo(smoothedHeight, 5);

      // Save and load
      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.BINARY,
        compress: true,
        modifiedOnly: false,
      });

      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Verify final state persisted
      const restoredChunk = newChunkManager.getChunk(0, 0);
      expect(restoredChunk.heightmap[centerIndex]).toBeCloseTo(smoothedHeight, 5);
    });

    it('should maintain mesh updates throughout complete workflow', async () => {
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);

      vi.clearAllMocks();

      // Modification should trigger mesh update
      app.handleTerrainClick(400, 300, viewer, editor);
      expect(viewer.updateChunk).toHaveBeenCalledTimes(1);

      // Undo should trigger mesh update
      editor.undo();
      expect(viewer.updateChunk).toHaveBeenCalledTimes(2);

      // Redo should trigger mesh update
      editor.redo();
      expect(viewer.updateChunk).toHaveBeenCalledTimes(3);

      // Save/load cycle
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      const serialized = chunkManager.saveWorld({
        format: SerializationFormat.JSON,
        compress: false,
        modifiedOnly: false,
      });

      const newApp = new DemoApp();
      await newApp.initialize();
      const newChunkManager = newApp.getState().chunkManager!;
      newChunkManager.loadWorld(serialized);

      // Verify chunk was loaded correctly
      const restoredChunk = newChunkManager.getChunk(0, 0);
      expect(restoredChunk).toBeDefined();
      expect(restoredChunk.heightmap.length).toBeGreaterThan(0);
    });
  });
});
