import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RenderLayer } from './RenderLayerVisibility';
import {
  calculateFrustumCullingStats,
  restoreChunkVisibility,
  updateFrustumCulledChunks,
  type FrustumChunk,
} from './FrustumCulling';

describe('FrustumCulling', () => {
  it('applies frustum visibility while respecting render layers', () => {
    const layerVisibility = new Map([[RenderLayer.TERRAIN, true]]);
    const visibleChunk = createChunk(new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)));
    const hiddenChunk = createChunk(new THREE.Box3(new THREE.Vector3(100, 100, 100), new THREE.Vector3(101, 101, 101)));
    const frustum = createUnitFrustum();

    updateFrustumCulledChunks([visibleChunk, hiddenChunk], frustum, layerVisibility, 0);

    expect(visibleChunk.visible).toBe(true);
    expect(visibleChunk.terrain.visible).toBe(true);
    expect(hiddenChunk.visible).toBe(false);
    expect(hiddenChunk.terrain.visible).toBe(false);
  });

  it('keeps nearby offscreen chunks visible so they can keep casting shadows', () => {
    const layerVisibility = new Map([[RenderLayer.TERRAIN, true]]);
    const shadowCaster = createChunk(new THREE.Box3(new THREE.Vector3(2, -1, -1), new THREE.Vector3(3, 1, 1)));
    const frustum = createUnitFrustum();

    updateFrustumCulledChunks([shadowCaster], frustum, layerVisibility, 2);

    expect(shadowCaster.visible).toBe(true);
    expect(shadowCaster.terrain.visible).toBe(true);
  });

  it('restores chunk visibility from layer settings when culling is disabled', () => {
    const layerVisibility = new Map([[RenderLayer.TERRAIN, false]]);
    const chunk = createChunk();
    chunk.visible = false;

    restoreChunkVisibility([chunk], layerVisibility);

    expect(chunk.visible).toBe(true);
    expect(chunk.terrain.visible).toBe(false);
  });

  it('calculates visible and hidden chunk counts', () => {
    const first = createChunk();
    const second = createChunk();
    first.visible = true;
    second.visible = false;

    expect(calculateFrustumCullingStats([first, second], true)).toEqual({
      enabled: true,
      visible: 1,
      hidden: 1,
      total: 2,
    });
  });
});

function createChunk(boundingBox?: THREE.Box3): FrustumChunk {
  return {
    terrain: new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()),
    boundingBox,
    visible: true,
  };
}

function createUnitFrustum(): THREE.Frustum {
  return new THREE.Frustum(
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 1),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), 1),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 1),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 1),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 1),
  );
}
