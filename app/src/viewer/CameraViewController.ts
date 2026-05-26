import * as THREE from 'three';
import type { ChunkMesh } from './ChunkMesh';
import {
  DEFAULT_CAMERA_POSITION_METERS,
  FOLLOW_TERRAIN_HEIGHT_METERS,
  ORTHOGRAPHIC_FRUSTUM_SIZE_METERS,
} from '@engine/index';

export interface CameraVector3 {
  x: number;
  y: number;
  z: number;
}

export class CameraViewController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly getChunkMeshes: () => Iterable<ChunkMesh>;
  private followTerrainMode = false;
  private readonly followTerrainHeight = FOLLOW_TERRAIN_HEIGHT_METERS;
  private orthographicCamera: THREE.OrthographicCamera | null = null;
  private isOrthographicMode = false;
  private isOrbitMode = false;
  private readonly cameraTarget = new THREE.Vector3(0, 0, 0);

  constructor(camera: THREE.PerspectiveCamera, getChunkMeshes: () => Iterable<ChunkMesh>) {
    this.camera = camera;
    this.getChunkMeshes = getChunkMeshes;
  }

  getActiveCamera(): THREE.Camera {
    return this.isOrthographicMode && this.orthographicCamera ? this.orthographicCamera : this.camera;
  }

  getOrthographicCamera(): THREE.OrthographicCamera | null {
    return this.orthographicCamera;
  }

  isOrthographic(): boolean {
    return this.isOrthographicMode;
  }

  setCameraPosition(position: CameraVector3): void {
    this.camera.position.set(position.x, position.y, position.z);
  }

  setCameraTarget(target: CameraVector3): void {
    this.cameraTarget.set(target.x, target.y, target.z);
  }

  resetCamera(): void {
    if (this.isOrthographicMode) {
      this.setOrthographicView(false);
    }
    this.followTerrainMode = false;
    this.camera.position.set(
      DEFAULT_CAMERA_POSITION_METERS.x,
      DEFAULT_CAMERA_POSITION_METERS.y,
      DEFAULT_CAMERA_POSITION_METERS.z,
    );
    this.cameraTarget.set(0, 0, 0);
  }

  setOrthographicView(enabled: boolean): void {
    if (enabled === this.isOrthographicMode) return;

    this.isOrthographicMode = enabled;
    if (!enabled) return;

    if (!this.orthographicCamera) {
      const aspect = this.camera.aspect;
      const frustumSize = ORTHOGRAPHIC_FRUSTUM_SIZE_METERS;
      this.orthographicCamera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        10000,
      );
    }

    const px = this.camera.position.x;
    const pz = this.camera.position.z;
    this.orthographicCamera.position.set(px, 2000, pz);
    this.orthographicCamera.lookAt(px, 0, pz);
  }

  setFollowTerrainMode(enabled: boolean): void {
    this.followTerrainMode = enabled;
    if (enabled && this.isOrthographicMode) {
      this.setOrthographicView(false);
    }
  }

  updateFollowTerrainMode(): void {
    if (!this.followTerrainMode) return;

    const raycaster = new THREE.Raycaster();
    raycaster.set(
      new THREE.Vector3(this.cameraTarget.x, 2000, this.cameraTarget.z),
      new THREE.Vector3(0, -1, 0),
    );

    const terrainMeshes: THREE.Mesh[] = [];
    for (const chunkMesh of this.getChunkMeshes()) {
      terrainMeshes.push(chunkMesh.terrain);
    }

    if (terrainMeshes.length === 0) return;

    const intersects = raycaster.intersectObjects(terrainMeshes);
    if (intersects.length === 0) return;

    const terrainHeight = intersects[0].point.y;
    const targetHeight = terrainHeight + this.followTerrainHeight;
    this.camera.position.y += (targetHeight - this.camera.position.y) * 0.1;
  }

  getCameraPosition(): CameraVector3 {
    if (this.isOrthographicMode && this.orthographicCamera) {
      return {
        x: this.orthographicCamera.position.x,
        y: this.orthographicCamera.position.y,
        z: this.orthographicCamera.position.z,
      };
    }
    return {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
    };
  }

  getCameraTarget(): CameraVector3 {
    return {
      x: this.cameraTarget.x,
      y: this.cameraTarget.y,
      z: this.cameraTarget.z,
    };
  }

  /**
   * Set whether the camera is in orbit (space) mode.
   * In orbit mode the standard terrain camera update is bypassed.
   */
  setOrbitMode(enabled: boolean): void {
    this.isOrbitMode = enabled;
  }

  isOrbital(): boolean {
    return this.isOrbitMode;
  }
}
