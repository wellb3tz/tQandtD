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
}

export class WorldChunkController {
  private readonly scene: THREE.Scene;
  private readonly chunkMeshes: Map<string, ChunkMesh>;
  private readonly viewSettings: WorldChunkViewSettings;
  private readonly waterLayerManager: WaterLayerManager;
  private readonly fogOfWarManager: FogOfWarManager;
  private readonly onChunksChanged: () => void;
  private readonly addChunkToSceneFn: (options: AddChunkToSceneOptions) => boolean;
  private readonly removeChunkFromSceneFn: (options: RemoveChunkFromSceneOptions) => boolean;

  constructor(options: WorldChunkControllerOptions) {
    this.scene = options.scene;
    this.chunkMeshes = options.chunkMeshes;
    this.viewSettings = options.viewSettings;
    this.waterLayerManager = options.waterLayerManager;
    this.fogOfWarManager = options.fogOfWarManager;
    this.onChunksChanged = options.onChunksChanged;
    this.addChunkToSceneFn = options.addChunkToSceneFn ?? addChunkToScene;
    this.removeChunkFromSceneFn = options.removeChunkFromSceneFn ?? removeChunkFromScene;
  }

  addChunk(chunkX: number, chunkY: number, data: ChunkData, partial = false, stage?: number): void {
    const added = this.addChunkToSceneFn({
      chunkX,
      chunkY,
      data,
      partial,
      stage,
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

    if (added) {
      this.onChunksChanged();
    }
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
