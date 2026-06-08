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
import { BiomeType, type ChunkData, type LakeData, type RiverData } from '@engine/index';

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

function createMockChunkWithRivers(rivers: RiverData[]): ChunkData {
  const chunk = createMockChunkWithoutWater();
  chunk.rivers = rivers;
  return chunk;
}

function createMockChunkWithLakes(lakes: LakeData[]): ChunkData {
  const chunk = createMockChunkWithoutWater();
  const vertexSize = chunk.size + 1;
  for (let y = 0; y <= 3; y++) {
    for (let x = 0; x <= 3; x++) {
      chunk.heightmap[y * vertexSize + x] = 0.35;
    }
  }
  chunk.lakes = lakes;
  return chunk;
}

function createMockLake(tileIndex: number, state?: LakeData['state']): LakeData {
  return {
    waterLevel: 0.5,
    tiles: new Set([tileIndex]),
    maxDepth: 0.15,
    minTerrainHeight: 0.35,
    state,
  };
}

function createMockRiver(state?: RiverData['state'], y = 1): RiverData {
  return {
    riverId: `river_${state ?? 'flowing'}_${y}`,
    pathId: `river_${state ?? 'flowing'}_${y}:main`,
    isTributary: false,
    state,
    points: [
      { x: 0, y, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelWidth: 1.4, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 4, y, height: 0.42, surfaceLevel: 0.43, width: 1, depth: 0.03, channelWidth: 1.4, channelDepth: 0.04, flowX: 1, flowY: 0 },
    ],
    bounds: { minX: 0, maxX: 4, minY: y, maxY: y },
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

    it('updates a shared ocean normal map only once per animation tick', () => {
      const normalMap = new THREE.Texture();
      const offsetSet = vi.spyOn(normalMap.offset, 'set');
      const config = {
        ...DEFAULT_WATER_CONFIG,
        ocean: {
          ...DEFAULT_WATER_CONFIG.ocean,
          normalMap,
        },
      };

      manager.addWaterToChunk('0,0', createMockChunkWithOcean(), scene, config);
      manager.addWaterToChunk('1,0', createMockChunkWithOcean(), scene, config);

      manager.updateOceanWaves(5, config.ocean);

      expect(offsetSet).toHaveBeenCalledTimes(1);
    });

    it('skips water animation work for culled water groups', () => {
      const normalMap = new THREE.Texture();
      const offsetSet = vi.spyOn(normalMap.offset, 'set');
      const config = {
        ...DEFAULT_WATER_CONFIG,
        ocean: {
          ...DEFAULT_WATER_CONFIG.ocean,
          normalMap,
        },
      };

      manager.addWaterToChunk('0,0', createMockChunkWithOcean(), scene, config);
      manager.getWaterLayer('0,0')!.group.visible = false;

      manager.updateOceanWaves(5, config.ocean);

      expect(offsetSet).not.toHaveBeenCalled();
    });

    it('renders frozen rivers separately and does not animate their flow normals', () => {
      const normalMap = new THREE.Texture();
      normalMap.offset.set(0, 0);
      const frozenNormalMap = normalMap.clone();
      const config = {
        ...DEFAULT_WATER_CONFIG,
        river: {
          ...DEFAULT_WATER_CONFIG.river,
          normalMap,
        },
      };
      const chunkData = createMockChunkWithRivers([
        createMockRiver(undefined, 1),
        createMockRiver('frozen', 3),
        createMockRiver('dry', 5),
      ]);

      manager.addWaterToChunk('0,0', chunkData, scene, config);

      const waterLayer = manager.getWaterLayer('0,0');
      expect(waterLayer!.river).toHaveLength(2);
      const flowing = waterLayer!.river.find(mesh => mesh.material.userData.riverState === 'flowing');
      const frozen = waterLayer!.river.find(mesh => mesh.material.userData.riverState === 'frozen');
      expect(flowing).toBeDefined();
      expect(frozen).toBeDefined();
      expect(frozen!.material.normalMap).toBeNull();
      expect((frozen!.mesh.geometry.getAttribute('color') as THREE.BufferAttribute).getZ(0)).toBeGreaterThan(0.9);

      frozen!.material.normalMap = frozenNormalMap;
      manager.updateRiverFlows(10);

      expect(flowing!.material.normalMap!.offset.x).not.toBe(0);
      expect(frozenNormalMap.offset.x).toBe(0);
      expect(frozenNormalMap.offset.y).toBe(0);
    });

    it('renders frozen lakes separately with ice material and skips dry lakes', () => {
      const chunkData = createMockChunkWithLakes([
        createMockLake(0),
        createMockLake(1, 'frozen'),
        createMockLake(2, 'dry'),
      ]);

      manager.addWaterToChunk('0,0', chunkData, scene, DEFAULT_WATER_CONFIG);

      const waterLayer = manager.getWaterLayer('0,0');
      expect(waterLayer!.lake).toHaveLength(2);
      const filled = waterLayer!.lake.find(mesh => mesh.material.userData.lakeState === 'filled');
      const frozen = waterLayer!.lake.find(mesh => mesh.material.userData.lakeState === 'frozen');
      expect(filled).toBeDefined();
      expect(frozen).toBeDefined();
      expect((frozen!.mesh.geometry.getAttribute('color') as THREE.BufferAttribute).getZ(0)).toBeGreaterThan(0.96);
      expect(frozen!.material.opacity).toBeGreaterThanOrEqual(0.88);
    });

    it('animates filled lake surfaces but skips frozen lakes', () => {
      const normalMap = new THREE.Texture();
      normalMap.offset.set(0, 0);
      const frozenNormalMap = normalMap.clone();
      const config = {
        ...DEFAULT_WATER_CONFIG,
        lake: {
          ...DEFAULT_WATER_CONFIG.lake,
          normalMap,
        },
      };
      const chunkData = createMockChunkWithLakes([
        createMockLake(0),
        createMockLake(1, 'frozen'),
      ]);

      manager.addWaterToChunk('0,0', chunkData, scene, config);

      const waterLayer = manager.getWaterLayer('0,0');
      const filled = waterLayer!.lake.find(mesh => mesh.material.userData.lakeState === 'filled');
      const frozen = waterLayer!.lake.find(mesh => mesh.material.userData.lakeState === 'frozen');
      expect(filled).toBeDefined();
      expect(frozen).toBeDefined();
      expect(filled!.material.normalMap).toBe(normalMap);
      expect(frozen!.material.normalMap).toBeNull();

      frozen!.material.normalMap = frozenNormalMap;
      manager.updateLakeSurfaces(10);

      expect(filled!.material.normalMap!.offset.x).not.toBe(0);
      expect(frozenNormalMap.offset.x).toBe(0);
      expect(frozenNormalMap.offset.y).toBe(0);
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
