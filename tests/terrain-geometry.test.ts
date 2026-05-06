import { describe, expect, it } from 'vitest';
import {
  BiomeType,
  buildTerrainGridGeometryData,
  type ChunkData,
} from '../src';

function createChunkData(overrides: Partial<ChunkData> = {}): ChunkData {
  return {
    x: 2,
    y: 3,
    size: 2,
    heightmap: new Float32Array([
      0.2, 0.3, 0.4,
      0.3, 0.5, 0.6,
      0.4, 0.6, 0.8,
    ]),
    biomeMap: new Uint8Array([
      BiomeType.PLAINS,
      BiomeType.FOREST,
      BiomeType.DESERT,
      BiomeType.MOUNTAIN,
    ]),
    biomeWeights: new Float32Array(2 * 2 * 13),
    resources: [],
    structures: [],
    ...overrides,
  } as ChunkData;
}

describe('terrain grid geometry data', () => {
  it('builds terrain positions, uvs, and indices without Three.js', () => {
    const data = createChunkData();
    const grid = buildTerrainGridGeometryData(data, 2, 3, { heightScale: 50 });

    expect(grid.chunkData).toBe(data);
    expect(grid.chunkSize).toBe(2);
    expect(grid.verticesPerSide).toBe(3);
    expect(grid.vertexCount).toBe(9);
    expect(grid.positions).toHaveLength(27);
    expect(grid.uvs).toHaveLength(18);
    expect(grid.indices).toHaveLength(24);
    expect(grid.positions[0]).toBe(4);
    expect(grid.positions[1]).toBeCloseTo(10);
    expect(grid.positions[2]).toBe(6);
    expect(Array.from(grid.indices.slice(0, 6))).toEqual([0, 3, 1, 1, 3, 4]);
  });

  it('pads malformed heightmaps and reports the mismatch', () => {
    const data = createChunkData({
      heightmap: new Float32Array([0.25, 0.5]),
    });

    const grid = buildTerrainGridGeometryData(data, 0, 0, { heightScale: 10 });

    expect(grid.heightmapSizeMismatch).toBe(true);
    expect(grid.expectedHeightmapSize).toBe(9);
    expect(grid.originalHeightmapSize).toBe(2);
    expect(grid.chunkData).not.toBe(data);
    expect(grid.chunkData.heightmap).toHaveLength(9);
    expect(grid.positions[1]).toBeCloseTo(2.5);
    expect(grid.positions[4]).toBeCloseTo(5);
    expect(grid.positions[7]).toBe(0);
  });
});
