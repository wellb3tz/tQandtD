/**
 * WorldApp - Core application class for the tQandtD world app
 * 
 * Manages application state, coordinates components, and integrates with the
 * procedural world generation engine. Provides state management with reactive
 * updates, chunk loading coordination, and event system for component communication.
 */

import {
  ChunkManager,
  WorldSession,
  WorldConfig,
  ChunkData,
  BiomeType,
  ResourceType,
  StructureType,
  configureLogger,
  LogLevel,
  SerializationOptions,
  SerializedWorld,
  WorldSessionCacheStats,
  WorldSessionWorldStats,
  cloneWorldConfig,
  createDefaultWorldConfig,
  prepareWorldConfig,
  WorldConfigOverrides,
} from '@engine/index';

/**
 * 3D vector for camera position and target
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
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

export interface AppWorldExportResult {
  data: Blob | string;
  serializedWorld: SerializedWorld;
  checksum: string;
}

export interface AppWorkerPoolStats {
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  avgWorkerTime: number;
}

/**
 * Event types for component communication
 */
export enum AppEvent {
  CHUNK_LOADED = 'chunk_loaded',
  CHUNK_UPDATED = 'chunk_updated',
  CHUNK_UNLOADED = 'chunk_unloaded',
  WORLD_GENERATED = 'world_generated',
  WORLD_LOADED = 'world_loaded',
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
  private worldSession: WorldSession | null;
  private worldSessionUnsubscribers: Array<() => void>;

  constructor() {
    this.initialized = false;
    this.subscribers = new Set();
    this.eventListeners = new Map();
    this.isUpdatingConfig = false;
    this.invalidatingChunks = new Set();
    this.worldSession = null;
    this.worldSessionUnsubscribers = [];
    
    // Initialize state with defaults
    this.state = {
      chunkManager: null,
      loadedChunks: new Map(),
      config: createDefaultWorldConfig(),
      
      cameraPosition: { x: 50, y: 100, z: 50 },
      cameraTarget: { x: 0, y: 0, z: 0 },
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
      const initConfig = prepareWorldConfig(this.state.config, {
        onChunkInvalidated: (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY),
      });
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

  getConfigSnapshot(): WorldConfig {
    return cloneWorldConfig(this.state.config);
  }

  getWorld(): ChunkManager | null {
    return this.state.chunkManager;
  }

  getLoadedChunkCount(): number {
    const session = this.getActiveWorldSession();
    return session?.getLoadedChunkCount() ?? this.state.loadedChunks.size;
  }

  getLoadedChunksSnapshot(): Map<string, ChunkData> {
    const session = this.getActiveWorldSession();
    return session?.getLoadedChunksSnapshot() ?? new Map(this.state.loadedChunks);
  }

  getCacheStats(): WorldSessionCacheStats {
    const session = this.getActiveWorldSession();
    if (session) {
      return session.getCacheStats();
    }

    return this.state.chunkManager?.getCacheStats() ?? {
      size: 0,
      maxSize: this.state.config.maxCacheSize ?? 0,
      hitRate: 0,
    };
  }

  getWorldStats(): WorldSessionWorldStats {
    const session = this.getActiveWorldSession();
    return session?.getWorldStats() ?? calculateWorldStats(this.state.loadedChunks);
  }

  getApproximateMemoryUsage(): number {
    const bytesPerChunk = 6580;
    return this.getLoadedChunkCount() * bytesPerChunk;
  }

  getDominantBiomeName(): string | null {
    const stats = this.getWorldStats();
    if (stats.biomeDistribution.size === 0) {
      return null;
    }

    const biomeNames: Record<number, string> = {
      0: 'Ocean',
      1: 'Beach',
      2: 'Desert',
      3: 'Plains',
      4: 'Forest',
      5: 'Taiga',
      6: 'Tundra',
      7: 'Mountain',
      8: 'Savanna',
      9: 'Swamp',
      10: 'Rainforest',
      11: 'Volcanic',
      12: 'Glacier',
    };

    let maxCount = 0;
    let dominantBiome: string | null = null;
    stats.biomeDistribution.forEach((count, biome) => {
      if (count > maxCount) {
        maxCount = count;
        dominantBiome = biomeNames[biome] ?? null;
      }
    });

    return dominantBiome;
  }

  getViewDistance(): number {
    return this.state.viewDistance;
  }

  getSeed(): number {
    return this.state.config.seed;
  }

  isWorkerPoolEnabled(): boolean {
    return this.state.workerPoolEnabled;
  }

  syncWorldSession(session: WorldSession | null): void {
    const world = this.state.chunkManager;
    if (!world || !session || session.getWorld() === world) {
      return;
    }

    session.setWorld(world);
    this.attachWorldSession(session);
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

  attachWorldSession(session: WorldSession | null): void {
    this.detachWorldSessionEvents();
    this.worldSession = session;
    if (session) {
      this.worldSessionUnsubscribers = [
        session.on('chunk_loaded', ({ coordinate, chunk }) => {
          this.emit(AppEvent.CHUNK_LOADED, {
            chunkX: coordinate.x,
            chunkY: coordinate.y,
            chunk,
          });
        }),
        session.on('chunk_unloaded', ({ coordinate }) => {
          this.emit(AppEvent.CHUNK_UNLOADED, {
            chunkX: coordinate.x,
            chunkY: coordinate.y,
            keepFogOfWar: this.state.fogOfWarEnabled,
          });
        }),
        session.on('chunk_updated', ({ coordinate, chunk }) => {
          this.syncLoadedChunksFromSession();
          this.updateState({
            loadedChunks: new Map(this.state.loadedChunks),
          });
          this.emit(AppEvent.CHUNK_UPDATED, {
            chunkX: coordinate.x,
            chunkY: coordinate.y,
            chunk,
          });
        }),
        session.on('world_changed', () => {
          this.syncLoadedChunksFromSession();
        }),
        session.on('world_loaded', ({ config, world }) => {
          this.state.chunkManager = world;
          this.state.config = config;
          this.syncLoadedChunksFromSession();
        }),
        session.on('config_changed', ({ config, world }) => {
          this.state.chunkManager = world;
          this.state.config = config;
          this.syncLoadedChunksFromSession();
        }),
      ];
    }
    this.syncLoadedChunksFromSession();
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
      const newConfig = prepareWorldConfig(this.state.config, {
        seed,
        onChunkInvalidated: (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY),
      });
      
      const session = this.getActiveWorldSession();
      const newManager = session
        ? session.regenerate({ config: newConfig, seed })
        : new ChunkManager(newConfig);

      if (!session) {
        this.state.chunkManager.dispose();
      }
      
      // Clear existing chunks and explored chunks
      this.state.loadedChunks.clear();
      this.state.exploredChunks.clear();
      
      // Update state
      this.updateState({
        chunkManager: newManager,
        config: newManager.config,
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

  exportWorld(options: SerializationOptions): AppWorldExportResult {
    const chunkManager = this.state.chunkManager;
    if (!chunkManager) {
      throw new Error('No chunk manager available');
    }

    const session = this.getActiveWorldSession();
    if (session) {
      return session.exportWorld(options);
    }

    const serializedWorld = chunkManager.saveWorld(options);
    return {
      data: chunkManager.exportWorld(options),
      serializedWorld,
      checksum: serializedWorld.checksum,
    };
  }

  loadSerializedWorld(serializedWorld: SerializedWorld): ChunkManager {
    const previousManager = this.state.chunkManager;
    const session = this.getActiveWorldSession();
    let nextManager: ChunkManager;

    if (session) {
      nextManager = session.loadWorld(serializedWorld);
    } else {
      nextManager = new ChunkManager(serializedWorld.config);
      try {
        nextManager.loadWorld(serializedWorld);
      } catch (error) {
        nextManager.dispose();
        throw error;
      }
      previousManager?.dispose();
    }

    this.invalidatingChunks.clear();
    this.updateState({
      chunkManager: nextManager,
      config: nextManager.config,
      loadedChunks: new Map(),
      exploredChunks: new Set(),
      loadedChunkCount: 0,
    });
    this.emit(AppEvent.WORLD_LOADED, {
      seed: serializedWorld.seed,
      chunkManager: nextManager,
      serializedWorld,
    });
    return nextManager;
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
      const session = this.getActiveWorldSession();

      if (session) {
        const result = await session.loadChunksAround(centerX, centerY, radius);
        chunksLoaded = result.loaded.length;
        this.syncLoadedChunksFromSession();
      } else {
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
    const session = this.getActiveWorldSession();
    let chunksUnloaded = 0;

    if (session) {
      const result = session.unloadDistantChunks(centerX, centerY, maxDistance, {
        syncRenderer: !this.state.fogOfWarEnabled,
      });
      chunksUnloaded = result.unloaded.length;
      this.syncLoadedChunksFromSession();
    } else {
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

      chunksUnloaded = chunksToUnload.length;
    }

    if (chunksUnloaded > 5) {
      this.updateState({
        loadedChunks: new Map(this.state.loadedChunks),
        loadedChunkCount: this.state.loadedChunks.size
      });
      
      console.log(`Unloaded ${chunksUnloaded} distant chunks`);
    } else if (chunksUnloaded > 0) {
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

        const session = this.getActiveWorldSession();
        const chunk = session
          ? await session.refreshChunk({ x: chunkX, y: chunkY }, { syncRenderer: false })
          : await manager.getChunk(chunkX, chunkY);

        if (this.state.chunkManager !== manager || !this.state.loadedChunks.has(key) || !chunk) {
          return;
        }

        if (session) {
          this.syncLoadedChunksFromSession();
        } else {
          this.state.loadedChunks.set(key, chunk);
          this.updateState({
            loadedChunks: new Map(this.state.loadedChunks),
          });
          this.emit(AppEvent.CHUNK_UPDATED, { chunkX, chunkY, chunk });
        }
      } catch (error) {
        console.error(`Failed to refresh invalidated chunk (${chunkX}, ${chunkY}):`, error);
        this.emit(AppEvent.ERROR, { message: 'Chunk refresh failed', error });
      } finally {
        this.invalidatingChunks.delete(key);
      }
    });
  }

  /**
   * Update Worker Pool configuration
   */
  updateEngineConfig(config: WorldConfigOverrides): void {
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
      const newConfig = prepareWorldConfig(this.state.config, {
        ...config,
        onChunkInvalidated: (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY),
      });

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
      
      // Handle worker pool configuration
      let workerPoolEnabled = !!newConfig.workerPoolConfig;
      const session = this.getActiveWorldSession();
      
      if (session) {
        const result = session.updateConfig(newConfig, {
          fallbackOnWorkerPoolError: 'workerPoolConfig' in config && !!config.workerPoolConfig,
        });
        this.state.chunkManager = result.world;
        workerPoolEnabled = result.workerPoolEnabled;

        if (result.usedWorkerPoolFallback && result.workerPoolInitializationError) {
          newConfig.workerPoolConfig = undefined;
          console.error(
            'Failed to initialize Worker Pool, falling back to single-threaded:',
            result.workerPoolInitializationError
          );
          this.emit(AppEvent.ERROR, { 
            message: 'Worker Pool initialization failed. Using single-threaded generation.', 
            error: result.workerPoolInitializationError,
            category: 'worker_pool',
            fallback: true
          });
        }

        Object.assign(newConfig, result.config);
      } else if ('workerPoolConfig' in config) {
        const previousManager = this.state.chunkManager;
        if (config.workerPoolConfig) {
          // Enabling or updating worker pool
          try {
            const newManager = new ChunkManager(newConfig);
            
            // Check if worker pool was actually created and initialized
            const initializationError = newManager.getWorkerPoolInitializationError();
            if (initializationError) {
              throw initializationError;
            }
            
            previousManager?.dispose();
            this.state.chunkManager = newManager;
            workerPoolEnabled = true;
            console.log('[WorldApp] Worker pool enabled successfully');
          } catch (error) {
            console.error('Failed to initialize Worker Pool, falling back to single-threaded:', error);
            newConfig.workerPoolConfig = undefined;
            const fallbackManager = new ChunkManager(newConfig);
            previousManager?.dispose();
            this.state.chunkManager = fallbackManager;
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
          const newManager = new ChunkManager(newConfig);
          previousManager?.dispose();
          this.state.chunkManager = newManager;
          workerPoolEnabled = false;
          console.log('[WorldApp] Worker pool disabled');
        }
      } else {
        // Other config changes that require manager recreation
        const previousManager = this.state.chunkManager;
        const newManager = new ChunkManager(newConfig);
        previousManager?.dispose();
        this.state.chunkManager = newManager;
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

  applyWorldConfig(config: WorldConfigOverrides): void {
    this.updateEngineConfig(config);
  }

  /**
   * Get worker pool statistics from ChunkManager
   */
  getWorkerPoolStats(): AppWorkerPoolStats {
    const session = this.getActiveWorldSession();
    const chunkManager = this.state.chunkManager;

    if (!chunkManager) {
      return {
        activeWorkers: 0,
        queuedTasks: 0,
        completedTasks: 0,
        avgWorkerTime: 0
      };
    }

    const stats = session?.getWorkerPoolStats() ?? chunkManager.getWorkerPoolStats();
    if (!stats) {
      return {
        activeWorkers: 0,
        queuedTasks: 0,
        completedTasks: 0,
        avgWorkerTime: 0
      };
    }
    
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
   * Update statistics from loaded chunks
   */
  private updateStatistics(): void {
    const stats = this.getWorldStats();
    
    this.updateState({
      biomeDistribution: stats.biomeDistribution,
      resourceCounts: stats.resourceCounts,
      structureCounts: stats.structureCounts,
      avgHeight: stats.avgHeight,
      minHeight: stats.minHeight,
      maxHeight: stats.maxHeight,
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

  private getActiveWorldSession(): WorldSession | null {
    if (!this.worldSession || this.worldSession.getWorld() !== this.state.chunkManager) {
      return null;
    }

    return this.worldSession;
  }

  private syncLoadedChunksFromSession(): void {
    const session = this.getActiveWorldSession();
    if (!session) {
      return;
    }

    this.state.loadedChunks = new Map(session.getLoadedChunks());
    this.state.exploredChunks = new Set(session.getExploredChunks());
    this.state.loadedChunkCount = session.getLoadedChunkCount();
  }

  private detachWorldSessionEvents(): void {
    for (const unsubscribe of this.worldSessionUnsubscribers) {
      unsubscribe();
    }

    this.worldSessionUnsubscribers = [];
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
    this.detachWorldSessionEvents();
    this.worldSession = null;
    this.state.chunkManager = null;
    this.initialized = false;
    
    console.log('WorldApp destroyed');
  }
}

function calculateWorldStats(chunks: ReadonlyMap<string, ChunkData>): WorldSessionWorldStats {
  const biomeDistribution = new Map<BiomeType, number>();
  const resourceCounts = new Map<ResourceType, number>();
  const structureCounts = new Map<StructureType, number>();
  let totalHeight = 0;
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  let totalTiles = 0;

  for (const chunk of chunks.values()) {
    for (let i = 0; i < chunk.biomeMap.length; i++) {
      const biome = chunk.biomeMap[i] as BiomeType;
      biomeDistribution.set(biome, (biomeDistribution.get(biome) || 0) + 1);
    }

    for (const resource of chunk.resources) {
      resourceCounts.set(resource.type, (resourceCounts.get(resource.type) || 0) + 1);
    }

    for (const structure of chunk.structures) {
      structureCounts.set(structure.type, (structureCounts.get(structure.type) || 0) + 1);
    }

    for (let i = 0; i < chunk.heightmap.length; i++) {
      const height = chunk.heightmap[i];
      totalHeight += height;
      minHeight = Math.min(minHeight, height);
      maxHeight = Math.max(maxHeight, height);
      totalTiles++;
    }
  }

  return {
    biomeDistribution,
    resourceCounts,
    structureCounts,
    avgHeight: totalTiles > 0 ? totalHeight / totalTiles : 0,
    minHeight: minHeight === Infinity ? 0 : minHeight,
    maxHeight: maxHeight === -Infinity ? 0 : maxHeight,
  };
}
