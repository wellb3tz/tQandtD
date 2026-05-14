import * as THREE from 'three';
import type { ChunkData } from '@engine/index';
import type { TerrainSurfaceTextureLibrary } from './materials';
import {
  addChunkToScene,
  removeChunkFromScene,
  type AddChunkToSceneOptions,
  type RemoveChunkFromSceneOptions,
} from './ChunkSceneLifecycle';
import { getChunkKey, type ChunkMesh } from './ChunkMesh';
import type { FogOfWarManager } from './FogOfWarManager';
import type { RenderLayer } from './RenderLayerVisibility';
import type { WaterLayerManager } from './water/WaterLayerManager';
import type { WaterConfig } from './water/types';

export interface WorldChunkViewSettings {
  getLayerVisibility(): Map<RenderLayer, boolean>;
  getWaterConfigReference(): WaterConfig;
  getTerrainTextures(): TerrainSurfaceTextureLibrary;
  getTerrainTexturesEnabled(): boolean;
  getWireframeMode(): boolean;
}

export interface WorldChunkControllerOptions {
  scene: THREE.Scene;
  chunkMeshes: Map<string, ChunkMesh>;
  viewSettings: WorldChunkViewSettings;
  waterLayerManager: WaterLayerManager;
  fogOfWarManager: FogOfWarManager;
  onChunksChanged: () => void;
  addChunkToSceneFn?: (options: AddChunkToSceneOptions) => boolean;
  removeChunkFromSceneFn?: (options: RemoveChunkFromSceneOptions) => boolean;
  maxBuildsPerFrame?: number;
  maxBuildTimeMs?: number;
  /** When true, builds chunks immediately instead of queuing. Useful for tests. */
  immediateBuilds?: boolean;
}

interface PendingBuild {
  chunkX: number;
  chunkY: number;
  data: ChunkData;
  partial: boolean;
  stage?: number;
}

export class WorldChunkController {
  private readonly scene: THREE.Scene;
  private readonly chunkMeshes: Map<string, ChunkMesh>;
  private readonly viewSettings: WorldChunkViewSettings;
  private readonly waterLayerManager: WaterLayerManager;
  private readonly fogOfWarManager: FogOfWarManager;
  private readonly onChunksChanged: () => void;
  private readonly addChunkToSceneFn: (options: AddChunkToSceneOptions) => boolean | Promise<boolean>;
  private readonly removeChunkFromSceneFn: (options: RemoveChunkFromSceneOptions) => boolean;
  private readonly maxBuildsPerFrame: number;
  private readonly maxBuildTimeMs: number;
  private readonly immediateBuilds: boolean;
  private readonly pendingBuilds: PendingBuild[];

  constructor(options: WorldChunkControllerOptions) {
    this.scene = options.scene;
    this.chunkMeshes = options.chunkMeshes;
    this.viewSettings = options.viewSettings;
    this.waterLayerManager = options.waterLayerManager;
    this.fogOfWarManager = options.fogOfWarManager;
    this.onChunksChanged = options.onChunksChanged;
    this.addChunkToSceneFn = options.addChunkToSceneFn ?? addChunkToScene;
    this.removeChunkFromSceneFn = options.removeChunkFromSceneFn ?? removeChunkFromScene;
    this.maxBuildsPerFrame = options.maxBuildsPerFrame ?? 2;
    this.maxBuildTimeMs = options.maxBuildTimeMs ?? 10;
    this.immediateBuilds = options.immediateBuilds ?? false;
    this.pendingBuilds = [];
  }

  addChunk(chunkX: number, chunkY: number, data: ChunkData, partial = false, stage?: number): void {
    if (this.immediateBuilds) {
      this.processBuild({ chunkX, chunkY, data, partial, stage });
      return;
    }
    // Queue the build instead of doing it synchronously to avoid frame drops
    // when multiple chunks arrive at once (e.g. fast camera movement).
    this.pendingBuilds.push({ chunkX, chunkY, data, partial, stage });
  }

  /**
   * Process pending chunk builds with a per-frame time and count budget.
   * Call this once per frame, ideally before rendering.
   */
  async update(): Promise<void> {
    if (this.pendingBuilds.length === 0) {
      return;
    }

    const startTime = performance.now();
    let processed = 0;
    let changed = false;

    while (
      this.pendingBuilds.length > 0 &&
      processed < this.maxBuildsPerFrame &&
      performance.now() - startTime < this.maxBuildTimeMs
    ) {
      const build = this.pendingBuilds.shift()!;
      if (await this.processBuild(build)) {
        changed = true;
      }
      processed++;
    }

    if (changed) {
      this.onChunksChanged();
    }
  }

  private async processBuild(build: PendingBuild): Promise<boolean> {
    return this.addChunkToSceneFn({
      chunkX: build.chunkX,
      chunkY: build.chunkY,
      data: build.data,
      partial: build.partial,
      stage: build.stage,
      scene: this.scene,
      chunkMeshes: this.chunkMeshes,
      layerVisibility: this.viewSettings.getLayerVisibility(),
      waterLayerManager: this.waterLayerManager,
      waterConfig: this.viewSettings.getWaterConfigReference(),
      fogOfWarManager: this.fogOfWarManager,
      terrainTextures: this.viewSettings.getTerrainTextures(),
      terrainTexturesEnabled: this.viewSettings.getTerrainTexturesEnabled(),
      wireframeMode: this.viewSettings.getWireframeMode(),
    });
  }

  removeChunk(chunkX: number, chunkY: number, keepFogOfWar = false): void {
    const removed = this.removeChunkFromSceneFn({
      chunkX,
      chunkY,
      keepFogOfWar,
      scene: this.scene,
      chunkMeshes: this.chunkMeshes,
      waterLayerManager: this.waterLayerManager,
      fogOfWarManager: this.fogOfWarManager,
    });

    if (removed) {
      this.onChunksChanged();
    }
  }

  clearChunks(): void {
    const keys = Array.from(this.chunkMeshes.keys());
    let removedAny = false;

    for (const key of keys) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      const removed = this.removeChunkFromSceneFn({
        chunkX,
        chunkY,
        keepFogOfWar: false,
        scene: this.scene,
        chunkMeshes: this.chunkMeshes,
        waterLayerManager: this.waterLayerManager,
        fogOfWarManager: this.fogOfWarManager,
      });
      removedAny ||= removed;
    }

    if (removedAny) {
      this.onChunksChanged();
    }
  }

  updateChunk(chunkX: number, chunkY: number, data: ChunkData): void {
    const key = getChunkKey(chunkX, chunkY);
    const waterConfig = this.viewSettings.getWaterConfigReference();
    if (waterConfig.enabled && data.heightmap) {
      this.waterLayerManager.updateWaterMeshes(key, data, this.scene, waterConfig);
    }

    this.removeChunk(chunkX, chunkY);
    this.addChunk(chunkX, chunkY, data);
  }
}
