/**
 * WorldViewer - 3D visualization component using Three.js
 * 
 * Manages Three.js scene, rendering, camera controls, and chunk visualization.
 * Renders terrain heightmaps as 3D meshes with biome-based coloring, rivers,
 * resources, structures, and chunk boundaries.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ChunkData } from '../../../src/index';
import {
  getBiomeColor,
  calculateBlendedColor,
  createTerrainMaterial,
  toGrayscale,
  BiomeColor
} from './materials';
import { raycastTerrain } from '../utils/coordinates';
import { GeometryPools } from './GeometryPools';
import { WaterLayerManager } from './water/WaterLayerManager';
import { adjustUnderwaterColors } from './water/UnderwaterTerrainProcessor';
import { DEFAULT_WATER_CONFIG } from './water/config';
import type { WaterConfig } from './water/types';

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
  RIVERS = 'rivers',
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
  /** @deprecated Use water property instead */
  rivers?: THREE.Group;
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
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls | null; // Make optional for free camera mode
  
  // Lighting
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  
  // Chunk meshes
  private chunkMeshes: Map<string, ChunkMesh>;
  
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
  private geometryPools: GeometryPools | null;
  private frustum: THREE.Frustum;
  private frustumMatrix: THREE.Matrix4;
  private enableFrustumCulling: boolean;
  private cullingCheckInterval: number;
  private lastCullingCheck: number;
  
  // Water system
  private waterLayerManager: WaterLayerManager;
  private waterConfig: WaterConfig;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.controls = null; // Will be initialized based on camera mode
    
    this.chunkMeshes = new Map();
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
    
    // Initialize performance optimizations (lazy-initialized to avoid issues with mocked Three.js in tests)
    this.geometryPools = null;
    this.frustum = new THREE.Frustum();
    this.frustumMatrix = new THREE.Matrix4();
    this.enableFrustumCulling = true;
    this.cullingCheckInterval = 16; // Check every 16ms (every frame at 60 FPS)
    this.lastCullingCheck = 0;
    
    // Initialize water system
    this.waterLayerManager = new WaterLayerManager();
    this.waterConfig = DEFAULT_WATER_CONFIG;
    
    // Initialize layer visibility (all visible by default)
    Object.values(RenderLayer).forEach(layer => {
      this.layerVisibility.set(layer, true);
    });
    
    // Create lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    
    this.setupScene();
  }

  /**
   * Set up the Three.js scene
   */
  private setupScene(): void {
    // Set scene background
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    
    // Position camera for free camera mode
    this.camera.position.set(50, 100, 50);
    this.cameraRotation.yaw = 0;
    this.cameraRotation.pitch = -0.3; // Look slightly down
    this.updateCameraRotation();
    
    // Configure renderer
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add lighting to scene
    this.scene.add(this.ambientLight);
    
    this.directionalLight.position.set(50, 100, 50);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.scene.add(this.directionalLight);
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
    this.container.addEventListener('click', () => {
      if (this.useFreeCamera && !this.isPointerLocked) {
        this.container?.requestPointerLock();
      }
    });
    
    // Handle pointer lock change
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.container;
    });
    
    // Handle mouse movement when pointer is locked
    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && this.useFreeCamera) {
        this.cameraRotation.yaw -= e.movementX * this.mouseSensitivity;
        this.cameraRotation.pitch -= e.movementY * this.mouseSensitivity;
        this.updateCameraRotation();
      }
    });
    
    // Exit pointer lock on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isPointerLocked) {
        document.exitPointerLock();
      }
    });
  }
  
  /**
   * Set up keyboard event listeners for WASD camera movement
   */
  private setupKeyboardControls(): void {
    window.addEventListener('keydown', (e) => {
      // Handle WASD, Space, and Shift keys
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', ' ', 'Shift'].includes(e.key)) {
        const key = e.key === ' ' ? 'space' : e.key === 'Shift' ? 'shift' : e.key.toLowerCase();
        this.keyboardState.set(key, true);
        e.preventDefault();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', ' ', 'Shift'].includes(e.key)) {
        const key = e.key === ' ' ? 'space' : e.key === 'Shift' ? 'shift' : e.key.toLowerCase();
        this.keyboardState.set(key, false);
        e.preventDefault();
      }
    });
  }
  
  /**
   * Update camera position based on keyboard input (for orbit controls mode only)
   */
  private updateKeyboardMovement(): void {
    // Only run this method when using orbit controls (not free camera)
    if (!this.controls || this.useFreeCamera) return;
    if (this.keyboardState.size === 0) return;
    
    const camera = this.isOrthographic && this.orthographicCamera ? this.orthographicCamera : this.camera;
    
    // Get camera forward and right vectors
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();
    
    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    right.normalize();
    
    // Calculate movement vector
    const movement = new THREE.Vector3();
    
    if (this.keyboardState.get('w')) {
      movement.add(forward.multiplyScalar(this.keyboardMoveSpeed));
    }
    if (this.keyboardState.get('s')) {
      movement.add(forward.multiplyScalar(-this.keyboardMoveSpeed));
    }
    if (this.keyboardState.get('a')) {
      movement.add(right.multiplyScalar(-this.keyboardMoveSpeed));
    }
    if (this.keyboardState.get('d')) {
      movement.add(right.multiplyScalar(this.keyboardMoveSpeed));
    }
    
    // Apply movement to camera and controls target
    if (movement.length() > 0) {
      camera.position.add(movement);
      this.controls.target.add(movement);
      this.controls.update();
    }
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
      
      // Update keyboard movement (for orbit controls compatibility)
      this.updateKeyboardMovement();
      
      // Update follow terrain mode
      if (this.followTerrainMode) {
        this.updateFollowTerrainMode();
      }
      
      // Update controls (only if using orbit controls)
      if (this.controls && !this.useFreeCamera) {
        this.controls.update();
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
        
        // Apply LOD to water meshes
        if (this.waterConfig.performance.enableLOD) {
          this.waterLayerManager.applyLOD(activeCamera.position, this.waterConfig);
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
    
    // Remove existing chunk if present
    if (this.chunkMeshes.has(key)) {
      this.removeChunk(chunkX, chunkY);
    }
    
    // Get LOD level from chunk metadata if available
    const lodLevel = (data as any).lodLevel;
    
    const chunkMesh: ChunkMesh = {
      terrain: this.createTerrainMesh(chunkX, chunkY, data, lodLevel, partial, stage),
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
    // Rivers: Render only on HIGH and MEDIUM LOD
    if (!partial || (stage !== undefined && stage >= 2)) { // GenerationStage.RIVERS = 2
      if (this.layerVisibility.get(RenderLayer.RIVERS) && data.rivers && data.rivers.size > 0) {
        if (lodLevel === undefined || lodLevel <= 1) { // HIGH or MEDIUM
          chunkMesh.rivers = this.createRiverOverlay(chunkX, chunkY, data);
          this.scene.add(chunkMesh.rivers);
        }
      }
    }
    
    // Resources: Render only on HIGH LOD
    if (!partial || (stage !== undefined && stage >= 3)) { // GenerationStage.RESOURCES = 3
      if (data.resources && data.resources.length > 0) {
        if (lodLevel === undefined || lodLevel === 0) { // Only HIGH
          chunkMesh.resources = this.createResourceMarkers(chunkX, chunkY, data);
          chunkMesh.resources.visible = this.layerVisibility.get(RenderLayer.RESOURCES) !== false;
          this.scene.add(chunkMesh.resources);
        }
      }
    }
    
    // Structures: Render only on HIGH and MEDIUM LOD
    if (!partial || (stage !== undefined && stage >= 4)) { // GenerationStage.STRUCTURES = 4
      if (data.structures && data.structures.length > 0) {
        if (lodLevel === undefined || lodLevel <= 1) { // HIGH or MEDIUM
          chunkMesh.structures = this.createStructureMarkers(chunkX, chunkY, data);
          chunkMesh.structures.visible = this.layerVisibility.get(RenderLayer.STRUCTURES) !== false;
          this.scene.add(chunkMesh.structures);
        }
      }
    }
    
    // Always create chunk boundaries, but respect visibility setting
    chunkMesh.boundaries = this.createChunkBoundaries(chunkX, chunkY, data);
    chunkMesh.boundaries.visible = this.layerVisibility.get(RenderLayer.CHUNK_BOUNDARIES) !== false;
    this.scene.add(chunkMesh.boundaries);
    
    this.chunkMeshes.set(key, chunkMesh);
  }

  /**
   * Remove a chunk from the scene
   */
  removeChunk(chunkX: number, chunkY: number): void {
    const key = this.getChunkKey(chunkX, chunkY);
    const chunkMesh = this.chunkMeshes.get(key);
    
    if (!chunkMesh) return;
    
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
    
    if (chunkMesh.rivers) {
      this.scene.remove(chunkMesh.rivers);
      this.disposeGroup(chunkMesh.rivers);
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
   * Optionally applies LOD visualization (tint based on LOD level)
   * Optionally applies partial generation visualization (opacity/color based on stage)
   * 
   * Optimized for performance with large chunk counts:
   * - Uses typed arrays for better memory efficiency
   * - Pre-allocates arrays to avoid resizing
   * - Uses indexed geometry to reduce vertex count
   */
  private createTerrainMesh(chunkX: number, chunkY: number, data: ChunkData, lodLevel?: number, partial: boolean = false, stage?: number): THREE.Mesh {
    const chunkSize = data.size;
    
    // VALIDATION: Check if heightmap has the correct size
    const expectedHeightmapSize = (chunkSize + 1) * (chunkSize + 1);
    if (data.heightmap.length !== expectedHeightmapSize) {
      console.error(
        `Heightmap size mismatch! Expected ${expectedHeightmapSize} (${chunkSize + 1}x${chunkSize + 1}), ` +
        `got ${data.heightmap.length}. Chunk: (${chunkX}, ${chunkY}), LOD: ${lodLevel}`
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
    const hasBlendWeights = data.biomeWeights && data.biomeWeights.length > 0;
    const numBiomes = 8; // Total number of BiomeType enum values
    
    // Apply underwater color adjustments if heightmap and biome data available
    let underwaterColors: BiomeColor[] | null = null;
    if (data.heightmap && data.biomeWeights && hasBlendWeights) {
      underwaterColors = adjustUnderwaterColors(
        data.heightmap,
        data.biomeWeights,
        chunkSize,
        {
          seaLevel: this.waterConfig.seaLevel,
          darkenFactor: this.waterConfig.rendering.underwaterDarkenFactor,
          desaturationFactor: this.waterConfig.rendering.underwaterDesaturationFactor,
          enableDepthGradient: this.waterConfig.rendering.enableDepthGradient,
        }
      );
    }
    
    // LOD visualization tints
    const lodTints = [
      { r: 1.0, g: 1.0, b: 1.0 },    // HIGH: No tint (white)
      { r: 1.0, g: 1.0, b: 0.8 },    // MEDIUM: Slight yellow tint
      { r: 0.8, g: 0.8, b: 1.0 }     // LOW: Slight blue tint
    ];
    
    const lodTint = lodLevel !== undefined && lodLevel >= 0 && lodLevel < lodTints.length
      ? lodTints[lodLevel]
      : { r: 1.0, g: 1.0, b: 1.0 };
    
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
      } else if (stage < 5) { // RIVERS/RESOURCES/STRUCTURES
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
          color = calculateBlendedColor(data.biomeWeights, bmIndex, numBiomes);
        } else if (data.biomeMap) {
          const biome = data.biomeMap[bmIndex];
          color = getBiomeColor(biome);
        } else {
          color = { r: 0.5, g: 0.5, b: 0.5 };
        }
        
        // Apply tints
        colors[vertexIndex] = color.r * lodTint.r * partialTint.r;
        colors[vertexIndex + 1] = color.g * lodTint.g * partialTint.g;
        colors[vertexIndex + 2] = color.b * lodTint.b * partialTint.b;
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
    
    // Create material using materials module
    const material = createTerrainMaterial(this.wireframeMode);
    
    // Apply opacity for partial chunks
    if (partial && partialOpacity < 1.0) {
      material.transparent = true;
      material.opacity = partialOpacity;
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    
    // Store LOD level and partial status in mesh userData for reference
    if (lodLevel !== undefined) {
      mesh.userData.lodLevel = lodLevel;
    }
    if (partial) {
      mesh.userData.partial = true;
      mesh.userData.stage = stage;
    }
    
    return mesh;
  }

  /**
   * Create river overlay as a Three.js Group containing river segments
   * Renders rivers as blue lines/meshes for better visualization
   */
  private createRiverOverlay(chunkX: number, chunkY: number, data: ChunkData): THREE.Group {
    const riverLayer = new THREE.Group();
    const chunkSize = data.size;
    
    // Check if rivers exist
    if (!data.rivers || data.rivers.size === 0) {
      return riverLayer;
    }
    
    const vertices: number[] = [];
    
    // Convert river indices to world positions
    for (const index of data.rivers) {
      const localX = index % chunkSize;
      const localY = Math.floor(index / chunkSize);
      
      // Get height at this position
      const heightIndex = localY * (chunkSize + 1) + localX;
      const height = data.heightmap[heightIndex];
      
      const worldX = chunkX * chunkSize + localX;
      const worldZ = chunkY * chunkSize + localY;
      
      // Add a small cube at each river tile
      const geometry = new THREE.BoxGeometry(0.8, 0.3, 0.8);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x0066ff,
        transparent: true,
        opacity: 0.7
      });
      
      const riverTile = new THREE.Mesh(geometry, material);
      riverTile.position.set(worldX + 0.5, height * 50 + 0.2, worldZ + 0.5);
      riverLayer.add(riverTile);
    }
    
    return riverLayer;
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
        case RenderLayer.RIVERS:
          if (chunkMesh.rivers) chunkMesh.rivers.visible = visible;
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
    
    // Update controls target if they exist
    if (this.controls) {
      this.controls.target.set(target.x, target.y, target.z);
      this.controls.update();
    }
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
    
    // Update orbit controls if they exist
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
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
      
      // Position orthographic camera for top-down view
      this.orthographicCamera.position.set(0, 200, 0);
      this.orthographicCamera.lookAt(0, 0, 0);
      
      // Update controls to use orthographic camera (if controls exist)
      if (this.controls) {
        this.controls.object = this.orthographicCamera;
        this.controls.target.set(0, 0, 0);
        this.controls.update();
      }
    } else {
      // Switch back to perspective camera
      if (this.controls) {
        this.controls.object = this.camera;
        this.controls.update();
      }
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
    if (!this.followTerrainMode || !this.controls) return;
    
    const camera = this.camera;
    const targetPos = this.controls.target;
    
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
  getCameraPosition(): Vector3 {
    return {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z
    };
  }

  /**
   * Get current camera target
   */
  getCameraTarget(): Vector3 {
    if (this.controls) {
      return {
        x: this.controls.target.x,
        y: this.controls.target.y,
        z: this.controls.target.z
      };
    }
    // Return internal target for free camera mode
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
   * Generate chunk key
   */
  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
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
        
        if (chunkMesh.rivers) {
          chunkMesh.rivers.visible = isVisible && this.layerVisibility.get(RenderLayer.RIVERS) !== false;
        }
        
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
        
        if (chunkMesh.rivers) {
          chunkMesh.rivers.visible = this.layerVisibility.get(RenderLayer.RIVERS) !== false;
        }
        
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
   * Get geometry pool statistics
   */
  getPoolStats() {
    if (!this.geometryPools) {
      this.geometryPools = new GeometryPools();
    }
    return this.geometryPools.getStats();
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
    
    // Clear geometry pools
    if (this.geometryPools) {
      this.geometryPools.clear();
    }
    
    // Dispose controls
    if (this.controls) {
      this.controls.dispose();
    }
    
    // Dispose renderer
    this.renderer.dispose();
    
    // Remove canvas from container
    if (this.container && this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    
    console.log('WorldViewer disposed');
  }
}
