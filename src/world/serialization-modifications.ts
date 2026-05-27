import type { ChunkData } from './chunk';
import type {
  ChunkManagerSnapshot,
  ChunkModification,
  SerializationOptions,
} from './serialization-types';
import { logger, LogCategory } from '../utils/logger';

export function serializeModifications(
  chunkManager: ChunkManagerSnapshot,
  options: SerializationOptions
): ChunkModification[] {
  const modifications: ChunkModification[] = [];
  const modificationsMap = chunkManager.modifications as Map<string, ChunkModification> | undefined;
  if (!modificationsMap) {
    return modifications;
  }

  for (const [, modification] of modificationsMap.entries()) {
    if (options.region) {
      const { minX, minY, maxX, maxY } = options.region;
      if (modification.chunkX < minX || modification.chunkX > maxX ||
          modification.chunkY < minY || modification.chunkY > maxY) {
        continue;
      }
    }
    modifications.push(modification);
  }

  return modifications;
}

export function addChunkToSnapshotCache(chunkManager: ChunkManagerSnapshot, chunk: ChunkData): void {
  const cache = chunkManager.cache as Map<string, { chunk: ChunkData; lastAccessed: number }>;
  cache.set(`${chunk.x},${chunk.y}`, {
    chunk,
    lastAccessed: ++chunkManager.accessCounter,
  });
}

export function applyModifications(modifications: ChunkModification[], chunkManager: ChunkManagerSnapshot): void {
  for (const modification of modifications) {
    const key = `${modification.chunkX},${modification.chunkY}`;
    const cacheEntry = chunkManager.cache.get(key);
    if (!cacheEntry) {
      logger.warn(LogCategory.CHUNK, `Cannot apply modifications to chunk (${modification.chunkX}, ${modification.chunkY}): chunk not in cache`);
      continue;
    }

    const chunk = cacheEntry.chunk;
    applyHeightChanges(chunk, modification);
    applyStructureRemovals(chunk, modification);
    chunk.structures.push(...modification.addedStructures);
    chunkManager.recordModification(modification.chunkX, modification.chunkY, modification);
  }
}

function applyHeightChanges(chunk: ChunkData, modification: ChunkModification): void {
  for (const [tileIndex, newHeight] of modification.heightChanges) {
    if (tileIndex >= 0 && tileIndex < chunk.heightmap.length) {
      chunk.heightmap[tileIndex] = newHeight;
    } else {
      logger.warn(LogCategory.CHUNK, `Invalid tile index ${tileIndex} in height changes for chunk (${modification.chunkX}, ${modification.chunkY})`);
    }
  }
}

function applyStructureRemovals(chunk: ChunkData, modification: ChunkModification): void {
  const sortedRemovals = [...modification.removedStructures].sort((a, b) => b - a);
  for (const structureIndex of sortedRemovals) {
    if (structureIndex >= 0 && structureIndex < chunk.structures.length) {
      chunk.structures.splice(structureIndex, 1);
    } else {
      logger.warn(LogCategory.CHUNK, `Invalid structure index ${structureIndex} in removals for chunk (${modification.chunkX}, ${modification.chunkY})`);
    }
  }
}

