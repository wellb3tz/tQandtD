/**
 * Water system type definitions and configuration interfaces
 * 
 * Provides comprehensive configuration for ocean, river, and lake water rendering
 * with performance and rendering customization options.
 */

import * as THREE from 'three';

/**
 * Ocean water configuration
 */
export interface OceanConfig {
  /** Water color as hex value (e.g., 0x1e90ff) */
  color: number;
  /** Water opacity (0-1) */
  opacity: number;
  /** Material shininess (0-100) */
  shininess: number;
  /** Enable wave animation */
  enableWaves: boolean;
  /** Wave height multiplier */
  waveHeight: number;
  /** Wave animation speed */
  waveSpeed: number;
  /** Optional normal map texture for surface detail */
  normalMap?: THREE.Texture;
}

/**
 * River water configuration
 */
export interface RiverConfig {
  /** Water color as hex value (e.g., 0x4682b4) */
  color: number;
  /** Water opacity (0-1) */
  opacity: number;
  /** Material shininess (0-100) */
  shininess: number;
  /** Enable flow animation */
  enableFlowAnimation: boolean;
  /** Flow animation speed */
  flowSpeed: number;
}

/**
 * Lake water configuration
 */
export interface LakeConfig {
  /** Water color as hex value (e.g., 0x1e90ff) */
  color: number;
  /** Water opacity (0-1) */
  opacity: number;
  /** Material shininess (0-100) */
  shininess: number;
}

/**
 * Performance optimization settings
 */
export interface PerformanceConfig {
  /** Enable geometry pooling for reuse */
  enableGeometryPooling: boolean;
  /** Enable mesh merging for adjacent tiles */
  enableMeshMerging: boolean;
  /** Enable level of detail system */
  enableLOD: boolean;
  /** Enable frustum culling */
  enableFrustumCulling: boolean;
  /** Use instanced rendering for repeated patterns */
  useInstancedRendering: boolean;
}

/**
 * Rendering settings for water system
 */
export interface RenderingConfig {
  /** Y offset above terrain to prevent z-fighting */
  waterOffset: number;
  /** Underwater terrain darkening factor (0-1) */
  underwaterDarkenFactor: number;
  /** Underwater terrain desaturation factor (0-1) */
  underwaterDesaturationFactor: number;
  /** Enable depth-based gradient for underwater terrain */
  enableDepthGradient: boolean;
}

/**
 * Complete water system configuration
 */
export interface WaterConfig {
  /** Enable water rendering */
  enabled: boolean;
  /** Sea level elevation */
  seaLevel: number;
  /** Ocean water settings */
  ocean: OceanConfig;
  /** River water settings */
  river: RiverConfig;
  /** Lake water settings */
  lake: LakeConfig;
  /** Performance optimization settings */
  performance: PerformanceConfig;
  /** Rendering settings */
  rendering: RenderingConfig;
}

/**
 * Water mesh type identifier
 */
export type WaterType = 'ocean' | 'river' | 'lake';

/**
 * Water mesh with metadata
 */
export interface WaterMesh {
  /** Type of water body */
  type: WaterType;
  /** Three.js mesh */
  mesh: THREE.Mesh;
  /** Water material */
  material: THREE.MeshPhongMaterial | THREE.MeshStandardMaterial;
  /** Bounding box for culling */
  boundingBox: THREE.Box3;
  /** Optional animation data */
  animationData?: {
    time: number;
    wavePhase: number;
  };
}

/**
 * Water layer data for a chunk
 */
export interface WaterLayerData {
  /** Ocean water meshes */
  ocean: WaterMesh[];
  /** River water meshes */
  rivers: WaterMesh[];
  /** Lake water meshes */
  lakes: WaterMesh[];
  /** Container group for all water meshes */
  group: THREE.Group;
}

/**
 * Ocean tile data
 */
export interface OceanTile {
  /** Flat index in chunk */
  index: number;
  /** Height from heightmap */
  terrainHeight: number;
  /** Water surface elevation (seaLevel) */
  waterElevation: number;
  /** Depth below sea level */
  underwaterDepth: number;
}
