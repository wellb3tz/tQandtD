/**
 * Unit tests for WaterLayerManager
 * 
 * Tests water mesh lifecycle management including adding, removing,
 * updating, visibility control, and resource disposal.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { WaterLayerManager } from './WaterLayerManager';
import type { ChunkData } from '../../../../src/world/chunk';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG } from './config';

// Mock chunk data factory
function createMockChunkData(
  x: number,
  y: number,
  hasOcean = true,
  hasRivers = false,
  hasLakes = false
): ChunkData {
  const size = 32;
  const vertexSize = size + 1;
  const heightmap = new Float32Array(vertexSize * vertexSize);

  // Create heightmap with ocean tiles if requested
  if (hasOcean) {
    // Make bottom half underwater (height < 0.3)
    for (let i = 0; i < heightmap.length; i++) {
      const y = Math.floor(i / vertexSize);
      heightmap[i] = y < vertexSize / 2 ? 0.2 : 0.5;
    }
  } else {
    // All above water
    heightmap.fill(0.5);
  }

  const chunkData: ChunkData = {
    x,
    y,
    size,
    heightmap,
    seed: 12345,
  };

  // Add river network if requested
  if (hasRivers || hasLakes) {
    chunkData.riverNetwork = {
      segments: hasRivers ? [
        { index: 100, flow: 5, width: 1.5, order: 1, next: 101 },
        { index: 101, flow: 5, width: 1.5, order: 1, next: -1 },
      ] : [],
      lakes: hasLakes ? [
        {
          tiles: new Set([200, 201, 232, 233]),
          elevation: 0.4,
          outlet: 200,
        },
      ] : [],
    };
  }

  return chunkData;
}

describe('WaterLayerManager', () => {
  let manager: WaterLayerManager;
  let scene: THREE.Scene;
  let config: WaterConfig;

  beforeEach(() => {
    manager = new WaterLayerManager();
    scene = new THREE.Scene();
    config = { ...DEFAULT_WATER_CONFIG };
  });

  describe('addWaterToChunk', () => {
    it('should add ocean water meshes to chunk', () => {
      const chunkData = createMockChunkData(0, 0, true, false, false);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);

      expect(manager.hasWater(chunkKey)).toBe(true);
      const waterLayer = manager.getWaterLayer(chunkKey);
      expect(waterLayer).toBeDefined();
      expect(waterLayer!.ocean.length).toBeGreaterThan(0);
      expect(waterLayer!.rivers.length).toBe(0);
      expect(waterLayer!.lakes.length).toBe(0);
      expect(scene.children).toContain(waterLayer!.group);
    });

    it('should add river water meshes to chunk', () => {
      const chunkData = createMockChunkData(0, 0, false, true, false);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);

      const waterLayer = manager.getWaterLayer(chunkKey);
      expect(waterLayer).toBeDefined();
      expect(waterLayer!.rivers.length).toBeGreaterThan(0);
      expect(waterLayer!.ocean.length).toBe(0);
      expect(waterLayer!.lakes.length).toBe(0);
    });

    it('should add lake water meshes to chunk', () => {
      const chunkData = createMockChunkData(0, 0, false, false, true);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);

      const waterLayer = manager.getWaterLayer(chunkKey);
      expect(waterLayer).toBeDefined();
      expect(waterLayer!.lakes.length).toBeGreaterThan(0);
      expect(waterLayer!.ocean.length).toBe(0);
      expect(waterLayer!.rivers.length).toBe(0);
    });

    it('should add all water types to chunk', () => {
      const chunkData = createMockChunkData(0, 0, true, true, true);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);

      const waterLayer = manager.getWaterLayer(chunkKey);
      expect(waterLayer).toBeDefined();
      expect(waterLayer!.ocean.length).toBeGreaterThan(0);
      expect(waterLayer!.rivers.length).toBeGreaterThan(0);
      expect(waterLayer!.lakes.length).toBeGreaterThan(0);
    });

    it('should position water group at origin (world coordinates in geometry)', () => {
      const chunkData = createMockChunkData(2, 3, true, false, false);
      const chunkKey = '2,3';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);

      const waterLayer = manager.getWaterLayer(chunkKey);
      // After fix: water group is at origin because geometry uses world coordinates
      expect(waterLayer!.group.position.x).toBe(0);
      expect(waterLayer!.group.position.z).toBe(0);
    });

    it('should not add water when disabled in config', () => {
      const chunkData = createMockChunkData(0, 0, true, false, false);
      const chunkKey = '0,0';
      config.enabled = false;

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);

      expect(manager.hasWater(chunkKey)).toBe(false);
      expect(scene.children.length).toBe(0);
    });

    it('should warn when adding water to existing chunk', () => {
      const chunkData = createMockChunkData(0, 0, true, false, false);
      const chunkKey = '0,0';
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);
      manager.addWaterToChunk(chunkKey, chunkData, scene, config);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Water layer already exists')
      );
      consoleSpy.mockRestore();
    });

    it('should handle chunk with no water features', () => {
      const chunkData = createMockChunkData(0, 0, false, false, false);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);

      const waterLayer = manager.getWaterLayer(chunkKey);
      expect(waterLayer).toBeDefined();
      expect(waterLayer!.ocean.length).toBe(0);
      expect(waterLayer!.rivers.length).toBe(0);
      expect(waterLayer!.lakes.length).toBe(0);
    });
  });

  describe('removeWaterFromChunk', () => {
    it('should remove water meshes from chunk', () => {
      const chunkData = createMockChunkData(0, 0, true, true, true);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);
      expect(manager.hasWater(chunkKey)).toBe(true);
      expect(scene.children.length).toBe(1);

      manager.removeWaterFromChunk(chunkKey, scene);

      expect(manager.hasWater(chunkKey)).toBe(false);
      expect(scene.children.length).toBe(0);
    });

    it('should dispose water mesh resources', () => {
      const chunkData = createMockChunkData(0, 0, true, false, false);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);
      const waterLayer = manager.getWaterLayer(chunkKey);
      const oceanMesh = waterLayer!.ocean[0];
      
      const geometryDisposeSpy = vi.spyOn(oceanMesh.mesh.geometry, 'dispose');
      const materialDisposeSpy = vi.spyOn(oceanMesh.material, 'dispose');

      manager.removeWaterFromChunk(chunkKey, scene);

      expect(geometryDisposeSpy).toHaveBeenCalled();
      expect(materialDisposeSpy).toHaveBeenCalled();
    });

    it('should handle removing non-existent chunk gracefully', () => {
      expect(() => {
        manager.removeWaterFromChunk('999,999', scene);
      }).not.toThrow();
    });

    it('should not affect terrain when removing water', () => {
      const chunkData = createMockChunkData(0, 0, true, false, false);
      const chunkKey = '0,0';

      // Add a terrain mesh to scene
      const terrainMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(32, 32),
        new THREE.MeshBasicMaterial()
      );
      scene.add(terrainMesh);

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);
      expect(scene.children.length).toBe(2); // terrain + water

      manager.removeWaterFromChunk(chunkKey, scene);

      expect(scene.children.length).toBe(1); // only terrain remains
      expect(scene.children).toContain(terrainMesh);
    });
  });

  describe('updateWaterMeshes', () => {
    it('should update water meshes with new chunk data', () => {
      const chunkData1 = createMockChunkData(0, 0, true, false, false);
      const chunkData2 = createMockChunkData(0, 0, false, true, false);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData1, scene, config);
      let waterLayer = manager.getWaterLayer(chunkKey);
      expect(waterLayer!.ocean.length).toBeGreaterThan(0);
      expect(waterLayer!.rivers.length).toBe(0);

      manager.updateWaterMeshes(chunkKey, chunkData2, scene, config);
      waterLayer = manager.getWaterLayer(chunkKey);
      expect(waterLayer!.ocean.length).toBe(0);
      expect(waterLayer!.rivers.length).toBeGreaterThan(0);
    });

    it('should dispose old meshes when updating', () => {
      const chunkData1 = createMockChunkData(0, 0, true, false, false);
      const chunkData2 = createMockChunkData(0, 0, true, false, false);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData1, scene, config);
      const oldWaterLayer = manager.getWaterLayer(chunkKey);
      const oldOceanMesh = oldWaterLayer!.ocean[0];
      
      const geometryDisposeSpy = vi.spyOn(oldOceanMesh.mesh.geometry, 'dispose');
      const materialDisposeSpy = vi.spyOn(oldOceanMesh.material, 'dispose');

      manager.updateWaterMeshes(chunkKey, chunkData2, scene, config);

      expect(geometryDisposeSpy).toHaveBeenCalled();
      expect(materialDisposeSpy).toHaveBeenCalled();
    });

    it('should handle updating non-existent chunk', () => {
      const chunkData = createMockChunkData(0, 0, true, false, false);
      const chunkKey = '0,0';

      expect(() => {
        manager.updateWaterMeshes(chunkKey, chunkData, scene, config);
      }).not.toThrow();

      expect(manager.hasWater(chunkKey)).toBe(true);
    });
  });

  describe('toggleWaterVisibility', () => {
    it('should hide all water meshes', () => {
      const chunkData1 = createMockChunkData(0, 0, true, false, false);
      const chunkData2 = createMockChunkData(1, 0, true, false, false);

      manager.addWaterToChunk('0,0', chunkData1, scene, config);
      manager.addWaterToChunk('1,0', chunkData2, scene, config);

      manager.toggleWaterVisibility(false);

      const waterLayer1 = manager.getWaterLayer('0,0');
      const waterLayer2 = manager.getWaterLayer('1,0');
      expect(waterLayer1!.group.visible).toBe(false);
      expect(waterLayer2!.group.visible).toBe(false);
    });

    it('should show all water meshes', () => {
      const chunkData1 = createMockChunkData(0, 0, true, false, false);
      const chunkData2 = createMockChunkData(1, 0, true, false, false);

      manager.addWaterToChunk('0,0', chunkData1, scene, config);
      manager.addWaterToChunk('1,0', chunkData2, scene, config);

      manager.toggleWaterVisibility(false);
      manager.toggleWaterVisibility(true);

      const waterLayer1 = manager.getWaterLayer('0,0');
      const waterLayer2 = manager.getWaterLayer('1,0');
      expect(waterLayer1!.group.visible).toBe(true);
      expect(waterLayer2!.group.visible).toBe(true);
    });

    it('should not dispose resources when toggling visibility', () => {
      const chunkData = createMockChunkData(0, 0, true, false, false);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);
      const waterLayer = manager.getWaterLayer(chunkKey);
      const oceanMesh = waterLayer!.ocean[0];
      
      const geometryDisposeSpy = vi.spyOn(oceanMesh.mesh.geometry, 'dispose');
      const materialDisposeSpy = vi.spyOn(oceanMesh.material, 'dispose');

      manager.toggleWaterVisibility(false);
      manager.toggleWaterVisibility(true);

      expect(geometryDisposeSpy).not.toHaveBeenCalled();
      expect(materialDisposeSpy).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose all water resources', () => {
      const chunkData1 = createMockChunkData(0, 0, true, true, true);
      const chunkData2 = createMockChunkData(1, 0, true, false, false);

      manager.addWaterToChunk('0,0', chunkData1, scene, config);
      manager.addWaterToChunk('1,0', chunkData2, scene, config);

      expect(manager.getChunkKeys().length).toBe(2);

      manager.dispose();

      expect(manager.getChunkKeys().length).toBe(0);
      expect(manager.hasWater('0,0')).toBe(false);
      expect(manager.hasWater('1,0')).toBe(false);
    });

    it('should dispose all mesh resources', () => {
      const chunkData = createMockChunkData(0, 0, true, true, true);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);
      const waterLayer = manager.getWaterLayer(chunkKey);
      
      const disposeSpy = vi.fn();
      for (const waterMesh of waterLayer!.ocean) {
        vi.spyOn(waterMesh.mesh.geometry, 'dispose').mockImplementation(disposeSpy);
        vi.spyOn(waterMesh.material, 'dispose').mockImplementation(disposeSpy);
      }
      for (const waterMesh of waterLayer!.rivers) {
        vi.spyOn(waterMesh.mesh.geometry, 'dispose').mockImplementation(disposeSpy);
        vi.spyOn(waterMesh.material, 'dispose').mockImplementation(disposeSpy);
      }
      for (const waterMesh of waterLayer!.lakes) {
        vi.spyOn(waterMesh.mesh.geometry, 'dispose').mockImplementation(disposeSpy);
        vi.spyOn(waterMesh.material, 'dispose').mockImplementation(disposeSpy);
      }

      manager.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should get water layer data', () => {
      const chunkData = createMockChunkData(0, 0, true, false, false);
      const chunkKey = '0,0';

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);
      const waterLayer = manager.getWaterLayer(chunkKey);

      expect(waterLayer).toBeDefined();
      expect(waterLayer!.ocean.length).toBeGreaterThan(0);
    });

    it('should return undefined for non-existent chunk', () => {
      const waterLayer = manager.getWaterLayer('999,999');
      expect(waterLayer).toBeUndefined();
    });

    it('should check if chunk has water', () => {
      const chunkData = createMockChunkData(0, 0, true, false, false);
      const chunkKey = '0,0';

      expect(manager.hasWater(chunkKey)).toBe(false);

      manager.addWaterToChunk(chunkKey, chunkData, scene, config);
      expect(manager.hasWater(chunkKey)).toBe(true);

      manager.removeWaterFromChunk(chunkKey, scene);
      expect(manager.hasWater(chunkKey)).toBe(false);
    });

    it('should get all chunk keys', () => {
      const chunkData1 = createMockChunkData(0, 0, true, false, false);
      const chunkData2 = createMockChunkData(1, 0, true, false, false);
      const chunkData3 = createMockChunkData(0, 1, true, false, false);

      manager.addWaterToChunk('0,0', chunkData1, scene, config);
      manager.addWaterToChunk('1,0', chunkData2, scene, config);
      manager.addWaterToChunk('0,1', chunkData3, scene, config);

      const keys = manager.getChunkKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('0,0');
      expect(keys).toContain('1,0');
      expect(keys).toContain('0,1');
    });
  });
});
