import { describe, expect, it } from 'vitest';
import { convertWorldLakesToChunkLakes } from '../src/world/water/lakes/lake-chunk-processing';
import type { WorldLakeData } from '../src/world/lake-manager';

describe('multi-chunk lake chunk conversion', () => {
  it('includes a render surface footprint for lake tiles that only touch the chunk boundary', () => {
    const lake: WorldLakeData = {
      id: 'lake_1',
      waterLevel: 0.5,
      tiles: new Set(['15,8']),
      maxDepth: 0.12,
      minTerrainHeight: 0.38,
      bounds: { minX: 15, maxX: 15, minY: 8, maxY: 8 },
    };

    const [chunkLake] = convertWorldLakesToChunkLakes([lake], 1, 0, 16);

    expect(chunkLake).toBeDefined();
    expect(chunkLake.tiles.size).toBe(0);
    expect(chunkLake.surfaceTiles).toEqual(new Set([112, 128, 144]));
  });

  it('keeps real lake tiles separate from the expanded surface footprint', () => {
    const lake: WorldLakeData = {
      id: 'lake_1',
      waterLevel: 0.5,
      tiles: new Set(['16,8']),
      maxDepth: 0.12,
      minTerrainHeight: 0.38,
      bounds: { minX: 16, maxX: 16, minY: 8, maxY: 8 },
    };

    const [chunkLake] = convertWorldLakesToChunkLakes([lake], 1, 0, 16);

    expect(chunkLake.tiles).toEqual(new Set([128]));
    expect(chunkLake.surfaceTiles).toEqual(new Set([112, 113, 128, 129, 144, 145]));
  });
});
