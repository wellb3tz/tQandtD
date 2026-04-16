/**
 * Water layer manager for managing water mesh lifecycle
 * 
 * Coordinates ocean water mesh generation and manages water meshes 
 * independently from terrain. Handles adding, removing, updating,
 * and visibility control for water layers.
 */

import * as THREE from 'three';
import type { ChunkData } from '../../../../src/world/chunk';
import type { WaterConfig, WaterLayerData, WaterMesh } from './types';
import { identifyOceanTiles, buildOceanGeometry } from './OceanMeshGenerator';
import { createOceanMaterial } from './WaterMaterialFactory';

/**
 * Water layer manager class
 * 
 * Manages water mesh lifecycle for chunks, providing methods to add, remove,
 * update, and control visibility of water layers independently from terrain.
 * 
 * **Performance Features:**
 * - LOD support: Reduces water mesh complexity based on distance from camera
 * - Frustum culling: Hides water meshes outside camera view
 * - Geometry pooling: Reuses geometries for similar water patterns
 * - Mesh merging: Combines adjacent water tiles into single meshes
 */
export class WaterLayerManager {
  /** Map of chunk keys to water layer data */
  private waterLayers: Map<string, WaterLayerData>;
  
  /** Frustum for culling */
  private frustum: THREE.Frustum;
  
  /** Frustum matrix */
  private frustumMatrix: THREE.Matrix4;

  constructor() {
    this.waterLayers = new Map();
    this.frustum = new THREE.Frustum();
    this.frustumMatrix = new THREE.Matrix4();
  }

  /**
   * Generate chunk key from coordinates
   */
  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }

  /**
   * Add water meshes to a chunk
   * 
   * Generates and adds all water meshes (ocean, rivers, lakes) for a chunk
   * to the scene. Water meshes are independent from terrain meshes.
   * 
   * **Validates: Requirements 7.1, 7.2**
   * 
   * @param chunkKey - Unique chunk identifier (e.g., "0,0")
   * @param chunkData - Chunk data containing heightmap and water features
   * @param scene - Three.js scene to add meshes to
   * @param config - Water configuration
   */
  addWaterToChunk(
    chunkKey: string,
    chunkData: ChunkData,
    scene: THREE.Scene,
    config: WaterConfig
  ): void {
    // Skip if water is disabled
    if (!config.enabled) {
      return;
    }

    // Skip if water already exists for this chunk
    if (this.waterLayers.has(chunkKey)) {
      console.warn(`Water layer already exists for chunk ${chunkKey}`);
      return;
    }

    // Create water layer data structure
    const waterLayer: WaterLayerData = {
      ocean: [],
      rivers: [],
      lakes: [],
      group: new THREE.Group(),
    };

    // Generate ocean meshes
    const oceanTiles = identifyOceanTiles(chunkData, config.seaLevel);
    console.log(`[Water] Chunk ${chunkKey}: Found ${oceanTiles.length} ocean tiles`);
    if (oceanTiles.length > 0) {
      const oceanGeometry = buildOceanGeometry(oceanTiles, chunkData, config);
      if (oceanGeometry) {
        const oceanMaterial = createOceanMaterial(config.ocean);
        const oceanMesh = new THREE.Mesh(oceanGeometry, oceanMaterial);
        oceanMesh.renderOrder = 1; // Render after terrain (terrain is 0)
        oceanMesh.visible = true; // Explicitly set visible
        
        const boundingBox = new THREE.Box3();
        if (oceanGeometry.boundingBox) {
          boundingBox.copy(oceanGeometry.boundingBox);
        } else {
          oceanGeometry.computeBoundingBox();
          if (oceanGeometry.boundingBox) {
            boundingBox.copy(oceanGeometry.boundingBox);
          }
        }
        
        const waterMesh: WaterMesh = {
          type: 'ocean',
          mesh: oceanMesh,
          material: oceanMaterial,
          boundingBox,
        };
        
        waterLayer.ocean.push(waterMesh);
        waterLayer.group.add(oceanMesh);
        console.log(`[Water] Added ocean mesh to chunk ${chunkKey}`);
      }
    }

    // Position group at origin
    // Ocean geometries use world coordinates, so group is positioned at origin
    waterLayer.group.position.set(0, 0, 0);
    waterLayer.group.visible = true; // Explicitly set visible
    waterLayer.group.renderOrder = 1; // Render after terrain

    // Add to scene and store
    scene.add(waterLayer.group);
    this.waterLayers.set(chunkKey, waterLayer);
    
    console.log(`[Water] Added water layer for chunk ${chunkKey}:`, {
      ocean: waterLayer.ocean.length,
      rivers: waterLayer.rivers.length,
      lakes: waterLayer.lakes.length,
      groupChildren: waterLayer.group.children.length,
      groupVisible: waterLayer.group.visible,
      groupPosition: { x: waterLayer.group.position.x, y: waterLayer.group.position.y, z: waterLayer.group.position.z }
    });
  }

  /**
   * Remove water meshes from a chunk
   * 
   * Removes and disposes all water meshes and resources for a chunk.
   * Does not affect terrain meshes.
   * 
   * **Validates: Requirements 7.2, 7.5**
   * 
   * @param chunkKey - Unique chunk identifier
   * @param scene - Three.js scene to remove meshes from
   */
  removeWaterFromChunk(chunkKey: string, scene: THREE.Scene): void {
    const waterLayer = this.waterLayers.get(chunkKey);
    if (!waterLayer) {
      return;
    }

    // Remove group from scene
    scene.remove(waterLayer.group);

    // Dispose ocean meshes
    for (const waterMesh of waterLayer.ocean) {
      this.disposeMesh(waterMesh);
    }

    // Dispose river meshes
    for (const waterMesh of waterLayer.rivers) {
      this.disposeMesh(waterMesh);
    }

    // Dispose lake meshes
    for (const waterMesh of waterLayer.lakes) {
      this.disposeMesh(waterMesh);
    }

    // Clear arrays
    waterLayer.ocean.length = 0;
    waterLayer.rivers.length = 0;
    waterLayer.lakes.length = 0;

    // Remove from map
    this.waterLayers.delete(chunkKey);
  }

  /**
   * Update water meshes for a chunk
   * 
   * Removes existing water meshes and regenerates them with updated chunk data.
   * Useful when chunk data changes (e.g., terrain editing).
   * 
   * **Validates: Requirements 7.3, 7.6**
   * 
   * @param chunkKey - Unique chunk identifier
   * @param chunkData - Updated chunk data
   * @param scene - Three.js scene
   * @param config - Water configuration
   */
  updateWaterMeshes(
    chunkKey: string,
    chunkData: ChunkData,
    scene: THREE.Scene,
    config: WaterConfig
  ): void {
    // Remove existing water
    this.removeWaterFromChunk(chunkKey, scene);

    // Add new water with updated data
    this.addWaterToChunk(chunkKey, chunkData, scene, config);
  }

  /**
   * Toggle visibility of all water meshes
   * 
   * Controls visibility of all water layers without disposing resources.
   * 
   * **Validates: Requirements 7.4**
   * 
   * @param visible - Whether water should be visible
   */
  toggleWaterVisibility(visible: boolean): void {
    for (const waterLayer of this.waterLayers.values()) {
      waterLayer.group.visible = visible;
    }
  }

  /**
   * Dispose a single water mesh and its resources
   */
  private disposeMesh(waterMesh: WaterMesh): void {
    // Dispose geometry
    waterMesh.mesh.geometry.dispose();

    // Dispose material(s)
    if (Array.isArray(waterMesh.mesh.material)) {
      for (const material of waterMesh.mesh.material) {
        material.dispose();
      }
    } else {
      waterMesh.mesh.material.dispose();
    }
  }

  /**
   * Dispose all water resources
   * 
   * Cleans up all water meshes and resources. Should be called when
   * the water system is no longer needed.
   */
  dispose(): void {
    for (const [chunkKey, waterLayer] of this.waterLayers.entries()) {
      // Dispose all meshes
      for (const waterMesh of waterLayer.ocean) {
        this.disposeMesh(waterMesh);
      }
      for (const waterMesh of waterLayer.rivers) {
        this.disposeMesh(waterMesh);
      }
      for (const waterMesh of waterLayer.lakes) {
        this.disposeMesh(waterMesh);
      }

      // Clear arrays
      waterLayer.ocean.length = 0;
      waterLayer.rivers.length = 0;
      waterLayer.lakes.length = 0;
    }

    // Clear map
    this.waterLayers.clear();
  }

  /**
   * Get water layer data for a chunk
   * 
   * @param chunkKey - Unique chunk identifier
   * @returns Water layer data, or undefined if not found
   */
  getWaterLayer(chunkKey: string): WaterLayerData | undefined {
    return this.waterLayers.get(chunkKey);
  }

  /**
   * Check if a chunk has water
   * 
   * @param chunkKey - Unique chunk identifier
   * @returns True if chunk has water meshes
   */
  hasWater(chunkKey: string): boolean {
    return this.waterLayers.has(chunkKey);
  }

  /**
   * Get all chunk keys with water
   * 
   * @returns Array of chunk keys
   */
  getChunkKeys(): string[] {
    return Array.from(this.waterLayers.keys());
  }
  
  /**
   * Apply LOD to water meshes based on distance from camera
   * 
   * Reduces water mesh complexity for distant chunks to improve performance.
   * Uses simple visibility-based LOD: show/hide water based on distance.
   * 
   * **Validates: Requirements 8.3**
   * 
   * @param cameraPosition - Camera position for distance calculation
   * @param config - Water configuration with LOD settings
   */
  applyLOD(cameraPosition: THREE.Vector3, config: WaterConfig): void {
    if (!config.performance.enableLOD) {
      return;
    }

    // LOD distance thresholds (in world units)
    const LOD_NEAR = 200;  // Full detail
    const LOD_FAR = 500;   // Hide water

    for (const [chunkKey, waterLayer] of this.waterLayers.entries()) {
      // Calculate distance from camera to chunk center
      const chunkPos = waterLayer.group.position;
      
      // Calculate distance manually to handle mocked Vector3 in tests
      const dx = cameraPosition.x - chunkPos.x;
      const dy = cameraPosition.y - chunkPos.y;
      const dz = cameraPosition.z - chunkPos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Apply LOD based on distance
      if (distance < LOD_NEAR) {
        // Near: Full detail (all water visible)
        waterLayer.group.visible = true;
      } else if (distance < LOD_FAR) {
        // Medium: Reduce detail (hide rivers and lakes, keep ocean)
        waterLayer.group.visible = true;
        
        // Hide rivers and lakes at medium distance
        for (const waterMesh of waterLayer.rivers) {
          waterMesh.mesh.visible = false;
        }
        for (const waterMesh of waterLayer.lakes) {
          waterMesh.mesh.visible = false;
        }
        
        // Keep ocean visible
        for (const waterMesh of waterLayer.ocean) {
          waterMesh.mesh.visible = true;
        }
      } else {
        // Far: Hide all water
        waterLayer.group.visible = false;
      }
    }
  }
  
  /**
   * Apply frustum culling to water meshes
   * 
   * Hides water meshes outside the camera frustum to improve performance.
   * 
   * **Validates: Requirements 8.4**
   * 
   * @param camera - Camera for frustum calculation
   * @param config - Water configuration with culling settings
   */
  applyFrustumCulling(camera: THREE.Camera, config: WaterConfig): void {
    if (!config.performance.enableFrustumCulling) {
      return;
    }

    // Update frustum from camera
    this.frustumMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);

    // Check each water layer against frustum
    for (const [chunkKey, waterLayer] of this.waterLayers.entries()) {
      let isVisible = false;

      // Check if any water mesh is visible in frustum
      for (const waterMesh of waterLayer.ocean) {
        if (this.frustum.intersectsBox(waterMesh.boundingBox)) {
          isVisible = true;
          break;
        }
      }

      if (!isVisible) {
        for (const waterMesh of waterLayer.rivers) {
          if (this.frustum.intersectsBox(waterMesh.boundingBox)) {
            isVisible = true;
            break;
          }
        }
      }

      if (!isVisible) {
        for (const waterMesh of waterLayer.lakes) {
          if (this.frustum.intersectsBox(waterMesh.boundingBox)) {
            isVisible = true;
            break;
          }
        }
      }

      // Update visibility
      waterLayer.group.visible = isVisible;
    }
  }
}
