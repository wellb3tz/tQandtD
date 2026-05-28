import type { Structure } from '../chunk';
import type { ChunkModification } from '../serialization';

export function mergeChunkModification(
  modifications: Map<string, ChunkModification>,
  chunkX: number,
  chunkY: number,
  modification: ChunkModification
): void {
  const key = `${chunkX},${chunkY}`;
  const existing = modifications.get(key);

  if (!existing) {
    modifications.set(key, {
      chunkX,
      chunkY,
      timestamp: modification.timestamp,
      modifiedTiles: new Set(modification.modifiedTiles),
      heightChanges: new Map(modification.heightChanges),
      addedStructures: [...modification.addedStructures],
      removedStructures: [...modification.removedStructures],
    });
    return;
  }

  existing.timestamp = modification.timestamp;
  for (const tile of modification.modifiedTiles) {
    existing.modifiedTiles.add(tile);
  }
  for (const [index, height] of modification.heightChanges) {
    existing.heightChanges.set(index, height);
  }
  existing.addedStructures.push(...modification.addedStructures);
  existing.removedStructures.push(...modification.removedStructures);
}

export function createStructureModification(
  chunkX: number,
  chunkY: number,
  addedStructures: Structure[],
  removedStructures: number[],
  timestamp = Date.now()
): ChunkModification {
  return {
    chunkX,
    chunkY,
    timestamp,
    modifiedTiles: new Set(),
    heightChanges: new Map(),
    addedStructures: [...addedStructures],
    removedStructures: [...removedStructures],
  };
}
