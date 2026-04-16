/**
 * Unit tests for ocean mesh boundary alignment
 * 
 * Validates that ocean water meshes align seamlessly at chunk boundaries
 * to prevent gaps or overlaps in the water surface.
 */

import { describe, it, expect } from 'vitest';
import { identifyOceanTiles, buildOceanGeometry } from './OceanMeshGenerator';
import type { ChunkData } from '../../../../src/world/chunk';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG, HEIGHT_SCALE } from './config';

/**
 * Create a test chunk with specified heightmap
 */
function createTestChunk(
  heightmap: number[],
  size: number,
  x: number,
  y: number
): ChunkData {
  const vertexSize = size + 1;
  const expectedLength = vertexSize * vertexSize;
  
  if (heightmap.length !== expectedLength) {
    throw new Error(`Heightmap must have ${expectedLength} vertices for size ${size}`);
  }

  return {
    x,
    y,
    size,
    heightmap: new Float32Array(heightmap),
    biomeMap: new Uint8Array(size * size),
    biomeWeights: new Float32Array(size * size * 8),
    resources: [],
    structures: [],
    rivers: new Set(),
  };
}

/**
 * Extract vertex positions from geometry in world coordinates
 */
function getWorldVertices(
  geometry: THREE.BufferGeometry,
  chunkX: number,
  chunkY: number,
  chunkSize: number
): Array<{ x: number; y: number; z: number }> {
  const positions = geometry.getAttribute('position');
  const vertices: Array<{ x: number; y: number; z: number }> = [];
  
  for (let i = 0; i < positions.count; i++) {
    const worldX = positions.getX(i);
    const worldY = positions.getY(i);
    const worldZ = positions.getZ(i);
    
    // Geometry already contains world coordinates
    vertices.push({ x: worldX, y: worldY, z: worldZ });
  }
  
  return vertices;
}

/**
 * Find vertices along a specific edge of a chunk
 */
function getEdgeVertices(
  vertices: Array<{ x: number; y: number; z: number }>,
  edge: 'left' | 'right' | 'top' | 'bottom',
  chunkX: number,
  chunkY: number,
  chunkSize: number
): Array<{ x: number; y: number; z: number }> {
  const worldMinX = chunkX * chunkSize;
  const worldMaxX = (chunkX + 1) * chunkSize;
  const worldMinZ = chunkY * chunkSize;
  const worldMaxZ = (chunkY + 1) * chunkSize;
  
  const tolerance = 0.001;
  
  switch (edge) {
    case 'left':
      return vertices.filter(v => Math.abs(v.x - worldMinX) < tolerance);
    case 'right':
      return vertices.filter(v => Math.abs(v.x - worldMaxX) < tolerance);
    case 'top':
      return vertices.filter(v => Math.abs(v.z - worldMinZ) < tolerance);
    case 'bottom':
      return vertices.filter(v => Math.abs(v.z - worldMaxZ) < tolerance);
  }
}

/**
 * Check if two vertices match in world coordinates
 */
function verticesMatch(
  v1: { x: number; y: number; z: number },
  v2: { x: number; y: number; z: number },
  tolerance: number = 0.001
): boolean {
  return (
    Math.abs(v1.x - v2.x) < tolerance &&
    Math.abs(v1.y - v2.y) < tolerance &&
    Math.abs(v1.z - v2.z) < tolerance
  );
}

describe('OceanMeshGenerator - Boundary Alignment', () => {
  const seaLevel = 0.3;
  const waterOffset = 0.1;
  const config: WaterConfig = {
    ...DEFAULT_WATER_CONFIG,
    seaLevel,
    rendering: {
      ...DEFAULT_WATER_CONFIG.rendering,
      waterOffset,
    },
  };

  describe('horizontal boundary alignment', () => {
    it('should align vertices at right edge of left chunk with left edge of right chunk', () => {
      const size = 4;
      
      // Create two horizontally adjacent chunks with ocean
      // All underwater (height 0.1 < seaLevel 0.3)
      const heightmap = new Array((size + 1) * (size + 1)).fill(0.1);
      
      const leftChunk = createTestChunk(heightmap, size, 0, 0);
      const rightChunk = createTestChunk(heightmap, size, 1, 0);
      
      const leftOceanTiles = identifyOceanTiles(leftChunk, seaLevel);
      const rightOceanTiles = identifyOceanTiles(rightChunk, seaLevel);
      
      const leftGeometry = buildOceanGeometry(leftOceanTiles, leftChunk, config);
      const rightGeometry = buildOceanGeometry(rightOceanTiles, rightChunk, config);
      
      expect(leftGeometry).not.toBeNull();
      expect(rightGeometry).not.toBeNull();
      
      if (leftGeometry && rightGeometry) {
        // Get vertices in world coordinates
        const leftVertices = getWorldVertices(leftGeometry, 0, 0, size);
        const rightVertices = getWorldVertices(rightGeometry, 1, 0, size);
        
        // Get edge vertices
        const leftRightEdge = getEdgeVertices(leftVertices, 'right', 0, 0, size);
        const rightLeftEdge = getEdgeVertices(rightVertices, 'left', 1, 0, size);
        
        // Both edges should have vertices
        expect(leftRightEdge.length).toBeGreaterThan(0);
        expect(rightLeftEdge.length).toBeGreaterThan(0);
        
        // Every vertex on the left chunk's right edge should have a matching vertex
        // on the right chunk's left edge
        for (const leftVertex of leftRightEdge) {
          const hasMatch = rightLeftEdge.some(rightVertex =>
            verticesMatch(leftVertex, rightVertex)
          );
          expect(hasMatch).toBe(true);
        }
      }
    });
  });

  describe('vertical boundary alignment', () => {
    it('should align vertices at bottom edge of top chunk with top edge of bottom chunk', () => {
      const size = 4;
      
      // Create two vertically adjacent chunks with ocean
      const heightmap = new Array((size + 1) * (size + 1)).fill(0.1);
      
      const topChunk = createTestChunk(heightmap, size, 0, 0);
      const bottomChunk = createTestChunk(heightmap, size, 0, 1);
      
      const topOceanTiles = identifyOceanTiles(topChunk, seaLevel);
      const bottomOceanTiles = identifyOceanTiles(bottomChunk, seaLevel);
      
      const topGeometry = buildOceanGeometry(topOceanTiles, topChunk, config);
      const bottomGeometry = buildOceanGeometry(bottomOceanTiles, bottomChunk, config);
      
      expect(topGeometry).not.toBeNull();
      expect(bottomGeometry).not.toBeNull();
      
      if (topGeometry && bottomGeometry) {
        // Get vertices in world coordinates
        const topVertices = getWorldVertices(topGeometry, 0, 0, size);
        const bottomVertices = getWorldVertices(bottomGeometry, 0, 1, size);
        
        // Get edge vertices
        const topBottomEdge = getEdgeVertices(topVertices, 'bottom', 0, 0, size);
        const bottomTopEdge = getEdgeVertices(bottomVertices, 'top', 0, 1, size);
        
        // Both edges should have vertices
        expect(topBottomEdge.length).toBeGreaterThan(0);
        expect(bottomTopEdge.length).toBeGreaterThan(0);
        
        // Every vertex on the top chunk's bottom edge should have a matching vertex
        // on the bottom chunk's top edge
        for (const topVertex of topBottomEdge) {
          const hasMatch = bottomTopEdge.some(bottomVertex =>
            verticesMatch(topVertex, bottomVertex)
          );
          expect(hasMatch).toBe(true);
        }
      }
    });
  });

  describe('elevation consistency at boundaries', () => {
    it('should use identical elevation at chunk boundaries', () => {
      const size = 4;
      const heightmap = new Array((size + 1) * (size + 1)).fill(0.1);
      
      const chunk1 = createTestChunk(heightmap, size, 0, 0);
      const chunk2 = createTestChunk(heightmap, size, 1, 0);
      
      const oceanTiles1 = identifyOceanTiles(chunk1, seaLevel);
      const oceanTiles2 = identifyOceanTiles(chunk2, seaLevel);
      
      const geometry1 = buildOceanGeometry(oceanTiles1, chunk1, config);
      const geometry2 = buildOceanGeometry(oceanTiles2, chunk2, config);
      
      expect(geometry1).not.toBeNull();
      expect(geometry2).not.toBeNull();
      
      if (geometry1 && geometry2) {
        const vertices1 = getWorldVertices(geometry1, 0, 0, size);
        const vertices2 = getWorldVertices(geometry2, 1, 0, size);
        
        const edge1 = getEdgeVertices(vertices1, 'right', 0, 0, size);
        const edge2 = getEdgeVertices(vertices2, 'left', 1, 0, size);
        
        const expectedElevation = (seaLevel + waterOffset) * HEIGHT_SCALE;
        
        // All boundary vertices should have the same elevation
        for (const vertex of edge1) {
          expect(vertex.y).toBeCloseTo(expectedElevation);
        }
        
        for (const vertex of edge2) {
          expect(vertex.y).toBeCloseTo(expectedElevation);
        }
      }
    });
  });

  describe('partial ocean coverage at boundaries', () => {
    it('should align boundaries when only some tiles are ocean', () => {
      const size = 4;
      
      // Create heightmap where only right edge tiles are underwater
      // This tests the case where ocean doesn't cover the entire chunk
      const heightmap1 = [
        0.5, 0.5, 0.5, 0.1, 0.1,  // Row 0: only rightmost tiles underwater
        0.5, 0.5, 0.5, 0.1, 0.1,  // Row 1
        0.5, 0.5, 0.5, 0.1, 0.1,  // Row 2
        0.5, 0.5, 0.5, 0.1, 0.1,  // Row 3
        0.5, 0.5, 0.5, 0.1, 0.1,  // Row 4
      ];
      
      // Create heightmap where only left edge tiles are underwater
      const heightmap2 = [
        0.1, 0.1, 0.5, 0.5, 0.5,  // Row 0: only leftmost tiles underwater
        0.1, 0.1, 0.5, 0.5, 0.5,  // Row 1
        0.1, 0.1, 0.5, 0.5, 0.5,  // Row 2
        0.1, 0.1, 0.5, 0.5, 0.5,  // Row 3
        0.1, 0.1, 0.5, 0.5, 0.5,  // Row 4
      ];
      
      const chunk1 = createTestChunk(heightmap1, size, 0, 0);
      const chunk2 = createTestChunk(heightmap2, size, 1, 0);
      
      const oceanTiles1 = identifyOceanTiles(chunk1, seaLevel);
      const oceanTiles2 = identifyOceanTiles(chunk2, seaLevel);
      
      const geometry1 = buildOceanGeometry(oceanTiles1, chunk1, config);
      const geometry2 = buildOceanGeometry(oceanTiles2, chunk2, config);
      
      expect(geometry1).not.toBeNull();
      expect(geometry2).not.toBeNull();
      
      if (geometry1 && geometry2) {
        const vertices1 = getWorldVertices(geometry1, 0, 0, size);
        const vertices2 = getWorldVertices(geometry2, 1, 0, size);
        
        const edge1 = getEdgeVertices(vertices1, 'right', 0, 0, size);
        const edge2 = getEdgeVertices(vertices2, 'left', 1, 0, size);
        
        // Vertices at the boundary should match
        for (const v1 of edge1) {
          const hasMatch = edge2.some(v2 => verticesMatch(v1, v2));
          expect(hasMatch).toBe(true);
        }
      }
    });
  });

  describe('corner alignment', () => {
    it('should align vertices at chunk corners', () => {
      const size = 4;
      const heightmap = new Array((size + 1) * (size + 1)).fill(0.1);
      
      // Create 2x2 grid of chunks
      const chunks = [
        createTestChunk(heightmap, size, 0, 0), // Top-left
        createTestChunk(heightmap, size, 1, 0), // Top-right
        createTestChunk(heightmap, size, 0, 1), // Bottom-left
        createTestChunk(heightmap, size, 1, 1), // Bottom-right
      ];
      
      const geometries = chunks.map((chunk, i) => {
        const oceanTiles = identifyOceanTiles(chunk, seaLevel);
        return buildOceanGeometry(oceanTiles, chunk, config);
      });
      
      // All geometries should exist
      expect(geometries.every(g => g !== null)).toBe(true);
      
      // Get world vertices for all chunks
      const allVertices = geometries.map((geometry, i) => {
        const chunkX = i % 2;
        const chunkY = Math.floor(i / 2);
        return geometry ? getWorldVertices(geometry, chunkX, chunkY, size) : [];
      });
      
      // Check that the corner where all 4 chunks meet has matching vertices
      const cornerX = size; // World coordinate where chunks meet
      const cornerZ = size;
      const expectedY = (seaLevel + waterOffset) * HEIGHT_SCALE;
      const tolerance = 0.001;
      
      // Each chunk should have a vertex at the corner
      const cornerVertices = allVertices.map(vertices =>
        vertices.filter(v =>
          Math.abs(v.x - cornerX) < tolerance &&
          Math.abs(v.z - cornerZ) < tolerance
        )
      );
      
      // All corner vertices should exist and have the same coordinates
      for (const corners of cornerVertices) {
        expect(corners.length).toBeGreaterThan(0);
        for (const corner of corners) {
          expect(corner.x).toBeCloseTo(cornerX);
          expect(corner.y).toBeCloseTo(expectedY);
          expect(corner.z).toBeCloseTo(cornerZ);
        }
      }
    });
  });
});
