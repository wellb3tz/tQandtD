import type { ChunkData } from './chunk';

type CacheEntry = { chunk: ChunkData };
type ChunkInvalidationCallback = (chunkX: number, chunkY: number) => void;
type ChunkUpdatedCallback = (chunk: ChunkData) => void;

function getCacheKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

export function reconcileBoundaryHeights(
  chunk: ChunkData,
  cache: ReadonlyMap<string, CacheEntry>,
  onChunkInvalidated?: ChunkInvalidationCallback,
  onChunkUpdated?: ChunkUpdatedCallback
): void {
  const size = chunk.size;
  const vertexSize = size + 1;
  const epsilon = 1e-6;
  const invalidatedNeighbours = new Set<string>();

  const reconcileVertical = (
    neighbourChunk: ChunkData,
    currentX: number,
    neighbourX: number
  ): void => {
    let neighbourNeedsUpdate = false;
    for (let y = 0; y <= size; y++) {
      const currentIndex = y * vertexSize + currentX;
      const neighbourIndex = y * vertexSize + neighbourX;
      const sharedHeight = Math.min(chunk.heightmap[currentIndex], neighbourChunk.heightmap[neighbourIndex]);
      if (Math.abs(chunk.heightmap[currentIndex] - sharedHeight) > epsilon) {
        chunk.heightmap[currentIndex] = sharedHeight;
      }
      if (Math.abs(neighbourChunk.heightmap[neighbourIndex] - sharedHeight) > epsilon) {
        neighbourNeedsUpdate = true;
      }
    }
    if (neighbourNeedsUpdate) {
      invalidatedNeighbours.add(getCacheKey(neighbourChunk.x, neighbourChunk.y));
    }
  };

  const reconcileHorizontal = (
    neighbourChunk: ChunkData,
    currentY: number,
    neighbourY: number
  ): void => {
    let neighbourNeedsUpdate = false;
    for (let x = 0; x <= size; x++) {
      const currentIndex = currentY * vertexSize + x;
      const neighbourIndex = neighbourY * vertexSize + x;
      const sharedHeight = Math.min(chunk.heightmap[currentIndex], neighbourChunk.heightmap[neighbourIndex]);
      if (Math.abs(chunk.heightmap[currentIndex] - sharedHeight) > epsilon) {
        chunk.heightmap[currentIndex] = sharedHeight;
      }
      if (Math.abs(neighbourChunk.heightmap[neighbourIndex] - sharedHeight) > epsilon) {
        neighbourNeedsUpdate = true;
      }
    }
    if (neighbourNeedsUpdate) {
      invalidatedNeighbours.add(getCacheKey(neighbourChunk.x, neighbourChunk.y));
    }
  };

  const left = cache.get(getCacheKey(chunk.x - 1, chunk.y))?.chunk;
  if (left) reconcileVertical(left, 0, size);

  const right = cache.get(getCacheKey(chunk.x + 1, chunk.y))?.chunk;
  if (right) reconcileVertical(right, size, 0);

  const top = cache.get(getCacheKey(chunk.x, chunk.y - 1))?.chunk;
  if (top) reconcileHorizontal(top, 0, size);

  const bottom = cache.get(getCacheKey(chunk.x, chunk.y + 1))?.chunk;
  if (bottom) reconcileHorizontal(bottom, size, 0);

  for (const key of invalidatedNeighbours) {
    const [chunkX, chunkY] = key.split(',').map(Number);
    onChunkInvalidated?.(chunkX, chunkY);
  }

  onChunkUpdated?.(chunk);
}

export function reconcileNeighbourBoundaries(
  chunk: ChunkData,
  cache: ReadonlyMap<string, CacheEntry>,
  onChunkInvalidated?: ChunkInvalidationCallback,
  onChunkUpdated?: ChunkUpdatedCallback
): void {
  const neighbours = [
    cache.get(getCacheKey(chunk.x - 1, chunk.y))?.chunk,
    cache.get(getCacheKey(chunk.x + 1, chunk.y))?.chunk,
    cache.get(getCacheKey(chunk.x, chunk.y - 1))?.chunk,
    cache.get(getCacheKey(chunk.x, chunk.y + 1))?.chunk,
  ];

  for (const neighbour of neighbours) {
    if (neighbour) {
      reconcileBoundaryHeights(neighbour, cache, onChunkInvalidated, onChunkUpdated);
    }
  }
}
