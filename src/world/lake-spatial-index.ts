import type { WorldLakeData } from './lake-manager-types';

export interface LakeChunkBounds {
  minChunkX: number;
  maxChunkX: number;
  minChunkY: number;
  maxChunkY: number;
}

export function getLakeChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

export function encodeLakeTile(worldX: number, worldY: number): string {
  return `${worldX},${worldY}`;
}

export function decodeLakeTile(key: string): [number, number] {
  const [x, y] = key.split(',').map(Number);
  return [x, y];
}

/**
 * Chunks affected by a lake's terrain carving. Lake tiles affect their four
 * corner vertices; vertices on chunk borders are duplicated by adjacent chunk
 * meshes, so registration and invalidation must include neighbouring chunks.
 */
export function getAffectedLakeChunkBounds(lake: WorldLakeData, chunkSize: number): LakeChunkBounds {
  return {
    minChunkX: Math.floor((lake.bounds.minX - 1) / chunkSize),
    maxChunkX: Math.floor((lake.bounds.maxX + 1) / chunkSize),
    minChunkY: Math.floor((lake.bounds.minY - 1) / chunkSize),
    maxChunkY: Math.floor((lake.bounds.maxY + 1) / chunkSize),
  };
}

export function indexLakeTiles(tileToLakeId: Map<string, string>, lake: WorldLakeData): void {
  for (const tileKey of lake.tiles) {
    tileToLakeId.set(tileKey, lake.id);
  }
}

export function unindexLakeTiles(tileToLakeId: Map<string, string>, lake: WorldLakeData): void {
  for (const tileKey of lake.tiles) {
    if (tileToLakeId.get(tileKey) === lake.id) {
      tileToLakeId.delete(tileKey);
    }
  }
}

export function registerLakeChunks(
  chunkToLakes: Map<string, Set<string>>,
  lake: WorldLakeData,
  chunkSize: number,
  onRegisterChunk: (chunkKey: string) => void,
): void {
  const { minChunkX, maxChunkX, minChunkY, maxChunkY } = getAffectedLakeChunkBounds(lake, chunkSize);

  for (let cy = minChunkY; cy <= maxChunkY; cy++) {
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      const chunkKey = getLakeChunkKey(cx, cy);
      if (!chunkToLakes.has(chunkKey)) {
        chunkToLakes.set(chunkKey, new Set());
      }
      chunkToLakes.get(chunkKey)!.add(lake.id);
      onRegisterChunk(chunkKey);
    }
  }
}
