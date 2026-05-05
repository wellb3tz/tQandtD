/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BiomeType, createSparseBiomeWeights } from '../../../src';
import { WorldViewer } from './WorldViewer';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');

  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    shadowMap = {
      enabled: false,
      type: undefined,
    };
    toneMapping = undefined;
    toneMappingExposure = 1;

    setSize = vi.fn();
    setPixelRatio = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

describe('WorldViewer lifecycle', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes DOM event listeners when disposed', () => {
    const addWindowListener = vi.spyOn(window, 'addEventListener');
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');
    const addDocumentListener = vi.spyOn(document, 'addEventListener');
    const removeDocumentListener = vi.spyOn(document, 'removeEventListener');

    const container = document.createElement('div');
    const addContainerListener = vi.spyOn(container, 'addEventListener');
    const removeContainerListener = vi.spyOn(container, 'removeEventListener');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);

    const containerClickHandler = addContainerListener.mock.calls.find(([type]) => type === 'click')?.[1];
    const pointerLockHandler = addDocumentListener.mock.calls.find(([type]) => type === 'pointerlockchange')?.[1];
    const mouseMoveHandler = addDocumentListener.mock.calls.find(([type]) => type === 'mousemove')?.[1];
    const documentKeyDownHandler = addDocumentListener.mock.calls.find(([type]) => type === 'keydown')?.[1];
    const windowKeyDownHandler = addWindowListener.mock.calls.find(([type]) => type === 'keydown')?.[1];
    const windowKeyUpHandler = addWindowListener.mock.calls.find(([type]) => type === 'keyup')?.[1];

    viewer.dispose();

    expect(removeContainerListener).toHaveBeenCalledWith('click', containerClickHandler);
    expect(removeDocumentListener).toHaveBeenCalledWith('pointerlockchange', pointerLockHandler);
    expect(removeDocumentListener).toHaveBeenCalledWith('mousemove', mouseMoveHandler);
    expect(removeDocumentListener).toHaveBeenCalledWith('keydown', documentKeyDownHandler);
    expect(removeWindowListener).toHaveBeenCalledWith('keydown', windowKeyDownHandler);
    expect(removeWindowListener).toHaveBeenCalledWith('keyup', windowKeyUpHandler);
  });

  it('rotates the free camera with mouse drag when pointer lock is unavailable', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);

    const camera = viewer.getCamera();
    const initialQuaternion = camera.quaternion.clone();

    container.dispatchEvent(new MouseEvent('mousedown', {
      button: 0,
      clientX: 200,
      clientY: 200,
      bubbles: true,
    }));
    document.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 260,
      clientY: 230,
      bubbles: true,
    }));
    document.dispatchEvent(new MouseEvent('mouseup', {
      button: 0,
      bubbles: true,
    }));

    expect(camera.quaternion.equals(initialQuaternion)).toBe(false);

    viewer.dispose();
  });

  it('keeps mouse drag fallback available when pointer lock request fails', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    Object.defineProperty(container, 'requestPointerLock', {
      value: vi.fn(() => {
        throw new Error('Pointer lock blocked');
      }),
    });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);

    expect(() => {
      container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).not.toThrow();

    viewer.dispose();
  });

  it('adds terrain UVs and surface blend attributes so textures can blend inside a chunk', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 2,
      heightmap: new Float32Array(9),
      biomeMap: new Uint8Array([
        BiomeType.PLAINS,
        BiomeType.DESERT,
        BiomeType.BEACH,
        BiomeType.MOUNTAIN,
      ]),
      resources: [],
      structures: [],
    } as any);

    const terrain = (viewer as any).chunkMeshes.get('0,0').terrain;
    const geometry = terrain.geometry as THREE.BufferGeometry;
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const uvs = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const surfaceBlendA = geometry.getAttribute('surfaceBlendA') as THREE.BufferAttribute | undefined;
    const surfaceBlendB = geometry.getAttribute('surfaceBlendB') as THREE.BufferAttribute | undefined;
    const surfaceBlendC = geometry.getAttribute('surfaceBlendC') as THREE.BufferAttribute | undefined;
    const terrainDetailBlend = geometry.getAttribute('terrainDetailBlend') as THREE.BufferAttribute | undefined;

    expect(uvs).toBeDefined();
    expect(uvs?.count).toBe(positions.count);
    expect(uvs?.getX(0)).toBe(0);
    expect(uvs?.getY(0)).toBe(0);
    expect(uvs?.getX(positions.count - 1)).toBe(1);
    expect(uvs?.getY(positions.count - 1)).toBe(1);
    expect(surfaceBlendA).toBeDefined();
    expect(surfaceBlendB).toBeDefined();
    expect(surfaceBlendC).toBeDefined();
    expect(surfaceBlendA?.itemSize).toBe(4);
    expect(surfaceBlendB?.itemSize).toBe(4);
    expect(surfaceBlendC?.itemSize).toBe(4);
    expect(terrainDetailBlend).toBeDefined();
    expect(terrainDetailBlend?.itemSize).toBe(4);
    expect(surfaceBlendA?.count).toBe(positions.count);
    expect(surfaceBlendB?.count).toBe(positions.count);
    expect(surfaceBlendC?.count).toBe(positions.count);
    expect(terrainDetailBlend?.count).toBe(positions.count);

    const firstWeightSum =
      surfaceBlendA!.getX(0) +
      surfaceBlendA!.getY(0) +
      surfaceBlendA!.getZ(0) +
      surfaceBlendA!.getW(0) +
      surfaceBlendB!.getX(0) +
      surfaceBlendB!.getY(0) +
      surfaceBlendB!.getZ(0) +
      surfaceBlendB!.getW(0) +
      surfaceBlendC!.getX(0) +
      surfaceBlendC!.getY(0) +
      surfaceBlendC!.getZ(0);
    expect(firstWeightSum).toBeCloseTo(1);

    viewer.dispose();
  });

  it('marks wet shoreline, snowy peak, and riverbed detail masks on terrain vertices', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 1,
      heightmap: new Float32Array([0.31, 0.31, 0.84, 0.84]),
      biomeMap: new Uint8Array([BiomeType.MOUNTAIN]),
      rivers: [{
        riverId: 'river_1',
        pathId: 'river_1:main',
        isTributary: false,
        points: [
          { x: 0, y: 0, height: 0.31, surfaceLevel: 0.31, width: 1, depth: 0.04, channelWidth: 2, flowX: 1, flowY: 0 },
          { x: 1, y: 0, height: 0.31, surfaceLevel: 0.31, width: 1, depth: 0.04, channelWidth: 2, flowX: 1, flowY: 0 },
        ],
        bounds: { minX: 0, maxX: 1, minY: 0, maxY: 0 },
      }],
      resources: [],
      structures: [],
    } as any);

    const terrain = (viewer as any).chunkMeshes.get('0,0').terrain as THREE.Mesh;
    const detailBlend = (terrain.geometry as THREE.BufferGeometry).getAttribute('terrainDetailBlend') as THREE.BufferAttribute;

    expect(detailBlend.getZ(0)).toBeGreaterThan(0);
    expect(detailBlend.getY(2)).toBeGreaterThan(0);
    expect(detailBlend.getW(0)).toBeGreaterThan(0);
    expect(detailBlend.getX(0)).toBeGreaterThanOrEqual(0);
    expect(detailBlend.getX(0)).toBeLessThanOrEqual(1);
    expect(detailBlend.getY(2)).toBeLessThanOrEqual(1);
    expect(detailBlend.getZ(0)).toBeLessThanOrEqual(1);
    expect(detailBlend.getW(0)).toBeLessThanOrEqual(1);

    viewer.dispose();
  });

  it('adds lightweight instanced foliage on forest biomes', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 4,
      heightmap: new Float32Array(25).fill(0.5),
      biomeMap: new Uint8Array(16).fill(BiomeType.FOREST),
      resources: [],
      structures: [],
    } as any);

    const chunkMesh = (viewer as any).chunkMeshes.get('0,0');
    const foliage = chunkMesh.foliage as THREE.Group;
    const canopy = foliage.children[0] as THREE.InstancedMesh;

    expect(foliage).toBeInstanceOf(THREE.Group);
    expect(canopy).toBeInstanceOf(THREE.InstancedMesh);
    expect(canopy.count).toBeGreaterThan(0);
    expect(canopy.count).toBeLessThanOrEqual(16);
    expect(foliage.visible).toBe(true);

    viewer.dispose();
  });

  it('does not place foliage on lake tiles', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 4,
      heightmap: new Float32Array(25).fill(0.5),
      biomeMap: new Uint8Array(16).fill(BiomeType.FOREST),
      lakes: [{
        waterLevel: 0.55,
        tiles: new Set(Array.from({ length: 16 }, (_, index) => index)),
        maxDepth: 0.08,
        minTerrainHeight: 0.5,
      }],
      resources: [],
      structures: [],
    } as any);

    expect((viewer as any).chunkMeshes.get('0,0').foliage).toBeUndefined();

    viewer.dispose();
  });

  it('does not place foliage in river channels when river points are local to a nonzero chunk', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(1, 0, {
      size: 8,
      heightmap: new Float32Array(81).fill(0.5),
      biomeMap: new Uint8Array(64).fill(BiomeType.RAINFOREST),
      rivers: [{
        riverId: 'river_local_1',
        pathId: 'river_local_1:main',
        isTributary: false,
        points: [
          { x: 0.5, y: 0, height: 0.5, surfaceLevel: 0.5, width: 1, depth: 0.04, channelWidth: 1.6, flowX: 0, flowY: 1 },
          { x: 0.5, y: 8, height: 0.5, surfaceLevel: 0.5, width: 1, depth: 0.04, channelWidth: 1.6, flowX: 0, flowY: 1 },
        ],
        bounds: { minX: 0.5, maxX: 0.5, minY: 0, maxY: 8 },
      }],
      resources: [],
      structures: [],
    } as any);

    const foliage = (viewer as any).chunkMeshes.get('1,0').foliage as THREE.Group;
    const canopy = foliage.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    let hasRiverChannelFoliage = false;

    for (let i = 0; i < canopy.count; i++) {
      canopy.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      if (Math.abs(position.x - 8.5) <= 0.8) {
        hasRiverChannelFoliage = true;
        break;
      }
    }

    expect(hasRiverChannelFoliage).toBe(false);

    viewer.dispose();
  });

  it('uses one instanced low-poly tree prototype with trunk and layered crown colors', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 4,
      heightmap: new Float32Array(25).fill(0.5),
      biomeMap: new Uint8Array(16).fill(BiomeType.FOREST),
      resources: [],
      structures: [],
    } as any);

    const foliage = (viewer as any).chunkMeshes.get('0,0').foliage as THREE.Group;
    const tree = foliage.children[0] as THREE.InstancedMesh;
    const material = tree.material as THREE.MeshLambertMaterial;
    const geometry = tree.geometry as THREE.BufferGeometry;
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;

    let hasTrunkColor = false;
    let hasCrownColor = false;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < positions.count; i++) {
      minY = Math.min(minY, positions.getY(i));
      maxY = Math.max(maxY, positions.getY(i));
      if (!colors) continue;
      const r = colors.getX(i);
      const g = colors.getY(i);
      const b = colors.getZ(i);
      hasTrunkColor ||= r > 0.30 && r > g * 1.35 && g > b;
      hasCrownColor ||= g > r * 1.25 && g > b * 1.25;
    }

    expect(foliage.children).toHaveLength(1);
    expect(material.vertexColors).toBe(true);
    expect(colors).toBeDefined();
    expect(positions.count).toBeGreaterThan(36);
    expect(minY).toBeLessThan(-0.45);
    expect(maxY).toBeGreaterThan(0.75);
    expect(hasTrunkColor).toBe(true);
    expect(hasCrownColor).toBe(true);

    viewer.dispose();
  });

  it('jitters foliage across the whole tile to avoid visible grid rows', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 8,
      heightmap: new Float32Array(81).fill(0.5),
      biomeMap: new Uint8Array(64).fill(BiomeType.FOREST),
      resources: [],
      structures: [],
    } as any);

    const foliage = (viewer as any).chunkMeshes.get('0,0').foliage as THREE.Group;
    const canopy = foliage.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const fractions: number[] = [];

    for (let i = 0; i < canopy.count; i++) {
      canopy.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      fractions.push(position.x - Math.floor(position.x));
      fractions.push(position.z - Math.floor(position.z));
    }

    expect(fractions.some(value => value < 0.18)).toBe(true);
    expect(fractions.some(value => value > 0.82)).toBe(true);

    viewer.dispose();
  });

  it('uses sparse biome weights so blended forest chunks get foliage', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    const tileWeights = Array.from({ length: 16 }, () => new Map([
      [BiomeType.PLAINS, 0.35],
      [BiomeType.FOREST, 0.65],
    ]));
    const sparse = createSparseBiomeWeights(tileWeights, 16);

    viewer.addChunk(0, 0, {
      size: 4,
      heightmap: new Float32Array(25).fill(0.5),
      biomeMap: new Uint8Array(16).fill(BiomeType.PLAINS),
      sparseBiomeTypes: sparse.types,
      sparseBiomeWeights: sparse.weights,
      sparseBiomeOffsets: sparse.offsets,
      resources: [],
      structures: [],
    } as any);

    const foliage = (viewer as any).chunkMeshes.get('0,0').foliage as THREE.Group | undefined;

    expect(foliage).toBeInstanceOf(THREE.Group);
    expect(foliage?.userData.foliageCount).toBeGreaterThan(0);

    viewer.dispose();
  });

  it('does not leave the trailing rows empty when a dense chunk hits the foliage cap', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 32,
      heightmap: new Float32Array(33 * 33).fill(0.5),
      biomeMap: new Uint8Array(32 * 32).fill(BiomeType.FOREST),
      resources: [],
      structures: [],
    } as any);

    const foliage = (viewer as any).chunkMeshes.get('0,0').foliage as THREE.Group;
    const canopy = foliage.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    let hasTrailingRowFoliage = false;

    for (let i = 0; i < canopy.count; i++) {
      canopy.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      if (position.z >= 31) {
        hasTrailingRowFoliage = true;
        break;
      }
    }

    expect(canopy.count).toBeLessThanOrEqual(512);
    expect(hasTrailingRowFoliage).toBe(true);

    viewer.dispose();
  });

  it('skips foliage on non-vegetated and underwater terrain', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 2,
      heightmap: new Float32Array(9).fill(0.5),
      biomeMap: new Uint8Array(4).fill(BiomeType.DESERT),
      resources: [],
      structures: [],
    } as any);
    viewer.addChunk(1, 0, {
      size: 2,
      heightmap: new Float32Array(9).fill(0.25),
      biomeMap: new Uint8Array(4).fill(BiomeType.FOREST),
      resources: [],
      structures: [],
    } as any);

    expect((viewer as any).chunkMeshes.get('0,0').foliage).toBeUndefined();
    expect((viewer as any).chunkMeshes.get('1,0').foliage).toBeUndefined();

    viewer.dispose();
  });

  it('keeps terrain UVs continuous across adjacent chunks', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    const chunk = {
      size: 1,
      heightmap: new Float32Array(4),
      biomeMap: new Uint8Array([BiomeType.PLAINS]),
      resources: [],
      structures: [],
    } as any;

    viewer.addChunk(0, 0, chunk);
    viewer.addChunk(1, 0, chunk);

    const leftTerrain = (viewer as any).chunkMeshes.get('0,0').terrain as THREE.Mesh;
    const rightTerrain = (viewer as any).chunkMeshes.get('1,0').terrain as THREE.Mesh;
    const leftUvs = (leftTerrain.geometry as THREE.BufferGeometry).getAttribute('uv') as THREE.BufferAttribute;
    const rightUvs = (rightTerrain.geometry as THREE.BufferGeometry).getAttribute('uv') as THREE.BufferAttribute;

    expect(leftUvs.getX(1)).toBeCloseTo(rightUvs.getX(0));
    expect(leftUvs.getY(1)).toBeCloseTo(rightUvs.getY(0));
    expect(rightUvs.getX(1)).toBeGreaterThan(rightUvs.getX(0));

    viewer.dispose();
  });

  it('darkens terrain vertices along river trench bottoms', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 2,
      heightmap: new Float32Array(9).fill(0.5),
      biomeMap: new Uint8Array([
        BiomeType.PLAINS,
        BiomeType.PLAINS,
        BiomeType.PLAINS,
        BiomeType.PLAINS,
      ]),
      rivers: [{
        riverId: 'river_1',
        pathId: 'river_1:main',
        isTributary: false,
        points: [
          { x: 0, y: 1, height: 0.5, surfaceLevel: 0.5, width: 1, depth: 0.04, channelWidth: 2, flowX: 1, flowY: 0 },
          { x: 2, y: 1, height: 0.5, surfaceLevel: 0.5, width: 1, depth: 0.04, channelWidth: 2, flowX: 1, flowY: 0 },
        ],
        bounds: { minX: 0, maxX: 2, minY: 1, maxY: 1 },
      }],
      resources: [],
      structures: [],
    } as any);

    const terrain = (viewer as any).chunkMeshes.get('0,0').terrain;
    const colors = terrain.geometry.getAttribute('color') as THREE.BufferAttribute;
    const center = 1 * 3 + 1;
    const corner = 0;

    expect(colors.getX(center)).toBeLessThan(colors.getX(corner));
    expect(colors.getY(center)).toBeLessThan(colors.getY(corner));
    expect(colors.getZ(center)).toBeLessThan(colors.getZ(corner));

    viewer.dispose();
  });

  it('switches existing terrain chunks between textured and biome-color-only materials', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 1,
      heightmap: new Float32Array(4),
      biomeMap: new Uint8Array([BiomeType.PLAINS]),
      resources: [],
      structures: [],
    } as any);

    const terrain = (viewer as any).chunkMeshes.get('0,0').terrain as THREE.Mesh;
    const initialMaterial = terrain.material as THREE.MeshStandardMaterial;
    expect(initialMaterial.userData.terrainTexturesEnabled).toBe(true);
    expect(initialMaterial.map).toBeTruthy();

    viewer.setTerrainTexturesEnabled(false);

    const colorOnlyMaterial = terrain.material as THREE.MeshStandardMaterial;
    expect(viewer.areTerrainTexturesEnabled()).toBe(false);
    expect(colorOnlyMaterial).not.toBe(initialMaterial);
    expect(colorOnlyMaterial.userData.terrainTexturesEnabled).toBe(false);
    expect(colorOnlyMaterial.map).toBeNull();
    expect(colorOnlyMaterial.vertexColors).toBe(true);

    viewer.setWireframeMode(true);
    expect(colorOnlyMaterial.wireframe).toBe(true);

    viewer.setTerrainTexturesEnabled(true);

    const texturedAgainMaterial = terrain.material as THREE.MeshStandardMaterial;
    expect(viewer.areTerrainTexturesEnabled()).toBe(true);
    expect(texturedAgainMaterial.userData.terrainTexturesEnabled).toBe(true);
    expect(texturedAgainMaterial.map).toBeTruthy();
    expect(texturedAgainMaterial.wireframe).toBe(true);

    viewer.dispose();
  });

  it('stitches terrain texture surface weights across chunk boundaries', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 1,
      heightmap: new Float32Array([0, 0, 0, 0]),
      biomeMap: new Uint8Array([BiomeType.DESERT]),
      resources: [],
      structures: [],
    } as any);
    viewer.addChunk(1, 0, {
      size: 1,
      heightmap: new Float32Array([0, 0, 0, 0]),
      biomeMap: new Uint8Array([BiomeType.PLAINS]),
      resources: [],
      structures: [],
    } as any);

    const leftTerrain = (viewer as any).chunkMeshes.get('0,0').terrain as THREE.Mesh;
    const rightTerrain = (viewer as any).chunkMeshes.get('1,0').terrain as THREE.Mesh;
    const leftGeometry = leftTerrain.geometry as THREE.BufferGeometry;
    const rightGeometry = rightTerrain.geometry as THREE.BufferGeometry;
    const leftBlendA = leftGeometry.getAttribute('surfaceBlendA') as THREE.BufferAttribute;
    const leftBlendB = leftGeometry.getAttribute('surfaceBlendB') as THREE.BufferAttribute;
    const leftBlendC = leftGeometry.getAttribute('surfaceBlendC') as THREE.BufferAttribute;
    const rightBlendA = rightGeometry.getAttribute('surfaceBlendA') as THREE.BufferAttribute;
    const rightBlendB = rightGeometry.getAttribute('surfaceBlendB') as THREE.BufferAttribute;
    const rightBlendC = rightGeometry.getAttribute('surfaceBlendC') as THREE.BufferAttribute;

    const leftSharedEdgeIndex = 1;
    const rightSharedEdgeIndex = 0;

    expect(leftBlendA.getX(leftSharedEdgeIndex)).toBeCloseTo(rightBlendA.getX(rightSharedEdgeIndex));
    expect(leftBlendA.getY(leftSharedEdgeIndex)).toBeCloseTo(rightBlendA.getY(rightSharedEdgeIndex));
    expect(leftBlendA.getZ(leftSharedEdgeIndex)).toBeCloseTo(rightBlendA.getZ(rightSharedEdgeIndex));
    expect(leftBlendA.getW(leftSharedEdgeIndex)).toBeCloseTo(rightBlendA.getW(rightSharedEdgeIndex));
    expect(leftBlendB.getX(leftSharedEdgeIndex)).toBeCloseTo(rightBlendB.getX(rightSharedEdgeIndex));
    expect(leftBlendB.getY(leftSharedEdgeIndex)).toBeCloseTo(rightBlendB.getY(rightSharedEdgeIndex));
    expect(leftBlendB.getZ(leftSharedEdgeIndex)).toBeCloseTo(rightBlendB.getZ(rightSharedEdgeIndex));
    expect(leftBlendB.getW(leftSharedEdgeIndex)).toBeCloseTo(rightBlendB.getW(rightSharedEdgeIndex));
    expect(leftBlendC.getX(leftSharedEdgeIndex)).toBeCloseTo(rightBlendC.getX(rightSharedEdgeIndex));
    expect(leftBlendC.getY(leftSharedEdgeIndex)).toBeCloseTo(rightBlendC.getY(rightSharedEdgeIndex));
    expect(leftBlendC.getZ(leftSharedEdgeIndex)).toBeCloseTo(rightBlendC.getZ(rightSharedEdgeIndex));
    expect(leftBlendA.getX(leftSharedEdgeIndex) + leftBlendA.getY(leftSharedEdgeIndex)).toBeCloseTo(1);

    viewer.dispose();
  });

  it('stitches terrain detail masks across chunk boundaries', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);

    const viewer = new WorldViewer();
    viewer.initialize(container);
    (viewer as any).waterConfig = {
      ...(viewer as any).waterConfig,
      enabled: false,
    };

    viewer.addChunk(0, 0, {
      size: 1,
      heightmap: new Float32Array([0.2, 0.84, 0.2, 0.84]),
      biomeMap: new Uint8Array([BiomeType.MOUNTAIN]),
      resources: [],
      structures: [],
    } as any);
    viewer.addChunk(1, 0, {
      size: 1,
      heightmap: new Float32Array([0.31, 0.31, 0.31, 0.31]),
      biomeMap: new Uint8Array([BiomeType.BEACH]),
      resources: [],
      structures: [],
    } as any);

    const leftTerrain = (viewer as any).chunkMeshes.get('0,0').terrain as THREE.Mesh;
    const rightTerrain = (viewer as any).chunkMeshes.get('1,0').terrain as THREE.Mesh;
    const leftDetail = (leftTerrain.geometry as THREE.BufferGeometry).getAttribute('terrainDetailBlend') as THREE.BufferAttribute;
    const rightDetail = (rightTerrain.geometry as THREE.BufferGeometry).getAttribute('terrainDetailBlend') as THREE.BufferAttribute;

    const leftSharedEdgeIndex = 1;
    const rightSharedEdgeIndex = 0;

    expect(leftDetail.getX(leftSharedEdgeIndex)).toBeCloseTo(rightDetail.getX(rightSharedEdgeIndex));
    expect(leftDetail.getY(leftSharedEdgeIndex)).toBeCloseTo(rightDetail.getY(rightSharedEdgeIndex));
    expect(leftDetail.getZ(leftSharedEdgeIndex)).toBeCloseTo(rightDetail.getZ(rightSharedEdgeIndex));
    expect(leftDetail.getW(leftSharedEdgeIndex)).toBeCloseTo(rightDetail.getW(rightSharedEdgeIndex));

    viewer.dispose();
  });
});
