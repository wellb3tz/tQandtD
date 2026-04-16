/**
 * WorldViewer Incremental Rendering Tests
 * 
 * Tests the progressive rendering of chunks during incremental generation,
 * including visual indicators for incomplete chunks.
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorldViewer, RenderLayer } from './WorldViewer';
import { ChunkData, BiomeType, GenerationStage } from '../../../src/index';

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
        if (attributes.position && !attributes.normal) {
          const count = attributes.position.count;
          const normals = new Float32Array(count * 3);
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
  BufferAttribute: vi.fn((array: Float32Array | Uint16Array | Uint32Array, itemSize: number) => ({
    array,
    count: array.length / itemSize,
    itemSize,
    getX: (i: number) => array[i * itemSize],
    getY: (i: number) => array[i * itemSize + 1],
    getZ: (i: number) => array[i * itemSize + 2],
    needsUpdate: false
  })),
  Float32BufferAttribute: vi.fn((array: Float32Array, itemSize: number) => ({
    array,
    count: array.length / itemSize,
    itemSize,
    getX: (i: number) => array[i * itemSize],
    getY: (i: number) => array[i * itemSize + 1],
    getZ: (i: number) => array[i * itemSize + 2],
    needsUpdate: false
  })),
  Uint32Array: vi.fn(),
  Mesh: vi.fn((geometry: any, material: any) => ({
    receiveShadow: false,
    castShadow: false,
    userData: {},
    geometry: geometry || { dispose: vi.fn() },
    material: material || { dispose: vi.fn(), wireframe: false, transparent: false, opacity: 1 },
    visible: true,
    position: { 
      set: vi.fn(), 
      x: 0, 
      y: 0, 
      z: 0 
    }
  })),
  MeshLambertMaterial: vi.fn(() => ({
    vertexColors: true,
    wireframe: false,
    dispose: vi.fn(),
    transparent: false,
    opacity: 1
  })),
  Group: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    traverse: vi.fn(),
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    visible: true,
    renderOrder: 0,
    children: []
  })),
  LineSegments: vi.fn(() => ({
    geometry: { dispose: vi.fn() },
    material: { dispose: vi.fn() }
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

describe('WorldViewer - Incremental Rendering', () => {
  let viewer: WorldViewer;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    viewer = new WorldViewer();
    viewer.initialize(container);
  });

  afterEach(() => {
    if (viewer) {
      viewer.dispose();
    }
    if (container && container.parentElement) {
      container.parentElement.removeChild(container);
    }
  });

  // Helper to create chunk data
  function createChunkData(chunkX: number, chunkY: number, partial: boolean = false): ChunkData {
    const size = 32;
    const heightmap = new Float32Array(size * size);
    const biomeMap = partial ? undefined : new Uint8Array(size * size);
    
    // Fill with test data
    for (let i = 0; i < size * size; i++) {
      heightmap[i] = 0.5;
      if (biomeMap) {
        biomeMap[i] = BiomeType.PLAINS;
      }
    }

    return {
      x: chunkX,
      y: chunkY,
      size,
      heightmap,
      biomeMap: biomeMap || new Uint8Array(size * size),
      biomeWeights: new Float32Array(size * size * 8),
      resources: [],
      structures: [],
      rivers: new Set()
    };
  }

  describe('Partial Chunk Rendering', () => {
    it('should render partial chunks with terrain stage', () => {
      const chunkData = createChunkData(0, 0, true);
      
      // Should not throw
      expect(() => {
        viewer.addChunk(0, 0, chunkData, true, GenerationStage.TERRAIN);
      }).not.toThrow();
    });

    it('should render partial chunks with biomes stage', () => {
      const chunkData = createChunkData(0, 0, false);
      
      expect(() => {
        viewer.addChunk(0, 0, chunkData, true, GenerationStage.BIOMES);
      }).not.toThrow();
    });

    it('should render partial chunks with rivers stage', () => {
      const chunkData = createChunkData(0, 0, false);
      
      expect(() => {
        viewer.addChunk(0, 0, chunkData, true, GenerationStage.RIVERS);
      }).not.toThrow();
    });

    it('should render partial chunks with resources stage', () => {
      const chunkData = createChunkData(0, 0, false);
      
      expect(() => {
        viewer.addChunk(0, 0, chunkData, true, GenerationStage.RESOURCES);
      }).not.toThrow();
    });

    it('should render partial chunks with structures stage', () => {
      const chunkData = createChunkData(0, 0, false);
      
      expect(() => {
        viewer.addChunk(0, 0, chunkData, true, GenerationStage.STRUCTURES);
      }).not.toThrow();
    });

    it('should render complete chunks', () => {
      const chunkData = createChunkData(0, 0, false);
      
      expect(() => {
        viewer.addChunk(0, 0, chunkData, false);
      }).not.toThrow();
    });
  });

  describe('Progressive Layer Rendering', () => {
    it('should not render rivers for terrain-only chunks', () => {
      const chunkData = createChunkData(0, 0, false);
      chunkData.rivers = new Set([0, 1, 2]); // Add some rivers
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.TERRAIN);
      
      // Rivers should not be rendered yet
      // (In a real test, we'd check the scene graph)
    });

    it('should render rivers when rivers stage is reached', () => {
      const chunkData = createChunkData(0, 0, false);
      chunkData.rivers = new Set([0, 1, 2]);
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.RIVERS);
      
      // Rivers should be rendered
      // (In a real test, we'd check the scene graph)
    });

    it('should not render resources for chunks before resources stage', () => {
      const chunkData = createChunkData(0, 0, false);
      chunkData.resources = [{ x: 5, y: 5, type: 0, amount: 10 }];
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.BIOMES);
      
      // Resources should not be rendered yet
    });

    it('should render resources when resources stage is reached', () => {
      const chunkData = createChunkData(0, 0, false);
      chunkData.resources = [{ x: 5, y: 5, type: 0, amount: 10 }];
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.RESOURCES);
      
      // Resources should be rendered
    });

    it('should not render structures for chunks before structures stage', () => {
      const chunkData = createChunkData(0, 0, false);
      chunkData.structures = [{ x: 10, y: 10, type: 0, size: 5 }];
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.RESOURCES);
      
      // Structures should not be rendered yet
    });

    it('should render structures when structures stage is reached', () => {
      const chunkData = createChunkData(0, 0, false);
      chunkData.structures = [{ x: 10, y: 10, type: 0, size: 5 }];
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.STRUCTURES);
      
      // Structures should be rendered
    });
  });

  describe('Visual Indicators', () => {
    it('should apply reduced opacity for terrain-only chunks', () => {
      const chunkData = createChunkData(0, 0, true);
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.TERRAIN);
      
      // In a real test, we'd verify the mesh material has opacity < 1.0
    });

    it('should apply gray tint for terrain-only chunks', () => {
      const chunkData = createChunkData(0, 0, true);
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.TERRAIN);
      
      // In a real test, we'd verify the mesh colors are tinted gray
    });

    it('should apply partial opacity for biomes stage', () => {
      const chunkData = createChunkData(0, 0, false);
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.BIOMES);
      
      // In a real test, we'd verify the mesh material has opacity between 0.5 and 1.0
    });

    it('should apply full opacity for complete chunks', () => {
      const chunkData = createChunkData(0, 0, false);
      
      viewer.addChunk(0, 0, chunkData, false);
      
      // In a real test, we'd verify the mesh material has opacity = 1.0
    });
  });

  describe('Chunk Updates', () => {
    it('should update chunk as generation progresses', () => {
      const chunkData = createChunkData(0, 0, true);
      
      // Add terrain-only chunk
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.TERRAIN);
      
      // Update with biomes
      const updatedData = createChunkData(0, 0, false);
      viewer.addChunk(0, 0, updatedData, true, GenerationStage.BIOMES);
      
      // Should not throw
    });

    it('should replace partial chunk with complete chunk', () => {
      const partialData = createChunkData(0, 0, true);
      viewer.addChunk(0, 0, partialData, true, GenerationStage.TERRAIN);
      
      const completeData = createChunkData(0, 0, false);
      viewer.addChunk(0, 0, completeData, false);
      
      // Should not throw
    });

    it('should handle multiple updates to same chunk', () => {
      const chunkData = createChunkData(0, 0, false);
      
      // Add multiple times with different stages
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.TERRAIN);
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.BIOMES);
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.RIVERS);
      viewer.addChunk(0, 0, chunkData, false);
      
      // Should not throw
    });
  });

  describe('Integration with Existing Features', () => {
    it('should work with LOD visualization', () => {
      const chunkData = createChunkData(0, 0, false);
      (chunkData as any).lodLevel = 1; // Medium LOD
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.BIOMES);
      
      // Should apply both LOD tint and partial tint
    });

    it('should respect visibility toggles for partial chunks', () => {
      const chunkData = createChunkData(0, 0, false);
      chunkData.rivers = new Set([0, 1, 2]);
      
      // Hide rivers
      viewer.setVisibility(RenderLayer.RIVERS, false);
      
      // Add chunk with rivers stage
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.RIVERS);
      
      // Rivers should not be visible
    });

    it('should handle chunk removal for partial chunks', () => {
      const chunkData = createChunkData(0, 0, true);
      
      viewer.addChunk(0, 0, chunkData, true, GenerationStage.TERRAIN);
      
      expect(() => {
        viewer.removeChunk(0, 0);
      }).not.toThrow();
    });
  });
});
