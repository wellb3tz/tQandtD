import { describe, expect, it } from 'vitest';
import {
  RenderStatsCache,
  calculateRenderStats,
  type RenderStatsChunk,
  type RenderStatsGeometryAttribute,
} from '../src';

describe('render stats helpers', () => {
  it('counts visible terrain vertices and layer draw calls', () => {
    const chunk = createChunk(4);
    chunk.foliage = { visible: true, children: [createDrawObject(), createDrawObject()] };
    chunk.resources = { visible: true, children: [createDrawObject()] };
    chunk.structures = { visible: false, children: [createDrawObject()] };
    chunk.boundaries = { visible: true };

    expect(calculateRenderStats([chunk])).toEqual({ vertexCount: 4, drawCalls: 5 });
  });

  it('counts nested visible layer draw calls', () => {
    const chunk = createChunk(4);
    chunk.foliage = {
      visible: true,
      children: [
        { visible: false, children: [createDrawObject()] },
        { visible: true, children: [createDrawObject(), createDrawObject()] },
      ],
    };

    expect(calculateRenderStats([chunk])).toEqual({ vertexCount: 4, drawCalls: 3 });
  });

  it('ignores hidden terrain vertices and hidden layer draw calls', () => {
    const chunk = createChunk(4);
    chunk.terrain.visible = false;
    chunk.resources = { visible: false, children: [createDrawObject()] };

    expect(calculateRenderStats([chunk])).toEqual({ vertexCount: 0, drawCalls: 0 });
  });

  it('caches render stats until invalidated or expired', () => {
    let now = 0;
    const chunks = [createChunk(4)];
    const cache = new RenderStatsCache(chunks, 1000, () => now);

    const first = cache.getRenderStats();
    chunks.push(createChunk(8));
    now = 500;
    expect(cache.getRenderStats()).toBe(first);

    now = 1000;
    expect(cache.getRenderStats()).toEqual({ vertexCount: 12, drawCalls: 2 });

    chunks.push(createChunk(2));
    cache.invalidate();
    expect(cache.getRenderStats()).toEqual({ vertexCount: 14, drawCalls: 3 });
  });
});

function createChunk(vertexCount: number): RenderStatsChunk {
  const attribute: RenderStatsGeometryAttribute = { count: vertexCount };
  return {
    terrain: {
      visible: true,
      geometry: {
        getAttribute: (name: string) => name === 'position' ? attribute : undefined,
      },
      userData: {},
    },
  };
}

function createDrawObject() {
  return {
    visible: true,
    geometry: {
      getAttribute: () => undefined,
    },
  };
}
