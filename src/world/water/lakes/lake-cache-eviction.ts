import type { WorldLakeData } from './lake-manager-types';
import { unindexLakeTiles } from './lake-spatial-index';

export interface LakeCacheState {
  lakes: Map<string, WorldLakeData>;
  chunkToLakes: Map<string, Set<string>>;
  lakeAccessTime: Map<string, number>;
  chunkAccessTime: Map<string, number>;
  tileToLakeId: Map<string, string>;
  maxLakes: number;
  maxChunkEntries: number;
}

export function evictOldLakeCacheEntries(state: LakeCacheState): void {
  while (state.lakes.size >= state.maxLakes) {
    let oldestLakeId: string | null = null;
    let oldestTime = Infinity;

    for (const [lakeId, accessTime] of state.lakeAccessTime.entries()) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestLakeId = lakeId;
      }
    }

    if (oldestLakeId) {
      evictLake(state, oldestLakeId);
    } else {
      const firstLakeId = state.lakes.keys().next().value;
      if (firstLakeId) {
        evictLake(state, firstLakeId);
      } else {
        break;
      }
    }
  }

  while (state.chunkToLakes.size >= state.maxChunkEntries) {
    let oldestChunkKey: string | null = null;
    let oldestTime = Infinity;

    for (const [chunkKey, accessTime] of state.chunkAccessTime.entries()) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestChunkKey = chunkKey;
      }
    }

    if (oldestChunkKey) {
      state.chunkToLakes.delete(oldestChunkKey);
      state.chunkAccessTime.delete(oldestChunkKey);
    } else {
      const firstChunkKey = state.chunkToLakes.keys().next().value;
      if (firstChunkKey) {
        state.chunkToLakes.delete(firstChunkKey);
        state.chunkAccessTime.delete(firstChunkKey);
      } else {
        break;
      }
    }
  }
}

export function evictLake(state: LakeCacheState, lakeId: string): void {
  const lake = state.lakes.get(lakeId);
  if (!lake) return;

  unindexLakeTiles(state.tileToLakeId, lake);

  for (const [chunkKey, lakeIds] of state.chunkToLakes.entries()) {
    lakeIds.delete(lakeId);
    if (lakeIds.size === 0) {
      state.chunkToLakes.delete(chunkKey);
      state.chunkAccessTime.delete(chunkKey);
    }
  }

  state.lakes.delete(lakeId);
  state.lakeAccessTime.delete(lakeId);
}
