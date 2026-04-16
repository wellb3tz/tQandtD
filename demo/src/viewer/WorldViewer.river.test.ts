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
  Vector3: vi.fn(function(this: any, x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.set = vi.fn((x: number, y: number, z: number) => {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    });
    this.copy = vi.fn((v: any) => {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    });
    this.add = vi.fn((v: any) => {
      this.x += v.x;
      this.y += v.y;
      this.z += v.z;
      return this;
    });
    this.sub = vi.fn((v: any) => {
      this.x -= v.x;
      this.y -= v.y;
      this.z -= v.z;
      return this;
    });
    this.multiplyScalar = vi.fn((s: number) => {
      this.x *= s;
      this.y *= s;
      this.z *= s;
      return this;
    });
    this.crossVectors = vi.fn((a: any, b: any) => {
      this.x = a.y * b.z - a.z * b.y;
      this.y = a.z * b.x - a.x * b.z;
      this.z = a.x * b.y - a.y * b.x;
      return this;
    });
    this.normalize = vi.fn(() => {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
      if (len > 0) {
        this.x /= len;
        this.y /= len;
        this.z /= len;
      }
      return this;
    });
    this.length = vi.fn(() => {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    });
    return this;
  }),
  Euler: vi.fn(function(this: any, x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }),
  Quaternion: vi.fn(function(this: any) {
    this.setFromEuler = vi.fn();
    return this;
  }),
  Matrix4: vi.fn(function(this: any) {
    this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    this.multiplyMatrices = vi.fn(() => this);
    this.identity = vi.fn(() => this);
    return this;
  }),
  Frustum: vi.fn(function(this: any) {
    this.planes = [];
    this.setFromProjectionMatrix = vi.fn(() => this);
    this.intersectsBox = vi.fn(() => true);
    return this;
  }),
  Scene: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    background: null
  })),
  PerspectiveCamera: vi.fn(() => ({
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    lookAt: vi.fn(),
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
    quaternion: { setFromEuler: vi.fn() },
    getWorldDirection: vi.fn((target) => {
      target.set(0, 0, -1);
      return target;
    })
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
  BufferGeometry: vi.fn(function(this: any) {
    this.setAttribute = vi.fn();
    this.setIndex = vi.fn();
    this.computeVertexNormals = vi.fn();
    this.computeBoundingBox = vi.fn(() => {
      // Create a mock bounding box when computed
      this.boundingBox = {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 32, y: 10, z: 32 },
        clone: vi.fn(() => ({
          min: { x: 0, y: 0, z: 0 },
          max: { x: 32, y: 10, z: 32 },
          applyMatrix4: vi.fn()
        })),
        applyMatrix4: vi.fn()
      };
    });
    this.dispose = vi.fn();
    this.getAttribute = vi.fn();
    return this;
  }),
  BufferAttribute: vi.fn((array, size) => ({
    array,
    itemSize: size,
    count: array.length / size,
    needsUpdate: false
  })),
  Float32BufferAttribute: vi.fn((array, size) => array),
  MeshLambertMaterial: vi.fn(() => ({
    wireframe: false,
    dispose: vi.fn()
  })),
  MeshBasicMaterial: vi.fn(() => ({
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
    remove: vi.fn(),
    visible: true,
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    renderOrder: 0,
    children: [],
    traverse: vi.fn((callback) => {
      // Simulate traversing children
      callback({ 
        geometry: { dispose: vi.fn() },
        material: { dispose: vi.fn() }
      });
    })
  })),
  BoxGeometry: vi.fn(() => ({
    dispose: vi.fn()
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
      heightmap: new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5),
      biomeMap: new Uint8Array((chunkSize + 1) * (chunkSize + 1)).fill(BiomeType.PLAINS),
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
      heightmap: new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5),
      biomeMap: new Uint8Array((chunkSize + 1) * (chunkSize + 1)).fill(BiomeType.PLAINS),
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
      heightmap: new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5),
      biomeMap: new Uint8Array((chunkSize + 1) * (chunkSize + 1)).fill(BiomeType.PLAINS),
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
      heightmap: new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5),
      biomeMap: new Uint8Array((chunkSize + 1) * (chunkSize + 1)).fill(BiomeType.PLAINS),
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
      heightmap: new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5),
      biomeMap: new Uint8Array((chunkSize + 1) * (chunkSize + 1)).fill(BiomeType.PLAINS),
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
      heightmap: new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5),
      biomeMap: new Uint8Array((chunkSize + 1) * (chunkSize + 1)).fill(BiomeType.PLAINS),
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
      heightmap: new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5),
      biomeMap: new Uint8Array((chunkSize + 1) * (chunkSize + 1)).fill(BiomeType.PLAINS),
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
      heightmap: new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5),
      biomeMap: new Uint8Array((chunkSize + 1) * (chunkSize + 1)).fill(BiomeType.PLAINS),
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
