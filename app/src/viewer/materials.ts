/**
 * Materials and color mapping for biome-based terrain rendering
 * 
 * Provides comprehensive biome color definitions and utilities for
 * smooth color blending between biomes based on blend weights.
 */

import { BiomeType } from '@engine/index';
import * as THREE from 'three';
import {
  clamp01,
  selectTerrainSurfaceKey,
  type TerrainSurfaceKey,
} from './terrain-geometry-types';

export { clamp01, selectTerrainSurfaceKey, type TerrainSurfaceKey } from './terrain-geometry-types';

export const TERRAIN_ALBEDO_TEXTURE_URL = '/textures/terrain-albedo-v1.png';
export const TERRAIN_NORMAL_TEXTURE_URL = '/textures/terrain-normal-v1.png';
export const TERRAIN_ROUGHNESS_TEXTURE_URL = '/textures/terrain-roughness-v1.png';
export const TERRAIN_ALBEDO_ATLAS_TEXTURE_URL = '/textures/terrain-albedo-atlas-v5.png';
export const TERRAIN_NORMAL_ATLAS_TEXTURE_URL = '/textures/terrain-normal-atlas-v4.png';
const TERRAIN_TEXTURE_VERTEX_COLOR_BOOST = 1.34;
const EMPTY_RIVERBED_MASK_TEXTURE = createEmptyRiverbedMaskTexture();

export interface TerrainTextureSet {
  albedo: THREE.Texture;
  normal: THREE.Texture;
  roughness: THREE.Texture;
}

export type TerrainSurfaceTextureLibrary = Record<TerrainSurfaceKey, TerrainTextureSet> & {
  albedoAtlas: THREE.Texture;
  normalAtlas: THREE.Texture;
};

export const TERRAIN_SURFACE_TEXTURE_URLS: Record<TerrainSurfaceKey, TerrainTextureSetUrls> = {
  plains: {
    albedo: TERRAIN_ALBEDO_TEXTURE_URL,
    normal: TERRAIN_NORMAL_TEXTURE_URL,
    roughness: TERRAIN_ROUGHNESS_TEXTURE_URL,
  },
  desert: {
    albedo: '/textures/terrain-desert-albedo-v1.png',
    normal: '/textures/terrain-desert-normal-v1.png',
    roughness: '/textures/terrain-desert-roughness-v1.png',
  },
  beach: {
    albedo: '/textures/terrain-beach-albedo-v1.png',
    normal: '/textures/terrain-beach-normal-v1.png',
    roughness: '/textures/terrain-beach-roughness-v1.png',
  },
  mountainRock: {
    albedo: '/textures/terrain-mountain-rock-albedo-v2.png',
    normal: '/textures/terrain-mountain-rock-normal-v2.png',
    roughness: '/textures/terrain-mountain-rock-roughness-v2.png',
  },
  snow: {
    albedo: '/textures/terrain-snow-albedo-v1.png',
    normal: '/textures/terrain-snow-normal-v1.png',
    roughness: '/textures/terrain-snow-roughness-v1.png',
  },
  forestFloor: {
    albedo: '/textures/terrain-forest-floor-albedo-v1.png',
    normal: '/textures/terrain-forest-floor-normal-v1.png',
    roughness: '/textures/terrain-forest-floor-roughness-v1.png',
  },
  dryGrass: {
    albedo: '/textures/terrain-dry-grass-albedo-v1.png',
    normal: '/textures/terrain-dry-grass-normal-v1.png',
    roughness: '/textures/terrain-dry-grass-roughness-v1.png',
  },
  swampMud: {
    albedo: '/textures/terrain-swamp-mud-albedo-v1.png',
    normal: '/textures/terrain-swamp-mud-normal-v1.png',
    roughness: '/textures/terrain-swamp-mud-roughness-v1.png',
  },
  volcanicRock: {
    albedo: '/textures/terrain-volcanic-rock-albedo-v2.png',
    normal: '/textures/terrain-volcanic-rock-normal-v2.png',
    roughness: '/textures/terrain-volcanic-rock-roughness-v2.png',
  },
  ice: {
    albedo: '/textures/terrain-ice-albedo-v2.png',
    normal: '/textures/terrain-ice-normal-v2.png',
    roughness: '/textures/terrain-ice-roughness-v2.png',
  },
  riverbed: {
    albedo: '/textures/terrain-riverbed-albedo-v2.png',
    normal: '/textures/terrain-riverbed-normal-v2.png',
    roughness: '/textures/terrain-riverbed-roughness-v2.png',
  },
};

interface TerrainTextureSetUrls {
  albedo: string;
  normal: string;
  roughness: string;
}

/**
 * RGB color representation
 */
export interface BiomeColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Comprehensive biome color palette
 * Colors are chosen to be visually distinct and represent the biome characteristics
 */
export const BIOME_COLORS: Record<BiomeType, BiomeColor> = {
  // Base biomes - refined for better visual realism
  [BiomeType.OCEAN]:      { r: 0.094, g: 0.314, b: 0.588 },  // Deep ocean blue (#185090)
  [BiomeType.BEACH]:      { r: 0.918, g: 0.855, b: 0.647 },  // Warm sand (#EAD9A5)
  [BiomeType.DESERT]:     { r: 0.871, g: 0.722, b: 0.353 },  // Warm golden sand (#DEA85A)
  [BiomeType.PLAINS]:     { r: 0.529, g: 0.737, b: 0.255 },  // Grass green (#87BC41)
  [BiomeType.FOREST]:     { r: 0.118, g: 0.431, b: 0.118 },  // Deep forest green (#1E6E1E)
  [BiomeType.TAIGA]:      { r: 0.157, g: 0.392, b: 0.275 },  // Dark pine green (#285F46)
  [BiomeType.TUNDRA]:     { r: 0.718, g: 0.773, b: 0.718 },  // Pale gray-green (#B7C5B7)
  [BiomeType.MOUNTAIN]:   { r: 0.502, g: 0.502, b: 0.502 },  // Neutral stone gray (#808080)
  // Extended biomes
  [BiomeType.SAVANNA]:    { r: 0.804, g: 0.718, b: 0.314 },  // Dry golden grass (#CDB750)
  [BiomeType.SWAMP]:      { r: 0.235, g: 0.353, b: 0.196 },  // Dark murky green (#3C5A32)
  [BiomeType.RAINFOREST]: { r: 0.047, g: 0.314, b: 0.094 },  // Lush deep green (#0A5018)
  [BiomeType.VOLCANIC]:   { r: 0.314, g: 0.118, b: 0.039 },  // Dark volcanic rock (#500A0A) with red tint
  [BiomeType.GLACIER]:    { r: 0.839, g: 0.918, b: 0.957 },  // Icy pale blue-white (#D6EAF4)
};

/**
 * Convert BiomeColor to THREE.Color
 */
export function biomeColorToThree(color: BiomeColor): THREE.Color {
  return new THREE.Color(color.r, color.g, color.b);
}

/**
 * Get the base color for a biome type
 */
export function getBiomeColor(biome: BiomeType): BiomeColor {
  return BIOME_COLORS[biome] || { r: 0.5, g: 0.5, b: 0.5 }; // Default gray
}

/**
 * Blend multiple biome colors based on weights
 * 
 * @param biomeWeights - Map of biome types to their blend weights (should sum to 1.0)
 * @returns Blended color
 */
export function blendBiomeColors(biomeWeights: Map<BiomeType, number>): BiomeColor {
  let r = 0;
  let g = 0;
  let b = 0;
  
  for (const [biome, weight] of biomeWeights.entries()) {
    const color = getBiomeColor(biome);
    r += color.r * weight;
    g += color.g * weight;
    b += color.b * weight;
  }
  
  return { r, g, b };
}

/**
 * Extract biome weights from chunk data for a specific position
 * 
 * @param biomeWeights - Flat array of biome weights from chunk data
 * @param index - Position index in the chunk
 * @param numBiomes - Total number of biome types
 * @returns Map of biome types to their weights at this position
 */
export function extractBiomeWeights(
  biomeWeights: Float32Array,
  index: number,
  numBiomes: number = 13
): Map<BiomeType, number> {
  const weights = new Map<BiomeType, number>();
  
  for (let biome = 0; biome < numBiomes; biome++) {
    const weight = biomeWeights[index * numBiomes + biome];
    if (weight > 0) {
      weights.set(biome as BiomeType, weight);
    }
  }
  
  return weights;
}

/**
 * Calculate smooth color for a position using biome blend weights
 * 
 * @param biomeWeights - Flat array of biome weights from chunk data
 * @param index - Position index in the chunk
 * @param numBiomes - Total number of biome types
 * @returns Blended biome color
 */
export function calculateBlendedColor(
  biomeWeights: Float32Array,
  index: number,
  numBiomes: number = 13
): BiomeColor {
  const weights = extractBiomeWeights(biomeWeights, index, numBiomes);
  
  // If no weights available, fall back to default color
  if (weights.size === 0) {
    return { r: 0.5, g: 0.5, b: 0.5 };
  }
  
  return blendBiomeColors(weights);
}

/**
 * Create a material for terrain rendering with vertex colors
 * 
 * @param wireframe - Whether to render in wireframe mode
 * @returns THREE.js material configured for terrain
 */
export function createTerrainMaterial(wireframe: boolean = false): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    vertexColors: true,
    wireframe,
  });
}

function configureTerrainTexture(
  texture: THREE.Texture,
  colorSpace: THREE.ColorSpace,
): THREE.Texture {
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 4;
  return texture;
}

function configureTerrainAtlasTexture(texture: THREE.Texture): THREE.Texture {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

function configureTerrainNormalAtlasTexture(texture: THREE.Texture): THREE.Texture {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

function createEmptyRiverbedMaskTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([0, 128, 128, 255]), 1, 1, THREE.RGBAFormat);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function createTerrainTextureSet(
  loader: THREE.TextureLoader = new THREE.TextureLoader(),
): TerrainTextureSet {
  return createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.plains, loader);
}

function createTerrainTextureSetFromUrls(
  urls: TerrainTextureSetUrls,
  loader: THREE.TextureLoader,
): TerrainTextureSet {
  return {
    albedo: configureTerrainTexture(loader.load(urls.albedo), THREE.SRGBColorSpace),
    normal: configureTerrainTexture(loader.load(urls.normal), THREE.NoColorSpace),
    roughness: configureTerrainTexture(loader.load(urls.roughness), THREE.NoColorSpace),
  };
}

export function createTerrainSurfaceTextureLibrary(
  loader: THREE.TextureLoader = new THREE.TextureLoader(),
): TerrainSurfaceTextureLibrary {
  return {
    plains: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.plains, loader),
    desert: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.desert, loader),
    beach: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.beach, loader),
    mountainRock: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.mountainRock, loader),
    snow: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.snow, loader),
    forestFloor: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.forestFloor, loader),
    dryGrass: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.dryGrass, loader),
    swampMud: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.swampMud, loader),
    volcanicRock: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.volcanicRock, loader),
    ice: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.ice, loader),
    riverbed: createTerrainTextureSetFromUrls(TERRAIN_SURFACE_TEXTURE_URLS.riverbed, loader),
    albedoAtlas: configureTerrainAtlasTexture(loader.load(TERRAIN_ALBEDO_ATLAS_TEXTURE_URL)),
    normalAtlas: configureTerrainNormalAtlasTexture(loader.load(TERRAIN_NORMAL_ATLAS_TEXTURE_URL)),
  };
}

export function createTexturedTerrainMaterial(
  textures: TerrainTextureSet,
  wireframe: boolean = false,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map: textures.albedo,
    normalMap: textures.normal,
    roughnessMap: textures.roughness,
    color: new THREE.Color(
      TERRAIN_TEXTURE_VERTEX_COLOR_BOOST,
      TERRAIN_TEXTURE_VERTEX_COLOR_BOOST,
      TERRAIN_TEXTURE_VERTEX_COLOR_BOOST,
    ),
    normalScale: new THREE.Vector2(0.95, 0.95),
    vertexColors: true,
    wireframe,
    roughness: 0.78,
    metalness: 0.0,
  });

  material.userData.terrainTexturesEnabled = true;
  return material;
}

export function createBiomeColorTerrainMaterial(wireframe: boolean = false): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    wireframe,
    roughness: 0.78,
    metalness: 0.0,
  });

  material.userData.terrainTexturesEnabled = false;
  return material;
}

const terrainMaterialCache = new Map<string, THREE.MeshStandardMaterial>();

function getTerrainMaterialCacheKey(texturesEnabled: boolean, wireframe: boolean): string {
  return `${texturesEnabled}:${wireframe}`;
}

/**
 * Get a cached terrain material. Materials are shared across all chunks
 * to avoid repeated shader compilation freezes.
 */
export function getCachedTerrainMaterial(
  textures: TerrainSurfaceTextureLibrary | null,
  wireframe: boolean = false,
): THREE.MeshStandardMaterial {
  const texturesEnabled = textures !== null;
  const key = getTerrainMaterialCacheKey(texturesEnabled, wireframe);

  let material = terrainMaterialCache.get(key);
  if (!material) {
    material = texturesEnabled
      ? createTerrainBlendMaterial(textures!, wireframe)
      : createBiomeColorTerrainMaterial(wireframe);
    material.userData.sharedTerrainMaterial = true;
    terrainMaterialCache.set(key, material);
  }
  return material;
}

/**
 * Dispose all cached terrain materials and clear the cache.
 * Call this on application shutdown.
 */
export function clearTerrainMaterialCache(): void {
  for (const material of terrainMaterialCache.values()) {
    material.dispose();
  }
  terrainMaterialCache.clear();
}

export function createTerrainBlendMaterial(
  textures: TerrainSurfaceTextureLibrary,
  wireframe: boolean = false,
  riverbedMaskTexture: THREE.Texture = EMPTY_RIVERBED_MASK_TEXTURE,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map: textures.albedoAtlas,
    normalMap: textures.plains.normal,
    color: new THREE.Color(
      TERRAIN_TEXTURE_VERTEX_COLOR_BOOST,
      TERRAIN_TEXTURE_VERTEX_COLOR_BOOST,
      TERRAIN_TEXTURE_VERTEX_COLOR_BOOST,
    ),
    normalScale: new THREE.Vector2(0.95, 0.95),
    vertexColors: true,
    wireframe,
    roughness: 0.78,
    metalness: 0.0,
  });

  material.userData.terrainTexturesEnabled = true;
  material.userData.sharedTerrainMaterial = false;
  material.userData.riverbedMaskTexture = riverbedMaskTexture;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.terrainAlbedoAtlas = { value: textures.albedoAtlas };
    shader.uniforms.terrainNormalAtlas = { value: textures.normalAtlas };
    shader.uniforms.terrainVolcanicRockAlbedo = { value: textures.volcanicRock.albedo };
    shader.uniforms.terrainVolcanicRockNormal = { value: textures.volcanicRock.normal };
    shader.uniforms.terrainMountainRockAlbedo = { value: textures.mountainRock.albedo };
    shader.uniforms.terrainMountainRockNormal = { value: textures.mountainRock.normal };
    shader.uniforms.terrainRiverbedAlbedo = { value: textures.riverbed.albedo };
    shader.uniforms.terrainRiverbedNormal = { value: textures.riverbed.normal };
    shader.uniforms.terrainRiverbedMask = { value: material.userData.riverbedMaskTexture ?? EMPTY_RIVERBED_MASK_TEXTURE };
    shader.uniforms.terrainAnimationTime = { value: 0 };
    material.userData.terrainShader = shader;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 surfaceBlendA;
attribute vec4 surfaceBlendB;
attribute vec4 surfaceBlendC;
attribute vec4 terrainDetailBlend;
varying vec4 vSurfaceBlendA;
varying vec4 vSurfaceBlendB;
varying vec4 vSurfaceBlendC;
varying vec4 vTerrainDetailBlend;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
vSurfaceBlendA = surfaceBlendA;
vSurfaceBlendB = surfaceBlendB;
vSurfaceBlendC = surfaceBlendC;
vTerrainDetailBlend = terrainDetailBlend;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D terrainAlbedoAtlas;
uniform sampler2D terrainNormalAtlas;
uniform sampler2D terrainVolcanicRockAlbedo;
uniform sampler2D terrainVolcanicRockNormal;
uniform sampler2D terrainMountainRockAlbedo;
uniform sampler2D terrainMountainRockNormal;
uniform sampler2D terrainRiverbedAlbedo;
uniform sampler2D terrainRiverbedNormal;
uniform sampler2D terrainRiverbedMask;
uniform float terrainAnimationTime;
varying vec4 vSurfaceBlendA;
varying vec4 vSurfaceBlendB;
varying vec4 vSurfaceBlendC;
varying vec4 vTerrainDetailBlend;
vec3 blendedTerrainNormal;

vec2 mirrorTerrainAtlasUv(vec2 uv) {
  vec2 wrappedUv = mod(uv, vec2(2.0));
  return mix(wrappedUv, vec2(2.0) - wrappedUv, step(vec2(1.0), wrappedUv));
}

vec4 sampleTerrainAtlasTile(float tileIndex, vec2 uv) {
  const vec2 atlasGrid = vec2(4.0, 3.0);
  const vec2 atlasTilePixels = vec2(256.0, 256.0);
  vec2 tile = vec2(mod(tileIndex, atlasGrid.x), atlasGrid.y - 1.0 - floor(tileIndex / atlasGrid.x));
  vec2 paddedUv = (mirrorTerrainAtlasUv(uv) * (atlasTilePixels - vec2(2.0)) + vec2(1.0)) / atlasTilePixels;
  return texture2D(terrainAlbedoAtlas, (tile + paddedUv) / atlasGrid);
}

vec4 sampleTerrainNormalAtlasTile(float tileIndex, vec2 uv) {
  const vec2 atlasGrid = vec2(4.0, 3.0);
  const vec2 atlasTilePixels = vec2(256.0, 256.0);
  vec2 tile = vec2(mod(tileIndex, atlasGrid.x), atlasGrid.y - 1.0 - floor(tileIndex / atlasGrid.x));
  vec2 paddedUv = (mirrorTerrainAtlasUv(uv) * (atlasTilePixels - vec2(2.0)) + vec2(1.0)) / atlasTilePixels;
  return texture2D(terrainNormalAtlas, (tile + paddedUv) / atlasGrid);
}

vec2 terrainSurfaceUv(vec2 uv) {
  return uv * vec2(8.5, 8.5);
}

float terrainValueHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float terrainValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = terrainValueHash(i);
  float b = terrainValueHash(i + vec2(1.0, 0.0));
  float c = terrainValueHash(i + vec2(0.0, 1.0));
  float d = terrainValueHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float macroGroundNoise(vec2 uv) {
  return terrainValueNoise(uv * 0.085) * 0.62 + terrainValueNoise(uv * 0.032 + vec2(19.0, 47.0)) * 0.38;
}

float microGroundNoise(vec2 uv) {
  return terrainValueNoise(uv * 1.70) * 0.50 + terrainValueNoise(uv * 3.40 + vec2(11.0, 5.0)) * 0.30 + terrainValueNoise(uv * 6.80 + vec2(37.0, 23.0)) * 0.20;
}

float rockStrataNoise(vec2 uv) {
  float bands = abs(sin((uv.x * 0.62 + uv.y * 1.85) + terrainValueNoise(uv * 0.22) * 3.1));
  float fineCuts = terrainValueNoise(uv * 2.4 + vec2(23.0, 41.0));
  return smoothstep(0.42, 0.92, bands) * 0.68 + fineCuts * 0.32;
}

void considerTerrainAtlasTile(
  float weight,
  float tileIndex,
  inout float primaryWeight,
  inout float primaryTile,
  inout float secondaryWeight,
  inout float secondaryTile,
  inout float tertiaryWeight,
  inout float tertiaryTile
) {
  if (weight > primaryWeight) {
    tertiaryWeight = secondaryWeight;
    tertiaryTile = secondaryTile;
    secondaryWeight = primaryWeight;
    secondaryTile = primaryTile;
    primaryWeight = weight;
    primaryTile = tileIndex;
  } else if (weight > secondaryWeight) {
    tertiaryWeight = secondaryWeight;
    tertiaryTile = secondaryTile;
    secondaryWeight = weight;
    secondaryTile = tileIndex;
  } else if (weight > tertiaryWeight) {
    tertiaryWeight = weight;
    tertiaryTile = tileIndex;
  }
}`,
      )
      .replace(
        '#include <map_fragment>',
        `float primarySurfaceWeight = -1.0;
float primarySurfaceTile = 0.0;
float secondarySurfaceWeight = -1.0;
float secondarySurfaceTile = 0.0;
float tertiarySurfaceWeight = -1.0;
float tertiarySurfaceTile = 0.0;
considerTerrainAtlasTile(vSurfaceBlendA.x, 0.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
considerTerrainAtlasTile(vSurfaceBlendA.y, 1.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
considerTerrainAtlasTile(vSurfaceBlendA.z, 2.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
considerTerrainAtlasTile(vSurfaceBlendA.w, 3.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
considerTerrainAtlasTile(vSurfaceBlendB.x, 4.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
considerTerrainAtlasTile(vSurfaceBlendB.y, 5.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
considerTerrainAtlasTile(vSurfaceBlendB.z, 6.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
considerTerrainAtlasTile(vSurfaceBlendB.w, 7.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
considerTerrainAtlasTile(vSurfaceBlendC.x, 8.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
considerTerrainAtlasTile(vSurfaceBlendC.y, 9.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
considerTerrainAtlasTile(vSurfaceBlendC.z, 10.0, primarySurfaceWeight, primarySurfaceTile, secondarySurfaceWeight, secondarySurfaceTile, tertiarySurfaceWeight, tertiarySurfaceTile);
float primaryTerrainWeight = pow(max(0.0, primarySurfaceWeight), 0.88);
float secondaryTerrainWeight = pow(max(0.0, secondarySurfaceWeight), 0.88);
float tertiaryTerrainWeight = pow(max(0.0, tertiarySurfaceWeight), 0.88);
float terrainSurfaceWeightSum = max(0.0001, primaryTerrainWeight + secondaryTerrainWeight + tertiaryTerrainWeight);
vec4 blendedTerrainMap = (
  sampleTerrainAtlasTile(primarySurfaceTile, terrainSurfaceUv(vMapUv)) * primaryTerrainWeight +
  sampleTerrainAtlasTile(secondarySurfaceTile, terrainSurfaceUv(vMapUv)) * secondaryTerrainWeight +
  sampleTerrainAtlasTile(tertiarySurfaceTile, terrainSurfaceUv(vMapUv)) * tertiaryTerrainWeight
) / terrainSurfaceWeightSum;
float microGroundNoiseValue = microGroundNoise(terrainSurfaceUv(vMapUv));
vec3 terrainDetailContrast = clamp((blendedTerrainMap.rgb - vec3(0.50)) * 3.35 + vec3(0.72), vec3(0.24), vec3(1.68));
terrainDetailContrast *= 0.90 + microGroundNoiseValue * 0.22;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * terrainDetailContrast, 0.98);
float volcanicSurfaceWeight = smoothstep(0.18, 0.72, clamp(vSurfaceBlendC.x * 1.35, 0.0, 1.0));
vec2 directVolcanicUv = terrainSurfaceUv(vMapUv);
vec3 rawVolcanicAlbedo = texture2D(terrainVolcanicRockAlbedo, directVolcanicUv).rgb;
float directVolcanicLavaMask = smoothstep(0.12, 0.36, rawVolcanicAlbedo.r - max(rawVolcanicAlbedo.g, rawVolcanicAlbedo.b) * 1.08) * smoothstep(0.20, 0.58, rawVolcanicAlbedo.r);
vec2 directVolcanicMountainUv = mirrorTerrainAtlasUv(directVolcanicUv * 0.52 + vec2(0.17, 0.31));
vec3 directVolcanicMountainRock = texture2D(terrainMountainRockAlbedo, directVolcanicMountainUv).rgb;
float volcanicRockPatch = smoothstep(0.22, 0.82, terrainValueNoise(directVolcanicUv * 0.28 + vec2(9.0, 17.0)));
float volcanicMountainMix = (0.26 + volcanicRockPatch * 0.24) * (1.0 - directVolcanicLavaMask * 0.90);
vec3 directVolcanicAlbedo = mix(rawVolcanicAlbedo, directVolcanicMountainRock * vec3(0.64, 0.62, 0.57), volcanicMountainMix);
float directVolcanicPulse = 0.35 + 0.65 * (0.5 + 0.5 * sin(terrainAnimationTime * 2.45 + terrainValueNoise(directVolcanicUv * 2.2) * 6.283));
vec3 directVolcanicAnimatedAlbedo = min(vec3(1.0), directVolcanicAlbedo + vec3(0.76, 0.30, 0.07) * directVolcanicLavaMask * directVolcanicPulse);
float iceSurfaceWeight = clamp(vSurfaceBlendC.y * 1.55, 0.0, 1.0);
vec3 iceAlbedo = mix(vec3(0.78, 0.93, 1.0), blendedTerrainMap.rgb * vec3(0.94, 1.04, 1.10), 0.38);
iceAlbedo *= 0.94 + microGroundNoiseValue * 0.10;
diffuseColor.rgb = mix(diffuseColor.rgb, iceAlbedo, smoothstep(0.12, 0.72, iceSurfaceWeight) * 0.96);
diffuseColor.a *= blendedTerrainMap.a;
vec3 blendedTerrainNormalRaw = (
  sampleTerrainNormalAtlasTile(primarySurfaceTile, terrainSurfaceUv(vMapUv)).rgb * primaryTerrainWeight +
  sampleTerrainNormalAtlasTile(secondarySurfaceTile, terrainSurfaceUv(vMapUv)).rgb * secondaryTerrainWeight +
  sampleTerrainNormalAtlasTile(tertiarySurfaceTile, terrainSurfaceUv(vMapUv)).rgb * tertiaryTerrainWeight
) / terrainSurfaceWeightSum;
blendedTerrainNormal = blendedTerrainNormalRaw * 2.0 - 1.0;
vec3 directVolcanicNormal = texture2D(terrainVolcanicRockNormal, directVolcanicUv).rgb * 2.0 - 1.0;
vec3 directVolcanicMountainNormal = texture2D(terrainMountainRockNormal, directVolcanicMountainUv).rgb * 2.0 - 1.0;
directVolcanicNormal = normalize(mix(directVolcanicNormal, directVolcanicMountainNormal, volcanicMountainMix * 0.72));
blendedTerrainNormal = normalize(mix(blendedTerrainNormal, directVolcanicNormal, volcanicSurfaceWeight * 0.98));
float forestFloorWeight = clamp(vSurfaceBlendB.y + vSurfaceBlendB.w * 0.35, 0.0, 1.0);
vec3 forestFloorTint = vec3(0.86, 0.96, 0.76);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * forestFloorTint, forestFloorWeight * 0.16);
float desertSurfaceWeight = clamp(vSurfaceBlendA.y * 1.35, 0.0, 1.0);
float nonVolcanicSurfaceWeight = 1.0 - volcanicSurfaceWeight;
float sandySurfaceWeight = clamp(vSurfaceBlendA.z * 1.20 + vSurfaceBlendA.y * 0.85, 0.0, 1.0) * nonVolcanicSurfaceWeight;
vec3 desertAlbedo = mix(vec3(0.88, 0.76, 0.46), blendedTerrainMap.rgb * vec3(1.10, 0.94, 0.70), 0.42);
desertAlbedo *= 0.94 + microGroundNoiseValue * 0.12;
diffuseColor.rgb = mix(diffuseColor.rgb, desertAlbedo, smoothstep(0.16, 0.76, desertSurfaceWeight) * 0.92);
float vegetatedGroundWeight = clamp(vSurfaceBlendA.x * 0.70 + vSurfaceBlendB.y + vSurfaceBlendB.z * 0.85 + vSurfaceBlendB.w * 0.55, 0.0, 1.0);
float macroGroundNoiseValue = macroGroundNoise(terrainSurfaceUv(vMapUv));
float dryGrassPatch = smoothstep(0.58, 0.86, macroGroundNoiseValue) * clamp(vSurfaceBlendA.x * 0.45 + vSurfaceBlendB.z * 0.95 + forestFloorWeight * 0.24, 0.0, 1.0);
float freshGrassPatch = smoothstep(0.34, 0.70, 1.0 - abs(macroGroundNoiseValue - 0.42) * 2.35) * vegetatedGroundWeight;
float wornGroundPatch = smoothstep(0.52, 0.82, 1.0 - abs(macroGroundNoiseValue - 0.52) * 2.05) * forestFloorWeight;
vec4 riverbedMaskSample = texture2D(terrainRiverbedMask, fract(vMapUv));
float pixelRiverbedWeight = smoothstep(0.03, 0.94, riverbedMaskSample.r);
float shorelineWetness = clamp(vTerrainDetailBlend.z * 0.78 + vTerrainDetailBlend.w * 0.40 + pixelRiverbedWeight * 1.00 + vSurfaceBlendB.w * 0.50 + vSurfaceBlendC.z * 0.40, 0.0, 1.0);
float wetLowlandPatch = smoothstep(0.40, 0.84, macroGroundNoiseValue) * shorelineWetness;
float wetTerrainWeight = clamp(max(shorelineWetness, wetLowlandPatch), 0.0, 1.0);
float riverBankAccent = clamp((vTerrainDetailBlend.z - vTerrainDetailBlend.w * 0.48) * (0.72 + vSurfaceBlendB.w * 0.45 + vSurfaceBlendA.z * 0.35), 0.0, 1.0);
float siltPatch = smoothstep(0.28, 0.76, terrainValueNoise(terrainSurfaceUv(vMapUv) * 0.42 + vec2(8.0, 31.0))) * riverBankAccent;
float paleSandPatch = smoothstep(0.55, 0.90, macroGroundNoiseValue) * riverBankAccent * clamp(vSurfaceBlendA.z + vSurfaceBlendA.y * 0.45 + vSurfaceBlendB.z * 0.20, 0.0, 1.0);
vec3 freshGrassPatchTint = vec3(0.90, 1.08, 0.82);
vec3 dryGrassPatchTint = vec3(1.12, 1.00, 0.70);
vec3 wornGroundTint = vec3(0.74, 0.67, 0.50);
vec3 wetLowlandTint = mix(vec3(0.56, 0.67, 0.61), vec3(0.88, 0.78, 0.55), sandySurfaceWeight);
vec3 wetGlossTint = mix(vec3(0.95, 1.02, 0.98), vec3(1.08, 0.98, 0.78), sandySurfaceWeight);
vec3 riverBankSiltTint = vec3(0.58, 0.62, 0.45);
vec3 riverBankSandTint = vec3(1.18, 1.08, 0.74);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * freshGrassPatchTint, freshGrassPatch * 0.10);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * dryGrassPatchTint, dryGrassPatch * 0.18);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * wornGroundTint, wornGroundPatch * 0.12);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * wetLowlandTint, wetTerrainWeight * 0.30);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * wetGlossTint, wetTerrainWeight * 0.12);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * riverBankSiltTint, siltPatch * 0.28);
diffuseColor.rgb = mix(diffuseColor.rgb, min(vec3(1.0), diffuseColor.rgb * riverBankSandTint), paleSandPatch * 0.20);
float mountainRockWeight = clamp(vSurfaceBlendA.w + vTerrainDetailBlend.x * 0.72, 0.0, 1.0);
float mountainSnowWeight = clamp(vSurfaceBlendB.x + vTerrainDetailBlend.y, 0.0, 1.0);
float mountainStrata = rockStrataNoise(terrainSurfaceUv(vMapUv) * 0.58 + vec2(3.0, 17.0));
float mountainCracks = smoothstep(0.54, 0.88, rockStrataNoise(terrainSurfaceUv(vMapUv) * 1.25 + vec2(41.0, 9.0)));
float exposedRockWeight = mountainRockWeight * (1.0 - mountainSnowWeight * 0.42);
float talusBeltWeight = mountainRockWeight * (1.0 - mountainSnowWeight * 0.76) * smoothstep(0.06, 0.56, vTerrainDetailBlend.x);
vec2 mountainRockUv = mirrorTerrainAtlasUv(vMapUv * vec2(2.35, 2.35));
vec3 directMountainRock = texture2D(terrainMountainRockAlbedo, mountainRockUv).rgb;
vec3 directMountainNormal = texture2D(terrainMountainRockNormal, mountainRockUv).rgb * 2.0 - 1.0;
blendedTerrainNormal = normalize(mix(blendedTerrainNormal, directMountainNormal, exposedRockWeight * 0.86));
vec3 alpineRockBase = mix(vec3(0.40, 0.405, 0.39), vec3(0.57, 0.57, 0.53), mountainStrata * 0.45 + microGroundNoiseValue * 0.25);
vec3 alpineRockCool = vec3(0.44, 0.49, 0.50);
vec3 alpineRockWarm = vec3(0.58, 0.54, 0.46);
vec3 alpineRockTint = mix(alpineRockBase, alpineRockCool, mountainCracks * 0.20);
alpineRockTint = mix(alpineRockTint, alpineRockWarm, smoothstep(0.18, 0.72, 1.0 - mountainStrata) * 0.08);
vec3 alpineTexturedRock = mix(directMountainRock * alpineRockTint * 1.46, directMountainRock, 0.48);
diffuseColor.rgb = mix(diffuseColor.rgb, alpineTexturedRock, exposedRockWeight * 0.92);
vec3 talusBeltTint = mix(vec3(0.48, 0.47, 0.42), vec3(0.62, 0.58, 0.47), microGroundNoiseValue);
diffuseColor.rgb = mix(diffuseColor.rgb, directMountainRock * talusBeltTint * 1.42, talusBeltWeight * 0.38);
vec3 cliffTint = vec3(0.50, 0.50, 0.47);
vec3 snowPeakTint = vec3(0.96, 1.00, 1.03);
vec3 wetShorelineTint = mix(vec3(0.40, 0.52, 0.54), vec3(0.82, 0.75, 0.55), sandySurfaceWeight);
vec3 riverbedTint = vec3(0.42, 0.48, 0.44);
float cliffAccent = smoothstep(0.04, 0.62, vTerrainDetailBlend.x);
float snowAccent = smoothstep(0.20, 0.74, vTerrainDetailBlend.y);
float shorelineAccent = smoothstep(0.02, 0.60, vTerrainDetailBlend.z);
float riverbedAccent = smoothstep(0.02, 0.55, vTerrainDetailBlend.w);
float directRiverbedWeight = pixelRiverbedWeight;
vec2 riverbedFlow = riverbedMaskSample.gb * 2.0 - 1.0;
riverbedFlow = length(riverbedFlow) > 0.001 ? normalize(riverbedFlow) : vec2(1.0, 0.0);
vec2 riverbedCross = vec2(-riverbedFlow.y, riverbedFlow.x);
vec2 riverbedAlignedUv = vec2(
  dot(vMapUv * vec2(18.0), riverbedFlow),
  dot(vMapUv * vec2(18.0), riverbedCross)
);
vec2 riverbedUv = mirrorTerrainAtlasUv(riverbedAlignedUv * vec2(0.72, 1.85) + vec2(0.17, 0.41));
vec3 directRiverbed = texture2D(terrainRiverbedAlbedo, riverbedUv).rgb;
vec3 directRiverbedNormal = texture2D(terrainRiverbedNormal, riverbedUv).rgb * 2.0 - 1.0;
vec3 riverbedTextureTint = vec3(0.78, 0.88, 0.78);
diffuseColor.rgb = mix(diffuseColor.rgb, directRiverbed * riverbedTextureTint * 1.28, directRiverbedWeight * 0.82);
blendedTerrainNormal = normalize(mix(blendedTerrainNormal, directRiverbedNormal, directRiverbedWeight * 0.72));
float rockStrata = rockStrataNoise(terrainSurfaceUv(vMapUv) * 0.74);
float talusAccent = smoothstep(0.18, 0.72, rockStrata) * cliffAccent * (1.0 - snowAccent * 0.55);
vec3 rockShadowTint = vec3(0.58, 0.57, 0.52);
vec3 rockHighlightTint = vec3(1.18, 1.13, 1.02);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * cliffTint, cliffAccent * 0.42);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * rockShadowTint, talusAccent * 0.18);
diffuseColor.rgb = mix(diffuseColor.rgb, min(vec3(1.0), diffuseColor.rgb * rockHighlightTint), (1.0 - rockStrata) * cliffAccent * 0.18);
float snowBreakup = smoothstep(0.22, 0.80, rockStrataNoise(terrainSurfaceUv(vMapUv) * 0.45 + vec2(29.0, 12.0)));
float windScouredSnow = snowAccent * smoothstep(0.18, 0.92, 1.0 - mountainCracks * 0.55 - rockStrata * 0.22);
float brokenSnowAccent = windScouredSnow * (0.40 + snowBreakup * 0.28);
diffuseColor.rgb = mix(diffuseColor.rgb, min(vec3(1.0), diffuseColor.rgb * snowPeakTint), brokenSnowAccent * 0.26);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.76, 0.82, 0.84), windScouredSnow * cliffAccent * rockStrata * 0.10);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * wetShorelineTint, shorelineAccent * 0.72);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * riverbedTint, max(riverbedAccent, pixelRiverbedWeight) * 0.54);
float sandFinalWeight = smoothstep(0.08, 0.58, sandySurfaceWeight) * (1.0 - max(riverbedAccent, pixelRiverbedWeight) * 0.92);
vec3 sandAlbedo = mix(vec3(0.84, 0.74, 0.50), blendedTerrainMap.rgb * vec3(1.12, 1.00, 0.74), 0.46);
sandAlbedo *= 0.94 + microGroundNoiseValue * 0.10;
diffuseColor.rgb = mix(diffuseColor.rgb, sandAlbedo, sandFinalWeight * 0.88);
diffuseColor.rgb = mix(diffuseColor.rgb, directVolcanicAnimatedAlbedo, volcanicSurfaceWeight * 0.98);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `vec3 mapN = blendedTerrainNormal;
mapN.xy *= normalScale;
normal = normalize( tbn * mapN );`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = roughness;
float surfaceRoughnessBlend =
  0.84 * vSurfaceBlendA.x +
  0.88 * vSurfaceBlendA.y +
  0.72 * vSurfaceBlendA.z +
  0.92 * vSurfaceBlendA.w +
  0.78 * vSurfaceBlendB.x +
  0.90 * vSurfaceBlendB.y +
  0.86 * vSurfaceBlendB.z +
  0.62 * vSurfaceBlendB.w +
  0.95 * vSurfaceBlendC.x +
  0.34 * vSurfaceBlendC.y +
  0.50 * vSurfaceBlendC.z;
roughnessFactor *= max(0.28, surfaceRoughnessBlend);
roughnessFactor = mix(roughnessFactor, min(1.0, roughnessFactor + 0.12), vTerrainDetailBlend.x * 0.35);
roughnessFactor = mix(roughnessFactor, 0.72, vTerrainDetailBlend.y * 0.25);
float roughnessRiverbedMask = texture2D(terrainRiverbedMask, fract(vMapUv)).r;
float roughnessShorelineWetness = clamp(vTerrainDetailBlend.z * 0.78 + vTerrainDetailBlend.w * 0.40 + roughnessRiverbedMask * 1.00 + vSurfaceBlendB.w * 0.50 + vSurfaceBlendC.z * 0.40, 0.0, 1.0);
roughnessFactor = mix(roughnessFactor, 0.34, roughnessShorelineWetness * 0.68);
roughnessFactor = mix(roughnessFactor, 0.46, clamp(vTerrainDetailBlend.z - vTerrainDetailBlend.w * 0.35, 0.0, 1.0) * 0.44);
roughnessFactor = mix(roughnessFactor, 0.42, max(vTerrainDetailBlend.w, roughnessRiverbedMask) * 0.60);`,
      );
  };

  return material;
}

export function updateTerrainMaterialAnimation(material: THREE.Material, elapsedSeconds: number): void {
  const shader = material.userData.terrainShader as THREE.Shader | undefined;
  const uniform = shader?.uniforms.terrainAnimationTime;
  if (uniform) {
    uniform.value = elapsedSeconds;
  }
}

/**
 * Create a material for biome visualization overlay
 * 
 * @param biome - Biome type to visualize
 * @param opacity - Material opacity (0-1)
 * @returns THREE.js material for biome overlay
 */
export function createBiomeOverlayMaterial(
  biome: BiomeType,
  opacity: number = 0.5
): THREE.MeshBasicMaterial {
  const color = biomeColorToThree(getBiomeColor(biome));
  
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
}

/**
 * Convert color to grayscale using luminance formula
 * 
 * @param color - Input color
 * @returns Grayscale color
 */
export function toGrayscale(color: BiomeColor): BiomeColor {
  const gray = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  return { r: gray, g: gray, b: gray };
}

/**
 * Interpolate between two colors
 * 
 * @param color1 - First color
 * @param color2 - Second color
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated color
 */
export function lerpColor(color1: BiomeColor, color2: BiomeColor, t: number): BiomeColor {
  return {
    r: color1.r + (color2.r - color1.r) * t,
    g: color1.g + (color2.g - color1.g) * t,
    b: color1.b + (color2.b - color1.b) * t,
  };
}


