/**
 * Water material factory for creating ocean water materials
 * 
 * Provides factory functions for creating ocean materials
 * with configurable visual properties including color, opacity, shininess,
 * and optional normal map textures.
 */

import * as THREE from 'three';
import type { OceanConfig } from './types';

export const WATER_NORMAL_TEXTURE_URL = '/textures/water-normal-v1.png';
export const WATER_NORMAL_SCALE = {
  x: 0.18,
  y: 0.24,
} as const;
export const OCEAN_WAVE_SHADER_KEY = 'ocean-waves-v5';

interface OceanWaveUniforms {
  uOceanWaveTime: { value: number };
  uOceanWaveHeight: { value: number };
  uOceanWaveSpeed: { value: number };
  uOceanWaveShoreFadeStart: { value: number };
  uOceanWaveShoreFadeEnd: { value: number };
}

interface OceanWaveUserData {
  oceanWaveUniforms?: OceanWaveUniforms;
}

export function createWaterNormalTexture(
  loader: THREE.TextureLoader = new THREE.TextureLoader(),
): THREE.Texture {
  const texture = loader.load(WATER_NORMAL_TEXTURE_URL);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.7, 5.3);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Create ocean water material with depth-based vertex colors.
 *
 * Uses vertexColors so the depth gradient baked into the geometry is visible.
 * The base `color` tints the vertex colors multiplicatively - keep it white
 * (0xffffff) to show the gradient as-is, or tint for a stylised look.
 *
 * @param config - Ocean water configuration
 * @returns THREE.MeshPhongMaterial configured for ocean rendering
 */
export function createOceanMaterial(config: OceanConfig): THREE.MeshPhongMaterial {
  const waveUniforms: OceanWaveUniforms = {
    uOceanWaveTime: { value: 0 },
    uOceanWaveHeight: { value: config.enableWaves ? config.waveHeight : 0 },
    uOceanWaveSpeed: { value: config.waveSpeed },
    uOceanWaveShoreFadeStart: { value: 0.45 },
    uOceanWaveShoreFadeEnd: { value: 4.5 },
  };
  const material = new THREE.MeshPhongMaterial({
    // White base so vertex colors are not tinted
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
    // Slight specular highlight - gives water a wet look
    specular: new THREE.Color(0xd7f3ff),
  });

  if (config.normalMap) {
    material.normalMap = config.normalMap;
    material.normalScale = new THREE.Vector2(WATER_NORMAL_SCALE.x, WATER_NORMAL_SCALE.y);
  }

  (material.userData as OceanWaveUserData).oceanWaveUniforms = waveUniforms;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, waveUniforms);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
uniform float uOceanWaveTime;
uniform float uOceanWaveHeight;
uniform float uOceanWaveSpeed;
uniform float uOceanWaveShoreFadeStart;
uniform float uOceanWaveShoreFadeEnd;
attribute float waterDepth;
varying float vOceanWaterDepth;

float oceanWaveHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float oceanWaveNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = oceanWaveHash(i);
  float b = oceanWaveHash(i + vec2(1.0, 0.0));
  float c = oceanWaveHash(i + vec2(0.0, 1.0));
  float d = oceanWaveHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vOceanWaterDepth = waterDepth;
float oceanWaveTime = uOceanWaveTime * uOceanWaveSpeed;
vec2 oceanWavePosition = position.xz;
float oceanWavePatch = oceanWaveNoise(oceanWavePosition * 0.055 + oceanWaveTime * 0.025);
float oceanWaveDrift = oceanWaveNoise(oceanWavePosition * 0.13 - oceanWaveTime * 0.04);
float oceanWaveA = sin(dot(oceanWavePosition, vec2(0.78, 0.31)) * 0.31 + oceanWaveTime * 1.21 + oceanWavePatch * 2.4);
float oceanWaveB = sin(dot(oceanWavePosition, vec2(-0.42, 0.91)) * 0.47 - oceanWaveTime * 0.84 + oceanWaveDrift * 1.7);
float oceanWaveC = cos(dot(oceanWavePosition, vec2(0.16, -0.98)) * 0.68 + oceanWaveTime * 0.58 + oceanWavePatch);
float oceanWaveD = sin(dot(oceanWavePosition, vec2(0.96, -0.09)) * 0.19 - oceanWaveTime * 1.53 + oceanWaveDrift * 2.1);
float oceanWaveBlend = oceanWaveA * 0.34 + oceanWaveB * 0.28 + oceanWaveC * 0.21 + oceanWaveD * 0.17;
float oceanWaveShoreFade = smoothstep(uOceanWaveShoreFadeStart, uOceanWaveShoreFadeEnd, waterDepth);
float oceanWaveOffset = oceanWaveBlend * (0.72 + oceanWavePatch * 0.28) * uOceanWaveHeight * oceanWaveShoreFade;
float oceanWaveSafeTrough = max(waterDepth - 0.12, 0.0);
transformed.y += max(oceanWaveOffset, -oceanWaveSafeTrough);`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying float vOceanWaterDepth;

float oceanFragmentHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float oceanFragmentNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = oceanFragmentHash(i);
  float b = oceanFragmentHash(i + vec2(1.0, 0.0));
  float c = oceanFragmentHash(i + vec2(0.0, 1.0));
  float d = oceanFragmentHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float oceanDepthOpacity = smoothstep(1.5, 14.0, vOceanWaterDepth);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.018, 0.11, 0.15), oceanDepthOpacity * 0.62);
float oceanSkyGlint = smoothstep(0.08, 0.72, oceanFragmentNoise(gl_FragCoord.xy * 0.018 + vec2(vOceanWaterDepth * 0.07)));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.50, 0.78, 0.88), oceanSkyGlint * (1.0 - oceanDepthOpacity * 0.42) * 0.20);
diffuseColor.a = max(diffuseColor.a, mix(0.76, 0.97, oceanDepthOpacity));`
    );
  };
  material.customProgramCacheKey = () => OCEAN_WAVE_SHADER_KEY;

  return material;
}

export function updateOceanMaterialWaves(
  material: THREE.Material,
  config: OceanConfig,
  elapsedSeconds: number,
): void {
  const waveUniforms = (material.userData as OceanWaveUserData).oceanWaveUniforms;
  if (waveUniforms) {
    waveUniforms.uOceanWaveTime.value = elapsedSeconds;
    waveUniforms.uOceanWaveHeight.value = config.enableWaves ? config.waveHeight : 0;
    waveUniforms.uOceanWaveSpeed.value = config.waveSpeed;
  }

  if (!(material instanceof THREE.MeshPhongMaterial) || !material.normalMap) {
    return;
  }

  const textureDrift = config.enableWaves ? elapsedSeconds * config.waveSpeed : 0;
  material.normalMap.offset.set(
    (textureDrift * 0.009) % 1,
    (textureDrift * 0.014) % 1,
  );
}
