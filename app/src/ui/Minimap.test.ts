import { describe, expect, it } from 'vitest';
import { paintMinimapLakes, paintMinimapUnloadedTerrain, type MinimapChunk } from './Minimap';

function createImageData(width: number, height: number, fill = 40): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill;
    data[i + 1] = fill;
    data[i + 2] = fill;
    data[i + 3] = 255;
  }
  return { width, height, data } as ImageData;
}

function createChunk(partial: Partial<MinimapChunk>): MinimapChunk {
  return {
    x: 0,
    y: 0,
    size: 4,
    heightmap: new Float32Array(25),
    biomeMap: new Uint8Array(16),
    ...partial,
  };
}

describe('Minimap water overlay', () => {
  it('fills unloaded map cells with a muted placeholder instead of transparent black', () => {
    const pixels = createImageData(3, 3, 0);

    paintMinimapUnloadedTerrain(pixels, 3);

    expect(Array.from(pixels.data.slice(0, 4))).toEqual([12, 29, 33, 255]);
    expect(Array.from(pixels.data.slice(8, 12))).toEqual([8, 20, 23, 255]);
  });

  it('tints lake tiles on top of terrain pixels', () => {
    const pixels = createImageData(4, 4);
    const chunk = createChunk({
      lakes: [{
        waterLevel: 0.5,
        tiles: new Set([5]),
        maxDepth: 0.1,
      }],
    });

    paintMinimapLakes(pixels, 4, chunk, 0, 0, 4);

    const lakePixel = (1 * 4 + 1) * 4;
    const untouchedPixel = 0;
    expect(Array.from(pixels.data.slice(lakePixel, lakePixel + 4))).toEqual([28, 89, 110, 255]);
    expect(Array.from(pixels.data.slice(untouchedPixel, untouchedPixel + 4))).toEqual([40, 40, 40, 255]);
  });

  it('uses multi-chunk lake surface tiles when they are available', () => {
    const pixels = createImageData(4, 4);
    const chunk = createChunk({
      lakes: [{
        waterLevel: 0.5,
        tiles: new Set([0]),
        surfaceTiles: new Set([10]),
        maxDepth: 0.1,
      }],
    });

    paintMinimapLakes(pixels, 4, chunk, 0, 0, 4);

    const basinPixel = 0;
    const surfacePixel = (2 * 4 + 2) * 4;
    expect(Array.from(pixels.data.slice(basinPixel, basinPixel + 4))).toEqual([40, 40, 40, 255]);
    expect(Array.from(pixels.data.slice(surfacePixel, surfacePixel + 4))).toEqual([28, 89, 110, 255]);
  });
});
