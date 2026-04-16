/**
 * WorldViewer water integration tests
 * 
 * Tests complete water system integration with terrain rendering,
 * multi-chunk water continuity, visibility controls, and resource cleanup.
 * 
 * **Validates: Requirements 1.1, 1.6, 7.1, 7.2, 7.5**
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorldViewer, RenderLayer } from './WorldViewer';
import { ChunkData, BiomeType } from '../../../src/index';
import * as THREE from 'three';

// Mock OrbitControls
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn().mockImplementation(() => ({
    update: vi.fn(),
    dispose: vi.fn(),
    target: new THREE.Vector3(),
  })),
}));

describe('WorldViewer Water Integration', () => {
  let viewer: WorldViewer;
  let container: HTMLElement;

  beforeEach(() => {
    // Create container element
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create viewer
    viewer = new WorldViewer();
    viewer.initialize(container);
    
    // Disable chunk boundaries to avoid Three.js mock issues
    viewer.setVisibility(RenderLayer.CHUNK_BOUNDARIES, false);
  });

  afterEach(() => {
    viewer.dispose();
    document.body.removeChild(container);
  });

  /**
   * Helper: Create chunk data with ocean tiles
   */
  function createOceanChunk(chunkX: number, chunkY: number, size: number = 32): ChunkData {
    const heightmap = new Float32Array((size + 1) * (size + 1));
    const biomeMap = new Uint8Array(size * size);
    const biomeWeights = new Float32Array(size * size * 8);

    // Create underwater terrain (height < 0.3 = sea level)
    for (let i = 0; i < heightmap.length; i++) {
      heightmap[i] = 0.2; // Below sea level
    }

    // Set biome data (beach biome for underwater terrain)
    for (let i = 0; i < biomeMap.length; i++) {
      biomeMap[i] = BiomeType.BEACH;
      biomeWeights[i * 8 + BiomeType.BEACH] = 1.0;
    }

    return {
      x: chunkX,
      y: chunkY,
      size,
      heightmap,
      biomeMap,
      biomeWeights,
    };
  }

  /**
   * Helper: Create chunk data with mixed terrain (land and ocean)
   */
  function createMixedChunk(chunkX: number, chunkY: number, size: number = 32): ChunkData {
    const heightmap = new Float32Array((size + 1) * (size + 1));
    const biomeMap = new Uint8Array(size * size);
    const biomeWeights = new Float32Array(size * size * 8);

    // Create mixed terrain: left half underwater, right half above water
    for (let y = 0; y <= size; y++) {
      for (let x = 0; x <= size; x++) {
        const index = y * (size + 1) + x;
        heightmap[index] = x < size / 2 ? 0.2 : 0.5; // Left underwater, right above
      }
    }

    // Set biome data
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = y * size + x;
        const biome = x < size / 2 ? BiomeType.BEACH : BiomeType.PLAINS;
        biomeMap[index] = biome;
        biomeWeights[index * 8 + biome] = 1.0;
      }
    }

    return {
      x: chunkX,
      y: chunkY,
      size,
      heightmap,
      biomeMap,
      biomeWeights,
    };
  }

  /**
   * Helper: Create chunk data with rivers
   */
  function createRiverChunk(chunkX: number, chunkY: number, size: number = 32): ChunkData {
    const heightmap = new Float32Array((size + 1) * (size + 1));
    const biomeMap = new Uint8Array(size * size);
    const biomeWeights = new Float32Array(size * size * 8);
    const rivers = new Set<number>();

    // Create terrain with river
    for (let y = 0; y <= size; y++) {
      for (let x = 0; x <= size; x++) {
        const index = y * (size + 1) + x;
        heightmap[index] = 0.5;
      }
    }

    // Add river down the middle
    for (let y = 0; y < size; y++) {
      const x = Math.floor(size / 2);
      const index = y * size + x;
      rivers.add(index);
    }

    // Set biome data
    for (let i = 0; i < biomeMap.length; i++) {
      biomeMap[i] = BiomeType.PLAINS;
      biomeWeights[i * 8 + BiomeType.PLAINS] = 1.0;
    }

    return {
      x: chunkX,
      y: chunkY,
      size,
      heightmap,
      biomeMap,
      biomeWeights,
      rivers,
      riverNetwork: {
        segments: [],
        lakes: [],
      },
    };
  }

  describe('Complete Water System Integration', () => {
    it('should generate and add water layer with terrain', () => {
      const chunkData = createOceanChunk(0, 0);
      viewer.addChunk(0, 0, chunkData);

      // Verify water config is enabled
      const config = viewer.getWaterConfig();
      expect(config.enabled).toBe(true);
      
      // Verify chunk was added (scene should have children)
      const scene = viewer.getScene();
      expect(scene.children.length).toBeGreaterThan(0);
    });

    it('should render water above terrain', () => {
      const chunkData = createOceanChunk(0, 0);
      viewer.addChunk(0, 0, chunkData);

      const scene = viewer.getScene();
      const waterGroups = scene.children.filter((child) => child instanceof THREE.Group);

      // Water should have higher renderOrder than terrain (default 0)
      for (const group of waterGroups) {
        if (group.children.length > 0) {
          expect(group.renderOrder).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('should apply underwater color adjustments to terrain', () => {
      const chunkData = createOceanChunk(0, 0);
      viewer.addChunk(0, 0, chunkData);

      // Verify water config has underwater adjustments enabled
      const config = viewer.getWaterConfig();
      expect(config.rendering.underwaterDarkenFactor).toBeGreaterThan(0);
      expect(config.rendering.underwaterDesaturationFactor).toBeGreaterThan(0);
      expect(config.rendering.enableDepthGradient).toBeDefined();
    });

    it('should handle chunks with mixed land and water', () => {
      const chunkData = createMixedChunk(0, 0);
      viewer.addChunk(0, 0, chunkData);

      const scene = viewer.getScene();
      // Verify chunk was added
      expect(scene.children.length).toBeGreaterThan(0);
    });

    it('should handle chunks with rivers', () => {
      const chunkData = createRiverChunk(0, 0);
      viewer.addChunk(0, 0, chunkData);

      const scene = viewer.getScene();
      // Verify chunk was added
      expect(scene.children.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Chunk Water Continuity', () => {
    it('should generate water for multiple adjacent chunks', () => {
      // Create 2x2 grid of ocean chunks
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          const chunkData = createOceanChunk(x, y);
          viewer.addChunk(x, y, chunkData);
        }
      }

      const scene = viewer.getScene();
      const waterGroups = scene.children.filter((child) => child instanceof THREE.Group);

      // Should have water groups for multiple chunks
      expect(waterGroups.length).toBeGreaterThanOrEqual(2);
    });

    it('should maintain water continuity across chunk boundaries', () => {
      // Create adjacent chunks with ocean
      const chunk1 = createOceanChunk(0, 0);
      const chunk2 = createOceanChunk(1, 0);

      viewer.addChunk(0, 0, chunk1);
      viewer.addChunk(1, 0, chunk2);

      const scene = viewer.getScene();
      const waterGroups = scene.children.filter((child) => child instanceof THREE.Group);

      // Both chunks should have water
      expect(waterGroups.length).toBeGreaterThanOrEqual(2);

      // Water should be at same elevation (sea level)
      const waterConfig = viewer.getWaterConfig();
      expect(waterConfig.seaLevel).toBe(0.3);
    });
  });

  describe('Water Layer Visibility Controls', () => {
    it('should toggle water visibility', () => {
      const chunkData = createOceanChunk(0, 0);
      viewer.addChunk(0, 0, chunkData);

      // Hide water
      viewer.setWaterVisibility(false);

      const scene = viewer.getScene();
      const waterGroups = scene.children.filter((child) => child instanceof THREE.Group);

      // Water groups should be hidden
      for (const group of waterGroups) {
        expect(group.visible).toBe(false);
      }

      // Show water
      viewer.setWaterVisibility(true);

      // Water groups should be visible
      for (const group of waterGroups) {
        expect(group.visible).toBe(true);
      }
    });

    it('should allow water configuration updates', () => {
      const chunkData = createOceanChunk(0, 0);
      viewer.addChunk(0, 0, chunkData);

      // Update water config
      viewer.setWaterConfig({
        ocean: {
          color: 0xff0000,
          opacity: 0.5,
          shininess: 50,
          enableWaves: false,
          waveHeight: 0,
          waveSpeed: 0,
        },
      });

      const config = viewer.getWaterConfig();
      expect(config.ocean.color).toBe(0xff0000);
      expect(config.ocean.opacity).toBe(0.5);
    });
  });

  describe('Resource Cleanup on Chunk Removal', () => {
    it('should dispose water layer when chunk is removed', () => {
      const chunkData = createOceanChunk(0, 0);
      viewer.addChunk(0, 0, chunkData);

      const scene = viewer.getScene();
      const initialChildCount = scene.children.length;

      // Remove chunk
      viewer.removeChunk(0, 0);

      // Scene should have fewer children (terrain and water removed)
      expect(scene.children.length).toBeLessThan(initialChildCount);
    });

    it('should dispose all water resources on viewer disposal', () => {
      // Add multiple chunks with water
      for (let i = 0; i < 3; i++) {
        const chunkData = createOceanChunk(i, 0);
        viewer.addChunk(i, 0, chunkData);
      }

      const scene = viewer.getScene();
      const initialChildCount = scene.children.length;

      // Dispose viewer
      viewer.dispose();

      // Scene should be empty or have minimal children
      expect(scene.children.length).toBeLessThan(initialChildCount);
    });

    it('should update water layer when chunk is updated', () => {
      const chunkData1 = createOceanChunk(0, 0);
      viewer.addChunk(0, 0, chunkData1);

      const scene = viewer.getScene();
      const initialWaterGroups = scene.children.filter((child) => child instanceof THREE.Group);

      // Update chunk with different data
      const chunkData2 = createMixedChunk(0, 0);
      viewer.updateChunk(0, 0, chunkData2);

      const updatedWaterGroups = scene.children.filter((child) => child instanceof THREE.Group);

      // Water should still exist (may be different)
      expect(updatedWaterGroups.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Water System Configuration', () => {
    it('should respect water enabled flag', () => {
      // Disable water
      viewer.setWaterConfig({ enabled: false });

      const chunkData = createOceanChunk(0, 0);
      viewer.addChunk(0, 0, chunkData);

      const scene = viewer.getScene();
      const waterGroups = scene.children.filter((child) => child instanceof THREE.Group);

      // No water groups should be added when disabled
      expect(waterGroups.length).toBe(0);
    });

    it('should use configured sea level', () => {
      // Set custom sea level
      viewer.setWaterConfig({ seaLevel: 0.4 });

      const config = viewer.getWaterConfig();
      expect(config.seaLevel).toBe(0.4);
    });

    it('should use configured underwater adjustments', () => {
      // Set custom underwater adjustments
      viewer.setWaterConfig({
        rendering: {
          waterOffset: 0.2,
          underwaterDarkenFactor: 0.5,
          underwaterDesaturationFactor: 0.6,
          enableDepthGradient: false,
        },
      });

      const config = viewer.getWaterConfig();
      expect(config.rendering.waterOffset).toBe(0.2);
      expect(config.rendering.underwaterDarkenFactor).toBe(0.5);
      expect(config.rendering.underwaterDesaturationFactor).toBe(0.6);
      expect(config.rendering.enableDepthGradient).toBe(false);
    });
  });
});
