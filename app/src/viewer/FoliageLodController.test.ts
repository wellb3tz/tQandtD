import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ChunkMesh } from './ChunkMesh';
import {
  selectFoliageLodLevel,
  updateFoliageLodForChunks,
} from './FoliageLodController';
import { FOLIAGE_LOD_DISTANCE_METERS } from './FoliageLayerBuilder';
import { RenderLayer } from './RenderLayerVisibility';

describe('FoliageLodController', () => {
  it('selects foliage LOD levels by distance', () => {
    expect(selectFoliageLodLevel(0)).toBe('near');
    expect(selectFoliageLodLevel(FOLIAGE_LOD_DISTANCE_METERS.mid)).toBe('mid');
    expect(selectFoliageLodLevel(FOLIAGE_LOD_DISTANCE_METERS.far)).toBe('far');
    expect(selectFoliageLodLevel(FOLIAGE_LOD_DISTANCE_METERS.hidden)).toBeUndefined();
  });

  it('keeps only the active foliage LOD group', () => {
    const foliage = createFoliageGroup(FOLIAGE_LOD_DISTANCE_METERS.far, 0);
    const chunk = { terrain: new THREE.Mesh(), foliage, visible: true } as ChunkMesh;
    const stats = updateFoliageLodForChunks(
      [chunk],
      new THREE.Vector3(0, 0, 0),
      createLayerVisibility(),
    );

    expect(stats).toEqual({ near: 0, mid: 0, far: 1, hidden: 0 });
    expect(foliage.children.map(child => child.userData.foliageLod)).toEqual(['far']);
    expect(foliage.children.map(child => child.visible)).toEqual([true]);
    expect(foliage.userData.activeLod).toBe('far');
  });

  it('hides foliage LOD groups when the foliage layer is disabled', () => {
    const foliage = createFoliageGroup(0, 0);
    const layerVisibility = createLayerVisibility();
    layerVisibility.set(RenderLayer.FOLIAGE, false);

    const stats = updateFoliageLodForChunks(
      [{ terrain: new THREE.Mesh(), foliage, visible: true } as ChunkMesh],
      new THREE.Vector3(0, 0, 0),
      layerVisibility,
    );

    expect(stats.hidden).toBe(1);
    expect(foliage.children).toHaveLength(0);
  });

  it('keeps the active LOD intact while a chunk is hidden by frustum culling', () => {
    const foliage = createFoliageGroup(0, 0);
    const stats = updateFoliageLodForChunks(
      [{ terrain: new THREE.Mesh(), foliage, visible: false } as ChunkMesh],
      new THREE.Vector3(0, 0, 0),
      createLayerVisibility(),
    );

    expect(stats.hidden).toBe(1);
    expect(foliage.children.map(child => child.visible)).toEqual([true, false, false]);
    expect(foliage.userData.activeLod).toBe('near');
  });
});

function createFoliageGroup(centerX: number, centerZ: number): THREE.Group {
  const group = new THREE.Group();
  group.visible = true;
  group.userData.lodEnabled = true;
  group.userData.activeLod = 'near';
  group.userData.chunkCenterX = centerX;
  group.userData.chunkCenterZ = centerZ;

  for (const lod of ['near', 'mid', 'far']) {
    const child = new THREE.Group();
    child.userData.foliageLod = lod;
    child.visible = lod === 'near';
    group.add(child);
  }

  return group;
}

function createLayerVisibility(): Map<RenderLayer, boolean> {
  return new Map(Object.values(RenderLayer).map(layer => [layer, true]));
}
