/**
 * Water material factory for creating ocean water materials
 * 
 * Provides factory functions for creating ocean materials
 * with configurable visual properties including color, opacity, shininess,
 * and optional normal map textures.
 */

import * as THREE from 'three';
import type { OceanConfig } from './types';

/**
 * Create ocean water material with configurable properties
 * 
 * @param config - Ocean water configuration
 * @returns THREE.MeshPhongMaterial configured for ocean rendering
 */
export function createOceanMaterial(config: OceanConfig): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    color: config.color,
    transparent: true,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
  });

  // Apply optional normal map for surface detail
  if (config.normalMap) {
    material.normalMap = config.normalMap;
  }

  return material;
}
