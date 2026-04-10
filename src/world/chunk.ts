// Chunk data structures and coordinate utilities

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
 */
export interface ChunkData {
  x: number;
  y: number;
  size: number;
  heightmap: Float32Array;
  biomeMap: Uint8Array;
  biomeWeights: Float32Array;
  resources: Resource[];
  structures: Structure[];
  rivers: Set<number>;
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
