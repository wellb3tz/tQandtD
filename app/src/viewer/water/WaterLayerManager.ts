/**
 * Water layer manager for managing ocean water mesh lifecycle
 * 
 * Coordinates ocean water mesh generation and manages water meshes 
 * independently from terrain. Handles adding, removing, updating,
 * and visibility control for ocean water layers.
 */

import * as THREE from 'three';
import type { ChunkData } from '@engine/index';
import type { OceanConfig, WaterConfig, WaterLayerData, WaterMesh } from './types';
import { identifyOceanTiles, buildOceanGeometry } from './OceanMeshGenerator';
import { identifyLakeTiles, buildLakeGeometry, createLakeMaterial } from './LakeMeshGenerator';
import { buildRiverGeometry, createRiverMaterial } from './RiverMeshGenerator';
import { createOceanMaterial, updateOceanMaterialWaves } from './WaterMaterialFactory';

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
      river: [],
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

    // Generate river meshes
    if (config.river.enabled && chunkData.rivers && chunkData.rivers.length > 0) {
      const riverGeometry = buildRiverGeometry(chunkData.rivers, chunkData.x, chunkData.y, chunkData.size, config.seaLevel);
      if (riverGeometry) {
        const riverMaterial = createRiverMaterial(config.river);
        const riverMesh = new THREE.Mesh(riverGeometry, riverMaterial);
        riverMesh.renderOrder = 2;
        riverMesh.visible = true;

        const boundingBox = new THREE.Box3();
        if (riverGeometry.boundingBox) {
          boundingBox.copy(riverGeometry.boundingBox);
        } else {
          riverGeometry.computeBoundingBox();
          if (riverGeometry.boundingBox) {
            boundingBox.copy(riverGeometry.boundingBox);
          }
        }

        const riverMeshData: WaterMesh = {
          type: 'river',
          mesh: riverMesh,
          material: riverMaterial,
          boundingBox,
        };

        waterLayer.river.push(riverMeshData);
        waterLayer.group.add(riverMesh);
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

    // Dispose river meshes
    for (const waterMesh of waterLayer.river) {
      this.disposeMesh(waterMesh);
    }

    // Clear arrays
    waterLayer.ocean.length = 0;
    waterLayer.lake.length = 0;
    waterLayer.river.length = 0;

    // Remove from map
    this.waterLayers.delete(chunkKey);
  }

  /**
   * Update ocean water meshes for a chunk
   * 
   * Removes existing ocean water meshes and regenerates them with updated
   * chunk data. Useful when generation settings or loaded world data change.
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
   * Stitch coincident water vertices between two chunks. Lake geometry is built
   * per chunk, so a multi-chunk lake can otherwise show a tiny vertical crack
   * when neighbouring meshes derive their surface height independently.
   */
  stitchWaterBoundaryHeights(chunkKey: string, neighborKey: string, chunkSize: number): void {
    const layerA = this.waterLayers.get(chunkKey);
    const layerB = this.waterLayers.get(neighborKey);
    if (!layerA || !layerB) {
      return;
    }

    const meshesA = [...layerA.lake];
    const meshesB = [...layerB.lake];
    if (meshesA.length === 0 || meshesB.length === 0) {
      return;
    }

    const [chunkAX, chunkAY] = chunkKey.split(',').map(Number);
    const [chunkBX, chunkBY] = neighborKey.split(',').map(Number);
    const dx = chunkBX - chunkAX;
    const dz = chunkBY - chunkAY;

    if (Math.abs(dx) > 1 || Math.abs(dz) > 1 || (dx === 0 && dz === 0)) {
      return;
    }

    const shared = this.getSharedWaterBoundary(chunkAX, chunkAY, dx, dz, chunkSize);
    if (!shared) {
      return;
    }

    let changedA = false;
    let changedB = false;

    for (const waterA of meshesA) {
      const posA = waterA.mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!posA) continue;

      const aBoundary = this.collectWaterBoundaryVertices(posA, shared);
      if (aBoundary.size === 0) continue;

      for (const waterB of meshesB) {
        const posB = waterB.mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!posB) continue;

        const bBoundary = this.collectWaterBoundaryVertices(posB, shared);
        if (bBoundary.size === 0) continue;

        for (const [key, indicesA] of aBoundary.entries()) {
          const matches = bBoundary.get(key);
          if (!matches) continue;

          for (const i of indicesA) {
            for (const j of matches) {
              const sharedY = (posA.getY(i) + posB.getY(j)) * 0.5;
              if (Math.abs(posA.getY(i) - sharedY) > 0.001) {
                posA.setY(i, sharedY);
                changedA = true;
              }
              if (Math.abs(posB.getY(j) - sharedY) > 0.001) {
                posB.setY(j, sharedY);
                changedB = true;
              }
            }
          }
        }
      }

      if (changedA) {
        posA.needsUpdate = true;
        waterA.mesh.geometry.computeBoundingBox();
        waterA.mesh.geometry.computeBoundingSphere();
        if (waterA.mesh.geometry.boundingBox) {
          waterA.boundingBox.copy(waterA.mesh.geometry.boundingBox);
        }
      }
    }

    if (changedB) {
      for (const waterB of meshesB) {
        const posB = waterB.mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!posB) continue;
        posB.needsUpdate = true;
        waterB.mesh.geometry.computeBoundingBox();
        waterB.mesh.geometry.computeBoundingSphere();
        if (waterB.mesh.geometry.boundingBox) {
          waterB.boundingBox.copy(waterB.mesh.geometry.boundingBox);
        }
      }
    }
  }

  private waterVertexKey(x: number, z: number): string {
    return `${Math.round(x * 1000)},${Math.round(z * 1000)}`;
  }

  private getSharedWaterBoundary(
    chunkX: number,
    chunkY: number,
    dx: number,
    dz: number,
    chunkSize: number
  ): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
    const baseX = chunkX * chunkSize;
    const baseZ = chunkY * chunkSize;

    if (dx === 1 && dz === 0) {
      const x = baseX + chunkSize;
      return { minX: x, maxX: x, minZ: baseZ, maxZ: baseZ + chunkSize };
    }
    if (dx === -1 && dz === 0) {
      const x = baseX;
      return { minX: x, maxX: x, minZ: baseZ, maxZ: baseZ + chunkSize };
    }
    if (dx === 0 && dz === 1) {
      const z = baseZ + chunkSize;
      return { minX: baseX, maxX: baseX + chunkSize, minZ: z, maxZ: z };
    }
    if (dx === 0 && dz === -1) {
      const z = baseZ;
      return { minX: baseX, maxX: baseX + chunkSize, minZ: z, maxZ: z };
    }

    const x = baseX + (dx > 0 ? chunkSize : 0);
    const z = baseZ + (dz > 0 ? chunkSize : 0);
    return { minX: x, maxX: x, minZ: z, maxZ: z };
  }

  private collectWaterBoundaryVertices(
    position: THREE.BufferAttribute,
    boundary: { minX: number; maxX: number; minZ: number; maxZ: number }
  ): Map<string, number[]> {
    const result = new Map<string, number[]>();
    const epsilon = 0.001;

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      if (
        x < boundary.minX - epsilon ||
        x > boundary.maxX + epsilon ||
        z < boundary.minZ - epsilon ||
        z > boundary.maxZ + epsilon
      ) {
        continue;
      }

      const key = this.waterVertexKey(x, z);
      const bucket = result.get(key);
      if (bucket) {
        bucket.push(i);
      } else {
        result.set(key, [i]);
      }
    }

    return result;
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
   * Advance animated ocean materials for all loaded chunks.
   */
  updateOceanWaves(elapsedSeconds: number, config: OceanConfig): void {
    for (const waterLayer of this.waterLayers.values()) {
      for (const waterMesh of waterLayer.ocean) {
        updateOceanMaterialWaves(waterMesh.material, config, elapsedSeconds);
      }
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
      for (const waterMesh of waterLayer.river) {
        this.disposeMesh(waterMesh);
      }

      // Clear arrays
      waterLayer.ocean.length = 0;
      waterLayer.lake.length = 0;
      waterLayer.river.length = 0;
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

      if (!isVisible) {
        for (const waterMesh of waterLayer.river) {
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
