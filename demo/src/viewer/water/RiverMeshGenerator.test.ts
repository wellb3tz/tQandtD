/**
 * Unit tests for RiverMeshGenerator
 */

import { describe, it, expect } from 'vitest';
import { generateRiverMeshes } from './RiverMeshGenerator';
import type { ChunkData } from '../../../../src/world/chunk';
import type { RiverNetwork, RiverSegment } from '../../../../src/gen/rivers';
import { DEFAULT_WATER_CONFIG } from './config';

describe('RiverMeshGenerator', () => {
  // Helper to create test chunk data
  function createTestChunk(size: number = 32): ChunkData {
    const vertexSize = size + 1;
    const heightmap = new Float32Array(vertexSize * vertexSize);
    
    // Create a simple heightmap with varying elevations
    for (let y = 0; y < vertexSize; y++) {
      for (let x = 0; x < vertexSize; x++) {
        const index = y * vertexSize + x;
        heightmap[index] = 0.5 + (y / vertexSize) * 0.3; // Gradual slope
      }
    }

    return {
      x: 0,
      y: 0,
      size,
      heightmap,
      biomes: new Uint8Array(size * size),
      rivers: new Set<number>(),
    };
  }

  // Helper to create test river network
  function createTestRiverNetwork(segments: RiverSegment[]): RiverNetwork {
    const tileToSegment = new Map<number, number>();
    segments.forEach((seg, idx) => {
      tileToSegment.set(seg.index, idx);
    });

    return {
      segments,
      lakes: [],
      tileToSegment,
    };
  }

  describe('generateRiverMeshes', () => {
    it('should return empty array for empty river network', () => {
      const chunk = createTestChunk();
      const network = createTestRiverNetwork([]);
      const config = DEFAULT_WATER_CONFIG;

      const meshes = generateRiverMeshes(chunk, network, config);

      expect(meshes).toEqual([]);
    });

    it('should return empty array for null river network', () => {
      const chunk = createTestChunk();
      const network = null as unknown as RiverNetwork;
      const config = DEFAULT_WATER_CONFIG;

      const meshes = generateRiverMeshes(chunk, network, config);

      expect(meshes).toEqual([]);
    });

    it('should create mesh for single river segment', () => {
      const chunk = createTestChunk();
      const segments: RiverSegment[] = [
        { index: 100, flow: 1.0, width: 1.0, order: 1, next: -1 },
      ];
      const network = createTestRiverNetwork(segments);
      const config = DEFAULT_WATER_CONFIG;

      const meshes = generateRiverMeshes(chunk, network, config);

      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes[0].geometry).toBeDefined();
      expect(meshes[0].material).toBeDefined();
    });

    it('should create mesh for connected river segments', () => {
      const chunk = createTestChunk();
      const segments: RiverSegment[] = [
        { index: 100, flow: 1.0, width: 1.0, order: 1, next: 101 },
        { index: 101, flow: 2.0, width: 1.2, order: 1, next: 102 },
        { index: 102, flow: 3.0, width: 1.4, order: 1, next: -1 },
      ];
      const network = createTestRiverNetwork(segments);
      const config = DEFAULT_WATER_CONFIG;

      const meshes = generateRiverMeshes(chunk, network, config);

      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes[0].geometry).toBeDefined();
      
      // Verify geometry has vertices
      const positions = meshes[0].geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
    });

    it('should create separate meshes for disconnected river paths', () => {
      const chunk = createTestChunk();
      const segments: RiverSegment[] = [
        // First path
        { index: 100, flow: 1.0, width: 1.0, order: 1, next: 101 },
        { index: 101, flow: 2.0, width: 1.2, order: 1, next: -1 },
        // Second path (disconnected)
        { index: 200, flow: 1.0, width: 1.0, order: 1, next: 201 },
        { index: 201, flow: 2.0, width: 1.2, order: 1, next: -1 },
      ];
      const network = createTestRiverNetwork(segments);
      const config = DEFAULT_WATER_CONFIG;

      const meshes = generateRiverMeshes(chunk, network, config);

      // Should create separate meshes for each disconnected path
      expect(meshes.length).toBe(2);
    });

    it('should apply river material configuration', () => {
      const chunk = createTestChunk();
      const segments: RiverSegment[] = [
        { index: 100, flow: 1.0, width: 1.0, order: 1, next: -1 },
      ];
      const network = createTestRiverNetwork(segments);
      const config = {
        ...DEFAULT_WATER_CONFIG,
        river: {
          color: 0xff0000,
          opacity: 0.8,
          shininess: 50,
          enableFlowAnimation: false,
          flowSpeed: 1.0,
        },
      };

      const meshes = generateRiverMeshes(chunk, network, config);

      expect(meshes.length).toBeGreaterThan(0);
      const material = meshes[0].material as any;
      // Check color value (THREE.Color stores as object)
      expect(material.color).toBeDefined();
      expect(material.opacity).toBe(0.8);
      expect(material.shininess).toBe(50);
      expect(material.transparent).toBe(true);
    });

    it('should handle varying river widths', () => {
      const chunk = createTestChunk();
      const segments: RiverSegment[] = [
        { index: 100, flow: 1.0, width: 0.5, order: 1, next: 101 },
        { index: 101, flow: 5.0, width: 2.0, order: 1, next: 102 },
        { index: 102, flow: 10.0, width: 3.5, order: 1, next: -1 },
      ];
      const network = createTestRiverNetwork(segments);
      const config = DEFAULT_WATER_CONFIG;

      const meshes = generateRiverMeshes(chunk, network, config);

      expect(meshes.length).toBeGreaterThan(0);
      
      // Verify geometry was created successfully
      const positions = meshes[0].geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
    });

    it('should position river at terrain height plus water offset', () => {
      const chunk = createTestChunk();
      const segments: RiverSegment[] = [
        { index: 100, flow: 1.0, width: 1.0, order: 1, next: -1 },
      ];
      const network = createTestRiverNetwork(segments);
      const config = DEFAULT_WATER_CONFIG;

      const meshes = generateRiverMeshes(chunk, network, config);

      expect(meshes.length).toBeGreaterThan(0);
      
      // Get position data
      const positions = meshes[0].geometry.getAttribute('position');
      const y = positions.getY(0);
      
      // River should be above terrain (terrain is around 0.5-0.8 * HEIGHT_SCALE = 25-40, water offset is 0.1 * HEIGHT_SCALE = 5)
      // So river elevation should be around 30-45
      expect(y).toBeGreaterThan(25);
      expect(y).toBeLessThan(50);
    });

    it('should create geometry with proper attributes', () => {
      const chunk = createTestChunk();
      const segments: RiverSegment[] = [
        { index: 100, flow: 1.0, width: 1.0, order: 1, next: 101 },
        { index: 101, flow: 2.0, width: 1.2, order: 1, next: -1 },
      ];
      const network = createTestRiverNetwork(segments);
      const config = DEFAULT_WATER_CONFIG;

      const meshes = generateRiverMeshes(chunk, network, config);

      expect(meshes.length).toBeGreaterThan(0);
      const geometry = meshes[0].geometry;
      
      // Verify required attributes exist
      expect(geometry.getAttribute('position')).toBeDefined();
      expect(geometry.getAttribute('normal')).toBeDefined();
      expect(geometry.getAttribute('uv')).toBeDefined();
      expect(geometry.getIndex()).toBeDefined();
      
      // Verify position attribute has data
      const positions = geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
    });

    it('should handle river segments at chunk boundaries', () => {
      const chunk = createTestChunk(32);
      const segments: RiverSegment[] = [
        { index: 0, flow: 1.0, width: 1.0, order: 1, next: 1 },     // Top-left corner
        { index: 31, flow: 1.0, width: 1.0, order: 1, next: -1 },   // Top-right corner
      ];
      const network = createTestRiverNetwork(segments);
      const config = DEFAULT_WATER_CONFIG;

      const meshes = generateRiverMeshes(chunk, network, config);

      // Should handle boundary segments without errors
      expect(meshes.length).toBeGreaterThan(0);
    });
  });
});
