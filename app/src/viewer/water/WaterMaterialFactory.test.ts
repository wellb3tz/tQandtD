import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  OCEAN_WAVE_SHADER_KEY,
  RIVER_WATER_NORMAL_TEXTURE_URL,
  WATER_NORMAL_SCALE,
  WATER_NORMAL_TEXTURE_URL,
  createOceanMaterial,
  createRiverWaterNormalTexture,
  createWaterNormalTexture,
  updateOceanMaterialWaves,
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
    expect(texture.repeat.x).toBe(3.7);
    expect(texture.repeat.y).toBe(5.3);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.version).toBe(0);
  });

  it('loads a denser repeatable river water normal texture', () => {
    const loader = {
      load: (url: string) => {
        const texture = new THREE.Texture();
        texture.userData.loadedUrl = url;
        return texture;
      },
    } as unknown as THREE.TextureLoader;

    const texture = createRiverWaterNormalTexture(loader);

    expect(texture.userData.loadedUrl).toBe(RIVER_WATER_NORMAL_TEXTURE_URL);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.repeat.x).toBeCloseTo(2.2);
    expect(texture.repeat.y).toBeCloseTo(10.5);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.anisotropy).toBe(8);
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
    expect(material.normalScale.x).toBeCloseTo(WATER_NORMAL_SCALE.x);
    expect(material.normalScale.y).toBeCloseTo(WATER_NORMAL_SCALE.y);
    expect(material.vertexColors).toBe(true);
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBeLessThan(0);
    expect(material.polygonOffsetUnits).toBeLessThan(0);
  });

  it('injects configurable ocean wave displacement into the shader', () => {
    const material = createOceanMaterial({
      enabled: true,
      color: 0x0d4f66,
      opacity: 0.66,
      shininess: 95,
      enableWaves: true,
      waveHeight: 0.35,
      waveSpeed: 0.85,
    });
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\nvec4 diffuseColor = vec4(1.0);\n#include <color_fragment>\n}',
    } as THREE.Shader;

    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    expect(material.customProgramCacheKey()).toBe(OCEAN_WAVE_SHADER_KEY);
    expect(shader.uniforms).toHaveProperty('uOceanWaveTime');
    expect(shader.uniforms).toHaveProperty('uOceanWaveShoreFadeStart');
    expect(shader.vertexShader).toContain('attribute float waterDepth');
    expect(shader.vertexShader).toContain('varying float vOceanWaterDepth');
    expect(shader.vertexShader).toContain('vOceanWaterDepth = waterDepth');
    expect(shader.fragmentShader).toContain('smoothstep(1.5, 14.0, vOceanWaterDepth)');
    expect(shader.fragmentShader).toContain('oceanSkyGlint');
    expect(shader.fragmentShader).toContain('diffuseColor.a = max(diffuseColor.a');
    expect(shader.vertexShader).toContain('smoothstep(uOceanWaveShoreFadeStart');
    expect(shader.vertexShader).toContain('oceanWaveSafeTrough');
    expect(shader.vertexShader).toContain('transformed.y +=');
    expect(shader.vertexShader).toContain('uOceanWaveHeight');
  });

  it('updates wave uniforms and scrolls ocean normal maps over time', () => {
    const normalMap = new THREE.Texture();
    const material = createOceanMaterial({
      enabled: true,
      color: 0x0d4f66,
      opacity: 0.66,
      shininess: 95,
      enableWaves: true,
      waveHeight: 0.4,
      waveSpeed: 2,
      normalMap,
    });
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
      fragmentShader: '',
    } as THREE.Shader;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    updateOceanMaterialWaves(material, {
      enabled: true,
      color: 0x0d4f66,
      opacity: 0.66,
      shininess: 95,
      enableWaves: true,
      waveHeight: 0.25,
      waveSpeed: 1.5,
      normalMap,
    }, 10);

    expect(shader.uniforms.uOceanWaveTime.value).toBe(10);
    expect(shader.uniforms.uOceanWaveHeight.value).toBe(0.25);
    expect(shader.uniforms.uOceanWaveSpeed.value).toBe(1.5);
    expect(normalMap.offset.x).toBeCloseTo(0.135);
    expect(normalMap.offset.y).toBeCloseTo(0.21);
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
    expect(material.specular.getHex()).toBe(0xd7f3ff);
  });
});
