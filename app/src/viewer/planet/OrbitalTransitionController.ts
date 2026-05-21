import * as THREE from 'three';
import type { PlanetRenderer } from './PlanetRenderer';
import type { SpaceViewManager } from './SpaceViewManager';
import type { CameraViewController } from '../CameraViewController';
import type { CameraInputController } from '../CameraInputController';
import type { WorldChunkController } from '../WorldChunkController';
import type { AtmosphereController } from '../AtmosphereController';
import type { WaterLayerManager } from '../water/WaterLayerManager';

export enum OrbitalState {
  TERRAIN = 'terrain',
  TRANSITION_TO_ORBIT = 'transition_to_orbit',
  ORBIT = 'orbit',
  TRANSITION_TO_SURFACE = 'transition_to_surface',
}

export interface OrbitalTransitionControllerOptions {
  cameraViewController: CameraViewController;
  cameraInputController: CameraInputController;
  planetRenderer: PlanetRenderer;
  spaceViewManager: SpaceViewManager;
  chunkController: WorldChunkController;
  atmosphereController: AtmosphereController | null;
  waterLayerManager: WaterLayerManager;
  getChunkMeshes: () => Iterable<{ terrain: THREE.Mesh }>;
  onTransitionComplete?: (state: OrbitalState) => void;
  onPlanetClicked?: (lat: number, lon: number) => void;
  canvas: HTMLCanvasElement;
}

const ORBIT_AUTO_THRESHOLD = 380;
const TRANSITION_DURATION = 1200;
const PLANET_RADIUS = 150;
const ORBIT_CAMERA_DISTANCE = 600;

/** Phase split for the transition timeline (0..1) */
const CHUNK_FADE_END = 0.42; // chunks fully invisible by 42%
const SPACE_FADE_START = 0.36; // space appears after terrain overlays are gone
const SPACE_FADE_END = 0.62;
const PLANET_FADE_START = 0.5; // planet starts after the scene has gone to space
const PLANET_FADE_END = 0.92;  // planet fully visible near the end

/**
 * Finite state machine controlling seamless transitions between
 * terrain view and orbital planet view.
 */
export class OrbitalTransitionController {
  private state: OrbitalState = OrbitalState.TERRAIN;
  private cameraViewController: CameraViewController;
  private cameraInputController: CameraInputController;
  private planetRenderer: PlanetRenderer;
  private spaceViewManager: SpaceViewManager;
  private chunkController: WorldChunkController;
  private atmosphereController: AtmosphereController | null;
  private waterLayerManager: WaterLayerManager;
  private getChunkMeshes: () => Iterable<{ terrain: THREE.Mesh }>;
  private onTransitionComplete?: (state: OrbitalState) => void;
  private onPlanetClicked?: (lat: number, lon: number) => void;
  private canvas: HTMLCanvasElement;

  private transitionStartTime = 0;
  private startCameraPos = new THREE.Vector3();
  private startCameraQuaternion = new THREE.Quaternion();
  private targetCameraPos = new THREE.Vector3();
  private targetCameraQuaternion = new THREE.Quaternion();
  private chunkOpacity = 1.0;
  private orbitAngles = { azimuth: 0, polar: Math.PI / 4 };
  private orbitDistance = ORBIT_CAMERA_DISTANCE;
  private spaceEntered = false;
  private chunkOverlaysSuppressed = false;

  constructor(options: OrbitalTransitionControllerOptions) {
    this.cameraViewController = options.cameraViewController;
    this.cameraInputController = options.cameraInputController;
    this.planetRenderer = options.planetRenderer;
    this.spaceViewManager = options.spaceViewManager;
    this.chunkController = options.chunkController;
    this.atmosphereController = options.atmosphereController;
    this.waterLayerManager = options.waterLayerManager;
    this.getChunkMeshes = options.getChunkMeshes;
    this.onTransitionComplete = options.onTransitionComplete;
    this.onPlanetClicked = options.onPlanetClicked;
    this.canvas = options.canvas;
  }

  getState(): OrbitalState {
    return this.state;
  }

  isOrbital(): boolean {
    return this.state === OrbitalState.ORBIT || this.state === OrbitalState.TRANSITION_TO_ORBIT;
  }

  isTransitioning(): boolean {
    return this.state === OrbitalState.TRANSITION_TO_ORBIT || this.state === OrbitalState.TRANSITION_TO_SURFACE;
  }

  /**
   * Call every frame from the render loop.
   */
  update(deltaTime: number): void {
    const camera = this.cameraViewController.getActiveCamera() as THREE.PerspectiveCamera;
    const pos = camera.position;

    // Auto-trigger orbit when camera is high enough
    if (this.state === OrbitalState.TERRAIN && pos.y > ORBIT_AUTO_THRESHOLD) {
      this.startTransitionToOrbit();
    }

    switch (this.state) {
      case OrbitalState.TRANSITION_TO_ORBIT:
        this.updateTransitionToOrbit();
        break;
      case OrbitalState.ORBIT:
        this.updateOrbitMode(deltaTime);
        break;
      case OrbitalState.TRANSITION_TO_SURFACE:
        this.updateTransitionToSurface();
        break;
      case OrbitalState.TERRAIN:
        // nothing
        break;
    }
  }

  /**
   * Handle a click on the canvas. In orbit mode, raycast against planet.
   */
  handleClick(screenX: number, screenY: number): void {
    if (this.state !== OrbitalState.ORBIT) return;

    const camera = this.cameraViewController.getActiveCamera();
    const hit = this.planetRenderer.raycast(screenX, screenY, camera, this.canvas);
    if (hit && this.onPlanetClicked) {
      this.onPlanetClicked(hit.lat, hit.lon);
    }
  }

  /**
   * Manually begin transition to orbit (used if auto-threshold is bypassed).
   */
  startTransitionToOrbit(): void {
    if (this.state !== OrbitalState.TERRAIN) return;

    this.state = OrbitalState.TRANSITION_TO_ORBIT;
    this.transitionStartTime = performance.now();

    // Force-release pointer lock so the cursor is visible in orbit mode
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    const camera = this.cameraViewController.getActiveCamera() as THREE.PerspectiveCamera;
    this.startCameraPos.copy(camera.position);
    this.startCameraQuaternion.copy(camera.quaternion);

    // Target: above the planet looking down
    this.targetCameraPos.set(0, ORBIT_CAMERA_DISTANCE, 0);
    this.targetCameraQuaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0, 'YXZ'));

    // Initialize orbit angles from current look direction
    this.orbitDistance = ORBIT_CAMERA_DISTANCE;
    this.orbitAngles = { azimuth: 0, polar: Math.PI / 6 };
    this.spaceEntered = false;
    this.chunkOverlaysSuppressed = true;

    this.setChunkOverlayVisibility(false);
    this.waterLayerManager.setVisible(false);
    this.spaceViewManager.setStarOpacity(0);
    if (!this.planetRenderer.isInitialized()) {
      this.planetRenderer.initialize();
    }
    this.planetRenderer.show();
    this.planetRenderer.setOpacity(0);

    // Disable terrain-specific systems
    this.cameraInputController.setOrbitMode(true);
  }

  /**
   * Begin transition from orbit down to a specific point on the planet surface.
   */
  startTransitionToSurface(lat: number, lon: number): void {
    if (this.state !== OrbitalState.ORBIT) return;

    this.state = OrbitalState.TRANSITION_TO_SURFACE;
    this.transitionStartTime = performance.now();

    const camera = this.cameraViewController.getActiveCamera() as THREE.PerspectiveCamera;
    this.startCameraPos.copy(camera.position);
    this.startCameraQuaternion.copy(camera.quaternion);

    // Target position: above the clicked point, looking down
    const r = PLANET_RADIUS + 100;
    const tx = r * Math.cos(lat) * Math.cos(lon);
    const ty = r * Math.sin(lat);
    const tz = r * Math.cos(lat) * Math.sin(lon);
    this.targetCameraPos.set(tx, ty, tz);

    // Look roughly toward the planet center
    const lookAt = new THREE.Vector3(0, 0, 0);
    const m = new THREE.Matrix4().lookAt(this.targetCameraPos, lookAt, new THREE.Vector3(0, 1, 0));
    this.targetCameraQuaternion.setFromRotationMatrix(m);

  }

  private updateTransitionToOrbit(): void {
    const elapsed = performance.now() - this.transitionStartTime;
    const t = Math.min(elapsed / TRANSITION_DURATION, 1);
    const ease = this.easeInOutCubic(t);

    const camera = this.cameraViewController.getActiveCamera() as THREE.PerspectiveCamera;

    // Interpolate camera position
    camera.position.lerpVectors(this.startCameraPos, this.targetCameraPos, ease);
    camera.quaternion.slerpQuaternions(this.startCameraQuaternion, this.targetCameraQuaternion, ease);

    // Chunks fade out aggressively in the first 35% of the transition
    const chunkFadeT = Math.min(t / CHUNK_FADE_END, 1);
    this.chunkOpacity = 1 - this.easeInOutCubic(chunkFadeT);
    this.applyChunkOpacity(this.chunkOpacity);

    // Shrink chunks slightly as we pull away so they feel like a receding surface
    const chunkScale = 1 - this.easeInOutCubic(chunkFadeT) * 0.5;
    this.applyChunkScale(chunkScale);

    if (!this.spaceEntered && t >= SPACE_FADE_START) {
      this.spaceViewManager.enterSpace();
      this.atmosphereController?.setSpaceMode(true);
      this.spaceEntered = true;
    }

    if (this.spaceEntered) {
      const spaceT = Math.min((t - SPACE_FADE_START) / (SPACE_FADE_END - SPACE_FADE_START), 1);
      this.spaceViewManager.setStarOpacity(this.easeInOutCubic(spaceT));
    }

    // Planet fades in after the scene has already moved into space.
    let planetOpacity = 0;
    if (t > PLANET_FADE_START) {
      const planetT = Math.min(
        (t - PLANET_FADE_START) / (PLANET_FADE_END - PLANET_FADE_START),
        1
      );
      planetOpacity = this.easeInOutCubic(planetT);
    }
    this.planetRenderer.setOpacity(planetOpacity);

    if (t >= 1) {
      this.state = OrbitalState.ORBIT;
      this.chunkOpacity = 0;
      this.applyChunkOpacity(0);
      this.applyChunkScale(1);
      this.spaceViewManager.setStarOpacity(1);
      this.onTransitionComplete?.(OrbitalState.ORBIT);
    }
  }

  private updateOrbitMode(deltaTime: number): void {
    // Update camera based on orbit angles
    const camera = this.cameraViewController.getActiveCamera() as THREE.PerspectiveCamera;

    // Orbit position calculation
    const x = this.orbitDistance * Math.sin(this.orbitAngles.polar) * Math.cos(this.orbitAngles.azimuth);
    const y = this.orbitDistance * Math.cos(this.orbitAngles.polar);
    const z = this.orbitDistance * Math.sin(this.orbitAngles.polar) * Math.sin(this.orbitAngles.azimuth);

    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);

    this.hideLateChunksInOrbit();

    // Update atmosphere fresnel
    this.planetRenderer.updateAtmosphere(camera);
  }

  private updateTransitionToSurface(): void {
    const elapsed = performance.now() - this.transitionStartTime;
    const t = Math.min(elapsed / TRANSITION_DURATION, 1);
    const ease = this.easeInOutCubic(t);

    const camera = this.cameraViewController.getActiveCamera() as THREE.PerspectiveCamera;

    camera.position.lerpVectors(this.startCameraPos, this.targetCameraPos, ease);
    camera.quaternion.slerpQuaternions(this.startCameraQuaternion, this.targetCameraQuaternion, ease);

    const spaceOpacity = Math.max(0, 1 - this.easeInOutCubic(Math.min(t / 0.55, 1)));
    this.spaceViewManager.setStarOpacity(spaceOpacity);

    // Keep the surface visible through the dive so the return feels like an
    // actual approach. Only the atmosphere fades early to avoid a blue flash.
    const atmosphereFadeT = Math.min(t / 0.28, 1);
    const surfaceFadeT = Math.max(0, Math.min((t - 0.76) / 0.2, 1));
    const surfaceOpacity = 1 - this.easeInOutCubic(surfaceFadeT);
    const atmosphereOpacity = 1 - this.easeInOutCubic(atmosphereFadeT);
    this.planetRenderer.setTransitionOpacity(surfaceOpacity, atmosphereOpacity);
    this.planetRenderer.setScale(1 + ease * 2.05); // planet grows as we dive in

    if (t >= 1) {
      this.finishTransitionToTerrain();
    }
  }

  private finishTransitionToTerrain(): void {
    this.state = OrbitalState.TERRAIN;
    this.planetRenderer.hide();
    this.planetRenderer.setScale(1);
    this.spaceViewManager.exitSpace();
    this.cameraInputController.setOrbitMode(false);
    this.atmosphereController?.setSpaceMode(false);

    // Restore chunks
    this.chunkOpacity = 1;
    this.chunkOverlaysSuppressed = false;
    this.applyChunkOpacity(1);
    this.applyChunkScale(1);

    // Ensure camera is above terrain, not underground
    const camera = this.cameraViewController.getActiveCamera() as THREE.PerspectiveCamera;
    if (camera.position.y < 50) {
      camera.position.y = 100;
    }

    this.onTransitionComplete?.(OrbitalState.TERRAIN);
  }

  /**
   * Process orbit input: drag rotates the view, scroll zooms.
   */
  processOrbitInput(deltaX: number, deltaY: number, scrollDelta: number): void {
    if (this.state !== OrbitalState.ORBIT) return;

    const sensitivity = 0.005;
    this.orbitAngles.azimuth -= deltaX * sensitivity;
    this.orbitAngles.polar += deltaY * sensitivity;
    this.orbitAngles.polar = Math.max(0.1, Math.min(Math.PI - 0.1, this.orbitAngles.polar));

    if (scrollDelta !== 0) {
      this.orbitDistance += scrollDelta * 20;
      this.orbitDistance = Math.max(PLANET_RADIUS * 1.5, Math.min(1200, this.orbitDistance));
    }
  }

  private applyChunkOpacity(opacity: number): void {
    for (const chunk of this.getChunkMeshes()) {
      const mat = chunk.terrain.material as THREE.Material;
      if (Array.isArray(mat)) {
        for (const m of mat) {
          m.transparent = opacity < 1.0;
          (m as THREE.MeshStandardMaterial).opacity = opacity;
        }
      } else {
        mat.transparent = opacity < 1.0;
        (mat as THREE.MeshStandardMaterial).opacity = opacity;
      }
      chunk.terrain.visible = opacity > 0.01;

      const showOverlays = opacity > 0.01 && !this.chunkOverlaysSuppressed;
      const c = chunk as any;
      if (c.foliage) {
        (c.foliage as THREE.Object3D).visible = showOverlays;
      }
      if (c.resources) {
        (c.resources as THREE.Object3D).visible = showOverlays;
      }
      if (c.structures) {
        (c.structures as THREE.Object3D).visible = showOverlays;
      }
      if (c.boundaries) {
        (c.boundaries as THREE.Object3D).visible = showOverlays;
      }
    }

    // Also hide water, fog of war, etc during orbit
    if (opacity < 0.01) {
      this.waterLayerManager.setVisible(false);
    } else {
      this.waterLayerManager.setVisible(true);
    }
  }

  private applyChunkScale(scale: number): void {
    for (const chunk of this.getChunkMeshes()) {
      chunk.terrain.scale.setScalar(scale);
      const c = chunk as any;
      if (c.foliage) {
        (c.foliage as THREE.Object3D).scale.setScalar(scale);
      }
      if (c.resources) {
        (c.resources as THREE.Object3D).scale.setScalar(scale);
      }
      if (c.structures) {
        (c.structures as THREE.Object3D).scale.setScalar(scale);
      }
      if (c.boundaries) {
        (c.boundaries as THREE.Object3D).scale.setScalar(scale);
      }
      if (c.water && c.water.group) {
        c.water.group.scale.setScalar(scale);
      }
    }
  }

  private setChunkOverlayVisibility(visible: boolean): void {
    for (const chunk of this.getChunkMeshes()) {
      const c = chunk as any;
      if (c.foliage) {
        (c.foliage as THREE.Object3D).visible = visible;
      }
      if (c.resources) {
        (c.resources as THREE.Object3D).visible = visible;
      }
      if (c.structures) {
        (c.structures as THREE.Object3D).visible = visible;
      }
      if (c.boundaries) {
        (c.boundaries as THREE.Object3D).visible = visible;
      }
    }
  }

  private hideLateChunksInOrbit(): void {
    for (const chunk of this.getChunkMeshes()) {
      const c = chunk as any;
      if (chunk.terrain.visible) {
        chunk.terrain.visible = false;
      }
      if (c.foliage?.visible) {
        (c.foliage as THREE.Object3D).visible = false;
      }
      if (c.resources?.visible) {
        (c.resources as THREE.Object3D).visible = false;
      }
      if (c.structures?.visible) {
        (c.structures as THREE.Object3D).visible = false;
      }
      if (c.boundaries?.visible) {
        (c.boundaries as THREE.Object3D).visible = false;
      }
      if (c.water?.group?.visible) {
        (c.water.group as THREE.Object3D).visible = false;
      }
    }
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
