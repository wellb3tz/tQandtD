/**
 * Lake mesh generator
 *
 * Converts engine lake geometry data into Three.js geometry/materials.
 */

import * as THREE from 'three';
import {
  buildLakeGeometryData,
  identifyLakeSurfaceTiles,
  type ChunkData,
  type LakeData,
  type LakeState,
} from '@engine/index';
import type { LakeTile, LakeRenderConfig } from './types';
import { HEIGHT_SCALE, HORIZONTAL_SCALE } from './config';
import { createBufferGeometry } from '../BufferGeometryFactory';
import { LAKE_WATER_NORMAL_SCALE } from './WaterMaterialFactory';

export const LAKE_SURFACE_SHADER_KEY = 'lake-surface-v1';
export const LAKE_SURFACE_UV_SCALE = 0.006;

interface LakeSurfaceUniforms {
  uLakeSurfaceTime: { value: number };
}

interface LakeSurfaceUserData {
  lakeState?: LakeState;
  lakeSurfaceUniforms?: LakeSurfaceUniforms;
}

export function identifyLakeTiles(
  chunkData: ChunkData,
  lakes: LakeData[],
): LakeTile[] {
  return identifyLakeSurfaceTiles(chunkData, lakes);
}

export function buildLakeGeometry(
  lakeTiles: LakeTile[],
  lakes: LakeData[],
  chunkData: ChunkData,
): THREE.BufferGeometry | null {
  const geometry = createBufferGeometry(
    buildLakeGeometryData(lakeTiles, lakes, chunkData, {
      heightScale: HEIGHT_SCALE,
      horizontalScale: HORIZONTAL_SCALE,
    })
  );
  if (!geometry) {
    return null;
  }

  applyWorldSpaceLakeUvs(geometry);
  return geometry;
}

function applyWorldSpaceLakeUvs(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute('position');
  const uv = new Float32Array(position.count * 2);

  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = position.getX(i) * LAKE_SURFACE_UV_SCALE;
    uv[i * 2 + 1] = position.getZ(i) * LAKE_SURFACE_UV_SCALE;
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function createLakeMaterial(config: LakeRenderConfig): THREE.MeshPhongMaterial {
  return createLakeMaterialForState(config, 'filled');
}

export function createLakeMaterialForState(
  config: LakeRenderConfig,
  state: LakeState = 'filled',
): THREE.MeshPhongMaterial {
  const frozen = state === 'frozen';
  const lakeUniforms: LakeSurfaceUniforms = {
    uLakeSurfaceTime: { value: 0 },
  };
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: frozen ? Math.min(1, Math.max(config.opacity, 0.88)) : config.opacity,
    shininess: frozen ? Math.min(100, Math.max(config.shininess, 82)) : config.shininess,
    side: THREE.DoubleSide,
    specular: new THREE.Color(frozen ? 0xd8f6ff : 0x88ffcc),
  });

  (material.userData as LakeSurfaceUserData).lakeState = state;
  (material.userData as LakeSurfaceUserData).lakeSurfaceUniforms = lakeUniforms;
  if (!frozen && config.normalMap) {
    material.normalMap = config.normalMap;
    material.normalScale = new THREE.Vector2(LAKE_WATER_NORMAL_SCALE.x, LAKE_WATER_NORMAL_SCALE.y);
  }

  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, lakeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vLakeSurfaceUv;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
vLakeSurfaceUv = uv;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uLakeSurfaceTime;
varying vec2 vLakeSurfaceUv;

float lakeSurfaceHash(vec2 p) {
  p = fract(p * vec2(134.34, 345.21));
  p += dot(p, p + 31.32);
  return fract(p.x * p.y);
}

float lakeSurfaceNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = lakeSurfaceHash(i);
  float b = lakeSurfaceHash(i + vec2(1.0, 0.0));
  float c = lakeSurfaceHash(i + vec2(0.0, 1.0));
  float d = lakeSurfaceHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec2 lakeUv = vLakeSurfaceUv * vec2(9.0, 9.0);
float lakeBreath = lakeSurfaceNoise(lakeUv + vec2(uLakeSurfaceTime * 0.018, -uLakeSurfaceTime * 0.012));
float lakeGlint = smoothstep(0.60, 0.94, lakeSurfaceNoise(lakeUv * 2.7 + vec2(-uLakeSurfaceTime * 0.035, uLakeSurfaceTime * 0.021)));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.24, 0.27), 0.20 + lakeBreath * 0.10);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58, 0.88, 0.88), lakeGlint * 0.18);
diffuseColor.a = max(diffuseColor.a, 0.78);`,
      );
  };
  material.customProgramCacheKey = () => `${LAKE_SURFACE_SHADER_KEY}:${state}`;
  return material;
}

export function updateLakeMaterialSurface(material: THREE.Material, elapsedSeconds: number): void {
  const uniforms = (material.userData as LakeSurfaceUserData).lakeSurfaceUniforms;
  if (uniforms) {
    uniforms.uLakeSurfaceTime.value = elapsedSeconds;
  }
}
