import { describe, expect, it } from 'vitest';
import type { ChunkData } from '@engine/world/chunk';
import { BiomeType } from '@engine/world/chunk';
import type { LakeData } from '../../../../src/gen/lakes';
import type { LakeTile } from './types';
import { buildLakeGeometry } from './LakeMeshGenerator';

function createChunk(size = 4): ChunkData {
  const vertexSize = size + 1;
  const heightmap = new Float32Array(vertexSize * vertexSize).fill(0.35);
  const biomeMap = new Uint8Array(size * size).fill(BiomeType.PLAINS);
  const biomeWeights = new Float32Array(size * size * 13);

  return {
    x: 0,
    y: 0,
    size,
    heightmap,
    biomeMap,
    biomeWeights,
    resources: [],
    structures: [],
  };
}

function createLake(tileIndices: number[]): LakeData {
  return {
    waterLevel: 0.5,
    tiles: new Set(tileIndices),
    maxDepth: 0.15,
    minTerrainHeight: 0.35,
  };
}

function buildBounds(lake: LakeData, chunk = createChunk()): { minX: number; maxX: number } {
  const lakeTiles: LakeTile[] = [{ index: 0, terrainHeight: 0.35, waterElevation: 0.5, underwaterDepth: 0.15 }];
  const geometry = buildLakeGeometry(lakeTiles, [lake], chunk);
  expect(geometry).not.toBeNull();

  geometry!.computeBoundingBox();
  const box = geometry!.boundingBox!;
  return { minX: box.min.x, maxX: box.max.x };
}

describe('LakeMeshGenerator shoreline expansion', () => {
  it('expands lake shoreline over interior basin edges', () => {
    const chunk = createChunk();
    const lake = createLake([1 * chunk.size + 1]);

    const bounds = buildBounds(lake, chunk);

    expect(bounds.minX).toBeLessThan(1);
    expect(bounds.maxX).toBeGreaterThan(2);
  });

  it('does not expand lake mesh outside its chunk bounds', () => {
    const chunk = createChunk();
    const lake = createLake([1 * chunk.size + (chunk.size - 1)]);

    const bounds = buildBounds(lake, chunk);

    expect(bounds.maxX).toBeLessThanOrEqual(chunk.size);
  });
});
