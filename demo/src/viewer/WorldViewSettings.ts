import type { TerrainSurfaceTextureLibrary } from './materials';
import {
  createTerrainMaterial,
  replaceTerrainMaterial,
  setTerrainWireframe,
  updateTerrainBiomeColors,
} from './TerrainAppearance';
import {
  applyRenderLayerVisibility,
  RenderLayer,
} from './RenderLayerVisibility';
import type { ChunkMesh } from './ChunkMesh';
import type { WaterLayerManager } from './water/WaterLayerManager';
import type { WaterConfig } from './water/types';

export class WorldViewSettings {
  private readonly chunkMeshes: Map<string, ChunkMesh>;
  private readonly waterLayerManager: WaterLayerManager;
  private readonly terrainTextures: TerrainSurfaceTextureLibrary;
  private readonly layerVisibility = new Map<RenderLayer, boolean>();
  private waterConfig: WaterConfig;
  private wireframeMode = false;
  private terrainTexturesEnabled = true;

  constructor(options: {
    chunkMeshes: Map<string, ChunkMesh>;
    waterLayerManager: WaterLayerManager;
    waterConfig: WaterConfig;
    terrainTextures: TerrainSurfaceTextureLibrary;
  }) {
    this.chunkMeshes = options.chunkMeshes;
    this.waterLayerManager = options.waterLayerManager;
    this.waterConfig = options.waterConfig;
    this.terrainTextures = options.terrainTextures;

    Object.values(RenderLayer).forEach(layer => {
      this.layerVisibility.set(layer, true);
    });
  }

  getLayerVisibility(): Map<RenderLayer, boolean> {
    return this.layerVisibility;
  }

  getWaterConfig(): WaterConfig {
    return { ...this.waterConfig };
  }

  getWaterConfigReference(): WaterConfig {
    return this.waterConfig;
  }

  setWaterConfig(config: Partial<WaterConfig>): void {
    this.waterConfig = { ...this.waterConfig, ...config };
  }

  setWaterVisibility(visible: boolean): void {
    this.waterLayerManager.toggleWaterVisibility(visible);
  }

  setVisibility(layer: RenderLayer, visible: boolean): void {
    this.layerVisibility.set(layer, visible);

    for (const chunkMesh of this.chunkMeshes.values()) {
      if (layer === RenderLayer.BIOMES) {
        updateTerrainBiomeColors(chunkMesh.terrain, visible);
      } else {
        applyRenderLayerVisibility(chunkMesh, layer, this.layerVisibility);
      }
    }
  }

  setWireframeMode(enabled: boolean): void {
    this.wireframeMode = enabled;

    for (const chunkMesh of this.chunkMeshes.values()) {
      setTerrainWireframe(chunkMesh.terrain, enabled);
    }
  }

  setTerrainTexturesEnabled(enabled: boolean): void {
    if (this.terrainTexturesEnabled === enabled) return;

    this.terrainTexturesEnabled = enabled;
    for (const chunkMesh of this.chunkMeshes.values()) {
      replaceTerrainMaterial(chunkMesh.terrain, createTerrainMaterial({
        terrainTextures: this.terrainTextures,
        terrainTexturesEnabled: this.terrainTexturesEnabled,
        wireframeMode: this.wireframeMode,
      }));
    }
  }

  areTerrainTexturesEnabled(): boolean {
    return this.terrainTexturesEnabled;
  }

  getTerrainTextures(): TerrainSurfaceTextureLibrary {
    return this.terrainTextures;
  }

  getTerrainTexturesEnabled(): boolean {
    return this.terrainTexturesEnabled;
  }

  getWireframeMode(): boolean {
    return this.wireframeMode;
  }
}
