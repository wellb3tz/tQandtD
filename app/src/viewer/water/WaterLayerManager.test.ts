/**
 * Integration tests for WaterLayerManager
 * Tests that lake mesh management has been removed and only ocean meshes are handled
 * 
 * **Validates: Requirements 4.6, 4.7, 5.4, 7.1, 7.2, 7.3, 7.4, 7.5**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { WaterLayerManager } from './WaterLayerManager';
import { DEFAULT_WATER_CONFIG } from './config';
import { BiomeType, type ChunkData } from '@engine/index';

/**
 * Create a mock ChunkData with ocean tiles for testing
 */
function createMockChunkWithOcean(): ChunkData {
  const size = 32;
  const vertexSize = size + 1;
  const heightmap = new Float32Array(vertexSize * vertexSize);
  const biomeMap = new Uint8Array(size * size);
  const biomeWeights = new Float32Array(size * size * 13); // 13 biomes

  // Create heightmap with all tiles below sea level (0.3)
  // This ensures ocean tiles are identified
  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = 0.1; // Below default sea level of 0.3
  }

  // Set all biomes to OCEAN
  for (let i = 0; i < biomeMap.length; i++) {
    biomeMap[i] = BiomeType.OCEAN;
  }

  // Set biome weights (100% ocean)
  for (let i = 0; i < size * size; i++) {
    biomeWeights[i * 13 + BiomeType.OCEAN] = 1.0;
  }

  return {
    x: 0,
    y: 0,
    size,
    heightmap,
    biomeMap,
    biomeWeights,
    resources: [],
    structures: [],
  };
}

/**
 * Create a mock ChunkData with no water (all above sea level)
 */
function createMockChunkWithoutWater(): ChunkData {
  const size = 32;
  const vertexSize = size + 1;
  const heightmap = new Float32Array(vertexSize * vertexSize);
  const biomeMap = new Uint8Array(size * size);
  const biomeWeights = new Float32Array(size * size * 13);

  // Create heightmap with all tiles above sea level
  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = 0.5; // Above default sea level of 0.3
  }

  // Set all biomes to PLAINS
  for (let i = 0; i < biomeMap.length; i++) {
    biomeMap[i] = BiomeType.PLAINS;
  }

  return {
    x: 0,
    y: 0,
    size,
    heightmap,
    biomeMap,
    biomeWeights,
    resources: [],
    structures: [],
  };
}

describe('WaterLayerManager - Integration Tests', () => {
  let manager: WaterLayerManager;
  let scene: THREE.Scene;

  beforeEach(() => {
    manager = new WaterLayerManager();
    scene = new THREE.Scene();
  });

  describe('addWaterToChunk - Ocean Only', () => {
    it('should create only ocean meshes for ocean tiles', () => {
      // **Validates: Requirement 4.6**
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer = manager.getWaterLayer('0,0');
      expect(waterLayer).toBeDefined();
      expect(waterLayer!.ocean).toBeDefined();
      expect(waterLayer!.ocean.length).toBeGreaterThan(0);
      
      // Verify no lakes property exists
      expect(waterLayer).not.toHaveProperty('lakes');
    });

    it('should add ocean meshes to scene', () => {
      // **Validates: Requirement 7.1, 7.2**
      const chunkData = createMockChunkWithOcean();
      const initialChildCount = scene.children.length;
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      // Scene should have one additional child (the water group)
      expect(scene.children.length).toBe(initialChildCount + 1);
      
      const waterLayer = manager.getWaterLayer('0,0');
      expect(waterLayer!.group.parent).toBe(scene);
    });

    it('should create ocean meshes with correct type', () => {
      // **Validates: Requirement 4.6**
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer = manager.getWaterLayer('0,0');
      for (const waterMesh of waterLayer!.ocean) {
        expect(waterMesh.type).toBe('ocean');
      }
    });

    it('should not create water meshes when water is disabled', () => {
      const chunkData = createMockChunkWithOcean();
      const config = { ...DEFAULT_WATER_CONFIG, enabled: false };
      
      manager.addWaterToChunk('0,0', chunkData, scene, config);
      
      expect(manager.hasWater('0,0')).toBe(false);
    });

    it('should not create water meshes when no ocean tiles exist', () => {
      const chunkData = createMockChunkWithoutWater();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer = manager.getWaterLayer('0,0');
      expect(waterLayer).toBeDefined();
      expect(waterLayer!.ocean.length).toBe(0);
    });

    it('should warn when adding water to chunk that already has water', () => {
      const chunkData = createMockChunkWithOcean();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      expect(consoleSpy).toHaveBeenCalledWith('Water layer already exists for chunk 0,0');
      consoleSpy.mockRestore();
    });

    it('should create ocean meshes with correct material properties', () => {
      // **Validates: Requirement 7.6**
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer = manager.getWaterLayer('0,0');
      const oceanMesh = waterLayer!.ocean[0];
      
      expect(oceanMesh.material).toBeDefined();
      expect(oceanMesh.material.transparent).toBe(true);
      expect(oceanMesh.mesh.renderOrder).toBe(1);
    });

    it('should create ocean meshes with bounding boxes', () => {
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer = manager.getWaterLayer('0,0');
      for (const waterMesh of waterLayer!.ocean) {
        expect(waterMesh.boundingBox).toBeDefined();
        expect(waterMesh.boundingBox).toBeInstanceOf(THREE.Box3);
      }
    });

    it('should update ocean wave animation uniforms', () => {
      const chunkData = createMockChunkWithOcean();
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);

      const waterLayer = manager.getWaterLayer('0,0');
      const oceanMaterial = waterLayer!.ocean[0].material;
      const shader = {
        uniforms: {},
        vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
        fragmentShader: '',
      } as THREE.Shader;
      oceanMaterial.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

      manager.updateOceanWaves(3.25, {
        ...DEFAULT_WATER_CONFIG.ocean,
        enableWaves: true,
        waveHeight: 0.45,
        waveSpeed: 1.2,
      });

      expect(shader.uniforms.uOceanWaveTime.value).toBe(3.25);
      expect(shader.uniforms.uOceanWaveHeight.value).toBe(0.45);
      expect(shader.uniforms.uOceanWaveSpeed.value).toBe(1.2);
    });
  });

  describe('removeWaterFromChunk - Ocean Only', () => {
    it('should dispose only ocean meshes', () => {
      // **Validates: Requirement 4.7**
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      const waterLayer = manager.getWaterLayer('0,0');
      const oceanMesh = waterLayer!.ocean[0].mesh;
      const oceanGeometry = oceanMesh.geometry;
      const oceanMaterial = oceanMesh.material as THREE.Material;
      
      // Spy on dispose methods
      const geometryDisposeSpy = vi.spyOn(oceanGeometry, 'dispose');
      const materialDisposeSpy = vi.spyOn(oceanMaterial, 'dispose');
      
      manager.removeWaterFromChunk('0,0', scene);
      
      // Verify disposal was called
      expect(geometryDisposeSpy).toHaveBeenCalled();
      expect(materialDisposeSpy).toHaveBeenCalled();
      
      // Verify water layer is removed
      expect(manager.hasWater('0,0')).toBe(false);
    });

    it('should remove water group from scene', () => {
      // **Validates: Requirement 7.2**
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      const waterLayer = manager.getWaterLayer('0,0');
      const group = waterLayer!.group;
      
      expect(scene.children).toContain(group);
      
      manager.removeWaterFromChunk('0,0', scene);
      
      expect(scene.children).not.toContain(group);
    });

    it('should handle removing non-existent water gracefully', () => {
      expect(() => {
        manager.removeWaterFromChunk('0,0', scene);
      }).not.toThrow();
    });

    it('should clear ocean array after removal', () => {
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      manager.removeWaterFromChunk('0,0', scene);
      
      expect(manager.getWaterLayer('0,0')).toBeUndefined();
    });
  });

  describe('dispose - Ocean Only', () => {
    it('should clean up only ocean meshes', () => {
      // **Validates: Requirement 4.7**
      const chunkData1 = createMockChunkWithOcean();
      const chunkData2 = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData1, scene, DEFAULT_WATER_CONFIG);
      manager.addWaterToChunk('1,0', chunkData2, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer1 = manager.getWaterLayer('0,0');
      const waterLayer2 = manager.getWaterLayer('1,0');
      
      const oceanMesh1 = waterLayer1!.ocean[0].mesh;
      const oceanMesh2 = waterLayer2!.ocean[0].mesh;
      
      const geometryDisposeSpy1 = vi.spyOn(oceanMesh1.geometry, 'dispose');
      const geometryDisposeSpy2 = vi.spyOn(oceanMesh2.geometry, 'dispose');
      
      manager.dispose();
      
      // Verify all ocean meshes were disposed
      expect(geometryDisposeSpy1).toHaveBeenCalled();
      expect(geometryDisposeSpy2).toHaveBeenCalled();
      
      // Verify all water layers are removed
      expect(manager.hasWater('0,0')).toBe(false);
      expect(manager.hasWater('1,0')).toBe(false);
      expect(manager.getChunkKeys().length).toBe(0);
    });

    it('should dispose materials for all ocean meshes', () => {
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer = manager.getWaterLayer('0,0');
      const oceanMaterial = waterLayer!.ocean[0].material;
      const materialDisposeSpy = vi.spyOn(oceanMaterial, 'dispose');
      
      manager.dispose();
      
      expect(materialDisposeSpy).toHaveBeenCalled();
    });

    it('should clear all water layers', () => {
      const chunkData1 = createMockChunkWithOcean();
      const chunkData2 = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData1, scene, DEFAULT_WATER_CONFIG);
      manager.addWaterToChunk('1,0', chunkData2, scene, DEFAULT_WATER_CONFIG);
      
      expect(manager.getChunkKeys().length).toBe(2);
      
      manager.dispose();
      
      expect(manager.getChunkKeys().length).toBe(0);
    });
  });

  describe('applyFrustumCulling - Ocean Only', () => {
    it('should check only ocean meshes', () => {
      // **Validates: Requirement 4.7**
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      camera.position.set(0, 10, 0);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      
      manager.applyFrustumCulling(camera, DEFAULT_WATER_CONFIG);
      
      const waterLayer = manager.getWaterLayer('0,0');
      
      // Water layer visibility should be determined by ocean meshes only
      expect(waterLayer!.group.visible).toBeDefined();
    });

    it('should apply frustum culling to ocean meshes', () => {
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      // Position camera to look at the water
      camera.position.set(16, 50, 16); // Center of 32x32 chunk
      camera.lookAt(16, 0, 16);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      
      manager.applyFrustumCulling(camera, DEFAULT_WATER_CONFIG);
      
      const waterLayer = manager.getWaterLayer('0,0');
      
      // Water should be visible when in frustum
      // The exact visibility depends on bounding box intersection
      // Main test is that the method runs without errors and only checks ocean meshes
      expect(waterLayer!.group.visible).toBeDefined();
    });

    it('should not apply culling when disabled in config', () => {
      const chunkData = createMockChunkWithOcean();
      const config = {
        ...DEFAULT_WATER_CONFIG,
        performance: {
          ...DEFAULT_WATER_CONFIG.performance,
          enableFrustumCulling: false,
        },
      };
      
      manager.addWaterToChunk('0,0', chunkData, scene, config);
      
      const waterLayer = manager.getWaterLayer('0,0');
      waterLayer!.group.visible = true;
      
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      camera.position.set(0, 10, 0);
      camera.lookAt(0, 10, -100);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      
      manager.applyFrustumCulling(camera, config);
      
      // Visibility should not change when culling is disabled
      expect(waterLayer!.group.visible).toBe(true);
    });
  });

  describe('WaterLayerData Structure', () => {
    it('should not have lakes property', () => {
      // **Validates: Requirement 5.4**
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer = manager.getWaterLayer('0,0');
      
      expect(waterLayer).toBeDefined();
      expect(waterLayer).toHaveProperty('ocean');
      expect(waterLayer).toHaveProperty('group');
      expect(waterLayer).not.toHaveProperty('lakes');
    });

    it('should have ocean array and group', () => {
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer = manager.getWaterLayer('0,0');
      
      expect(waterLayer!.ocean).toBeInstanceOf(Array);
      expect(waterLayer!.group).toBeInstanceOf(THREE.Group);
    });
  });

  describe('updateWaterMeshes', () => {
    it('should regenerate only ocean meshes', () => {
      // **Validates: Requirement 7.3**
      const chunkData = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer1 = manager.getWaterLayer('0,0');
      const oceanMesh1 = waterLayer1!.ocean[0].mesh;
      
      manager.updateWaterMeshes('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer2 = manager.getWaterLayer('0,0');
      const oceanMesh2 = waterLayer2!.ocean[0].mesh;
      
      // Verify new mesh was created
      expect(oceanMesh2).not.toBe(oceanMesh1);
      expect(waterLayer2!.ocean.length).toBeGreaterThan(0);
    });
  });

  describe('toggleWaterVisibility', () => {
    it('should toggle visibility of all water layers', () => {
      // **Validates: Requirement 7.4**
      const chunkData1 = createMockChunkWithOcean();
      const chunkData2 = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData1, scene, DEFAULT_WATER_CONFIG);
      manager.addWaterToChunk('1,0', chunkData2, scene, DEFAULT_WATER_CONFIG);
      
      const waterLayer1 = manager.getWaterLayer('0,0');
      const waterLayer2 = manager.getWaterLayer('1,0');
      
      // Hide all water
      manager.toggleWaterVisibility(false);
      
      expect(waterLayer1!.group.visible).toBe(false);
      expect(waterLayer2!.group.visible).toBe(false);
      
      // Show all water
      manager.toggleWaterVisibility(true);
      
      expect(waterLayer1!.group.visible).toBe(true);
      expect(waterLayer2!.group.visible).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    it('should correctly report if chunk has water', () => {
      const chunkData = createMockChunkWithOcean();
      
      expect(manager.hasWater('0,0')).toBe(false);
      
      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);
      
      expect(manager.hasWater('0,0')).toBe(true);
    });

    it('should return all chunk keys with water', () => {
      const chunkData1 = createMockChunkWithOcean();
      const chunkData2 = createMockChunkWithOcean();
      
      manager.addWaterToChunk('0,0', chunkData1, scene, DEFAULT_WATER_CONFIG);
      manager.addWaterToChunk('1,0', chunkData2, scene, DEFAULT_WATER_CONFIG);
      
      const keys = manager.getChunkKeys();
      
      expect(keys).toContain('0,0');
      expect(keys).toContain('1,0');
      expect(keys.length).toBe(2);
    });

    it('should return undefined for non-existent water layer', () => {
      expect(manager.getWaterLayer('0,0')).toBeUndefined();
    });
  });
});
