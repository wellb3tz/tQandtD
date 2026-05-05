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
});
