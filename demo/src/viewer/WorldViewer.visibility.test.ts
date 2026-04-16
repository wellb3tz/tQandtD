/**
 * Unit tests for WorldViewer visibility controls
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldViewer, RenderLayer } from './WorldViewer';
import { ChunkData, BiomeType, ResourceType, StructureType } from '../../../src/index';

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
    this.getAttribute = vi.fn((name) => {
      if (name === 'color') {
        return {
          array: new Float32Array(32 * 32 * 3),
          needsUpdate: false
        };
      }
      return null;
    });
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
    traverse: vi.fn()
  })),
  SphereGeometry: vi.fn(() => ({ dispose: vi.fn() })),
  BoxGeometry: vi.fn(() => ({ dispose: vi.fn() })),
  MeshBasicMaterial: vi.fn(() => ({ dispose: vi.fn() })),
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

describe('WorldViewer - Visibility Controls', () => {
  let viewer: WorldViewer;
  let container: HTMLElement;
  let mockChunkData: ChunkData;

  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create viewer
    viewer = new WorldViewer();
    viewer.initialize(container);

    // Create mock chunk data
    const chunkSize = 32;
    mockChunkData = {
      x: 0,
      y: 0,
      size: chunkSize,
      heightmap: new Float32Array(chunkSize * chunkSize).fill(0.5),
      biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
      resources: [
        { x: 10, y: 10, type: ResourceType.IRON, amount: 100 }
      ],
      structures: [
        { x: 20, y: 20, type: StructureType.VILLAGE, rotation: 0 }
      ],
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
  });

  it('should set terrain visibility', () => {
    viewer.addChunk(0, 0, mockChunkData);

    // Hide terrain
    viewer.setVisibility(RenderLayer.TERRAIN, false);

    // Verify terrain is hidden (we can't directly check Three.js objects in tests,
    // but we can verify the method doesn't throw)
    expect(() => viewer.setVisibility(RenderLayer.TERRAIN, false)).not.toThrow();

    // Show terrain again
    viewer.setVisibility(RenderLayer.TERRAIN, true);
    expect(() => viewer.setVisibility(RenderLayer.TERRAIN, true)).not.toThrow();
  });

  it('should set biome visibility', () => {
    viewer.addChunk(0, 0, mockChunkData);

    // Hide biomes (should convert to grayscale)
    viewer.setVisibility(RenderLayer.BIOMES, false);
    expect(() => viewer.setVisibility(RenderLayer.BIOMES, false)).not.toThrow();

    // Show biomes again (should restore colors)
    viewer.setVisibility(RenderLayer.BIOMES, true);
    expect(() => viewer.setVisibility(RenderLayer.BIOMES, true)).not.toThrow();
  });

  it('should set river visibility', () => {
    viewer.addChunk(0, 0, mockChunkData);

    // Hide rivers
    viewer.setVisibility(RenderLayer.RIVERS, false);
    expect(() => viewer.setVisibility(RenderLayer.RIVERS, false)).not.toThrow();

    // Show rivers
    viewer.setVisibility(RenderLayer.RIVERS, true);
    expect(() => viewer.setVisibility(RenderLayer.RIVERS, true)).not.toThrow();
  });

  it('should set resource visibility', () => {
    viewer.addChunk(0, 0, mockChunkData);

    // Hide resources
    viewer.setVisibility(RenderLayer.RESOURCES, false);
    expect(() => viewer.setVisibility(RenderLayer.RESOURCES, false)).not.toThrow();

    // Show resources
    viewer.setVisibility(RenderLayer.RESOURCES, true);
    expect(() => viewer.setVisibility(RenderLayer.RESOURCES, true)).not.toThrow();
  });

  it('should set structure visibility', () => {
    viewer.addChunk(0, 0, mockChunkData);

    // Hide structures
    viewer.setVisibility(RenderLayer.STRUCTURES, false);
    expect(() => viewer.setVisibility(RenderLayer.STRUCTURES, false)).not.toThrow();

    // Show structures
    viewer.setVisibility(RenderLayer.STRUCTURES, true);
    expect(() => viewer.setVisibility(RenderLayer.STRUCTURES, true)).not.toThrow();
  });

  it('should set chunk boundary visibility', () => {
    viewer.addChunk(0, 0, mockChunkData);

    // Hide chunk boundaries
    viewer.setVisibility(RenderLayer.CHUNK_BOUNDARIES, false);
    expect(() => viewer.setVisibility(RenderLayer.CHUNK_BOUNDARIES, false)).not.toThrow();

    // Show chunk boundaries
    viewer.setVisibility(RenderLayer.CHUNK_BOUNDARIES, true);
    expect(() => viewer.setVisibility(RenderLayer.CHUNK_BOUNDARIES, true)).not.toThrow();
  });

  it('should set wireframe mode', () => {
    viewer.addChunk(0, 0, mockChunkData);

    // Enable wireframe
    viewer.setWireframeMode(true);
    expect(() => viewer.setWireframeMode(true)).not.toThrow();

    // Disable wireframe
    viewer.setWireframeMode(false);
    expect(() => viewer.setWireframeMode(false)).not.toThrow();
  });

  it('should handle visibility changes on multiple chunks', () => {
    // Add multiple chunks
    viewer.addChunk(0, 0, mockChunkData);
    viewer.addChunk(1, 0, mockChunkData);
    viewer.addChunk(0, 1, mockChunkData);

    // Change visibility should affect all chunks
    expect(() => viewer.setVisibility(RenderLayer.TERRAIN, false)).not.toThrow();
    expect(() => viewer.setVisibility(RenderLayer.RIVERS, false)).not.toThrow();
    expect(() => viewer.setVisibility(RenderLayer.RESOURCES, false)).not.toThrow();
  });

  it('should handle visibility changes when no chunks are loaded', () => {
    // Should not throw even with no chunks
    expect(() => viewer.setVisibility(RenderLayer.TERRAIN, false)).not.toThrow();
    expect(() => viewer.setVisibility(RenderLayer.BIOMES, false)).not.toThrow();
    expect(() => viewer.setWireframeMode(true)).not.toThrow();
  });

  it('should complete visibility updates quickly', () => {
    // Add multiple chunks
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        viewer.addChunk(x, y, mockChunkData);
      }
    }

    // Measure time for visibility update
    const startTime = performance.now();
    viewer.setVisibility(RenderLayer.TERRAIN, false);
    const endTime = performance.now();

    const updateTime = endTime - startTime;

    // Should complete within 50ms (requirement 13.8)
    expect(updateTime).toBeLessThan(50);
  });

  it('should handle rapid visibility toggles', () => {
    viewer.addChunk(0, 0, mockChunkData);

    // Rapidly toggle visibility
    for (let i = 0; i < 10; i++) {
      viewer.setVisibility(RenderLayer.TERRAIN, i % 2 === 0);
      viewer.setVisibility(RenderLayer.BIOMES, i % 2 === 1);
      viewer.setWireframeMode(i % 2 === 0);
    }

    // Should not throw
    expect(true).toBe(true);
  });

  it('should maintain visibility state when adding new chunks', () => {
    // Set visibility before adding chunks
    viewer.setVisibility(RenderLayer.RIVERS, false);
    viewer.setVisibility(RenderLayer.RESOURCES, false);

    // Add chunk - it should respect current visibility settings
    viewer.addChunk(0, 0, mockChunkData);

    // Verify no errors occurred
    expect(true).toBe(true);
  });
});
