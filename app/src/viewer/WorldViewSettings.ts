import type { TerrainSurfaceTextureLibrary } from './materials';
import {
  createTerrainMaterial,
  replaceTerrainMaterial,
  setTerrainWireframe,
  updateTerrainBiomeColors,
  updateTerrainTemperatureColors,
} from './TerrainAppearance';
import {
  applyRenderLayerVisibility,
  RenderLayer,
} from './RenderLayerVisibility';
import { ensureFoliageLodBuilt, setBuiltFoliageLodVisibility } from './FoliageLayerBuilder';
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
  private foliageLodEnabled = true;

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
      } else if (layer === RenderLayer.TEMPERATURE) {
        updateTerrainTemperatureColors(chunkMesh.terrain, visible, chunkMesh.data ?? null);
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

  setFoliageLodEnabled(enabled: boolean): void {
    if (this.foliageLodEnabled === enabled) return;
    this.foliageLodEnabled = enabled;

    for (const chunkMesh of this.chunkMeshes.values()) {
      if (chunkMesh.foliage) {
        chunkMesh.foliage.userData.lodEnabled = enabled;
        if (!enabled) {
          // When LOD is disabled, force full-detail (near) visibility
          ensureFoliageLodBuilt(chunkMesh.foliage, 'near');
          setBuiltFoliageLodVisibility(chunkMesh.foliage, 'near');
        }
      }
    }
  }

  getFoliageLodEnabled(): boolean {
    return this.foliageLodEnabled;
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
