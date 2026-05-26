import { describe, expect, it } from 'vitest';
import {
  applyChunkVisibility,
  applyRenderLayerVisibility,
  isRenderLayerVisible,
  RenderLayer,
  type RenderLayerChunk,
} from './RenderLayerVisibility';

describe('RenderLayerVisibility', () => {
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
      [RenderLayer.FOLIAGE, true],
      [RenderLayer.RESOURCES, true],
    ]);
    const chunk = createChunk();
    chunk.visible = true;

    applyRenderLayerVisibility(chunk, RenderLayer.TERRAIN, layers);

    expect(chunk.terrain.visible).toBe(false);
    expect(chunk.foliage?.visible).toBe(true);
    expect(chunk.resources?.visible).toBe(true);

    layers.set(RenderLayer.FOLIAGE, false);
    applyRenderLayerVisibility(chunk, RenderLayer.FOLIAGE, layers);

    expect(chunk.foliage?.visible).toBe(false);
    expect(chunk.terrain.visible).toBe(false);
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
