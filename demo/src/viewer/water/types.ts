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
  /** Enable ocean water rendering */
  enabled: boolean;
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
  /** Lake rendering settings */
  lake: LakeRenderConfig;
  /** River rendering settings */
  river: RiverRenderConfig;
  /** Performance optimization settings */
  performance: PerformanceConfig;
  /** Rendering settings */
  rendering: RenderingConfig;
}

/**
 * Water mesh type identifier
 *
 * 'ocean' = global sea-level water body
 * 'lake'  = inland water body above sea level
 */
export type WaterType = 'ocean' | 'lake' | 'river';

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
 * Contains ocean and lake water meshes and their container group
 * for a single chunk.
 */
export interface WaterLayerData {
  /** Ocean water meshes */
  ocean: WaterMesh[];
  /** Lake water meshes */
  lake: WaterMesh[];
  /** River water meshes */
  river: WaterMesh[];
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

/**
 * Lake tile data — same shape as OceanTile but waterElevation > seaLevel.
 */
export interface LakeTile {
  /** Flat tile index (row-major, size × size) */
  index: number;
  /** Average terrain height of the tile's four corners */
  terrainHeight: number;
  /** Water surface elevation (lake water level, > seaLevel) */
  waterElevation: number;
  /** Depth below lake surface */
  underwaterDepth: number;
}

/**
 * Lake configuration for rendering.
 */
export interface LakeRenderConfig {
  /** Enable lake rendering (default: true) */
  enabled: boolean;
  /** Lake water color as hex (default: 0x00ff88 — vivid green for testing) */
  color: number;
  /** Lake water opacity (default: 0.80) */
  opacity: number;
  /** Material shininess (default: 60) */
  shininess: number;
}

/**
 * River configuration for rendering.
 */
export interface RiverRenderConfig {
  /** Enable river rendering (default: true) */
  enabled: boolean;
  /** River water color as hex */
  color: number;
  /** River water opacity */
  opacity: number;
  /** Material shininess */
  shininess: number;
}
