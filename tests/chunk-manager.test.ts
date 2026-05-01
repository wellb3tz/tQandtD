/**
 * ChunkManager tests
 *
 * Covers caching behaviour, coordinate utilities, and biome/lake data integrity.
 * Keeps the surface small — one test per meaningful invariant.
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import { worldToChunk, chunkToWorld, worldToLocal, BiomeType } from '../src/world/chunk';
import { DEFAULT_LAKE_CONFIG } from '../src/gen/lakes';
import { LakeManager } from '../src/world/lake-manager';
import { makeMinimalConfig } from './helpers';

// ─── Coordinate utilities ─────────────────────────────────────────────────────

describe('Coordinate utilities', () => {
  it('worldToChunk rounds toward negative infinity', () => {
    expect(worldToChunk(0,   0,  32)).toEqual([0,  0]);
    expect(worldToChunk(31,  31, 32)).toEqual([0,  0]);
    expect(worldToChunk(32,  0,  32)).toEqual([1,  0]);
    expect(worldToChunk(-1,  0,  32)).toEqual([-1, 0]);
    expect(worldToChunk(-32, 0,  32)).toEqual([-1, 0]);
    expect(worldToChunk(-33, 0,  32)).toEqual([-2, 0]);
  });

  it('chunkToWorld returns top-left corner', () => {
    expect(chunkToWorld(0,  0,  32)).toEqual([0,   0]);
    expect(chunkToWorld(1,  0,  32)).toEqual([32,  0]);
    expect(chunkToWorld(-1, 0,  32)).toEqual([-32, 0]);
  });

  it('worldToLocal stays in [0, chunkSize)', () => {
    const [lx, ly] = worldToLocal(75, 40, 32);
    expect(lx).toBe(75 % 32);
    expect(ly).toBe(40 % 32);
  });

  it('worldToLocal handles negative world coordinates', () => {
    const [lx, ly] = worldToLocal(-1, -1, 32);
    expect(lx).toBe(31);
    expect(ly).toBe(31);
  });
});

// ─── ChunkManager cache ───────────────────────────────────────────────────────

describe('ChunkManager cache', () => {
  it('returns the same object on second call (cache hit)', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const first  = await manager.getChunk(0, 0);
    const second = await manager.getChunk(0, 0);
    expect(first).toBe(second);
  });

  it('concurrent requests for the same chunk resolve to the same object', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const [a, b, c] = await Promise.all([
      manager.getChunk(5, 5),
      manager.getChunk(5, 5),
      manager.getChunk(5, 5),
    ]);
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('clearCache removes all entries', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    await manager.getChunk(0, 0);
    expect(manager.getCacheSize()).toBe(1);
    manager.clearCache();
    expect(manager.getCacheSize()).toBe(0);
  });

  it('LRU eviction keeps cache within maxCacheSize', async () => {
    const config = makeMinimalConfig(1);
    config.maxCacheSize = 3;
    const manager = new ChunkManager(config);

    for (let i = 0; i < 5; i++) {
      await manager.getChunk(i, 0);
    }

    expect(manager.getCacheSize()).toBeLessThanOrEqual(3);
  });
});

// ─── ChunkData integrity ──────────────────────────────────────────────────────

describe('ChunkData integrity', () => {
  it('biomeMap has size² entries', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const chunk = await manager.getChunk(0, 0);
    expect(chunk.biomeMap.length).toBe(chunk.size * chunk.size);
  });

  it('all biome values are valid BiomeType enum members', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const chunk = await manager.getChunk(0, 0);
    const validValues = new Set(Object.values(BiomeType).filter(v => typeof v === 'number'));
    for (let i = 0; i < chunk.biomeMap.length; i++) {
      expect(validValues.has(chunk.biomeMap[i])).toBe(true);
    }
  });

  it('resource positions are within chunk bounds', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const chunk = await manager.getChunk(0, 0);
    for (const r of chunk.resources) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThan(chunk.size);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeLessThan(chunk.size);
    }
  });

  it('structure positions are within chunk bounds', async () => {
    const manager = new ChunkManager(makeMinimalConfig(1));
    const chunk = await manager.getChunk(0, 0);
    for (const s of chunk.structures) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(chunk.size);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(chunk.size);
    }
  });

  it('lake water levels are above sea level (0.3)', async () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = DEFAULT_LAKE_CONFIG;
    const manager = new ChunkManager(config);

    // Check several chunks to find at least one with a lake
    let foundLake = false;
    for (let cx = 0; cx < 10 && !foundLake; cx++) {
      for (let cy = 0; cy < 10 && !foundLake; cy++) {
        const chunk = await manager.getChunk(cx, cy);
        for (const lake of chunk.lakes ?? []) {
          expect(lake.waterLevel).toBeGreaterThan(0.3);
          expect(lake.maxDepth).toBeGreaterThan(0);
          expect(lake.tiles.size).toBeGreaterThanOrEqual(2);
          foundLake = true;
        }
      }
    }
  });

  it('lake tiles do not exceed chunk bounds', async () => {
    const config = makeMinimalConfig(42);
    config.lakeConfig = DEFAULT_LAKE_CONFIG;
    const manager = new ChunkManager(config);

    for (let cx = 0; cx < 5; cx++) {
      for (let cy = 0; cy < 5; cy++) {
        const chunk = await manager.getChunk(cx, cy);
        const maxTileIndex = chunk.size * chunk.size - 1;
        for (const lake of chunk.lakes ?? []) {
          for (const tileIdx of lake.tiles) {
            expect(tileIdx).toBeGreaterThanOrEqual(0);
            expect(tileIdx).toBeLessThanOrEqual(maxTileIndex);
          }
        }
      }
    }
  });
});

describe('Multi-chunk lake discovery', () => {
  it('includes lakes seeded in a neighbouring chunk before that chunk is requested', () => {
    const chunkSize = 16;
    const lakeManager = new LakeManager(
      123,
      {
        ...DEFAULT_LAKE_CONFIG,
        noiseThreshold: -1,
        minElevation: 0.3,
        maxElevation: 0.8,
        maxFillDepth: 0.08,
      },
      (worldX: number, worldY: number) => {
        const insideCrossBoundaryBasin =
          worldX >= 12 && worldX <= 21 &&
          worldY >= 4 && worldY <= 13;
        return insideCrossBoundaryBasin ? 0.35 : 0.5;
      },
      () => BiomeType.PLAINS,
    );

    const lakes = lakeManager.getLakesForChunk(0, 0, chunkSize);
    const crossingLake = lakes.find(lake =>
      lake.tiles.has('15,8') && lake.tiles.has('16,8')
    );

    expect(crossingLake).toBeDefined();
  });
});
