/**
 * Determinism tests
 *
 * Core guarantee: same seed → same world, always.
 * These tests catch any accidental introduction of non-deterministic state
 * (Date.now(), Math.random(), uninitialized memory, etc.).
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import { DEFAULT_LAKE_CONFIG } from '../src/gen/lakes';
import { DEFAULT_RIVER_CONFIG } from '../src/gen/rivers';
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
});
