import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { BiomeType, type ChunkData } from '@engine/index';
import { clearFoliageGeometryCache } from './FoliageGeometryBuilder';
import { createFoliageLayer } from './FoliageLayerBuilder';

afterEach(() => {
  clearFoliageGeometryCache();
});

describe('FoliageLayerBuilder', () => {
  it('creates named instanced foliage layers with aggregate userData', () => {
    const layer = createFoliageLayer(0, 0, createForestChunk(), 0.3);

    expect(layer).toBeDefined();
    expect(layer?.name).toBe('foliage-0,0');
    expect(layer?.userData.foliageCount).toBeGreaterThan(0);
    expect(layer?.userData.treeCount).toBeGreaterThan(0);
    expect(layer?.children.every(child => child instanceof THREE.InstancedMesh)).toBe(true);
    expect(layer?.children.some(child => child.name.startsWith('foliage-trees-'))).toBe(true);
  });

  it('keeps tree instances shadow-enabled', () => {
    const layer = createFoliageLayer(0, 0, createForestChunk(), 0.3);
    const treeMeshes = layer?.children.filter(child => child.name.startsWith('foliage-trees-')) ?? [];

    expect(treeMeshes.length).toBeGreaterThan(0);
    expect(treeMeshes.every(mesh => mesh.castShadow === true)).toBe(true);
    expect(treeMeshes.every(mesh => mesh.receiveShadow === true)).toBe(true);
  });
});

function createForestChunk(): ChunkData {
  const size = 8;
  return {
    size,
    heightmap: new Float32Array((size + 1) * (size + 1)).fill(0.5),
    biomeMap: new Uint8Array(size * size).fill(BiomeType.FOREST),
    resources: [],
    structures: [],
  } as unknown as ChunkData;
}
