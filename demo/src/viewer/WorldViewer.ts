/**
 * WorldViewer - 3D visualization component using Three.js
 * 
 * Manages Three.js scene, rendering, camera controls, and chunk visualization.
 * Renders terrain heightmaps as 3D meshes with biome-based coloring,
 * resources, structures, and chunk boundaries.
 */

import * as THREE from 'three';
import { ChunkData } from '../../../src/index';
import {
  getBiomeColor,
  calculateBlendedColor,
  createTerrainMaterial,
  toGrayscale,
  BiomeColor
} from './materials';
import { raycastTerrain } from '../utils/coordinates';
import { WaterLayerManager } from './water/WaterLayerManager';
import { adjustUnderwaterColors } from './water/UnderwaterTerrainProcessor';
import { DEFAULT_WATER_CONFIG } from './water/config';
import type { WaterConfig } from './water/types';
import { MicroBiomeType } from '../../../src/world/enhanced-biome';

/**
 * Colour offsets per MicroBiomeType (applied additively, clamped to [0,1])
 * Note: GROVE uses 0.20 (not 0.15) to meet the 0.2 contrast requirement from Property 8
 */
const MICRO_BIOME_TINT: Record<number, { r: number; g: number; b: number }> = {
  [MicroBiomeType.OASIS]: { r: 0.0, g: 0.25, b: 0.0 },     // Greener
  [MicroBiomeType.CLEARING]: { r: 0.0, g: 0.20, b: 0.0 },  // Lighter green
  [MicroBiomeType.POND]: { r: 0.0, g: 0.0, b: 0.30 },      // Bluer
  [MicroBiomeType.GROVE]: { r: 0.20, g: 0.20, b: 0.0 },    // Warmer (corrected to 0.20)
};

/**
 * 3D vector for camera position and target
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Render layers that can be toggled
 */
export enum RenderLayer {
  TERRAIN = 'terrain',
  BIOMES = 'biomes',
  RESOURCES = 'resources',
  STRUCTURES = 'structures',
  CHUNK_BOUNDARIES = 'chunkBoundaries'
}

/**
 * Raycast hit result
 */
export interface RaycastHit {
  point: Vector3;
  chunkX: number;
  chunkY: number;
  localX: number;
  localY: number;
  height: number;
}

/**
 * Chunk coordinate
 */
export interface ChunkCoord {
  chunkX: number;
  chunkY: number;
}

/**
 * Chunk mesh data
 */
interface ChunkMesh {
  terrain: THREE.Mesh;
  water?: import('./water/types').WaterLayerData; // New: separate water layer
  resources?: THREE.Group;
  structures?: THREE.Group;
  boundaries?: THREE.LineSegments;
  boundingBox?: THREE.Box3; // For frustum culling
  visible?: boolean; // Frustum culling visibility state
}

/**
 * WorldViewer - Manages 3D visualization of the procedural world
 */
export class WorldViewer {
  private static readonly KEYBOARD_CODE_MAP: Record<string, string> = {
    'KeyW': 'w',
    'KeyA': 'a',
    'KeyS': 's',
    'KeyD': 'd',
    'Space': 'space',
    'ShiftLeft': 'shift',
    'ShiftRight': 'shift',
  };

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  
  // Lighting
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  
  // Chunk meshes
  private chunkMeshes: Map<string, ChunkMesh>;
  
  // Fog of war - explored chunks shown as gray planes
  private fogOfWarMeshes: Map<string, THREE.Mesh>;
  
  // Layer visibility
  private layerVisibility: Map<RenderLayer, boolean>;
  
  // Wireframe mode
  private wireframeMode: boolean;
  
  // Container element
  private container: HTMLElement | null;
  
  // Animation frame ID
  private animationFrameId: number | null;
  
  // Free camera controls (FPS-style)
  private useFreeCamera: boolean;
  private cameraRotation: { pitch: number; yaw: number };
  private cameraVelocity: THREE.Vector3;
  private keyboardState: Map<string, boolean>;
  private keyboardMoveSpeed: number;
  private mouseSensitivity: number;
  private isPointerLocked: boolean;
  
  // Camera modes
  private followTerrainMode: boolean;
  private followTerrainHeight: number;
  private orthographicCamera: THREE.OrthographicCamera | null;
  private isOrthographic: boolean;
  private cameraTarget: THREE.Vector3; // Track target even in free camera mode
  
  // Performance optimizations
  private frustum: THREE.Frustum;
  private frustumMatrix: THREE.Matrix4;
  private enableFrustumCulling: boolean;
  private cullingCheckInterval: number;
  private lastCullingCheck: number;
  
  // Water system
  private waterLayerManager: WaterLayerManager;
  private waterConfig: WaterConfig;

  // Background ocean plane (hidden when sky background mode is active)
  private bgOceanMesh: THREE.Mesh | null = null;

  // Micro-biome tracking
  private microBiomeCount: number;

  private readonly handleContainerClick = (): void => {
    if (this.useFreeCamera && !this.isPointerLocked) {
      this.container?.requestPointerLock();
    }
  };

  private readonly handlePointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.container;
  };

  private readonly handlePointerLockedMouseMove = (e: MouseEvent): void => {
    if (this.isPointerLocked && this.useFreeCamera) {
      this.cameraRotation.yaw -= e.movementX * this.mouseSensitivity;
      this.cameraRotation.pitch -= e.movementY * this.mouseSensitivity;
      this.updateCameraRotation();
    }
  };

  private readonly handlePointerLockEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isPointerLocked) {
      document.exitPointerLock();
    }
  };

  private readonly handleKeyboardDown = (e: KeyboardEvent): void => {
    const key = WorldViewer.KEYBOARD_CODE_MAP[e.code];
    if (key) {
      this.keyboardState.set(key, true);
      e.preventDefault();
    }
  };

  private readonly handleKeyboardUp = (e: KeyboardEvent): void => {
    const key = WorldViewer.KEYBOARD_CODE_MAP[e.code];
    if (key) {
      this.keyboardState.set(key, false);
      e.preventDefault();
    }
  };

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    
    this.chunkMeshes = new Map();
    this.fogOfWarMeshes = new Map();
    this.layerVisibility = new Map();
    this.wireframeMode = false;
    this.container = null;
    this.animationFrameId = null;
    
    // Initialize free camera controls (FPS-style)
    this.useFreeCamera = true; // Default to free camera
    this.cameraRotation = { pitch: 0, yaw: 0 };
    this.cameraVelocity = new THREE.Vector3();
    this.keyboardState = new Map();
    this.keyboardMoveSpeed = 0.5; // Units per frame
    this.mouseSensitivity = 0.002;
    this.isPointerLocked = false;
    
    // Initialize camera modes
    this.followTerrainMode = false;
    this.followTerrainHeight = 50;
    this.orthographicCamera = null;
    this.isOrthographic = false;
    this.cameraTarget = new THREE.Vector3(0, 0, 0); // Default target at origin
    
    // Initialize performance optimizations
    this.frustum = new THREE.Frustum();
    this.frustumMatrix = new THREE.Matrix4();
    this.enableFrustumCulling = true;
    this.cullingCheckInterval = 16; // Check every 16ms (every frame at 60 FPS)
    this.lastCullingCheck = 0;
    
    // Initialize micro-biome tracking
    this.microBiomeCount = 0;
    // Initialize water system
    this.waterLayerManager = new WaterLayerManager();
    this.waterConfig = DEFAULT_WATER_CONFIG;
    
    // Initialize layer visibility (all visible by default)
    Object.values(RenderLayer).forEach(layer => {
      this.layerVisibility.set(layer, true);
    });
    
    // Create lighting — actual setup happens in setupScene()
    // Initialize with placeholders; setupScene() will replace them
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);

    this.setupScene();
  }

  /**
   * Set up the Three.js scene
   */
  private setupScene(): void {
    // Background starts in sky mode (matches default skyBackground: true in AppState).
    // setBackgroundMode(false) switches to dark ocean mode.
    this.scene.background = new THREE.Color(0x87ceeb);
    // No fog by default — enabled only in dark ocean mode via setBackgroundMode()

    // Atmospheric exponential fog — adds depth and distance haze
    // (disabled — produces blue haze rather than realistic fog)
    // this.scene.fog = new THREE.FogExp2(0x9ab8d4, 0.0035);

    // Position camera for free camera mode
    this.camera.position.set(50, 100, 50);
    this.cameraRotation.yaw = 0;
    this.cameraRotation.pitch = -0.3; // Look slightly down
    this.updateCameraRotation();

    // Configure renderer — tone mapping for cinematic look
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85; // Slightly underexposed = richer, less washed out

    // Large background ocean plane — covers the infinite horizon beyond loaded chunks.
    // Positioned at sea level (seaLevel * heightScale = 0.3 * 50 = 15).
    // Size 20 000 units ensures it fills the view at any reasonable camera distance.
    const bgOceanGeo = new THREE.PlaneGeometry(20000, 20000);
    bgOceanGeo.rotateX(-Math.PI / 2);
    const bgOceanMat = new THREE.MeshPhongMaterial({
      color: 0x0a1a3a,
      transparent: false,   // opaque — no blending conflicts with chunk water meshes
      shininess: 40,
      specular: new THREE.Color(0x112233),
    });
    const bgOceanMesh = new THREE.Mesh(bgOceanGeo, bgOceanMat);
    // Place well below the lowest possible ocean floor (near Y=0) so the
    // opaque terrain mesh always occludes it — only visible beyond loaded chunks.
    bgOceanMesh.position.set(0, -200, 0);
    bgOceanMesh.renderOrder = 0;
    bgOceanMesh.renderOrder = 0;
    bgOceanMesh.visible = false; // hidden by default (sky mode is default)
    this.scene.add(bgOceanMesh);
    this.bgOceanMesh = bgOceanMesh;

    // Soft ambient — cool overcast sky, low intensity so shadows read clearly
    this.ambientLight = new THREE.AmbientLight(0xc8ddf0, 0.45);
    this.scene.add(this.ambientLight);

    // Main sun — warm but not harsh, lower angle for longer shadows
    this.directionalLight = new THREE.DirectionalLight(0xfff0d0, 1.0);
    this.directionalLight.position.set(80, 120, 60);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.camera.left   = -200;
    this.directionalLight.shadow.camera.right  =  200;
    this.directionalLight.shadow.camera.top    =  200;
    this.directionalLight.shadow.camera.bottom = -200;
    this.directionalLight.shadow.mapSize.width  = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.bias = -0.0005;
    this.scene.add(this.directionalLight);

    // Subtle fill light — very dim, just lifts the darkest shadows slightly
    const fillLight = new THREE.DirectionalLight(0xb0c8e8, 0.15);
    fillLight.position.set(-60, 40, -40);
    this.scene.add(fillLight);
  }
  
  /**
   * Update camera rotation based on pitch and yaw
   */
  private updateCameraRotation(): void {
    // Clamp pitch to prevent camera flipping
    this.cameraRotation.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.cameraRotation.pitch));
    
    // Create rotation quaternion from yaw and pitch
    const euler = new THREE.Euler(this.cameraRotation.pitch, this.cameraRotation.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  /**
   * Initialize the viewer with a container element
   */
  initialize(container: HTMLElement): void {
    this.container = container;
    
    // Set initial size
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Append canvas to container
    container.appendChild(this.renderer.domElement);
    
    // Set up keyboard controls
    this.setupKeyboardControls();
    
    // Set up mouse controls for free camera
    this.setupMouseControls();
    
    // Start render loop
    this.startRenderLoop();
    
    console.log('WorldViewer initialized with free camera mode');
  }
  
  /**
   * Set up mouse controls for free camera (FPS-style)
   */
  private setupMouseControls(): void {
    if (!this.container) return;
    
    // Click to lock pointer
    this.container.addEventListener('click', this.handleContainerClick);
    
    // Handle pointer lock change
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    
    // Handle mouse movement when pointer is locked
    document.addEventListener('mousemove', this.handlePointerLockedMouseMove);
    
    // Exit pointer lock on Escape
    document.addEventListener('keydown', this.handlePointerLockEscape);
  }
  
  /**
   * Set up keyboard event listeners for WASD camera movement
   */
  private setupKeyboardControls(): void {
    // Use e.code (physical key) instead of e.key so layout doesn't matter.
    // KeyW = W regardless of whether keyboard is in Russian, English, etc.
    window.addEventListener('keydown', this.handleKeyboardDown);
    window.addEventListener('keyup', this.handleKeyboardUp);
  }
  
  /**
   * Start the render loop
   */
  private startRenderLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      
      // Update free camera movement
      if (this.useFreeCamera) {
        this.updateFreeCameraMovement();
      }
      
      // Update follow terrain mode
      if (this.followTerrainMode) {
        this.updateFollowTerrainMode();
      }
      
      // Perform frustum culling check periodically
      const now = performance.now();
      if (this.enableFrustumCulling && now - this.lastCullingCheck > this.cullingCheckInterval) {
        this.updateFrustumCulling();
        this.lastCullingCheck = now;
        
        // Apply water-specific optimizations
        const activeCamera = this.isOrthographic && this.orthographicCamera ? this.orthographicCamera : this.camera;
        
        // Apply frustum culling to water meshes
        if (this.waterConfig.performance.enableFrustumCulling) {
          this.waterLayerManager.applyFrustumCulling(activeCamera, this.waterConfig);
        }
      }
      
      // Render scene
      const activeCamera = this.isOrthographic && this.orthographicCamera ? this.orthographicCamera : this.camera;
      this.renderer.render(this.scene, activeCamera);
    };
    
    animate();
  }
  
  /**
   * Update free camera movement based on keyboard input (FPS-style)
   * Also supports orthographic camera movement in top-down view
   */
  private updateFreeCameraMovement(): void {
    let moveSpeed = this.keyboardMoveSpeed;
    
    // Apply speed boost when Shift is held
    if (this.keyboardState.get('shift')) {
      moveSpeed *= 3; // 3x speed when holding Shift
    }
    
    // Use orthographic camera if in top-down mode, otherwise use perspective camera
    const activeCamera = this.isOrthographic && this.orthographicCamera ? this.orthographicCamera : this.camera;
    
    // Calculate movement direction
    const movement = new THREE.Vector3();
    
    if (this.isOrthographic) {
      // In top-down view, use simple horizontal movement
      // W/S = forward/backward (Z axis), A/D = left/right (X axis)
      if (this.keyboardState.get('w')) {
        movement.z -= 1; // Move forward (negative Z)
      }
      if (this.keyboardState.get('s')) {
        movement.z += 1; // Move backward (positive Z)
      }
      if (this.keyboardState.get('a')) {
        movement.x -= 1; // Move left (negative X)
      }
      if (this.keyboardState.get('d')) {
        movement.x += 1; // Move right (positive X)
      }
      // Space = zoom in (move camera down = closer), Shift = zoom out
      if (this.orthographicCamera) {
        const cam = this.orthographicCamera;
        const zoomSpeed = moveSpeed * 2;
        if (this.keyboardState.get('space')) {
          // Zoom in: shrink frustum
          const scale = 1 - 0.02;
          cam.left   *= scale;
          cam.right  *= scale;
          cam.top    *= scale;
          cam.bottom *= scale;
          cam.updateProjectionMatrix();
        }
        if (this.keyboardState.get('shift')) {
          // Zoom out: expand frustum
          const scale = 1 + 0.02;
          cam.left   *= scale;
          cam.right  *= scale;
          cam.top    *= scale;
          cam.bottom *= scale;
          cam.updateProjectionMatrix();
        }
      }
    } else {
      // Free camera mode - use camera direction
      const forward = new THREE.Vector3();
      const right = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      
      // Use perspective camera for free camera mode (orthographic doesn't have getWorldDirection)
      this.camera.getWorldDirection(forward);
      right.crossVectors(forward, up).normalize();
      
      if (this.keyboardState.get('w')) {
        movement.add(forward);
      }
      if (this.keyboardState.get('s')) {
        movement.sub(forward);
      }
      if (this.keyboardState.get('a')) {
        movement.sub(right);
      }
      if (this.keyboardState.get('d')) {
        movement.add(right);
      }
      
      // Add vertical movement with Space (only in free camera mode)
      if (this.keyboardState.get('space')) {
        movement.add(up);
      }
    }
    
    // Normalize and apply speed
    if (movement.length() > 0) {
      movement.normalize().multiplyScalar(moveSpeed);
      activeCamera.position.add(movement);
    }
  }

  /**
   * Add a chunk to the scene
   */
  addChunk(chunkX: number, chunkY: number, data: ChunkData, partial: boolean = false, stage?: number): void {
    const key = this.getChunkKey(chunkX, chunkY);
    
    // Skip if heightmap is not yet generated (early stage of incremental generation)
    if (!data.heightmap) {
      console.log(`Skipping chunk (${chunkX}, ${chunkY}) - heightmap not yet generated`);
      return;
    }
    
    // Remove fog of war plane if it exists (chunk is being reloaded)
    this.removeFogOfWarPlane(chunkX, chunkY);
    
    // Remove existing chunk if present
    if (this.chunkMeshes.has(key)) {
      this.removeChunk(chunkX, chunkY, false); // Don't create fog of war when replacing
    }
    
    const chunkMesh: ChunkMesh = {
      terrain: this.createTerrainMesh(chunkX, chunkY, data, partial, stage),
      visible: true
    };
    
    // Compute bounding box for frustum culling
    chunkMesh.terrain.geometry.computeBoundingBox();
    chunkMesh.boundingBox = chunkMesh.terrain.geometry.boundingBox!.clone();
    chunkMesh.boundingBox.applyMatrix4(chunkMesh.terrain.matrixWorld);
    
    // Add terrain to scene
    this.scene.add(chunkMesh.terrain);
    
    // Generate and add water layer
    if (this.waterConfig.enabled && data.heightmap) {
      const chunkKey = this.getChunkKey(chunkX, chunkY);
      this.waterLayerManager.addWaterToChunk(chunkKey, data, this.scene, this.waterConfig);
      
      // Store water layer reference in ChunkMesh
      const waterLayer = this.waterLayerManager.getWaterLayer(chunkKey);
      if (waterLayer) {
        chunkMesh.water = waterLayer;
        // Ensure water renders above terrain
        waterLayer.group.renderOrder = 1;
      }
    }
    
    // Only add complete layers if not partial or if stage is complete
    // Resources: always render when available
    if (!partial || (stage !== undefined && stage >= 2)) {
      if (data.resources && data.resources.length > 0) {
        chunkMesh.resources = this.createResourceMarkers(chunkX, chunkY, data);
        chunkMesh.resources.visible = this.layerVisibility.get(RenderLayer.RESOURCES) !== false;
        this.scene.add(chunkMesh.resources);
      }
    }
    
    // Structures: render when available
    if (!partial || (stage !== undefined && stage >= 3)) {
      if (data.structures && data.structures.length > 0) {
        chunkMesh.structures = this.createStructureMarkers(chunkX, chunkY, data);
        chunkMesh.structures.visible = this.layerVisibility.get(RenderLayer.STRUCTURES) !== false;
        this.scene.add(chunkMesh.structures);
      }
    }
    
    // Always create chunk boundaries, but respect visibility setting
    chunkMesh.boundaries = this.createChunkBoundaries(chunkX, chunkY, data);
    chunkMesh.boundaries.visible = this.layerVisibility.get(RenderLayer.CHUNK_BOUNDARIES) !== false;
    this.scene.add(chunkMesh.boundaries);
    
    this.chunkMeshes.set(key, chunkMesh);
    
    // Инвалидируем кэш статистики рендеринга
    this.invalidateRenderStatsCache();

    // Stitch only lake-touching terrain positions. A full-edge position stitch
    // can create trenches, but lake boundary vertices still need exact agreement
    // to hide cracks where carved basins cross chunk borders.
    this.stitchLakeBoundaryPositions(chunkX, chunkY);
    this.stitchBoundaryNormals(chunkX, chunkY);
    this.stitchBoundaryColors(chunkX, chunkY);
    for (const [dx, dz] of [[-1,0],[0,-1],[-1,-1],[1,0],[0,1],[1,1],[-1,1],[1,-1]]) {
      const nKey = this.getChunkKey(chunkX + dx, chunkY + dz);
      if (this.chunkMeshes.has(nKey)) {
        this.stitchLakeBoundaryPositions(chunkX + dx, chunkY + dz);
        this.stitchBoundaryNormals(chunkX + dx, chunkY + dz);
        this.stitchBoundaryColors(chunkX + dx, chunkY + dz);
        this.waterLayerManager.stitchWaterBoundaryHeights(key, nKey, data.size);
      }
    }
  }

  /**
   * Remove a chunk from the scene
   */
  removeChunk(chunkX: number, chunkY: number, keepFogOfWar: boolean = false): void {
    const key = this.getChunkKey(chunkX, chunkY);
    const chunkMesh = this.chunkMeshes.get(key);
    
    if (!chunkMesh) return;
    
    // Create fog of war plane before removing the chunk
    if (keepFogOfWar) {
      this.createFogOfWarPlane(chunkX, chunkY, chunkMesh.terrain);
    }
    
    // Remove water layer first
    if (chunkMesh.water) {
      this.waterLayerManager.removeWaterFromChunk(key, this.scene);
    }
    
    // Remove all mesh components from scene
    this.scene.remove(chunkMesh.terrain);
    chunkMesh.terrain.geometry.dispose();
    if (Array.isArray(chunkMesh.terrain.material)) {
      chunkMesh.terrain.material.forEach(m => m.dispose());
    } else {
      chunkMesh.terrain.material.dispose();
    }
    
    if (chunkMesh.resources) {
      this.scene.remove(chunkMesh.resources);
      this.disposeGroup(chunkMesh.resources);
    }
    
    if (chunkMesh.structures) {
      this.scene.remove(chunkMesh.structures);
      this.disposeGroup(chunkMesh.structures);
    }
    
    if (chunkMesh.boundaries) {
      this.scene.remove(chunkMesh.boundaries);
      chunkMesh.boundaries.geometry.dispose();
      if (Array.isArray(chunkMesh.boundaries.material)) {
        chunkMesh.boundaries.material.forEach(m => m.dispose());
      } else {
        chunkMesh.boundaries.material.dispose();
      }
    }
    
    this.chunkMeshes.delete(key);
    
    // Инвалидируем кэш статистики рендеринга
    this.invalidateRenderStatsCache();
  }
  
  /**
   * Remove all currently rendered chunks from the scene.
   * Used when regenerating the world so old-seed terrain cannot remain around
   * the newly generated starting area.
   */
  clearChunks(): void {
    const keys = Array.from(this.chunkMeshes.keys());
    for (const key of keys) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      this.removeChunk(chunkX, chunkY, false);
    }

    this.invalidateRenderStatsCache();
  }

  /**
   * Create a fog of war plane for an explored chunk
   */
  private createFogOfWarPlane(chunkX: number, chunkY: number, originalTerrain: THREE.Mesh): void {
    const key = this.getChunkKey(chunkX, chunkY);
    
    // Remove existing fog of war mesh if present
    this.removeFogOfWarPlane(chunkX, chunkY);
    
    // Get chunk size from original terrain
    const geometry = originalTerrain.geometry as THREE.BufferGeometry;
    const positions = geometry.getAttribute('position');
    
    // Calculate average height for the plane
    let avgHeight = 0;
    let count = 0;
    for (let i = 0; i < positions.count; i++) {
      avgHeight += positions.getY(i);
      count++;
    }
    avgHeight = count > 0 ? avgHeight / count : 0;
    
    // Create simplified plane geometry
    const chunkSize = Math.sqrt(positions.count) - 1;
    const planeGeometry = new THREE.PlaneGeometry(chunkSize, chunkSize, 1, 1);
    
    // Rotate to match terrain orientation (XZ plane)
    planeGeometry.rotateX(-Math.PI / 2);
    
    // Create gray material with transparency
    const material = new THREE.MeshBasicMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    const plane = new THREE.Mesh(planeGeometry, material);
    
    // Position at chunk location with average height
    plane.position.set(
      chunkX * chunkSize + chunkSize / 2,
      avgHeight,
      chunkY * chunkSize + chunkSize / 2
    );
    
    // Add to scene and track
    this.scene.add(plane);
    this.fogOfWarMeshes.set(key, plane);
  }
  
  /**
   * Remove fog of war plane for a chunk
   */
  private removeFogOfWarPlane(chunkX: number, chunkY: number): void {
    const key = this.getChunkKey(chunkX, chunkY);
    const plane = this.fogOfWarMeshes.get(key);
    
    if (plane) {
      this.scene.remove(plane);
      plane.geometry.dispose();
      if (Array.isArray(plane.material)) {
        plane.material.forEach(m => m.dispose());
      } else {
        plane.material.dispose();
      }
      this.fogOfWarMeshes.delete(key);
    }
  }
  
  /**
   * Clear all fog of war planes
   */
  clearFogOfWar(): void {
    for (const [key, plane] of this.fogOfWarMeshes.entries()) {
      this.scene.remove(plane);
      plane.geometry.dispose();
      if (Array.isArray(plane.material)) {
        plane.material.forEach(m => m.dispose());
      } else {
        plane.material.dispose();
      }
    }
    this.fogOfWarMeshes.clear();
  }
  
  /**
   * Set fog of war visibility
   */
  setFogOfWarVisibility(visible: boolean): void {
    for (const plane of this.fogOfWarMeshes.values()) {
      plane.visible = visible;
    }
  }

  /**
   * Update an existing chunk
   */
  updateChunk(chunkX: number, chunkY: number, data: ChunkData): void {
    const key = this.getChunkKey(chunkX, chunkY);
    
    // Update water layer if it exists
    if (this.waterConfig.enabled && data.heightmap) {
      this.waterLayerManager.updateWaterMeshes(key, data, this.scene, this.waterConfig);
    }
    
    // Simply remove and re-add terrain and other layers
    this.removeChunk(chunkX, chunkY);
    this.addChunk(chunkX, chunkY, data);
  }

  /**
   * Create terrain mesh from heightmap data with smooth biome color blending
   * Optionally applies partial generation visualization (opacity/color based on stage)
   * 
   * Optimized for performance with large chunk counts:
   * - Uses typed arrays for better memory efficiency
   * - Pre-allocates arrays to avoid resizing
   * - Uses indexed geometry to reduce vertex count
   */
  private createTerrainMesh(chunkX: number, chunkY: number, data: ChunkData, partial: boolean = false, stage?: number): THREE.Mesh {
    const chunkSize = data.size;
    
    // Count micro-biomes in this chunk
    let chunkMicroBiomeCount = 0;
    if (data.microBiomeMap) {
      for (let i = 0; i < data.microBiomeMap.length; i++) {
        if (data.microBiomeMap[i] !== 255) {
          chunkMicroBiomeCount++;
        }
      }
    }
    
    // VALIDATION: Check if heightmap has the correct size
    const expectedHeightmapSize = (chunkSize + 1) * (chunkSize + 1);
    if (data.heightmap.length !== expectedHeightmapSize) {
      console.error(
        `Heightmap size mismatch! Expected ${expectedHeightmapSize} (${chunkSize + 1}x${chunkSize + 1}), ` +
        `got ${data.heightmap.length}. Chunk: (${chunkX}, ${chunkY})`
      );
      
      // Create fallback heightmap with the correct size
      const fallbackHeightmap = new Float32Array(expectedHeightmapSize);
      // Copy available data
      const copySize = Math.min(data.heightmap.length, expectedHeightmapSize);
      for (let i = 0; i < copySize; i++) {
        fallbackHeightmap[i] = data.heightmap[i];
      }
      data = { ...data, heightmap: fallbackHeightmap };
    }
    
    const geometry = new THREE.BufferGeometry();
    
    // For seamless boundaries, we need (chunkSize + 1) vertices per side
    // This allows the last vertex of one chunk to overlap with the first vertex of the next
    const verticesPerSide = chunkSize + 1;
    const vertexCount = verticesPerSide * verticesPerSide;
    const triangleCount = chunkSize * chunkSize * 2;
    const indexCount = triangleCount * 3;
    
    // Pre-allocate typed arrays for better performance
    const vertices = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(indexCount);
    
    // Determine if we have biome weights for smooth blending
    const hasBlendWeights = data.sparseBiomeWeights && data.sparseBiomeWeights.length > 0;
    
    // Apply underwater color adjustments if heightmap and biome data available
    let underwaterColors: (BiomeColor | null)[] | null = null;
    if (data.heightmap && hasBlendWeights) {
      // For underwater colors, we need to convert sparse weights to a format the function can use
      // We'll pass the chunk data directly and let the function handle sparse access
      underwaterColors = adjustUnderwaterColors(
        data.heightmap,
        data, // Pass full chunk data for sparse weight access
        chunkSize,
        {
          seaLevel: this.waterConfig.seaLevel,
          darkenFactor: this.waterConfig.rendering.underwaterDarkenFactor,
          desaturationFactor: this.waterConfig.rendering.underwaterDesaturationFactor,
          enableDepthGradient: this.waterConfig.rendering.enableDepthGradient,
        }
      );
    }
    
    // Partial generation visualization
    let partialTint = { r: 1.0, g: 1.0, b: 1.0 };
    let partialOpacity = 1.0;
    
    if (partial && stage !== undefined) {
      if (stage === 0) { // TERRAIN only
        partialTint = { r: 0.6, g: 0.6, b: 0.6 };
        partialOpacity = 0.5;
      } else if (stage === 1) { // BIOMES
        partialTint = { r: 0.8, g: 0.8, b: 0.8 };
        partialOpacity = 0.7;
      } else if (stage < 4) { // RESOURCES/STRUCTURES
        partialOpacity = 0.9;
      }
    }
    
    // Generate vertices and colors (optimized loop)
    const worldXBase = chunkX * chunkSize;
    const worldZBase = chunkY * chunkSize;
    const heightScale = 50;
    
    for (let y = 0; y <= chunkSize; y++) {
      const worldZ = worldZBase + y;
      const rowOffset = y * verticesPerSide;
      
      for (let x = 0; x <= chunkSize; x++) {
        const index = rowOffset + x;
        const vertexIndex = index * 3;
        
        // The heightmap is (chunkSize + 1) x (chunkSize + 1) for seamless boundaries
        // Access it directly with the current x, y coordinates
        const height = data.heightmap ? data.heightmap[index] : 0;
        const worldX = worldXBase + x;
        
        // Set vertex position
        vertices[vertexIndex] = worldX;
        vertices[vertexIndex + 1] = height * heightScale;
        vertices[vertexIndex + 2] = worldZ;
        
        // Calculate color with smooth blending if weights available
        // For biome map, clamp to chunkSize x chunkSize since biomes don't have overlap
        const bmX = Math.min(x, chunkSize - 1);
        const bmY = Math.min(y, chunkSize - 1);
        const bmIndex = bmY * chunkSize + bmX;
        
        let color: BiomeColor;
        
        // Use pre-calculated underwater colors if available (null = use original biome color)
        if (underwaterColors && bmIndex < underwaterColors.length && underwaterColors[bmIndex] !== null) {
          color = underwaterColors[bmIndex]!;
        } else if (hasBlendWeights && data.biomeMap) {
          // Calculate blended color from sparse biome weights
          color = this.calculateBlendedColorFromSparse(data, bmIndex);
        } else if (data.biomeMap) {
          const biome = data.biomeMap[bmIndex];
          color = getBiomeColor(biome);
        } else {
          color = { r: 0.5, g: 0.5, b: 0.5 };
        }
        
        // Apply micro-biome tint if present
        if (data.microBiomeMap && bmIndex < data.microBiomeMap.length) {
          const microBiome = data.microBiomeMap[bmIndex];
          if (microBiome !== 255 && MICRO_BIOME_TINT[microBiome]) {
            const tint = MICRO_BIOME_TINT[microBiome];
            color = {
              r: Math.min(1.0, color.r + tint.r),
              g: Math.min(1.0, color.g + tint.g),
              b: Math.min(1.0, color.b + tint.b),
            };
          }
        }
        
        // Apply tints
        colors[vertexIndex] = color.r * partialTint.r;
        colors[vertexIndex + 1] = color.g * partialTint.g;
        colors[vertexIndex + 2] = color.b * partialTint.b;
      }
    }
    
    // Generate indices for triangles (optimized loop)
    let indexOffset = 0;
    for (let y = 0; y < chunkSize; y++) {
      const rowStart = y * verticesPerSide;
      const nextRowStart = (y + 1) * verticesPerSide;
      
      for (let x = 0; x < chunkSize; x++) {
        const topLeft = rowStart + x;
        const topRight = topLeft + 1;
        const bottomLeft = nextRowStart + x;
        const bottomRight = bottomLeft + 1;
        
        // First triangle
        indices[indexOffset++] = topLeft;
        indices[indexOffset++] = bottomLeft;
        indices[indexOffset++] = topRight;
        
        // Second triangle
        indices[indexOffset++] = topRight;
        indices[indexOffset++] = bottomLeft;
        indices[indexOffset++] = bottomRight;
      }
    }
    
    // Set geometry attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    // --- Slope-based and altitude color modulation ---
    // After normals are computed, read them to darken steep slopes (rock effect)
    // and modulate brightness by elevation.
    const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

    // Rock color (gray stone) blended onto steep slopes
    const ROCK_R = 0.38, ROCK_G = 0.36, ROCK_B = 0.34;
    // Snow color — only on MOUNTAIN/GLACIER biomes, not volcanic
    const SNOW_R = 0.92, SNOW_G = 0.93, SNOW_B = 0.95;
    // Volcanic lava glow — blended onto steep slopes of volcanic peaks
    const LAVA_R = 0.72, LAVA_G = 0.12, LAVA_B = 0.04;

    for (let i = 0; i < normals.count; i++) {
      const ny = normals.getY(i); // Y component of normal: 1 = flat, 0 = vertical
      const vi = i * 3;
      const rawHeight = vertices[vi + 1] / heightScale; // back to [0,1]

      // Biome at this vertex (clamped to biome map bounds)
      const bvX = Math.min(Math.round(vertices[vi]     - worldXBase), chunkSize - 1);
      const bvY = Math.min(Math.round(vertices[vi + 2] - worldZBase), chunkSize - 1);
      const bmIdx = Math.max(0, bvY) * chunkSize + Math.max(0, bvX);
      const vertexBiome = data.biomeMap ? data.biomeMap[Math.min(bmIdx, data.biomeMap.length - 1)] : -1;

      // Slope factor: 0 = flat, 1 = vertical cliff
      const slopeFactor = Math.max(0, 1.0 - ny * ny);
      const steepness = Math.pow(slopeFactor, 1.5);

      // Subtle altitude brightness: valleys very slightly darker, peaks slightly brighter
      // Reduced range to avoid washing out high terrain
      const altitudeBrightness = 0.92 + rawHeight * 0.12;

      let r = colorAttr.getX(i);
      let g = colorAttr.getY(i);
      let b = colorAttr.getZ(i);

      const isVolcanic = vertexBiome === 11; // BiomeType.VOLCANIC = 11
      const isMountain = vertexBiome === 7;  // BiomeType.MOUNTAIN = 7
      const isGlacier  = vertexBiome === 12; // BiomeType.GLACIER  = 12
      const isBeach    = vertexBiome === 1;  // BiomeType.BEACH    = 1
      const isOcean    = vertexBiome === 0;  // BiomeType.OCEAN    = 0

      if (isOcean) {
        // Ocean floor: no slope-shading, just altitude brightness
        // (underwater terrain stays its biome color)
      } else if (isBeach) {
        // Beach / coastal: steep slopes become wet dark sand / rocky shore,
        // NOT gray mountain rock. This eliminates the gray cliff look.
        const WET_SAND_R = 0.55, WET_SAND_G = 0.48, WET_SAND_B = 0.32;
        const CLIFF_R = 0.46, CLIFF_G = 0.42, CLIFF_B = 0.36; // dark coastal rock
        if (steepness > 0.5) {
          // Very steep coastal cliff — dark rock
          const cliffFactor = (steepness - 0.5) / 0.5;
          r = r + (CLIFF_R - r) * cliffFactor;
          g = g + (CLIFF_G - g) * cliffFactor;
          b = b + (CLIFF_B - b) * cliffFactor;
        } else if (steepness > 0.15) {
          // Moderate slope — wet sand
          const wetFactor = (steepness - 0.15) / 0.35;
          r = r + (WET_SAND_R - r) * wetFactor;
          g = g + (WET_SAND_G - g) * wetFactor;
          b = b + (WET_SAND_B - b) * wetFactor;
        }
        // Flat beach stays pure sand color
      } else if (isVolcanic) {        // Volcanic: steep slopes get lava-glow tint, flat areas stay dark rock
        r = r + (ROCK_R - r) * steepness * 0.6;
        g = g + (ROCK_G - g) * steepness * 0.6;
        b = b + (ROCK_B - b) * steepness * 0.6;
        // Add lava glow on very steep volcanic slopes
        const lavaFactor = Math.pow(steepness, 2.5) * 0.5;
        if (lavaFactor > 0) {
          r = r + (LAVA_R - r) * lavaFactor;
          g = g + (LAVA_G - g) * lavaFactor;
          b = b + (LAVA_B - b) * lavaFactor;
        }
      } else {
        // Non-volcanic: steep slopes become rocky gray
        r = r + (ROCK_R - r) * steepness;
        g = g + (ROCK_G - g) * steepness;
        b = b + (ROCK_B - b) * steepness;

        // Snow on mountain/glacier peaks — height-based, only on flat/gentle slopes
        if ((isMountain || isGlacier) && rawHeight > 0.76) {
          const snowFactor = Math.min(1.0, (rawHeight - 0.76) / 0.10) * (1.0 - steepness * 0.7);
          if (snowFactor > 0) {
            r = r + (SNOW_R - r) * snowFactor;
            g = g + (SNOW_G - g) * snowFactor;
            b = b + (SNOW_B - b) * snowFactor;
          }
        }
      }

      // Apply altitude brightness modulation
      r = Math.min(1.0, r * altitudeBrightness);
      g = Math.min(1.0, g * altitudeBrightness);
      b = Math.min(1.0, b * altitudeBrightness);

      colorAttr.setXYZ(i, r, g, b);
    }
    colorAttr.needsUpdate = true;
    // --- end slope/altitude modulation ---
    
    // Create material using materials module
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      wireframe: this.wireframeMode,
      roughness: 0.85,
      metalness: 0.0,
    });
    
    // Apply opacity for partial chunks
    if (partial && partialOpacity < 1.0) {
      material.transparent = true;
      material.opacity = partialOpacity;
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    
    // Store partial status and micro-biome count in mesh userData for reference
    if (partial) {
      mesh.userData.partial = true;
      mesh.userData.stage = stage;
    }
    mesh.userData.microBiomeCount = chunkMicroBiomeCount;
    mesh.userData.chunkData = data; // Store chunk data for re-rendering
    
    return mesh;
  }

  /**
   * Create resource markers
   */
  private createResourceMarkers(chunkX: number, chunkY: number, data: ChunkData): THREE.Group {
    const group = new THREE.Group();
    const chunkSize = data.size;
    
    // Check if resources exist
    if (!data.resources || data.resources.length === 0) {
      return group;
    }
    
    for (const resource of data.resources) {
      const height = data.heightmap[resource.y * chunkSize + resource.x];
      const worldX = chunkX * chunkSize + resource.x;
      const worldZ = chunkY * chunkSize + resource.y;
      
      const geometry = new THREE.SphereGeometry(0.5, 8, 8);
      const material = new THREE.MeshBasicMaterial({ color: this.getResourceColor(resource.type) });
      const marker = new THREE.Mesh(geometry, material);
      
      marker.position.set(worldX, height * 50 + 1, worldZ);
      group.add(marker);
    }
    
    return group;
  }

  /**
   * Create structure markers
   */
  private createStructureMarkers(chunkX: number, chunkY: number, data: ChunkData): THREE.Group {
    const group = new THREE.Group();
    const chunkSize = data.size;
    
    // Check if structures exist
    if (!data.structures || data.structures.length === 0) {
      return group;
    }
    
    for (const structure of data.structures) {
      const height = data.heightmap[structure.y * chunkSize + structure.x];
      const worldX = chunkX * chunkSize + structure.x;
      const worldZ = chunkY * chunkSize + structure.y;
      
      // Convert type to number if needed
      const typeNum = typeof structure.type === 'string' ? parseInt(structure.type, 10) : structure.type;
      
      // Create different geometry based on structure type
      let geometry: THREE.BufferGeometry;
      let markerHeight: number;
      
      switch (typeNum) {
        case 0: // VILLAGE - Multiple small boxes (houses)
          geometry = new THREE.BoxGeometry(3, 2, 3);
          markerHeight = 1;
          break;
        case 1: // RUINS - Broken/irregular shape (cylinder)
          geometry = new THREE.CylinderGeometry(1.5, 1.5, 2.5, 8);
          markerHeight = 1.25;
          break;
        case 2: // TOWER - Tall thin structure
          geometry = new THREE.BoxGeometry(1.5, 5, 1.5);
          markerHeight = 2.5;
          break;
        default:
          geometry = new THREE.BoxGeometry(2, 3, 2);
          markerHeight = 1.5;
      }
      
      const material = new THREE.MeshLambertMaterial({ color: this.getStructureColor(typeNum) });
      const marker = new THREE.Mesh(geometry, material);
      
      marker.position.set(worldX, height * 50 + markerHeight, worldZ);
      group.add(marker);
    }
    
    return group;
  }

  /**
   * Create chunk boundary visualization
   * Only draws top and left edges to avoid doubling with adjacent chunks
   */
  private createChunkBoundaries(chunkX: number, chunkY: number, data: ChunkData): THREE.LineSegments {
    const chunkSize = data.size;
    const vertices: number[] = [];
    
    // Get corner heights
    const topLeft = data.heightmap[0];
    const topRight = data.heightmap[chunkSize];
    const bottomLeft = data.heightmap[chunkSize * chunkSize];
    
    const worldX = chunkX * chunkSize;
    const worldZ = chunkY * chunkSize;
    
    // Only draw top and left edges to avoid doubling
    // Top edge (left to right)
    vertices.push(
      worldX, topLeft * 50, worldZ,
      worldX + chunkSize, topRight * 50, worldZ
    );
    
    // Left edge (top to bottom)
    vertices.push(
      worldX, topLeft * 50, worldZ,
      worldX, bottomLeft * 50, worldZ + chunkSize
    );
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    
    const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    
    return new THREE.LineSegments(geometry, material);
  }

  /**
   * Get resource color
   */
  private getResourceColor(type: string | number): number {
    const typeStr = typeof type === 'number' ? String(type) : type;
    const colors: { [key: string]: number } = {
      'iron': 0xc0c0c0,
      'gold': 0xffd700,
      'coal': 0x000000,
      'stone': 0x808080,
      'wood': 0x8b4513
    };
    
    return colors[typeStr] || 0xff00ff;
  }

  /**
   * Get structure color
   */
  private getStructureColor(type: string | number): number {
    // Convert to number if string
    const typeNum = typeof type === 'string' ? parseInt(type, 10) : type;
    
    // Map structure types to colors
    // 0 = VILLAGE (brown), 1 = RUINS (gray), 2 = TOWER (gold)
    const colors: { [key: number]: number } = {
      0: 0x8b4513,  // VILLAGE - Brown (saddle brown)
      1: 0x708090,  // RUINS - Gray (slate gray)
      2: 0xdaa520   // TOWER - Gold
    };
    
    return colors[typeNum] ?? 0xff00ff; // Magenta fallback for unknown types
  }

  /**
   * Set visibility of a render layer
   */
  setVisibility(layer: RenderLayer, visible: boolean): void {
    this.layerVisibility.set(layer, visible);
    
    // Update all chunks
    for (const [key, chunkMesh] of this.chunkMeshes.entries()) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      
      switch (layer) {
        case RenderLayer.TERRAIN:
          chunkMesh.terrain.visible = visible;
          break;
        case RenderLayer.BIOMES:
          // Toggle between biome colors and grayscale
          this.updateTerrainBiomeColors(chunkMesh.terrain, visible);
          break;
        case RenderLayer.RESOURCES:
          if (chunkMesh.resources) chunkMesh.resources.visible = visible;
          break;
        case RenderLayer.STRUCTURES:
          if (chunkMesh.structures) chunkMesh.structures.visible = visible;
          break;
        case RenderLayer.CHUNK_BOUNDARIES:
          if (chunkMesh.boundaries) chunkMesh.boundaries.visible = visible;
          break;
      }
    }
  }
  
  /**
   * Toggle water layer visibility
   */
  setWaterVisibility(visible: boolean): void {
    this.waterLayerManager.toggleWaterVisibility(visible);
  }

  /**
   * Switch between sky (light blue) and ocean (dark navy) background modes.
   * @param skyMode - true = bright sky #87ceeb, false = deep ocean #0a1a3a
   */
  setBackgroundMode(skyMode: boolean): void {
    const bgColor = skyMode ? 0x87ceeb : 0x0a1a3a;
    this.scene.background = new THREE.Color(bgColor);
    // Fog colour always matches background for seamless horizon
    this.scene.fog = new THREE.FogExp2(bgColor, skyMode ? 0.0012 : 0.0018);
    if (this.bgOceanMesh) {
      this.bgOceanMesh.visible = !skyMode;
    }
  }

  /**
   * Configure water system
   */
  setWaterConfig(config: Partial<WaterConfig>): void {
    this.waterConfig = { ...this.waterConfig, ...config };
  }
  
  /**
   * Get current water configuration
   */
  getWaterConfig(): WaterConfig {
    return { ...this.waterConfig };
  }

  /**
   * Update terrain mesh to show/hide biome colors
   */
  private updateTerrainBiomeColors(mesh: THREE.Mesh, showBiomes: boolean): void {
    const geometry = mesh.geometry;
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
    
    if (!colors) return;
    
    const colorArray = colors.array as Float32Array;
    
    if (showBiomes) {
      // Restore original biome colors (stored in userData)
      if (mesh.userData.originalColors) {
        for (let i = 0; i < colorArray.length; i++) {
          colorArray[i] = mesh.userData.originalColors[i];
        }
      }
    } else {
      // Store original colors if not already stored
      if (!mesh.userData.originalColors) {
        mesh.userData.originalColors = new Float32Array(colorArray);
      }
      
      // Convert to grayscale using materials module
      for (let i = 0; i < colorArray.length; i += 3) {
        const color: BiomeColor = {
          r: colorArray[i],
          g: colorArray[i + 1],
          b: colorArray[i + 2]
        };
        
        const gray = toGrayscale(color);
        
        colorArray[i] = gray.r;
        colorArray[i + 1] = gray.g;
        colorArray[i + 2] = gray.b;
      }
    }
    
    colors.needsUpdate = true;
  }

  /**
   * Set wireframe mode
   */
  setWireframeMode(enabled: boolean): void {
    this.wireframeMode = enabled;
    
    // Update all terrain meshes
    for (const chunkMesh of this.chunkMeshes.values()) {
      const material = chunkMesh.terrain.material as THREE.MeshLambertMaterial;
      material.wireframe = enabled;
    }
  }

  /**
   * Set camera position
   */
  setCameraPosition(position: Vector3): void {
    this.camera.position.set(position.x, position.y, position.z);
  }

  /**
   * Set camera target
   */
  setCameraTarget(target: Vector3): void {
    // Update internal target
    this.cameraTarget.set(target.x, target.y, target.z);
  }

  /**
   * Reset camera to default position
   */
  resetCamera(): void {
    // Switch back to perspective if in orthographic mode
    if (this.isOrthographic) {
      this.setOrthographicView(false);
    }
    
    // Disable follow terrain mode
    this.followTerrainMode = false;
    
    // Reset camera position
    this.camera.position.set(50, 100, 50);
    
    // Reset camera rotation for free camera mode
    if (this.useFreeCamera) {
      this.cameraRotation.yaw = 0;
      this.cameraRotation.pitch = -0.3; // Look slightly down
      this.updateCameraRotation();
    }
    
    // Reset internal target
    this.cameraTarget.set(0, 0, 0);
  }
  
  /**
   * Set orthographic (top-down) view mode
   */
  setOrthographicView(enabled: boolean): void {
    if (enabled === this.isOrthographic) return;
    
    this.isOrthographic = enabled;
    
    if (enabled) {
      // Create orthographic camera if it doesn't exist
      if (!this.orthographicCamera) {
        const aspect = this.camera.aspect;
        const frustumSize = 100;
        this.orthographicCamera = new THREE.OrthographicCamera(
          -frustumSize * aspect / 2,
          frustumSize * aspect / 2,
          frustumSize / 2,
          -frustumSize / 2,
          0.1,
          2000
        );
      }
      
      // Position orthographic camera above current perspective camera position
      const px = this.camera.position.x;
      const pz = this.camera.position.z;
      this.orthographicCamera.position.set(px, 200, pz);
      this.orthographicCamera.lookAt(px, 0, pz);
    }
  }
  
  /**
   * Set follow terrain mode
   */
  setFollowTerrainMode(enabled: boolean): void {
    this.followTerrainMode = enabled;
    
    if (enabled) {
      // Disable orthographic mode if active
      if (this.isOrthographic) {
        this.setOrthographicView(false);
      }
    }
  }
  
  /**
   * Update camera position to follow terrain at fixed height
   */
  private updateFollowTerrainMode(): void {
    if (!this.followTerrainMode) return;
    
    const camera = this.camera;
    const targetPos = this.cameraTarget;
    
    // Raycast downward from camera position to find terrain height
    const raycaster = new THREE.Raycaster();
    const rayOrigin = new THREE.Vector3(targetPos.x, 1000, targetPos.z);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    
    raycaster.set(rayOrigin, rayDirection);
    
    // Get all terrain meshes
    const terrainMeshes: THREE.Mesh[] = [];
    for (const chunkMesh of this.chunkMeshes.values()) {
      terrainMeshes.push(chunkMesh.terrain);
    }
    
    if (terrainMeshes.length > 0) {
      const intersects = raycaster.intersectObjects(terrainMeshes);
      
      if (intersects.length > 0) {
        const terrainHeight = intersects[0].point.y;
        const targetHeight = terrainHeight + this.followTerrainHeight;
        
        // Smoothly adjust camera height
        const currentHeight = camera.position.y;
        const newHeight = currentHeight + (targetHeight - currentHeight) * 0.1;
        
        camera.position.y = newHeight;
      }
    }
  }

  /**
   * Get current camera position
   */
  /**
   * Get current camera position.
   * In orthographic mode returns the orthographic camera's XZ position
   * so chunk loading stays in sync with what's actually visible.
   */
  getCameraPosition(): Vector3 {
    if (this.isOrthographic && this.orthographicCamera) {
      return {
        x: this.orthographicCamera.position.x,
        y: this.orthographicCamera.position.y,
        z: this.orthographicCamera.position.z
      };
    }
    return {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z
    };
  }

  /**
   * Get camera heading angle in degrees (0 = North, 90 = East, 180 = South, 270 = West).
   * Derived from the camera's yaw rotation.
   */
  getCameraHeading(): number {
    // yaw=0 means camera looks toward -Z (North in our world).
    // Convert to compass degrees: 0° = North, clockwise positive.
    const deg = ((-this.cameraRotation.yaw) * 180 / Math.PI) % 360;
    return (deg + 360) % 360;
  }

  /**
   * Get current camera target
   */
  getCameraTarget(): Vector3 {
    return {
      x: this.cameraTarget.x,
      y: this.cameraTarget.y,
      z: this.cameraTarget.z
    };
  }

  /**
   * Resize the viewer
   */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Dispose of a group and its children
   */
  private disposeGroup(group: THREE.Group): void {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }

  /**
   * Calculate blended color from sparse biome weights
   * @param data - Chunk data with sparse biome weights
   * @param tileIndex - Tile index in the chunk
   * @returns Blended biome color
   */
  private calculateBlendedColorFromSparse(data: ChunkData, tileIndex: number): BiomeColor {
    // Get sparse weight data for this tile
    const start = data.sparseBiomeOffsets[tileIndex];
    const end = tileIndex < data.sparseBiomeOffsets.length - 1
      ? data.sparseBiomeOffsets[tileIndex + 1]
      : data.sparseBiomeTypes.length;
    
    // If no weights, use biome map
    if (start === end && data.biomeMap) {
      return getBiomeColor(data.biomeMap[tileIndex]);
    }
    
    // Blend colors based on weights
    let r = 0, g = 0, b = 0;
    
    for (let i = start; i < end; i++) {
      const biomeType = data.sparseBiomeTypes[i];
      const weight = data.sparseBiomeWeights[i];
      const color = getBiomeColor(biomeType);
      
      r += color.r * weight;
      g += color.g * weight;
      b += color.b * weight;
    }
    
    return { r, g, b };
  }

  /**
   * Generate chunk key
   */
  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }

  /**
   * Stitch duplicated boundary vertex positions only where an edge vertex is
   * part of a lake basin. This closes lake cracks without pulling entire chunk
   * borders down into trenches.
   */
  private stitchLakeBoundaryPositions(chunkX: number, chunkY: number): void {
    const mesh = this.chunkMeshes.get(this.getChunkKey(chunkX, chunkY));
    if (!mesh) return;

    const dataA = mesh.terrain.userData.chunkData as ChunkData | undefined;
    if (!dataA) return;

    const geomA = mesh.terrain.geometry as THREE.BufferGeometry;
    const posA = geomA.getAttribute('position') as THREE.BufferAttribute;
    const verticesPerSide = Math.round(Math.sqrt(posA.count));
    const chunkSize = verticesPerSide - 1;
    let changedA = false;

    const neighbours: Array<{ dx: number; dz: number }> = [
      { dx: 1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 1, dz: 1 },
    ];

    for (const { dx, dz } of neighbours) {
      const neighbourMesh = this.chunkMeshes.get(this.getChunkKey(chunkX + dx, chunkY + dz));
      if (!neighbourMesh) continue;

      const dataB = neighbourMesh.terrain.userData.chunkData as ChunkData | undefined;
      if (!dataB) continue;

      const geomB = neighbourMesh.terrain.geometry as THREE.BufferGeometry;
      const posB = geomB.getAttribute('position') as THREE.BufferAttribute;
      let changedB = false;

      if (dx === 1 && dz === 0) {
        for (let row = 0; row <= chunkSize; row++) {
          const idxA = row * verticesPerSide + chunkSize;
          const idxB = row * verticesPerSide;
          const touchesLake =
            this.vertexTouchesLake(dataA, chunkSize, row) ||
            this.vertexTouchesLake(dataB, 0, row);
          if (!touchesLake && !this.isLikelyLakeBoundaryHeightGap(posA, idxA, posB, idxB)) continue;

          const changed = this.stitchVertexHeightIfDifferent(
            posA,
            idxA,
            posB,
            idxB,
          );
          changedA ||= changed;
          changedB ||= changed;
        }
      } else if (dx === 0 && dz === 1) {
        for (let col = 0; col <= chunkSize; col++) {
          const idxA = chunkSize * verticesPerSide + col;
          const idxB = col;
          const touchesLake =
            this.vertexTouchesLake(dataA, col, chunkSize) ||
            this.vertexTouchesLake(dataB, col, 0);
          if (!touchesLake && !this.isLikelyLakeBoundaryHeightGap(posA, idxA, posB, idxB)) continue;

          const changed = this.stitchVertexHeightIfDifferent(
            posA,
            idxA,
            posB,
            idxB,
          );
          changedA ||= changed;
          changedB ||= changed;
        }
      } else {
        const touchesLake =
          this.vertexTouchesLake(dataA, chunkSize, chunkSize) ||
          this.vertexTouchesLake(dataB, 0, 0);
        const idxA = chunkSize * verticesPerSide + chunkSize;
        const idxB = 0;
        if (touchesLake || this.isLikelyLakeBoundaryHeightGap(posA, idxA, posB, idxB)) {
          const changed = this.stitchVertexHeightIfDifferent(
            posA,
            idxA,
            posB,
            idxB,
          );
          changedA ||= changed;
          changedB ||= changed;
        }
      }

      if (changedB) {
        posB.needsUpdate = true;
        geomB.computeVertexNormals();
        geomB.computeBoundingBox();
        geomB.computeBoundingSphere();
      }
    }

    if (changedA) {
      posA.needsUpdate = true;
      geomA.computeVertexNormals();
      geomA.computeBoundingBox();
      geomA.computeBoundingSphere();
    }
  }

  private vertexTouchesLake(data: ChunkData, vx: number, vy: number): boolean {
    const size = data.size;
    const lakes = data.lakes ?? [];
    if (lakes.length === 0) return false;

    for (const lake of lakes) {
      if (
        this.lakeHasTile(lake.tiles, vx, vy, size) ||
        this.lakeHasTile(lake.tiles, vx - 1, vy, size) ||
        this.lakeHasTile(lake.tiles, vx, vy - 1, size) ||
        this.lakeHasTile(lake.tiles, vx - 1, vy - 1, size)
      ) {
        return true;
      }
    }

    return false;
  }

  private lakeHasTile(tiles: Set<number>, tx: number, ty: number, size: number): boolean {
    return tx >= 0 && ty >= 0 && tx < size && ty < size && tiles.has(ty * size + tx);
  }

  private isLikelyLakeBoundaryHeightGap(
    posA: THREE.BufferAttribute,
    idxA: number,
    posB: THREE.BufferAttribute,
    idxB: number,
  ): boolean {
    const heightGap = Math.abs(posA.getY(idxA) - posB.getY(idxB));
    // Terrain generated from the same world coordinates should already match.
    // Lake carving can leave a larger local gap when only one side owns the
    // lake tile; keep this threshold above normal floating point noise.
    return heightGap > 0.25;
  }

  private stitchVertexHeightIfDifferent(
    posA: THREE.BufferAttribute,
    idxA: number,
    posB: THREE.BufferAttribute,
    idxB: number,
  ): boolean {
    const sharedY = Math.min(posA.getY(idxA), posB.getY(idxB));
    const changed = posA.getY(idxA) !== sharedY || posB.getY(idxB) !== sharedY;
    if (changed) {
      posA.setY(idxA, sharedY);
      posB.setY(idxB, sharedY);
    }
    return changed;
  }

  /**
   * Stitch normals between this chunk and all loaded neighbours.
   *
   * Three.js computes vertex normals purely from the triangles inside each mesh.
   * Boundary vertices therefore get normals that ignore the adjacent chunk's
   * geometry, producing a visible lighting seam.
   *
   * Fix: for every shared edge, average the normals of the two coincident
   * vertices (one from each mesh) and write the result back to both meshes.
   *
   * Called after addChunk() for the new chunk AND for each already-loaded
   * neighbour so both sides are updated.
   */
  private stitchBoundaryNormals(chunkX: number, chunkY: number): void {
    const mesh = this.chunkMeshes.get(this.getChunkKey(chunkX, chunkY));
    if (!mesh) return;

    const geom = mesh.terrain.geometry as THREE.BufferGeometry;
    const normA = geom.getAttribute('normal') as THREE.BufferAttribute;
    const posA  = geom.getAttribute('position') as THREE.BufferAttribute;

    // Infer chunkSize from vertex count: verticesPerSide = sqrt(vertexCount)
    const verticesPerSide = Math.round(Math.sqrt(posA.count));
    const chunkSize = verticesPerSide - 1;

    // Neighbours: right (+X), bottom (+Z), and diagonal (+X+Z) for corner
    const neighbours: Array<{ dx: number; dz: number }> = [
      { dx: 1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 1, dz: 1 },
    ];

    for (const { dx, dz } of neighbours) {
      const neighbourMesh = this.chunkMeshes.get(this.getChunkKey(chunkX + dx, chunkY + dz));
      if (!neighbourMesh) continue;

      const geomB = neighbourMesh.terrain.geometry as THREE.BufferGeometry;
      const normB = geomB.getAttribute('normal') as THREE.BufferAttribute;

      if (dx === 1 && dz === 0) {
        // Right edge of A  ↔  Left edge of B
        // A: x = chunkSize, y = 0..chunkSize
        // B: x = 0,         y = 0..chunkSize
        for (let row = 0; row <= chunkSize; row++) {
          const idxA = row * verticesPerSide + chunkSize;
          const idxB = row * verticesPerSide + 0;
          this._averageNormals(normA, idxA, normB, idxB);
        }
      } else if (dx === 0 && dz === 1) {
        // Bottom edge of A  ↔  Top edge of B
        // A: y = chunkSize, x = 0..chunkSize
        // B: y = 0,         x = 0..chunkSize
        for (let col = 0; col <= chunkSize; col++) {
          const idxA = chunkSize * verticesPerSide + col;
          const idxB = 0 * verticesPerSide + col;
          this._averageNormals(normA, idxA, normB, idxB);
        }
      } else {
        // Corner vertex only
        const idxA = chunkSize * verticesPerSide + chunkSize;
        const idxB = 0;
        this._averageNormals(normA, idxA, normB, idxB);
      }

      normB.needsUpdate = true;
    }

    normA.needsUpdate = true;
  }

  /** Average the normals of two vertices (one in each buffer) and write back to both. */
  private _averageNormals(
    normA: THREE.BufferAttribute, idxA: number,
    normB: THREE.BufferAttribute, idxB: number,
  ): void {
    const ax = normA.getX(idxA), ay = normA.getY(idxA), az = normA.getZ(idxA);
    const bx = normB.getX(idxB), by = normB.getY(idxB), bz = normB.getZ(idxB);
    // Average and re-normalise
    let nx = ax + bx, ny = ay + by, nz = az + bz;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) { nx /= len; ny /= len; nz /= len; }
    normA.setXYZ(idxA, nx, ny, nz);
    normB.setXYZ(idxB, nx, ny, nz);
  }

  /** Average the vertex colors of two coincident boundary vertices and write back to both. */
  private _averageColors(
    colA: THREE.BufferAttribute, idxA: number,
    colB: THREE.BufferAttribute, idxB: number,
  ): void {
    const r = (colA.getX(idxA) + colB.getX(idxB)) * 0.5;
    const g = (colA.getY(idxA) + colB.getY(idxB)) * 0.5;
    const b = (colA.getZ(idxA) + colB.getZ(idxB)) * 0.5;
    colA.setXYZ(idxA, r, g, b);
    colB.setXYZ(idxB, r, g, b);
  }

  /**
   * Stitch vertex colors along shared edges between this chunk and loaded neighbours.
   * Averages the colors of coincident boundary vertices to eliminate color seams
   * caused by biome blending differences at chunk edges.
   */
  private stitchBoundaryColors(chunkX: number, chunkY: number): void {
    const mesh = this.chunkMeshes.get(this.getChunkKey(chunkX, chunkY));
    if (!mesh) return;

    const geom = mesh.terrain.geometry as THREE.BufferGeometry;
    const colA = geom.getAttribute('color') as THREE.BufferAttribute;
    const posA = geom.getAttribute('position') as THREE.BufferAttribute;
    const verticesPerSide = Math.round(Math.sqrt(posA.count));
    const chunkSize = verticesPerSide - 1;

    const neighbours: Array<{ dx: number; dz: number }> = [
      { dx: 1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 1, dz: 1 },
    ];

    for (const { dx, dz } of neighbours) {
      const neighbourMesh = this.chunkMeshes.get(this.getChunkKey(chunkX + dx, chunkY + dz));
      if (!neighbourMesh) continue;

      const geomB = neighbourMesh.terrain.geometry as THREE.BufferGeometry;
      const colB = geomB.getAttribute('color') as THREE.BufferAttribute;

      if (dx === 1 && dz === 0) {
        for (let row = 0; row <= chunkSize; row++) {
          this._averageColors(colA, row * verticesPerSide + chunkSize, colB, row * verticesPerSide + 0);
        }
      } else if (dx === 0 && dz === 1) {
        for (let col = 0; col <= chunkSize; col++) {
          this._averageColors(colA, chunkSize * verticesPerSide + col, colB, 0 * verticesPerSide + col);
        }
      } else {
        this._averageColors(colA, chunkSize * verticesPerSide + chunkSize, colB, 0);
      }

      colB.needsUpdate = true;
    }

    colA.needsUpdate = true;
  }

  /**
   * Raycast from screen coordinates to terrain
   * Returns hit information including world position and chunk coordinates
   */
  raycastTerrain(screenX: number, screenY: number): RaycastHit | null {
    if (!this.container) {
      return null;
    }

    // Get all terrain meshes
    const terrainMeshes: THREE.Mesh[] = [];
    for (const chunkMesh of this.chunkMeshes.values()) {
      terrainMeshes.push(chunkMesh.terrain);
    }

    if (terrainMeshes.length === 0) {
      return null;
    }

    // Use raycasting utility
    const canvas = this.renderer.domElement;
    const chunkSize = 32; // Default chunk size - could be passed as parameter
    
    return raycastTerrain(
      screenX,
      screenY,
      this.camera,
      canvas,
      terrainMeshes,
      chunkSize,
      50 // heightScale
    );
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
   * Get the scene (for adding custom objects like brush preview)
   */
  getScene(): THREE.Scene {
    return this.scene;
  }
  
  /**
   * Update frustum culling for all chunks
   * Hides chunks that are outside the camera frustum to improve performance
   */
  private updateFrustumCulling(): void {
    if (!this.enableFrustumCulling) return;
    
    // Safety check for test environments where frustum might not be fully mocked
    if (typeof this.frustum.intersectsBox !== 'function') {
      return;
    }
    
    const activeCamera = this.isOrthographic && this.orthographicCamera ? this.orthographicCamera : this.camera;
    
    // Update frustum from camera
    this.frustumMatrix.multiplyMatrices(
      activeCamera.projectionMatrix,
      activeCamera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    
    // Check each chunk against frustum
    for (const [key, chunkMesh] of this.chunkMeshes.entries()) {
      if (!chunkMesh.boundingBox) continue;
      
      const isVisible = this.frustum.intersectsBox(chunkMesh.boundingBox);
      
      // Only update visibility if it changed
      if (chunkMesh.visible !== isVisible) {
        chunkMesh.visible = isVisible;
        
        // Update visibility for all mesh components
        chunkMesh.terrain.visible = isVisible && this.layerVisibility.get(RenderLayer.TERRAIN) !== false;
        
        if (chunkMesh.resources) {
          chunkMesh.resources.visible = isVisible && this.layerVisibility.get(RenderLayer.RESOURCES) !== false;
        }
        
        if (chunkMesh.structures) {
          chunkMesh.structures.visible = isVisible && this.layerVisibility.get(RenderLayer.STRUCTURES) !== false;
        }
        
        if (chunkMesh.boundaries) {
          chunkMesh.boundaries.visible = isVisible && this.layerVisibility.get(RenderLayer.CHUNK_BOUNDARIES) !== false;
        }
      }
    }
  }
  
  /**
   * Enable or disable frustum culling
   */
  setFrustumCulling(enabled: boolean): void {
    this.enableFrustumCulling = enabled;
    
    // If disabling, make all chunks visible
    if (!enabled) {
      for (const chunkMesh of this.chunkMeshes.values()) {
        chunkMesh.visible = true;
        chunkMesh.terrain.visible = this.layerVisibility.get(RenderLayer.TERRAIN) !== false;
        
        if (chunkMesh.resources) {
          chunkMesh.resources.visible = this.layerVisibility.get(RenderLayer.RESOURCES) !== false;
        }
        
        if (chunkMesh.structures) {
          chunkMesh.structures.visible = this.layerVisibility.get(RenderLayer.STRUCTURES) !== false;
        }
        
        if (chunkMesh.boundaries) {
          chunkMesh.boundaries.visible = this.layerVisibility.get(RenderLayer.CHUNK_BOUNDARIES) !== false;
        }
      }
    }
  }
  
  /**
   * Get frustum culling statistics
   */
  getFrustumCullingStats() {
    let visible = 0;
    let hidden = 0;
    
    for (const chunkMesh of this.chunkMeshes.values()) {
      if (chunkMesh.visible) {
        visible++;
      } else {
        hidden++;
      }
    }
    
    return {
      enabled: this.enableFrustumCulling,
      visible,
      hidden,
      total: visible + hidden
    };
  }
  
  /**
   * Get render statistics (vertex count, draw calls)
   * Кэшируем результаты чтобы избежать дорогого scene.traverse()
   */
  private cachedRenderStats: { vertexCount: number; drawCalls: number } | null = null;
  private lastRenderStatsUpdate = 0;
  private readonly RENDER_STATS_CACHE_DURATION = 1000; // Кэшируем на 1 секунду
  
  getRenderStats(): { vertexCount: number; drawCalls: number } {
    const now = performance.now();
    
    // Возвращаем кэшированные данные если они актуальны
    if (this.cachedRenderStats && now - this.lastRenderStatsUpdate < this.RENDER_STATS_CACHE_DURATION) {
      return this.cachedRenderStats;
    }
    
    let vertexCount = 0;
    let drawCalls = 0;
    
    // Count vertices and draw calls from all chunk meshes
    // Используем более эффективный подход: считаем только чанки
    for (const chunkMesh of this.chunkMeshes.values()) {
      if (chunkMesh.terrain && chunkMesh.terrain.visible) {
        const geometry = chunkMesh.terrain.geometry;
        
        // Count vertices
        if (geometry.attributes.position) {
          vertexCount += geometry.attributes.position.count;
        }
        
        // Each terrain mesh is a draw call
        drawCalls++;
      }
      
      // Count resources
      if (chunkMesh.resources && chunkMesh.resources.visible) {
        drawCalls += chunkMesh.resources.children.length;
      }
      
      // Count structures
      if (chunkMesh.structures && chunkMesh.structures.visible) {
        drawCalls += chunkMesh.structures.children.length;
      }
      
      // Count boundaries
      if (chunkMesh.boundaries && chunkMesh.boundaries.visible) {
        drawCalls++;
      }
    }
    
    // Кэшируем результаты
    this.cachedRenderStats = { vertexCount, drawCalls };
    this.lastRenderStatsUpdate = now;
    
    return this.cachedRenderStats;
  }
  
  /**
   * Сбросить кэш статистики рендеринга (вызывать при добавлении/удалении чанков)
   */
  private invalidateRenderStatsCache(): void {
    this.cachedRenderStats = null;
  }

  /**
   * Get the total count of micro-biomes currently visible across all chunks
   */
  getMicroBiomeCount(): number {
    let totalCount = 0;
    
    for (const chunkMesh of this.chunkMeshes.values()) {
      if (chunkMesh.terrain && chunkMesh.terrain.userData.microBiomeCount !== undefined) {
        totalCount += chunkMesh.terrain.userData.microBiomeCount;
      }
    }
    
    return totalCount;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Stop render loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Remove all chunks
    for (const [key] of this.chunkMeshes.entries()) {
      const [chunkX, chunkY] = key.split(',').map(Number);
      this.removeChunk(chunkX, chunkY);
    }
    
    // Dispose water layer manager
    this.waterLayerManager.dispose();
    
    // Dispose renderer
    this.renderer.dispose();
    
    // Remove input listeners registered during initialize()
    if (this.container) {
      this.container.removeEventListener('click', this.handleContainerClick);
    }
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handlePointerLockedMouseMove);
    document.removeEventListener('keydown', this.handlePointerLockEscape);
    window.removeEventListener('keydown', this.handleKeyboardDown);
    window.removeEventListener('keyup', this.handleKeyboardUp);
    this.keyboardState.clear();

    // Remove canvas from container
    if (this.container && this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    
    console.log('WorldViewer disposed');
  }
}
