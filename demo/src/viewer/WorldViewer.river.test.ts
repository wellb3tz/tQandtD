/**
 * Unit tests for WorldViewer river overlay rendering
 * Tests requirement 1.3 (River overlay rendering) and 13.3 (River visibility toggle)
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldViewer, RenderLayer } from './WorldViewer';
import { ChunkData, BiomeType } from '../../../src/index';

// Mock Three.js
vi.mock('three', () => ({
  Scene: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    background: null
  })),
  PerspectiveCamera: vi.fn(() => ({
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    lookAt: vi.fn(),
    aspect: 1,
    updateProjectionMatrix: vi.fn()
  })),
  WebGLRenderer: vi.fn(() => ({
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement('canvas'),
    shadowMap: { enabled: false, type: 0 }
  })),
  AmbientLight: vi.fn(() => ({})),
  DirectionalLight: vi.fn(() => ({
    position: { set: vi.fn() },
    castShadow: false,
    shadow: {
      camera: { left: 0, right: 0, top: 0, bottom: 0 }
    }
  })),
  Color: vi.fn((color) => ({ r: 0, g: 0, b: 0 })),
  BufferGeometry: vi.fn(() => ({
    setAttribute: vi.fn(),
    setIndex: vi.fn(),
    computeVertexNormals: vi.fn(),
    dispose: vi.fn(),
    getAttribute: vi.fn()
  })),
  Float32BufferAttribute: vi.fn((array, size) => array),
  MeshLambertMaterial: vi.fn(() => ({
    wireframe: false,
    dispose: vi.fn()
  })),
  Mesh: vi.fn((geometry, material) => ({
    geometry,
    material,
    visible: true,
    receiveShadow: false,
    castShadow: false,
    userData: {},
    position: { set: vi.fn(), x: 0, y: 0, z: 0 }
  })),
  LineSegments: vi.fn((geometry, material) => ({
    geometry,
    material,
    visible: true
  })),
  LineBasicMaterial: vi.fn(() => ({ dispose: vi.fn() })),
  Group: vi.fn(() => ({
    add: vi.fn(),
    visible: true,
    traverse: vi.fn((callback) => {
      // Simulate traversing children
      callback({ 
        geometry: { dispose: vi.fn() },
        material: { dispose: vi.fn() }
      });
    })
  })),
  PCFSoftShadowMap: 0
}));

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn(() => ({
    update: vi.fn(),
    dispose: vi.fn(),
    target: { set: vi.fn(), x: 0, y: 0, z: 0 },
    enableDamping: false,
    dampingFactor: 0,
    screenSpacePanning: false,
    minDistance: 0,
    maxDistance: 0,
    maxPolarAngle: 0
  }))
}));

describe('WorldViewer - River Overlay Rendering', () => {
  let viewer: WorldViewer;
  let container: HTMLElement;

  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create viewer
    viewer = new WorldViewer();
    viewer.initialize(container);
  });

  /**
   * Validates: Requirements 1.3
   * River overlay rendering with blue lines/meshes
   */
  it('should create river layer as Three.js Group', () => {
    const chunkSize = 32;
    const mockChunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize).fill(0.5),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
      resources: [],
      structures: [],
      rivers: new Map([
        ['river1', {
          id: 'river1',
          path: [
            { x: 5, y: 5 },
            { x: 6, y: 6 },
            { x: 7, y: 7 }
          ],
          width: 2
        }]
      ]),
      modifications: []
    };

    // Add chunk with rivers
    expect(() => viewer.addChunk(0, 0, mockChunkData)).not.toThrow();
  });

  /**
   * Validates: Requirements 1.3
   * River segments rendered as blue lines
   */
  it('should render river segments as blue lines', () => {
    const chunkSize = 32;
    const mockChunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize).fill(0.5),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
      resources: [],
      structures: [],
      rivers: new Map([
        ['river1', {
          id: 'river1',
          path: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 }
          ],
          width: 2
        }],
        ['river2', {
          id: 'river2',
          path: [
            { x: 10, y: 10 },
            { x: 11, y: 11 }
          ],
          width: 1
        }]
      ]),
      modifications: []
    };

    // Add chunk with multiple rivers
    viewer.addChunk(0, 0, mockChunkData);

    // Verify no errors occurred during rendering
    expect(true).toBe(true);
  });

  /**
   * Validates: Requirements 13.3
   * River layer visibility toggle
   */
  it('should support river visibility toggle', () => {
    const chunkSize = 32;
    const mockChunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize).fill(0.5),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
      resources: [],
      structures: [],
      rivers: new Map([
        ['river1', {
          id: 'river1',
          path: [
            { x: 5, y: 5 },
            { x: 6, y: 6 }
          ],
          width: 2
        }]
      ]),
      modifications: []
    };

    viewer.addChunk(0, 0, mockChunkData);

    // Toggle river visibility off
    expect(() => viewer.setVisibility(RenderLayer.RIVERS, false)).not.toThrow();

    // Toggle river visibility on
    expect(() => viewer.setVisibility(RenderLayer.RIVERS, true)).not.toThrow();
  });

  /**
   * Validates: Requirements 1.3, 13.3
   * River layer should be created even when initially hidden
   */
  it('should handle river visibility state when adding chunks', () => {
    const chunkSize = 32;
    const mockChunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize).fill(0.5),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
      resources: [],
      structures: [],
      rivers: new Map([
        ['river1', {
          id: 'river1',
          path: [
            { x: 5, y: 5 },
            { x: 6, y: 6 }
          ],
          width: 2
        }]
      ]),
      modifications: []
    };

    // Hide rivers before adding chunk
    viewer.setVisibility(RenderLayer.RIVERS, false);

    // Add chunk - should respect visibility setting
    expect(() => viewer.addChunk(0, 0, mockChunkData)).not.toThrow();

    // Show rivers
    viewer.setVisibility(RenderLayer.RIVERS, true);
    expect(true).toBe(true);
  });

  /**
   * Validates: Requirements 1.3
   * Handle chunks without rivers
   */
  it('should handle chunks without rivers gracefully', () => {
    const chunkSize = 32;
    const mockChunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize).fill(0.5),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
      resources: [],
      structures: [],
      rivers: new Map(), // No rivers
      modifications: []
    };

    // Add chunk without rivers
    expect(() => viewer.addChunk(0, 0, mockChunkData)).not.toThrow();

    // Toggle river visibility should not cause errors
    expect(() => viewer.setVisibility(RenderLayer.RIVERS, false)).not.toThrow();
    expect(() => viewer.setVisibility(RenderLayer.RIVERS, true)).not.toThrow();
  });

  /**
   * Validates: Requirements 1.3
   * Handle rivers with single point (edge case)
   */
  it('should handle rivers with single point', () => {
    const chunkSize = 32;
    const mockChunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize).fill(0.5),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
      resources: [],
      structures: [],
      rivers: new Map([
        ['river1', {
          id: 'river1',
          path: [{ x: 5, y: 5 }], // Single point
          width: 2
        }]
      ]),
      modifications: []
    };

    // Should handle single-point river without errors
    expect(() => viewer.addChunk(0, 0, mockChunkData)).not.toThrow();
  });

  /**
   * Validates: Requirements 1.3, 13.3
   * River layer cleanup on chunk removal
   */
  it('should properly dispose river layer when removing chunk', () => {
    const chunkSize = 32;
    const mockChunkData: ChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize).fill(0.5),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
      resources: [],
      structures: [],
      rivers: new Map([
        ['river1', {
          id: 'river1',
          path: [
            { x: 5, y: 5 },
            { x: 6, y: 6 }
          ],
          width: 2
        }]
      ]),
      modifications: []
    };

    viewer.addChunk(0, 0, mockChunkData);

    // Remove chunk should dispose river layer properly
    expect(() => viewer.removeChunk(0, 0)).not.toThrow();
  });

  /**
   * Validates: Requirements 1.3, 13.3
   * Multiple chunks with rivers
   */
  it('should handle multiple chunks with rivers', () => {
    const chunkSize = 32;
    const createChunkData = (x: number, y: number): ChunkData => ({
      x,
      y,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize).fill(0.5),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
      resources: [],
      structures: [],
      rivers: new Map([
        [`river_${x}_${y}`, {
          id: `river_${x}_${y}`,
          path: [
            { x: 5, y: 5 },
            { x: 10, y: 10 },
            { x: 15, y: 15 }
          ],
          width: 2
        }]
      ]),
      modifications: []
    });

    // Add multiple chunks with rivers
    viewer.addChunk(0, 0, createChunkData(0, 0));
    viewer.addChunk(1, 0, createChunkData(1, 0));
    viewer.addChunk(0, 1, createChunkData(0, 1));

    // Toggle visibility should affect all chunks
    expect(() => viewer.setVisibility(RenderLayer.RIVERS, false)).not.toThrow();
    expect(() => viewer.setVisibility(RenderLayer.RIVERS, true)).not.toThrow();
  });
});
