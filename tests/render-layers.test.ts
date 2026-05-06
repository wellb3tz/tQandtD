import { describe, expect, it } from 'vitest';
import {
  RenderLayer,
  applyChunkVisibility,
  applyRenderLayerVisibility,
  isRenderLayerVisible,
  type RenderLayerChunk,
} from '../src';

describe('render layer visibility helpers', () => {
  it('treats unset layers as visible', () => {
    expect(isRenderLayerVisible(new Map(), RenderLayer.TERRAIN)).toBe(true);
  });

  it('applies layer visibility together with frustum visibility', () => {
    const layers = new Map<RenderLayer, boolean>([
      [RenderLayer.TERRAIN, true],
      [RenderLayer.RESOURCES, false],
      [RenderLayer.STRUCTURES, true],
      [RenderLayer.CHUNK_BOUNDARIES, false],
    ]);
    const chunk = createChunk();

    applyChunkVisibility(chunk, layers, true);

    expect(chunk.visible).toBe(true);
    expect(chunk.terrain.visible).toBe(true);
    expect(chunk.foliage?.visible).toBe(true);
    expect(chunk.resources?.visible).toBe(false);
    expect(chunk.structures?.visible).toBe(true);
    expect(chunk.boundaries?.visible).toBe(false);

    applyChunkVisibility(chunk, layers, false);

    expect(chunk.visible).toBe(false);
    expect(chunk.terrain.visible).toBe(false);
    expect(chunk.foliage?.visible).toBe(false);
    expect(chunk.structures?.visible).toBe(false);
  });

  it('updates only the requested render layer', () => {
    const layers = new Map<RenderLayer, boolean>([
      [RenderLayer.TERRAIN, false],
      [RenderLayer.RESOURCES, true],
    ]);
    const chunk = createChunk();
    chunk.visible = true;

    applyRenderLayerVisibility(chunk, RenderLayer.TERRAIN, layers);

    expect(chunk.terrain.visible).toBe(false);
    expect(chunk.foliage?.visible).toBe(false);
    expect(chunk.resources?.visible).toBe(true);
  });
});

function createChunk(): RenderLayerChunk {
  return {
    terrain: { visible: true },
    foliage: { visible: true },
    resources: { visible: true },
    structures: { visible: true },
    boundaries: { visible: true },
  };
}
