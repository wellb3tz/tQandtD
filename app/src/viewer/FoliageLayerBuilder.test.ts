import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { BiomeType, type ChunkData } from '@engine/index';
import { clearFoliageGeometryCache } from './FoliageGeometryBuilder';
import { createFoliageLayer, ensureFoliageLodBuilt, setBuiltFoliageLodVisibility } from './FoliageLayerBuilder';

afterEach(() => {
  clearFoliageGeometryCache();
});

describe('FoliageLayerBuilder', () => {
  it('creates named instanced foliage layers with aggregate userData', async () => {
    const layer = await createFoliageLayer(0, 0, createForestChunk(), 0.3);

    expect(layer).toBeDefined();
    expect(layer?.name).toBe('foliage-0,0');
    expect(layer?.userData.foliageCount).toBeGreaterThan(0);
    expect(layer?.userData.treeCount).toBeGreaterThan(0);
    expect(layer?.children.every(child => child instanceof THREE.Group)).toBe(true);
    expect(layer?.children.map(child => child.name)).toEqual(['foliage-lod-near']);
    expect(layer?.children.some(lod => lod.children.some(child => child.name.startsWith('foliage-trees-')))).toBe(true);
  });

  it('keeps procedural tree shadows but disables expensive spruce shadow casting', async () => {
    const layer = await createFoliageLayer(0, 0, createForestChunk(), 0.3);
    const treeMeshes = layer?.children.flatMap(lod => lod.children.filter(child => child.name.startsWith('foliage-trees-'))) ?? [];
    const spruceMesh = treeMeshes.find(mesh => mesh.name === 'foliage-trees-spruce');
    const proceduralMeshes = treeMeshes.filter(mesh => mesh.name !== 'foliage-trees-spruce');

    expect(treeMeshes.length).toBeGreaterThan(0);
    expect(spruceMesh?.castShadow).toBe(false);
    expect(proceduralMeshes.every(mesh => mesh.castShadow === true)).toBe(true);
    expect(treeMeshes.every(mesh => mesh.receiveShadow === true)).toBe(true);
  });

  it('adds a limited spruce tree mesh for close foliage', async () => {
    const layer = await createFoliageLayer(0, 0, createDesertChunk(), 0.3);
    const treeMeshes = layer?.children.flatMap(lod => lod.children.filter(child => child.name.startsWith('foliage-trees-'))) ?? [];

    expect(layer).toBeDefined();
    expect(layer?.userData.treeCount).toBeGreaterThan(0);
    expect(treeMeshes.map(mesh => mesh.name)).toContain('foliage-trees-spruce');
    expect(layer?.userData.treeModelCount).toBeGreaterThan(0);
  });

  it('builds sparse simple LOD groups on demand for distant foliage', async () => {
    const layer = await createFoliageLayer(0, 0, createForestChunk(), 0.3);
    const near = layer?.children[0] as THREE.Group;
    const mid = ensureFoliageLodBuilt(layer!, 'mid')!;
    const far = ensureFoliageLodBuilt(layer!, 'far')!;
    setBuiltFoliageLodVisibility(layer!, 'far');

    const nearInstances = countInstances(near);
    const midInstances = countInstances(mid);
    const farInstances = countInstances(far);

    expect(layer?.userData.lodEnabled).toBe(true);
    expect(near.visible).toBe(false);
    expect(mid.visible).toBe(false);
    expect(far.visible).toBe(true);
    expect(midInstances).toBeLessThan(nearInstances);
    expect(farInstances).toBeLessThan(midInstances);
    expect(mid.children.some(child => child.name === 'foliage-trees-spruce')).toBe(false);
    expect(far.children.some(child => child.name === 'foliage-trees-spruce')).toBe(false);
  });

  it('can create a far-only initial foliage layer for streaming warmup', async () => {
    const layer = await createFoliageLayer(0, 0, createForestChunk(), 0.3, { initialLod: 'far' });

    expect(layer?.userData.activeLod).toBe('far');
    expect(layer?.children.map(child => child.name)).toEqual(['foliage-lod-far']);
    expect(layer?.children[0].visible).toBe(true);
    expect(layer?.children[0].children.some(child => child.name === 'foliage-trees-spruce')).toBe(false);
  });
});

function countInstances(group: THREE.Group): number {
  return group.children.reduce((count, child) => {
    if (child instanceof THREE.InstancedMesh) {
      return count + child.count;
    }
    return count;
  }, 0);
}

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

function createDesertChunk(): ChunkData {
  const size = 64;
  return {
    size,
    heightmap: new Float32Array((size + 1) * (size + 1)).fill(0.5),
    biomeMap: new Uint8Array(size * size).fill(BiomeType.DESERT),
    resources: [],
    structures: [],
  } as unknown as ChunkData;
}
