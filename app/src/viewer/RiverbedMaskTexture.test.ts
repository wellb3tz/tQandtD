import { describe, expect, it } from 'vitest';
import { BiomeType, type ChunkData } from '@engine/index';
import { createRiverbedMaskTexture } from './RiverbedMaskTexture';

describe('RiverbedMaskTexture', () => {
  it('rasterizes diagonal channels into a smooth per-pixel riverbed mask', () => {
    const texture = createRiverbedMaskTexture(createRiverChunk(), 16);
    const data = texture.image.data as Uint8Array;
    const center = (8 * 16 + 8) * 4;
    const corner = (15 * 16 + 0) * 4;

    expect(data[center]).toBeGreaterThan(220);
    expect(data[center + 1]).toBeGreaterThan(170);
    expect(data[center + 2]).toBeGreaterThan(170);
    expect(data[corner]).toBe(0);
  });
});

function createRiverChunk(): ChunkData {
  return {
    size: 4,
    heightmap: new Float32Array(25).fill(0.42),
    biomeMap: new Uint8Array(16).fill(BiomeType.PLAINS),
    rivers: [{
      riverId: 'river_1',
      pathId: 'river_1:main',
      isTributary: false,
      points: [
        { x: 0.25, y: 0.25, height: 0.42, surfaceLevel: 0.43, width: 1, depth: 0.04, channelWidth: 0.9, flowX: 1, flowY: 1 },
        { x: 3.75, y: 3.75, height: 0.40, surfaceLevel: 0.41, width: 1, depth: 0.04, channelWidth: 0.9, flowX: 1, flowY: 1 },
      ],
      bounds: { minX: 0.25, maxX: 3.75, minY: 0.25, maxY: 3.75 },
    }],
    resources: [],
    structures: [],
  } as unknown as ChunkData;
}
