/**
 * DemoApp - Core application class for the Comprehensive Engine Demo
 * 
 * Manages application state, coordinates components, and integrates with the
 * procedural world generation engine. Provides state management with reactive
 * updates, chunk loading coordination, and event system for component communication.
 */

import { ChunkManager, WorldConfig, ChunkData, BiomeType, ResourceType, StructureType, LODManager, LODLevel } from '@engine/index';

/**
 * 3D vector for camera position and target
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Terrain editing tools
 */
export enum TerrainTool {
  RAISE = 'raise',
  LOWER = 'lower',
  FLATTEN = 'flatten',
  SMOOTH = 'smooth',
  NONE = 'none'
}

/**
 * Application state interface
 */
export interface AppState {
  // Engine state
  chunkManager: ChunkManager | null;
  loadedChunks: Map<string, ChunkData>;
  config: WorldConfig;
  lodManager: LODManager | null;
  
  // UI state
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  selectedTool: TerrainTool;
  brushSize: number;
  brushStrength: number;
  viewDistance: number; // Chunk load radius
  
  // Visibility toggles
  showTerrain: boolean;
  showBiomes: boolean;
  showWater: boolean;
  showResources: boolean;
  showStructures: boolean;
  showChunkBoundaries: boolean;
  showWireframe: boolean;
  
  // Performance metrics
  fps: number;
  avgGenerationTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  loadedChunkCount: number;
  renderedVertexCount: number;
  
  // LOD statistics
  lodHighCount: number;
  lodMediumCount: number;
  lodLowCount: number;
  
  // Worker pool statistics
  workerPoolEnabled: boolean;
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  avgWorkerTime: number;
  
  // Incremental generation statistics
  incrementalEnabled: boolean;
  chunksInProgress: Map<string, number>; // chunk key -> GenerationStage
  
  // Statistics
  biomeDistribution: Map<BiomeType, number>;
  resourceCounts: Map<ResourceType, number>;
  structureCounts: Map<StructureType, number>;
  avgHeight: number;
  minHeight: number;
  maxHeight: number;
}

/**
 * State change callback type
 */
export type StateChangeCallback = (state: AppState) => void;

/**
 * Unsubscribe function type
 */
export type Unsubscribe = () => void;

/**
 * Event types for component communication
 */
export enum AppEvent {
  CHUNK_LOADED = 'chunk_loaded',
  CHUNK_UNLOADED = 'chunk_unloaded',
  WORLD_GENERATED = 'world_generated',
  CONFIG_CHANGED = 'config_changed',
  STATE_CHANGED = 'state_changed',
  VISIBILITY_CHANGED = 'visibility_changed',
  ERROR = 'error'
}

/**
 * Event callback type
 */
export type EventCallback = (data?: any) => void;

/**
 * Default world configuration
 */
const DEFAULT_CONFIG: WorldConfig = {
  seed: 12345,
  chunkSize: 32,
  terrainConfig: {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 1,
    heightMultiplier: 1.0,
    enable3D: false,
    zScale: 0.5
  },
  biomeConfig: {
    temperatureScale: 0.005,
    moistureScale: 0.005,
    blendRadius: 5
  },
  resourceConfig: {
    types: [
      { type: 0, rarity: 0.5, biomes: [], minAmount: 1, maxAmount: 5 }, // Iron
      { type: 1, rarity: 0.5, biomes: [], minAmount: 1, maxAmount: 3 }, // Gold
      { type: 2, rarity: 0.5, biomes: [], minAmount: 2, maxAmount: 6 }, // Coal
      { type: 3, rarity: 0.5, biomes: [], minAmount: 3, maxAmount: 8 }, // Stone
      { type: 4, rarity: 0.5, biomes: [], minAmount: 1, maxAmount: 4 }  // Wood
    ],
    clusterScale: 20,
    densityThreshold: 0.6
  },
  structureConfig: {
    types: [
      { type: 0, rarity: 1.0, rules: [] }, // Village
      { type: 1, rarity: 1.0, rules: [] }, // Ruins
      { type: 2, rarity: 1.0, rules: [] }  // Tower
    ],
    minDistance: 30,
    maxAttempts: 30
  },
  riverNetworkConfig: {
    sourceElevation: 0.7,
    minFlowLength: 10,
    flowWidth: 2,
    enableTributaries: true,
    maxTributaryOrder: 2,
    tributaryProbability: 0.3,
    enableLakes: true,
    lakeDepressionThreshold: 0.05,
    maxLakeSize: 100,
    enableDeltas: true,
    deltaBranchCount: 3,
    deltaSpreadAngle: Math.PI / 3,
    minFlow: 1.0,
    maxFlow: 100.0,
    widthScale: 0.5
  },
  maxCacheSize: 1000,
  enablePerformanceMetrics: true
};

/**
 * DemoApp - Central coordinator for the demo application
 * 
 * Manages application lifecycle, state, and component communication.
 * Integrates with ChunkManager for world generation and provides
 * reactive state updates through subscription mechanism.
 */
export class DemoApp {
  private state: AppState;
  private subscribers: Set<StateChangeCallback>;
  private eventListeners: Map<AppEvent, Set<EventCallback>>;
  private initialized: boolean;

  constructor() {
    this.initialized = false;
    this.subscribers = new Set();
    this.eventListeners = new Map();
    
    // Initialize state with defaults
    this.state = {
      chunkManager: null,
      loadedChunks: new Map(),
      config: { ...DEFAULT_CONFIG },
      lodManager: null,
      
      cameraPosition: { x: 50, y: 100, z: 50 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      selectedTool: TerrainTool.NONE,
      brushSize: 5,
      brushStrength: 1.0,
      viewDistance: 3, // Default chunk load radius
      
      showTerrain: true,
      showBiomes: true,
      showWater: true,
      showResources: false,
      showStructures: false,
      showChunkBoundaries: false,
      showWireframe: false,
      
      fps: 0,
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
      avgHeight: 0,
      minHeight: 0,
      maxHeight: 0
    };
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('DemoApp already initialized');
      return;
    }

    try {
      // Create ChunkManager with default configuration
      this.state.chunkManager = new ChunkManager(this.state.config);
      
      this.initialized = true;
      console.log('DemoApp initialized successfully');
      
      // Notify subscribers of initial state
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to initialize DemoApp:', error);
      this.emit(AppEvent.ERROR, { message: 'Initialization failed', error });
      throw error;
    }
  }

  /**
   * Get current application state (read-only)
   */
  getState(): Readonly<AppState> {
    return this.state;
  }

  /**
   * Update application state with partial updates
   */
  updateState(partial: Partial<AppState>): void {
    // Check if visibility settings changed
    const visibilityKeys = [
      'showTerrain', 'showBiomes', 'showWater', 'showResources',
      'showStructures', 'showChunkBoundaries', 'showWireframe'
    ];
    
    const visibilityChanged = visibilityKeys.some(key => key in partial);
    
    // Merge partial state into current state
    this.state = {
      ...this.state,
      ...partial
    };
    
    // Notify all subscribers of state change
    this.notifySubscribers();
    this.emit(AppEvent.STATE_CHANGED, this.state);
    
    // Emit visibility change event if visibility settings changed
    if (visibilityChanged) {
      this.emit(AppEvent.VISIBILITY_CHANGED, {
        showTerrain: this.state.showTerrain,
        showBiomes: this.state.showBiomes,
        showWater: this.state.showWater,
        showResources: this.state.showResources,
        showStructures: this.state.showStructures,
        showChunkBoundaries: this.state.showChunkBoundaries,
        showWireframe: this.state.showWireframe
      });
    }
  }

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  subscribeToState(callback: StateChangeCallback): Unsubscribe {
    this.subscribers.add(callback);
    
    // Immediately call with current state
    callback(this.state);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Generate a new world with the given seed
   */
  async generateWorld(seed: number): Promise<void> {
    if (!this.state.chunkManager) {
      throw new Error('ChunkManager not initialized');
    }

    try {
      // Update configuration with new seed
      const newConfig = { ...this.state.config, seed };
      
      // Create new ChunkManager with updated config
      const newManager = new ChunkManager(newConfig);
      
      // Clear existing chunks
      this.state.loadedChunks.clear();
      
      // Update state
      this.updateState({
        chunkManager: newManager,
        config: newConfig,
        loadedChunks: new Map()
      });
      
      // Load initial chunks around origin (3x3 grid)
      await this.loadChunksAround(0, 0, 1);
      
      // Update statistics
      this.updateStatistics();
      
      this.emit(AppEvent.WORLD_GENERATED, { seed });
      console.log(`World generated with seed: ${seed}`);
    } catch (error) {
      console.error('Failed to generate world:', error);
      this.emit(AppEvent.ERROR, { message: 'World generation failed', error });
      throw error;
    }
  }

  /**
   * Load chunks in a radius around a center point
   */
  async loadChunksAround(centerX: number, centerY: number, radius: number): Promise<void> {
    if (!this.state.chunkManager) {
      throw new Error('ChunkManager not initialized');
    }

    const startTime = performance.now();
    let chunksLoaded = 0;

    try {
      // Check if incremental generation is enabled
      const incrementalEnabled = this.state.config.incrementalConfig?.enabled || false;

      // Load chunks in a square grid around center
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const chunkX = centerX + dx;
          const chunkY = centerY + dy;
          const key = this.getChunkKey(chunkX, chunkY);
          
          // Skip if already loaded
          if (this.state.loadedChunks.has(key)) {
            continue;
          }
          
          // Skip if already in progress
          if (this.state.chunksInProgress.has(key)) {
            continue;
          }
          
          if (incrementalEnabled) {
            // Start incremental generation
            const partial = this.state.chunkManager.getChunkIncremental(chunkX, chunkY);
            
            // Track with initial stage
            this.state.chunksInProgress.set(key, partial.stage);
            
            // Emit initial chunk loaded event with partial data
            // The continueIncrementalGeneration() method will handle progressive updates
            this.emit(AppEvent.CHUNK_LOADED, { 
              chunkX, 
              chunkY, 
              chunk: partial.data, 
              partial: true, 
              stage: partial.stage 
            });
            
            chunksLoaded++;
          } else {
            // Generate chunk immediately
            let chunk = await this.state.chunkManager.getChunk(chunkX, chunkY);
            
            // Apply LOD if enabled
            if (this.state.lodManager) {
              const lodLevel = this.getChunkLODLevel(chunkX, chunkY);
              chunk = this.state.lodManager.applyLOD(chunk, lodLevel);
              (chunk as any).lodLevel = lodLevel;
            }
            
            this.state.loadedChunks.set(key, chunk);
            chunksLoaded++;
            
            this.emit(AppEvent.CHUNK_LOADED, { chunkX, chunkY, chunk });
          }
        }
      }
      
      // Update performance metrics
      const endTime = performance.now();
      const avgTime = chunksLoaded > 0 ? (endTime - startTime) / chunksLoaded : 0;
      
      // Update LOD statistics
      if (this.state.lodManager) {
        this.updateChunkLODLevels();
      }
      
      this.updateState({
        loadedChunks: new Map(this.state.loadedChunks),
        loadedChunkCount: this.state.loadedChunks.size,
        avgGenerationTime: avgTime,
        incrementalEnabled,
        chunksInProgress: new Map(this.state.chunksInProgress)
      });
      
      // Only log if chunks were actually loaded
      if (chunksLoaded > 0) {
        console.log(`Loaded ${chunksLoaded} chunks in ${(endTime - startTime).toFixed(2)}ms`);
      }
    } catch (error) {
      console.error('Failed to load chunks:', error);
      this.emit(AppEvent.ERROR, { message: 'Chunk loading failed', error });
      throw error;
    }
  }

  /**
   * Unload chunks that are too far from a center point
   */
  unloadDistantChunks(centerX: number, centerY: number, maxDistance: number): void {
    const chunksToUnload: string[] = [];
    
    // Find chunks beyond max distance
    for (const [key, chunk] of this.state.loadedChunks.entries()) {
      const dx = chunk.x - centerX;
      const dy = chunk.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > maxDistance) {
        chunksToUnload.push(key);
      }
    }
    
    // Unload distant chunks
    for (const key of chunksToUnload) {
      const chunk = this.state.loadedChunks.get(key);
      if (chunk) {
        this.state.loadedChunks.delete(key);
        this.emit(AppEvent.CHUNK_UNLOADED, { chunkX: chunk.x, chunkY: chunk.y });
      }
    }
    
    if (chunksToUnload.length > 0) {
      this.updateState({
        loadedChunks: new Map(this.state.loadedChunks),
        loadedChunkCount: this.state.loadedChunks.size
      });
      
      console.log(`Unloaded ${chunksToUnload.length} distant chunks`);
    }
  }

  /**
   * Continue incremental generation for all chunks in progress
   * Should be called in the render loop
   * Processes a limited number of chunks per frame to avoid blocking
   */
  async continueIncrementalGeneration(): Promise<void> {
    if (!this.state.chunkManager || !this.state.incrementalEnabled) {
      return;
    }

    const chunksToRemove: string[] = [];
    const maxChunksPerFrame = 3; // Limit to 3 chunks per frame to avoid lag
    let processedCount = 0;

    // Continue generation for chunks in progress (limited per frame)
    for (const [key, stage] of this.state.chunksInProgress.entries()) {
      if (processedCount >= maxChunksPerFrame) {
        break; // Stop processing to avoid blocking the main thread
      }
      
      const [chunkX, chunkY] = key.split(',').map(Number);
      
      try {
        // Continue generation for this chunk
        const complete = this.state.chunkManager.continueGeneration(chunkX, chunkY);
        
        // Get updated stage
        const newStage = this.state.chunkManager.getGenerationStage(chunkX, chunkY);
        
        if (complete && newStage !== undefined) {
          // Generation complete - get final chunk
          const chunk = await this.state.chunkManager.getChunk(chunkX, chunkY);
          
          // Apply LOD if enabled
          let finalChunk = chunk;
          if (this.state.lodManager) {
            const lodLevel = this.getChunkLODLevel(chunkX, chunkY);
            finalChunk = this.state.lodManager.applyLOD(chunk, lodLevel);
            (finalChunk as any).lodLevel = lodLevel;
          }
          
          // Move to loaded chunks
          this.state.loadedChunks.set(key, finalChunk);
          chunksToRemove.push(key);
          
          // Emit completion event
          this.emit(AppEvent.CHUNK_LOADED, { chunkX, chunkY, chunk: finalChunk, partial: false });
        } else if (newStage !== undefined && newStage !== stage) {
          // Stage changed - update progress
          this.state.chunksInProgress.set(key, newStage);
          
          // Get partial chunk data
          const partial = this.state.chunkManager.getChunkIncremental(chunkX, chunkY);
          
          // Emit progress event (viewer will skip if heightmap not ready)
          this.emit(AppEvent.CHUNK_LOADED, { chunkX, chunkY, chunk: partial.data, partial: true, stage: newStage });
        }
        
        processedCount++;
      } catch (error) {
        console.error(`Error continuing generation for chunk (${chunkX}, ${chunkY}):`, error);
        chunksToRemove.push(key);
        processedCount++;
      }
    }

    // Remove completed chunks from progress map
    for (const key of chunksToRemove) {
      this.state.chunksInProgress.delete(key);
    }

    // Update state if anything changed
    if (chunksToRemove.length > 0) {
      this.updateState({
        loadedChunks: new Map(this.state.loadedChunks),
        loadedChunkCount: this.state.loadedChunks.size,
        chunksInProgress: new Map(this.state.chunksInProgress)
      });
    }
  }

  /**
   * Update Worker Pool configuration
   */
  updateEngineConfig(config: Partial<WorldConfig>): void {
    const newConfig = {
      ...this.state.config,
      ...config
    };
    
    // Shut down existing worker pool if we're recreating the ChunkManager
    const shouldRecreateManager = 
      'incrementalConfig' in config ||
      'maxCacheSize' in config ||
      'workerPoolConfig' in config;
    
    if (shouldRecreateManager) {
      // Shut down old worker pool to prevent memory leaks and hanging workers
      const oldManager = this.state.chunkManager as any;
      if (oldManager?.workerPool) {
        console.log('[DemoApp] Shutting down old worker pool');
        oldManager.workerPool.shutdown();
      }
    }
    
    if (shouldRecreateManager && !('workerPoolConfig' in config)) {
      // Simple recreation for non-worker-pool changes
      this.state.chunkManager = new ChunkManager(newConfig);
    }
    
    // Update LOD manager if LOD config changed
    let lodManager = this.state.lodManager;
    if ('lodConfig' in config) {
      if (config.lodConfig) {
        lodManager = new LODManager(config.lodConfig);
      } else {
        lodManager = null;
      }
    }
    
    // Update worker pool enabled state with fallback handling
    let workerPoolEnabled = !!config.workerPoolConfig;
    if ('workerPoolConfig' in config && config.workerPoolConfig) {
      try {
        // Try to initialize worker pool
        this.state.chunkManager = new ChunkManager(newConfig);
        workerPoolEnabled = true;
      } catch (error) {
        console.error('Failed to initialize Worker Pool, falling back to single-threaded:', error);
        // Fall back to single-threaded by removing worker pool config
        newConfig.workerPoolConfig = undefined;
        this.state.chunkManager = new ChunkManager(newConfig);
        workerPoolEnabled = false;
        
        // Emit error event for fallback notification
        this.emit(AppEvent.ERROR, { 
          message: 'Worker Pool initialization failed. Using single-threaded generation.', 
          error,
          category: 'worker_pool',
          fallback: true
        });
      }
    } else if ('workerPoolConfig' in config && !config.workerPoolConfig) {
      // Worker pool is being disabled - recreate without it
      this.state.chunkManager = new ChunkManager(newConfig);
      workerPoolEnabled = false;
    }
    
    // Update incremental generation enabled state
    const incrementalEnabled = config.incrementalConfig?.enabled || false;
    
    this.updateState({ 
      config: newConfig, 
      lodManager,
      workerPoolEnabled,
      incrementalEnabled
    });
    this.emit(AppEvent.CONFIG_CHANGED, newConfig);
  }

  /**
   * Get worker pool statistics from ChunkManager
   */
  getWorkerPoolStats(): { activeWorkers: number; queuedTasks: number; completedTasks: number; avgWorkerTime: number } {
    // Access the worker pool through ChunkManager's private property
    // In a real implementation, ChunkManager would expose a getWorkerPoolStats() method
    const chunkManager = this.state.chunkManager as any;
    
    if (!chunkManager || !chunkManager.workerPool) {
      return {
        activeWorkers: 0,
        queuedTasks: 0,
        completedTasks: 0,
        avgWorkerTime: 0
      };
    }
    
    const stats = chunkManager.workerPool.getStats();
    
    // Calculate average worker time (simplified - in real implementation would track timing)
    const avgWorkerTime = stats.completedTasks > 0 
      ? this.state.avgGenerationTime 
      : 0;
    
    return {
      activeWorkers: stats.activeWorkers,
      queuedTasks: stats.queuedTasks,
      completedTasks: stats.completedTasks,
      avgWorkerTime
    };
  }

  /**
   * Update worker pool statistics in state
   */
  updateWorkerPoolStats(): void {
    if (!this.state.workerPoolEnabled) {
      return;
    }
    
    const stats = this.getWorkerPoolStats();
    
    this.updateState({
      activeWorkers: stats.activeWorkers,
      queuedTasks: stats.queuedTasks,
      completedTasks: stats.completedTasks,
      avgWorkerTime: stats.avgWorkerTime
    });
  }

  /**
   * Update camera position and recalculate LOD levels if needed
   */
  updateCameraPosition(position: Vector3): void {
    this.updateState({ cameraPosition: position });
    
    // If LOD is enabled, update chunk LOD levels based on new camera position
    if (this.state.lodManager) {
      this.updateChunkLODLevels();
    }
  }

  /**
   * Handle mouse click for terrain editing
   * Performs raycasting and applies terrain modification if a tool is selected
   * 
   * @param screenX - Screen X coordinate in pixels
   * @param screenY - Screen Y coordinate in pixels
   * @param viewer - WorldViewer instance for raycasting
   * @param editor - TerrainEditor instance for applying modifications
   */
  handleTerrainClick(screenX: number, screenY: number, viewer: any, editor: any): void {
    // Check if a tool is selected
    if (this.state.selectedTool === TerrainTool.NONE) {
      return;
    }

    // Perform raycasting to find terrain hit
    const hit = viewer.raycastTerrain(screenX, screenY);
    
    if (!hit) {
      return;
    }

    // Apply brush at hit position
    const worldX = Math.floor(hit.point.x);
    const worldY = Math.floor(hit.point.z);
    
    const startTime = performance.now();
    editor.applyBrush(worldX, worldY);
    const endTime = performance.now();
    
    // Log performance (should be < 100ms per requirement 12.8)
    const updateTime = endTime - startTime;
    console.log(`Terrain modification completed in ${updateTime.toFixed(2)}ms`);
    
    if (updateTime > 100) {
      console.warn(`Terrain update exceeded 100ms threshold: ${updateTime.toFixed(2)}ms`);
    }
  }

  /**
   * Handle mouse move for brush preview
   * Updates brush preview position based on terrain raycasting
   * 
   * @param screenX - Screen X coordinate in pixels
   * @param screenY - Screen Y coordinate in pixels
   * @param viewer - WorldViewer instance for raycasting
   * @param editor - TerrainEditor instance for preview updates
   */
  handleMouseMove(screenX: number, screenY: number, viewer: any, editor: any): void {
    // Only show preview if a tool is selected
    if (this.state.selectedTool === TerrainTool.NONE) {
      editor.hideBrushPreview();
      return;
    }

    // Perform raycasting to find terrain hit
    const hit = viewer.raycastTerrain(screenX, screenY);
    
    if (!hit) {
      editor.hideBrushPreview();
      return;
    }

    // Update brush preview position
    const worldX = hit.point.x;
    const worldY = hit.point.z;
    editor.showBrushPreview(worldX, worldY);
  }

  /**
   * Update LOD levels for all loaded chunks based on camera position
   */
  private updateChunkLODLevels(): void {
    if (!this.state.lodManager) return;

    const chunkSize = this.state.config.chunkSize || 32;
    const cameraChunkX = Math.floor(this.state.cameraPosition.x / chunkSize);
    const cameraChunkY = Math.floor(this.state.cameraPosition.z / chunkSize);

    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    // Calculate LOD level for each loaded chunk
    for (const [, chunk] of this.state.loadedChunks.entries()) {
      const level = this.state.lodManager.getLODLevel(
        chunk.x,
        chunk.y,
        cameraChunkX,
        cameraChunkY
      );

      // Count chunks at each LOD level
      if (level === LODLevel.HIGH) {
        highCount++;
      } else if (level === LODLevel.MEDIUM) {
        mediumCount++;
      } else {
        lowCount++;
      }

      // Store LOD level in chunk metadata for rendering
      (chunk as any).lodLevel = level;
    }

    // Update LOD statistics
    this.updateState({
      lodHighCount: highCount,
      lodMediumCount: mediumCount,
      lodLowCount: lowCount
    });
  }

  /**
   * Get LOD level for a specific chunk
   */
  getChunkLODLevel(chunkX: number, chunkY: number): LODLevel {
    if (!this.state.lodManager) {
      return LODLevel.HIGH;
    }

    const chunkSize = this.state.config.chunkSize || 32;
    const cameraChunkX = Math.floor(this.state.cameraPosition.x / chunkSize);
    const cameraChunkY = Math.floor(this.state.cameraPosition.z / chunkSize);

    return this.state.lodManager.getLODLevel(chunkX, chunkY, cameraChunkX, cameraChunkY);
  }

  /**
   * Update statistics from loaded chunks
   */
  private updateStatistics(): void {
    const biomeDistribution = new Map<BiomeType, number>();
    const resourceCounts = new Map<ResourceType, number>();
    const structureCounts = new Map<StructureType, number>();
    let totalHeight = 0;
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    let totalTiles = 0;
    
    // Aggregate statistics from all loaded chunks
    for (const chunk of this.state.loadedChunks.values()) {
      // Count biomes
      for (let i = 0; i < chunk.biomeMap.length; i++) {
        const biome = chunk.biomeMap[i];
        biomeDistribution.set(biome, (biomeDistribution.get(biome) || 0) + 1);
      }
      
      // Count resources
      for (const resource of chunk.resources) {
        resourceCounts.set(resource.type, (resourceCounts.get(resource.type) || 0) + 1);
      }
      
      // Count structures
      for (const structure of chunk.structures) {
        structureCounts.set(structure.type, (structureCounts.get(structure.type) || 0) + 1);
      }
      
      // Calculate height statistics
      for (let i = 0; i < chunk.heightmap.length; i++) {
        const height = chunk.heightmap[i];
        totalHeight += height;
        minHeight = Math.min(minHeight, height);
        maxHeight = Math.max(maxHeight, height);
        totalTiles++;
      }
    }
    
    const avgHeight = totalTiles > 0 ? totalHeight / totalTiles : 0;
    
    this.updateState({
      biomeDistribution,
      resourceCounts,
      structureCounts,
      avgHeight,
      minHeight: minHeight === Infinity ? 0 : minHeight,
      maxHeight: maxHeight === -Infinity ? 0 : maxHeight
    });
  }

  /**
   * Register event listener
   */
  on(event: AppEvent, callback: EventCallback): Unsubscribe {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)!.add(callback);
    
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: AppEvent, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Notify all state subscribers
   */
  private notifySubscribers(): void {
    for (const callback of this.subscribers) {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    }
  }

  /**
   * Generate chunk key for map storage
   */
  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.subscribers.clear();
    this.eventListeners.clear();
    this.state.loadedChunks.clear();
    this.state.chunkManager = null;
    this.initialized = false;
    
    console.log('DemoApp destroyed');
  }
}
