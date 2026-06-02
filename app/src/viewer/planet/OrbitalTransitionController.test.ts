/**
 * @vitest-environment happy-dom
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CameraInputController } from '../CameraInputController';
import { CameraViewController } from '../CameraViewController';
import type { ChunkMesh } from '../ChunkMesh';
import type { PlanetRenderer } from './PlanetRenderer';
import type { SpaceViewManager } from './SpaceViewManager';
import {
  OrbitalState,
  OrbitalTransitionController,
} from './OrbitalTransitionController';

describe('OrbitalTransitionController', () => {
  it('returns the camera above high terrain after landing from planet mode', () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1300);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10000);
    camera.position.set(600, 600, 0);
    const terrain = createFlatTerrainMesh(900);
    const chunks = [{ terrain } as ChunkMesh];

    const controller = new OrbitalTransitionController({
      cameraViewController: new CameraViewController(camera, () => chunks),
      cameraInputController: createCameraInputController(camera, chunks),
      planetRenderer: createPlanetRenderer(),
      spaceViewManager: createSpaceViewManager(),
      chunkController: {} as never,
      atmosphereController: null,
      waterLayerManager: { setVisible: vi.fn() } as never,
      getChunkMeshes: () => chunks,
      canvas: document.createElement('canvas'),
    });

    (controller as unknown as { state: OrbitalState }).state = OrbitalState.ORBIT;
    controller.startTransitionToSurface(0, 0);
    controller.update(1 / 60);

    expect(controller.getState()).toBe(OrbitalState.TERRAIN);
    expect(camera.position.y).toBeGreaterThan(900);
  });
});

function createCameraInputController(camera: THREE.PerspectiveCamera, chunks: ChunkMesh[]): CameraInputController {
  return new CameraInputController({
    camera,
    getContainer: () => null,
    getActiveCamera: () => camera,
    isOrthographic: () => false,
    getOrthographicCamera: () => null,
    getChunkMeshes: () => chunks,
  });
}

function createPlanetRenderer(): PlanetRenderer {
  return {
    hide: vi.fn(),
    setScale: vi.fn(),
    setTransitionOpacity: vi.fn(),
  } as unknown as PlanetRenderer;
}

function createSpaceViewManager(): SpaceViewManager {
  return {
    exitSpace: vi.fn(),
    setStarOpacity: vi.fn(),
  } as unknown as SpaceViewManager;
}

function createFlatTerrainMesh(height: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(1000, 1000);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(250, height, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  return mesh;
}
