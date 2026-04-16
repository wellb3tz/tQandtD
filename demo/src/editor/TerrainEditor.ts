/**
 * TerrainEditor - Terrain modification component
 * 
 * Provides interactive terrain modification tools with brush-based operations.
 * Supports raising, lowering, flattening, and smoothing terrain with configurable
 * brush size, strength, and shape. Includes brush preview visualization.
 * 
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**
 */

import * as THREE from 'three';
import { DemoApp, TerrainTool } from '../core/DemoApp';
import { WorldViewer } from '../viewer/WorldViewer';

/**
 * Brush shape types
 */
export enum BrushShape {
  CIRCLE = 'circle',
  SQUARE = 'square'
}

/**
 * Modification callback type
 */
export type ModificationCallback = (worldX: number, worldY: number, tool: TerrainTool) => void;

/**
 * Undo/Redo history entry
 */
interface HistoryEntry {
  chunkX: number;
  chunkY: number;
  heightmapSnapshot: Float32Array;
}

/**
 * TerrainEditor - Provides terrain modification tools and brush controls
 */
export class TerrainEditor {
  private app: DemoApp | null;
  private viewer: WorldViewer | null;
  
  // Current tool and brush settings
  private currentTool: TerrainTool;
  private brushSize: number;
  private brushStrength: number;
  private brushShape: BrushShape;
  
  // Brush preview
  private brushPreview: THREE.Mesh | null;
  private previewVisible: boolean;
  
  // Undo/Redo stacks
  private undoStack: HistoryEntry[];
  private redoStack: HistoryEntry[];
  private maxHistorySize: number;
  
  // Modification callbacks
  private modificationCallbacks: Set<ModificationCallback>;

  constructor() {
    this.app = null;
    this.viewer = null;
    
    this.currentTool = TerrainTool.NONE;
    this.brushSize = 5;
    this.brushStrength = 1.0;
    this.brushShape = BrushShape.CIRCLE;
    
    this.brushPreview = null;
    this.previewVisible = false;
    
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistorySize = 50;
    
    this.modificationCallbacks = new Set();
  }

  /**
   * Initialize the terrain editor
   */
  initialize(app: DemoApp, viewer: WorldViewer): void {
    this.app = app;
    this.viewer = viewer;
    
    // Create brush preview mesh
    this.createBrushPreview();
    
    // Add brush preview to viewer scene
    if (this.brushPreview) {
      const scene = viewer.getScene();
      scene.add(this.brushPreview);
    }
    
    console.log('TerrainEditor initialized');
  }

  /**
   * Create brush preview mesh
   */
  private createBrushPreview(): void {
    // Create a ring geometry for circular brush preview
    const geometry = new THREE.RingGeometry(
      this.brushSize - 0.5,
      this.brushSize,
      32
    );
    
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthTest: false
    });
    
    this.brushPreview = new THREE.Mesh(geometry, material);
    this.brushPreview.rotation.x = -Math.PI / 2; // Rotate to lie flat
    this.brushPreview.visible = false;
    
    // Add to viewer scene (we'll need to access the scene)
    // For now, we'll handle this when showing the preview
  }

  /**
   * Set the current tool
   */
  setTool(tool: TerrainTool): void {
    this.currentTool = tool;
    
    // Update app state
    if (this.app) {
      this.app.updateState({ selectedTool: tool });
    }
    
    // Hide preview if tool is NONE
    if (tool === TerrainTool.NONE) {
      this.hideBrushPreview();
    }
  }

  /**
   * Get the current tool
   */
  getTool(): TerrainTool {
    return this.currentTool;
  }

  /**
   * Set brush size
   */
  setBrushSize(size: number): void {
    this.brushSize = Math.max(1, Math.min(10, size));
    
    // Update app state
    if (this.app) {
      this.app.updateState({ brushSize: this.brushSize });
    }
    
    // Update preview mesh
    this.updateBrushPreviewGeometry();
  }

  /**
   * Set brush strength
   */
  setBrushStrength(strength: number): void {
    this.brushStrength = Math.max(0.1, Math.min(2.0, strength));
    
    // Update app state
    if (this.app) {
      this.app.updateState({ brushStrength: this.brushStrength });
    }
  }

  /**
   * Set brush shape
   */
  setBrushShape(shape: BrushShape): void {
    this.brushShape = shape;
    
    // Update preview mesh
    this.updateBrushPreviewGeometry();
  }

  /**
   * Update brush preview geometry based on current settings
   */
  private updateBrushPreviewGeometry(): void {
    if (!this.brushPreview) return;
    
    // Dispose old geometry
    this.brushPreview.geometry.dispose();
    
    // Create new geometry based on shape
    if (this.brushShape === BrushShape.CIRCLE) {
      this.brushPreview.geometry = new THREE.RingGeometry(
        this.brushSize - 0.5,
        this.brushSize,
        32
      );
    } else {
      // Square shape - create a plane outline
      const size = this.brushSize * 2;
      const geometry = new THREE.EdgesGeometry(
        new THREE.PlaneGeometry(size, size)
      );
      this.brushPreview.geometry = geometry;
    }
  }

  /**
   * Apply brush at world coordinates
   */
  applyBrush(worldX: number, worldY: number): void {
    if (!this.app || this.currentTool === TerrainTool.NONE) {
      return;
    }
    
    const state = this.app.getState();
    if (!state.chunkManager) {
      return;
    }
    
    // Save state for undo before modification
    this.saveStateForUndo(worldX, worldY);
    
    // Apply the appropriate tool
    switch (this.currentTool) {
      case TerrainTool.RAISE:
        this.raiseTerrain(worldX, worldY, this.brushSize, this.brushStrength);
        break;
      case TerrainTool.LOWER:
        this.lowerTerrain(worldX, worldY, this.brushSize, this.brushStrength);
        break;
      case TerrainTool.FLATTEN:
        // Get target height at center
        const targetHeight = this.getHeightAt(worldX, worldY);
        this.flattenTerrain(worldX, worldY, this.brushSize, targetHeight);
        break;
      case TerrainTool.SMOOTH:
        this.smoothTerrain(worldX, worldY, this.brushSize);
        break;
    }
    
    // Notify callbacks
    for (const callback of this.modificationCallbacks) {
      callback(worldX, worldY, this.currentTool);
    }
  }

  /**
   * Raise terrain at world coordinates
   */
  raiseTerrain(worldX: number, worldY: number, radius: number, strength: number): void {
    this.modifyTerrainInRadius(worldX, worldY, radius, (height, distance, maxDistance) => {
      // Apply falloff based on distance from center
      const falloff = 1.0 - (distance / maxDistance);
      const delta = strength * 0.1 * falloff;
      return height + delta;
    });
  }

  /**
   * Lower terrain at world coordinates
   */
  lowerTerrain(worldX: number, worldY: number, radius: number, strength: number): void {
    this.modifyTerrainInRadius(worldX, worldY, radius, (height, distance, maxDistance) => {
      // Apply falloff based on distance from center
      const falloff = 1.0 - (distance / maxDistance);
      const delta = strength * 0.1 * falloff;
      return height - delta;
    });
  }

  /**
   * Flatten terrain to target height
   */
  flattenTerrain(worldX: number, worldY: number, radius: number, targetHeight: number): void {
    this.modifyTerrainInRadius(worldX, worldY, radius, (height, distance, maxDistance) => {
      // Apply falloff based on distance from center
      const falloff = 1.0 - (distance / maxDistance);
      // Interpolate towards target height
      return height + (targetHeight - height) * falloff * 0.5;
    });
  }

  /**
   * Smooth terrain by averaging neighboring heights
   */
  smoothTerrain(worldX: number, worldY: number, radius: number): void {
    if (!this.app) return;
    
    const state = this.app.getState();
    if (!state.chunkManager) return;
    
    const chunkSize = state.config.chunkSize || 32;
    
    // Collect all heights in the radius first
    const heightMap = new Map<string, number>();
    
    this.iterateTerrainInRadius(worldX, worldY, radius, (wx, wy, chunkX, chunkY, localX, localY) => {
      const height = this.getHeightAt(wx, wy);
      if (height !== null) {
        heightMap.set(`${wx},${wy}`, height);
      }
    });
    
    // Apply smoothing
    this.modifyTerrainInRadius(worldX, worldY, radius, (height, distance, maxDistance, wx, wy) => {
      // Calculate average of neighboring heights
      let sum = height;
      let count = 1;
      
      // Sample 8 neighbors
      const neighbors = [
        [-1, -1], [0, -1], [1, -1],
        [-1,  0],          [1,  0],
        [-1,  1], [0,  1], [1,  1]
      ];
      
      for (const [dx, dy] of neighbors) {
        const neighborHeight = heightMap.get(`${wx + dx},${wy + dy}`);
        if (neighborHeight !== undefined) {
          sum += neighborHeight;
          count++;
        }
      }
      
      const average = sum / count;
      
      // Apply falloff based on distance from center
      const falloff = 1.0 - (distance / maxDistance);
      
      // Interpolate towards average
      return height + (average - height) * falloff * 0.5;
    });
  }

  /**
   * Modify terrain in a radius using a modification function
   */
  private modifyTerrainInRadius(
    worldX: number,
    worldY: number,
    radius: number,
    modifyFn: (height: number, distance: number, maxDistance: number, wx: number, wy: number) => number
  ): void {
    if (!this.app) return;
    
    const state = this.app.getState();
    if (!state.chunkManager) return;
    
    const chunkSize = state.config.chunkSize || 32;
    const affectedChunks = new Set<string>();
    
    // Iterate over all tiles in radius
    this.iterateTerrainInRadius(worldX, worldY, radius, (wx, wy, chunkX, chunkY, localX, localY, distance) => {
      const chunk = state.chunkManager!.getChunk(chunkX, chunkY);
      const index = localY * chunkSize + localX;
      
      const currentHeight = chunk.heightmap[index];
      const newHeight = modifyFn(currentHeight, distance, radius, wx, wy);
      
      // Update heightmap directly
      chunk.heightmap[index] = newHeight;
      
      // Record modification through ChunkManager for persistence
      state.chunkManager!.recordTerrainEdit(chunkX, chunkY, index, newHeight);
      
      affectedChunks.add(`${chunkX},${chunkY}`);
    });
    
    // Update viewer for all affected chunks
    if (this.viewer) {
      for (const key of affectedChunks) {
        const [chunkX, chunkY] = key.split(',').map(Number);
        const chunk = state.chunkManager.getChunk(chunkX, chunkY);
        this.viewer.updateChunk(chunkX, chunkY, chunk);
      }
    }
  }

  /**
   * Iterate over terrain tiles in a radius
   */
  private iterateTerrainInRadius(
    worldX: number,
    worldY: number,
    radius: number,
    callback: (wx: number, wy: number, chunkX: number, chunkY: number, localX: number, localY: number, distance: number) => void
  ): void {
    if (!this.app) return;
    
    const state = this.app.getState();
    const chunkSize = state.config.chunkSize || 32;
    
    // Determine bounds
    const minX = Math.floor(worldX - radius);
    const maxX = Math.ceil(worldX + radius);
    const minY = Math.floor(worldY - radius);
    const maxY = Math.ceil(worldY + radius);
    
    for (let wy = minY; wy <= maxY; wy++) {
      for (let wx = minX; wx <= maxX; wx++) {
        // Calculate distance from center
        const dx = wx - worldX;
        const dy = wy - worldY;
        const distance = this.brushShape === BrushShape.CIRCLE
          ? Math.sqrt(dx * dx + dy * dy)
          : Math.max(Math.abs(dx), Math.abs(dy));
        
        // Skip if outside radius
        if (distance > radius) continue;
        
        // Convert to chunk coordinates
        const chunkX = Math.floor(wx / chunkSize);
        const chunkY = Math.floor(wy / chunkSize);
        const localX = ((wx % chunkSize) + chunkSize) % chunkSize;
        const localY = ((wy % chunkSize) + chunkSize) % chunkSize;
        
        callback(wx, wy, chunkX, chunkY, localX, localY, distance);
      }
    }
  }

  /**
   * Get height at world coordinates
   */
  private getHeightAt(worldX: number, worldY: number): number | null {
    if (!this.app) return null;
    
    const state = this.app.getState();
    if (!state.chunkManager) return null;
    
    const chunkSize = state.config.chunkSize || 32;
    const chunkX = Math.floor(worldX / chunkSize);
    const chunkY = Math.floor(worldY / chunkSize);
    const localX = ((worldX % chunkSize) + chunkSize) % chunkSize;
    const localY = ((worldY % chunkSize) + chunkSize) % chunkSize;
    
    try {
      const chunk = state.chunkManager.getChunk(chunkX, chunkY);
      const index = localY * chunkSize + localX;
      return chunk.heightmap[index];
    } catch {
      return null;
    }
  }

  /**
   * Save state for undo
   */
  private saveStateForUndo(worldX: number, worldY: number): void {
    if (!this.app) return;
    
    const state = this.app.getState();
    if (!state.chunkManager) return;
    
    const chunkSize = state.config.chunkSize || 32;
    const affectedChunks = new Set<string>();
    
    // Determine which chunks are affected
    this.iterateTerrainInRadius(worldX, worldY, this.brushSize, (wx, wy, chunkX, chunkY) => {
      affectedChunks.add(`${chunkX},${chunkY}`);
    });
    
    // Save snapshot of each affected chunk
    for (const key of affectedChunks) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      const chunk = state.chunkManager.getChunk(chunkX, chunkY);
      
      const entry: HistoryEntry = {
        chunkX,
        chunkY,
        heightmapSnapshot: new Float32Array(chunk.heightmap)
      };
      
      this.undoStack.push(entry);
      
      // Limit history size
      if (this.undoStack.length > this.maxHistorySize) {
        this.undoStack.shift();
      }
    }
    
    // Clear redo stack when new modification is made
    this.redoStack = [];
  }

  /**
   * Undo last modification
   */
  undo(): void {
    if (!this.canUndo() || !this.app) return;
    
    const state = this.app.getState();
    if (!state.chunkManager) return;
    
    const entry = this.undoStack.pop();
    if (!entry) return;
    
    // Save current state to redo stack
    const chunk = state.chunkManager.getChunk(entry.chunkX, entry.chunkY);
    this.redoStack.push({
      chunkX: entry.chunkX,
      chunkY: entry.chunkY,
      heightmapSnapshot: new Float32Array(chunk.heightmap)
    });
    
    // Restore heightmap
    for (let i = 0; i < entry.heightmapSnapshot.length; i++) {
      chunk.heightmap[i] = entry.heightmapSnapshot[i];
      state.chunkManager.recordTerrainEdit(entry.chunkX, entry.chunkY, i, entry.heightmapSnapshot[i]);
    }
    
    // Update viewer
    if (this.viewer) {
      const updatedChunk = state.chunkManager.getChunk(entry.chunkX, entry.chunkY);
      this.viewer.updateChunk(entry.chunkX, entry.chunkY, updatedChunk);
    }
  }

  /**
   * Redo last undone modification
   */
  redo(): void {
    if (!this.canRedo() || !this.app) return;
    
    const state = this.app.getState();
    if (!state.chunkManager) return;
    
    const entry = this.redoStack.pop();
    if (!entry) return;
    
    // Save current state to undo stack
    const chunk = state.chunkManager.getChunk(entry.chunkX, entry.chunkY);
    this.undoStack.push({
      chunkX: entry.chunkX,
      chunkY: entry.chunkY,
      heightmapSnapshot: new Float32Array(chunk.heightmap)
    });
    
    // Restore heightmap
    for (let i = 0; i < entry.heightmapSnapshot.length; i++) {
      chunk.heightmap[i] = entry.heightmapSnapshot[i];
      state.chunkManager.recordTerrainEdit(entry.chunkX, entry.chunkY, i, entry.heightmapSnapshot[i]);
    }
    
    // Update viewer
    if (this.viewer) {
      const updatedChunk = state.chunkManager.getChunk(entry.chunkX, entry.chunkY);
      this.viewer.updateChunk(entry.chunkX, entry.chunkY, updatedChunk);
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Register modification callback
   */
  onModification(callback: ModificationCallback): () => void {
    this.modificationCallbacks.add(callback);
    
    return () => {
      this.modificationCallbacks.delete(callback);
    };
  }

  /**
   * Show brush preview at world coordinates
   */
  showBrushPreview(worldX: number, worldY: number): void {
    if (!this.brushPreview || !this.viewer || this.currentTool === TerrainTool.NONE) {
      return;
    }
    
    // Get height at position
    const height = this.getHeightAt(Math.floor(worldX), Math.floor(worldY));
    if (height === null) return;
    
    // Position preview
    this.brushPreview.position.set(worldX, height * 50 + 0.5, worldY);
    this.brushPreview.visible = true;
    this.previewVisible = true;
    
    // Add to scene if not already added
    // Note: We need access to the viewer's scene, which isn't exposed
    // In a real implementation, WorldViewer would provide a method to add/remove objects
  }

  /**
   * Hide brush preview
   */
  hideBrushPreview(): void {
    if (this.brushPreview) {
      this.brushPreview.visible = false;
      this.previewVisible = false;
    }
  }

  /**
   * Get brush preview mesh (for adding to scene)
   */
  getBrushPreviewMesh(): THREE.Mesh | null {
    return this.brushPreview;
  }
}
