/**
 * @vitest-environment happy-dom
 */
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanetRenderer } from './PlanetRenderer';

interface TestCanvas extends HTMLCanvasElement {
  __imageData?: ImageData;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PlanetRenderer', () => {
  it('builds a textured surface, cloud layer, and atmosphere', () => {
    installCanvasMock();

    const scene = new THREE.Scene();
    const renderer = new PlanetRenderer({ scene, seed: 42, radius: 50 });

    renderer.initialize();

    const surface = scene.getObjectByName('planet-surface') as THREE.Mesh;
    const clouds = scene.getObjectByName('planet-clouds') as THREE.Mesh;
    const atmosphere = scene.getObjectByName('planet-atmosphere') as THREE.Mesh;

    expect(surface).toBeInstanceOf(THREE.Mesh);
    expect(clouds).toBeInstanceOf(THREE.Mesh);
    expect(atmosphere).toBeInstanceOf(THREE.Mesh);

    const surfaceMaterial = surface.material as THREE.MeshStandardMaterial;
    expect(surfaceMaterial.map).toBeInstanceOf(THREE.CanvasTexture);
    expect(surfaceMaterial.displacementMap).toBeInstanceOf(THREE.CanvasTexture);
    expect(surfaceMaterial.normalMap).toBeInstanceOf(THREE.CanvasTexture);
    expect(surfaceMaterial.roughnessMap).toBeInstanceOf(THREE.CanvasTexture);

    const cloudMaterial = clouds.material as THREE.MeshStandardMaterial;
    expect(cloudMaterial.map).toBeInstanceOf(THREE.CanvasTexture);
    expect(cloudMaterial.transparent).toBe(true);

    renderer.show();
    expect(surface.visible).toBe(true);
    expect(clouds.visible).toBe(true);
    expect(atmosphere.visible).toBe(true);

    renderer.dispose();
    expect(scene.getObjectByName('planet-surface')).toBeUndefined();
    expect(scene.getObjectByName('planet-clouds')).toBeUndefined();
    expect(scene.getObjectByName('planet-atmosphere')).toBeUndefined();
  });
});

function installCanvasMock(): void {
  vi.spyOn(document, 'createElement').mockImplementation(tagName => {
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
