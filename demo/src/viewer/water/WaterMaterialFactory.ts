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

export function createWaterNormalTexture(
  loader: THREE.TextureLoader = new THREE.TextureLoader(),
): THREE.Texture {
  const texture = loader.load(WATER_NORMAL_TEXTURE_URL);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Create ocean water material with depth-based vertex colors.
 *
 * Uses vertexColors so the depth gradient baked into the geometry is visible.
 * The base `color` tints the vertex colors multiplicatively — keep it white
 * (0xffffff) to show the gradient as-is, or tint for a stylised look.
 *
 * @param config - Ocean water configuration
 * @returns THREE.MeshPhongMaterial configured for ocean rendering
 */
export function createOceanMaterial(config: OceanConfig): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    // White base so vertex colors are not tinted
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
    // Slight specular highlight — gives water a wet look
    specular: new THREE.Color(0x88ccff),
  });

  if (config.normalMap) {
    material.normalMap = config.normalMap;
  }

  return material;
}
