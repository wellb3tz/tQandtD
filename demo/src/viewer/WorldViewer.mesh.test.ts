/**
 * Unit tests for WorldViewer mesh generation
 * 
 * Tests terrain geometry creation, normal calculation, biome color mapping,
 * and LOD visualization features.
 * 
 * **Validates: Requirements 1.1, 1.2, 7.3**
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorldViewer } from './WorldViewer';
import { ChunkData } from '../../../src/index';
import { BiomeType } from '../../../src/world/chunk';

// Store geometry data for inspection
let capturedGeometry: {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint16Array | Uint32Array;
} | null = null;

let capturedMaterial: {
  vertexColors: boolean;
  wireframe: boolean;
  transparent: boolean;
  opacity: number;
} | null = null;

let capturedMesh: {
  userData: any;
} | null = null;

// Mock Three.js
vi.mock('three', () => ({
  Scene: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    background: null
  })),
  Euler: vi.fn().mockImplementation((x = 0, y = 0, z = 0, order = 'XYZ') => ({
    x, y, z, order,
    set: vi.fn(function(this: any, nx: number, ny: number, nz: number, norder?: string) {
      this.x = nx;
      this.y = ny;
      this.z = nz;
      if (norder !== undefined) this.order = norder;
      return this;
    })
  })),
  Quaternion: vi.fn().mockImplementation((x = 0, y = 0, z = 0, w = 1) => ({
    x, y, z, w,
    setFromEuler: vi.fn(function(this: any, euler: any) {
      // Simplified quaternion from euler conversion
      const c1 = Math.cos(euler.x / 2);
      const c2 = Math.cos(euler.y / 2);
      const c3 = Math.cos(euler.z / 2);
      const s1 = Math.sin(euler.x / 2);
      const s2 = Math.sin(euler.y / 2);
      const s3 = Math.sin(euler.z / 2);

      if (euler.order === 'XYZ') {
        this.x = s1 * c2 * c3 + c1 * s2 * s3;
        this.y = c1 * s2 * c3 - s1 * c2 * s3;
        this.z = c1 * c2 * s3 + s1 * s2 * c3;
        this.w = c1 * c2 * c3 - s1 * s2 * s3;
      }

      return this;
    })
  })),
  PerspectiveCamera: vi.fn(() => ({
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    quaternion: {
      x: 0, y: 0, z: 0, w: 1,
      setFromEuler: vi.fn()
    },
    lookAt: vi.fn(),
    getWorldDirection: vi.fn((target) => {
      target.set(0, 0, -1);
      return target;
    }),
    aspect: 1,
    updateProjectionMatrix: vi.fn()
  })),
  WebGLRenderer: vi.fn(() => ({
    domElement: document.createElement('canvas'),
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    shadowMap: { enabled: false, type: 0 },
    dispose: vi.fn()
  })),
  AmbientLight: vi.fn(() => ({})),
  DirectionalLight: vi.fn(() => ({
    position: { set: vi.fn() },
    castShadow: false,
    shadow: {
      camera: { left: 0, right: 0, top: 0, bottom: 0 }
    }
  })),
  Color: vi.fn(),
  BufferGeometry: vi.fn(() => {
    const attributes: any = {};
    let indexData: any = null;
    let boundingBox: any = null;
    
    return {
      setAttribute: vi.fn((name: string, attr: any) => {
        attributes[name] = attr;
      }),
      getAttribute: vi.fn((name: string) => attributes[name]),
      setIndex: vi.fn((data: any) => {
        // Store the actual array data
        if (Array.isArray(data)) {
          indexData = { array: new Uint32Array(data), count: data.length };
        } else if (data && data.array) {
          indexData = data;
        } else {
          indexData = { array: data, count: data.length };
        }
      }),
      getIndex: vi.fn(() => indexData),
      computeVertexNormals: vi.fn(() => {
        // Simulate normal computation
        if (attributes.position && !attributes.normal) {
          const count = attributes.position.count;
          const normals = new Float32Array(count * 3);
          // For flat terrain, normals point up (0, 1, 0)
          for (let i = 0; i < count; i++) {
            normals[i * 3] = 0;
            normals[i * 3 + 1] = 1;
            normals[i * 3 + 2] = 0;
          }
          attributes.normal = {
            count,
            array: normals,
            getX: (i: number) => normals[i * 3],
            getY: (i: number) => normals[i * 3 + 1],
            getZ: (i: number) => normals[i * 3 + 2]
          };
        }
      }),
      computeBoundingBox: vi.fn(() => {
        // Create a simple bounding box
        boundingBox = {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 32, y: 10, z: 32 },
          clone: vi.fn(() => ({
            min: { x: 0, y: 0, z: 0 },
            max: { x: 32, y: 10, z: 32 },
            applyMatrix4: vi.fn()
          })),
          applyMatrix4: vi.fn()
        };
      }),
      get boundingBox() {
        return boundingBox;
      },
      dispose: vi.fn()
    };
  }),
  Float32BufferAttribute: vi.fn((array: Float32Array, itemSize: number) => ({
    array,
    count: array.length / itemSize,
    itemSize,
    getX: (i: number) => array[i * itemSize],
    getY: (i: number) => array[i * itemSize + 1],
    getZ: (i: number) => array[i * itemSize + 2],
    needsUpdate: false
  })),
  BufferAttribute: vi.fn((array: Float32Array | Uint16Array | Uint32Array, itemSize: number) => ({
    array,
    count: array.length / itemSize,
    itemSize,
    getX: (i: number) => array[i * itemSize],
    getY: (i: number) => array[i * itemSize + 1],
    getZ: (i: number) => array[i * itemSize + 2],
    needsUpdate: false
  })),
  Mesh: vi.fn((geometry: any, material: any) => {
    // Capture geometry data for inspection
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const colors = geometry.getAttribute('color');
    const index = geometry.getIndex();
    
    if (positions && colors) {
      capturedGeometry = {
        positions: positions.array,
        normals: normals?.array || new Float32Array(0),
        colors: colors.array,
        indices: index?.array || new Uint32Array(0)
      };
    }
    
    capturedMaterial = {
      vertexColors: material.vertexColors,
      wireframe: material.wireframe,
      transparent: material.transparent,
      opacity: material.opacity
    };
    
    const mesh = {
      geometry,
      material,
      receiveShadow: false,
      castShadow: false,
      userData: {},
      visible: true
    };
    
    capturedMesh = mesh;
    
    return mesh;
  }),
  MeshLambertMaterial: vi.fn((params: any = {}) => ({
    vertexColors: params.vertexColors || false,
    wireframe: params.wireframe || false,
    transparent: params.transparent || false,
    opacity: params.opacity !== undefined ? params.opacity : 1,
    dispose: vi.fn()
  })),
  Group: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    traverse: vi.fn(),
    visible: true,
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    renderOrder: 0,
    children: []
  })),
  LineSegments: vi.fn(() => ({
    geometry: { dispose: vi.fn() },
    material: { dispose: vi.fn() },
    visible: true
  })),
  LineBasicMaterial: vi.fn(() => ({
    dispose: vi.fn()
  })),
  SphereGeometry: vi.fn(() => ({
    dispose: vi.fn()
  })),
  BoxGeometry: vi.fn(() => ({
    dispose: vi.fn()
  })),
  MeshBasicMaterial: vi.fn(() => ({
    dispose: vi.fn()
  })),
  PCFSoftShadowMap: 0,
  Vector3: vi.fn(() => ({
    set: vi.fn(function(this: any, x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }),
    add: vi.fn(function(this: any, v: any) {
      this.x += v.x;
      this.y += v.y;
      this.z += v.z;
      return this;
    }),
    sub: vi.fn(function(this: any, v: any) {
      this.x -= v.x;
      this.y -= v.y;
      this.z -= v.z;
      return this;
    }),
    multiplyScalar: vi.fn(function(this: any, s: number) {
      this.x *= s;
      this.y *= s;
      this.z *= s;
      return this;
    }),
    crossVectors: vi.fn(function(this: any, a: any, b: any) {
      const ax = a.x, ay = a.y, az = a.z;
      const bx = b.x, by = b.y, bz = b.z;
      this.x = ay * bz - az * by;
      this.y = az * bx - ax * bz;
      this.z = ax * by - ay * bx;
      return this;
    }),
    normalize: vi.fn(function(this: any) {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
      if (len > 0) {
        this.x /= len;
        this.y /= len;
        this.z /= len;
      }
      return this;
    }),
    length: vi.fn(function(this: any) {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }),
    x: 0,
    y: 0,
    z: 0
  })),
  Frustum: vi.fn(() => ({
    setFromProjectionMatrix: vi.fn(),
    intersectsObject: vi.fn(() => true)
  })),
  Matrix4: vi.fn(() => ({
    multiplyMatrices: vi.fn()
  }))
}));

// Mock OrbitControls
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn(() => ({
    enableDamping: false,
    dampingFactor: 0,
    screenSpacePanning: false,
    minDistance: 0,
    maxDistance: 0,
    maxPolarAngle: 0,
    update: vi.fn(),
    dispose: vi.fn(),
    target: { set: vi.fn(), x: 0, y: 0, z: 0 }
  }))
}));

describe('WorldViewer - Mesh Generation', () => {
  let viewer: WorldViewer;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Reset captured data
    capturedGeometry = null;
    capturedMaterial = null;
    capturedMesh = null;
    
    // Create mock container
    mockContainer = document.createElement('div');
    mockContainer.style.width = '800px';
    mockContainer.style.height = '600px';
    document.body.appendChild(mockContainer);

    viewer = new WorldViewer();
    viewer.initialize(mockContainer);
  });

  afterEach(() => {
    if (viewer) {
      viewer.dispose();
    }
    if (mockContainer && mockContainer.parentElement) {
      mockContainer.parentElement.removeChild(mockContainer);
    }
  });

  describe('Terrain Geometry Creation', () => {
    it('should create correct number of vertices from heightmap', () => {
      const chunkSize = 4;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) vertices for seamless boundaries
      const heightmap = new Float32Array([
        0.0, 0.1, 0.2, 0.3, 0.4,
        0.1, 0.2, 0.3, 0.4, 0.5,
        0.2, 0.3, 0.4, 0.5, 0.6,
        0.3, 0.4, 0.5, 0.6, 0.7,
        0.4, 0.5, 0.6, 0.7, 0.8
      ]);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData);

      // Check captured geometry
      expect(capturedGeometry).not.toBeNull();
      expect(capturedGeometry!.positions.length).toBe((chunkSize + 1) * (chunkSize + 1) * 3);
    });

    it('should create vertices at correct world positions', () => {
      const chunkSize = 3;
      const chunkX = 2;
      const chunkY = 1;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) vertices
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(chunkX, chunkY, chunkData);

      expect(capturedGeometry).not.toBeNull();
      const positions = capturedGeometry!.positions;

      // Check first vertex (0, 0) in chunk
      const worldX = chunkX * chunkSize;
      const worldZ = chunkY * chunkSize;
      const height = 0.5 * 50; // Height scaling factor

      expect(positions[0]).toBe(worldX);
      expect(positions[1]).toBe(height);
      expect(positions[2]).toBe(worldZ);

      // Check last vertex (chunkSize, chunkSize) in chunk (note: chunkSize not chunkSize-1 for seamless boundaries)
      const lastIndex = ((chunkSize + 1) * (chunkSize + 1) - 1) * 3;
      expect(positions[lastIndex]).toBe(worldX + chunkSize);
      expect(positions[lastIndex + 1]).toBe(height);
      expect(positions[lastIndex + 2]).toBe(worldZ + chunkSize);
    });

    it('should scale heightmap values correctly', () => {
      const chunkSize = 2;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array([
        0.0, 0.5, 1.0,
        0.25, 0.75, 0.5,
        0.5, 0.25, 0.0
      ]);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData);

      expect(capturedGeometry).not.toBeNull();
      const positions = capturedGeometry!.positions;

      // Height should be scaled by 50
      expect(positions[1]).toBe(0.0 * 50);
      expect(positions[4]).toBe(0.5 * 50);
      expect(positions[7]).toBe(1.0 * 50);
      expect(positions[10]).toBe(0.25 * 50);
    });

    it('should create correct triangle indices', () => {
      const chunkSize = 3;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) vertices
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData);

      expect(capturedGeometry).not.toBeNull();
      const indices = capturedGeometry!.indices;

      // Number of quads = chunkSize * chunkSize
      // Each quad = 2 triangles = 6 indices
      const expectedIndices = chunkSize * chunkSize * 6;
      expect(indices.length).toBe(expectedIndices);

      // Check first quad indices (top-left quad)
      // Triangle 1: topLeft, bottomLeft, topRight
      // Triangle 2: topRight, bottomLeft, bottomRight
      const verticesPerSide = chunkSize + 1;
      expect(indices[0]).toBe(0); // topLeft
      expect(indices[1]).toBe(verticesPerSide); // bottomLeft
      expect(indices[2]).toBe(1); // topRight
      expect(indices[3]).toBe(1); // topRight
      expect(indices[4]).toBe(verticesPerSide); // bottomLeft
      expect(indices[5]).toBe(verticesPerSide + 1); // bottomRight
    });
  });

  describe('Normal Calculation', () => {
    it('should compute vertex normals for terrain mesh', () => {
      const chunkSize = 3;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) vertices
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData);

      expect(capturedGeometry).not.toBeNull();
      const normals = capturedGeometry!.normals;

      // Should have normals for all vertices (3 components per vertex)
      expect(normals.length).toBe((chunkSize + 1) * (chunkSize + 1) * 3);
    });

    it('should have normalized normal vectors', () => {
      const chunkSize = 3;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 4x4 = 16 values
      const heightmap = new Float32Array([
        0.0, 0.1, 0.2, 0.3,
        0.1, 0.5, 0.3, 0.4,
        0.2, 0.3, 0.4, 0.5,
        0.3, 0.4, 0.5, 0.6
      ]);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData);

      expect(capturedGeometry).not.toBeNull();
      const normals = capturedGeometry!.normals;

      // Check that normals are normalized (length ≈ 1)
      for (let i = 0; i < normals.length; i += 3) {
        const nx = normals[i];
        const ny = normals[i + 1];
        const nz = normals[i + 2];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        expect(length).toBeCloseTo(1.0, 5);
      }
    });

    it('should point upward for flat terrain', () => {
      const chunkSize = 3;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) vertices
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap: new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS),
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData);

      expect(capturedGeometry).not.toBeNull();
      const normals = capturedGeometry!.normals;

      // For flat terrain, normals should point mostly upward (0, 1, 0)
      for (let i = 0; i < normals.length; i += 3) {
        const ny = normals[i + 1];
        expect(ny).toBeGreaterThan(0.9); // Should be close to 1
      }
    });
  });

  describe('Biome Color Mapping', () => {
    it('should apply biome colors to vertices', () => {
      const chunkSize = 2;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);
      const biomeMap = new Uint8Array([
        BiomeType.FOREST,
        BiomeType.DESERT,
        BiomeType.OCEAN,
        BiomeType.MOUNTAIN
      ]);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap,
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData);

      expect(capturedGeometry).not.toBeNull();
      const colors = capturedGeometry!.colors;

      // Should have colors for all vertices (3 components per vertex)
      expect(colors.length).toBe((chunkSize + 1) * (chunkSize + 1) * 3);

      // Colors should be in valid range [0, 1]
      for (let i = 0; i < colors.length; i += 3) {
        const r = colors[i];
        const g = colors[i + 1];
        const b = colors[i + 2];

        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
      }
    });

    it('should use blended colors when biome weights are available', () => {
      const chunkSize = 2;
      const numBiomes = 8;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);
      const biomeMap = new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS);

      // Create biome weights for smooth blending
      // Note: biomeWeights is per-vertex, so needs (chunkSize + 1) * (chunkSize + 1) * numBiomes
      const biomeWeights = new Float32Array((chunkSize + 1) * (chunkSize + 1) * numBiomes);
      // First vertex: 50% forest, 50% plains
      biomeWeights[0 * numBiomes + BiomeType.FOREST] = 0.5;
      biomeWeights[0 * numBiomes + BiomeType.PLAINS] = 0.5;

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap,
        biomeWeights,
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData);

      expect(capturedGeometry).not.toBeNull();
      const colors = capturedGeometry!.colors;

      // First vertex should have blended color
      const r = colors[0];
      const g = colors[1];
      const b = colors[2];

      // Color should be different from pure forest or pure plains
      expect(r).toBeGreaterThan(0);
      expect(g).toBeGreaterThan(0);
      expect(b).toBeGreaterThan(0);
    });

    it('should use gray color when no biome data available', () => {
      const chunkSize = 2;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData);

      expect(capturedGeometry).not.toBeNull();
      const colors = capturedGeometry!.colors;

      // All vertices should have gray color (0.5, 0.5, 0.5)
      for (let i = 0; i < colors.length; i += 3) {
        expect(colors[i]).toBeCloseTo(0.5);
        expect(colors[i + 1]).toBeCloseTo(0.5);
        expect(colors[i + 2]).toBeCloseTo(0.5);
      }
    });
  });

  describe('LOD Mesh Simplification', () => {
    it('should apply LOD tint to mesh colors', () => {
      const chunkSize = 2;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);
      const biomeMap = new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap,
        rivers: new Map(),
        resources: [],
        structures: [],
        lodLevel: 1 // MEDIUM LOD
      } as any;

      viewer.addChunk(0, 0, chunkData);

      expect(capturedGeometry).not.toBeNull();
      const colors = capturedGeometry!.colors;

      // LOD level 1 (MEDIUM) should have slight yellow tint
      // Colors should be modified from base biome color
      expect(colors.length).toBe((chunkSize + 1) * (chunkSize + 1) * 3);
    });

    it('should store LOD level in mesh userData', () => {
      const chunkSize = 2;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);
      const biomeMap = new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap,
        rivers: new Map(),
        resources: [],
        structures: [],
        lodLevel: 2 // LOW LOD
      } as any;

      viewer.addChunk(0, 0, chunkData);

      expect(capturedMesh).not.toBeNull();
      expect(capturedMesh!.userData.lodLevel).toBe(2);
    });

    it('should apply different tints for different LOD levels', () => {
      const chunkSize = 2;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);
      const biomeMap = new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS);

      // Create chunks at different LOD levels
      const lodLevels = [0, 1, 2]; // HIGH, MEDIUM, LOW
      const colors: number[][] = [];

      for (const lodLevel of lodLevels) {
        const chunkData: ChunkData = {
          size: chunkSize,
          heightmap: new Float32Array(heightmap),
          biomeMap: new Uint8Array(biomeMap),
          rivers: new Map(),
          resources: [],
          structures: [],
          lodLevel
        } as any;

        viewer.addChunk(lodLevel, 0, chunkData);

        expect(capturedGeometry).not.toBeNull();
        const colorData = capturedGeometry!.colors;

        // Store first vertex color
        colors.push([
          colorData[0],
          colorData[1],
          colorData[2]
        ]);
      }

      // Colors should be different for different LOD levels
      // LOD 0 (HIGH) should have no tint (highest values)
      // LOD 1 (MEDIUM) should have yellow tint
      // LOD 2 (LOW) should have blue tint
      expect(colors[0]).not.toEqual(colors[1]);
      expect(colors[1]).not.toEqual(colors[2]);
      expect(colors[0]).not.toEqual(colors[2]);
    });

    it('should not apply LOD tint when lodLevel is undefined', () => {
      const chunkSize = 2;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);
      const biomeMap = new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap,
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData);

      expect(capturedMesh).not.toBeNull();
      // Should not have lodLevel in userData
      expect(capturedMesh!.userData.lodLevel).toBeUndefined();
    });
  });

  describe('Partial Generation Visualization', () => {
    it('should apply opacity for partial chunks', () => {
      const chunkSize = 2;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);
      const biomeMap = new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap,
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData, true, 0); // Partial, stage 0 (TERRAIN)

      expect(capturedMaterial).not.toBeNull();
      // Stage 0 should have reduced opacity
      expect(capturedMaterial!.transparent).toBe(true);
      expect(capturedMaterial!.opacity).toBeLessThan(1.0);
    });

    it('should store partial status in mesh userData', () => {
      const chunkSize = 2;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);
      const biomeMap = new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS);

      const chunkData: ChunkData = {
        size: chunkSize,
        heightmap,
        biomeMap,
        rivers: new Map(),
        resources: [],
        structures: []
      };

      viewer.addChunk(0, 0, chunkData, true, 1); // Partial, stage 1 (BIOMES)

      expect(capturedMesh).not.toBeNull();
      expect(capturedMesh!.userData.partial).toBe(true);
      expect(capturedMesh!.userData.stage).toBe(1);
    });

    it('should apply different tints for different generation stages', () => {
      const chunkSize = 2;
      // Heightmap needs (chunkSize + 1) x (chunkSize + 1) = 3x3 = 9 values
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1)).fill(0.5);
      const biomeMap = new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS);

      const stages = [0, 1, 2]; // TERRAIN, BIOMES, RIVERS
      const colors: number[][] = [];

      for (const stage of stages) {
        const chunkData: ChunkData = {
          size: chunkSize,
          heightmap: new Float32Array(heightmap),
          biomeMap: new Uint8Array(biomeMap),
          rivers: new Map(),
          resources: [],
          structures: []
        };

        viewer.addChunk(stage, 0, chunkData, true, stage);

        expect(capturedGeometry).not.toBeNull();
        const colorData = capturedGeometry!.colors;

        colors.push([
          colorData[0],
          colorData[1],
          colorData[2]
        ]);
      }

      // Stage 0 (TERRAIN) should have gray tint
      // Stage 1 (BIOMES) should have slight desaturation
      // Colors should be different
      expect(colors[0]).not.toEqual(colors[1]);
    });
  });
});
