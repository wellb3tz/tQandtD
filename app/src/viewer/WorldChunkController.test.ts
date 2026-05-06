import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { ChunkData } from '@engine/index';
import { DEFAULT_WATER_CONFIG } from './water/config';
import { WorldChunkController, type WorldChunkViewSettings } from './WorldChunkController';
import type { ChunkMesh } from './ChunkMesh';
import type { WaterLayerManager } from './water/WaterLayerManager';
import type { FogOfWarManager } from './FogOfWarManager';
import type { TerrainSurfaceTextureLibrary } from './materials';

describe('WorldChunkController', () => {
  it('passes current viewer settings when adding a chunk', () => {
    const addChunkToSceneFn = vi.fn(() => true);
    const onChunksChanged = vi.fn();
    const context = createContext({ addChunkToSceneFn, onChunksChanged });
    const data = createChunkData();

    context.controller.addChunk(1, 2, data, true, 3);

    expect(addChunkToSceneFn).toHaveBeenCalledWith(expect.objectContaining({
      chunkX: 1,
      chunkY: 2,
      data,
      partial: true,
      stage: 3,
      scene: context.scene,
      chunkMeshes: context.chunkMeshes,
      layerVisibility: context.layerVisibility,
      waterLayerManager: context.waterLayerManager,
      waterConfig: context.waterConfig,
      fogOfWarManager: context.fogOfWarManager,
      terrainTextures: context.terrainTextures,
      terrainTexturesEnabled: true,
      wireframeMode: false,
    }));
    expect(onChunksChanged).toHaveBeenCalledTimes(1);
  });

  it('does not invalidate stats when add or remove reports no scene change', () => {
    const onChunksChanged = vi.fn();
    const context = createContext({
      addChunkToSceneFn: vi.fn(() => false),
      removeChunkFromSceneFn: vi.fn(() => false),
      onChunksChanged,
    });

    context.controller.addChunk(0, 0, createChunkData());
    context.controller.removeChunk(0, 0);

    expect(onChunksChanged).not.toHaveBeenCalled();
  });

  it('removes all currently tracked chunks when clearing', () => {
    const removeChunkFromSceneFn = vi.fn(() => true);
    const onChunksChanged = vi.fn();
    const context = createContext({ removeChunkFromSceneFn, onChunksChanged });
    context.chunkMeshes.set('1,2', createChunkMesh());
    context.chunkMeshes.set('-3,4', createChunkMesh());

    context.controller.clearChunks();

    expect(removeChunkFromSceneFn).toHaveBeenCalledWith(expect.objectContaining({
      chunkX: 1,
      chunkY: 2,
      keepFogOfWar: false,
    }));
    expect(removeChunkFromSceneFn).toHaveBeenCalledWith(expect.objectContaining({
      chunkX: -3,
      chunkY: 4,
      keepFogOfWar: false,
    }));
    expect(onChunksChanged).toHaveBeenCalledTimes(1);
  });

  it('does not invalidate stats when clearing an already empty scene', () => {
    const onChunksChanged = vi.fn();
    const context = createContext({ onChunksChanged });

    context.controller.clearChunks();

    expect(onChunksChanged).not.toHaveBeenCalled();
  });

  it('updates water meshes before replacing an existing chunk', () => {
    const addChunkToSceneFn = vi.fn(() => true);
    const removeChunkFromSceneFn = vi.fn(() => true);
    const updateWaterMeshes = vi.fn();
    const context = createContext({
      addChunkToSceneFn,
      removeChunkFromSceneFn,
      waterLayerManagerOverrides: { updateWaterMeshes },
    });
    const data = createChunkData();

    context.controller.updateChunk(2, 3, data);

    expect(updateWaterMeshes).toHaveBeenCalledWith('2,3', data, context.scene, context.waterConfig);
    expect(removeChunkFromSceneFn).toHaveBeenCalledWith(expect.objectContaining({ chunkX: 2, chunkY: 3 }));
    expect(addChunkToSceneFn).toHaveBeenCalledWith(expect.objectContaining({ chunkX: 2, chunkY: 3, data }));
  });
});

function createContext(overrides: {
  addChunkToSceneFn?: ConstructorParameters<typeof WorldChunkController>[0]['addChunkToSceneFn'];
  removeChunkFromSceneFn?: ConstructorParameters<typeof WorldChunkController>[0]['removeChunkFromSceneFn'];
  onChunksChanged?: () => void;
  waterLayerManagerOverrides?: Partial<WaterLayerManager>;
} = {}) {
  const scene = new THREE.Scene();
  const chunkMeshes = new Map<string, ChunkMesh>();
  const layerVisibility = new Map();
  const waterConfig = { ...DEFAULT_WATER_CONFIG, enabled: true };
  const terrainTextures = {} as TerrainSurfaceTextureLibrary;
  const waterLayerManager = {
    updateWaterMeshes: vi.fn(),
    ...overrides.waterLayerManagerOverrides,
  } as unknown as WaterLayerManager;
  const fogOfWarManager = {} as FogOfWarManager;
  const viewSettings: WorldChunkViewSettings = {
    getLayerVisibility: () => layerVisibility,
    getWaterConfigReference: () => waterConfig,
    getTerrainTextures: () => terrainTextures,
    getTerrainTexturesEnabled: () => true,
    getWireframeMode: () => false,
  };
  const controller = new WorldChunkController({
    scene,
    chunkMeshes,
    viewSettings,
    waterLayerManager,
    fogOfWarManager,
    onChunksChanged: overrides.onChunksChanged ?? vi.fn(),
    addChunkToSceneFn: overrides.addChunkToSceneFn,
    removeChunkFromSceneFn: overrides.removeChunkFromSceneFn,
  });

  return {
    controller,
    scene,
    chunkMeshes,
    layerVisibility,
    waterConfig,
    terrainTextures,
    waterLayerManager,
    fogOfWarManager,
  };
}

function createChunkData(): ChunkData {
  return {
    size: 1,
    heightmap: new Float32Array([0, 0, 0, 0]),
    biomeMap: new Uint8Array([0]),
    resources: [],
    structures: [],
  } as ChunkData;
}

function createChunkMesh(): ChunkMesh {
  return {
    terrain: new THREE.Mesh(),
  };
}
