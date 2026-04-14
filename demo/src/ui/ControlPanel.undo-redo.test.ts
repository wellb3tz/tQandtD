/**
 * Unit tests for ControlPanel undo/redo functionality
 * 
 * **Validates: Requirements 12.7**
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import { DemoApp, TerrainTool } from '../core/DemoApp';
import { TerrainEditor } from '../editor/TerrainEditor';
import { WorldViewer } from '../viewer/WorldViewer';
import { ChunkManager } from '../../../src/index';

describe('ControlPanel Undo/Redo Integration', () => {
  let controlPanel: ControlPanel;
  let mockApp: DemoApp;
  let mockTerrainEditor: TerrainEditor;
  let mockViewer: WorldViewer;
  let container: HTMLElement;

  beforeEach(() => {
    // Create container element
    container = document.createElement('div');
    container.id = 'control-panel';
    
    // Create terrain editing controls container
    const editingControls = document.createElement('div');
    editingControls.id = 'terrain-editing-controls';
    container.appendChild(editingControls);
    
    // Create other required containers
    const presetControls = document.createElement('div');
    presetControls.id = 'preset-controls';
    container.appendChild(presetControls);
    
    const terrainControls = document.createElement('div');
    terrainControls.id = 'terrain-controls';
    container.appendChild(terrainControls);
    
    const biomeControls = document.createElement('div');
    biomeControls.id = 'biome-controls';
    container.appendChild(biomeControls);
    
    const riverControls = document.createElement('div');
    riverControls.id = 'river-controls';
    container.appendChild(riverControls);
    
    const resourceControls = document.createElement('div');
    resourceControls.id = 'resource-controls';
    container.appendChild(resourceControls);
    
    const advancedControls = document.createElement('div');
    advancedControls.id = 'advanced-controls';
    container.appendChild(advancedControls);
    
    const visibilityControls = document.createElement('div');
    visibilityControls.id = 'visibility-controls';
    container.appendChild(visibilityControls);
    
    document.body.appendChild(container);

    // Create mock app
    const chunkManager = new ChunkManager({ seed: 12345, chunkSize: 32 });
    mockApp = new DemoApp();
    vi.spyOn(mockApp, 'getState').mockReturnValue({
      chunkManager,
      loadedChunks: new Map(),
      config: {
        seed: 12345,
        chunkSize: 32,
        terrainConfig: {
          baseScale: 0.01,
          octaves: 4,
          persistence: 0.5,
          lacunarity: 2.0,
          warpStrength: 30,
          heightMultiplier: 1.0
        },
        biomeConfig: {
          temperatureScale: 0.005,
          moistureScale: 0.005,
          blendRadius: 5
        },
        resourceConfig: {
          types: [],
          clusterScale: 20,
          densityThreshold: 0.6
        },
        structureConfig: {
          types: [],
          minDistance: 10,
          maxAttempts: 30
        },
        riverConfig: {
          sourceElevation: 0.7,
          minFlowLength: 10,
          flowWidth: 2
        },
        maxCacheSize: 100,
        enablePerformanceMetrics: true
      },
      lodManager: null,
      cameraPosition: { x: 0, y: 0, z: 0 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      selectedTool: TerrainTool.NONE,
      brushSize: 5,
      brushStrength: 1.0,
      showTerrain: true,
      showBiomes: true,
      showRivers: true,
      showResources: true,
      showStructures: true,
      showChunkBoundaries: false,
      showWireframe: false,
      fps: 60,
      avgGenerationTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      loadedChunkCount: 0,
      renderedVertexCount: 0,
      lodHighCount: 0,
      lodMediumCount: 0,
      lodLowCount: 0,
      workerPoolEnabled: false,
      activeWorkers: 0,
      queuedTasks: 0,
      completedTasks: 0,
      avgWorkerTime: 0,
      incrementalEnabled: false,
      chunksInProgress: new Map(),
      biomeDistribution: new Map(),
      resourceCounts: new Map(),
      structureCounts: new Map(),
      riverCount: 0,
      avgHeight: 0,
      minHeight: 0,
      maxHeight: 0
    } as any);
    
    vi.spyOn(mockApp, 'subscribeToState').mockReturnValue(() => {});
    vi.spyOn(mockApp, 'updateEngineConfig').mockImplementation(() => {});
    vi.spyOn(mockApp, 'updateState').mockImplementation(() => {});

    // Create mock viewer (minimal mock to avoid WebGL issues)
    mockViewer = {
      getScene: vi.fn().mockReturnValue({
        add: vi.fn()
      })
    } as any;

    // Create mock terrain editor
    mockTerrainEditor = new TerrainEditor();
    mockTerrainEditor.initialize(mockApp, mockViewer as WorldViewer);

    // Create control panel
    controlPanel = new ControlPanel();
    controlPanel.initialize(container, mockApp, mockTerrainEditor);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Undo/Redo Button Creation', () => {
    it('should create undo button', () => {
      const undoButton = document.getElementById('undo-btn');
      expect(undoButton).toBeTruthy();
      expect(undoButton?.textContent).toContain('Undo');
    });

    it('should create redo button', () => {
      const redoButton = document.getElementById('redo-btn');
      expect(redoButton).toBeTruthy();
      expect(redoButton?.textContent).toContain('Redo');
    });

    it('should initially disable undo button', () => {
      const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
      expect(undoButton.disabled).toBe(true);
    });

    it('should initially disable redo button', () => {
      const redoButton = document.getElementById('redo-btn') as HTMLButtonElement;
      expect(redoButton.disabled).toBe(true);
    });
  });

  describe('Undo/Redo Button State Updates', () => {
    it('should enable undo button when canUndo returns true', () => {
      // Mock canUndo to return true
      vi.spyOn(mockTerrainEditor, 'canUndo').mockReturnValue(true);
      vi.spyOn(mockTerrainEditor, 'canRedo').mockReturnValue(false);

      // Trigger update by simulating a modification
      const modificationCallbacks = (mockTerrainEditor as any).modificationCallbacks;
      for (const callback of modificationCallbacks) {
        callback(0, 0, TerrainTool.RAISE);
      }

      const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
      expect(undoButton.disabled).toBe(false);
    });

    it('should enable redo button when canRedo returns true', () => {
      // Mock canRedo to return true
      vi.spyOn(mockTerrainEditor, 'canUndo').mockReturnValue(false);
      vi.spyOn(mockTerrainEditor, 'canRedo').mockReturnValue(true);

      // Trigger update by simulating a modification
      const modificationCallbacks = (mockTerrainEditor as any).modificationCallbacks;
      for (const callback of modificationCallbacks) {
        callback(0, 0, TerrainTool.RAISE);
      }

      const redoButton = document.getElementById('redo-btn') as HTMLButtonElement;
      expect(redoButton.disabled).toBe(false);
    });

    it('should disable buttons when canUndo and canRedo return false', () => {
      // Mock both to return false
      vi.spyOn(mockTerrainEditor, 'canUndo').mockReturnValue(false);
      vi.spyOn(mockTerrainEditor, 'canRedo').mockReturnValue(false);

      // Trigger update
      const modificationCallbacks = (mockTerrainEditor as any).modificationCallbacks;
      for (const callback of modificationCallbacks) {
        callback(0, 0, TerrainTool.RAISE);
      }

      const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
      const redoButton = document.getElementById('redo-btn') as HTMLButtonElement;
      
      expect(undoButton.disabled).toBe(true);
      expect(redoButton.disabled).toBe(true);
    });
  });

  describe('Undo/Redo Button Functionality', () => {
    it('should call terrainEditor.undo() when undo button is clicked', () => {
      const undoSpy = vi.spyOn(mockTerrainEditor, 'undo');
      vi.spyOn(mockTerrainEditor, 'canUndo').mockReturnValue(true);

      // Trigger update to enable button
      const modificationCallbacks = (mockTerrainEditor as any).modificationCallbacks;
      for (const callback of modificationCallbacks) {
        callback(0, 0, TerrainTool.RAISE);
      }

      const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
      undoButton.click();

      expect(undoSpy).toHaveBeenCalledTimes(1);
    });

    it('should call terrainEditor.redo() when redo button is clicked', () => {
      const redoSpy = vi.spyOn(mockTerrainEditor, 'redo');
      vi.spyOn(mockTerrainEditor, 'canRedo').mockReturnValue(true);

      // Trigger update to enable button
      const modificationCallbacks = (mockTerrainEditor as any).modificationCallbacks;
      for (const callback of modificationCallbacks) {
        callback(0, 0, TerrainTool.RAISE);
      }

      const redoButton = document.getElementById('redo-btn') as HTMLButtonElement;
      redoButton.click();

      expect(redoSpy).toHaveBeenCalledTimes(1);
    });

    it('should not call undo when button is disabled', () => {
      const undoSpy = vi.spyOn(mockTerrainEditor, 'undo');
      vi.spyOn(mockTerrainEditor, 'canUndo').mockReturnValue(false);

      const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
      undoButton.click();

      expect(undoSpy).not.toHaveBeenCalled();
    });

    it('should not call redo when button is disabled', () => {
      const redoSpy = vi.spyOn(mockTerrainEditor, 'redo');
      vi.spyOn(mockTerrainEditor, 'canRedo').mockReturnValue(false);

      const redoButton = document.getElementById('redo-btn') as HTMLButtonElement;
      redoButton.click();

      expect(redoSpy).not.toHaveBeenCalled();
    });
  });

  describe('Reactive Button State Updates', () => {
    it('should update button states after modification', () => {
      // Initially disabled
      const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
      expect(undoButton.disabled).toBe(true);

      // Mock canUndo to return true after modification
      vi.spyOn(mockTerrainEditor, 'canUndo').mockReturnValue(true);

      // Simulate modification
      const modificationCallbacks = (mockTerrainEditor as any).modificationCallbacks;
      for (const callback of modificationCallbacks) {
        callback(0, 0, TerrainTool.RAISE);
      }

      // Button should now be enabled
      expect(undoButton.disabled).toBe(false);
    });

    it('should update button states after undo', () => {
      // Set up initial state with undo available
      vi.spyOn(mockTerrainEditor, 'canUndo').mockReturnValue(true);
      vi.spyOn(mockTerrainEditor, 'canRedo').mockReturnValue(false);

      // Trigger update
      const modificationCallbacks = (mockTerrainEditor as any).modificationCallbacks;
      for (const callback of modificationCallbacks) {
        callback(0, 0, TerrainTool.RAISE);
      }

      const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
      const redoButton = document.getElementById('redo-btn') as HTMLButtonElement;

      expect(undoButton.disabled).toBe(false);
      expect(redoButton.disabled).toBe(true);

      // After undo, redo should be available
      vi.spyOn(mockTerrainEditor, 'canUndo').mockReturnValue(false);
      vi.spyOn(mockTerrainEditor, 'canRedo').mockReturnValue(true);

      undoButton.click();

      // Manually trigger update (in real app, this happens via callback)
      for (const callback of modificationCallbacks) {
        callback(0, 0, TerrainTool.RAISE);
      }

      expect(undoButton.disabled).toBe(true);
      expect(redoButton.disabled).toBe(false);
    });
  });

  describe('Tool Selection Integration', () => {
    it('should create tool selection buttons', () => {
      const noneButton = document.getElementById('tool-none');
      const raiseButton = document.getElementById('tool-raise');
      const lowerButton = document.getElementById('tool-lower');
      const flattenButton = document.getElementById('tool-flatten');
      const smoothButton = document.getElementById('tool-smooth');

      expect(noneButton).toBeTruthy();
      expect(raiseButton).toBeTruthy();
      expect(lowerButton).toBeTruthy();
      expect(flattenButton).toBeTruthy();
      expect(smoothButton).toBeTruthy();
    });

    it('should call terrainEditor.setTool() when tool button is clicked', () => {
      const setToolSpy = vi.spyOn(mockTerrainEditor, 'setTool');

      const raiseButton = document.getElementById('tool-raise') as HTMLButtonElement;
      raiseButton.click();

      expect(setToolSpy).toHaveBeenCalledWith(TerrainTool.RAISE);
    });

    it('should update button visual state when tool is selected', () => {
      const noneButton = document.getElementById('tool-none') as HTMLButtonElement;
      const raiseButton = document.getElementById('tool-raise') as HTMLButtonElement;

      // Initially, none should be active
      expect(noneButton.style.backgroundColor).toContain('007bff');

      // Click raise button
      raiseButton.click();

      // Raise should now be active
      expect(raiseButton.style.backgroundColor).toContain('007bff');
    });
  });

  describe('Brush Controls Integration', () => {
    it('should create brush size slider', () => {
      const brushSizeSlider = document.getElementById('brushSize');
      expect(brushSizeSlider).toBeTruthy();
    });

    it('should create brush strength slider', () => {
      const brushStrengthSlider = document.getElementById('brushStrength');
      expect(brushStrengthSlider).toBeTruthy();
    });

    it('should call terrainEditor.setBrushSize() when slider changes', () => {
      const setBrushSizeSpy = vi.spyOn(mockTerrainEditor, 'setBrushSize');

      const brushSizeSlider = document.getElementById('brushSize') as HTMLInputElement;
      brushSizeSlider.value = '7';
      brushSizeSlider.dispatchEvent(new Event('input'));

      expect(setBrushSizeSpy).toHaveBeenCalledWith(7);
    });

    it('should call terrainEditor.setBrushStrength() when slider changes', () => {
      const setBrushStrengthSpy = vi.spyOn(mockTerrainEditor, 'setBrushStrength');

      const brushStrengthSlider = document.getElementById('brushStrength') as HTMLInputElement;
      brushStrengthSlider.value = '1.5';
      brushStrengthSlider.dispatchEvent(new Event('input'));

      expect(setBrushStrengthSpy).toHaveBeenCalledWith(1.5);
    });
  });
});
