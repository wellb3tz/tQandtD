/**
 * Materials and color mapping for biome-based terrain rendering
 * 
 * Provides comprehensive biome color definitions and utilities for
 * smooth color blending between biomes based on blend weights.
 */

import { BiomeType } from '@engine/world/chunk';
import * as THREE from 'three';

export const TERRAIN_ALBEDO_TEXTURE_URL = '/textures/terrain-albedo-v1.png';
export const TERRAIN_NORMAL_TEXTURE_URL = '/textures/terrain-normal-v1.png';
export const TERRAIN_ROUGHNESS_TEXTURE_URL = '/textures/terrain-roughness-v1.png';

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

export type TerrainSurfaceTextureLibrary = Record<TerrainSurfaceKey, TerrainTextureSet>;

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
  };
}

export function selectTerrainSurfaceKey(
  biome: BiomeType,
  elevation: number,
  slope: number,
): TerrainSurfaceKey {
  if ((biome === BiomeType.MOUNTAIN || biome === BiomeType.GLACIER) && elevation >= 0.78 && slope < 0.55) {
    return 'snow';
  }

  if (biome === BiomeType.VOLCANIC) {
    return 'volcanicRock';
  }

  if (slope >= 0.6 || biome === BiomeType.MOUNTAIN) {
    return 'mountainRock';
  }

  if (biome === BiomeType.DESERT) {
    return 'desert';
  }

  if (biome === BiomeType.SAVANNA) {
    return 'dryGrass';
  }

  if (biome === BiomeType.BEACH) {
    return 'beach';
  }

  if (biome === BiomeType.GLACIER) {
    return 'ice';
  }

  if (biome === BiomeType.TUNDRA) {
    return 'snow';
  }

  if (biome === BiomeType.FOREST || biome === BiomeType.TAIGA || biome === BiomeType.RAINFOREST) {
    return 'forestFloor';
  }

  if (biome === BiomeType.SWAMP) {
    return 'swampMud';
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
    color: new THREE.Color(2.25, 2.25, 2.25),
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
    map: textures.plains.albedo,
    normalMap: textures.plains.normal,
    color: new THREE.Color(2.25, 2.25, 2.25),
    normalScale: new THREE.Vector2(0.35, 0.35),
    vertexColors: true,
    wireframe,
    roughness: 0.85,
    metalness: 0.0,
  });

  material.userData.terrainTexturesEnabled = true;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.terrainAlbedoPlains = { value: textures.plains.albedo };
    shader.uniforms.terrainAlbedoDesert = { value: textures.desert.albedo };
    shader.uniforms.terrainAlbedoBeach = { value: textures.beach.albedo };
    shader.uniforms.terrainAlbedoMountainRock = { value: textures.mountainRock.albedo };
    shader.uniforms.terrainAlbedoSnow = { value: textures.snow.albedo };
    shader.uniforms.terrainAlbedoForestFloor = { value: textures.forestFloor.albedo };
    shader.uniforms.terrainAlbedoDryGrass = { value: textures.dryGrass.albedo };
    shader.uniforms.terrainAlbedoSwampMud = { value: textures.swampMud.albedo };
    shader.uniforms.terrainAlbedoVolcanicRock = { value: textures.volcanicRock.albedo };
    shader.uniforms.terrainAlbedoIce = { value: textures.ice.albedo };
    shader.uniforms.terrainAlbedoRiverbed = { value: textures.riverbed.albedo };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 surfaceBlendA;
attribute vec4 surfaceBlendB;
attribute vec4 surfaceBlendC;
attribute vec3 terrainDetailBlend;
varying vec4 vSurfaceBlendA;
varying vec4 vSurfaceBlendB;
varying vec4 vSurfaceBlendC;
varying vec3 vTerrainDetailBlend;`,
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
uniform sampler2D terrainAlbedoPlains;
uniform sampler2D terrainAlbedoDesert;
uniform sampler2D terrainAlbedoBeach;
uniform sampler2D terrainAlbedoMountainRock;
uniform sampler2D terrainAlbedoSnow;
uniform sampler2D terrainAlbedoForestFloor;
uniform sampler2D terrainAlbedoDryGrass;
uniform sampler2D terrainAlbedoSwampMud;
uniform sampler2D terrainAlbedoVolcanicRock;
uniform sampler2D terrainAlbedoIce;
uniform sampler2D terrainAlbedoRiverbed;
varying vec4 vSurfaceBlendA;
varying vec4 vSurfaceBlendB;
varying vec4 vSurfaceBlendC;
varying vec3 vTerrainDetailBlend;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec4 terrainPlains = texture2D(terrainAlbedoPlains, vMapUv);
vec4 terrainDesert = texture2D(terrainAlbedoDesert, vMapUv);
vec4 terrainBeach = texture2D(terrainAlbedoBeach, vMapUv);
vec4 terrainMountainRock = texture2D(terrainAlbedoMountainRock, vMapUv);
vec4 terrainSnow = texture2D(terrainAlbedoSnow, vMapUv);
vec4 terrainForestFloor = texture2D(terrainAlbedoForestFloor, vMapUv);
vec4 terrainDryGrass = texture2D(terrainAlbedoDryGrass, vMapUv);
vec4 terrainSwampMud = texture2D(terrainAlbedoSwampMud, vMapUv);
vec4 terrainVolcanicRock = texture2D(terrainAlbedoVolcanicRock, vMapUv);
vec4 terrainIce = texture2D(terrainAlbedoIce, vMapUv);
vec4 terrainRiverbed = texture2D(terrainAlbedoRiverbed, vMapUv);
vec4 blendedTerrainMap =
  terrainPlains * vSurfaceBlendA.x +
  terrainDesert * vSurfaceBlendA.y +
  terrainBeach * vSurfaceBlendA.z +
  terrainMountainRock * vSurfaceBlendA.w +
  terrainSnow * vSurfaceBlendB.x +
  terrainForestFloor * vSurfaceBlendB.y +
  terrainDryGrass * vSurfaceBlendB.z +
  terrainSwampMud * vSurfaceBlendB.w +
  terrainVolcanicRock * vSurfaceBlendC.x +
  terrainIce * vSurfaceBlendC.y +
  terrainRiverbed * vSurfaceBlendC.z;
vec3 terrainDetailContrast = clamp((blendedTerrainMap.rgb - vec3(0.72)) * 1.85 + vec3(0.90), vec3(0.52), vec3(1.35));
diffuseColor.rgb *= terrainDetailContrast;
diffuseColor.a *= blendedTerrainMap.a;
vec3 cliffTint = vec3(0.76, 0.74, 0.70);
vec3 snowPeakTint = vec3(1.10, 1.13, 1.16);
vec3 wetShorelineTint = vec3(0.48, 0.60, 0.64);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * cliffTint, vTerrainDetailBlend.x * 0.28);
diffuseColor.rgb = mix(diffuseColor.rgb, min(vec3(1.0), diffuseColor.rgb * snowPeakTint), vTerrainDetailBlend.y * 0.35);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * wetShorelineTint, vTerrainDetailBlend.z * 0.45);`,
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
roughnessFactor = mix(roughnessFactor, 0.38, vTerrainDetailBlend.z * 0.65);`,
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
