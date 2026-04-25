// Chunk data structures and coordinate utilities

import type { LakeData } from '../gen/lakes';

/**
 * Biome types for world generation
 */
export enum BiomeType {
  OCEAN = 0,
  BEACH = 1,
  DESERT = 2,
  PLAINS = 3,
  FOREST = 4,
  TAIGA = 5,
  TUNDRA = 6,
  MOUNTAIN = 7,
  // Extended biomes
  SAVANNA = 8,      // Hot + moderate moisture, transitional between desert and plains
  SWAMP = 9,        // Warm/temperate + very wet + low elevation
  RAINFOREST = 10,  // Hot + very wet
  VOLCANIC = 11,    // Extreme elevation with volcanic features
  GLACIER = 12,     // Very cold + high elevation, distinct from tundra
}

/**
 * Resource types that can be found in the world
 */
export enum ResourceType {
  IRON = 0,
  GOLD = 1,
  COAL = 2,
  STONE = 3,
  WOOD = 4,
}

/**
 * Structure types that can be placed in the world
 */
export enum StructureType {
  VILLAGE = 0,
  RUINS = 1,
  TOWER = 2,
}

/**
 * Resource instance with position, type, and amount
 */
export interface Resource {
  x: number;
  y: number;
  type: ResourceType;
  amount: number;
}

/**
 * Structure instance with position and type
 */
export interface Structure {
  x: number;
  y: number;
  type: StructureType;
}

/**
 * Complete chunk data containing all generated information
 * 
 * **Important**: When seamless chunks are enabled (default), the heightmap contains
 * `(size + 1) * (size + 1)` vertices instead of `size * size`. This allows boundary
 * vertices to be shared between adjacent chunks, eliminating visible gaps.
 * 
 * For example, with size=32:
 * - Heightmap contains 33x33 = 1089 vertices (indices 0-32 in both dimensions)
 * - The vertex at local (32, y) in chunk (0, 0) has world x = 32
 * - The vertex at local (0, y) in chunk (1, 0) also has world x = 32
 * - Both vertices sample the same world coordinate, ensuring identical heights
 */
export interface ChunkData {
  /** Chunk X coordinate in chunk space */
  x: number;
  /** Chunk Y coordinate in chunk space */
  y: number;
  /** Size of the chunk (number of units per side, not vertex count) */
  size: number;
  /** 
   * Heightmap array with (size + 1) * (size + 1) vertices when seamless chunks enabled.
   * Access using: heightmap[localY * (size + 1) + localX]
   */
  heightmap: Float32Array;
  /** Biome type for each point (size * size elements) */
  biomeMap: Uint8Array;
  /** Biome blend weights (size * size * numBiomes elements) */
  biomeWeights: Float32Array;
  /** Micro-biome type for each point (size * size elements), 255 = no micro-biome */
  microBiomeMap?: Uint8Array;
  /** Lake bodies detected inside this chunk (may be empty) */
  lakes?: LakeData[];
  /** Resources placed in this chunk */
  resources: Resource[];
  /** Structures placed in this chunk */
  structures: Structure[];
}

/**
 * Convert world coordinates to chunk coordinates
 * @param worldX - World X coordinate
 * @param worldY - World Y coordinate
 * @param chunkSize - Size of each chunk
 * @returns Tuple of [chunkX, chunkY]
 */
export function worldToChunk(worldX: number, worldY: number, chunkSize: number): [number, number] {
  return [Math.floor(worldX / chunkSize), Math.floor(worldY / chunkSize)];
}

/**
 * Convert chunk coordinates to world coordinates (top-left corner of chunk)
 * @param chunkX - Chunk X coordinate
 * @param chunkY - Chunk Y coordinate
 * @param chunkSize - Size of each chunk
 * @returns Tuple of [worldX, worldY]
 */
export function chunkToWorld(chunkX: number, chunkY: number, chunkSize: number): [number, number] {
  return [chunkX * chunkSize, chunkY * chunkSize];
}

/**
 * Convert world coordinates to local chunk coordinates
 * @param worldX - World X coordinate
 * @param worldY - World Y coordinate
 * @param chunkSize - Size of each chunk
 * @returns Tuple of [localX, localY] within the chunk [0, chunkSize)
 */
export function worldToLocal(worldX: number, worldY: number, chunkSize: number): [number, number] {
  return [
    ((worldX % chunkSize) + chunkSize) % chunkSize,
    ((worldY % chunkSize) + chunkSize) % chunkSize
  ];
}

/**
 * Convert local chunk coordinates to flat array index
 * @param localX - Local X coordinate within chunk
 * @param localY - Local Y coordinate within chunk
 * @param chunkSize - Size of the chunk
 * @returns Flat array index
 */
export function localToIndex(localX: number, localY: number, chunkSize: number): number {
  return localY * chunkSize + localX;
}

/**
 * Convert flat array index to local chunk coordinates
 * @param index - Flat array index
 * @param chunkSize - Size of the chunk
 * @returns Tuple of [localX, localY]
 */
export function indexToLocal(index: number, chunkSize: number): [number, number] {
  return [index % chunkSize, Math.floor(index / chunkSize)];
}

/**
 * Edge types for boundary vertex access
 */
export type ChunkEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Get a boundary vertex from a chunk's heightmap
 * 
 * This helper function simplifies accessing vertices along chunk edges,
 * which is useful for verifying seamless boundaries between adjacent chunks.
 * 
 * @param chunk - The chunk data containing the heightmap
 * @param edge - Which edge to access ('top', 'bottom', 'left', 'right')
 * @param index - Index along the edge (0 to chunk.size inclusive)
 * @returns The height value at the specified boundary position
 * 
 * @example
 * // Get the first vertex on the right edge of a chunk
 * const height = getBoundaryVertex(chunk, 'right', 0);
 * 
 * // Get the last vertex on the top edge
 * const height = getBoundaryVertex(chunk, 'top', chunk.size);
 */
export function getBoundaryVertex(chunk: ChunkData, edge: ChunkEdge, index: number): number {
  const vertexSize = chunk.size + 1;
  
  if (index < 0 || index > chunk.size) {
    throw new Error(`Boundary index ${index} out of range [0, ${chunk.size}]`);
  }
  
  let localX: number;
  let localY: number;
  
  switch (edge) {
    case 'top':
      localX = index;
      localY = 0;
      break;
    case 'bottom':
      localX = index;
      localY = chunk.size;
      break;
    case 'left':
      localX = 0;
      localY = index;
      break;
    case 'right':
      localX = chunk.size;
      localY = index;
      break;
    default:
      throw new Error(`Invalid edge type: ${edge}`);
  }
  
  const heightmapIndex = localY * vertexSize + localX;
  return chunk.heightmap[heightmapIndex];
}

/**
 * Convert local chunk coordinates to world coordinates
 * 
 * This helper function converts coordinates within a chunk's local space
 * to global world coordinates. This is essential for ensuring boundary
 * vertices share identical world positions across adjacent chunks.
 * 
 * @param chunk - The chunk data
 * @param localX - Local X coordinate within the chunk (0 to chunk.size inclusive)
 * @param localY - Local Y coordinate within the chunk (0 to chunk.size inclusive)
 * @returns Tuple of [worldX, worldY] in global coordinate space
 * 
 * @example
 * // Get world coordinates for the top-left corner of a chunk
 * const [worldX, worldY] = getWorldCoordinate(chunk, 0, 0);
 * 
 * // Get world coordinates for the bottom-right corner (boundary vertex)
 * const [worldX, worldY] = getWorldCoordinate(chunk, chunk.size, chunk.size);
 */
export function getWorldCoordinate(chunk: ChunkData, localX: number, localY: number): [number, number] {
  if (localX < 0 || localX > chunk.size) {
    throw new Error(`Local X coordinate ${localX} out of range [0, ${chunk.size}]`);
  }
  if (localY < 0 || localY > chunk.size) {
    throw new Error(`Local Y coordinate ${localY} out of range [0, ${chunk.size}]`);
  }
  
  const worldX = chunk.x * chunk.size + localX;
  const worldY = chunk.y * chunk.size + localY;
  
  return [worldX, worldY];
}
