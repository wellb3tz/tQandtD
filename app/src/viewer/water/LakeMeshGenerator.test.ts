import { describe, expect, it } from 'vitest';
import { BiomeType, type ChunkData, type LakeData } from '@engine/index';
import type { LakeTile } from './types';
import { buildLakeGeometry } from './LakeMeshGenerator';

function createChunk(size = 4): ChunkData {
  const vertexSize = size + 1;
  const heightmap = new Float32Array(vertexSize * vertexSize).fill(0.7);
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

function lowerTileCorners(chunk: ChunkData, tx: number, ty: number, height = 0.35): void {
  const vertexSize = chunk.size + 1;
  chunk.heightmap[ty * vertexSize + tx] = height;
  chunk.heightmap[ty * vertexSize + tx + 1] = height;
  chunk.heightmap[(ty + 1) * vertexSize + tx] = height;
  chunk.heightmap[(ty + 1) * vertexSize + tx + 1] = height;
}

function createLake(tileIndices: number[]): LakeData {
  return {
    waterLevel: 0.5,
    tiles: new Set(tileIndices),
    maxDepth: 0.15,
    minTerrainHeight: 0.35,
  };
}

function buildGeometry(lake: LakeData, chunk: ChunkData) {
  const lakeTiles: LakeTile[] = [{ index: 0, terrainHeight: 0.35, waterElevation: 0.5, underwaterDepth: 0.15 }];
  const geometry = buildLakeGeometry(lakeTiles, [lake], chunk);
  expect(geometry).not.toBeNull();
  return geometry!;
}

function buildBounds(lake: LakeData, chunk: ChunkData): { minX: number; maxX: number } {
  const geometry = buildGeometry(lake, chunk);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  return { minX: box.min.x, maxX: box.max.x };
}

describe('LakeMeshGenerator contour mesh', () => {
  it('clips the shoreline to the terrain water-level contour', () => {
    const chunk = createChunk();
    lowerTileCorners(chunk, 1, 1);

    const lake = createLake([1 * chunk.size + 1]);
    const bounds = buildBounds(lake, chunk);

    expect(bounds.minX).toBeLessThan(1);
    expect(bounds.maxX).toBeGreaterThan(2);
    expect(bounds.minX).toBeGreaterThan(0);
    expect(bounds.maxX).toBeLessThan(3);
  });

  it('generates shoreline polygons instead of only square tile quads', () => {
    const chunk = createChunk();
    lowerTileCorners(chunk, 1, 1);

    const lake = createLake([1 * chunk.size + 1]);
    const geometry = buildGeometry(lake, chunk);
    const position = geometry.getAttribute('position');

    expect(position.count).toBeGreaterThan(4);
  });

  it('darkens deeper lake vertices while keeping the gradient in vertex colors', () => {
    const chunk = createChunk(1);
    lowerTileCorners(chunk, 0, 0);

    const lake = createLake([0]);
    const geometry = buildGeometry(lake, chunk);
    const colors = geometry.getAttribute('color');

    expect(colors.getX(0)).toBeLessThanOrEqual(0.08);
    expect(colors.getY(0)).toBeLessThanOrEqual(0.30);
    expect(colors.getZ(0)).toBeLessThanOrEqual(0.38);
  });
});
