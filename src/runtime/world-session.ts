import { ChunkManager, type WorldConfig } from '../world/chunk-manager';
import type { BiomeType, ChunkData, ResourceType, StructureType } from '../world/chunk';
import type {
  SerializationFormat,
  SerializationOptions,
  SerializedWorld,
} from '../world/serialization';
import { WorldSerializer } from '../world/serialization';
import type { ChunkCoordinate } from './chunk-streaming-system';
import type { RendererAdapter, RenderSyncSystemOptions } from './renderer';
import { WorldScene, type WorldSceneOptions } from './world-scene';

export type WorldSessionSceneOptions = Omit<WorldSceneOptions, 'world' | 'worldConfig'>;

export interface WorldSessionOptions {
  world?: ChunkManager;
  worldConfig?: WorldConfig;
  scene?: WorldSessionSceneOptions;
  disposeWorldOnReplace?: boolean;
}

export interface WorldSessionRegenerateOptions {
  config?: Partial<WorldConfig>;
  seed?: number;
}

export interface WorldSessionUpdateConfigOptions {
  fallbackOnWorkerPoolError?: boolean;
}

export interface WorldSessionUpdateConfigResult {
  previousWorld: ChunkManager;
  world: ChunkManager;
  previousConfig: WorldConfig;
  config: WorldConfig;
  workerPoolEnabled: boolean;
  workerPoolInitializationError: Error | null;
  usedWorkerPoolFallback: boolean;
}

export interface WorldSessionCacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
}

export interface WorldSessionWorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
}

export interface WorldSessionWorldStats {
  biomeDistribution: Map<BiomeType, number>;
  resourceCounts: Map<ResourceType, number>;
  structureCounts: Map<StructureType, number>;
  avgHeight: number;
  minHeight: number;
  maxHeight: number;
}

export interface WorldSessionLoadOptions {
  useSerializedConfig?: boolean;
}

export interface WorldSessionExportResult {
  data: Blob | string;
  serializedWorld: SerializedWorld;
  checksum: string;
}

export interface WorldSessionChunkEntry {
  coordinate: ChunkCoordinate;
  chunk: ChunkData;
}

export interface WorldSessionLoadChunksOptions {
  syncRenderer?: boolean;
}

export interface WorldSessionLoadChunksResult {
  loaded: WorldSessionChunkEntry[];
  skipped: ChunkCoordinate[];
  elapsedTime: number;
}

export interface WorldSessionUnloadChunksOptions {
  syncRenderer?: boolean;
}

export interface WorldSessionUnloadChunksResult {
  unloaded: WorldSessionChunkEntry[];
}

export interface WorldSessionWorldChangedEvent {
  previousWorld: ChunkManager;
  world: ChunkManager;
}

export interface WorldSessionWorldLoadedEvent {
  previousWorld: ChunkManager;
  world: ChunkManager;
  serializedWorld: SerializedWorld;
  config: WorldConfig;
}

export interface WorldSessionConfigChangedEvent extends WorldSessionUpdateConfigResult {}

export interface WorldSessionCacheClearedEvent {
  unloaded: WorldSessionChunkEntry[];
}

export interface WorldSessionEventMap {
  chunk_loaded: WorldSessionChunkEntry;
  chunk_unloaded: WorldSessionChunkEntry;
  chunk_updated: WorldSessionChunkEntry;
  world_changed: WorldSessionWorldChangedEvent;
  world_loaded: WorldSessionWorldLoadedEvent;
  config_changed: WorldSessionConfigChangedEvent;
  cache_cleared: WorldSessionCacheClearedEvent;
}

export type WorldSessionEvent = keyof WorldSessionEventMap;
export type WorldSessionEventCallback<TEvent extends WorldSessionEvent> =
  (event: WorldSessionEventMap[TEvent]) => void;
export type WorldSessionUnsubscribe = () => void;

/**
 * High-level engine session that owns a world manager and its runtime scene.
 */
export class WorldSession {
  readonly scene: WorldScene;

  private world: ChunkManager;
  private readonly loadedChunks: Map<string, ChunkData>;
  private readonly exploredChunks: Set<string>;
  private readonly eventListeners: {
    [TEvent in WorldSessionEvent]?: Set<WorldSessionEventCallback<TEvent>>;
  };
  private readonly disposeWorldOnReplace: boolean;
  private disposed: boolean;

  constructor(options: WorldSessionOptions) {
    this.world = options.world ?? this.createWorld(options.worldConfig);
    this.loadedChunks = new Map();
    this.exploredChunks = new Set();
    this.eventListeners = {};
    this.disposeWorldOnReplace = options.disposeWorldOnReplace ?? options.world === undefined;
    this.disposed = false;
    this.scene = new WorldScene({
      ...(options.scene ?? {}),
      world: this.world,
    });
  }

  getWorld(): ChunkManager {
    return this.world;
  }

  getConfig(): WorldConfig {
    return this.world.config;
  }

  getLoadedChunks(): ReadonlyMap<string, ChunkData> {
    return this.loadedChunks;
  }

  getLoadedChunksSnapshot(): Map<string, ChunkData> {
    return new Map(this.loadedChunks);
  }

  getExploredChunks(): ReadonlySet<string> {
    return this.exploredChunks;
  }

  getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }

  getCacheStats(): WorldSessionCacheStats {
    return this.world.getCacheStats();
  }

  getWorkerPoolStats(): WorldSessionWorkerPoolStats | null {
    return this.world.getWorkerPoolStats();
  }

  getWorldStats(): WorldSessionWorldStats {
    return calculateWorldStats(this.loadedChunks);
  }

  on<TEvent extends WorldSessionEvent>(
    event: TEvent,
    callback: WorldSessionEventCallback<TEvent>
  ): WorldSessionUnsubscribe {
    const listeners = this.getEventListeners(event);
    listeners.add(callback);
    return () => this.off(event, callback);
  }

  off<TEvent extends WorldSessionEvent>(
    event: TEvent,
    callback: WorldSessionEventCallback<TEvent>
  ): void {
    this.eventListeners[event]?.delete(callback as never);
  }

  start(): void {
    this.assertNotDisposed();
    this.scene.start();
  }

  stop(): void {
    this.scene.stop();
  }

  tick(deltaTime: number): void {
    this.assertNotDisposed();
    this.scene.tick(deltaTime);
  }

  setRenderer(renderer: RendererAdapter | RenderSyncSystemOptions): void {
    this.assertNotDisposed();
    this.scene.setRenderer(renderer);

    for (const [key, chunk] of this.loadedChunks.entries()) {
      this.scene.renderSystem?.onChunkLoaded(chunk, this.parseChunkKey(key));
    }
  }

  clearRenderer(): void {
    this.assertNotDisposed();
    this.scene.clearRenderer();
  }

  regenerate(options: WorldSessionRegenerateOptions = {}): ChunkManager {
    this.assertNotDisposed();
    return this.updateConfig({
      ...options.config,
      seed: options.seed ?? options.config?.seed ?? this.world.config.seed,
    }).world;
  }

  updateConfig(
    config: Partial<WorldConfig>,
    options: WorldSessionUpdateConfigOptions = {}
  ): WorldSessionUpdateConfigResult {
    this.assertNotDisposed();

    const previousWorld = this.world;
    const previousConfig = previousWorld.config;
    const nextConfig = {
      ...previousConfig,
      ...config,
    };
    let nextWorld = new ChunkManager(nextConfig);
    let workerPoolInitializationError = nextWorld.getWorkerPoolInitializationError();
    let usedWorkerPoolFallback = false;
    let effectiveConfig = nextConfig;

    if (
      workerPoolInitializationError &&
      options.fallbackOnWorkerPoolError &&
      nextConfig.workerPoolConfig
    ) {
      nextWorld.dispose();
      effectiveConfig = {
        ...nextConfig,
        workerPoolConfig: undefined,
      };
      nextWorld = new ChunkManager(effectiveConfig);
      usedWorkerPoolFallback = true;
    }

    this.replaceWorld(nextWorld);

    const result: WorldSessionUpdateConfigResult = {
      previousWorld,
      world: nextWorld,
      previousConfig,
      config: effectiveConfig,
      workerPoolEnabled: nextWorld.hasWorkerPool() && !nextWorld.getWorkerPoolInitializationError(),
      workerPoolInitializationError,
      usedWorkerPoolFallback,
    };
    this.emit('config_changed', result);
    return result;
  }

  setWorld(world: ChunkManager): void {
    this.assertNotDisposed();
    this.replaceWorld(world);
  }

  getChunk(coordinate: ChunkCoordinate): Promise<ChunkData> {
    this.assertNotDisposed();
    return this.world.getChunk(coordinate.x, coordinate.y);
  }

  async loadChunksAround(
    centerX: number,
    centerY: number,
    radius: number,
    options: WorldSessionLoadChunksOptions = {}
  ): Promise<WorldSessionLoadChunksResult> {
    this.assertNotDisposed();

    const startedAt = nowMs();
    const loaded: WorldSessionChunkEntry[] = [];
    const skipped: ChunkCoordinate[] = [];
    const syncRenderer = options.syncRenderer ?? true;

    // Build a list of chunk load promises so they can run in parallel.
    const promises: Promise<WorldSessionChunkEntry>[] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const coordinate = { x: centerX + dx, y: centerY + dy };
        const key = this.getChunkKey(coordinate);

        if (this.loadedChunks.has(key)) {
          skipped.push(coordinate);
          continue;
        }

        promises.push(
          this.world.getChunk(coordinate.x, coordinate.y).then(chunk => {
            this.loadedChunks.set(key, chunk);
            this.exploredChunks.add(key);

            if (syncRenderer) {
              this.scene.renderSystem?.onChunkLoaded(chunk, coordinate);
            }

            const entry = { coordinate, chunk };
            this.emit('chunk_loaded', entry);
            return entry;
          })
        );
      }
    }

    // Await all chunks in parallel rather than sequentially.
    const results = await Promise.all(promises);
    loaded.push(...results);

    return {
      loaded,
      skipped,
      elapsedTime: nowMs() - startedAt,
    };
  }

  unloadDistantChunks(
    centerX: number,
    centerY: number,
    maxDistance: number,
    options: WorldSessionUnloadChunksOptions = {}
  ): WorldSessionUnloadChunksResult {
    this.assertNotDisposed();

    const unloaded: WorldSessionChunkEntry[] = [];
    const syncRenderer = options.syncRenderer ?? true;

    for (const [key, chunk] of this.loadedChunks.entries()) {
      const dx = Math.abs(chunk.x - centerX);
      const dy = Math.abs(chunk.y - centerY);
      const distance = Math.max(dx, dy);

      if (distance <= maxDistance) {
        continue;
      }

      const coordinate = { x: chunk.x, y: chunk.y };
      this.loadedChunks.delete(key);

      if (syncRenderer) {
        this.scene.renderSystem?.onChunkRemoved(coordinate);
      } else {
        this.scene.renderSystem?.forgetChunk(coordinate);
      }

      unloaded.push({ coordinate, chunk });
      this.emit('chunk_unloaded', { coordinate, chunk });
    }

    return { unloaded };
  }

  async refreshChunk(coordinate: ChunkCoordinate, options: WorldSessionLoadChunksOptions = {}): Promise<ChunkData | null> {
    this.assertNotDisposed();

    const key = this.getChunkKey(coordinate);
    if (!this.loadedChunks.has(key)) {
      return null;
    }

    const chunk = await this.world.getChunk(coordinate.x, coordinate.y);
    this.loadedChunks.set(key, chunk);

    if (options.syncRenderer ?? true) {
      this.scene.renderSystem?.onChunkRemoved(coordinate);
      this.scene.renderSystem?.onChunkLoaded(chunk, coordinate);
    }

    this.emit('chunk_updated', { coordinate, chunk });
    return chunk;
  }

  saveWorld(options: SerializationOptions): SerializedWorld {
    this.assertNotDisposed();
    return this.world.saveWorld(options);
  }

  exportWorld(options: SerializationOptions): WorldSessionExportResult {
    this.assertNotDisposed();
    const serializedWorld = this.world.saveWorld(options);
    return {
      data: this.world.exportWorld(options),
      serializedWorld,
      checksum: serializedWorld.checksum,
    };
  }

  async importWorld(
    data: Blob | string,
    format: SerializationFormat,
    options: WorldSessionLoadOptions = {}
  ): Promise<ChunkManager> {
    this.assertNotDisposed();
    const serializedWorld = await new WorldSerializer().import(data, format);
    return this.loadWorld(serializedWorld, options);
  }

  loadWorld(data: SerializedWorld, options: WorldSessionLoadOptions = {}): ChunkManager {
    this.assertNotDisposed();

    const previousWorld = this.world;
    const worldConfig = options.useSerializedConfig ?? true
      ? data.config
      : this.world.config;
    const nextWorld = new ChunkManager(worldConfig);
    try {
      nextWorld.loadWorld(data);
    } catch (error) {
      nextWorld.dispose();
      throw error;
    }
    this.replaceWorld(nextWorld);
    this.emit('world_loaded', {
      previousWorld,
      world: nextWorld,
      serializedWorld: data,
      config: nextWorld.config,
    });
    return nextWorld;
  }

  clearCache(): void {
    this.assertNotDisposed();
    const unloaded = Array.from(this.loadedChunks.values(), chunk => ({
      coordinate: { x: chunk.x, y: chunk.y },
      chunk,
    }));
    this.world.clearCache();
    this.loadedChunks.clear();
    this.exploredChunks.clear();
    this.scene.streamingSystem?.clear();
    this.scene.renderSystem?.clearChunks();
    this.emit('cache_cleared', { unloaded });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.scene.dispose();
    if (this.disposeWorldOnReplace) {
      this.world.dispose();
    }
    this.disposed = true;
  }

  private createWorld(config?: WorldConfig): ChunkManager {
    if (!config) {
      throw new Error('WorldSession requires either world or worldConfig');
    }

    return new ChunkManager(config);
  }

  private replaceWorld(nextWorld: ChunkManager): void {
    const previousWorld = this.world;
    this.world = nextWorld;
    this.loadedChunks.clear();
    this.exploredChunks.clear();
    this.scene.setWorld(nextWorld);
    this.emit('world_changed', {
      previousWorld,
      world: nextWorld,
    });

    if (this.disposeWorldOnReplace && previousWorld !== nextWorld) {
      previousWorld.dispose();
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('WorldSession has been disposed');
    }
  }

  private getChunkKey(coordinate: ChunkCoordinate): string {
    return `${coordinate.x},${coordinate.y}`;
  }

  private parseChunkKey(key: string): ChunkCoordinate {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  }

  private getEventListeners<TEvent extends WorldSessionEvent>(
    event: TEvent
  ): Set<WorldSessionEventCallback<TEvent>> {
    const listeners = this.eventListeners[event] ?? new Set();
    this.eventListeners[event] = listeners as never;
    return listeners as Set<WorldSessionEventCallback<TEvent>>;
  }

  private emit<TEvent extends WorldSessionEvent>(
    event: TEvent,
    payload: WorldSessionEventMap[TEvent]
  ): void {
    for (const listener of this.eventListeners[event] ?? []) {
      (listener as WorldSessionEventCallback<TEvent>)(payload);
    }
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
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
