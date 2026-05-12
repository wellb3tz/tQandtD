/**
 * Materials and color mapping for biome-based terrain rendering
 * 
 * Provides comprehensive biome color definitions and utilities for
 * smooth color blending between biomes based on blend weights.
 */

import { BiomeType } from '@engine/index';
import * as THREE from 'three';

export const TERRAIN_ALBEDO_TEXTURE_URL = '/textures/terrain-albedo-v1.png';
export const TERRAIN_NORMAL_TEXTURE_URL = '/textures/terrain-normal-v1.png';
export const TERRAIN_ROUGHNESS_TEXTURE_URL = '/textures/terrain-roughness-v1.png';
export const TERRAIN_ALBEDO_ATLAS_TEXTURE_URL = '/textures/terrain-albedo-atlas-v2.png';
const TERRAIN_TEXTURE_VERTEX_COLOR_BOOST = 2.08;

export type TerrainSurfaceKey =
  | 'plains'
  | 'desert'
  | 'beach'
  | 'mountainRock'
  | 'snow'
  | 'forestFloor'
  | 'dryGrass'
  | 'swampMud'
  | 'volcanicRock'
  | 'ice'
  | 'riverbed';

export interface TerrainTextureSet {
  albedo: THREE.Texture;
  normal: THREE.Texture;
  roughness: THREE.Texture;
}

export type TerrainSurfaceTextureLibrary = Record<TerrainSurfaceKey, TerrainTextureSet> & {
  albedoAtlas: THREE.Texture;
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
    albedo: '/textures/terrain-mountain-rock-albedo-v1.png',
    normal: '/textures/terrain-mountain-rock-normal-v1.png',
    roughness: '/textures/terrain-mountain-rock-roughness-v1.png',
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
    albedo: '/textures/terrain-volcanic-rock-albedo-v1.png',
    normal: '/textures/terrain-volcanic-rock-normal-v1.png',
    roughness: '/textures/terrain-volcanic-rock-roughness-v1.png',
  },
  ice: {
    albedo: '/textures/terrain-ice-albedo-v1.png',
    normal: '/textures/terrain-ice-normal-v1.png',
    roughness: '/textures/terrain-ice-roughness-v1.png',
  },
  riverbed: {
    albedo: '/textures/terrain-riverbed-albedo-v1.png',
    normal: '/textures/terrain-riverbed-normal-v1.png',
    roughness: '/textures/terrain-riverbed-roughness-v1.png',
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
  // Base biomes — refined for better visual realism
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
  };
}

export function selectTerrainSurfaceKey(
  biome: BiomeType,
  elevation: number,
  slope: number,
  moisture: number = 0,
): TerrainSurfaceKey {
  const wetness = clamp01(moisture);

  if ((biome === BiomeType.MOUNTAIN || biome === BiomeType.GLACIER) && elevation >= 0.78 && slope < 0.55) {
    return 'snow';
  }

  if (biome === BiomeType.VOLCANIC) {
    return 'volcanicRock';
  }

  if (slope >= 0.6 || biome === BiomeType.MOUNTAIN) {
    return biome === BiomeType.GLACIER && wetness > 0.45 ? 'ice' : 'mountainRock';
  }

  if (biome === BiomeType.DESERT) {
    if (wetness > 0.7 && elevation < 0.5) {
      return 'beach';
    }
    return 'desert';
  }

  if (biome === BiomeType.SAVANNA) {
    if (wetness > 0.72 && elevation < 0.55) {
      return 'swampMud';
    }
    if (wetness > 0.42) {
      return 'plains';
    }
    return 'dryGrass';
  }

  if (biome === BiomeType.BEACH) {
    return wetness > 0.55 ? 'swampMud' : 'beach';
  }

  if (biome === BiomeType.GLACIER) {
    return 'ice';
  }

  if (biome === BiomeType.TUNDRA) {
    return wetness > 0.72 ? 'ice' : 'snow';
  }

  if (biome === BiomeType.SWAMP) {
    return 'swampMud';
  }

  if (biome === BiomeType.FOREST || biome === BiomeType.TAIGA || biome === BiomeType.RAINFOREST) {
    if (wetness > 0.74) {
      return 'swampMud';
    }

    if (wetness > 0.42 || elevation < 0.42) {
      return 'forestFloor';
    }

    return wetness < 0.1 && elevation > 0.5 ? 'dryGrass' : 'forestFloor';
  }

  if (wetness > 0.74 && elevation < 0.5) {
    return 'swampMud';
  }

  if (wetness > 0.45 && elevation < 0.58) {
    return 'forestFloor';
  }

  if (wetness < 0.22 && elevation > 0.52) {
    return 'dryGrass';
  }

  return 'plains';
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
    normalScale: new THREE.Vector2(0.35, 0.35),
    vertexColors: true,
    wireframe,
    roughness: 0.85,
    metalness: 0.0,
  });

  material.userData.terrainTexturesEnabled = true;
  return material;
}

export function createBiomeColorTerrainMaterial(wireframe: boolean = false): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    wireframe,
    roughness: 0.85,
    metalness: 0.0,
  });

  material.userData.terrainTexturesEnabled = false;
  return material;
}

export function createTerrainBlendMaterial(
  textures: TerrainSurfaceTextureLibrary,
  wireframe: boolean = false,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map: textures.albedoAtlas,
    normalMap: textures.plains.normal,
    color: new THREE.Color(
      TERRAIN_TEXTURE_VERTEX_COLOR_BOOST,
      TERRAIN_TEXTURE_VERTEX_COLOR_BOOST,
      TERRAIN_TEXTURE_VERTEX_COLOR_BOOST,
    ),
    normalScale: new THREE.Vector2(0.35, 0.35),
    vertexColors: true,
    wireframe,
    roughness: 0.85,
    metalness: 0.0,
  });

  material.userData.terrainTexturesEnabled = true;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.terrainAlbedoAtlas = { value: textures.albedoAtlas };
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
varying vec4 vSurfaceBlendA;
varying vec4 vSurfaceBlendB;
varying vec4 vSurfaceBlendC;
varying vec4 vTerrainDetailBlend;

vec2 mirrorTerrainAtlasUv(vec2 uv) {
  vec2 wrappedUv = mod(uv, vec2(2.0));
  return mix(wrappedUv, vec2(2.0) - wrappedUv, step(vec2(1.0), wrappedUv));
}

vec4 sampleTerrainAtlasTile(float tileIndex, vec2 uv) {
  const vec2 atlasGrid = vec2(4.0, 3.0);
  const vec2 atlasTilePixels = vec2(256.0, 256.0);
  vec2 tile = vec2(mod(tileIndex, atlasGrid.x), floor(tileIndex / atlasGrid.x));
  vec2 paddedUv = (mirrorTerrainAtlasUv(uv) * (atlasTilePixels - vec2(2.0)) + vec2(1.0)) / atlasTilePixels;
  return texture2D(terrainAlbedoAtlas, (tile + paddedUv) / atlasGrid);
}

vec2 terrainSurfaceUv(vec2 uv) {
  return uv * vec2(3.25, 3.25);
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
vec3 terrainDetailContrast = clamp((blendedTerrainMap.rgb - vec3(0.53)) * 2.85 + vec3(0.72), vec3(0.28), vec3(1.55));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * terrainDetailContrast, 0.98);
diffuseColor.a *= blendedTerrainMap.a;
float forestFloorWeight = clamp(vSurfaceBlendB.y + vSurfaceBlendB.w * 0.35, 0.0, 1.0);
vec3 forestFloorTint = vec3(0.86, 0.96, 0.76);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * forestFloorTint, forestFloorWeight * 0.16);
float vegetatedGroundWeight = clamp(vSurfaceBlendA.x * 0.70 + vSurfaceBlendB.y + vSurfaceBlendB.z * 0.85 + vSurfaceBlendB.w * 0.55, 0.0, 1.0);
float macroGroundNoiseValue = macroGroundNoise(terrainSurfaceUv(vMapUv));
float dryGrassPatch = smoothstep(0.58, 0.86, macroGroundNoiseValue) * clamp(vSurfaceBlendA.x * 0.45 + vSurfaceBlendB.z * 0.95 + forestFloorWeight * 0.24, 0.0, 1.0);
float freshGrassPatch = smoothstep(0.34, 0.70, 1.0 - abs(macroGroundNoiseValue - 0.42) * 2.35) * vegetatedGroundWeight;
float wornGroundPatch = smoothstep(0.52, 0.82, 1.0 - abs(macroGroundNoiseValue - 0.52) * 2.05) * forestFloorWeight;
float shorelineWetness = clamp(vTerrainDetailBlend.z * 0.78 + vTerrainDetailBlend.w * 0.94 + vSurfaceBlendB.w * 0.50 + vSurfaceBlendC.z * 0.40, 0.0, 1.0);
float wetLowlandPatch = smoothstep(0.40, 0.84, macroGroundNoiseValue) * shorelineWetness;
float wetTerrainWeight = clamp(max(shorelineWetness, wetLowlandPatch), 0.0, 1.0);
vec3 freshGrassPatchTint = vec3(0.90, 1.08, 0.82);
vec3 dryGrassPatchTint = vec3(1.12, 1.00, 0.70);
vec3 wornGroundTint = vec3(0.74, 0.67, 0.50);
vec3 wetLowlandTint = vec3(0.56, 0.67, 0.61);
vec3 wetGlossTint = vec3(0.95, 1.02, 0.98);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * freshGrassPatchTint, freshGrassPatch * 0.10);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * dryGrassPatchTint, dryGrassPatch * 0.18);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * wornGroundTint, wornGroundPatch * 0.12);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * wetLowlandTint, wetTerrainWeight * 0.30);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * wetGlossTint, wetTerrainWeight * 0.12);
vec3 cliffTint = vec3(0.64, 0.63, 0.60);
vec3 snowPeakTint = vec3(1.18, 1.19, 1.20);
vec3 wetShorelineTint = vec3(0.40, 0.52, 0.54);
vec3 riverbedTint = vec3(0.42, 0.48, 0.44);
float cliffAccent = smoothstep(0.08, 1.0, vTerrainDetailBlend.x);
float snowAccent = smoothstep(0.04, 1.0, vTerrainDetailBlend.y);
float shorelineAccent = smoothstep(0.02, 1.0, vTerrainDetailBlend.z);
float riverbedAccent = smoothstep(0.02, 1.0, vTerrainDetailBlend.w);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * cliffTint, cliffAccent * 0.56);
diffuseColor.rgb = mix(diffuseColor.rgb, min(vec3(1.0), diffuseColor.rgb * snowPeakTint), snowAccent * 0.62);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * wetShorelineTint, shorelineAccent * 0.72);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * riverbedTint, riverbedAccent * 0.54);`,
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
float roughnessShorelineWetness = clamp(vTerrainDetailBlend.z * 0.78 + vTerrainDetailBlend.w * 0.94 + vSurfaceBlendB.w * 0.50 + vSurfaceBlendC.z * 0.40, 0.0, 1.0);
roughnessFactor = mix(roughnessFactor, 0.34, roughnessShorelineWetness * 0.68);
roughnessFactor = mix(roughnessFactor, 0.42, vTerrainDetailBlend.w * 0.60);`,
      );
  };

  return material;
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
