/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BiomeType } from '../../../src';
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

    expect(uvs).toBeDefined();
    expect(uvs?.count).toBe(positions.count);
    expect(uvs?.getX(0)).toBe(0);
    expect(uvs?.getY(0)).toBe(0);
    expect(uvs?.getX(positions.count - 1)).toBe(1);
    expect(uvs?.getY(positions.count - 1)).toBe(1);
    expect(surfaceBlendA).toBeDefined();
    expect(surfaceBlendB).toBeDefined();
    expect(surfaceBlendA?.itemSize).toBe(4);
    expect(surfaceBlendB?.itemSize).toBe(1);
    expect(surfaceBlendA?.count).toBe(positions.count);
    expect(surfaceBlendB?.count).toBe(positions.count);

    const firstWeightSum =
      surfaceBlendA!.getX(0) +
      surfaceBlendA!.getY(0) +
      surfaceBlendA!.getZ(0) +
      surfaceBlendA!.getW(0) +
      surfaceBlendB!.getX(0);
    expect(firstWeightSum).toBeCloseTo(1);

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
    const rightBlendA = rightGeometry.getAttribute('surfaceBlendA') as THREE.BufferAttribute;
    const rightBlendB = rightGeometry.getAttribute('surfaceBlendB') as THREE.BufferAttribute;

    const leftSharedEdgeIndex = 1;
    const rightSharedEdgeIndex = 0;

    expect(leftBlendA.getX(leftSharedEdgeIndex)).toBeCloseTo(rightBlendA.getX(rightSharedEdgeIndex));
    expect(leftBlendA.getY(leftSharedEdgeIndex)).toBeCloseTo(rightBlendA.getY(rightSharedEdgeIndex));
    expect(leftBlendA.getZ(leftSharedEdgeIndex)).toBeCloseTo(rightBlendA.getZ(rightSharedEdgeIndex));
    expect(leftBlendA.getW(leftSharedEdgeIndex)).toBeCloseTo(rightBlendA.getW(rightSharedEdgeIndex));
    expect(leftBlendB.getX(leftSharedEdgeIndex)).toBeCloseTo(rightBlendB.getX(rightSharedEdgeIndex));
    expect(leftBlendA.getX(leftSharedEdgeIndex) + leftBlendA.getY(leftSharedEdgeIndex)).toBeCloseTo(1);

    viewer.dispose();
  });
});
