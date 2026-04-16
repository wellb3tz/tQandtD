/**
 * Property-based tests for WaterLayerManager
 * 
 * **Feature: comprehensive-water-system, Property 2: Water Mesh Independence**
 * 
 * Validates that water meshes are generated independently from terrain meshes
 * such that water can be added, removed, or updated without regenerating terrain.
 * 
 * **Validates: Requirements 1.1, 7.2, 7.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import * as fc from 'fast-check';
import { WaterLayerManager } from './WaterLayerManager';
import type { ChunkData } from '../../../../src/world/chunk';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG } from './config';

// Arbitrary chunk data generator
function arbitraryChunkData(): fc.Arbitrary<ChunkData> {
  return fc.record({
    x: fc.integer({ min: -10, max: 10 }),
    y: fc.integer({ min: -10, max: 10 }),
    size: fc.constant(32),
    seed: fc.integer({ min: 0, max: 999999 }),
  }).chain(({ x, y, size, seed }) => {
    const vertexSize = size + 1;
    
    return fc.record({
      x: fc.constant(x),
      y: fc.constant(y),
      size: fc.constant(size),
      seed: fc.constant(seed),
      heightmap: fc.array(
        fc.float({ min: Math.fround(0), max: Math.fround(1) }),
        { minLength: vertexSize * vertexSize, maxLength: vertexSize * vertexSize }
      ).map(arr => new Float32Array(arr)),
      riverNetwork: fc.option(
        fc.record({
          segments: fc.array(
            fc.record({
              index: fc.integer({ min: 0, max: size * size - 1 }),
              flow: fc.float({ min: Math.fround(1), max: Math.fround(10) }),
              width: fc.float({ min: Math.fround(0.5), max: Math.fround(3) }),
              order: fc.integer({ min: 1, max: 5 }),
              next: fc.integer({ min: -1, max: size * size - 1 }),
            }),
            { maxLength: 10 }
          ),
          lakes: fc.array(
            fc.record({
              tiles: fc.array(
                fc.integer({ min: 0, max: size * size - 1 }),
                { minLength: 1, maxLength: 10 }
              ).map(arr => new Set(arr)),
              elevation: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8) }),
              outlet: fc.integer({ min: 0, max: size * size - 1 }),
            }),
            { maxLength: 3 }
          ),
        }),
        { nil: undefined }
      ),
    });
  });
}

// Create a mock terrain mesh for testing independence
function createTerrainMesh(chunkData: ChunkData): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(chunkData.size, chunkData.size);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(chunkData.x * chunkData.size, 0, chunkData.y * chunkData.size);
  return mesh;
}

// Check if terrain mesh is unchanged
function isTerrainMeshUnchanged(
  originalMesh: THREE.Mesh,
  currentMesh: THREE.Mesh
): boolean {
  // Check geometry reference (should be same object)
  if (originalMesh.geometry !== currentMesh.geometry) {
    return false;
  }

  // Check material reference (should be same object)
  if (originalMesh.material !== currentMesh.material) {
    return false;
  }

  // Check position
  if (!originalMesh.position.equals(currentMesh.position)) {
    return false;
  }

  return true;
}

describe('WaterLayerManager - Property 2: Water Mesh Independence', () => {
  let manager: WaterLayerManager;
  let scene: THREE.Scene;
  let config: WaterConfig;

  beforeEach(() => {
    manager = new WaterLayerManager();
    scene = new THREE.Scene();
    config = { ...DEFAULT_WATER_CONFIG };
  });

  it('Property 2: Water meshes are generated independently from terrain meshes', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        (chunkData) => {
          const chunkKey = `${chunkData.x},${chunkData.y}`;
          
          // Create terrain mesh
          const terrainMesh = createTerrainMesh(chunkData);
          scene.add(terrainMesh);
          
          // Store original terrain state
          const originalGeometry = terrainMesh.geometry;
          const originalMaterial = terrainMesh.material;
          const originalPosition = terrainMesh.position.clone();
          
          // Add water to chunk
          manager.addWaterToChunk(chunkKey, chunkData, scene, config);
          
          // Verify terrain mesh is unchanged after adding water
          const terrainUnchangedAfterAdd = 
            terrainMesh.geometry === originalGeometry &&
            terrainMesh.material === originalMaterial &&
            terrainMesh.position.equals(originalPosition);
          
          // Verify water was added (if applicable)
          const hasWater = manager.hasWater(chunkKey);
          
          // Remove water from chunk
          manager.removeWaterFromChunk(chunkKey, scene);
          
          // Verify terrain mesh is still unchanged after removing water
          const terrainUnchangedAfterRemove = 
            terrainMesh.geometry === originalGeometry &&
            terrainMesh.material === originalMaterial &&
            terrainMesh.position.equals(originalPosition);
          
          // Cleanup
          scene.remove(terrainMesh);
          terrainMesh.geometry.dispose();
          (terrainMesh.material as THREE.Material).dispose();
          
          // Water operations should not affect terrain
          return terrainUnchangedAfterAdd && terrainUnchangedAfterRemove;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Water can be added without regenerating terrain', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        (chunkData) => {
          const chunkKey = `${chunkData.x},${chunkData.y}`;
          
          // Create and add terrain mesh
          const terrainMesh = createTerrainMesh(chunkData);
          scene.add(terrainMesh);
          
          // Track if terrain geometry/material dispose is called
          let terrainDisposed = false;
          const originalDispose = terrainMesh.geometry.dispose.bind(terrainMesh.geometry);
          terrainMesh.geometry.dispose = () => {
            terrainDisposed = true;
            originalDispose();
          };
          
          // Add water
          manager.addWaterToChunk(chunkKey, chunkData, scene, config);
          
          // Terrain should not be disposed when adding water
          const terrainNotDisposed = !terrainDisposed;
          
          // Cleanup
          manager.removeWaterFromChunk(chunkKey, scene);
          scene.remove(terrainMesh);
          originalDispose();
          (terrainMesh.material as THREE.Material).dispose();
          
          return terrainNotDisposed;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Water can be removed without affecting terrain', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        (chunkData) => {
          const chunkKey = `${chunkData.x},${chunkData.y}`;
          
          // Create terrain and water
          const terrainMesh = createTerrainMesh(chunkData);
          scene.add(terrainMesh);
          manager.addWaterToChunk(chunkKey, chunkData, scene, config);
          
          // Store terrain state before removing water
          const terrainInSceneBeforeRemove = scene.children.includes(terrainMesh);
          const geometryBefore = terrainMesh.geometry;
          const materialBefore = terrainMesh.material;
          
          // Remove water
          manager.removeWaterFromChunk(chunkKey, scene);
          
          // Verify terrain is still in scene and unchanged
          const terrainInSceneAfterRemove = scene.children.includes(terrainMesh);
          const geometryAfter = terrainMesh.geometry;
          const materialAfter = terrainMesh.material;
          
          const terrainUnaffected = 
            terrainInSceneBeforeRemove &&
            terrainInSceneAfterRemove &&
            geometryBefore === geometryAfter &&
            materialBefore === materialAfter;
          
          // Cleanup
          scene.remove(terrainMesh);
          terrainMesh.geometry.dispose();
          (terrainMesh.material as THREE.Material).dispose();
          
          return terrainUnaffected;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Water can be updated without regenerating terrain', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        arbitraryChunkData(),
        (chunkData1, chunkData2) => {
          // Use same chunk coordinates for both
          const chunkKey = `${chunkData1.x},${chunkData1.y}`;
          chunkData2.x = chunkData1.x;
          chunkData2.y = chunkData1.y;
          
          // Create terrain and initial water
          const terrainMesh = createTerrainMesh(chunkData1);
          scene.add(terrainMesh);
          manager.addWaterToChunk(chunkKey, chunkData1, scene, config);
          
          // Store terrain state
          const geometryBefore = terrainMesh.geometry;
          const materialBefore = terrainMesh.material;
          const positionBefore = terrainMesh.position.clone();
          
          // Update water with new chunk data
          manager.updateWaterMeshes(chunkKey, chunkData2, scene, config);
          
          // Verify terrain is unchanged
          const terrainUnchanged = 
            terrainMesh.geometry === geometryBefore &&
            terrainMesh.material === materialBefore &&
            terrainMesh.position.equals(positionBefore) &&
            scene.children.includes(terrainMesh);
          
          // Cleanup
          manager.removeWaterFromChunk(chunkKey, scene);
          scene.remove(terrainMesh);
          terrainMesh.geometry.dispose();
          (terrainMesh.material as THREE.Material).dispose();
          
          return terrainUnchanged;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Multiple chunks can have independent water layers', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryChunkData(), { minLength: 2, maxLength: 5 }),
        (chunkDataArray) => {
          // Ensure unique chunk coordinates
          const uniqueChunks = chunkDataArray.filter((chunk, index, self) => 
            index === self.findIndex(c => c.x === chunk.x && c.y === chunk.y)
          );
          
          if (uniqueChunks.length < 2) {
            return true; // Skip if not enough unique chunks
          }
          
          // Add water to all chunks
          const chunkKeys: string[] = [];
          for (const chunkData of uniqueChunks) {
            const chunkKey = `${chunkData.x},${chunkData.y}`;
            chunkKeys.push(chunkKey);
            manager.addWaterToChunk(chunkKey, chunkData, scene, config);
          }
          
          // Remove water from first chunk
          manager.removeWaterFromChunk(chunkKeys[0], scene);
          
          // Verify first chunk has no water
          const firstChunkNoWater = !manager.hasWater(chunkKeys[0]);
          
          // Verify other chunks still have water (if they had any)
          const otherChunksUnaffected = chunkKeys.slice(1).every(key => {
            // If chunk had water features, it should still have water layer
            const chunkData = uniqueChunks.find(c => `${c.x},${c.y}` === key);
            if (!chunkData) return true;
            
            // Check if chunk should have water
            const hasOcean = Array.from(chunkData.heightmap).some(h => h < config.seaLevel);
            const hasRivers = chunkData.riverNetwork?.segments && chunkData.riverNetwork.segments.length > 0;
            const hasLakes = chunkData.riverNetwork?.lakes && chunkData.riverNetwork.lakes.length > 0;
            
            if (!hasOcean && !hasRivers && !hasLakes) {
              return true; // No water features, so it's fine if no water layer
            }
            
            return manager.hasWater(key);
          });
          
          // Cleanup
          for (const key of chunkKeys) {
            manager.removeWaterFromChunk(key, scene);
          }
          
          return firstChunkNoWater && otherChunksUnaffected;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Water generation is deterministic and independent', () => {
    fc.assert(
      fc.property(
        arbitraryChunkData(),
        (chunkData) => {
          const chunkKey = `${chunkData.x},${chunkData.y}`;
          
          // Generate water twice with same data
          manager.addWaterToChunk(chunkKey, chunkData, scene, config);
          const waterLayer1 = manager.getWaterLayer(chunkKey);
          
          // Count meshes in first generation
          const oceanCount1 = waterLayer1?.ocean.length ?? 0;
          const riverCount1 = waterLayer1?.rivers.length ?? 0;
          const lakeCount1 = waterLayer1?.lakes.length ?? 0;
          
          // Remove and regenerate
          manager.removeWaterFromChunk(chunkKey, scene);
          manager.addWaterToChunk(chunkKey, chunkData, scene, config);
          const waterLayer2 = manager.getWaterLayer(chunkKey);
          
          // Count meshes in second generation
          const oceanCount2 = waterLayer2?.ocean.length ?? 0;
          const riverCount2 = waterLayer2?.rivers.length ?? 0;
          const lakeCount2 = waterLayer2?.lakes.length ?? 0;
          
          // Water generation should be deterministic
          const isDeterministic = 
            oceanCount1 === oceanCount2 &&
            riverCount1 === riverCount2 &&
            lakeCount1 === lakeCount2;
          
          // Cleanup
          manager.removeWaterFromChunk(chunkKey, scene);
          
          return isDeterministic;
        }
      ),
      { numRuns: 100 }
    );
  });
});
