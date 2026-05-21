import * as THREE from 'three';
import { DEFAULT_CAMERA_POSITION_METERS, FOLLOW_TERRAIN_HEIGHT_METERS } from '@engine/index';
import { describe, expect, it } from 'vitest';
import { CameraViewController } from './CameraViewController';
import type { ChunkMesh } from './ChunkMesh';

describe('CameraViewController', () => {
  it('switches to a top-down orthographic camera at the perspective XZ position', () => {
    const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 2000);
    camera.position.set(12, 80, 34);
    const controller = new CameraViewController(camera, () => []);

    controller.setOrthographicView(true);

    expect(controller.isOrthographic()).toBe(true);
    expect(controller.getActiveCamera()).toBe(controller.getOrthographicCamera());
    expect(controller.getCameraPosition()).toEqual({ x: 12, y: 200, z: 34 });
  });

  it('resets perspective camera position, target, and orthographic mode', () => {
    const camera = new THREE.PerspectiveCamera();
    const controller = new CameraViewController(camera, () => []);

    controller.setCameraPosition({ x: 1, y: 2, z: 3 });
    controller.setCameraTarget({ x: 4, y: 5, z: 6 });
    controller.setOrthographicView(true);
    controller.resetCamera();

    expect(controller.isOrthographic()).toBe(false);
    expect(controller.getCameraPosition()).toEqual(DEFAULT_CAMERA_POSITION_METERS);
    expect(controller.getCameraTarget()).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('smoothly follows terrain height at the current target', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 50, 0);
    const terrain = createFlatTerrainMesh(20);
    const controller = new CameraViewController(camera, () => [{ terrain } as ChunkMesh]);
    controller.setCameraTarget({ x: 0, y: 0, z: 0 });
    controller.setFollowTerrainMode(true);

    controller.updateFollowTerrainMode();

    expect(camera.position.y).toBeCloseTo(50 + (20 + FOLLOW_TERRAIN_HEIGHT_METERS - 50) * 0.1);
  });
});

function createFlatTerrainMesh(height: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(10, 10);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, height, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  return mesh;
}
