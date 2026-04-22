/**
 * Water system type definitions and configuration interfaces
 * 
 * Provides comprehensive configuration for ocean water rendering
 * with performance and rendering customization options.
 * 
 * The water system exclusively supports ocean water rendering.
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
 * Performance optimization settings
 */
export interface PerformanceConfig {
  /** Enable frustum culling */
  enableFrustumCulling: boolean;
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
 * 
 * Configures ocean water rendering with visual properties,
 * performance optimizations, and rendering settings.
 */
export interface WaterConfig {
  /** Enable water rendering */
  enabled: boolean;
  /** Sea level elevation */
  seaLevel: number;
  /** Ocean water settings */
  ocean: OceanConfig;
  /** Performance optimization settings */
  performance: PerformanceConfig;
  /** Rendering settings */
  rendering: RenderingConfig;
}

/**
 * Water mesh type identifier
 * 
 * Single literal type enforcing ocean-only water rendering.
 */
export type WaterType = 'ocean';

/**
 * Water mesh with metadata
 * 
 * Represents an ocean water mesh with rendering properties
 * and optional animation data.
 */
export interface WaterMesh {
  /** Type of water body (always 'ocean') */
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
 * 
 * Contains ocean water meshes and their container group
 * for a single chunk.
 */
export interface WaterLayerData {
  /** Ocean water meshes */
  ocean: WaterMesh[];
  /** Container group for ocean water meshes */
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
