/**
 * WorldApp - Core application class for the tQandtD world app
 * 
 * Manages application state, coordinates components, and integrates with the
 * procedural world generation engine. Provides state management with reactive
 * updates, chunk loading coordination, and event system for component communication.
 */

import {
  WorldSession,
  DEFAULT_CAMERA_POSITION_METERS,
  TERRAIN_TILE_SIZE_METERS,
  configureLogger,
  LogLevel,
  BiomeType,
  ResourceType,
  StructureType,
  type ChunkManager,
  type WorldConfig,
  type ChunkData,
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
import { DEFAULT_CLIMATE_CONFIG } from '@engine/world/climate';
import { requiresWorldRebuild } from './configChange';
import { EconomySimulation, type EconomySnapshot, type WorldEconomyContext } from '../economy';

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
  loadedChunks: Map<string, ChunkData>;
  config: WorldConfig;
  
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  appSettings: AppSettings;
  viewerSettings: ViewerSettings;
  
  exploredChunks: Set<string>;
  
  fps: number;
  avgGenerationTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  loadedChunkCount: number;
  renderedVertexCount: number;
  
  workerPoolEnabled: boolean;
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  avgWorkerTime: number;
  
  biomeDistribution: Map<BiomeType, number>;
  resourceCounts: Map<ResourceType, number>;
  structureCounts: Map<StructureType, number>;
  avgHeight: number;
  minHeight: number;
  maxHeight: number;
  economy: EconomySnapshot;
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
  azimuth?: number;
}

export interface ViewerSettings {
  showTerrain: boolean;
  showFoliage: boolean;
  showBiomes: boolean;
  showTemperature: boolean;
  showWater: boolean;
  showResources: boolean;
  showStructures: boolean;
  showChunkBoundaries: boolean;
  showWireframe: boolean;
  terrainTexturesEnabled: boolean;
  fogOfWarEnabled: boolean;
  foliageLodEnabled: boolean;
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
  showFoliage: true,
  showBiomes: true,
  showTemperature: false,
  showWater: true,
  showResources: false,
  showStructures: false,
  showChunkBoundaries: false,
  showWireframe: false,
  terrainTexturesEnabled: true,
  fogOfWarEnabled: false,
  foliageLodEnabled: true,
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
  PLANET_LANDED = 'planet_landed',
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
  private economySimulation: EconomySimulation;

  constructor() {
    this.initialized = false;
    this.subscribers = new Set();
    this.eventListeners = new Map();
    this.isUpdatingConfig = false;
    this.invalidatingChunks = new Set();
    this.worldSession = null;
    this.worldSessionUnsubscribers = [];
    this.loadChunksAbortController = null;
    this.economySimulation = new EconomySimulation();
    
    this.state = {
      loadedChunks: new Map(),
      config: createDefaultWorldConfig(),
      
      cameraPosition: { ...DEFAULT_CAMERA_POSITION_METERS },
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
      maxHeight: 0,
      economy: this.economySimulation.getSnapshot(),
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
      const isDevelopment = import.meta.env?.DEV ?? false;
      configureLogger({
        level: isDevelopment ? LogLevel.INFO : LogLevel.WARN,
        timestamps: isDevelopment,
      });
      
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

    let maxCount = 0;
    let dominantBiome: string | null = null;
    stats.biomeDistribution.forEach((count, biome) => {
      if (count > maxCount) {
        maxCount = count;
        dominantBiome = this.getBiomeDisplayName(biome);
      }
    });

    return dominantBiome;
  }

  private getBiomeDisplayName(biome: BiomeType): string | null {
    const enumName = BiomeType[biome];
    if (!enumName) {
      return null;
    }

    return enumName
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  getViewDistance(): number {
    return this.state.appSettings.viewDistance;
  }

  getSeed(): number {
    return this.state.config.seed;
  }

  getEconomySnapshot(): EconomySnapshot {
    this.syncEconomyWorldContext();
    return this.economySimulation.getSnapshot();
  }

  refreshEconomyWorldContext(): EconomySnapshot {
    const economy = this.syncEconomyWorldContext();
    this.updateState({ economy });
    return economy;
  }

  advanceEconomy(hours = 1): EconomySnapshot {
    this.syncEconomyWorldContext();
    const economy = this.economySimulation.tick(hours);
    this.updateState({ economy });
    return economy;
  }

  buyEconomyGoods(settlementId: string, itemId: string, quantity: number): boolean {
    const bought = this.economySimulation.buy(settlementId, itemId, quantity);
    if (bought) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return bought;
  }

  sellEconomyGoods(settlementId: string, itemId: string, quantity: number): boolean {
    const sold = this.economySimulation.sell(settlementId, itemId, quantity);
    if (sold) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return sold;
  }

  depositEconomyGoods(itemId: string, quantity: number): boolean {
    const deposited = this.economySimulation.depositToWarehouse(itemId, quantity);
    if (deposited) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return deposited;
  }

  withdrawEconomyGoods(itemId: string, quantity: number): boolean {
    const withdrawn = this.economySimulation.withdrawFromWarehouse(itemId, quantity);
    if (withdrawn) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return withdrawn;
  }

  charterEconomyAutoRoute(originId: string, itemId: string, quantity: number): boolean {
    const chartered = this.economySimulation.charterAutoRoute(originId, itemId, quantity);
    if (chartered) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return chartered;
  }

  toggleEconomyAutoRoute(routeId: string): boolean {
    const toggled = this.economySimulation.toggleAutoRoute(routeId);
    if (toggled) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return toggled;
  }

  foundEconomyColony(settlementId: string): boolean {
    const founded = this.economySimulation.foundColony(settlementId);
    if (founded) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return founded;
  }

  buildEconomyColonyBuilding(buildingId: string): boolean {
    const built = this.economySimulation.buildColonyBuilding(buildingId);
    if (built) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return built;
  }

  investEconomyFaction(factionId: string, amount = 250): boolean {
    const invested = this.economySimulation.investInFaction(factionId, amount);
    if (invested) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return invested;
  }

  fundEconomyIntelNetwork(): boolean {
    const funded = this.economySimulation.fundIntelNetwork();
    if (funded) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return funded;
  }

  acceptEconomyContract(contractId: string): boolean {
    const accepted = this.economySimulation.acceptContract(contractId);
    if (accepted) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return accepted;
  }

  completeEconomyContract(contractId: string): boolean {
    const completed = this.economySimulation.completeContract(contractId);
    if (completed) this.updateState({ economy: this.economySimulation.getSnapshot() });
    return completed;
  }

  restoreEconomySnapshot(snapshot: EconomySnapshot): EconomySnapshot {
    const economy = this.economySimulation.restore(snapshot);
    this.updateState({ economy });
    return economy;
  }

  private syncEconomyWorldContext(): EconomySnapshot {
    const economy = this.economySimulation.syncWorldContext(this.createEconomyWorldContext());
    this.state.economy = economy;
    return economy;
  }

  private createEconomyWorldContext(): WorldEconomyContext {
    const position = this.state.cameraPosition;
    const config = this.state.config;
    const chunkWorldSize = Math.max(1, config.chunkSize * TERRAIN_TILE_SIZE_METERS);
    const chunkX = Math.floor(position.x / chunkWorldSize);
    const chunkY = Math.floor(position.z / chunkWorldSize);
    const chunk = this.state.loadedChunks.get(this.getChunkKey(chunkX, chunkY));
    const nearbyResources: Record<string, number> = {};
    const nearbyStructures: Record<string, number> = {};
    let localBiome: string | undefined;

    if (chunk) {
      const localX = clampInt(0, chunk.size - 1, Math.floor((position.x - chunk.x * chunkWorldSize) / TERRAIN_TILE_SIZE_METERS));
      const localY = clampInt(0, chunk.size - 1, Math.floor((position.z - chunk.y * chunkWorldSize) / TERRAIN_TILE_SIZE_METERS));
      localBiome = formatEnumName(enumNameFromValue(BiomeType, chunk.biomeMap[localY * chunk.size + localX]));

      for (const resource of chunk.resources ?? []) {
        const name = enumNameFromValue(ResourceType, resource.type)?.toUpperCase();
        if (!name) continue;
        nearbyResources[name] = (nearbyResources[name] ?? 0) + (resource.amount ?? 1);
      }

      for (const structure of chunk.structures ?? []) {
        const name = enumNameFromValue(StructureType, structure.type)?.toUpperCase();
        if (!name) continue;
        nearbyStructures[name] = (nearbyStructures[name] ?? 0) + 1;
      }
    } else {
      this.state.resourceCounts.forEach((count, type) => {
        const name = enumNameFromValue(ResourceType, type)?.toUpperCase();
        if (name) nearbyResources[name] = count;
      });
      this.state.structureCounts.forEach((count, type) => {
        const name = enumNameFromValue(StructureType, type)?.toUpperCase();
        if (name) nearbyStructures[name] = count;
      });
    }

    return {
      position: { x: position.x, z: position.z },
      chunk: { x: chunkX, y: chunkY },
      loadedChunkCount: this.state.loadedChunks.size,
      exploredChunkCount: this.state.exploredChunks.size,
      dominantBiome: this.worldSession ? this.getDominantBiomeName() ?? undefined : undefined,
      localBiome,
      nearbyResources,
      nearbyStructures,
    };
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
    
    this.state = {
      ...this.state,
      ...rest,
      appSettings: nextAppSettings,
      viewerSettings: nextViewerSettings,
    };
    
    this.notifySubscribers();
    this.emit(AppEvent.STATE_CHANGED, this.state);
    
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
    
    callback(this.state);
    
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
      const newConfig = prepareWorldConfig(this.state.config, {
        seed,
        onChunkInvalidated: (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY),
      });
      
      const newManager = this.requireWorldSession().regenerate({ config: newConfig, seed });
      
      this.state.loadedChunks.clear();
      this.state.exploredChunks.clear();
      this.economySimulation.reset(seed);
      
      this.updateState({
        config: newManager.config,
        loadedChunks: new Map(),
        exploredChunks: new Set(),
        economy: this.economySimulation.getSnapshot(),
      });
      
      this.emit(AppEvent.WORLD_GENERATED, { seed });
      
      await this.loadChunksAround(0, 0, 1);
      
      this.updateStatistics();
      
    } catch (error) {
      console.error('Failed to generate world:', error);
      this.emit(AppEvent.ERROR, { message: 'World generation failed', error });
      throw error;
    }
  }

  /**
   * Land on a new world at the given planet surface coordinates.
   * Derives a deterministic seed from lat/lon and generates the world.
   */
  async landOnPlanet(lat: number, lon: number): Promise<void> {
    const latDeg = Math.round((lat * 180) / Math.PI);
    const lonDeg = Math.round((lon * 180) / Math.PI);
    const baseSeed = Math.abs(latDeg * 1000 + lonDeg);
    const randomSalt = Math.floor(Math.random() * 10000);
    const newSeed = baseSeed + randomSalt;

    const normalizedLat = Math.abs(lat) / (Math.PI / 2); // 0 at equator, 1 at pole
    const temperatureOffset = (normalizedLat * 2) - 1; // -1 at equator, +1 at poles

    try {
      const newConfig = prepareWorldConfig(this.state.config, {
        seed: newSeed,
        onChunkInvalidated: (chunkX: number, chunkY: number) => this.handleChunkInvalidated(chunkX, chunkY),
      });

      if (newConfig.enhancedBiomeConfig) {
        newConfig.enhancedBiomeConfig.climateConfig = {
          ...DEFAULT_CLIMATE_CONFIG,
          ...newConfig.enhancedBiomeConfig.climateConfig,
          worldTemperatureOffset: temperatureOffset,
        };
      }

      const newManager = this.requireWorldSession().regenerate({ config: newConfig, seed: newSeed });

      this.state.loadedChunks.clear();
      this.state.exploredChunks.clear();
      this.economySimulation.reset(newSeed);

      this.updateState({
        config: newManager.config,
        loadedChunks: new Map(),
        exploredChunks: new Set(),
        economy: this.economySimulation.getSnapshot(),
      });

      this.emit(AppEvent.PLANET_LANDED, { seed: newSeed, lat, lon, temperatureOffset });

      await this.loadChunksAround(0, 0, 1);
      this.updateStatistics();
    } catch (error) {
      console.error('Failed to land on planet:', error);
      this.emit(AppEvent.ERROR, { message: 'Planet landing failed', error });
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

      const endTime = performance.now();
      const avgTime = chunksLoaded > 0 ? (endTime - startTime) / chunksLoaded : 0;

      if (chunksLoaded > 0) {
        const economy = this.syncEconomyWorldContext();
        this.updateState({
          loadedChunks: new Map(this.state.loadedChunks),
          loadedChunkCount: this.state.loadedChunks.size,
          avgGenerationTime: avgTime,
          economy,
        });
      }
    } catch (error) {
      // Swallow expected abort errors - they're not real failures.
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
      const economy = this.syncEconomyWorldContext();
      this.updateState({
        loadedChunks: new Map(this.state.loadedChunks),
        loadedChunkCount: this.state.loadedChunks.size,
        economy,
      });
    } else if (chunksUnloaded > 0) {
      const economy = this.syncEconomyWorldContext();
      this.updateState({
        loadedChunks: new Map(this.state.loadedChunks),
        loadedChunkCount: this.state.loadedChunks.size,
        economy,
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
      
      if (!shouldRecreateWorld) {
        this.updateState({ config: newConfig });
        this.emit(AppEvent.CONFIG_CHANGED, newConfig);
        return;
      }
      
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
    this.economySimulation.reset(this.state.config.seed);
    this.detachWorldSessionEvents();
    this.worldSession?.dispose();
    this.worldSession = null;
    this.initialized = false;
  }
}

function clampInt(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function enumNameFromValue(enumObject: Record<string, string | number>, value: string | number): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  const name = enumObject[value];
  return typeof name === 'string' ? name : undefined;
}

function formatEnumName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return name
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
