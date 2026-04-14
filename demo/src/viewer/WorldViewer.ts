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
  private controls: OrbitControls;
  
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
  
  // Keyboard controls
  private keyboardState: Map<string, boolean>;
  private keyboardMoveSpeed: number;
  
  // Camera modes
  private followTerrainMode: boolean;
  private followTerrainHeight: number;
  private orthographicCamera: THREE.OrthographicCamera | null;
  private isOrthographic: boolean;
  
  // Performance optimizations
  private geometryPools: GeometryPools | null;
  private frustum: THREE.Frustum;
  private frustumMatrix: THREE.Matrix4;
  private enableFrustumCulling: boolean;
  private cullingCheckInterval: number;
  private lastCullingCheck: number;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    
    this.chunkMeshes = new Map();
    this.layerVisibility = new Map();
    this.wireframeMode = false;
    this.container = null;
    this.animationFrameId = null;
    
    // Initialize keyboard controls
    this.keyboardState = new Map();
    this.keyboardMoveSpeed = 2.0;
    
    // Initialize camera modes
    this.followTerrainMode = false;
    this.followTerrainHeight = 50;
    this.orthographicCamera = null;
    this.isOrthographic = false;
    
    // Initialize performance optimizations (lazy-initialized to avoid issues with mocked Three.js in tests)
    this.geometryPools = null;
    this.frustum = new THREE.Frustum();
    this.frustumMatrix = new THREE.Matrix4();
    this.enableFrustumCulling = true;
    this.cullingCheckInterval = 100; // Check every 100ms
    this.lastCullingCheck = 0;
    
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
    
    // Position camera
    this.camera.position.set(50, 100, 50);
    this.camera.lookAt(0, 0, 0);
    
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
    
    // Configure orbit controls
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 500;
    this.controls.maxPolarAngle = Math.PI / 2;
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
    
    // Start render loop
    this.startRenderLoop();
    
    console.log('WorldViewer initialized');
  }
  
  /**
   * Set up keyboard event listeners for WASD camera movement
   */
  private setupKeyboardControls(): void {
    window.addEventListener('keydown', (e) => {
      // Only handle WASD keys
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
        this.keyboardState.set(e.key.toLowerCase(), true);
        e.preventDefault();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
        this.keyboardState.set(e.key.toLowerCase(), false);
        e.preventDefault();
      }
    });
  }
  
  /**
   * Update camera position based on keyboard input
   */
  private updateKeyboardMovement(): void {
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
      
      // Update keyboard movement
      this.updateKeyboardMovement();
      
      // Update follow terrain mode
      if (this.followTerrainMode) {
        this.updateFollowTerrainMode();
      }
      
      // Update controls
      this.controls.update();
      
      // Perform frustum culling check periodically
      const now = performance.now();
      if (this.enableFrustumCulling && now - this.lastCullingCheck > this.cullingCheckInterval) {
        this.updateFrustumCulling();
        this.lastCullingCheck = now;
      }
      
      // Render scene
      const activeCamera = this.isOrthographic && this.orthographicCamera ? this.orthographicCamera : this.camera;
      this.renderer.render(this.scene, activeCamera);
    };
    
    animate();
  }

  /**
   * Add a chunk to the scene
   */
  addChunk(chunkX: number, chunkY: number, data: ChunkData, partial: boolean = false, stage?: number): void {
    const key = this.getChunkKey(chunkX, chunkY);
    
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
    
    // Only add complete layers if not partial or if stage is complete
    if (!partial || (stage !== undefined && stage >= 2)) { // GenerationStage.RIVERS = 2
      if (this.layerVisibility.get(RenderLayer.RIVERS) && data.rivers && data.rivers.size > 0) {
        chunkMesh.rivers = this.createRiverOverlay(chunkX, chunkY, data);
        this.scene.add(chunkMesh.rivers);
      }
    }
    
    if (!partial || (stage !== undefined && stage >= 3)) { // GenerationStage.RESOURCES = 3
      if (this.layerVisibility.get(RenderLayer.RESOURCES) && data.resources && data.resources.length > 0) {
        chunkMesh.resources = this.createResourceMarkers(chunkX, chunkY, data);
        this.scene.add(chunkMesh.resources);
      }
    }
    
    if (!partial || (stage !== undefined && stage >= 4)) { // GenerationStage.STRUCTURES = 4
      if (this.layerVisibility.get(RenderLayer.STRUCTURES) && data.structures && data.structures.length > 0) {
        chunkMesh.structures = this.createStructureMarkers(chunkX, chunkY, data);
        this.scene.add(chunkMesh.structures);
      }
    }
    
    if (this.layerVisibility.get(RenderLayer.CHUNK_BOUNDARIES)) {
      chunkMesh.boundaries = this.createChunkBoundaries(chunkX, chunkY, data);
      this.scene.add(chunkMesh.boundaries);
    }
    
    this.chunkMeshes.set(key, chunkMesh);
  }

  /**
   * Remove a chunk from the scene
   */
  removeChunk(chunkX: number, chunkY: number): void {
    const key = this.getChunkKey(chunkX, chunkY);
    const chunkMesh = this.chunkMeshes.get(key);
    
    if (!chunkMesh) return;
    
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
    // Simply remove and re-add
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
        if (hasBlendWeights && data.biomeMap) {
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
    
    // Create line segments for each river
    for (const river of data.rivers.values()) {
      // Skip rivers without a valid path
      if (!river.path || river.path.length < 2) {
        continue;
      }
      
      const vertices: number[] = [];
      
      // Build line segments for this river's path
      for (let i = 0; i < river.path.length - 1; i++) {
        const current = river.path[i];
        const next = river.path[i + 1];
        
        const currentHeight = data.heightmap[current.y * chunkSize + current.x];
        const nextHeight = data.heightmap[next.y * chunkSize + next.x];
        
        const worldX1 = chunkX * chunkSize + current.x;
        const worldZ1 = chunkY * chunkSize + current.y;
        const worldX2 = chunkX * chunkSize + next.x;
        const worldZ2 = chunkY * chunkSize + next.y;
        
        // Offset slightly above terrain to prevent z-fighting
        vertices.push(
          worldX1, currentHeight * 50 + 0.5, worldZ1,
          worldX2, nextHeight * 50 + 0.5, worldZ2
        );
      }
      
      // Create geometry for this river
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      
      // Create blue material with enhanced visibility
      const material = new THREE.LineBasicMaterial({ 
        color: 0x0066ff,
        linewidth: 2,
        transparent: true,
        opacity: 0.9
      });
      
      const riverSegment = new THREE.LineSegments(geometry, material);
      riverLayer.add(riverSegment);
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
      
      const geometry = new THREE.BoxGeometry(2, 3, 2);
      const material = new THREE.MeshLambertMaterial({ color: this.getStructureColor(structure.type) });
      const marker = new THREE.Mesh(geometry, material);
      
      marker.position.set(worldX, height * 50 + 1.5, worldZ);
      group.add(marker);
    }
    
    return group;
  }

  /**
   * Create chunk boundary visualization
   */
  private createChunkBoundaries(chunkX: number, chunkY: number, data: ChunkData): THREE.LineSegments {
    const chunkSize = data.size;
    const vertices: number[] = [];
    
    // Get corner heights
    const topLeft = data.heightmap[0];
    const topRight = data.heightmap[chunkSize - 1];
    const bottomLeft = data.heightmap[(chunkSize - 1) * chunkSize];
    const bottomRight = data.heightmap[chunkSize * chunkSize - 1];
    
    const worldX = chunkX * chunkSize;
    const worldZ = chunkY * chunkSize;
    
    // Draw boundary lines
    vertices.push(
      worldX, topLeft * 50, worldZ,
      worldX + chunkSize, topRight * 50, worldZ,
      
      worldX + chunkSize, topRight * 50, worldZ,
      worldX + chunkSize, bottomRight * 50, worldZ + chunkSize,
      
      worldX + chunkSize, bottomRight * 50, worldZ + chunkSize,
      worldX, bottomLeft * 50, worldZ + chunkSize,
      
      worldX, bottomLeft * 50, worldZ + chunkSize,
      worldX, topLeft * 50, worldZ
    );
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    
    const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 1 });
    
    return new THREE.LineSegments(geometry, material);
  }

  /**
   * Get resource color
   */
  private getResourceColor(type: string): number {
    const colors: { [key: string]: number } = {
      'iron': 0xc0c0c0,
      'gold': 0xffd700,
      'coal': 0x000000,
      'stone': 0x808080,
      'wood': 0x8b4513
    };
    
    return colors[type] || 0xff00ff;
  }

  /**
   * Get structure color
   */
  private getStructureColor(type: string): number {
    const colors: { [key: string]: number } = {
      'village': 0x8b4513,
      'dungeon': 0x2f4f4f,
      'temple': 0xdaa520
    };
    
    return colors[type] || 0xff00ff;
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
    this.controls.target.set(target.x, target.y, target.z);
    this.controls.update();
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
    
    this.camera.position.set(50, 100, 50);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
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
      
      // Update controls to use orthographic camera
      this.controls.object = this.orthographicCamera;
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    } else {
      // Switch back to perspective camera
      this.controls.object = this.camera;
      this.controls.update();
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
    return {
      x: this.controls.target.x,
      y: this.controls.target.y,
      z: this.controls.target.z
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
    
    // Clear geometry pools
    if (this.geometryPools) {
      this.geometryPools.clear();
    }
    
    // Dispose controls
    this.controls.dispose();
    
    // Dispose renderer
    this.renderer.dispose();
    
    // Remove canvas from container
    if (this.container && this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    
    console.log('WorldViewer disposed');
  }
}
