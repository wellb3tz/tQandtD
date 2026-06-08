import { describe, expect, it } from 'vitest';
import {
  BiomeType,
  buildLakeGeometryData,
  buildOceanGeometryData,
  buildRiverGeometryData,
  getIndexedGeometryVertexCount,
  getRiverChannelWidth,
  getRiverValleyWidth,
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

function river(points: RiverData['points'], isTributary = false): RiverData {
  return {
    riverId: 'river_1',
    pathId: isTributary ? 'river_1:tributary' : 'river_1:main',
    isTributary,
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

  it('keeps lake interiors filled when an enclosed terrain vertex rises above water', () => {
    const chunk = createChunk(3, 0.35);
    setHeight(chunk, 1, 1, 0.85);
    const lake = createLake(Array.from({ length: 9 }, (_, index) => index));

    const lakeTiles = identifyLakeSurfaceTiles(chunk, [lake]);
    const data = buildLakeGeometryData(lakeTiles, [lake], chunk, { heightScale: HEIGHT_SCALE });

    expect(data).not.toBeNull();
    const hasInteriorVertex = Array.from({ length: getIndexedGeometryVertexCount(data!) }, (_, index) => index)
      .some(index => (
        Math.abs(data!.positions[index * 3] - 1) < 1e-6 &&
        Math.abs(data!.positions[index * 3 + 2] - 1) < 1e-6
      ));

    expect(hasInteriorVertex).toBe(true);
    for (let i = 0; i < data!.indices.length; i += 3) {
      const a = data!.indices[i] * 3;
      const b = data!.indices[i + 1] * 3;
      const c = data!.indices[i + 2] * 3;
      const ax = data!.positions[a];
      const az = data!.positions[a + 2];
      const bx = data!.positions[b];
      const bz = data!.positions[b + 2];
      const cx = data!.positions[c];
      const cz = data!.positions[c + 2];
      const area = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
      expect(area).toBeGreaterThan(1e-8);
    }
  });

  it('fills lake tile corners even when the shoreline terrain forms a sharp high point', () => {
    const chunk = createChunk(2, 0.35);
    setHeight(chunk, 1, 1, 0.9);
    const lake = createLake([0]);

    const lakeTiles = identifyLakeSurfaceTiles(chunk, [lake]);
    const data = buildLakeGeometryData(lakeTiles, [lake], chunk, { heightScale: HEIGHT_SCALE });

    expect(data).not.toBeNull();
    const coversSharpCorner = Array.from({ length: getIndexedGeometryVertexCount(data!) }, (_, index) => index)
      .some(index => (
        Math.abs(data!.positions[index * 3] - 1) < 1e-6 &&
        Math.abs(data!.positions[index * 3 + 2] - 1) < 1e-6
      ));

    expect(coversSharpCorner).toBe(true);
  });

  it('adds shoreline corner fill around lake tiles to avoid V-shaped visual gaps', () => {
    const chunk = createChunk(2, 0.9);
    lowerTileCorners(chunk, 0, 0, 0.35);
    const lake = createLake([0]);

    const lakeTiles = identifyLakeSurfaceTiles(chunk, [lake]);
    const data = buildLakeGeometryData(lakeTiles, [lake], chunk, { heightScale: HEIGHT_SCALE });

    expect(data).not.toBeNull();
    const hasDiagonalCornerFill = Array.from({ length: data!.indices.length / 3 }, (_, index) => index * 3)
      .some(index => {
        const a = data!.indices[index] * 3;
        const b = data!.indices[index + 1] * 3;
        const c = data!.indices[index + 2] * 3;
        const centroidX = (data!.positions[a] + data!.positions[b] + data!.positions[c]) / 3;
        const centroidZ = (data!.positions[a + 2] + data!.positions[b + 2] + data!.positions[c + 2]) / 3;

        return centroidX > 1 && centroidX < 2 && centroidZ > 1 && centroidZ < 2;
      });

    expect(hasDiagonalCornerFill).toBe(true);
  });

  it('builds lake surface from render footprint tiles even when no basin tile is local', () => {
    const chunk = createChunk(2, 0.35);
    const lake = {
      ...createLake([]),
      surfaceTiles: new Set([0]),
    };

    const data = buildLakeGeometryData([], [lake], chunk, { heightScale: HEIGHT_SCALE });

    expect(data).not.toBeNull();
    expect(getIndexedGeometryVertexCount(data!)).toBeGreaterThanOrEqual(4);
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
      { heightScale: HEIGHT_SCALE, surfaceOffset: -0.6 },
      0.3,
    );

    expect(data).not.toBeNull();
    expect(getIndexedGeometryVertexCount(data!)).toBe(30);
    // Centre vertex (no edge lift) sits at the water level
    expect(data!.positions[7]).toBeCloseTo(getRiverWaterLevel(points[0]) * HEIGHT_SCALE - 0.6, 5);
    // Width matches the actual channel width (no hard minimum enforced)
    expect(Math.abs(data!.positions[2] - data!.positions[14])).toBeCloseTo(getRiverChannelWidth(points[0]), 0);
    expect(Math.abs(data!.positions[2] - data!.positions[14])).toBeLessThan(5);
    expect(data!.colors.slice(0, 6)).toEqual([0.04, 0.1, 0.23, 0.04, 0.1, 0.23]);
  });

  it('colors frozen river surfaces as ice instead of flowing water', () => {
    const points: RiverData['points'] = [
      { x: 0, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 4, y: 1, height: 0.42, surfaceLevel: 0.43, width: 1, depth: 0.03, channelDepth: 0.04, flowX: 1, flowY: 0 },
    ];

    const frozenRiver = { ...river(points), state: 'frozen' as const };
    const data = buildRiverGeometryData(
      [frozenRiver],
      0,
      0,
      16,
      { heightScale: HEIGHT_SCALE, surfaceOffset: -0.6 },
      0.3,
    );

    expect(data).not.toBeNull();
    expect(data!.colors[0]).toBeGreaterThan(0.6);
    expect(data!.colors[1]).toBeGreaterThan(0.8);
    expect(data!.colors[2]).toBeGreaterThan(0.9);
  });

  it('tapers tributary water to zero width at the confluence', () => {
    const points: RiverData['points'] = [
      { x: 0, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelWidth: 1.2, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 4, y: 1, height: 0.42, surfaceLevel: 0.43, width: 1, depth: 0.03, channelWidth: 1.4, channelDepth: 0.05, flowX: 1, flowY: 0 },
    ];

    const data = buildRiverGeometryData(
      [river(points, true)],
      0,
      0,
      16,
      { heightScale: HEIGHT_SCALE, surfaceOffset: -0.6 },
      0.3,
    );

    expect(data).not.toBeNull();
    const columnCount = 5;
    const vertexCount = getIndexedGeometryVertexCount(data!);
    const firstRowZ = Array.from({ length: columnCount }, (_, column) => data!.positions[column * 3 + 2]);
    const lastRowStart = (vertexCount - columnCount) * 3;
    const lastRowZ = Array.from({ length: columnCount }, (_, column) => data!.positions[lastRowStart + column * 3 + 2]);

    expect(Math.max(...firstRowZ) - Math.min(...firstRowZ)).toBeGreaterThan(0.5);
    expect(Math.max(...lastRowZ) - Math.min(...lastRowZ)).toBeCloseTo(0, 5);
  });
});
