/**
 * Water material factory for creating distinct water materials
 * 
 * Provides factory functions for creating ocean, river, and lake materials
 * with configurable visual properties including color, opacity, shininess,
 * and optional normal map textures.
 */

import * as THREE from 'three';
import type { OceanConfig, RiverConfig, LakeConfig } from './types';

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

/**
 * Create river water material with distinct visual properties
 * 
 * @param config - River water configuration
 * @returns THREE.MeshPhongMaterial configured for river rendering
 */
export function createRiverMaterial(config: RiverConfig): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    color: config.color,
    transparent: true,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
  });

  return material;
}

/**
 * Create lake water material with appropriate transparency
 * 
 * @param config - Lake water configuration
 * @returns THREE.MeshPhongMaterial configured for lake rendering
 */
export function createLakeMaterial(config: LakeConfig): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    color: config.color,
    transparent: true,
    opacity: config.opacity,
    shininess: config.shininess,
    side: THREE.DoubleSide,
  });

  return material;
}
