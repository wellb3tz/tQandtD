/**
 * Unit tests for coordinate conversion utilities
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  worldToScreen,
  screenToNDC,
  raycastTerrain,
  getChunkCoords,
  getChunkBounds,
  isInChunkBounds,
  getChunksInRadius,
  chunkDistance,
  getHeightAtPosition,
  getInterpolatedHeight,
  getNormalAtPosition,
  type Vector3,
  type ChunkCoord,
} from './coordinates';
import type { ChunkData } from '../../../src/index';

// Mock canvas for tests that need it
class MockCanvas {
  width: number = 800;
  height: number = 600;
}

describe('Coordinate Conversion Utilities', () => {
  describe('worldToScreen', () => {
    let camera: THREE.PerspectiveCamera;
    let canvas: MockCanvas;

    beforeEach(() => {
      camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
      camera.position.set(0, 10, 10);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      canvas = new MockCanvas();
    });

    test('converts world origin to screen center', () => {
      const worldPos: Vector3 = { x: 0, y: 0, z: 0 };
      const screenPos = worldToScreen(worldPos, camera, canvas as any);

      // Should be near center of screen
      expect(screenPos.x).toBeGreaterThan(300);
      expect(screenPos.x).toBeLessThan(500);
      expect(screenPos.y).toBeGreaterThan(200);
      expect(screenPos.y).toBeLessThan(400);
    });

    test('handles positions behind camera', () => {
      const worldPos: Vector3 = { x: 0, y: 10, z: 20 };
      const screenPos = worldToScreen(worldPos, camera, canvas as any);

      // Position behind camera should still return coordinates
      expect(typeof screenPos.x).toBe('number');
      expect(typeof screenPos.y).toBe('number');
    });
  });

  describe('screenToNDC', () => {
    let canvas: MockCanvas;

    beforeEach(() => {
      canvas = new MockCanvas();
    });

    test('converts screen center to NDC origin', () => {
      const ndc = screenToNDC(400, 300, canvas as any);
      expect(ndc.x).toBeCloseTo(0, 5);
      expect(ndc.y).toBeCloseTo(0, 5);
    });

    test('converts top-left corner to NDC (-1, 1)', () => {
      const ndc = screenToNDC(0, 0, canvas as any);
      expect(ndc.x).toBeCloseTo(-1, 5);
      expect(ndc.y).toBeCloseTo(1, 5);
    });

    test('converts bottom-right corner to NDC (1, -1)', () => {
      const ndc = screenToNDC(800, 600, canvas as any);
      expect(ndc.x).toBeCloseTo(1, 5);
      expect(ndc.y).toBeCloseTo(-1, 5);
    });
  });

  describe('raycastTerrain', () => {
    let camera: THREE.PerspectiveCamera;
    let canvas: MockCanvas;
    let terrainMesh: THREE.Mesh;

    beforeEach(() => {
      camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
      camera.position.set(16, 50, 16);
      camera.lookAt(16, 0, 16);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      canvas = new MockCanvas();

      // Create simple flat terrain mesh
      const geometry = new THREE.PlaneGeometry(32, 32, 31, 31);
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(16, 0, 16);
      const material = new THREE.MeshBasicMaterial();
      terrainMesh = new THREE.Mesh(geometry, material);
    });

    test('returns hit when raycasting center of screen', () => {
      const hit = raycastTerrain(400, 300, camera, canvas as any, [terrainMesh], 32);
      expect(hit).not.toBeNull();
      expect(hit!.chunkX).toBe(0);
      expect(hit!.chunkY).toBe(0);
    });

    test('returns null when raycasting misses terrain', () => {
      const hit = raycastTerrain(0, 0, camera, canvas as any, [terrainMesh], 32);
      // Top-left corner likely misses the terrain
      expect(hit).toBeNull();
    });

    test('calculates correct chunk coordinates', () => {
      const hit = raycastTerrain(400, 300, camera, canvas as any, [terrainMesh], 32);
      if (hit) {
        expect(hit.chunkX).toBe(0);
        expect(hit.chunkY).toBe(0);
        expect(hit.localX).toBeGreaterThanOrEqual(0);
        expect(hit.localX).toBeLessThan(32);
        expect(hit.localY).toBeGreaterThanOrEqual(0);
        expect(hit.localY).toBeLessThan(32);
      }
    });
  });

  describe('getChunkCoords', () => {
    test('returns (0, 0) for origin', () => {
      const coords = getChunkCoords(0, 0, 32);
      expect(coords.chunkX).toBe(0);
      expect(coords.chunkY).toBe(0);
    });

    test('returns (0, 0) for positions within first chunk', () => {
      const coords = getChunkCoords(15, 20, 32);
      expect(coords.chunkX).toBe(0);
      expect(coords.chunkY).toBe(0);
    });

    test('returns (1, 1) for position in next chunk', () => {
      const coords = getChunkCoords(32, 32, 32);
      expect(coords.chunkX).toBe(1);
      expect(coords.chunkY).toBe(1);
    });

    test('handles negative coordinates', () => {
      const coords = getChunkCoords(-1, -1, 32);
      expect(coords.chunkX).toBe(-1);
      expect(coords.chunkY).toBe(-1);
    });

    test('handles different chunk sizes', () => {
      const coords = getChunkCoords(50, 50, 16);
      expect(coords.chunkX).toBe(3);
      expect(coords.chunkY).toBe(3);
    });
  });

  describe('getChunkBounds', () => {
    test('returns correct bounds for origin chunk', () => {
      const bounds = getChunkBounds(0, 0, 32);
      expect(bounds.minX).toBe(0);
      expect(bounds.minY).toBe(0);
      expect(bounds.maxX).toBe(32);
      expect(bounds.maxY).toBe(32);
    });

    test('returns correct bounds for positive chunk', () => {
      const bounds = getChunkBounds(2, 3, 32);
      expect(bounds.minX).toBe(64);
      expect(bounds.minY).toBe(96);
      expect(bounds.maxX).toBe(96);
      expect(bounds.maxY).toBe(128);
    });

    test('returns correct bounds for negative chunk', () => {
      const bounds = getChunkBounds(-1, -1, 32);
      expect(bounds.minX).toBe(-32);
      expect(bounds.minY).toBe(-32);
      expect(bounds.maxX).toBe(0);
      expect(bounds.maxY).toBe(0);
    });
  });

  describe('isInChunkBounds', () => {
    test('returns true for position within chunk', () => {
      expect(isInChunkBounds(15, 20, 0, 0, 32)).toBe(true);
    });

    test('returns false for position outside chunk', () => {
      expect(isInChunkBounds(50, 50, 0, 0, 32)).toBe(false);
    });

    test('returns true for position at chunk origin', () => {
      expect(isInChunkBounds(0, 0, 0, 0, 32)).toBe(true);
    });

    test('returns false for position at chunk boundary (exclusive)', () => {
      expect(isInChunkBounds(32, 32, 0, 0, 32)).toBe(false);
    });

    test('handles negative chunk coordinates', () => {
      expect(isInChunkBounds(-16, -16, -1, -1, 32)).toBe(true);
      expect(isInChunkBounds(0, 0, -1, -1, 32)).toBe(false);
    });
  });

  describe('getChunksInRadius', () => {
    test('returns single chunk for radius 0', () => {
      const chunks = getChunksInRadius(0, 0, 0);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({ chunkX: 0, chunkY: 0 });
    });

    test('returns 9 chunks for radius 1', () => {
      const chunks = getChunksInRadius(0, 0, 1);
      expect(chunks).toHaveLength(9);
    });

    test('returns 25 chunks for radius 2', () => {
      const chunks = getChunksInRadius(0, 0, 2);
      expect(chunks).toHaveLength(25);
    });

    test('includes center chunk', () => {
      const chunks = getChunksInRadius(5, 5, 1);
      expect(chunks).toContainEqual({ chunkX: 5, chunkY: 5 });
    });

    test('includes all adjacent chunks for radius 1', () => {
      const chunks = getChunksInRadius(0, 0, 1);
      expect(chunks).toContainEqual({ chunkX: -1, chunkY: -1 });
      expect(chunks).toContainEqual({ chunkX: 0, chunkY: -1 });
      expect(chunks).toContainEqual({ chunkX: 1, chunkY: -1 });
      expect(chunks).toContainEqual({ chunkX: -1, chunkY: 0 });
      expect(chunks).toContainEqual({ chunkX: 1, chunkY: 0 });
      expect(chunks).toContainEqual({ chunkX: -1, chunkY: 1 });
      expect(chunks).toContainEqual({ chunkX: 0, chunkY: 1 });
      expect(chunks).toContainEqual({ chunkX: 1, chunkY: 1 });
    });
  });

  describe('chunkDistance', () => {
    test('returns 0 for same chunk', () => {
      const dist = chunkDistance({ chunkX: 0, chunkY: 0 }, { chunkX: 0, chunkY: 0 });
      expect(dist).toBe(0);
    });

    test('returns 1 for adjacent chunks', () => {
      const dist = chunkDistance({ chunkX: 0, chunkY: 0 }, { chunkX: 1, chunkY: 0 });
      expect(dist).toBe(1);
    });

    test('returns 1 for diagonal adjacent chunks (Chebyshev)', () => {
      const dist = chunkDistance({ chunkX: 0, chunkY: 0 }, { chunkX: 1, chunkY: 1 });
      expect(dist).toBe(1);
    });

    test('returns max of x and y differences', () => {
      const dist = chunkDistance({ chunkX: 0, chunkY: 0 }, { chunkX: 3, chunkY: 2 });
      expect(dist).toBe(3);
    });

    test('handles negative coordinates', () => {
      const dist = chunkDistance({ chunkX: -2, chunkY: -3 }, { chunkX: 1, chunkY: 2 });
      expect(dist).toBe(5);
    });
  });

  describe('getHeightAtPosition', () => {
    let chunkData: ChunkData;

    beforeEach(() => {
      // Create mock chunk data
      const size = 4;
      const heightmap = new Float32Array(size * size);
      for (let i = 0; i < heightmap.length; i++) {
        heightmap[i] = i * 0.1;
      }

      chunkData = {
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        rivers: new Map(),
        resources: [],
        structures: [],
        modifications: new Map(),
      };
    });

    test('returns correct height for position in chunk', () => {
      const height = getHeightAtPosition(1, 1, chunkData, 0, 0);
      expect(height).toBeCloseTo(0.5, 5); // index 5 = 1*4 + 1
    });

    test('returns null for position outside chunk', () => {
      const height = getHeightAtPosition(10, 10, chunkData, 0, 0);
      expect(height).toBeNull();
    });

    test('handles position at chunk origin', () => {
      const height = getHeightAtPosition(0, 0, chunkData, 0, 0);
      expect(height).toBeCloseTo(0, 5);
    });

    test('handles position at chunk boundary', () => {
      const height = getHeightAtPosition(3, 3, chunkData, 0, 0);
      expect(height).toBeCloseTo(1.5, 5); // index 15 = 3*4 + 3
    });
  });

  describe('getInterpolatedHeight', () => {
    let chunkData: ChunkData;

    beforeEach(() => {
      // Create mock chunk data with simple gradient
      const size = 4;
      const heightmap = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          heightmap[y * size + x] = x + y;
        }
      }

      chunkData = {
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        rivers: new Map(),
        resources: [],
        structures: [],
        modifications: new Map(),
      };
    });

    test('returns exact height at integer coordinates', () => {
      const height = getInterpolatedHeight(1, 1, chunkData, 0, 0);
      expect(height).toBeCloseTo(2, 5); // 1 + 1
    });

    test('interpolates between samples', () => {
      const height = getInterpolatedHeight(0.5, 0.5, chunkData, 0, 0);
      expect(height).toBeCloseTo(1, 5); // average of 0, 1, 1, 2
    });

    test('returns null for position outside chunk', () => {
      const height = getInterpolatedHeight(10, 10, chunkData, 0, 0);
      expect(height).toBeNull();
    });

    test('handles edge positions correctly', () => {
      const height = getInterpolatedHeight(3, 3, chunkData, 0, 0);
      expect(height).toBeCloseTo(6, 5); // 3 + 3
    });
  });

  describe('getNormalAtPosition', () => {
    let chunkData: ChunkData;

    beforeEach(() => {
      // Create flat chunk data
      const size = 4;
      const heightmap = new Float32Array(size * size);
      heightmap.fill(0.5);

      chunkData = {
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        rivers: new Map(),
        resources: [],
        structures: [],
        modifications: new Map(),
      };
    });

    test('returns upward normal for flat terrain', () => {
      const normal = getNormalAtPosition(1, 1, chunkData, 0, 0);
      expect(normal).not.toBeNull();
      expect(normal!.y).toBeGreaterThan(0.9); // Should point mostly upward
    });

    test('returns null for position outside chunk', () => {
      const normal = getNormalAtPosition(10, 10, chunkData, 0, 0);
      expect(normal).toBeNull();
    });

    test('returns normalized vector', () => {
      const normal = getNormalAtPosition(1, 1, chunkData, 0, 0);
      if (normal) {
        const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
        expect(length).toBeCloseTo(1, 5);
      }
    });

    test('handles edge positions', () => {
      const normal = getNormalAtPosition(0, 0, chunkData, 0, 0);
      expect(normal).not.toBeNull();
    });
  });
});
