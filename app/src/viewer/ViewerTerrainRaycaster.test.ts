import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ViewerTerrainRaycaster } from './ViewerTerrainRaycaster';
import type { ChunkMesh } from './ChunkMesh';
import type { RaycastHit } from '../utils/coordinates';

describe('ViewerTerrainRaycaster', () => {
  it('returns null before the viewer has a container', () => {
    const raycastTerrain = vi.fn();
    const raycaster = createRaycaster({
      getContainer: () => null,
      raycastTerrain,
    });

    expect(raycaster.raycast(10, 20)).toBeNull();
    expect(raycastTerrain).not.toHaveBeenCalled();
  });

  it('returns null when no terrain meshes are available', () => {
    const raycastTerrain = vi.fn();
    const raycaster = createRaycaster({
      chunks: [],
      raycastTerrain,
    });

    expect(raycaster.raycast(10, 20)).toBeNull();
    expect(raycastTerrain).not.toHaveBeenCalled();
  });

  it('passes terrain meshes and default terrain scale to the raycast utility', () => {
    const hit: RaycastHit = {
      point: { x: 1, y: 25, z: 2 },
      chunkX: 0,
      chunkY: 0,
      localX: 1,
      localY: 2,
      height: 0.5,
      distance: 10,
    };
    const raycastTerrain = vi.fn(() => hit);
    const terrain = new THREE.Mesh();
    const camera = new THREE.PerspectiveCamera();
    const canvas = createCanvas();
    const raycaster = createRaycaster({
      camera,
      canvas,
      chunks: [createChunk(terrain)],
      raycastTerrain,
    });

    expect(raycaster.raycast(10, 20)).toBe(hit);
    expect(raycastTerrain).toHaveBeenCalledWith(
      10,
      20,
      camera,
      canvas,
      [terrain],
      32,
      50
    );
  });
});

function createRaycaster(overrides: Partial<ConstructorParameters<typeof ViewerTerrainRaycaster>[0]> = {}) {
  return new ViewerTerrainRaycaster({
    camera: new THREE.PerspectiveCamera(),
    canvas: createCanvas(),
    chunks: [createChunk(new THREE.Mesh())],
    getContainer: () => createContainer(),
    ...overrides,
  });
}

function createChunk(terrain: THREE.Mesh): ChunkMesh {
  return { terrain };
}

function createCanvas(): HTMLCanvasElement {
  return {} as HTMLCanvasElement;
}

function createContainer(): HTMLElement {
  return {} as HTMLElement;
}
