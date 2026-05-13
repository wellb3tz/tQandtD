import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CameraInputController } from './CameraInputController';
import type { CameraViewController } from './CameraViewController';
import type { ChunkMesh } from './ChunkMesh';
import { RenderLayer } from './RenderLayerVisibility';
import { WorldRenderLoop } from './WorldRenderLoop';
import { DEFAULT_WATER_CONFIG } from './water/config';
import type { WaterLayerManager } from './water/WaterLayerManager';

describe('WorldRenderLoop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs one render tick immediately and cancels the scheduled frame on stop', () => {
    const requestAnimationFrame = vi.fn().mockReturnValue(7);
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
    const render = vi.fn();
    const beforeRender = vi.fn();
    const cameraInputController = { updateMovement: vi.fn() } as unknown as CameraInputController;
    const cameraViewController = createCameraViewController();
    const waterLayerManager = createWaterLayerManager();

    const loop = new WorldRenderLoop({
      scene: new THREE.Scene(),
      renderer: { render } as unknown as THREE.WebGLRenderer,
      cameraInputController,
      cameraViewController,
      chunkMeshes: new Map(),
      layerVisibility: createLayerVisibility(),
      waterLayerManager,
      getWaterConfig: () => DEFAULT_WATER_CONFIG,
      beforeRender,
    });

    loop.start();
    loop.stop();

    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    expect(cameraInputController.updateMovement).toHaveBeenCalledOnce();
    expect(cameraViewController.updateFollowTerrainMode).toHaveBeenCalledOnce();
    expect(waterLayerManager.updateOceanWaves).toHaveBeenCalledOnce();
    expect(waterLayerManager.updateOceanWaves).toHaveBeenCalledWith(
      expect.any(Number),
      DEFAULT_WATER_CONFIG.ocean,
    );
    expect(waterLayerManager.updateRiverFlows).toHaveBeenCalledOnce();
    expect(waterLayerManager.updateRiverFlows).toHaveBeenCalledWith(expect.any(Number));
    expect(beforeRender).toHaveBeenCalledWith(cameraViewController.getActiveCamera());
    expect(render).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
  });

  it('restores chunk visibility when frustum culling is disabled', () => {
    const terrain = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const chunkMeshes = new Map<string, ChunkMesh>([
      ['0,0', { terrain, visible: false }],
    ]);

    const loop = new WorldRenderLoop({
      scene: new THREE.Scene(),
      renderer: { render: vi.fn() } as unknown as THREE.WebGLRenderer,
      cameraInputController: { updateMovement: vi.fn() } as unknown as CameraInputController,
      cameraViewController: createCameraViewController(),
      chunkMeshes,
      layerVisibility: createLayerVisibility(),
      waterLayerManager: createWaterLayerManager(),
      getWaterConfig: () => DEFAULT_WATER_CONFIG,
      beforeRender: vi.fn(),
    });

    loop.setFrustumCulling(false);

    expect(chunkMeshes.get('0,0')?.visible).toBe(true);
    expect(terrain.visible).toBe(true);
    expect(loop.getFrustumCullingStats()).toEqual({ enabled: false, visible: 1, hidden: 0, total: 1 });
  });
});

function createCameraViewController(): CameraViewController {
  const camera = new THREE.PerspectiveCamera();
  camera.updateMatrixWorld(true);
  return {
    getActiveCamera: () => camera,
    updateFollowTerrainMode: vi.fn(),
  } as unknown as CameraViewController;
}

function createLayerVisibility(): Map<RenderLayer, boolean> {
  return new Map(Object.values(RenderLayer).map(layer => [layer, true]));
}

function createWaterLayerManager(): WaterLayerManager {
  return {
    applyFrustumCulling: vi.fn(),
    updateOceanWaves: vi.fn(),
    updateRiverFlows: vi.fn(),
  } as unknown as WaterLayerManager;
}
