/**
 * Serialization round-trip tests
 *
 * Verifies that save → load produces data identical to the original.
 * Covers JSON and binary formats, compression on/off, and lake persistence
 * (the bug we just fixed — Set<number> was silently lost before).
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import { WorldSerializer, SerializationFormat, type SerializedRiverPoint } from '../src/world/serialization';
import { DEFAULT_LAKE_CONFIG } from '../src/gen/lakes';
import { DEFAULT_RIVER_CONFIG } from '../src/gen/rivers';
import { makeMinimalConfig } from './helpers';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Generate a manager with a few chunks pre-loaded. */
async function buildManager(seed: number) {
  const config = makeMinimalConfig(seed);
  config.lakeConfig = DEFAULT_LAKE_CONFIG;
  config.riverConfig = DEFAULT_RIVER_CONFIG;
  config.maxCacheSize = 100; // Increase cache size to prevent eviction
  const manager = new ChunkManager(config);
  await Promise.all([
    manager.getChunk(0, 0),
    manager.getChunk(1, 0),
    manager.getChunk(0, 1),
  ]);
  const chunk = await manager.getChunk(0, 0);
  chunk.rivers = [{
    riverId: 'river_test',
    pathId: 'river_test:main',
    isTributary: false,
    points: [
      { x: 1, y: 1, height: 0.6, surfaceLevel: 0.61, width: 1.5, depth: 0.03, flow: 0.25, channelWidth: 1.2, valleyWidth: 3.8, channelDepth: 0.04, valleyDepth: 0.02, flowX: 1, flowY: 0 },
      { x: 4, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1.5, depth: 0.03, flow: 0.75, channelWidth: 1.9, valleyWidth: 4.6, channelDepth: 0.07, valleyDepth: 0.04, flowX: 1, flowY: 0 },
    ],
    bounds: { minX: 1, maxX: 4, minY: 1, maxY: 1 },
  }];
  return manager;
}

/** Restore a serialized world into a fresh manager and return it. */
function restore(serialized: ReturnType<WorldSerializer['serialize']>, seed: number) {
  const config = makeMinimalConfig(seed);
  config.lakeConfig = DEFAULT_LAKE_CONFIG;
  config.riverConfig = DEFAULT_RIVER_CONFIG;
  const fresh = new ChunkManager(config);
  const ser = new WorldSerializer();
  ser.deserialize(serialized, fresh);
  return fresh;
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('Serialization round-trip', () => {
  it('types serialized river points with optional corridor fields', () => {
    expectTypeOf<SerializedRiverPoint>().toMatchTypeOf<{
      flow?: number;
      channelWidth?: number;
      valleyWidth?: number;
      channelDepth?: number;
      valleyDepth?: number;
    }>();
  });

  for (const [label, format, compress] of [
    ['JSON uncompressed',   SerializationFormat.JSON,   false],
    ['JSON compressed',     SerializationFormat.JSON,   true],
    ['Binary uncompressed', SerializationFormat.BINARY, false],
    ['Binary compressed',   SerializationFormat.BINARY, true],
  ] as const) {
    describe(label, () => {
      it('restores heightmap identically', async () => {
        const manager = await buildManager(42);
        const ser = new WorldSerializer();
        const saved = ser.serialize(manager, { format, compress, modifiedOnly: false });
        const loaded = restore(saved, 42);

        const orig  = await manager.getChunk(0, 0);
        const fresh = await loaded.getChunk(0, 0);

        expect(Array.from(fresh.heightmap)).toEqual(Array.from(orig.heightmap));
      });

      it('restores biomeMap identically', async () => {
        const manager = await buildManager(42);
        const ser = new WorldSerializer();
        const saved = ser.serialize(manager, { format, compress, modifiedOnly: false });
        const loaded = restore(saved, 42);

        const orig  = await manager.getChunk(1, 0);
        const fresh = await loaded.getChunk(1, 0);

        expect(Array.from(fresh.biomeMap)).toEqual(Array.from(orig.biomeMap));
      });

      it('restores resources and structures identically', async () => {
        const manager = await buildManager(42);
        const ser = new WorldSerializer();
        const saved = ser.serialize(manager, { format, compress, modifiedOnly: false });
        const loaded = restore(saved, 42);

        const orig  = await manager.getChunk(0, 1);
        const fresh = await loaded.getChunk(0, 1);

        expect(fresh.resources).toEqual(orig.resources);
        expect(fresh.structures).toEqual(orig.structures);
      });

      it('restores lakes with correct tile sets', async () => {
        const manager = await buildManager(42);
        const ser = new WorldSerializer();
        const saved = ser.serialize(manager, { format, compress, modifiedOnly: false });
        const loaded = restore(saved, 42);

        const orig  = await manager.getChunk(0, 0);
        const fresh = await loaded.getChunk(0, 0);

        const origLakes  = (orig.lakes  ?? []).map(l => ({ waterLevel: l.waterLevel, tiles: Array.from(l.tiles).sort((a,b)=>a-b), maxDepth: l.maxDepth }));
        const freshLakes = (fresh.lakes ?? []).map(l => ({ waterLevel: l.waterLevel, tiles: Array.from(l.tiles).sort((a,b)=>a-b), maxDepth: l.maxDepth }));

        expect(freshLakes).toEqual(origLakes);
      });

      it('restores rivers with path points', async () => {
        const manager = await buildManager(42);
        const ser = new WorldSerializer();
        const saved = ser.serialize(manager, { format, compress, modifiedOnly: false });
        const loaded = restore(saved, 42);

        const orig = await manager.getChunk(0, 0);
        const fresh = await loaded.getChunk(0, 0);

        const normalize = (chunk: typeof orig) =>
          (chunk.rivers ?? []).map(r => ({
            riverId: r.riverId,
            pathId: r.pathId,
            isTributary: r.isTributary,
            points: r.points.map(p => [p.x, p.y, Number(p.surfaceLevel.toFixed(4))]),
          }));

        expect(normalize(fresh)).toEqual(normalize(orig));
      });

      it('restores river corridor fields on path points', async () => {
        const manager = await buildManager(42);
        const ser = new WorldSerializer();
        const saved = ser.serialize(manager, { format, compress, modifiedOnly: false });
        const loaded = restore(saved, 42);

        const orig = await manager.getChunk(0, 0);
        const fresh = await loaded.getChunk(0, 0);

        const normalize = (chunk: typeof orig) =>
          (chunk.rivers ?? []).flatMap(river =>
            river.points.map(point => ({
              flow: point.flow,
              channelWidth: point.channelWidth,
              valleyWidth: point.valleyWidth,
              channelDepth: point.channelDepth,
              valleyDepth: point.valleyDepth,
            }))
          );

        expect(normalize(fresh)).toEqual(normalize(orig));
      });

      it('checksum validates correctly', async () => {
        const manager = await buildManager(7);
        const ser = new WorldSerializer();
        const saved = ser.serialize(manager, { format, compress, modifiedOnly: false });

        // Should not throw
        expect(() => ser.deserialize(saved, new ChunkManager(makeMinimalConfig(7)))).not.toThrow();
      });

      it('throws on corrupted checksum', async () => {
        const manager = await buildManager(7);
        const ser = new WorldSerializer();
        const saved = ser.serialize(manager, { format, compress, modifiedOnly: false });

        const corrupted = { ...saved, checksum: 'deadbeef' };
        expect(() => ser.deserialize(corrupted, new ChunkManager(makeMinimalConfig(7)))).toThrow(/checksum/i);
      });
    });
  }

  it('modifiedOnly exports only chunks with recorded modifications', async () => {
    const manager = await buildManager(10);

    // Record a modification on chunk (0,0) only
    manager.recordTerrainEdit(0, 0, 0, 0.99);

    const ser = new WorldSerializer();
    const saved = ser.serialize(manager, {
      format: SerializationFormat.JSON,
      compress: false,
      modifiedOnly: true,
    });

    expect(saved.chunks).toHaveLength(1);
    expect(saved.chunks[0].x).toBe(0);
    expect(saved.chunks[0].y).toBe(0);
  });

  it('region filter exports only chunks within bounds', async () => {
    const config = makeMinimalConfig(10);
    config.lakeConfig = DEFAULT_LAKE_CONFIG;
    config.maxCacheSize = 100;
    const manager = new ChunkManager(config);
    
    // Load chunks in sequence to avoid race conditions with cache invalidation
    await manager.getChunk(0, 0);
    await manager.getChunk(0, 1);
    await manager.getChunk(1, 0); // Load this last so it stays in cache
    
    const ser = new WorldSerializer();
    const saved = ser.serialize(manager, {
      format: SerializationFormat.JSON,
      compress: false,
      modifiedOnly: false,
      region: { minX: 1, minY: 0, maxX: 1, maxY: 0 },
    });

    expect(saved.chunks).toHaveLength(1);
    expect(saved.chunks[0].x).toBe(1);
    expect(saved.chunks[0].y).toBe(0);
  });
});

describe('Serialization — sparse biome weights round-trip', () => {
  for (const [label, format, compress] of [
    ['JSON uncompressed',   SerializationFormat.JSON,   false],
    ['JSON compressed',     SerializationFormat.JSON,   true],
    ['Binary uncompressed', SerializationFormat.BINARY, false],
    ['Binary compressed',   SerializationFormat.BINARY, true],
  ] as const) {
    it(`preserves sparseBiomeTypes/Weights/Offsets — ${label}`, async () => {
      const manager = await buildManager(99);
      const ser = new WorldSerializer();
      const saved = ser.serialize(manager, { format, compress, modifiedOnly: false });
      const loaded = restore(saved, 99);

      const orig  = await manager.getChunk(0, 0);
      const fresh = await loaded.getChunk(0, 0);

      // All three sparse arrays must survive the round-trip exactly.
      expect(Array.from(fresh.sparseBiomeTypes)).toEqual(Array.from(orig.sparseBiomeTypes));
      expect(Array.from(fresh.sparseBiomeWeights)).toEqual(Array.from(orig.sparseBiomeWeights));
      expect(Array.from(fresh.sparseBiomeOffsets)).toEqual(Array.from(orig.sparseBiomeOffsets));
    });
  }

  it('legacy save (no sparse fields) falls back to 100% weight per tile', async () => {
    // Simulate a save that pre-dates the sparse-weight serialization fix.
    const manager = await buildManager(55);
    const ser = new WorldSerializer();
    const saved = ser.serialize(manager, {
      format: SerializationFormat.JSON,
      compress: false,
      modifiedOnly: false,
    });

    // Strip the sparse fields from every chunk to mimic a legacy save.
    const legacy = {
      ...saved,
      chunks: saved.chunks.map(({ sparseBiomeTypes: _t, sparseBiomeWeights: _w, sparseBiomeOffsets: _o, ...rest }) => rest),
    };
    // Recalculate checksum so deserialize doesn't reject it.
    // We bypass checksum validation by patching the private method via a cast.
    (legacy as any).checksum = (ser as any).calculateChecksum(legacy);

    const fresh = new ChunkManager(makeMinimalConfig(55));
    expect(() => ser.deserialize(legacy as any, fresh)).not.toThrow();

    const chunk = await fresh.getChunk(0, 0);
    // Each tile should have exactly one entry with weight 1.0.
    const tileCount = chunk.size * chunk.size;
    expect(chunk.sparseBiomeOffsets.length).toBe(tileCount);
    expect(chunk.sparseBiomeWeights.length).toBe(tileCount);
    for (let i = 0; i < tileCount; i++) {
      expect(chunk.sparseBiomeWeights[i]).toBeCloseTo(1.0, 5);
    }
  });
});
