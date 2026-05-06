import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ViewerRenderStatsCache } from './ViewerRenderStatsCache';
import type { RenderStatsChunk } from './RenderStatsCalculator';

describe('ViewerRenderStatsCache', () => {
  it('reuses stats while they are inside the cache window', () => {
    let now = 0;
    const chunks = [createChunk(4)];
    const cache = new ViewerRenderStatsCache(chunks, 1000, () => now);

    const first = cache.getRenderStats();
    chunks.push(createChunk(8));
    now = 500;

    expect(cache.getRenderStats()).toBe(first);
  });

  it('refreshes stats after the cache window expires', () => {
    let now = 0;
    const chunks = [createChunk(4)];
    const cache = new ViewerRenderStatsCache(chunks, 1000, () => now);

    expect(cache.getRenderStats()).toEqual({ vertexCount: 4, drawCalls: 1 });
    chunks.push(createChunk(8));
    now = 1000;

    expect(cache.getRenderStats()).toEqual({ vertexCount: 12, drawCalls: 2 });
  });

  it('refreshes stats immediately after invalidation', () => {
    let now = 0;
    const chunks = [createChunk(4)];
    const cache = new ViewerRenderStatsCache(chunks, 1000, () => now);

    expect(cache.getRenderStats()).toEqual({ vertexCount: 4, drawCalls: 1 });
    chunks.push(createChunk(8));
    cache.invalidate();

    expect(cache.getRenderStats()).toEqual({ vertexCount: 12, drawCalls: 2 });
  });
});

function createChunk(vertexCount: number): RenderStatsChunk {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));

  return {
    terrain: new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()),
  };
}
