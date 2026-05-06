/**
 * WorldApp - Core application class for the tQandtD world app
 * 
 * Manages application state, coordinates components, and integrates with the
 * procedural world generation engine. Provides state management with reactive
 * updates, chunk loading coordination, and event system for component communication.
 */

import { ChunkManager, WorldConfig, ChunkData, BiomeType, ResourceType, StructureType, configureLogger, LogLevel, DEFAULT_RIVER_CONFIG } from '@engine/index';

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
  terrainTexturesEnabled: boolean;
  fogOfWarEnabled: boolean; // Show explored chunks as gray planes
  skyBackground: boolean;   // true = UI-matched haze, false = legacy blue sky
  
  // Chunk tracking
  exploredChunks: Set<string>; // Chunks that have been visited
  
  // Performance metrics
  fps: number;
  avgGenerationTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  loadedChunkCount: number;
  renderedVertexCount: number;
  
  // Worker pool statistics
  workerPoolEnabled: boolean;
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  avgWorkerTime: number;
  
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
  CHUNK_UPDATED = 'chunk_updated',
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
    heightMultiplier: 2.0,
    enable3D: false,
    zScale: 0.5,
    enableContinentalness: true,
    continentalScale: 0.002,
    continentalStrength: 0.45,
  },
  biomeConfig: {
    temperatureScale: 0.001,
    moistureScale: 0.001,
    blendRadius: 0.5
  },
  enhancedBiomeConfig: {
    temperatureScale: 0.001,
    moistureScale: 0.001,
    blendRadius: 0.5,
    enableTransitions: false,
    transitionWidth: 4,
    enableElevationBands: true,
    snowLineElevation: 0.8,
    treeLineElevation: 0.75,
    enableMicroBiomes: true,
    microBiomeFrequency: 0.10,
    microBiomeMaxSize: 20,
    depressionDepthThreshold: 0.05,
    clearingGradientThreshold: 0.03
  },
  resourceConfig: {
    types: [
      { type: 0, rarity: 0.5, biomes: [6, 7, 8], minAmount: 1, maxAmount: 5 }, // Iron - Mountains, Tundra, Taiga
      { type: 1, rarity: 0.5, biomes: [6, 7], minAmount: 1, maxAmount: 3 }, // Gold - Mountains, Tundra
      { type: 2, rarity: 0.5, biomes: [3, 4, 5, 6], minAmount: 2, maxAmount: 6 }, // Coal - Plains, Forest, Taiga, Mountains
      { type: 3, rarity: 0.5, biomes: [6, 7, 8], minAmount: 3, maxAmount: 8 }, // Stone - Mountains, Tundra, Desert
      { type: 4, rarity: 0.5, biomes: [4, 5, 9], minAmount: 1, maxAmount: 4 }  // Wood - Forest, Taiga, Swamp
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
  lakeConfig: {
    enabled: true,
    useMultiChunk: true,  // Changed to true by default
    noiseScale: 0.01,
    noiseThreshold: 0.62,
    minElevation: 0.32,
    maxElevation: 0.72,
    allowedBiomes: [3, 4, 5, 6, 7, 8, 9], // PLAINS, FOREST, TAIGA, TUNDRA, MOUNTAIN, SWAMP, SAVANNA
    maxLakeTiles: 80,
    maxFillDepth: 0.06,
  },
  riverConfig: DEFAULT_RIVER_CONFIG,
  maxCacheSize: 1000,
  enablePerformanceMetrics: true
};

/**
 * WorldApp - Central coordinator for the world application
 * 
 * Manages application lifecycle, state, and component communication.
 * Integrates with ChunkManager for world generation and provides
 * reactive state updates through subscription mechanism.
 */
export class WorldApp {
  private state: AppState;
  private subscribers: Set<StateChangeCallback>;
  private eventListeners: Map<AppEvent, Set<EventCallback>>;
  private initialized: boolean;
  private isUpdatingConfig: boolean; // Prevent recursive config updates
  private invalidatingChunks: Set<string>;

  constructor() {
    this.initialized = false;
    this.subscribers = new Set();
    this.eventListeners = new Map();
    this.isUpdatingConfig = false;
    this.invalidatingChunks = new Set();
    
    // Initialize state with defaults
    this.state = {
      chunkManager: null,
      loadedChunks: new Map(),
      config: { ...DEFAULT_CONFIG },
      
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
      terrainTexturesEnabled: true,
      fogOfWarEnabled: false,
      skyBackground: false,
      
      exploredChunks: new Set(),
      
      fps: 0,
      avgGenerationTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      loadedChunkCount: 0,
      renderedVertexCount: 0,
      
      workerPoolEnabled: false,
      activeWorkers: 0,
      queuedTasks: 0,
      completedTasks: 0,
      avgWorkerTime: 0,
      
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
      console.warn('WorldApp already initialized');
      return;
    }

    try {
      // Configure logger based on environment
      // In development: show INFO and above
      // In production: show WARN and above (default)
      const isDevelopment = import.meta.env?.DEV ?? false;
      configureLogger({
        level: isDevelopment ? LogLevel.INFO : LogLevel.WARN,
        timestamps: isDevelopment,
      });
      
      // Create ChunkManager with default configuration
      const initConfig = {
        ...this.state.config,
        noise3DConfig: this.buildNoise3DConfig(this.state.config.terrainConfig),
        onChunkInvalidated: (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY),
      };
      this.state.chunkManager = new ChunkManager(initConfig);
      this.state.config = initConfig;
      
      this.initialized = true;
      console.log('WorldApp initialized successfully');
      
      // Notify subscribers of initial state
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to initialize WorldApp:', error);
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
      'showStructures', 'showChunkBoundaries', 'showWireframe', 'fogOfWarEnabled',
      'terrainTexturesEnabled', 'skyBackground'
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
        showWireframe: this.state.showWireframe,
        terrainTexturesEnabled: this.state.terrainTexturesEnabled,
        fogOfWarEnabled: this.state.fogOfWarEnabled,
        skyBackground: this.state.skyBackground,
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
      const newConfig = {
        ...this.state.config,
        seed,
        noise3DConfig: this.buildNoise3DConfig(this.state.config.terrainConfig),
        onChunkInvalidated: (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY),
      };
      
      // Create new ChunkManager with updated config
      const newManager = new ChunkManager(newConfig);
      
      // Clear existing chunks and explored chunks
      this.state.loadedChunks.clear();
      this.state.exploredChunks.clear();
      
      // Update state
      this.updateState({
        chunkManager: newManager,
        config: newConfig,
        loadedChunks: new Map(),
        exploredChunks: new Set()
      });
      
      // Emit event to clear fog of war in viewer
      this.emit(AppEvent.WORLD_GENERATED, { seed });
      
      // Load initial chunks around origin (3x3 grid)
      await this.loadChunksAround(0, 0, 1);
      
      // Update statistics
      this.updateStatistics();
      
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
          
          // Generate chunk directly
          const chunk = await this.state.chunkManager.getChunk(chunkX, chunkY);
          
          this.state.loadedChunks.set(key, chunk);
          this.state.exploredChunks.add(key); // Mark as explored
          chunksLoaded++;
          
          this.emit(AppEvent.CHUNK_LOADED, { chunkX, chunkY, chunk });
        }
      }
      
      // Update performance metrics
      const endTime = performance.now();
      const avgTime = chunksLoaded > 0 ? (endTime - startTime) / chunksLoaded : 0;
      
      if (chunksLoaded > 0) {
        this.updateState({
          loadedChunks: new Map(this.state.loadedChunks),
          loadedChunkCount: this.state.loadedChunks.size,
          avgGenerationTime: avgTime,
        });
      }
      
      // Only log if chunks were actually loaded (and more than 5 chunks)
      if (chunksLoaded > 5) {
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
    
    // Find chunks beyond max distance using Chebyshev distance (matches square grid loading)
    for (const [key, chunk] of this.state.loadedChunks.entries()) {
      const dx = Math.abs(chunk.x - centerX);
      const dy = Math.abs(chunk.y - centerY);
      const distance = Math.max(dx, dy); // Chebyshev distance for square grid
      
      if (distance > maxDistance) {
        chunksToUnload.push(key);
      }
    }
    
    // Unload distant chunks
    for (const key of chunksToUnload) {
      const chunk = this.state.loadedChunks.get(key);
      if (chunk) {
        this.state.loadedChunks.delete(key);
        
        // Emit unload event with fog of war flag
        this.emit(AppEvent.CHUNK_UNLOADED, { 
          chunkX: chunk.x, 
          chunkY: chunk.y,
          keepFogOfWar: this.state.fogOfWarEnabled 
        });
      }
    }
    
    if (chunksToUnload.length > 5) {
      this.updateState({
        loadedChunks: new Map(this.state.loadedChunks),
        loadedChunkCount: this.state.loadedChunks.size
      });
      
      console.log(`Unloaded ${chunksToUnload.length} distant chunks`);
    } else if (chunksToUnload.length > 0) {
      this.updateState({
        loadedChunks: new Map(this.state.loadedChunks),
        loadedChunkCount: this.state.loadedChunks.size
      });
    }
  }

  /**
   * Refresh a visible chunk after cross-chunk lake generation invalidates it.
   * This keeps terrain carving and lake water meshes aligned at chunk borders.
   */
  private handleChunkInvalidated(chunkX: number, chunkY: number): void {
    const key = this.getChunkKey(chunkX, chunkY);
    if (!this.state.loadedChunks.has(key) || this.invalidatingChunks.has(key)) {
      return;
    }

    const manager = this.state.chunkManager;
    if (!manager) {
      return;
    }

    this.invalidatingChunks.add(key);

    queueMicrotask(async () => {
      try {
        if (this.state.chunkManager !== manager || !this.state.loadedChunks.has(key)) {
          return;
        }

        const chunk = await manager.getChunk(chunkX, chunkY);

        if (this.state.chunkManager !== manager || !this.state.loadedChunks.has(key)) {
          return;
        }

        this.state.loadedChunks.set(key, chunk);
        this.updateState({
          loadedChunks: new Map(this.state.loadedChunks),
        });
        this.emit(AppEvent.CHUNK_UPDATED, { chunkX, chunkY, chunk });
      } catch (error) {
        console.error(`Failed to refresh invalidated chunk (${chunkX}, ${chunkY}):`, error);
        this.emit(AppEvent.ERROR, { message: 'Chunk refresh failed', error });
      } finally {
        this.invalidatingChunks.delete(key);
      }
    });
  }

  /**
   * Builds noise3DConfig from terrainConfig fields (enable3D, zScale).
   * ChunkManager expects a separate noise3DConfig object, but the UI stores
   * these values inside terrainConfig for simplicity.
   */
  private buildNoise3DConfig(terrainConfig: WorldConfig['terrainConfig']): WorldConfig['noise3DConfig'] | undefined {
    if (!terrainConfig.enable3D) return undefined;
    return {
      enable3D: true,
      octaves: terrainConfig.octaves,
      persistence: terrainConfig.persistence,
      lacunarity: terrainConfig.lacunarity,
      scale: terrainConfig.baseScale,
      zScale: terrainConfig.zScale ?? 0.5,
    };
  }

  /**
   * Update Worker Pool configuration
   */
  updateEngineConfig(config: Partial<WorldConfig>): void {
    // Prevent recursive calls
    if (this.isUpdatingConfig) {
      console.warn('[WorldApp] Ignoring recursive updateEngineConfig call');
      console.trace('[WorldApp] Recursive call stack:');
      return;
    }
    
    // Log ALL calls to updateEngineConfig with stack trace
    console.log('[WorldApp] updateEngineConfig called with:', Object.keys(config));
    console.trace('[WorldApp] Call stack:');
    
    this.isUpdatingConfig = true;
    
    try {
      const newConfig = {
        ...this.state.config,
        ...config
      };

      // Always rebuild noise3DConfig from terrainConfig so enable3D / zScale are honoured
      newConfig.noise3DConfig = this.buildNoise3DConfig(newConfig.terrainConfig);
      newConfig.onChunkInvalidated = (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY);

      // Check if this requires recreating the ChunkManager
      const shouldRecreateManager =
        'terrainConfig' in config ||
        'biomeConfig' in config ||
        'enhancedBiomeConfig' in config ||
        'resourceConfig' in config ||
        'structureConfig' in config ||
        'lakeConfig' in config ||
        'riverConfig' in config ||
        'noise3DConfig' in config ||
        'seed' in config ||
        'chunkSize' in config ||
        'maxCacheSize' in config ||
        'workerPoolConfig' in config;
      
      // If not recreating manager, just update config and return
      if (!shouldRecreateManager) {
        this.updateState({ config: newConfig });
        this.emit(AppEvent.CONFIG_CHANGED, newConfig);
        return;
      }
      
      // Shut down old worker pool to prevent memory leaks
      const oldManager = this.state.chunkManager as any;
      if (oldManager?.workerPool) {
        console.log('[WorldApp] Shutting down old worker pool');
        oldManager.workerPool.shutdown();
      }
      
      // Handle worker pool configuration
      let workerPoolEnabled = !!newConfig.workerPoolConfig;
      
      if ('workerPoolConfig' in config) {
        if (config.workerPoolConfig) {
          // Enabling or updating worker pool
          try {
            const newManager = new ChunkManager(newConfig);
            
            // Check if worker pool was actually created and initialized
            const workerPool = (newManager as any).workerPool;
            const initializationError = workerPool?.getInitializationError?.();
            if (initializationError) {
              throw initializationError;
            }
            
            this.state.chunkManager = newManager;
            workerPoolEnabled = true;
            console.log('[WorldApp] Worker pool enabled successfully');
          } catch (error) {
            console.error('Failed to initialize Worker Pool, falling back to single-threaded:', error);
            newConfig.workerPoolConfig = undefined;
            this.state.chunkManager = new ChunkManager(newConfig);
            workerPoolEnabled = false;
            
            this.emit(AppEvent.ERROR, { 
              message: 'Worker Pool initialization failed. Using single-threaded generation.', 
              error,
              category: 'worker_pool',
              fallback: true
            });
          }
        } else {
          // Disabling worker pool
          this.state.chunkManager = new ChunkManager(newConfig);
          workerPoolEnabled = false;
          console.log('[WorldApp] Worker pool disabled');
        }
      } else {
        // Other config changes that require manager recreation
        this.state.chunkManager = new ChunkManager(newConfig);
      }
      
      this.updateState({ 
        config: newConfig,
        workerPoolEnabled,
      });
      this.emit(AppEvent.CONFIG_CHANGED, newConfig);
    } finally {
      this.isUpdatingConfig = false;
    }
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
   * Update camera position
   */
  updateCameraPosition(position: Vector3): void {
    const current = this.state.cameraPosition;
    if (
      Math.abs(current.x - position.x) < 0.001 &&
      Math.abs(current.y - position.y) < 0.001 &&
      Math.abs(current.z - position.z) < 0.001
    ) {
      return;
    }

    this.updateState({ cameraPosition: position });
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
    
    console.log('WorldApp destroyed');
  }
}
