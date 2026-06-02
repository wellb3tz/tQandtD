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
  it('passes current viewer settings when adding a chunk', async () => {
    const addChunkToSceneFn = vi.fn(() => true);
    const onChunksChanged = vi.fn();
    const context = createContext({ addChunkToSceneFn, onChunksChanged });
    const data = createChunkData();

    context.controller.addChunk(1, 2, data, true, 3);
    await context.controller.update();

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
      foliageLodEnabled: true,
    }));
    expect(onChunksChanged).toHaveBeenCalledTimes(1);
  });

  it('does not invalidate stats when add or remove reports no scene change', async () => {
    const onChunksChanged = vi.fn();
    const context = createContext({
      addChunkToSceneFn: vi.fn(() => false),
      removeChunkFromSceneFn: vi.fn(() => false),
      onChunksChanged,
    });

    context.controller.addChunk(0, 0, createChunkData());
    await context.controller.update();
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

  it('removes lingering untracked terrain objects when clearing', () => {
    const onChunksChanged = vi.fn();
    const context = createContext({ onChunksChanged });
    const terrain = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    terrain.name = 'terrain-99,99';
    context.scene.add(terrain);

    context.controller.clearChunks();

    expect(context.scene.getObjectByName('terrain-99,99')).toBeUndefined();
    expect(onChunksChanged).toHaveBeenCalledTimes(1);
  });

  it('discards async chunk builds that finish after chunks were cleared', async () => {
    let resolveBuild!: (changed: boolean) => void;
    const addChunkToSceneFn = vi.fn(() => new Promise<boolean>(resolve => {
      resolveBuild = resolve;
    }));
    const removeChunkFromSceneFn = vi.fn(() => true);
    const onChunksChanged = vi.fn();
    const context = createContext({ addChunkToSceneFn, removeChunkFromSceneFn, onChunksChanged });

    context.controller.addChunk(7, 8, createChunkData());
    const updatePromise = context.controller.update();
    await Promise.resolve();

    context.controller.clearChunks();
    resolveBuild(true);
    await updatePromise;

    expect(removeChunkFromSceneFn).toHaveBeenCalledWith(expect.objectContaining({
      chunkX: 7,
      chunkY: 8,
      keepFogOfWar: false,
    }));
    expect(onChunksChanged).not.toHaveBeenCalled();
  });

  it('cancels a queued chunk build when that chunk is removed before processing', async () => {
    const addChunkToSceneFn = vi.fn(() => true);
    const removeChunkFromSceneFn = vi.fn(() => false);
    const onChunksChanged = vi.fn();
    const context = createContext({ addChunkToSceneFn, removeChunkFromSceneFn, onChunksChanged });

    context.controller.addChunk(4, 5, createChunkData());
    context.controller.removeChunk(4, 5);
    await context.controller.update();

    expect(addChunkToSceneFn).not.toHaveBeenCalled();
    expect(removeChunkFromSceneFn).toHaveBeenCalledWith(expect.objectContaining({
      chunkX: 4,
      chunkY: 5,
    }));
    expect(onChunksChanged).not.toHaveBeenCalled();
  });

  it('removes an async chunk build that finishes after that chunk was unloaded', async () => {
    let resolveBuild!: (changed: boolean) => void;
    const addChunkToSceneFn = vi.fn(() => new Promise<boolean>(resolve => {
      resolveBuild = resolve;
    }));
    const removeChunkFromSceneFn = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const onChunksChanged = vi.fn();
    const context = createContext({ addChunkToSceneFn, removeChunkFromSceneFn, onChunksChanged });

    context.controller.addChunk(7, 8, createChunkData());
    const updatePromise = context.controller.update();
    await Promise.resolve();

    context.controller.removeChunk(7, 8);
    resolveBuild(true);
    await updatePromise;

    expect(removeChunkFromSceneFn).toHaveBeenNthCalledWith(2, expect.objectContaining({
      chunkX: 7,
      chunkY: 8,
      keepFogOfWar: false,
    }));
    expect(onChunksChanged).not.toHaveBeenCalled();
  });

  it('keeps chunk build updates serialized when the render loop ticks again during a build', async () => {
    let resolveBuild!: (changed: boolean) => void;
    const addChunkToSceneFn = vi.fn(() => new Promise<boolean>(resolve => {
      resolveBuild = resolve;
    }));
    const context = createContext({ addChunkToSceneFn });

    context.controller.addChunk(1, 1, createChunkData());
    const firstUpdate = context.controller.update();
    await Promise.resolve();
    const secondUpdate = context.controller.update();

    expect(addChunkToSceneFn).toHaveBeenCalledTimes(1);

    resolveBuild(true);
    await firstUpdate;
    await secondUpdate;
  });

  it('updates water meshes before replacing an existing chunk', async () => {
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
    await context.controller.update();

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
    getFoliageLodEnabled: () => true,
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
