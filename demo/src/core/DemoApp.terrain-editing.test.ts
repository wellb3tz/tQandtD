/**
 * Integration tests for terrain editing system
 * Tests the integration between DemoApp, WorldViewer, and TerrainEditor
 * 
 * **Validates: Requirements 12.6, 12.7, 12.8**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DemoApp, TerrainTool } from './DemoApp';
import { WorldViewer } from '../viewer/WorldViewer';
import { TerrainEditor } from '../editor/TerrainEditor';

describe('DemoApp Terrain Editing Integration', () => {
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

  describe('Mouse Click Integration', () => {
    it('should handle terrain click when tool is selected', () => {
      // Select raise tool
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);

      // Simulate mouse click
      const screenX = 400;
      const screenY = 300;

      expect(() => {
        app.handleTerrainClick(screenX, screenY, viewer, editor);
      }).not.toThrow();

      // Verify raycasting was called
      expect(viewer.raycastTerrain).toHaveBeenCalledWith(screenX, screenY);

      // Verify undo is available after modification
      expect(editor.canUndo()).toBe(true);
    });

    it('should not modify terrain when tool is NONE', () => {
      // Ensure tool is NONE
      app.updateState({ selectedTool: TerrainTool.NONE });
      editor.setTool(TerrainTool.NONE);

      const screenX = 400;
      const screenY = 300;

      app.handleTerrainClick(screenX, screenY, viewer, editor);

      // Raycasting should not be called
      expect(viewer.raycastTerrain).not.toHaveBeenCalled();

      // No undo should be available
      expect(editor.canUndo()).toBe(false);
    });

    it('should not modify terrain when raycast misses', () => {
      // Mock raycast miss
      viewer.raycastTerrain = vi.fn(() => null);

      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);

      const screenX = 400;
      const screenY = 300;

      app.handleTerrainClick(screenX, screenY, viewer, editor);

      // No undo should be available
      expect(editor.canUndo()).toBe(false);
    });
  });

  describe('Mouse Move Integration', () => {
    it('should update brush preview on mouse move', () => {
      const showPreviewSpy = vi.spyOn(editor, 'showBrushPreview');

      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);

      const screenX = 400;
      const screenY = 300;

      app.handleMouseMove(screenX, screenY, viewer, editor);

      // Verify raycasting was called
      expect(viewer.raycastTerrain).toHaveBeenCalledWith(screenX, screenY);

      // Verify preview was shown
      expect(showPreviewSpy).toHaveBeenCalled();
    });

    it('should hide brush preview when tool is NONE', () => {
      const hidePreviewSpy = vi.spyOn(editor, 'hideBrushPreview');

      app.updateState({ selectedTool: TerrainTool.NONE });
      editor.setTool(TerrainTool.NONE);

      const screenX = 400;
      const screenY = 300;

      app.handleMouseMove(screenX, screenY, viewer, editor);

      // Raycasting should not be called
      expect(viewer.raycastTerrain).not.toHaveBeenCalled();

      // Preview should be hidden
      expect(hidePreviewSpy).toHaveBeenCalled();
    });

    it('should hide brush preview when raycast misses', () => {
      const hidePreviewSpy = vi.spyOn(editor, 'hideBrushPreview');

      // Mock raycast miss
      viewer.raycastTerrain = vi.fn(() => null);

      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);

      const screenX = 400;
      const screenY = 300;

      app.handleMouseMove(screenX, screenY, viewer, editor);

      // Preview should be hidden
      expect(hidePreviewSpy).toHaveBeenCalled();
    });
  });

  describe('Modification Recording', () => {
    it('should record modifications in ChunkManager', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Get initial chunk
      const initialChunk = chunkManager.getChunk(0, 0);
      const initialHeight = initialChunk.heightmap[16 * 32 + 16];

      // Apply modification
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      editor.setBrushStrength(1.0);

      app.handleTerrainClick(400, 300, viewer, editor);

      // Get modified chunk
      const modifiedChunk = chunkManager.getChunk(0, 0);
      const modifiedHeight = modifiedChunk.heightmap[16 * 32 + 16];

      // Height should have changed
      expect(modifiedHeight).not.toBe(initialHeight);
      expect(modifiedHeight).toBeGreaterThan(initialHeight);
    });

    it('should update terrain mesh after modification', () => {
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);

      app.handleTerrainClick(400, 300, viewer, editor);

      // Verify viewer.updateChunk was called
      expect(viewer.updateChunk).toHaveBeenCalled();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete terrain modification within 100ms', () => {
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(5);
      editor.setBrushStrength(1.0);

      const startTime = performance.now();
      app.handleTerrainClick(400, 300, viewer, editor);
      const endTime = performance.now();

      const updateTime = endTime - startTime;

      // Should complete within 100ms (Requirement 12.8)
      expect(updateTime).toBeLessThan(100);
    });

    it('should handle multiple rapid modifications efficiently', () => {
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(0.5);

      const iterations = 10;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Simulate clicks at different positions
        viewer.raycastTerrain = vi.fn(() => ({
          point: { x: 16 + i, y: 25, z: 16 + i },
          chunkX: 0,
          chunkY: 0,
          localX: 16 + i,
          localY: 16 + i,
          height: 0.5,
          distance: 100
        }));

        app.handleTerrainClick(400 + i * 10, 300 + i * 10, viewer, editor);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Average time per modification should be reasonable
      expect(avgTime).toBeLessThan(100);
    });
  });

  describe('Tool-Specific Modifications', () => {
    it('should raise terrain with RAISE tool', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;
      const initialChunk = chunkManager.getChunk(0, 0);
      const initialHeight = initialChunk.heightmap[16 * 32 + 16];

      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      editor.setBrushStrength(1.0);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedChunk = chunkManager.getChunk(0, 0);
      const modifiedHeight = modifiedChunk.heightmap[16 * 32 + 16];

      expect(modifiedHeight).toBeGreaterThan(initialHeight);
    });

    it('should lower terrain with LOWER tool', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;
      const initialChunk = chunkManager.getChunk(0, 0);
      const initialHeight = initialChunk.heightmap[16 * 32 + 16];

      app.updateState({ selectedTool: TerrainTool.LOWER });
      editor.setTool(TerrainTool.LOWER);
      editor.setBrushSize(1);
      editor.setBrushStrength(1.0);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedChunk = chunkManager.getChunk(0, 0);
      const modifiedHeight = modifiedChunk.heightmap[16 * 32 + 16];

      expect(modifiedHeight).toBeLessThan(initialHeight);
    });

    it('should flatten terrain with FLATTEN tool', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      app.updateState({ selectedTool: TerrainTool.FLATTEN });
      editor.setTool(TerrainTool.FLATTEN);
      editor.setBrushSize(3);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedChunk = chunkManager.getChunk(0, 0);
      
      // Heights within brush radius should be similar
      const centerHeight = modifiedChunk.heightmap[16 * 32 + 16];
      const neighborHeight = modifiedChunk.heightmap[16 * 32 + 17];
      
      // Heights should be closer after flattening (relaxed threshold)
      expect(Math.abs(centerHeight - neighborHeight)).toBeLessThan(0.2);
    });

    it('should smooth terrain with SMOOTH tool', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      app.updateState({ selectedTool: TerrainTool.SMOOTH });
      editor.setTool(TerrainTool.SMOOTH);
      editor.setBrushSize(3);

      app.handleTerrainClick(400, 300, viewer, editor);

      // Smoothing should complete without errors
      expect(editor.canUndo()).toBe(true);
    });
  });

  describe('Brush Size and Strength', () => {
    it('should affect larger area with larger brush size', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(5);
      editor.setBrushStrength(0.5);

      const initialChunk = chunkManager.getChunk(0, 0);
      const initialHeights = new Float32Array(initialChunk.heightmap);

      app.handleTerrainClick(400, 300, viewer, editor);

      const modifiedChunk = chunkManager.getChunk(0, 0);
      
      // Count how many tiles were modified
      let modifiedCount = 0;
      for (let i = 0; i < initialHeights.length; i++) {
        if (Math.abs(modifiedChunk.heightmap[i] - initialHeights[i]) > 0.001) {
          modifiedCount++;
        }
      }

      // With brush size 5, multiple tiles should be affected
      expect(modifiedCount).toBeGreaterThan(1);
    });

    it('should apply stronger modifications with higher strength', () => {
      const state = app.getState();
      const chunkManager = state.chunkManager!;

      // Test with low strength
      app.updateState({ selectedTool: TerrainTool.RAISE });
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      editor.setBrushStrength(0.1);

      const initialChunk = chunkManager.getChunk(0, 0);
      const initialHeight = initialChunk.heightmap[16 * 32 + 16];

      app.handleTerrainClick(400, 300, viewer, editor);

      const lowStrengthChunk = chunkManager.getChunk(0, 0);
      const lowStrengthHeight = lowStrengthChunk.heightmap[16 * 32 + 16];
      const lowStrengthDelta = lowStrengthHeight - initialHeight;

      // Undo
      editor.undo();

      // Test with high strength
      editor.setBrushStrength(2.0);
      app.handleTerrainClick(400, 300, viewer, editor);

      const highStrengthChunk = chunkManager.getChunk(0, 0);
      const highStrengthHeight = highStrengthChunk.heightmap[16 * 32 + 16];
      const highStrengthDelta = highStrengthHeight - initialHeight;

      // High strength should produce larger change
      expect(Math.abs(highStrengthDelta)).toBeGreaterThan(Math.abs(lowStrengthDelta));
    });
  });
});
