import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { BiomeType, type ChunkData } from '@engine/index';
import { clearFoliageGeometryCache } from './FoliageGeometryBuilder';
import { createFoliageLayer, ensureFoliageLodBuilt, setBuiltFoliageLodVisibility } from './FoliageLayerBuilder';
import { clearMushroomModelCache } from './MushroomModels';

afterEach(() => {
  clearFoliageGeometryCache();
  clearMushroomModelCache();
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

  it('adds rare collectible mushrooms to forest near LOD foliage', async () => {
    const layer = await createFoliageLayer(0, 0, createForestChunk(), 0.3);
    const mushrooms: THREE.InstancedMesh[] = [];
    layer?.traverse(child => {
      if (child instanceof THREE.InstancedMesh && child.userData.collectibleKind === 'mushroom') {
        mushrooms.push(child);
      }
    });

    expect(layer?.userData.mushroomCount).toBeGreaterThan(0);
    expect(mushrooms).toHaveLength(1);
    const mushroomLayer = mushrooms[0];
    expect(mushroomLayer.count).toBe(layer?.userData.mushroomCount);
    expect(mushroomLayer.userData.mushroomIds).toHaveLength(layer?.userData.mushroomCount);
    expect(mushroomLayer.userData.boostMultiplier).toBeGreaterThan(1);
  });

  it('keeps procedural tree shadows but disables expensive tree model shadow casting', async () => {
    const layer = await createFoliageLayer(0, 0, createForestChunk(), 0.3);
    const treeMeshes = layer?.children.flatMap(lod => lod.children.filter(child => child.name.startsWith('foliage-trees-'))) ?? [];
    const modelMeshes = treeMeshes.filter(mesh => mesh.name.endsWith('-model'));
    const proceduralMeshes = treeMeshes.filter(mesh => !mesh.name.endsWith('-model'));

    expect(treeMeshes.length).toBeGreaterThan(0);
    expect(modelMeshes.length).toBeGreaterThan(0);
    expect(modelMeshes.every(mesh => mesh.castShadow === false)).toBe(true);
    expect(proceduralMeshes.every(mesh => mesh.castShadow === true)).toBe(true);
    expect(treeMeshes.every(mesh => mesh.receiveShadow === true)).toBe(true);
  });

  it('adds palm tree model meshes for desert foliage', async () => {
    const layer = await createFoliageLayer(0, 0, createDesertChunk(), 0.3);
    const treeMeshes = layer?.children.flatMap(lod => lod.children.filter(child => child.name.startsWith('foliage-trees-'))) ?? [];

    expect(layer).toBeDefined();
    expect(layer?.userData.treeCount).toBeGreaterThan(0);
    expect(treeMeshes.map(mesh => mesh.name)).toContain('foliage-trees-palm-model');
    expect(treeMeshes.map(mesh => mesh.name)).not.toContain('foliage-trees-spruce-model');
    expect(layer?.userData.palmTreeModelCount).toBeGreaterThan(0);
    expect(layer?.userData.treeModelCount).toBeGreaterThan(0);
    expect(layer?.userData.mushroomCount).toBe(0);
  });

  it('adds shrub model meshes for sparse savanna shrubs', async () => {
    const layer = await createFoliageLayer(0, 0, createSavannaChunk(), 0.3);
    const shrubMeshes = layer?.children.flatMap(lod => lod.children.filter(child => child.name.startsWith('foliage-shrubs'))) ?? [];

    expect(layer).toBeDefined();
    expect(layer?.userData.treeCount).toBe(0);
    expect(layer?.userData.shrubCount).toBeGreaterThan(0);
    expect(shrubMeshes.map(mesh => mesh.name)).toContain('foliage-shrubs-shrub-model');
    expect(shrubMeshes.map(mesh => mesh.name)).not.toContain('foliage-shrubs');
    expect(layer?.userData.shrubModelCount).toBeGreaterThan(0);
    expect(layer?.userData.mushroomCount).toBe(0);
  });

  it('builds sparse simple LOD groups on demand for distant forest foliage', async () => {
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
    expect(mid.children.some(child => child.name.endsWith('-model'))).toBe(false);
    expect(far.children.some(child => child.name.endsWith('-model'))).toBe(false);
  });

  it('keeps palm tree model meshes across distant desert LODs', async () => {
    const layer = await createFoliageLayer(0, 0, createDesertChunk(), 0.3);
    const mid = ensureFoliageLodBuilt(layer!, 'mid')!;
    const far = ensureFoliageLodBuilt(layer!, 'far')!;

    expect(mid.children.some(child => child.name === 'foliage-trees-palm-model')).toBe(true);
    expect(far.children.some(child => child.name === 'foliage-trees-palm-model')).toBe(true);
  });

  it('can create a far-only initial foliage layer for streaming warmup', async () => {
    const layer = await createFoliageLayer(0, 0, createForestChunk(), 0.3, { initialLod: 'far' });

    expect(layer?.userData.activeLod).toBe('far');
    expect(layer?.children.map(child => child.name)).toEqual(['foliage-lod-far']);
    expect(layer?.children[0].visible).toBe(true);
    expect(layer?.children[0].children.some(child => child.name.endsWith('-model'))).toBe(false);
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

function createSavannaChunk(): ChunkData {
  const size = 32;
  return {
    size,
    heightmap: new Float32Array((size + 1) * (size + 1)).fill(0.5),
    biomeMap: new Uint8Array(size * size).fill(BiomeType.SAVANNA),
    resources: [],
    structures: [],
  } as unknown as ChunkData;
}
