import { describe, expect, it } from 'vitest';
import {
  BiomeType,
  buildLakeGeometryData,
  buildOceanGeometryData,
  buildRiverGeometryData,
  getIndexedGeometryVertexCount,
  getRiverChannelWidth,
  getRiverWaterLevel,
  identifyLakeSurfaceTiles,
  identifyOceanSurfaceTiles,
  type ChunkData,
  type LakeData,
  type RiverData,
} from '../src';

const HEIGHT_SCALE = 50;

function createChunk(size = 2, fillHeight = 0.5): ChunkData {
  const vertexSize = size + 1;
  return {
    x: 0,
    y: 0,
    size,
    heightmap: new Float32Array(vertexSize * vertexSize).fill(fillHeight),
    biomeMap: new Uint8Array(size * size).fill(BiomeType.PLAINS),
    biomeWeights: new Float32Array(size * size * 13),
    resources: [],
    structures: [],
  };
}

function setHeight(chunk: ChunkData, vx: number, vy: number, height: number): void {
  const vertexSize = chunk.size + 1;
  chunk.heightmap[vy * vertexSize + vx] = height;
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

function river(points: RiverData['points']): RiverData {
  return {
    riverId: 'river_1',
    pathId: 'river_1:main',
    isTributary: false,
    points,
    bounds: { minX: 0, maxX: 4, minY: 1, maxY: 1 },
  };
}

describe('water geometry data helpers', () => {
  it('builds clipped ocean data without depending on Three.js', () => {
    const chunk = createChunk();
    setHeight(chunk, 0, 0, 0.1);

    const oceanTiles = identifyOceanSurfaceTiles(chunk, 0.3);
    const data = buildOceanGeometryData(oceanTiles, chunk, 0.3, { heightScale: HEIGHT_SCALE });

    expect(oceanTiles.some(tile => tile.index === 0)).toBe(true);
    expect(data).not.toBeNull();
    expect(getIndexedGeometryVertexCount(data!)).toBe(3);
    expect(Math.max(...data!.positions.filter((_, index) => index % 3 === 0))).toBeLessThan(1);
  });

  it('builds lake shoreline data with depth colors', () => {
    const chunk = createChunk(1, 0.7);
    lowerTileCorners(chunk, 0, 0);
    const lake = createLake([0]);

    const lakeTiles = identifyLakeSurfaceTiles(chunk, [lake]);
    const data = buildLakeGeometryData(lakeTiles, [lake], chunk, { heightScale: HEIGHT_SCALE });

    expect(lakeTiles).toHaveLength(1);
    expect(data).not.toBeNull();
    expect(getIndexedGeometryVertexCount(data!)).toBeGreaterThanOrEqual(4);
    expect(data!.colors[0]).toBeLessThanOrEqual(0.08);
  });

  it('builds and clips subdivided river surface data at ocean level', () => {
    const points: RiverData['points'] = [
      { x: 0, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 4, y: 1, height: 0.34, surfaceLevel: 0.35, width: 1, depth: 0.03, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 8, y: 1, height: 0.24, surfaceLevel: 0.25, width: 1, depth: 0.03, channelDepth: 0.04, flowX: 1, flowY: 0 },
    ];

    const data = buildRiverGeometryData(
      [river(points)],
      0,
      0,
      16,
      { heightScale: HEIGHT_SCALE, surfaceOffset: -1 },
      0.3,
    );

    expect(data).not.toBeNull();
    expect(getIndexedGeometryVertexCount(data!)).toBe(30);
    expect(data!.positions[1]).toBeCloseTo(getRiverWaterLevel(points[0]) * HEIGHT_SCALE - 1, 5);
    expect(Math.abs(data!.positions[2] - data!.positions[14])).toBeGreaterThan(getRiverChannelWidth(points[0]) * 1.5);
    expect(data!.colors.slice(0, 6)).toEqual([0.04, 0.1, 0.23, 0.04, 0.1, 0.23]);
  });
});
