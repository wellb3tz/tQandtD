import * as THREE from 'three';
import type { CameraInputController } from './CameraInputController';
import type { CameraViewController } from './CameraViewController';
import type { ChunkMesh } from './ChunkMesh';
import {
  calculateFrustumCullingStats,
  restoreChunkVisibility,
  updateFrustumCulledChunks,
} from './FrustumCulling';
import type { RenderLayer } from './RenderLayerVisibility';
import type { WaterLayerManager } from './water/WaterLayerManager';
import type { WaterConfig } from './water/types';
import type { WorldChunkController } from './WorldChunkController';
import type { OrbitalTransitionController } from './planet/OrbitalTransitionController';

export interface WorldRenderLoopOptions {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  cameraInputController: CameraInputController;
  cameraViewController: CameraViewController;
  chunkMeshes: Map<string, ChunkMesh>;
  layerVisibility: Map<RenderLayer, boolean>;
  waterLayerManager: WaterLayerManager;
  getWaterConfig: () => WaterConfig;
  beforeRender: (activeCamera: THREE.Camera) => void;
  chunkController?: WorldChunkController;
  orbitalTransitionController?: OrbitalTransitionController;
}

export class WorldRenderLoop {
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly cameraInputController: CameraInputController;
  private readonly cameraViewController: CameraViewController;
  private readonly chunkMeshes: Map<string, ChunkMesh>;
  private readonly layerVisibility: Map<RenderLayer, boolean>;
  private readonly waterLayerManager: WaterLayerManager;
  private readonly getWaterConfig: () => WaterConfig;
  private readonly beforeRender: (activeCamera: THREE.Camera) => void;
  private readonly chunkController: WorldChunkController | undefined;
  private orbitalTransitionController: OrbitalTransitionController | undefined;
  private readonly frustum = new THREE.Frustum();
  private readonly frustumMatrix = new THREE.Matrix4();
  private animationFrameId: number | null = null;
  private enableFrustumCulling = true;
  private readonly cullingCheckInterval = 16;
  private lastCullingCheck = 0;

  constructor(options: WorldRenderLoopOptions) {
    this.scene = options.scene;
    this.renderer = options.renderer;
    this.cameraInputController = options.cameraInputController;
    this.cameraViewController = options.cameraViewController;
    this.chunkMeshes = options.chunkMeshes;
    this.layerVisibility = options.layerVisibility;
    this.waterLayerManager = options.waterLayerManager;
    this.getWaterConfig = options.getWaterConfig;
    this.beforeRender = options.beforeRender;
    this.chunkController = options.chunkController;
    this.orbitalTransitionController = options.orbitalTransitionController;
  }

  start(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      const activeCamera = this.cameraViewController.getActiveCamera();

      const isOrbital = this.orbitalTransitionController?.isOrbital() ?? false;
      const isTransitioning = this.orbitalTransitionController?.isTransitioning() ?? false;

      if (!isOrbital && !isTransitioning) {
        this.chunkController?.setCameraPosition(activeCamera.position.x, activeCamera.position.z);
        this.chunkController?.update().catch(() => {
          // Silently ignore errors from chunk controller updates
        });
      }

      if (!isOrbital && !isTransitioning) {
        this.cameraInputController.updateMovement();
        this.cameraInputController.updateFirstPersonPhysics();
        this.cameraViewController.updateFollowTerrainMode();
      }

      const now = performance.now();
      const elapsedSeconds = now / 1000;
      const waterConfig = this.getWaterConfig();

      if (!isOrbital && !isTransitioning) {
        this.waterLayerManager.updateOceanWaves(elapsedSeconds, waterConfig.ocean);
        this.waterLayerManager.updateRiverFlows(elapsedSeconds);
      }

      if (this.enableFrustumCulling && !isOrbital && !isTransitioning && now - this.lastCullingCheck > this.cullingCheckInterval) {
        this.updateFrustumCulling();
        this.lastCullingCheck = now;
        if (waterConfig.performance.enableFrustumCulling) {
          this.waterLayerManager.applyFrustumCulling(this.cameraViewController.getActiveCamera(), waterConfig);
        }
      }

      // Orbital transition controller update (must run after camera positioning)
      if (this.orbitalTransitionController) {
        this.orbitalTransitionController.update(1 / 60);
      }

      this.beforeRender(activeCamera);
      this.renderer.render(this.scene, activeCamera);
    };

    animate();
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  setOrbitalTransitionController(controller: OrbitalTransitionController | undefined): void {
    this.orbitalTransitionController = controller;
  }

  setFrustumCulling(enabled: boolean): void {
    this.enableFrustumCulling = enabled;
    if (!enabled) {
      restoreChunkVisibility(this.chunkMeshes.values(), this.layerVisibility);
    }
  }

  getFrustumCullingStats() {
    return calculateFrustumCullingStats(this.chunkMeshes.values(), this.enableFrustumCulling);
  }

  private updateFrustumCulling(): void {
    if (!this.enableFrustumCulling) return;

    const activeCamera = this.cameraViewController.getActiveCamera();
    this.frustumMatrix.multiplyMatrices(activeCamera.projectionMatrix, activeCamera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    updateFrustumCulledChunks(this.chunkMeshes.values(), this.frustum, this.layerVisibility);
  }
}
