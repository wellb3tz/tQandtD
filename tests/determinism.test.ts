/**
 * Determinism tests
 *
 * Core guarantee: same seed -> same world, always.
 * These tests catch any accidental introduction of non-deterministic state
 * (Date.now(), Math.random(), uninitialized memory, etc.).
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import { DEFAULT_LAKE_CONFIG } from '../src/gen/lakes';
import { DEFAULT_RIVER_CONFIG } from '../src/gen/rivers';
import type { ChunkData } from '../src/world/chunk';
import { makeMinimalConfig } from './helpers';

describe('Determinism', () => {
  it('same seed produces identical heightmaps for the same chunk', async () => {
    const a = new ChunkManager(makeMinimalConfig(42));
    const b = new ChunkManager(makeMinimalConfig(42));

    const chunkA = await a.getChunk(0, 0);
    const chunkB = await b.getChunk(0, 0);

    expect(Array.from(chunkA.heightmap)).toEqual(Array.from(chunkB.heightmap));
  });

  it('different seeds produce different heightmaps', async () => {
    const a = new ChunkManager(makeMinimalConfig(1));
    const b = new ChunkManager(makeMinimalConfig(2));

    const chunkA = await a.getChunk(0, 0);
    const chunkB = await b.getChunk(0, 0);

    expect(Array.from(chunkA.heightmap)).not.toEqual(Array.from(chunkB.heightmap));
  });

  it('same seed produces identical biome maps', async () => {
    const a = new ChunkManager(makeMinimalConfig(99));
    const b = new ChunkManager(makeMinimalConfig(99));

    const chunkA = await a.getChunk(3, -2);
    const chunkB = await b.getChunk(3, -2);

    expect(Array.from(chunkA.biomeMap)).toEqual(Array.from(chunkB.biomeMap));
  });

  it('same seed produces identical resources and structures', async () => {
    const a = new ChunkManager(makeMinimalConfig(7));
    const b = new ChunkManager(makeMinimalConfig(7));

    const chunkA = await a.getChunk(1, 1);
    const chunkB = await b.getChunk(1, 1);

    expect(chunkA.resources).toEqual(chunkB.resources);
    expect(chunkA.structures).toEqual(chunkB.structures);
  });

  it('same seed produces identical lakes', async () => {
    const config = makeMinimalConfig(123);
    config.lakeConfig = DEFAULT_LAKE_CONFIG;

    const a = new ChunkManager(config);
    const b = new ChunkManager({ ...config });

    const chunkA = await a.getChunk(0, 0);
    const chunkB = await b.getChunk(0, 0);

    const lakesA = (chunkA.lakes ?? []).map(l => ({
      waterLevel: l.waterLevel,
      tiles: Array.from(l.tiles).sort((x, y) => x - y),
      maxDepth: l.maxDepth,
    }));
    const lakesB = (chunkB.lakes ?? []).map(l => ({
      waterLevel: l.waterLevel,
      tiles: Array.from(l.tiles).sort((x, y) => x - y),
      maxDepth: l.maxDepth,
    }));

    expect(lakesA).toEqual(lakesB);
  });

  it('same seed produces identical rivers', async () => {
    const config = makeMinimalConfig(123);
    config.riverConfig = {
      ...DEFAULT_RIVER_CONFIG,
      sourceThreshold: 0,
      maxRiversPerRegion: 1,
      minRiverLength: 4,
      maxLength: 96,
    };

    const a = new ChunkManager(config);
    const b = new ChunkManager({ ...config });
    const chunkA = await a.getChunk(0, 0);
    const chunkB = await b.getChunk(0, 0);

    const normalize = (chunk: typeof chunkA) =>
      (chunk.rivers ?? []).map(r => ({
        riverId: r.riverId,
        pathId: r.pathId,
        points: r.points.map(p => [p.x, p.y, Number(p.surfaceLevel.toFixed(4))]),
      }));

    expect(normalize(chunkA)).toEqual(normalize(chunkB));
  });

  it('negative chunk coordinates are deterministic', async () => {
    const a = new ChunkManager(makeMinimalConfig(55));
    const b = new ChunkManager(makeMinimalConfig(55));

    const chunkA = await a.getChunk(-3, -5);
    const chunkB = await b.getChunk(-3, -5);

    expect(Array.from(chunkA.heightmap)).toEqual(Array.from(chunkB.heightmap));
  });

  it('hydrology does not depend on chunk request order', async () => {
    const config = makeMinimalConfig(123);
    config.maxCacheSize = 200;
    config.lakeConfig = {
      ...DEFAULT_LAKE_CONFIG,
      noiseThreshold: 0.54,
      maxLakeTiles: 120,
    };
    config.riverConfig = {
      ...DEFAULT_RIVER_CONFIG,
      sourceThreshold: 0.35,
      maxRiversPerRegion: 2,
      minRiverLength: 4,
      maxLength: 96,
    };
    const coordinates = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ];

    const forward = await generateHydrologySnapshot(config, coordinates, coordinates);
    const reverse = await generateHydrologySnapshot(config, [...coordinates].reverse(), coordinates);

    expect(reverse).toEqual(forward);
  });
});

async function generateHydrologySnapshot(
  config: ReturnType<typeof makeMinimalConfig>,
  requestOrder: Array<{ x: number; y: number }>,
  snapshotOrder: Array<{ x: number; y: number }>,
): Promise<Record<string, unknown>> {
  const manager = new ChunkManager(config);
  for (const coordinate of requestOrder) {
    await manager.getChunk(coordinate.x, coordinate.y);
  }

  const snapshot: Record<string, unknown> = {};
  for (const coordinate of snapshotOrder) {
    const chunk = await manager.getChunk(coordinate.x, coordinate.y);
    snapshot[`${coordinate.x},${coordinate.y}`] = normalizeHydrologyChunk(chunk);
  }
  manager.dispose();
  return snapshot;
}

function normalizeHydrologyChunk(chunk: ChunkData): unknown {
  return {
    heightmap: Array.from(chunk.heightmap, value => Number(value.toFixed(6))),
    lakes: (chunk.lakes ?? [])
      .map(lake => {
        const tiles = Array.from(lake.tiles).sort((a, b) => a - b);
        return {
          waterLevel: Number(lake.waterLevel.toFixed(6)),
          state: lake.state,
          tiles,
          maxDepth: Number(lake.maxDepth.toFixed(6)),
        };
      })
      .sort((a, b) =>
        a.waterLevel - b.waterLevel ||
        a.maxDepth - b.maxDepth ||
        a.state.localeCompare(b.state) ||
        a.tiles.join(',').localeCompare(b.tiles.join(','))
      ),
    rivers: (chunk.rivers ?? [])
      .map(river => ({
        riverId: river.riverId,
        pathId: river.pathId,
        state: river.state,
        points: river.points.map(point => [
          Number(point.x.toFixed(4)),
          Number(point.y.toFixed(4)),
          Number(point.surfaceLevel.toFixed(6)),
        ]),
      }))
      .sort((a, b) =>
        a.riverId.localeCompare(b.riverId) ||
        a.pathId.localeCompare(b.pathId) ||
        a.state.localeCompare(b.state)
      ),
  };
}
