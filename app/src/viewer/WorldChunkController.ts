import * as THREE from 'three';
import { TERRAIN_TILE_SIZE_METERS, type ChunkData } from '@engine/index';
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
import { disposeGroup, disposeMesh } from './ThreeDisposal';

export interface WorldChunkViewSettings {
  getLayerVisibility(): Map<RenderLayer, boolean>;
  getWaterConfigReference(): WaterConfig;
  getTerrainTextures(): TerrainSurfaceTextureLibrary;
  getTerrainTexturesEnabled(): boolean;
  getWireframeMode(): boolean;
  getFoliageLodEnabled(): boolean;
  applyTerrainColorMode(chunkMesh: ChunkMesh): void;
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
  key: string;
  chunkX: number;
  chunkY: number;
  data: ChunkData;
  partial: boolean;
  stage?: number;
  generation: number;
  version: number;
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
  private readonly chunkBuildVersions = new Map<string, number>();
  private updateInProgress: Promise<void> | null = null;
  private updateRequested = false;
  private buildGeneration = 0;
  private chunkSize: number | null = null;
  private cameraChunkX = 0;
  private cameraChunkY = 0;
  private cameraWorldX = 0;
  private cameraWorldZ = 0;

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
    const key = getChunkKey(chunkX, chunkY);
    if (this.chunkSize === null && data.size > 0) {
      this.chunkSize = data.size;
    }
    this.cancelPendingBuildsForKey(key);
    const version = this.bumpChunkBuildVersion(key);
    const build = { key, chunkX, chunkY, data, partial, stage, generation: this.buildGeneration, version };
    if (this.immediateBuilds) {
      void this.processBuild(build).then(changed => {
        if (changed) {
          this.onChunksChanged();
        }
      });
      return;
    }
    // Queue the build instead of doing it synchronously to avoid frame drops
    // when multiple chunks arrive at once (e.g. fast camera movement).
    this.pendingBuilds.push(build);
  }

  setCameraPosition(worldX: number, worldZ: number): void {
    this.cameraWorldX = worldX;
    this.cameraWorldZ = worldZ;
    if (this.chunkSize === null) return;
    const scaledChunkSize = this.chunkSize * TERRAIN_TILE_SIZE_METERS;
    this.cameraChunkX = Math.floor(worldX / scaledChunkSize);
    this.cameraChunkY = Math.floor(worldZ / scaledChunkSize);
  }

  hasPendingBuilds(): boolean {
    return this.pendingBuilds.length > 0;
  }

  /**
   * Process pending chunk builds with a per-frame time and count budget.
   * Call this once per frame, ideally before rendering.
   */
  async update(): Promise<void> {
    if (this.updateInProgress) {
      this.updateRequested = true;
      return this.updateInProgress;
    }

    this.updateInProgress = this.drainPendingBuilds();
    try {
      await this.updateInProgress;
    } finally {
      this.updateInProgress = null;
    }
  }

  async flushPendingBuilds(): Promise<void> {
    while (this.pendingBuilds.length > 0) {
      await this.processPendingBuilds();
    }
  }

  private async drainPendingBuilds(): Promise<void> {
    do {
      this.updateRequested = false;
      await this.processPendingBuilds();
    } while (this.updateRequested && this.pendingBuilds.length > 0);
  }

  private async processPendingBuilds(): Promise<void> {
    if (this.pendingBuilds.length === 0) {
      return;
    }

    // Sort pending builds so closest chunks to the camera are built first.
    this.pendingBuilds.sort((a, b) => {
      const da = Math.abs(a.chunkX - this.cameraChunkX) + Math.abs(a.chunkY - this.cameraChunkY);
      const db = Math.abs(b.chunkX - this.cameraChunkX) + Math.abs(b.chunkY - this.cameraChunkY);
      return da - db;
    });

    // Adaptive budgeting: increase throughput when a large backlog accumulates
    // (e.g. fast camera movement) to avoid visible "pop-in" stagger.
    const backlog = this.pendingBuilds.length;
    const adaptiveMaxBuilds = backlog > 10
      ? this.maxBuildsPerFrame * 4
      : backlog > 5
        ? this.maxBuildsPerFrame * 2
        : this.maxBuildsPerFrame;
    const adaptiveMaxTime = backlog > 10
      ? this.maxBuildTimeMs * 3
      : backlog > 5
        ? this.maxBuildTimeMs * 2
        : this.maxBuildTimeMs;

    const startTime = performance.now();
    let processed = 0;
    let changed = false;

    while (
      this.pendingBuilds.length > 0 &&
      processed < adaptiveMaxBuilds &&
      performance.now() - startTime < adaptiveMaxTime
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
    if (!this.isBuildCurrent(build)) {
      return false;
    }

    const changed = await this.addChunkToSceneFn({
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
      applyTerrainColorMode: chunkMesh => this.viewSettings.applyTerrainColorMode(chunkMesh),
      foliageCameraPosition: {
        x: this.cameraWorldX,
        z: this.cameraWorldZ,
      },
      foliageLodEnabled: this.viewSettings.getFoliageLodEnabled(),
    });

    if (!this.isBuildCurrent(build)) {
      this.removeChunkFromSceneFn({
        chunkX: build.chunkX,
        chunkY: build.chunkY,
        keepFogOfWar: false,
        scene: this.scene,
        chunkMeshes: this.chunkMeshes,
        waterLayerManager: this.waterLayerManager,
        fogOfWarManager: this.fogOfWarManager,
      });
      return false;
    }

    return changed;
  }

  removeChunk(chunkX: number, chunkY: number, keepFogOfWar = false): void {
    const key = getChunkKey(chunkX, chunkY);
    this.cancelPendingBuildsForKey(key);
    this.bumpChunkBuildVersion(key);

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
    this.buildGeneration++;
    this.chunkBuildVersions.clear();
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

    // Also clear pending builds so old backlog does not interfere after world switch
    this.pendingBuilds.length = 0;

    // Safety: remove any lingering chunk objects that were left in the scene.
    const lingering: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      if (
        object.name &&
        (object.name.startsWith('terrain-') ||
          object.name.startsWith('foliage-') ||
          object.name.startsWith('resources-') ||
          object.name.startsWith('structures-') ||
          object.name.startsWith('chunk-boundaries-'))
      ) {
        lingering.push(object);
      }
    });
    for (const obj of lingering) {
      this.scene.remove(obj);
      if (obj instanceof THREE.Group) {
        disposeGroup(obj);
      } else if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        disposeMesh(obj);
      }
    }

    if (removedAny || lingering.length > 0) {
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

  private bumpChunkBuildVersion(key: string): number {
    const nextVersion = (this.chunkBuildVersions.get(key) ?? 0) + 1;
    this.chunkBuildVersions.set(key, nextVersion);
    return nextVersion;
  }

  private cancelPendingBuildsForKey(key: string): boolean {
    let cancelled = false;
    for (let i = this.pendingBuilds.length - 1; i >= 0; i--) {
      if (this.pendingBuilds[i].key === key) {
        this.pendingBuilds.splice(i, 1);
        cancelled = true;
      }
    }
    return cancelled;
  }

  private isBuildCurrent(build: PendingBuild): boolean {
    return (
      build.generation === this.buildGeneration &&
      this.chunkBuildVersions.get(build.key) === build.version
    );
  }
}
