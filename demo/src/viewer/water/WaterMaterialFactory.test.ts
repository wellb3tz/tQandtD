import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  WATER_NORMAL_TEXTURE_URL,
  createOceanMaterial,
  createWaterNormalTexture,
} from './WaterMaterialFactory';

describe('WaterMaterialFactory', () => {
  it('loads a repeatable water normal texture', () => {
    const loader = {
      load: (url: string) => {
        const texture = new THREE.Texture();
        texture.userData.loadedUrl = url;
        return texture;
      },
    } as unknown as THREE.TextureLoader;

    const texture = createWaterNormalTexture(loader);

    expect(texture.userData.loadedUrl).toBe(WATER_NORMAL_TEXTURE_URL);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.repeat.x).toBe(6);
    expect(texture.repeat.y).toBe(6);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.version).toBe(0);
  });

  it('applies water normal maps without tinting depth vertex colors', () => {
    const normalMap = new THREE.Texture();

    const material = createOceanMaterial({
      enabled: true,
      color: 0x1e90ff,
      opacity: 0.72,
      shininess: 80,
      enableWaves: true,
      waveHeight: 0.5,
      waveSpeed: 1,
      normalMap,
    });

    expect(material.normalMap).toBe(normalMap);
    expect(material.vertexColors).toBe(true);
    expect(material.color.getHex()).toBe(0xffffff);
  });

  it('uses a darker glossier water profile while preserving cheap vertex-color depth gradients', () => {
    const material = createOceanMaterial({
      enabled: true,
      color: 0x0d4f66,
      opacity: 0.66,
      shininess: 95,
      enableWaves: false,
      waveHeight: 0,
      waveSpeed: 0,
    });

    expect(material.vertexColors).toBe(true);
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.opacity).toBeLessThanOrEqual(0.68);
    expect(material.shininess).toBeGreaterThanOrEqual(95);
    expect(material.specular.getHex()).toBe(0xa8e6ff);
  });
});
