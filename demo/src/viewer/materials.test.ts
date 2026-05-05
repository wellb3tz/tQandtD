import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BiomeType } from '../../../src';
import {
  TERRAIN_ALBEDO_TEXTURE_URL,
  TERRAIN_ALBEDO_ATLAS_TEXTURE_URL,
  TERRAIN_SURFACE_TEXTURE_URLS,
  TERRAIN_NORMAL_TEXTURE_URL,
  TERRAIN_ROUGHNESS_TEXTURE_URL,
  createTexturedTerrainMaterial,
  createBiomeColorTerrainMaterial,
  createTerrainBlendMaterial,
  createTerrainSurfaceTextureLibrary,
  createTerrainTextureSet,
  selectTerrainSurfaceKey,
} from './materials';

describe('terrain texture materials', () => {
  it('loads terrain surface maps as repeatable textures', () => {
    const loadedUrls: string[] = [];
    const loader = {
      load: (url: string) => {
        const texture = new THREE.Texture();
        texture.userData.loadedUrl = url;
        loadedUrls.push(url);
        return texture;
      },
    } as unknown as THREE.TextureLoader;

    const textures = createTerrainTextureSet(loader);

    expect(loadedUrls).toEqual([
      TERRAIN_ALBEDO_TEXTURE_URL,
      TERRAIN_NORMAL_TEXTURE_URL,
      TERRAIN_ROUGHNESS_TEXTURE_URL,
    ]);
    for (const texture of [textures.albedo, textures.normal, textures.roughness]) {
      expect(texture.wrapS).toBe(THREE.MirroredRepeatWrapping);
      expect(texture.wrapT).toBe(THREE.MirroredRepeatWrapping);
      expect(texture.repeat.x).toBe(4);
      expect(texture.repeat.y).toBe(4);
    }
    expect(textures.albedo.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(textures.normal.colorSpace).toBe(THREE.NoColorSpace);
    expect(textures.roughness.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('loads biome/detail surface texture sets with stable URLs', () => {
    const loadedUrls: string[] = [];
    const loader = {
      load: (url: string) => {
        const texture = new THREE.Texture();
        loadedUrls.push(url);
        return texture;
      },
    } as unknown as THREE.TextureLoader;

    const library = createTerrainSurfaceTextureLibrary(loader);

    expect(Object.keys(library)).toEqual([
      'plains',
      'desert',
      'beach',
      'mountainRock',
      'snow',
      'forestFloor',
      'dryGrass',
      'swampMud',
      'volcanicRock',
      'ice',
      'riverbed',
      'albedoAtlas',
    ]);
    expect(loadedUrls).toContain(TERRAIN_SURFACE_TEXTURE_URLS.desert.albedo);
    expect(loadedUrls).toContain(TERRAIN_SURFACE_TEXTURE_URLS.beach.normal);
    expect(loadedUrls).toContain(TERRAIN_SURFACE_TEXTURE_URLS.mountainRock.roughness);
    expect(loadedUrls).toContain(TERRAIN_SURFACE_TEXTURE_URLS.snow.albedo);
    expect(loadedUrls).toContain(TERRAIN_SURFACE_TEXTURE_URLS.forestFloor.albedo);
    expect(loadedUrls).toContain(TERRAIN_SURFACE_TEXTURE_URLS.volcanicRock.normal);
    expect(loadedUrls).toContain(TERRAIN_SURFACE_TEXTURE_URLS.riverbed.roughness);
    expect(loadedUrls).toContain(TERRAIN_ALBEDO_ATLAS_TEXTURE_URL);
    expect(library.albedoAtlas.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(library.albedoAtlas.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(library.albedoAtlas.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(library.albedoAtlas.minFilter).toBe(THREE.NearestFilter);
    expect(library.albedoAtlas.magFilter).toBe(THREE.NearestFilter);
    expect(library.albedoAtlas.version).toBe(0);
    expect(library.desert.albedo.wrapS).toBe(THREE.MirroredRepeatWrapping);
    expect(library.ice.roughness.colorSpace).toBe(THREE.NoColorSpace);
    expect(library.desert.albedo.version).toBe(0);
  });

  it('selects terrain surface keys from biome, elevation, and slope context', () => {
    expect(selectTerrainSurfaceKey(BiomeType.DESERT, 0.35, 0.1)).toBe('desert');
    expect(selectTerrainSurfaceKey(BiomeType.BEACH, 0.32, 0.1)).toBe('beach');
    expect(selectTerrainSurfaceKey(BiomeType.MOUNTAIN, 0.72, 0.2)).toBe('mountainRock');
    expect(selectTerrainSurfaceKey(BiomeType.MOUNTAIN, 0.82, 0.2)).toBe('snow');
    expect(selectTerrainSurfaceKey(BiomeType.FOREST, 0.45, 0.7)).toBe('mountainRock');
    expect(selectTerrainSurfaceKey(BiomeType.FOREST, 0.45, 0.2)).toBe('forestFloor');
    expect(selectTerrainSurfaceKey(BiomeType.SAVANNA, 0.35, 0.1)).toBe('dryGrass');
    expect(selectTerrainSurfaceKey(BiomeType.SWAMP, 0.34, 0.1)).toBe('swampMud');
    expect(selectTerrainSurfaceKey(BiomeType.VOLCANIC, 0.58, 0.1)).toBe('volcanicRock');
    expect(selectTerrainSurfaceKey(BiomeType.GLACIER, 0.5, 0.1)).toBe('ice');
    expect(selectTerrainSurfaceKey(BiomeType.PLAINS, 0.4, 0.1)).toBe('plains');
  });

  it('keeps biome vertex colors when applying terrain surface maps', () => {
    const textures = {
      albedo: new THREE.Texture(),
      normal: new THREE.Texture(),
      roughness: new THREE.Texture(),
    };

    const material = createTexturedTerrainMaterial(textures, true);

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.map).toBe(textures.albedo);
    expect(material.normalMap).toBe(textures.normal);
    expect(material.roughnessMap).toBe(textures.roughness);
    expect(material.vertexColors).toBe(true);
    expect(material.wireframe).toBe(true);
    expect(material.color.r).toBeGreaterThan(2);
    expect(material.color.g).toBeGreaterThan(2);
    expect(material.color.b).toBeGreaterThan(2);
    expect(material.normalScale.x).toBeLessThan(1);
    expect(material.normalScale.y).toBeLessThan(1);
    expect(material.roughness).toBe(0.85);
    expect(material.metalness).toBe(0);
    expect(material.userData.terrainTexturesEnabled).toBe(true);
  });

  it('creates a biome-color-only terrain material for disabling texture maps', () => {
    const material = createBiomeColorTerrainMaterial(true);

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.map).toBeNull();
    expect(material.normalMap).toBeNull();
    expect(material.roughnessMap).toBeNull();
    expect(material.vertexColors).toBe(true);
    expect(material.wireframe).toBe(true);
    expect(material.roughness).toBe(0.85);
    expect(material.metalness).toBe(0);
    expect(material.userData.terrainTexturesEnabled).toBe(false);
  });

  it('installs shader hooks for per-vertex terrain surface albedo, roughness, and detail blending', () => {
    const library = {
      plains: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      desert: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      beach: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      mountainRock: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      snow: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      forestFloor: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      dryGrass: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      swampMud: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      volcanicRock: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      ice: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      riverbed: { albedo: new THREE.Texture(), normal: new THREE.Texture(), roughness: new THREE.Texture() },
      albedoAtlas: new THREE.Texture(),
    };
    const material = createTerrainBlendMaterial(library, false);
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <uv_vertex>',
      fragmentShader: '#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>',
    } as unknown as THREE.Shader;

    material.onBeforeCompile(shader);

    expect(shader.uniforms.terrainAlbedoAtlas.value).toBe(library.albedoAtlas);
    expect(shader.uniforms.terrainAlbedoPlains).toBeUndefined();
    expect(shader.uniforms.terrainAlbedoSnow).toBeUndefined();
    expect(shader.uniforms.terrainAlbedoForestFloor).toBeUndefined();
    expect(shader.uniforms.terrainRoughnessRiverbed).toBeUndefined();
    expect(shader.vertexShader).toContain('attribute vec4 surfaceBlendA');
    expect(shader.vertexShader).toContain('attribute vec4 surfaceBlendB');
    expect(shader.vertexShader).toContain('attribute vec4 surfaceBlendC');
    expect(shader.vertexShader).toContain('attribute vec4 terrainDetailBlend');
    expect(shader.vertexShader).toContain('varying vec4 vSurfaceBlendA');
    expect(shader.fragmentShader).toContain('terrainAlbedoAtlas');
    expect(shader.fragmentShader).toContain('sampleTerrainAtlasTile');
    expect(shader.fragmentShader).toContain('mirrorTerrainAtlasUv');
    expect(shader.fragmentShader).not.toContain('fract(uv)');
    expect(shader.fragmentShader).toContain('considerTerrainAtlasTile');
    expect(shader.fragmentShader).toContain('atlasTilePixels = vec2(256.0, 256.0)');
    expect(shader.fragmentShader).toContain('terrainDetailContrast');
    expect(shader.fragmentShader).toContain('surfaceRoughnessBlend');
    expect(shader.fragmentShader).toContain('vTerrainDetailBlend');
    expect(shader.fragmentShader).not.toContain('terrainAlbedoMountainRock');
    expect(shader.fragmentShader).not.toContain('terrainRoughnessMountainRock');
    expect(shader.fragmentShader).not.toContain('blendedTerrainRoughness');
    expect(shader.fragmentShader).toContain('wetShorelineTint');
    expect(shader.fragmentShader).toContain('riverbedTint');
    expect(shader.fragmentShader).toContain('forestFloorTint');
    expect(shader.fragmentShader).not.toContain('forestCanopyTexture');
    expect(shader.fragmentShader).not.toContain('smoothstep(0.46, 0.08');
    expect(shader.fragmentShader).toContain('vTerrainDetailBlend.w');
    expect(shader.fragmentShader).toContain('roughnessFactor = mix');
    expect(shader.fragmentShader).toContain('vSurfaceBlendB');
    expect(material.vertexColors).toBe(true);
    expect(material.userData.terrainTexturesEnabled).toBe(true);
    const samplerCount = (shader.fragmentShader.match(/uniform sampler2D/g) ?? []).length;
    expect(samplerCount).toBeLessThanOrEqual(4);
    const atlasSampleCallCount = (shader.fragmentShader.match(/sampleTerrainAtlasTile\(/g) ?? []).length - 1;
    expect(atlasSampleCallCount).toBeLessThanOrEqual(2);
  });
});
