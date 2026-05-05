/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BiomeType, createSparseBiomeWeights } from '../../../src';
import { WorldViewer } from './WorldViewer';

function getTexturePixelHex(texture: THREE.DataTexture, y: number): number {
  const data = texture.image.data as Uint8Array;
  const offset = y * texture.image.width * 4;
  return (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
}

function getTexturePixelHexAt(texture: THREE.DataTexture, x: number, y: number): number {
  const data = texture.image.data as Uint8Array;
  const offset = (y * texture.image.width + x) * 4;
  return (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
}

function getTexturePixelRgbAt(texture: THREE.DataTexture, x: number, y: number): [number, number, number] {
  const data = texture.image.data as Uint8Array;
  const offset = (y * texture.image.width + x) * 4;
  return [data[offset], data[offset + 1], data[offset + 2]];
}

function getMaxAdjacentRowLumaDelta(texture: THREE.DataTexture): number {
  const data = texture.image.data as Uint8Array;
  const width = texture.image.width;
  const height = texture.image.height;
  let previousAverage = 0;
  let maxDelta = 0;

  for (let y = 0; y < height; y++) {
    let rowTotal = 0;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      rowTotal += (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
    }
    const rowAverage = rowTotal / width;
    if (y > 0) {
      maxDelta = Math.max(maxDelta, Math.abs(rowAverage - previousAverage));
    }
    previousAverage = rowAverage;
  }

  return maxDelta;
}

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

  it('uses a softened cinematic lighting profile for readable forest shadows', () => {
    const viewer = new WorldViewer();
    const renderer = (viewer as any).renderer as THREE.WebGLRenderer;
    const ambientLight = (viewer as any).ambientLight as THREE.AmbientLight;
    const directionalLight = (viewer as any).directionalLight as THREE.DirectionalLight;

    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBeGreaterThanOrEqual(0.80);
    expect(renderer.toneMappingExposure).toBeLessThanOrEqual(0.82);
    expect(ambientLight.intensity).toBeGreaterThanOrEqual(0.36);
    expect(ambientLight.intensity).toBeLessThanOrEqual(0.37);
    expect(ambientLight.color.getHex()).toBe(0x9fb6c8);
    expect(directionalLight.intensity).toBeGreaterThanOrEqual(1.08);
    expect(directionalLight.intensity).toBeLessThanOrEqual(1.16);
    expect(directionalLight.color.getHex()).toBe(0xffe2b8);
    expect(directionalLight.position.x).toBeGreaterThan(0);
    expect(directionalLight.position.y).toBeGreaterThanOrEqual(132);
    expect(directionalLight.position.z).toBeGreaterThan(0);

    viewer.dispose();
  });

  it('places a visible sun marker on the same vector used by directional shadows', () => {
    const viewer = new WorldViewer();
    const directionalLight = (viewer as any).directionalLight as THREE.DirectionalLight;
    const sunSprite = (viewer as any).sunSprite as THREE.Sprite;
    const sunDirection = sunSprite.position.clone().sub(directionalLight.target.position).normalize();
    const lightDirection = directionalLight.position.clone().sub(directionalLight.target.position).normalize();

    expect(sunSprite).toBeInstanceOf(THREE.Sprite);
    expect(sunSprite.castShadow).toBe(false);
    expect(sunSprite.receiveShadow).toBe(false);
    expect((sunSprite.material as THREE.SpriteMaterial).depthWrite).toBe(false);
    expect((sunSprite.material as THREE.SpriteMaterial).opacity).toBeLessThanOrEqual(0.82);
    expect(sunSprite.scale.x).toBeGreaterThanOrEqual(72);
    expect(sunSprite.scale.x).toBeLessThanOrEqual(96);
    expect(sunDirection.distanceTo(lightDirection)).toBeLessThan(0.0001);

    viewer.dispose();
  });

  it('keeps the directional shadow frustum centered near the active camera away from spawn', () => {
    const viewer = new WorldViewer();
    const directionalLight = (viewer as any).directionalLight as THREE.DirectionalLight;

    viewer.setCameraPosition({ x: 680, y: 120, z: -540 });
    (viewer as any).updateSunAndShadowFocus();

    expect(directionalLight.target.position.x).toBeCloseTo(680);
    expect(directionalLight.target.position.z).toBeCloseTo(-540);
    expect(directionalLight.position.x - directionalLight.target.position.x).toBeCloseTo(90);
    expect(directionalLight.position.y - directionalLight.target.position.y).toBeCloseTo(138);
    expect(directionalLight.position.z - directionalLight.target.position.z).toBeCloseTo(56);

    viewer.dispose();
  });

  it('starts with the old blue sky and switches to a UI-matched atmospheric background when enabled', () => {
    const viewer = new WorldViewer();

    const defaultBackground = (viewer as any).scene.background as THREE.Color;
    const defaultFog = (viewer as any).scene.fog as THREE.FogExp2;
    const bgOceanMesh = (viewer as any).bgOceanMesh as THREE.Mesh;
    const bgOceanMaterial = bgOceanMesh.material as THREE.MeshPhongMaterial;

    expect(defaultBackground).toBeInstanceOf(THREE.Color);
    expect(defaultBackground.getHex()).toBe(0x87ceeb);
    expect(defaultFog).toBeInstanceOf(THREE.FogExp2);
    expect(defaultFog.color.getHex()).toBe(0x87ceeb);
    expect(defaultFog.density).toBeCloseTo(0.0012);
    expect(bgOceanMesh.visible).toBe(false);
    expect(bgOceanMaterial.color.getHex()).toBe(0x87ceeb);

    viewer.setBackgroundMode(true);

    const skyBackground = (viewer as any).scene.background as THREE.DataTexture;
    expect(skyBackground).toBeInstanceOf(THREE.DataTexture);
    expect(skyBackground.userData.backgroundMode).toBe('sky');
    expect(skyBackground.image.width).toBeGreaterThan(1);
    expect(skyBackground.image.height).toBeGreaterThan(32);
    const centerOceanTone = getTexturePixelRgbAt(skyBackground, 48, 32);
    expect(centerOceanTone[0]).toBeGreaterThanOrEqual(20);
    expect(centerOceanTone[0]).toBeLessThanOrEqual(40);
    expect(centerOceanTone[1]).toBeGreaterThanOrEqual(42);
    expect(centerOceanTone[1]).toBeLessThanOrEqual(62);
    expect(centerOceanTone[2]).toBeGreaterThanOrEqual(42);
    expect(centerOceanTone[2]).toBeLessThanOrEqual(62);
    expect(getTexturePixelHexAt(skyBackground, 23, 17)).not.toBe(getTexturePixelHexAt(skyBackground, 44, 17));
    expect(getTexturePixelHexAt(skyBackground, 12, 9)).not.toBe(getTexturePixelHexAt(skyBackground, 12, 39));
    expect(getMaxAdjacentRowLumaDelta(skyBackground)).toBeLessThan(1.0);
    expect(((viewer as any).scene.fog as THREE.FogExp2).color.getHex()).toBe(0x1d3433);
    expect(((viewer as any).scene.fog as THREE.FogExp2).density).toBeCloseTo(0.00105);

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

  it('keeps a wider shoreline mask above sea level for visible sandy coast transitions', () => {
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
      heightmap: new Float32Array([0.30, 0.36, 0.43, 0.46]),
      biomeMap: new Uint8Array([BiomeType.BEACH]),
      resources: [],
      structures: [],
    } as any);

    const terrain = (viewer as any).chunkMeshes.get('0,0').terrain as THREE.Mesh;
    const detailBlend = (terrain.geometry as THREE.BufferGeometry).getAttribute('terrainDetailBlend') as THREE.BufferAttribute;

    expect(detailBlend.getZ(2)).toBeGreaterThan(0.15);
    expect(detailBlend.getZ(3)).toBeGreaterThan(0.05);

    viewer.dispose();
  });

  it('adds stronger cliff and snow detail masks to mountain terrain without extra geometry', () => {
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
      heightmap: new Float32Array([0.36, 0.92, 0.38, 0.84]),
      biomeMap: new Uint8Array([BiomeType.MOUNTAIN]),
      resources: [],
      structures: [],
    } as any);

    const terrain = (viewer as any).chunkMeshes.get('0,0').terrain as THREE.Mesh;
    const detailBlend = (terrain.geometry as THREE.BufferGeometry).getAttribute('terrainDetailBlend') as THREE.BufferAttribute;

    expect(detailBlend.getX(0)).toBeGreaterThan(0.22);
    expect(detailBlend.getY(3)).toBeGreaterThan(0.40);

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
    expect(canopy.castShadow).toBe(true);
    expect(canopy.receiveShadow).toBe(true);
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

  it('adds low shoreline shrubs near riverbanks while keeping water channels clear', () => {
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
      biomeMap: new Uint8Array(64).fill(BiomeType.FOREST),
      rivers: [{
        riverId: 'river_bank_1',
        pathId: 'river_bank_1:main',
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
    const shrubs = foliage.children[1] as THREE.InstancedMesh;
    const shrubPositions = shrubs.geometry.getAttribute('position') as THREE.BufferAttribute;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    let minShrubGeometryY = Infinity;
    let hasShrubInWater = false;

    for (let i = 0; i < shrubPositions.count; i++) {
      minShrubGeometryY = Math.min(minShrubGeometryY, shrubPositions.getY(i));
    }

    for (let i = 0; i < shrubs.count; i++) {
      shrubs.getMatrixAt(i, matrix);
      matrix.decompose(position, quaternion, scale);
      const shrubBottomY = position.y + minShrubGeometryY * scale.y;
      expect(shrubBottomY).toBeCloseTo(25, 5);
      if (Math.abs(position.x - 8.5) <= 0.8) {
        hasShrubInWater = true;
        break;
      }
    }

    expect(foliage.userData.treeCount).toBeGreaterThan(0);
    expect(foliage.userData.shrubCount).toBeGreaterThan(0);
    expect(shrubs).toBeInstanceOf(THREE.InstancedMesh);
    expect(hasShrubInWater).toBe(false);

    viewer.dispose();
  });

  it('uses multiple instanced low-poly tree silhouettes with trunk and crown colors', () => {
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
    const treeMeshes = foliage.children.filter(child => child.name.startsWith('foliage-trees')) as THREE.InstancedMesh[];
    const tree = treeMeshes[0];
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

    expect(treeMeshes.length).toBeGreaterThanOrEqual(2);
    expect(foliage.userData.treeVariantCount).toBeGreaterThanOrEqual(2);
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
    const treeMeshes = foliage.children.filter(child => child.name.startsWith('foliage-trees')) as THREE.InstancedMesh[];
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const fractions: number[] = [];

    for (const canopy of treeMeshes) {
      for (let i = 0; i < canopy.count; i++) {
        canopy.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        fractions.push(position.x - Math.floor(position.x));
        fractions.push(position.z - Math.floor(position.z));
      }
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
    const treeMeshes = foliage.children.filter(child => child.name.startsWith('foliage-trees')) as THREE.InstancedMesh[];
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    let hasTrailingRowFoliage = false;
    let treeCount = 0;

    for (const canopy of treeMeshes) {
      treeCount += canopy.count;
      for (let i = 0; i < canopy.count; i++) {
        canopy.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        if (position.z >= 31) {
          hasTrailingRowFoliage = true;
          break;
        }
      }
    }

    expect(treeCount).toBeLessThanOrEqual(512);
    expect(hasTrailingRowFoliage).toBe(true);

    viewer.dispose();
  });

  it('cuts meadow-sized clearings out of dense forest chunks', () => {
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
    const treeMeshes = foliage.children.filter(child => child.name.startsWith('foliage-trees')) as THREE.InstancedMesh[];
    const clearing = foliage.userData.clearingSample as { x: number; z: number; radius: number } | undefined;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    let hasTreeInsideClearing = false;

    expect(foliage.userData.clearingCount).toBeGreaterThan(0);
    expect(foliage.userData.clearingCount).toBeLessThanOrEqual(80);
    expect(clearing).toBeDefined();

    for (const treeMesh of treeMeshes) {
      for (let i = 0; i < treeMesh.count; i++) {
        treeMesh.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        if (clearing && Math.hypot(position.x - clearing.x, position.z - clearing.z) < clearing.radius) {
          hasTreeInsideClearing = true;
          break;
        }
      }
    }

    expect(hasTreeInsideClearing).toBe(false);

    viewer.dispose();
  });

  it('adds sparse instanced stumps without bloating draw calls', () => {
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
    const propMeshes = foliage.children.filter(child => child.name.startsWith('foliage-props')) as THREE.InstancedMesh[];

    expect(propMeshes).toHaveLength(1);
    expect(foliage.userData.terrainPropCount).toBeGreaterThan(0);
    expect(foliage.userData.terrainPropCount).toBeLessThanOrEqual(96);
    expect(propMeshes[0].name).toBe('foliage-props-stumps');
    expect(foliage.userData.terrainPropKindCount).toBe(1);

    for (const mesh of propMeshes) {
      expect(mesh.count).toBeGreaterThan(0);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    }

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
