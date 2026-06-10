import * as THREE from 'three';
import type { CameraInputController } from './CameraInputController';
import type { CameraViewController } from './CameraViewController';
import type { ChunkMesh } from './ChunkMesh';
import {
  shouldUpdateFoliageLod,
  updateFoliageLodForChunks,
  type FoliageLodStats,
} from './FoliageLodController';
import {
  calculateFrustumCullingStats,
  restoreChunkVisibility,
  updateFrustumCulledChunks,
} from './FrustumCulling';
import type { RenderLayer } from './RenderLayerVisibility';
import type { WaterLayerManager } from './water/WaterLayerManager';
import type { WaterConfig } from './water/types';
import type { WorldChunkController } from './WorldChunkController';
import { updateTerrainMaterialAnimation } from './materials';

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
  private readonly frustum = new THREE.Frustum();
  private readonly frustumMatrix = new THREE.Matrix4();
  private animationFrameId: number | null = null;
  private enableFrustumCulling = true;
  private readonly cullingCheckInterval = 16;
  private lastCullingCheck = 0;
  private lastFoliageLodCameraPosition: THREE.Vector3 | undefined;
  private lastFoliageLodChunkCount = -1;
  private foliageLodStats: FoliageLodStats = { near: 0, mid: 0, far: 0, hidden: 0 };
  private terrainAnimationMaterials: THREE.Material[] = [];
  private terrainAnimationMaterialsDirty = true;

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
  }

  start(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      const activeCamera = this.cameraViewController.getActiveCamera();
      this.chunkController?.setCameraPosition(activeCamera.position.x, activeCamera.position.z);
      if (this.chunkController?.hasPendingBuilds()) {
        this.chunkController.update().catch(() => {
          // Silently ignore errors from chunk controller updates
        });
      }

      this.cameraInputController.updateMovement();
      this.cameraInputController.updateFirstPersonPhysics();
      this.cameraViewController.updateFollowTerrainMode();

      const now = performance.now();
      const elapsedSeconds = now / 1000;
      const waterConfig = this.getWaterConfig();

      this.updateTerrainAnimations(elapsedSeconds);
      this.waterLayerManager.updateOceanWaves(elapsedSeconds, waterConfig.ocean);
      this.waterLayerManager.updateLakeSurfaces(elapsedSeconds);
      this.waterLayerManager.updateRiverFlows(elapsedSeconds);

      if (this.enableFrustumCulling && now - this.lastCullingCheck > this.cullingCheckInterval) {
        this.updateFrustumCulling();
        this.updateFoliageLod(activeCamera);
        this.lastCullingCheck = now;
        if (waterConfig.performance.enableFrustumCulling) {
          this.waterLayerManager.applyFrustumCulling(this.cameraViewController.getActiveCamera(), waterConfig);
        }
      } else {
        this.updateFoliageLod(activeCamera);
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

  setFrustumCulling(enabled: boolean): void {
    this.enableFrustumCulling = enabled;
    if (!enabled) {
      restoreChunkVisibility(this.chunkMeshes.values(), this.layerVisibility);
    }
  }

  invalidateTerrainAnimationMaterials(): void {
    this.terrainAnimationMaterialsDirty = true;
  }

  getFrustumCullingStats() {
    return calculateFrustumCullingStats(this.chunkMeshes.values(), this.enableFrustumCulling);
  }

  getFoliageLodStats(): FoliageLodStats {
    return this.foliageLodStats;
  }

  private updateFrustumCulling(): void {
    if (!this.enableFrustumCulling) return;

    const activeCamera = this.cameraViewController.getActiveCamera();
    this.frustumMatrix.multiplyMatrices(activeCamera.projectionMatrix, activeCamera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    updateFrustumCulledChunks(this.chunkMeshes.values(), this.frustum, this.layerVisibility);
  }

  private updateFoliageLod(activeCamera: THREE.Camera): void {
    const chunkCount = this.chunkMeshes.size;
    if (
      chunkCount === this.lastFoliageLodChunkCount &&
      !shouldUpdateFoliageLod(this.lastFoliageLodCameraPosition, activeCamera.position)
    ) {
      return;
    }

    this.foliageLodStats = updateFoliageLodForChunks(
      this.chunkMeshes.values(),
      activeCamera.position,
      this.layerVisibility,
    );
    this.lastFoliageLodCameraPosition = activeCamera.position.clone();
    this.lastFoliageLodChunkCount = chunkCount;
  }

  private updateTerrainAnimations(elapsedSeconds: number): void {
    if (this.terrainAnimationMaterialsDirty) {
      this.rebuildTerrainAnimationMaterials();
    }

    for (const material of this.terrainAnimationMaterials) {
      updateTerrainMaterialAnimation(material, elapsedSeconds);
    }
  }

  private rebuildTerrainAnimationMaterials(): void {
    const seenMaterials = new Set<THREE.Material>();
    this.terrainAnimationMaterials = [];

    for (const chunk of this.chunkMeshes.values()) {
      const materials = Array.isArray(chunk.terrain.material)
        ? chunk.terrain.material
        : [chunk.terrain.material];
      for (const material of materials) {
        if (seenMaterials.has(material)) continue;
        seenMaterials.add(material);
        if (material.userData.terrainShader?.uniforms?.terrainAnimationTime) {
          this.terrainAnimationMaterials.push(material);
        }
      }
    }
    this.terrainAnimationMaterialsDirty = false;
  }
}
