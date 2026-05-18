/**
 * WorldApp - Core application class for the tQandtD world app
 * 
 * Manages application state, coordinates components, and integrates with the
 * procedural world generation engine. Provides state management with reactive
 * updates, chunk loading coordination, and event system for component communication.
 */

import {
  WorldSession,
  configureLogger,
  LogLevel,
  type ChunkManager,
  type WorldConfig,
  type ChunkData,
  type BiomeType,
  type ResourceType,
  type StructureType,
  type SerializationOptions,
  type SerializedWorld,
  type WorldSessionCacheStats,
  type WorldSessionWorldStats,
  type RendererAdapter,
  type RenderSyncSystemOptions,
  cloneWorldConfig,
  createDefaultWorldConfig,
  prepareWorldConfig,
  WorldConfigOverrides,
} from '@engine/index';
import { requiresWorldRebuild } from './configChange';

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
  loadedChunks: Map<string, ChunkData>;
  config: WorldConfig;
  
  // UI state
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  appSettings: AppSettings;
  viewerSettings: ViewerSettings;
  
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
export type AppStateUpdate = Partial<Omit<AppState, 'appSettings' | 'viewerSettings'>> & {
  appSettings?: Partial<AppSettings>;
  viewerSettings?: Partial<ViewerSettings>;
};

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

export interface AppSettings {
  viewDistance: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  viewDistance: 3,
};

export interface SkyViewSettings {
  turbidity?: number;
  rayleigh?: number;
  elevation?: number;
}

export interface ViewerSettings {
  showTerrain: boolean;
  showBiomes: boolean;
  showWater: boolean;
  showResources: boolean;
  showStructures: boolean;
  showChunkBoundaries: boolean;
  showWireframe: boolean;
  terrainTexturesEnabled: boolean;
  fogOfWarEnabled: boolean;
  waterView?: WaterViewSettings;
  sky?: SkyViewSettings;
}

export interface WaterViewSettings {
  ocean?: WaterSurfaceViewSettings;
  lake?: WaterSurfaceViewSettings;
  river?: WaterSurfaceViewSettings;
}

export interface WaterSurfaceViewSettings {
  color?: number;
  opacity?: number;
  shininess?: number;
  enableWaves?: boolean;
  waveHeight?: number;
  waveSpeed?: number;
}

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  showTerrain: true,
  showBiomes: true,
  showWater: true,
  showResources: false,
  showStructures: false,
  showChunkBoundaries: false,
  showWireframe: false,
  terrainTexturesEnabled: true,
  fogOfWarEnabled: false,
};

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
 * Integrates with WorldSession for world generation and provides
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
  /** AbortController for in-flight chunk loads; replaced on every new load call. */
  private loadChunksAbortController: AbortController | null;

  constructor() {
    this.initialized = false;
    this.subscribers = new Set();
    this.eventListeners = new Map();
    this.isUpdatingConfig = false;
    this.invalidatingChunks = new Set();
    this.worldSession = null;
    this.worldSessionUnsubscribers = [];
    this.loadChunksAbortController = null;
    
    // Initialize state with defaults
    this.state = {
      loadedChunks: new Map(),
      config: createDefaultWorldConfig(),
      
      cameraPosition: { x: 50, y: 100, z: 50 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      appSettings: { ...DEFAULT_APP_SETTINGS },
      
      viewerSettings: { ...DEFAULT_VIEWER_SETTINGS },
      
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
      
      // Create the engine session with default configuration.
      const initConfig = prepareWorldConfig(this.state.config, {
        onChunkInvalidated: (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY),
      });
      const session = new WorldSession({
        worldConfig: initConfig,
        disposeWorldOnReplace: true,
        scene: {
          input: false,
          movement: false,
          streaming: false,
          renderer: false,
          player: false,
        },
      });
      this.state.config = initConfig;
      this.attachWorldSession(session);
      
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

  getViewerSettings(): ViewerSettings {
    return { ...this.state.viewerSettings };
  }

  getConfigSnapshot(): WorldConfig {
    return cloneWorldConfig(this.state.config);
  }

  getWorld(): ChunkManager | null {
    return this.worldSession?.getWorld() ?? null;
  }

  getWorldSession(): WorldSession | null {
    return this.getActiveWorldSession();
  }

  setRenderer(renderer: RendererAdapter | RenderSyncSystemOptions): void {
    this.requireWorldSession().setRenderer(renderer);
  }

  clearRenderer(): void {
    this.requireWorldSession().clearRenderer();
  }

  getLoadedChunkCount(): number {
    return this.requireWorldSession().getLoadedChunkCount();
  }

  getLoadedChunksSnapshot(): Map<string, ChunkData> {
    return this.requireWorldSession().getLoadedChunksSnapshot();
  }

  getCacheStats(): WorldSessionCacheStats {
    return this.requireWorldSession().getCacheStats();
  }

  getWorldStats(): WorldSessionWorldStats {
    return this.requireWorldSession().getWorldStats();
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
    return this.state.appSettings.viewDistance;
  }

  getSeed(): number {
    return this.state.config.seed;
  }

  isWorkerPoolEnabled(): boolean {
    return this.state.workerPoolEnabled;
  }

  /**
   * Update application state with partial updates
   */
  updateState(partial: AppStateUpdate): void {
    const { appSettings: appSettingsPatch, viewerSettings: viewerSettingsPatch, ...rest } = partial;
    const visibilityChanged = viewerSettingsPatch !== undefined;
    const nextViewerSettings = visibilityChanged
      ? this.mergeViewerSettings(viewerSettingsPatch)
      : this.state.viewerSettings;
    const nextAppSettings = {
      ...this.state.appSettings,
      ...appSettingsPatch,
    };
    
    // Merge partial state into current state
    this.state = {
      ...this.state,
      ...rest,
      appSettings: nextAppSettings,
      viewerSettings: nextViewerSettings,
    };
    
    // Notify all subscribers of state change
    this.notifySubscribers();
    this.emit(AppEvent.STATE_CHANGED, this.state);
    
    // Emit visibility change event if visibility settings changed
    if (visibilityChanged) {
      this.emit(AppEvent.VISIBILITY_CHANGED, this.getViewerSettings());
    }
  }

  updateViewerSettings(patch: Partial<ViewerSettings>): void {
    this.updateState({ viewerSettings: patch });
  }

  updateAppSettings(patch: Partial<AppSettings>): void {
    this.updateState({ appSettings: patch });
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

  private attachWorldSession(session: WorldSession): void {
    this.detachWorldSessionEvents();
    this.worldSession = session;
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
          keepFogOfWar: this.state.viewerSettings.fogOfWarEnabled,
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
        this.state.config = config;
        this.syncLoadedChunksFromSession();
      }),
      session.on('config_changed', ({ config, world }) => {
        this.state.config = config;
        this.syncLoadedChunksFromSession();
      }),
    ];
    this.syncLoadedChunksFromSession();
  }

  /**
   * Generate a new world with the given seed
   */
  async generateWorld(seed: number): Promise<void> {
    try {
      // Update configuration with new seed
      const newConfig = prepareWorldConfig(this.state.config, {
        seed,
        onChunkInvalidated: (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY),
      });
      
      const newManager = this.requireWorldSession().regenerate({ config: newConfig, seed });
      
      // Clear existing chunks and explored chunks
      this.state.loadedChunks.clear();
      this.state.exploredChunks.clear();
      
      // Update state
      this.updateState({
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
    return this.requireWorldSession().exportWorld(options);
  }

  loadSerializedWorld(serializedWorld: SerializedWorld): ChunkManager {
    const nextManager = this.requireWorldSession().loadWorld(serializedWorld);

    this.invalidatingChunks.clear();
    this.updateState({
      config: nextManager.config,
      loadedChunks: new Map(),
      exploredChunks: new Set(),
      loadedChunkCount: 0,
    });
    this.emit(AppEvent.WORLD_LOADED, {
      seed: serializedWorld.seed,
      serializedWorld,
    });
    return nextManager;
  }

  /**
   * Load chunks in a radius around a center point
   */
  async loadChunksAround(centerX: number, centerY: number, radius: number): Promise<void> {
    // Cancel any previous in-flight chunk load so the worker pool and
    // generation loops stop wasting time on chunks the user has already
    // scrolled past.
    if (this.loadChunksAbortController) {
      this.loadChunksAbortController.abort();
    }
    this.loadChunksAbortController = new AbortController();
    const signal = this.loadChunksAbortController.signal;

    const startTime = performance.now();
    let chunksLoaded = 0;

    try {
      const result = await this.requireWorldSession().loadChunksAround(centerX, centerY, radius, { signal });
      chunksLoaded = result.loaded.length;
      this.syncLoadedChunksFromSession();

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
      // Swallow expected abort errors — they’re not real failures.
      if (error instanceof Error && error.message.includes('aborted')) {
        return;
      }
      console.error('Failed to load chunks:', error);
      this.emit(AppEvent.ERROR, { message: 'Chunk loading failed', error });
      throw error;
    } finally {
      if (this.loadChunksAbortController?.signal === signal) {
        this.loadChunksAbortController = null;
      }
    }
  }

  /**
   * Unload chunks that are too far from a center point
   */
  unloadDistantChunks(centerX: number, centerY: number, maxDistance: number): void {
    const result = this.requireWorldSession().unloadDistantChunks(centerX, centerY, maxDistance, {
      syncRenderer: !this.state.viewerSettings.fogOfWarEnabled,
    });
    const chunksUnloaded = result.unloaded.length;
    this.syncLoadedChunksFromSession();

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

    const manager = this.requireWorldSession().getWorld();

    this.invalidatingChunks.add(key);

    queueMicrotask(async () => {
      try {
        if (this.requireWorldSession().getWorld() !== manager || !this.state.loadedChunks.has(key)) {
          return;
        }

        const session = this.requireWorldSession();
        const chunk = await session.refreshChunk({ x: chunkX, y: chunkY }, { syncRenderer: false });

        if (this.requireWorldSession().getWorld() !== manager || !this.state.loadedChunks.has(key) || !chunk) {
          return;
        }

        this.syncLoadedChunksFromSession();
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
      return;
    }
    
    this.isUpdatingConfig = true;
    
    try {
      const newConfig = prepareWorldConfig(this.state.config, {
        ...config,
        onChunkInvalidated: (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY),
      });

      const shouldRecreateWorld = requiresWorldRebuild(config);
      
      // If not recreating manager, just update config and return
      if (!shouldRecreateWorld) {
        this.updateState({ config: newConfig });
        this.emit(AppEvent.CONFIG_CHANGED, newConfig);
        return;
      }
      
      // Handle worker pool configuration
      let workerPoolEnabled = !!newConfig.workerPoolConfig;
      const result = this.requireWorldSession().updateConfig(newConfig, {
        fallbackOnWorkerPoolError: 'workerPoolConfig' in config && !!config.workerPoolConfig,
      });
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
   * Get worker pool statistics from the active world session.
   */
  getWorkerPoolStats(): AppWorkerPoolStats {
    const stats = this.requireWorldSession().getWorkerPoolStats();
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
    return this.worldSession;
  }

  private mergeViewerSettings(
    settingsPatch?: Partial<ViewerSettings>
  ): ViewerSettings {
    const waterViewPatch = settingsPatch?.waterView ?? {};
    const skyPatch = settingsPatch?.sky ?? {};

    return {
      ...this.state.viewerSettings,
      ...settingsPatch,
      waterView: Object.keys(waterViewPatch).length > 0
        ? {
            ...this.state.viewerSettings.waterView,
            ...settingsPatch?.waterView,
            ocean: {
              ...this.state.viewerSettings.waterView?.ocean,
              ...settingsPatch?.waterView?.ocean,
            },
            lake: {
              ...this.state.viewerSettings.waterView?.lake,
              ...settingsPatch?.waterView?.lake,
            },
            river: {
              ...this.state.viewerSettings.waterView?.river,
              ...settingsPatch?.waterView?.river,
            },
          }
        : this.state.viewerSettings.waterView,
      sky: Object.keys(skyPatch).length > 0
        ? {
            ...this.state.viewerSettings.sky,
            ...settingsPatch?.sky,
          }
        : this.state.viewerSettings.sky,
    };
  }

  private requireWorldSession(): WorldSession {
    const session = this.getActiveWorldSession();
    if (!session) {
      throw new Error('WorldSession not initialized');
    }

    return session;
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
    this.worldSession?.dispose();
    this.worldSession = null;
    this.initialized = false;
    
    console.log('WorldApp destroyed');
  }
}
