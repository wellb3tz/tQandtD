/**
 * Coordinate Conversion Utilities for WorldViewer
 * 
 * Provides utilities for converting between different coordinate systems:
 * - World coordinates: Global position in the procedural world
 * - Screen coordinates: 2D pixel coordinates on the canvas
 * - Chunk coordinates: Which chunk a position belongs to
 * - Local coordinates: Position within a specific chunk
 * 
 * Also includes raycasting utilities for terrain interaction.
 */

import * as THREE from 'three';
import { TERRAIN_HEIGHT_SCALE_METERS, type ChunkData } from '@engine/index';

/**
 * 3D vector for positions
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 2D vector for screen/world positions
 */
export interface Vector2 {
  x: number;
  y: number;
}

/**
 * Result of a raycast hit on terrain
 */
export interface RaycastHit {
  /** World space position of the hit */
  point: Vector3;
  /** Chunk X coordinate */
  chunkX: number;
  /** Chunk Y coordinate */
  chunkY: number;
  /** Local X coordinate within chunk [0, chunkSize) */
  localX: number;
  /** Local Y coordinate within chunk [0, chunkSize) */
  localY: number;
  /** Height value at the hit position */
  height: number;
  /** Distance from ray origin to hit point */
  distance: number;
  /** Optional chunk data carried by the intersected terrain mesh */
  chunkData?: ChunkData;
}

/**
 * Chunk coordinate pair
 */
export interface ChunkCoord {
  chunkX: number;
  chunkY: number;
}

/**
 * Convert world coordinates to screen coordinates
 * 
 * @param worldPos - Position in world space
 * @param camera - Three.js camera
 * @param canvas - Canvas element
 * @returns Screen coordinates in pixels
 */
export function worldToScreen(
  worldPos: Vector3,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement
): Vector2 {
  const vector = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
  vector.project(camera);
  
  return {
    x: (vector.x * 0.5 + 0.5) * canvas.width,
    y: (vector.y * -0.5 + 0.5) * canvas.height
  };
}

/**
 * Convert screen coordinates to normalized device coordinates
 * 
 * @param screenX - Screen X coordinate in pixels
 * @param screenY - Screen Y coordinate in pixels
 * @param canvas - Canvas element
 * @returns Normalized coordinates [-1, 1]
 */
export function screenToNDC(
  screenX: number,
  screenY: number,
  canvas: HTMLCanvasElement
): Vector2 {
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;

  return {
    x: (screenX / width) * 2 - 1,
    y: -(screenY / height) * 2 + 1
  };
}

/**
 * Perform raycasting from screen coordinates to terrain
 * 
 * @param screenX - Screen X coordinate in pixels
 * @param screenY - Screen Y coordinate in pixels
 * @param camera - Three.js camera
 * @param canvas - Canvas element
 * @param terrainMeshes - Array of terrain meshes to raycast against
 * @param chunkSize - Size of chunks
 * @param heightScale - Height multiplier used in mesh generation (default: TERRAIN_HEIGHT_SCALE_METERS)
 * @returns RaycastHit if terrain was hit, null otherwise
 */
export function raycastTerrain(
  screenX: number,
  screenY: number,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  terrainMeshes: THREE.Mesh[],
  chunkSize: number,
  heightScale: number = TERRAIN_HEIGHT_SCALE_METERS
): RaycastHit | null {
  // Convert screen to NDC
  const ndc = screenToNDC(screenX, screenY, canvas);
  
  // Create raycaster
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  
  // Perform raycast
  const intersects = raycaster.intersectObjects(terrainMeshes, false);
  
  if (intersects.length === 0) {
    return null;
  }
  
  // Get first intersection
  const intersection = intersects[0];
  const point = intersection.point;
  
  // Convert world position to chunk coordinates
  const worldX = Math.floor(point.x);
  const worldZ = Math.floor(point.z);
  const chunkX = Math.floor(worldX / chunkSize);
  const chunkY = Math.floor(worldZ / chunkSize);
  
  // Calculate local coordinates within chunk
  const localX = ((worldX % chunkSize) + chunkSize) % chunkSize;
  const localY = ((worldZ % chunkSize) + chunkSize) % chunkSize;
  
  // Calculate height (unscale from mesh height)
  const height = point.y / heightScale;
  
  return {
    point: {
      x: point.x,
      y: point.y,
      z: point.z
    },
    chunkX,
    chunkY,
    localX,
    localY,
    height,
    distance: intersection.distance,
    chunkData: (intersection.object as THREE.Mesh).userData?.chunkData as ChunkData | undefined
  };
}

/**
 * Get chunk coordinates from world position
 * 
 * @param worldX - World X coordinate
 * @param worldY - World Y coordinate
 * @param chunkSize - Size of chunks
 * @returns Chunk coordinates
 */
export function getChunkCoords(
  worldX: number,
  worldY: number,
  chunkSize: number
): ChunkCoord {
  return {
    chunkX: Math.floor(worldX / chunkSize),
    chunkY: Math.floor(worldY / chunkSize)
  };
}

/**
 * Calculate chunk boundaries in world space
 * 
 * @param chunkX - Chunk X coordinate
 * @param chunkY - Chunk Y coordinate
 * @param chunkSize - Size of chunks
 * @returns Object with min/max world coordinates
 */
export function getChunkBounds(
  chunkX: number,
  chunkY: number,
  chunkSize: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: chunkX * chunkSize,
    minY: chunkY * chunkSize,
    maxX: (chunkX + 1) * chunkSize,
    maxY: (chunkY + 1) * chunkSize
  };
}

/**
 * Check if a world position is within chunk boundaries
 * 
 * @param worldX - World X coordinate
 * @param worldY - World Y coordinate
 * @param chunkX - Chunk X coordinate
 * @param chunkY - Chunk Y coordinate
 * @param chunkSize - Size of chunks
 * @returns True if position is within chunk bounds
 */
export function isInChunkBounds(
  worldX: number,
  worldY: number,
  chunkX: number,
  chunkY: number,
  chunkSize: number
): boolean {
  const bounds = getChunkBounds(chunkX, chunkY, chunkSize);
  return worldX >= bounds.minX && worldX < bounds.maxX &&
         worldY >= bounds.minY && worldY < bounds.maxY;
}

/**
 * Get all chunks within a radius of a center chunk
 * 
 * @param centerChunkX - Center chunk X coordinate
 * @param centerChunkY - Center chunk Y coordinate
 * @param radius - Radius in chunks
 * @returns Array of chunk coordinates
 */
export function getChunksInRadius(
  centerChunkX: number,
  centerChunkY: number,
  radius: number
): ChunkCoord[] {
  const chunks: ChunkCoord[] = [];
  
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      chunks.push({
        chunkX: centerChunkX + dx,
        chunkY: centerChunkY + dy
      });
    }
  }
  
  return chunks;
}

/**
 * Calculate distance between two chunk coordinates
 * 
 * @param chunk1 - First chunk coordinate
 * @param chunk2 - Second chunk coordinate
 * @returns Distance in chunks (Chebyshev distance)
 */
export function chunkDistance(chunk1: ChunkCoord, chunk2: ChunkCoord): number {
  return Math.max(
    Math.abs(chunk1.chunkX - chunk2.chunkX),
    Math.abs(chunk1.chunkY - chunk2.chunkY)
  );
}

/**
 * Get height at a specific world position from chunk data
 * 
 * @param worldX - World X coordinate
 * @param worldY - World Y coordinate
 * @param chunkData - Chunk data containing heightmap
 * @param chunkX - Chunk X coordinate
 * @param chunkY - Chunk Y coordinate
 * @returns Height value at the position, or null if out of bounds
 */
export function getHeightAtPosition(
  worldX: number,
  worldY: number,
  chunkData: ChunkData,
  chunkX: number,
  chunkY: number
): number | null {
  const chunkSize = chunkData.size;
  
  // Check if position is in this chunk
  if (!isInChunkBounds(worldX, worldY, chunkX, chunkY, chunkSize)) {
    return null;
  }
  
  // Calculate local coordinates
  const localX = ((worldX % chunkSize) + chunkSize) % chunkSize;
  const localY = ((worldY % chunkSize) + chunkSize) % chunkSize;
  
  // Get height from heightmap
  const index = localY * chunkSize + localX;
  return chunkData.heightmap[index];
}

/**
 * Interpolate height between heightmap samples for smoother results
 * 
 * @param worldX - World X coordinate (can be fractional)
 * @param worldY - World Y coordinate (can be fractional)
 * @param chunkData - Chunk data containing heightmap
 * @param chunkX - Chunk X coordinate
 * @param chunkY - Chunk Y coordinate
 * @returns Interpolated height value, or null if out of bounds
 */
export function getInterpolatedHeight(
  worldX: number,
  worldY: number,
  chunkData: ChunkData,
  chunkX: number,
  chunkY: number
): number | null {
  const chunkSize = chunkData.size;
  const bounds = getChunkBounds(chunkX, chunkY, chunkSize);
  
  // Check bounds
  if (worldX < bounds.minX || worldX >= bounds.maxX ||
      worldY < bounds.minY || worldY >= bounds.maxY) {
    return null;
  }
  
  // Get fractional local coordinates
  const localX = worldX - bounds.minX;
  const localY = worldY - bounds.minY;
  
  // Get integer coordinates for the four corners
  const x0 = Math.floor(localX);
  const y0 = Math.floor(localY);
  const x1 = Math.min(x0 + 1, chunkSize - 1);
  const y1 = Math.min(y0 + 1, chunkSize - 1);
  
  // Get fractional parts
  const fx = localX - x0;
  const fy = localY - y0;
  
  // Get heights at four corners
  const h00 = chunkData.heightmap[y0 * chunkSize + x0];
  const h10 = chunkData.heightmap[y0 * chunkSize + x1];
  const h01 = chunkData.heightmap[y1 * chunkSize + x0];
  const h11 = chunkData.heightmap[y1 * chunkSize + x1];
  
  // Bilinear interpolation
  const h0 = h00 * (1 - fx) + h10 * fx;
  const h1 = h01 * (1 - fx) + h11 * fx;
  const height = h0 * (1 - fy) + h1 * fy;
  
  return height;
}

/**
 * Calculate normal vector at a world position for lighting/shading
 * 
 * @param worldX - World X coordinate
 * @param worldY - World Y coordinate
 * @param chunkData - Chunk data containing heightmap
 * @param chunkX - Chunk X coordinate
 * @param chunkY - Chunk Y coordinate
 * @param heightScale - Height multiplier used in visualization (default: TERRAIN_HEIGHT_SCALE_METERS)
 * @returns Normal vector, or null if out of bounds
 */
export function getNormalAtPosition(
  worldX: number,
  worldY: number,
  chunkData: ChunkData,
  chunkX: number,
  chunkY: number,
  heightScale: number = TERRAIN_HEIGHT_SCALE_METERS
): Vector3 | null {
  const chunkSize = chunkData.size;
  
  // Check if position is in this chunk
  if (!isInChunkBounds(worldX, worldY, chunkX, chunkY, chunkSize)) {
    return null;
  }
  
  // Calculate local coordinates
  const localX = ((worldX % chunkSize) + chunkSize) % chunkSize;
  const localY = ((worldY % chunkSize) + chunkSize) % chunkSize;
  
  // Get neighboring heights (with bounds checking)
  const getHeight = (lx: number, ly: number): number => {
    const clampedX = Math.max(0, Math.min(chunkSize - 1, lx));
    const clampedY = Math.max(0, Math.min(chunkSize - 1, ly));
    return chunkData.heightmap[clampedY * chunkSize + clampedX] * heightScale;
  };
  
  const hL = getHeight(localX - 1, localY);
  const hR = getHeight(localX + 1, localY);
  const hD = getHeight(localX, localY - 1);
  const hU = getHeight(localX, localY + 1);
  
  // Calculate normal using central differences
  const normal = new THREE.Vector3(hL - hR, 2, hD - hU);
  normal.normalize();
  
  return {
    x: normal.x,
    y: normal.y,
    z: normal.z
  };
}
