/**
 * Unit tests for TerrainEditor component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TerrainEditor, BrushShape } from './TerrainEditor';
import { DemoApp, TerrainTool } from '../core/DemoApp';
import { WorldViewer } from '../viewer/WorldViewer';
import { ChunkManager } from '../../../src/index';

// Mock Three.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('three', (): any => {
  return {
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn()
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

describe('TerrainEditor', () => {
  let editor: TerrainEditor;
  let mockApp: DemoApp;
  let mockViewer: Partial<WorldViewer>;

  beforeEach(() => {
    editor = new TerrainEditor();
    
    // Create mock app with minimal state
    mockApp = new DemoApp();
    
    // Create mock viewer (avoid DOM dependencies)
    mockViewer = {
      updateChunk: vi.fn(),
      addChunk: vi.fn(),
      removeChunk: vi.fn(),
      // @ts-ignore - Mock doesn't need full Scene interface
      getScene: vi.fn(() => ({
        add: vi.fn(),
        remove: vi.fn()
      }))
    };
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(editor.getTool()).toBe(TerrainTool.NONE);
      expect(editor.canUndo()).toBe(false);
      expect(editor.canRedo()).toBe(false);
    });

    it('should initialize with app and viewer', () => {
      expect(() => editor.initialize(mockApp, mockViewer as WorldViewer)).not.toThrow();
    });
  });

  describe('Tool Management', () => {
    beforeEach(() => {
      editor.initialize(mockApp, mockViewer as WorldViewer);
    });

    it('should set and get tool', () => {
      editor.setTool(TerrainTool.RAISE);
      expect(editor.getTool()).toBe(TerrainTool.RAISE);
      
      editor.setTool(TerrainTool.LOWER);
      expect(editor.getTool()).toBe(TerrainTool.LOWER);
      
      editor.setTool(TerrainTool.FLATTEN);
      expect(editor.getTool()).toBe(TerrainTool.FLATTEN);
      
      editor.setTool(TerrainTool.SMOOTH);
      expect(editor.getTool()).toBe(TerrainTool.SMOOTH);
    });

    it('should update app state when tool changes', () => {
      const updateStateSpy = vi.spyOn(mockApp, 'updateState');
      
      editor.setTool(TerrainTool.RAISE);
      
      expect(updateStateSpy).toHaveBeenCalledWith({
        selectedTool: TerrainTool.RAISE
      });
    });
  });

  describe('Brush Configuration', () => {
    beforeEach(() => {
      editor.initialize(mockApp, mockViewer as WorldViewer);
    });

    it('should set brush size within valid range', () => {
      const updateStateSpy = vi.spyOn(mockApp, 'updateState');
      
      editor.setBrushSize(5);
      expect(updateStateSpy).toHaveBeenCalledWith({ brushSize: 5 });
      
      // Test clamping
      editor.setBrushSize(0);
      expect(updateStateSpy).toHaveBeenCalledWith({ brushSize: 1 });
      
      editor.setBrushSize(20);
      expect(updateStateSpy).toHaveBeenCalledWith({ brushSize: 10 });
    });

    it('should set brush strength within valid range', () => {
      const updateStateSpy = vi.spyOn(mockApp, 'updateState');
      
      editor.setBrushStrength(1.0);
      expect(updateStateSpy).toHaveBeenCalledWith({ brushStrength: 1.0 });
      
      // Test clamping
      editor.setBrushStrength(0.05);
      expect(updateStateSpy).toHaveBeenCalledWith({ brushStrength: 0.1 });
      
      editor.setBrushStrength(5.0);
      expect(updateStateSpy).toHaveBeenCalledWith({ brushStrength: 2.0 });
    });

    it('should set brush shape', () => {
      expect(() => editor.setBrushShape(BrushShape.CIRCLE)).not.toThrow();
      expect(() => editor.setBrushShape(BrushShape.SQUARE)).not.toThrow();
    });
  });

  describe('Brush Preview', () => {
    beforeEach(() => {
      editor.initialize(mockApp, mockViewer as WorldViewer);
    });

    it('should get brush preview mesh', () => {
      const mesh = editor.getBrushPreviewMesh();
      expect(mesh).not.toBeNull();
    });

    it('should hide preview when tool is NONE', () => {
      editor.setTool(TerrainTool.RAISE);
      editor.setTool(TerrainTool.NONE);
      
      // Preview should be hidden (we can't directly test visibility without accessing private fields)
      expect(editor.getTool()).toBe(TerrainTool.NONE);
    });
  });

  describe('Modification Callbacks', () => {
    beforeEach(() => {
      editor.initialize(mockApp, mockViewer as WorldViewer);
    });

    it('should register and call modification callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = editor.onModification(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe modification callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = editor.onModification(callback);
      
      unsubscribe();
      
      // Callback should not be called after unsubscribe
      // (We can't test this directly without triggering a modification)
    });
  });

  describe('Undo/Redo', () => {
    beforeEach(async () => {
      await mockApp.initialize();
      editor.initialize(mockApp, mockViewer as WorldViewer);
    });

    it('should start with empty undo/redo stacks', () => {
      expect(editor.canUndo()).toBe(false);
      expect(editor.canRedo()).toBe(false);
    });

    it('should not throw when undo is called with empty stack', () => {
      expect(() => editor.undo()).not.toThrow();
    });

    it('should not throw when redo is called with empty stack', () => {
      expect(() => editor.redo()).not.toThrow();
    });
  });

  describe('Brush Application', () => {
    beforeEach(async () => {
      await mockApp.initialize();
      await mockApp.generateWorld(12345);
      editor.initialize(mockApp, mockViewer as WorldViewer);
    });

    it('should not apply brush when tool is NONE', () => {
      editor.setTool(TerrainTool.NONE);
      
      expect(() => editor.applyBrush(0, 0)).not.toThrow();
    });

    it('should apply raise tool', () => {
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);
      
      expect(() => editor.applyBrush(16, 16)).not.toThrow();
      expect(editor.canUndo()).toBe(true);
    });

    it('should apply lower tool', () => {
      editor.setTool(TerrainTool.LOWER);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);
      
      expect(() => editor.applyBrush(16, 16)).not.toThrow();
      expect(editor.canUndo()).toBe(true);
    });

    it('should apply flatten tool', () => {
      editor.setTool(TerrainTool.FLATTEN);
      editor.setBrushSize(3);
      
      expect(() => editor.applyBrush(16, 16)).not.toThrow();
      expect(editor.canUndo()).toBe(true);
    });

    it('should apply smooth tool', () => {
      editor.setTool(TerrainTool.SMOOTH);
      editor.setBrushSize(3);
      
      expect(() => editor.applyBrush(16, 16)).not.toThrow();
      expect(editor.canUndo()).toBe(true);
    });

    it('should support undo after modification', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      
      // Get initial height
      const chunk = chunkManager.getChunk(0, 0);
      const initialHeight = chunk.heightmap[16 * 32 + 16];
      
      // Apply modification
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      editor.setBrushStrength(1.0);
      editor.applyBrush(16, 16);
      
      // Height should change
      const modifiedChunk = chunkManager.getChunk(0, 0);
      const modifiedHeight = modifiedChunk.heightmap[16 * 32 + 16];
      expect(modifiedHeight).not.toBe(initialHeight);
      
      // Undo
      editor.undo();
      
      // Height should be restored
      const restoredChunk = chunkManager.getChunk(0, 0);
      const restoredHeight = restoredChunk.heightmap[16 * 32 + 16];
      expect(restoredHeight).toBeCloseTo(initialHeight, 5);
    });

    it('should support redo after undo', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      
      // Apply modification
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      editor.setBrushStrength(1.0);
      editor.applyBrush(16, 16);
      
      const modifiedChunk = chunkManager.getChunk(0, 0);
      const modifiedHeight = modifiedChunk.heightmap[16 * 32 + 16];
      
      // Undo
      editor.undo();
      
      // Redo
      editor.redo();
      
      // Height should match modified state
      const redoneChunk = chunkManager.getChunk(0, 0);
      const redoneHeight = redoneChunk.heightmap[16 * 32 + 16];
      expect(redoneHeight).toBeCloseTo(modifiedHeight, 5);
    });

    it('should clear redo stack on new modification', () => {
      // Apply modification
      editor.setTool(TerrainTool.RAISE);
      editor.applyBrush(16, 16);
      
      // Undo
      editor.undo();
      expect(editor.canRedo()).toBe(true);
      
      // Apply new modification
      editor.applyBrush(20, 20);
      
      // Redo stack should be cleared
      expect(editor.canRedo()).toBe(false);
    });
  });

  describe('Brush Shapes', () => {
    beforeEach(async () => {
      await mockApp.initialize();
      await mockApp.generateWorld(12345);
      editor.initialize(mockApp, mockViewer as WorldViewer);
    });

    it('should apply circular brush', () => {
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushShape(BrushShape.CIRCLE);
      editor.setBrushSize(3);
      
      expect(() => editor.applyBrush(16, 16)).not.toThrow();
    });

    it('should apply square brush', () => {
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushShape(BrushShape.SQUARE);
      editor.setBrushSize(3);
      
      expect(() => editor.applyBrush(16, 16)).not.toThrow();
    });
  });

  describe('Terrain Modification Calculations', () => {
    beforeEach(async () => {
      await mockApp.initialize();
      await mockApp.generateWorld(12345);
      editor.initialize(mockApp, mockViewer as WorldViewer);
    });

    it('should calculate raise terrain with falloff', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      // Get initial heights at center and edge of brush
      const centerIndex = 16 * 32 + 16;
      const edgeIndex = 18 * 32 + 16; // 2 tiles away
      const initialCenterHeight = chunk.heightmap[centerIndex];
      const initialEdgeHeight = chunk.heightmap[edgeIndex];
      
      // Apply raise with size 3
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);
      editor.applyBrush(16, 16);
      
      const modifiedCenterHeight = chunk.heightmap[centerIndex];
      const modifiedEdgeHeight = chunk.heightmap[edgeIndex];
      
      // Center should be raised more than edge (falloff)
      const centerDelta = modifiedCenterHeight - initialCenterHeight;
      const edgeDelta = modifiedEdgeHeight - initialEdgeHeight;
      
      expect(centerDelta).toBeGreaterThan(0);
      expect(edgeDelta).toBeGreaterThan(0);
      expect(centerDelta).toBeGreaterThan(edgeDelta);
    });

    it('should calculate lower terrain with falloff', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      const centerIndex = 16 * 32 + 16;
      const edgeIndex = 18 * 32 + 16;
      const initialCenterHeight = chunk.heightmap[centerIndex];
      const initialEdgeHeight = chunk.heightmap[edgeIndex];
      
      editor.setTool(TerrainTool.LOWER);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);
      editor.applyBrush(16, 16);
      
      const modifiedCenterHeight = chunk.heightmap[centerIndex];
      const modifiedEdgeHeight = chunk.heightmap[edgeIndex];
      
      const centerDelta = initialCenterHeight - modifiedCenterHeight;
      const edgeDelta = initialEdgeHeight - modifiedEdgeHeight;
      
      expect(centerDelta).toBeGreaterThan(0);
      expect(edgeDelta).toBeGreaterThan(0);
      expect(centerDelta).toBeGreaterThan(edgeDelta);
    });

    it('should calculate flatten terrain towards target height', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      // First raise terrain to create variation
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(2);
      editor.setBrushStrength(2.0);
      editor.applyBrush(16, 16);
      
      const centerIndex = 16 * 32 + 16;
      const targetHeight = chunk.heightmap[centerIndex];
      
      // Raise nearby area
      editor.applyBrush(18, 18);
      const nearbyIndex = 18 * 32 + 18;
      const raisedHeight = chunk.heightmap[nearbyIndex];
      
      // Now flatten
      editor.setTool(TerrainTool.FLATTEN);
      editor.setBrushSize(3);
      editor.applyBrush(16, 16);
      
      const flattenedHeight = chunk.heightmap[nearbyIndex];
      
      // Height should move towards target
      expect(Math.abs(flattenedHeight - targetHeight)).toBeLessThan(Math.abs(raisedHeight - targetHeight));
    });

    it('should calculate smooth terrain by averaging neighbors', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      // Create a spike
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      editor.setBrushStrength(2.0);
      editor.applyBrush(16, 16);
      
      const centerIndex = 16 * 32 + 16;
      const spikeHeight = chunk.heightmap[centerIndex];
      
      // Smooth the spike
      editor.setTool(TerrainTool.SMOOTH);
      editor.setBrushSize(2);
      editor.applyBrush(16, 16);
      
      const smoothedHeight = chunk.heightmap[centerIndex];
      
      // Spike should be reduced
      expect(smoothedHeight).toBeLessThan(spikeHeight);
    });

    it('should apply strength multiplier correctly', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      const centerIndex = 16 * 32 + 16;
      const initialHeight = chunk.heightmap[centerIndex];
      
      // Apply with strength 0.5
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      editor.setBrushStrength(0.5);
      editor.applyBrush(16, 16);
      
      const weakHeight = chunk.heightmap[centerIndex];
      const weakDelta = weakHeight - initialHeight;
      
      // Undo and apply with strength 1.0
      editor.undo();
      editor.setBrushStrength(1.0);
      editor.applyBrush(16, 16);
      
      const strongHeight = chunk.heightmap[centerIndex];
      const strongDelta = strongHeight - initialHeight;
      
      // Strong should be approximately 2x weak
      expect(strongDelta).toBeGreaterThan(weakDelta);
      expect(strongDelta / weakDelta).toBeCloseTo(2.0, 0);
    });
  });

  describe('Brush Shape Generation', () => {
    beforeEach(async () => {
      await mockApp.initialize();
      await mockApp.generateWorld(12345);
      editor.initialize(mockApp, mockViewer as WorldViewer);
    });

    it('should generate circular brush affecting tiles within radius', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      // Record initial heights
      const initialHeights = new Float32Array(chunk.heightmap);
      
      // Apply circular brush
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushShape(BrushShape.CIRCLE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);
      editor.applyBrush(16, 16);
      
      // Check that tiles within circular radius are affected
      let affectedCount = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          const x = 16 + dx;
          const y = 16 + dy;
          const index = y * 32 + x;
          
          const changed = Math.abs(chunk.heightmap[index] - initialHeights[index]) > 0.001;
          
          if (distance <= 3) {
            // Inside radius should be affected
            if (changed) affectedCount++;
          } else {
            // Outside radius should not be affected
            expect(changed).toBe(false);
          }
        }
      }
      
      expect(affectedCount).toBeGreaterThan(0);
    });

    it('should generate square brush affecting tiles in square area', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      const initialHeights = new Float32Array(chunk.heightmap);
      
      // Apply square brush
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushShape(BrushShape.SQUARE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);
      editor.applyBrush(16, 16);
      
      // Check that tiles within square are affected
      let affectedCount = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const x = 16 + dx;
          const y = 16 + dy;
          const index = y * 32 + x;
          
          const changed = Math.abs(chunk.heightmap[index] - initialHeights[index]) > 0.001;
          
          if (Math.abs(dx) <= 3 && Math.abs(dy) <= 3) {
            // Inside square should be affected
            if (changed) affectedCount++;
          }
        }
      }
      
      expect(affectedCount).toBeGreaterThan(0);
    });

    it('should affect different number of tiles for circle vs square', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      // Test circular brush with larger size
      const initialHeights1 = new Float32Array(chunk.heightmap);
      
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushShape(BrushShape.CIRCLE);
      editor.setBrushSize(5); // Larger size to see difference
      editor.setBrushStrength(1.0);
      editor.applyBrush(16, 16);
      
      let circleCount = 0;
      for (let i = 0; i < chunk.heightmap.length; i++) {
        if (Math.abs(chunk.heightmap[i] - initialHeights1[i]) > 0.001) {
          circleCount++;
        }
      }
      
      // Undo to restore
      editor.undo();
      
      // Test square brush
      const initialHeights2 = new Float32Array(chunk.heightmap);
      
      editor.setBrushShape(BrushShape.SQUARE);
      editor.applyBrush(16, 16);
      
      let squareCount = 0;
      for (let i = 0; i < chunk.heightmap.length; i++) {
        if (Math.abs(chunk.heightmap[i] - initialHeights2[i]) > 0.001) {
          squareCount++;
        }
      }
      
      // Square should affect more tiles than circle (for same radius)
      expect(squareCount).toBeGreaterThan(circleCount);
    });

    it('should scale brush area with size parameter', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      // Test small brush
      const initialHeights1 = new Float32Array(chunk.heightmap);
      
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushShape(BrushShape.CIRCLE);
      editor.setBrushSize(2);
      editor.setBrushStrength(1.0);
      editor.applyBrush(16, 16);
      
      let smallCount = 0;
      for (let i = 0; i < chunk.heightmap.length; i++) {
        if (Math.abs(chunk.heightmap[i] - initialHeights1[i]) > 0.001) {
          smallCount++;
        }
      }
      
      // Undo to restore
      editor.undo();
      
      // Test large brush
      const initialHeights2 = new Float32Array(chunk.heightmap);
      
      editor.setBrushSize(5);
      editor.applyBrush(16, 16);
      
      let largeCount = 0;
      for (let i = 0; i < chunk.heightmap.length; i++) {
        if (Math.abs(chunk.heightmap[i] - initialHeights2[i]) > 0.001) {
          largeCount++;
        }
      }
      
      // Large brush should affect more tiles
      expect(largeCount).toBeGreaterThan(smallCount);
    });
  });

  describe('Undo/Redo Stack Management', () => {
    beforeEach(async () => {
      await mockApp.initialize();
      await mockApp.generateWorld(12345);
      editor.initialize(mockApp, mockViewer as WorldViewer);
    });

    it('should maintain undo stack with multiple modifications', () => {
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      
      // Apply multiple modifications
      editor.applyBrush(16, 16);
      expect(editor.canUndo()).toBe(true);
      
      editor.applyBrush(20, 20);
      expect(editor.canUndo()).toBe(true);
      
      editor.applyBrush(24, 24);
      expect(editor.canUndo()).toBe(true);
    });

    it('should undo modifications in reverse order', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      const index1 = 16 * 32 + 16;
      const index2 = 20 * 32 + 20;
      
      const initial1 = chunk.heightmap[index1];
      const initial2 = chunk.heightmap[index2];
      
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      editor.setBrushStrength(1.0);
      
      // First modification
      editor.applyBrush(16, 16);
      const after1 = chunk.heightmap[index1];
      
      // Second modification
      editor.applyBrush(20, 20);
      const after2 = chunk.heightmap[index2];
      
      // Undo second modification
      editor.undo();
      expect(chunk.heightmap[index2]).toBeCloseTo(initial2, 5);
      expect(chunk.heightmap[index1]).toBeCloseTo(after1, 5);
      
      // Undo first modification
      editor.undo();
      expect(chunk.heightmap[index1]).toBeCloseTo(initial1, 5);
    });

    it('should maintain redo stack after undo', () => {
      editor.setTool(TerrainTool.RAISE);
      editor.applyBrush(16, 16);
      
      expect(editor.canRedo()).toBe(false);
      
      editor.undo();
      expect(editor.canRedo()).toBe(true);
    });

    it('should redo modifications in correct order', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      const index1 = 16 * 32 + 16;
      const index2 = 20 * 32 + 20;
      
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      
      editor.applyBrush(16, 16);
      const after1 = chunk.heightmap[index1];
      
      editor.applyBrush(20, 20);
      const after2 = chunk.heightmap[index2];
      
      // Undo both
      editor.undo();
      editor.undo();
      
      // Redo first
      editor.redo();
      expect(chunk.heightmap[index1]).toBeCloseTo(after1, 5);
      
      // Redo second
      editor.redo();
      expect(chunk.heightmap[index2]).toBeCloseTo(after2, 5);
    });

    it('should clear redo stack when new modification is made after undo', () => {
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      
      editor.applyBrush(16, 16);
      editor.applyBrush(20, 20);
      
      editor.undo();
      expect(editor.canRedo()).toBe(true);
      
      // New modification should clear redo stack
      editor.applyBrush(24, 24);
      expect(editor.canRedo()).toBe(false);
    });

    it('should handle undo/redo with different tools', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      const chunk = chunkManager.getChunk(0, 0);
      
      const index = 16 * 32 + 16;
      const initial = chunk.heightmap[index];
      
      // Raise
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      editor.setBrushStrength(1.0);
      editor.applyBrush(16, 16);
      const raised = chunk.heightmap[index];
      
      // Lower
      editor.setTool(TerrainTool.LOWER);
      editor.applyBrush(16, 16);
      const lowered = chunk.heightmap[index];
      
      // Undo lower
      editor.undo();
      expect(chunk.heightmap[index]).toBeCloseTo(raised, 5);
      
      // Undo raise
      editor.undo();
      expect(chunk.heightmap[index]).toBeCloseTo(initial, 5);
      
      // Redo raise
      editor.redo();
      expect(chunk.heightmap[index]).toBeCloseTo(raised, 5);
      
      // Redo lower
      editor.redo();
      expect(chunk.heightmap[index]).toBeCloseTo(lowered, 5);
    });

    it('should handle undo/redo across chunk boundaries', () => {
      const state = mockApp.getState();
      const chunkManager = state.chunkManager!;
      
      // Apply brush at chunk boundary
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(3);
      editor.setBrushStrength(1.0);
      editor.applyBrush(31, 31); // Near boundary of chunk (0,0)
      
      expect(editor.canUndo()).toBe(true);
      
      // Undo should restore all affected chunks
      editor.undo();
      
      expect(editor.canRedo()).toBe(true);
      
      // Redo should reapply to all chunks
      editor.redo();
      expect(editor.canRedo()).toBe(false);
    });

    it('should limit undo stack size', () => {
      editor.setTool(TerrainTool.RAISE);
      editor.setBrushSize(1);
      
      // Apply more than max history size (50) modifications
      for (let i = 0; i < 60; i++) {
        editor.applyBrush(16, 16);
      }
      
      // Should be able to undo, but not all 60
      let undoCount = 0;
      while (editor.canUndo()) {
        editor.undo();
        undoCount++;
      }
      
      // Should be limited to max history size
      expect(undoCount).toBeLessThanOrEqual(50);
    });
  });
});
