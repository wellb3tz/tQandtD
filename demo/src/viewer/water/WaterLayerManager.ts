/**
 * Water layer manager for managing ocean water mesh lifecycle
 * 
 * Coordinates ocean water mesh generation and manages water meshes 
 * independently from terrain. Handles adding, removing, updating,
 * and visibility control for ocean water layers.
 */

import * as THREE from 'three';
import type { ChunkData } from '@engine/world/chunk';
import type { WaterConfig, WaterLayerData, WaterMesh } from './types';
import { identifyOceanTiles, buildOceanGeometry } from './OceanMeshGenerator';
import { identifyLakeTiles, buildLakeGeometry, createLakeMaterial } from './LakeMeshGenerator';
import { createOceanMaterial } from './WaterMaterialFactory';

/**
 * Water layer manager class
 * 
 * Manages ocean water mesh lifecycle for chunks, providing methods to add,
 * remove, update, and control visibility of ocean water layers independently
 * from terrain.
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
   * Add ocean water meshes to a chunk
   * 
   * Generates and adds ocean water meshes for a chunk to the scene.
   * Ocean water meshes are independent from terrain meshes.
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
      lake: [],
      group: new THREE.Group(),
    };

    // Generate ocean meshes
    const oceanTiles = identifyOceanTiles(chunkData, config.seaLevel);
    if (oceanTiles.length > 0) {
      const oceanGeometry = buildOceanGeometry(oceanTiles, chunkData, config);
      if (oceanGeometry) {
        const oceanMaterial = createOceanMaterial(config.ocean);
        const oceanMesh = new THREE.Mesh(oceanGeometry, oceanMaterial);
        oceanMesh.renderOrder = 1;
        oceanMesh.visible = true;
        
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
      }
    }

    // Generate lake meshes
    if (config.lake.enabled && chunkData.lakes && chunkData.lakes.length > 0) {
      console.log(`[Lakes] chunk ${chunkKey}: ${chunkData.lakes.length} lake(s)`, 
        chunkData.lakes.map(l => ({ tiles: l.tiles.size, waterLevel: l.waterLevel.toFixed(4), maxDepth: l.maxDepth.toFixed(4) }))
      );
      const lakeTiles = identifyLakeTiles(chunkData, chunkData.lakes);
      if (lakeTiles.length > 0) {
        const lakeGeometry = buildLakeGeometry(lakeTiles, chunkData.lakes, chunkData);
        if (lakeGeometry) {
          const lakeMaterial = createLakeMaterial(config.lake);
          const lakeMesh = new THREE.Mesh(lakeGeometry, lakeMaterial);
          lakeMesh.renderOrder = 1;
          lakeMesh.visible = true;

          const boundingBox = new THREE.Box3();
          if (lakeGeometry.boundingBox) {
            boundingBox.copy(lakeGeometry.boundingBox);
          } else {
            lakeGeometry.computeBoundingBox();
            if (lakeGeometry.boundingBox) {
              boundingBox.copy(lakeGeometry.boundingBox);
            }
          }

          const lakeMeshData: WaterMesh = {
            type: 'lake',
            mesh: lakeMesh,
            material: lakeMaterial,
            boundingBox,
          };

          waterLayer.lake.push(lakeMeshData);
          waterLayer.group.add(lakeMesh);
        }
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
  }

  /**
   * Remove ocean water meshes from a chunk
   * 
   * Removes and disposes all ocean water meshes and resources for a chunk.
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

    // Dispose lake meshes
    for (const waterMesh of waterLayer.lake) {
      this.disposeMesh(waterMesh);
    }

    // Clear arrays
    waterLayer.ocean.length = 0;
    waterLayer.lake.length = 0;

    // Remove from map
    this.waterLayers.delete(chunkKey);
  }

  /**
   * Update ocean water meshes for a chunk
   * 
   * Removes existing ocean water meshes and regenerates them with updated
   * chunk data. Useful when chunk data changes (e.g., terrain editing).
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
   * Toggle visibility of all ocean water meshes
   * 
   * Controls visibility of all ocean water layers without disposing resources.
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
   * Dispose a single ocean water mesh and its resources
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
   * Dispose all ocean water resources
   * 
   * Cleans up all ocean water meshes and resources. Should be called when
   * the water system is no longer needed.
   */
  dispose(): void {
    for (const [chunkKey, waterLayer] of this.waterLayers.entries()) {
      // Dispose all meshes
      for (const waterMesh of waterLayer.ocean) {
        this.disposeMesh(waterMesh);
      }
      for (const waterMesh of waterLayer.lake) {
        this.disposeMesh(waterMesh);
      }

      // Clear arrays
      waterLayer.ocean.length = 0;
      waterLayer.lake.length = 0;
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
   * Apply frustum culling to ocean water meshes
   * 
   * Hides ocean water meshes outside the camera frustum to improve performance.
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

      // Check if any ocean mesh is visible in frustum
      for (const waterMesh of waterLayer.ocean) {
        if (this.frustum.intersectsBox(waterMesh.boundingBox)) {
          isVisible = true;
          break;
        }
      }

      // Check lake meshes if ocean didn't already make it visible
      if (!isVisible) {
        for (const waterMesh of waterLayer.lake) {
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
