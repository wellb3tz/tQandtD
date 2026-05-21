/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanetTextureGenerator } from './PlanetTextureGenerator';

interface TestCanvas extends HTMLCanvasElement {
  __imageData?: ImageData;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PlanetTextureGenerator', () => {
  it('generates surface, relief, roughness, and cloud textures', () => {
    installCanvasMock();

    const generator = new PlanetTextureGenerator(1234);
    const result = generator.generate(64, 32);

    expect(result.width).toBe(64);
    expect(result.height).toBe(32);
    expect(result.texture.width).toBe(64);
    expect(result.heightMap.width).toBe(64);
    expect(result.normalMap.width).toBe(64);
    expect(result.roughnessMap.width).toBe(64);
    expect(result.cloudTexture.width).toBe(64);

    const normalData = result.normalMap
      .getContext('2d')!
      .getImageData(0, 0, 64, 32).data;
    const cloudData = result.cloudTexture
      .getContext('2d')!
      .getImageData(0, 0, 64, 32).data;

    let hasReliefNormal = false;
    let hasCloudAlpha = false;
    for (let i = 0; i < normalData.length; i += 4) {
      if (normalData[i] !== 128 || normalData[i + 1] !== 128) {
        hasReliefNormal = true;
      }
      if (cloudData[i + 3] > 0) {
        hasCloudAlpha = true;
      }
    }

    expect(hasReliefNormal).toBe(true);
    expect(hasCloudAlpha).toBe(true);
  });
});

function installCanvasMock(): void {
  vi.spyOn(document, 'createElement').mockImplementation(tagName => {
    if (tagName.toLowerCase() !== 'canvas') {
      return document.createElement(tagName);
    }

    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        createImageData: (width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
          colorSpace: 'srgb',
        }),
        putImageData: (imageData: ImageData) => {
          canvas.__imageData = imageData;
        },
        getImageData: () => canvas.__imageData!,
      }),
    } as TestCanvas;

    return canvas;
  });
}
