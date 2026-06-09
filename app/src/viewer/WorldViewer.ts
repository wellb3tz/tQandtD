/**
 * WorldViewer - 3D visualization component using Three.js
 * 
 * Manages Three.js scene, rendering, camera controls, and chunk visualization.
 * Renders terrain heightmaps as 3D meshes with biome-based coloring,
 * resources, structures, and chunk boundaries.
 */

import * as THREE from 'three';
import {
  DEFAULT_CAMERA_POSITION_METERS,
  TERRAIN_HEIGHT_SCALE_METERS,
  TERRAIN_TILE_SIZE_METERS,
  type ChunkData,
} from '@engine/index';
import type { ViewerSettings } from '../core/WorldApp';
import { createTerrainSurfaceTextureLibrary } from './materials';
import type { RaycastHit, Vector3 } from '../utils/coordinates';
import { WaterLayerManager } from './water/WaterLayerManager';
import { DEFAULT_WATER_CONFIG } from './water/config';
import type { WaterConfig } from './water/types';
import { createLakeWaterNormalTexture, createRiverWaterNormalTexture, createWaterNormalTexture } from './water/WaterMaterialFactory';
import { AtmosphereController } from './AtmosphereController';
import { RenderLayer } from './RenderLayerVisibility';
import { type RenderStats } from './RenderStatsCalculator';
import { FogOfWarManager } from './FogOfWarManager';
import { CameraInputController, type CameraMovementBounds } from './CameraInputController';
import type { ChunkMesh } from './ChunkMesh';
import { setupWorldScene } from './WorldSceneSetup';
import { CameraViewController } from './CameraViewController';
import { WorldRenderLoop } from './WorldRenderLoop';
import { WorldViewSettings } from './WorldViewSettings';
import { ViewerRenderStatsCache } from './ViewerRenderStatsCache';
import { ViewerTerrainRaycaster } from './ViewerTerrainRaycaster';
import { ViewerCanvasHost } from './ViewerCanvasHost';
import { WorldChunkController } from './WorldChunkController';

export { RenderLayer } from './RenderLayerVisibility';
export type { ChunkCoord, RaycastHit, Vector3 } from '../utils/coordinates';

export const VIEWER_CAMERA_NEAR_METERS = 0.5;
export const VIEWER_CAMERA_FAR_METERS = 10000;
export const DEFAULT_STREAMING_VIEW_DISTANCE_CHUNKS = 3;
export const DEFAULT_STREAMING_CHUNK_SIZE_TILES = 32;
export const TERRAIN_FOG_COLOR = 0xb9d5e6;
export const HORIZON_FILL_PLANE_NAME = 'terrain-horizon-fill';

/**
 * WorldViewer - Manages 3D visualization of the procedural world
 */
export class WorldViewer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cameraInputController: CameraInputController;
  private cameraViewController: CameraViewController;
  private renderLoop: WorldRenderLoop;
  private viewSettings: WorldViewSettings;
  private renderStatsCache: ViewerRenderStatsCache;
  private terrainRaycaster: ViewerTerrainRaycaster;
  private canvasHost: ViewerCanvasHost;
  private chunkController: WorldChunkController;
  
  private atmosphereController: AtmosphereController | null = null;
  private horizonFillPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;

  // Chunk meshes
  private chunkMeshes: Map<string, ChunkMesh>;

  // Fog of war - explored chunks shown as gray planes
  private fogOfWarManager: FogOfWarManager;

  // Container element
  private container: HTMLElement | null;

  private waterLayerManager: WaterLayerManager;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, VIEWER_CAMERA_NEAR_METERS, VIEWER_CAMERA_FAR_METERS);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.canvasHost = new ViewerCanvasHost({
      camera: this.camera,
      renderer: this.renderer,
    });
    this.cameraViewController = new CameraViewController(this.camera, () => this.chunkMeshes.values());
    this.cameraInputController = new CameraInputController({
      camera: this.camera,
      getContainer: () => this.container,
      getActiveCamera: () => this.cameraViewController.getActiveCamera(),
      isOrthographic: () => this.cameraViewController.isOrthographic(),
      getOrthographicCamera: () => this.cameraViewController.getOrthographicCamera(),
      getChunkMeshes: () => this.chunkMeshes.values(),
    });
    
    this.chunkMeshes = new Map();
    this.fogOfWarManager = new FogOfWarManager();
    const terrainTextures = createTerrainSurfaceTextureLibrary();
    this.container = null;
    
    this.waterLayerManager = new WaterLayerManager();
    this.viewSettings = new WorldViewSettings({
      chunkMeshes: this.chunkMeshes,
      waterLayerManager: this.waterLayerManager,
      terrainTextures,
      waterConfig: {
        ...DEFAULT_WATER_CONFIG,
        ocean: {
          ...DEFAULT_WATER_CONFIG.ocean,
          normalMap: createWaterNormalTexture(),
        },
        river: {
          ...DEFAULT_WATER_CONFIG.river,
          normalMap: createRiverWaterNormalTexture(),
        },
        lake: {
          ...DEFAULT_WATER_CONFIG.lake,
          normalMap: createLakeWaterNormalTexture(),
        },
      },
    });
    this.chunkController = new WorldChunkController({
      scene: this.scene,
      chunkMeshes: this.chunkMeshes,
      viewSettings: this.viewSettings,
      waterLayerManager: this.waterLayerManager,
      fogOfWarManager: this.fogOfWarManager,
      onChunksChanged: () => {
        this.invalidateRenderStatsCache();
        this.renderLoop.invalidateTerrainAnimationMaterials();
      },
    });
    this.renderLoop = new WorldRenderLoop({
      scene: this.scene,
      renderer: this.renderer,
      cameraInputController: this.cameraInputController,
      cameraViewController: this.cameraViewController,
      chunkMeshes: this.chunkMeshes,
      layerVisibility: this.viewSettings.getLayerVisibility(),
      waterLayerManager: this.waterLayerManager,
      getWaterConfig: () => this.viewSettings.getWaterConfigReference(),
      beforeRender: activeCamera => {
        this.updateHorizonFill(activeCamera);
        this.atmosphereController?.updateSunAndShadowFocus(activeCamera);
      },
      chunkController: this.chunkController,
    });
    this.renderStatsCache = new ViewerRenderStatsCache(this.chunkMeshes.values());
    this.terrainRaycaster = new ViewerTerrainRaycaster({
      camera: this.camera,
      getCamera: () => this.cameraViewController.getActiveCamera(),
      canvas: this.renderer.domElement,
      getChunks: () => this.chunkMeshes.values(),
      getContainer: () => this.container,
    });

    this.setupScene();
  }

  /**
   * Set up the Three.js scene
   */
  private setupScene(): void {
    this.camera.position.set(
      DEFAULT_CAMERA_POSITION_METERS.x,
      DEFAULT_CAMERA_POSITION_METERS.y,
      DEFAULT_CAMERA_POSITION_METERS.z,
    );
    this.cameraInputController.resetRotation();

    const { atmosphereController } = setupWorldScene(this.scene, this.renderer);
    this.atmosphereController = atmosphereController;
    this.createHorizonFillPlane();
    this.setStreamingViewDistance(DEFAULT_STREAMING_VIEW_DISTANCE_CHUNKS, DEFAULT_STREAMING_CHUNK_SIZE_TILES);
    this.updateSunAndShadowFocus();
  }
  
  /**
   * Initialize the viewer with a container element
   */
  initialize(container: HTMLElement): void {
    this.container = container;
    this.canvasHost.attachToContainer(container);
    this.cameraInputController.attach();
    this.renderLoop.start();
  }
  
  private updateSunAndShadowFocus(): void {
    this.atmosphereController?.updateSunAndShadowFocus(this.cameraViewController.getActiveCamera());
  }
  
  /**
   * Add a chunk to the scene
   */
  addChunk(chunkX: number, chunkY: number, data: ChunkData, partial: boolean = false, stage?: number): void {
    this.chunkController.addChunk(chunkX, chunkY, data, partial, stage);
  }

  /**
   * Flush any pending chunk builds.
   * Useful in tests; in production the render loop calls update() each frame.
   */
  async flushPendingChunkBuilds(): Promise<void> {
    const activeCamera = this.cameraViewController.getActiveCamera();
    this.chunkController.setCameraPosition(activeCamera.position.x, activeCamera.position.z);
    await this.chunkController.flushPendingBuilds();
  }

  /**
   * Remove a chunk from the scene
   */
  removeChunk(chunkX: number, chunkY: number, keepFogOfWar: boolean = false): void {
    this.chunkController.removeChunk(chunkX, chunkY, keepFogOfWar);
  }
  
  /**
   * Remove all currently rendered chunks from the scene.
   * Used when regenerating the world so old-seed terrain cannot remain around
   * the newly generated starting area.
   */
  clearChunks(): void {
    this.chunkController.clearChunks();
  }

  /**
   * Clear all fog of war planes
   */
  clearFogOfWar(): void {
    this.fogOfWarManager.clear(this.scene);
  }
  
  /**
   * Set fog of war visibility
   */
  setFogOfWarVisibility(visible: boolean): void {
    this.fogOfWarManager.setVisible(visible);
  }

  /**
   * Apply a full viewer settings snapshot to the renderer stack.
   */
  applyViewerSettings(settings: ViewerSettings, loadedChunks?: Map<string, ChunkData>): void {
    this.setRenderScale(settings.renderScale);
    this.setVisibility(RenderLayer.TERRAIN, settings.showTerrain);
    this.setVisibility(RenderLayer.FOLIAGE, settings.showFoliage);
    this.setVisibility(RenderLayer.BIOMES, settings.showBiomes);
    this.setVisibility(RenderLayer.TEMPERATURE, settings.showTemperature);
    this.setWaterVisibility(settings.showWater);
    this.setVisibility(RenderLayer.RESOURCES, settings.showResources);
    this.setVisibility(RenderLayer.STRUCTURES, settings.showStructures);
    this.setVisibility(RenderLayer.CHUNK_BOUNDARIES, settings.showChunkBoundaries);
    this.setWireframeMode(settings.showWireframe);
    this.setTerrainTexturesEnabled(settings.terrainTexturesEnabled);
    this.setFogOfWarVisibility(settings.fogOfWarEnabled);
    this.setFoliageLodEnabled(settings.foliageLodEnabled);

    if (settings.waterView) {
      const currentWaterConfig = this.getWaterConfig();
      this.setWaterConfig({
        ...currentWaterConfig,
        ocean: {
          ...currentWaterConfig.ocean,
          ...settings.waterView.ocean,
        },
        lake: {
          ...currentWaterConfig.lake,
          ...settings.waterView.lake,
        },
        river: {
          ...currentWaterConfig.river,
          ...settings.waterView.river,
        },
      });

      if (loadedChunks) {
        this.refreshLoadedChunks(loadedChunks);
      }
    }

    if (settings.sky && this.atmosphereController) {
      this.atmosphereController.setSkyParams(settings.sky);
    }
  }

  /**
   * Match camera clipping and atmospheric fade to the active chunk streaming radius.
   */
  setStreamingViewDistance(viewDistanceChunks: number, chunkSizeTiles: number = DEFAULT_STREAMING_CHUNK_SIZE_TILES): void {
    const safeViewDistance = Math.max(1, viewDistanceChunks);
    const safeChunkSizeTiles = Math.max(1, chunkSizeTiles);
    const chunkWorldSizeMeters = safeChunkSizeTiles * TERRAIN_TILE_SIZE_METERS;
    const visibleRadiusMeters = safeViewDistance * chunkWorldSizeMeters;

    const fadeStart = clamp(visibleRadiusMeters * 0.45, 650, 4200);
    const fadeEnd = clamp((safeViewDistance + 0.65) * chunkWorldSizeMeters, fadeStart + 450, VIEWER_CAMERA_FAR_METERS * 0.85);
    const cameraFar = clamp(fadeEnd * 1.08, 1000, VIEWER_CAMERA_FAR_METERS);

    this.camera.far = cameraFar;
    this.camera.updateProjectionMatrix();

    const orthographicCamera = this.cameraViewController.getOrthographicCamera();
    if (orthographicCamera) {
      orthographicCamera.far = cameraFar;
      orthographicCamera.updateProjectionMatrix();
    }

    this.atmosphereController?.setTerrainFog({
      color: TERRAIN_FOG_COLOR,
      near: fadeStart * 0.82,
      far: fadeEnd * 1.14,
    });

    this.resizeHorizonFillPlane(cameraFar * 2.4);
  }

  /**
   * Update an existing chunk
   */
  updateChunk(chunkX: number, chunkY: number, data: ChunkData): void {
    this.chunkController.updateChunk(chunkX, chunkY, data);
  }

  /**
   * Re-apply chunk rendering with the current view settings.
   */
  refreshLoadedChunks(loadedChunks: Map<string, ChunkData>): void {
    for (const [key, chunkData] of loadedChunks) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      this.updateChunk(chunkX, chunkY, chunkData);
    }
  }

  /**
   * Set visibility of a render layer
   */
  setVisibility(layer: RenderLayer, visible: boolean): void {
    this.viewSettings.setVisibility(layer, visible);
  }
  
  /**
   * Toggle water layer visibility
   */
  setWaterVisibility(visible: boolean): void {
    this.viewSettings.setWaterVisibility(visible);
  }

  /**
   * Configure water system
   */
  setWaterConfig(config: Partial<WaterConfig>): void {
    this.viewSettings.setWaterConfig(config);
  }
  
  /**
   * Get current water configuration
   */
  getWaterConfig(): WaterConfig {
    return this.viewSettings.getWaterConfig();
  }

  /**
   * Set wireframe mode
   */
  setWireframeMode(enabled: boolean): void {
    this.viewSettings.setWireframeMode(enabled);
  }

  /**
   * Enable or disable biome terrain texture maps while keeping vertex biome colors.
   */
  setTerrainTexturesEnabled(enabled: boolean): void {
    this.viewSettings.setTerrainTexturesEnabled(enabled);
  }

  areTerrainTexturesEnabled(): boolean {
    return this.viewSettings.areTerrainTexturesEnabled();
  }

  /**
   * Enable or disable distance-based foliage LOD.
   */
  setFoliageLodEnabled(enabled: boolean): void {
    this.viewSettings.setFoliageLodEnabled(enabled);
  }

  /**
   * Set camera position
   */
  setCameraPosition(position: Vector3): void {
    this.cameraViewController.setCameraPosition(position);
  }

  setMovementBounds(bounds: CameraMovementBounds | null): void {
    this.cameraInputController.setMovementBounds(bounds);
  }

  /**
   * Set camera target
   */
  setCameraTarget(target: Vector3): void {
    this.cameraViewController.setCameraTarget(target);
  }

  setRenderScale(scale: number): void {
    const safeScale = clamp(scale, 0.5, 1);
    this.canvasHost.setPixelRatio((window.devicePixelRatio || 1) * safeScale);
  }

  /**
   * Reset camera to default position
   */
  resetCamera(): void {
    this.cameraViewController.resetCamera();
    this.cameraInputController.resetRotation();
  }
  
  /**
   * Set orthographic (top-down) view mode
   */
  setOrthographicView(enabled: boolean): void {
    this.cameraViewController.setOrthographicView(enabled);
  }
  
  /**
   * Set follow terrain mode
   */
  setFollowTerrainMode(enabled: boolean): void {
    this.cameraViewController.setFollowTerrainMode(enabled);
  }

  /**
   * Set first-person walking mode
   */
  setFirstPersonMode(enabled: boolean): void {
    this.cameraInputController.setFirstPersonMode(enabled);
    if (enabled) {
      this.cameraViewController.setFollowTerrainMode(false);
      this.cameraViewController.setOrthographicView(false);
      this.cameraInputController.lockPointer();
    } else {
      this.cameraInputController.unlockPointer();
    }
  }

  /**
   * Check if first-person mode is active
   */
  isFirstPersonMode(): boolean {
    return this.cameraInputController.isFirstPersonMode();
  }

  /**
   * Get current camera position.
   * In orthographic mode returns the orthographic camera's XZ position
   * so chunk loading stays in sync with what's actually visible.
   */
  getCameraPosition(): Vector3 {
    return this.cameraViewController.getCameraPosition();
  }

  /**
   * Get camera heading angle in degrees (0 = North, 90 = East, 180 = South, 270 = West).
   * Derived from the camera's yaw rotation.
   */
  getCameraHeading(): number {
    return this.cameraInputController.getHeadingDegrees();
  }

  /**
   * Get current camera target
   */
  getCameraTarget(): Vector3 {
    return this.cameraViewController.getCameraTarget();
  }

  /**
   * Resize the viewer
   */
  resize(width: number, height: number): void {
    this.canvasHost.resize(width, height);
  }

  /**
   * Raycast from screen coordinates to terrain
   * Returns hit information including world position and chunk coordinates
   */
  raycastTerrain(screenX: number, screenY: number): RaycastHit | null {
    return this.terrainRaycaster.raycast(screenX, screenY);
  }

  /**
   * Get the active terrain chunk meshes.
   */
  getChunkMeshes(): IterableIterator<ChunkMesh> {
    return this.chunkMeshes.values();
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * Get the camera
   */
  getCamera(): THREE.Camera {
    return this.camera;
  }

  /**
   * Get the scene for custom rendering integrations.
   */
  getScene(): THREE.Scene {
    return this.scene;
  }
  
  /**
   * Enable or disable frustum culling
   */
  setFrustumCulling(enabled: boolean): void {
    this.renderLoop.setFrustumCulling(enabled);
  }
  
  /**
   * Get frustum culling statistics
   */
  getFrustumCullingStats() {
    return this.renderLoop.getFrustumCullingStats();
  }

  /**
   * Get render statistics (vertex count, draw calls).
   */
  getRenderStats(): RenderStats {
    return this.renderStatsCache.getRenderStats();
  }

  private invalidateRenderStatsCache(): void {
    this.renderStatsCache.invalidate();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.renderLoop.stop();
    
    this.chunkController.clearChunks();
    
    // Dispose water layer manager
    this.waterLayerManager.dispose();

    if (this.horizonFillPlane) {
      this.scene.remove(this.horizonFillPlane);
      this.horizonFillPlane.geometry.dispose();
      this.horizonFillPlane.material.dispose();
      this.horizonFillPlane = null;
    }

    this.atmosphereController?.dispose();
    this.atmosphereController = null;

    // Dispose renderer
    this.renderer.dispose();
    
    this.cameraInputController.detach();

    this.canvasHost.detachFromContainer(this.container);
  }

  private createHorizonFillPlane(): void {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: TERRAIN_FOG_COLOR,
      depthTest: true,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    this.horizonFillPlane = new THREE.Mesh(geometry, material);
    this.horizonFillPlane.name = HORIZON_FILL_PLANE_NAME;
    this.horizonFillPlane.rotation.x = -Math.PI / 2;
    this.horizonFillPlane.renderOrder = -100;
    this.scene.add(this.horizonFillPlane);
  }

  private resizeHorizonFillPlane(sizeMeters: number): void {
    if (!this.horizonFillPlane) return;
    this.horizonFillPlane.scale.set(sizeMeters, sizeMeters, 1);
  }

  private updateHorizonFill(activeCamera: THREE.Camera): void {
    if (!this.horizonFillPlane) return;
    this.horizonFillPlane.visible = true;

    const waterConfig = this.viewSettings.getWaterConfigReference();
    const seaLevelMeters = waterConfig.seaLevel * TERRAIN_HEIGHT_SCALE_METERS;
    this.horizonFillPlane.position.set(
      activeCamera.position.x,
      seaLevelMeters - 2,
      activeCamera.position.z,
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
