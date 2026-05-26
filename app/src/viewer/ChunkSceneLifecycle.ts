import * as THREE from 'three';
import type { ChunkData } from '@engine/index';
import type { TerrainSurfaceTextureLibrary } from './materials';
import { createChunkBoundaries } from './ChunkBoundaryBuilder';
import { getChunkKey, type ChunkMesh } from './ChunkMesh';
import { createFoliageLayer } from './FoliageLayerBuilder';
import { createResourceMarkers, createStructureMarkers } from './MarkerBuilder';
import { isRenderLayerVisible, RenderLayer } from './RenderLayerVisibility';
import { createTerrainMesh } from './TerrainMeshBuilder';
import {
  stitchBoundaryColors,
  stitchBoundaryDetailBlends,
  stitchBoundaryNormals,
  stitchBoundarySurfaceBlends,
  stitchLakeBoundaryPositions,
} from './TerrainBoundaryStitcher';
import { disposeGroup, disposeMesh } from './ThreeDisposal';
import type { WaterLayerManager } from './water/WaterLayerManager';
import type { WaterConfig } from './water/types';
import type { FogOfWarManager } from './FogOfWarManager';

export interface AddChunkToSceneOptions {
  chunkX: number;
  chunkY: number;
  data: ChunkData;
  partial?: boolean;
  stage?: number;
  scene: THREE.Scene;
  chunkMeshes: Map<string, ChunkMesh>;
  layerVisibility: Map<RenderLayer, boolean>;
  waterLayerManager: WaterLayerManager;
  waterConfig: WaterConfig;
  fogOfWarManager: FogOfWarManager;
  terrainTextures: TerrainSurfaceTextureLibrary;
  terrainTexturesEnabled: boolean;
  wireframeMode: boolean;
}

export interface RemoveChunkFromSceneOptions {
  chunkX: number;
  chunkY: number;
  keepFogOfWar?: boolean;
  scene: THREE.Scene;
  chunkMeshes: Map<string, ChunkMesh>;
  waterLayerManager: WaterLayerManager;
  fogOfWarManager: FogOfWarManager;
}

export async function addChunkToScene(options: AddChunkToSceneOptions): Promise<boolean> {
  const {
    chunkX,
    chunkY,
    data,
    partial = false,
    stage,
    scene,
    chunkMeshes,
    fogOfWarManager,
  } = options;
  const key = getChunkKey(chunkX, chunkY);

  if (!data.heightmap) {
    return false;
  }

  fogOfWarManager.removeFogPlane(chunkX, chunkY, scene);
  if (chunkMeshes.has(key)) {
    removeChunkFromScene({ ...options, keepFogOfWar: false });
  }

  const chunkMesh = await createChunkMesh(options, partial, stage);
  chunkMeshes.set(key, chunkMesh);
  stitchChunkAndNeighbours(chunkMeshes, options.waterLayerManager, chunkX, chunkY, data.size);
  return true;
}

export function removeChunkFromScene(options: RemoveChunkFromSceneOptions): boolean {
  const { chunkX, chunkY, keepFogOfWar = false, scene, chunkMeshes, waterLayerManager, fogOfWarManager } = options;
  const key = getChunkKey(chunkX, chunkY);
  const chunkMesh = chunkMeshes.get(key);
  if (!chunkMesh) return false;

  if (keepFogOfWar) {
    fogOfWarManager.createFogPlane(chunkX, chunkY, chunkMesh.terrain, scene);
  }

  if (chunkMesh.water) {
    waterLayerManager.removeWaterFromChunk(key, scene);
  }

  removeAndDisposeChunkMesh(scene, chunkMesh);
  chunkMeshes.delete(key);
  return true;
}

async function createChunkMesh(
  options: AddChunkToSceneOptions,
  partial: boolean,
  stage: number | undefined,
): Promise<ChunkMesh> {
  const {
    chunkX,
    chunkY,
    data,
    scene,
    layerVisibility,
    waterLayerManager,
    waterConfig,
    terrainTextures,
    terrainTexturesEnabled,
    wireframeMode,
  } = options;
  const key = getChunkKey(chunkX, chunkY);
  const chunkMesh: ChunkMesh = {
    terrain: await createTerrainMesh({
      chunkX,
      chunkY,
      data,
      partial,
      stage,
      waterConfig,
      terrainTextures,
      terrainTexturesEnabled,
      wireframeMode,
    }),
    data,
    visible: true,
  };

  chunkMesh.terrain.geometry.computeBoundingBox();
  chunkMesh.boundingBox = chunkMesh.terrain.geometry.boundingBox!.clone();
  chunkMesh.boundingBox.applyMatrix4(chunkMesh.terrain.matrixWorld);
  scene.add(chunkMesh.terrain);

  if (waterConfig.enabled && data.heightmap) {
    waterLayerManager.addWaterToChunk(key, data, scene, waterConfig);
    const waterLayer = waterLayerManager.getWaterLayer(key);
    if (waterLayer) {
      chunkMesh.water = waterLayer;
      waterLayer.group.renderOrder = 1;
    }
  }

  const foliage = createFoliageLayer(chunkX, chunkY, data, waterConfig.seaLevel);
  if (foliage) {
    foliage.visible = isRenderLayerVisible(layerVisibility, RenderLayer.FOLIAGE);
    chunkMesh.foliage = foliage;
    scene.add(foliage);
  }

  if (!partial || (stage !== undefined && stage >= 2)) {
    if (data.resources && data.resources.length > 0) {
      chunkMesh.resources = createResourceMarkers(chunkX, chunkY, data);
      chunkMesh.resources.visible = isRenderLayerVisible(layerVisibility, RenderLayer.RESOURCES);
      scene.add(chunkMesh.resources);
    }
  }

  if (!partial || (stage !== undefined && stage >= 3)) {
    if (data.structures && data.structures.length > 0) {
      chunkMesh.structures = createStructureMarkers(chunkX, chunkY, data);
      chunkMesh.structures.visible = isRenderLayerVisible(layerVisibility, RenderLayer.STRUCTURES);
      scene.add(chunkMesh.structures);
    }
  }

  chunkMesh.boundaries = createChunkBoundaries(chunkX, chunkY, data);
  chunkMesh.boundaries.visible = isRenderLayerVisible(layerVisibility, RenderLayer.CHUNK_BOUNDARIES);
  scene.add(chunkMesh.boundaries);
  return chunkMesh;
}

function removeAndDisposeChunkMesh(scene: THREE.Scene, chunkMesh: ChunkMesh): void {
  scene.remove(chunkMesh.terrain);
  // NOTE: dispose geometry only - terrain material is shared across all
  // chunks via getCachedTerrainMaterial() and must not be disposed here.
  chunkMesh.terrain.geometry.dispose();

  if (chunkMesh.resources) {
    scene.remove(chunkMesh.resources);
    disposeGroup(chunkMesh.resources);
  }
  if (chunkMesh.foliage) {
    scene.remove(chunkMesh.foliage);
    disposeGroup(chunkMesh.foliage);
  }
  if (chunkMesh.structures) {
    scene.remove(chunkMesh.structures);
    disposeGroup(chunkMesh.structures);
  }
  if (chunkMesh.boundaries) {
    scene.remove(chunkMesh.boundaries);
    disposeMesh(chunkMesh.boundaries);
  }
}

function stitchChunkAndNeighbours(
  chunkMeshes: Map<string, ChunkMesh>,
  waterLayerManager: WaterLayerManager,
  chunkX: number,
  chunkY: number,
  chunkSize: number,
): void {
  stitchChunk(chunkMeshes, chunkX, chunkY);
  for (const [dx, dz] of [[-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1], [1, 1], [-1, 1], [1, -1]]) {
    const nKey = getChunkKey(chunkX + dx, chunkY + dz);
    if (chunkMeshes.has(nKey)) {
      stitchChunk(chunkMeshes, chunkX + dx, chunkY + dz);
      waterLayerManager.stitchWaterBoundaryHeights(getChunkKey(chunkX, chunkY), nKey, chunkSize);
    }
  }
}

function stitchChunk(chunkMeshes: Map<string, ChunkMesh>, chunkX: number, chunkY: number): void {
  stitchLakeBoundaryPositions(chunkMeshes, chunkX, chunkY);
  stitchBoundaryNormals(chunkMeshes, chunkX, chunkY);
  stitchBoundaryColors(chunkMeshes, chunkX, chunkY);
  stitchBoundarySurfaceBlends(chunkMeshes, chunkX, chunkY);
  stitchBoundaryDetailBlends(chunkMeshes, chunkX, chunkY);
}
