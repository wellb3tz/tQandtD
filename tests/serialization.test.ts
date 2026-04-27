/**
 * Serialization round-trip tests
 *
 * Verifies that save → load produces data identical to the original.
 * Covers JSON and binary formats, compression on/off, and lake persistence
 * (the bug we just fixed — Set<number> was silently lost before).
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import { WorldSerializer, SerializationFormat } from '../src/world/serialization';
import { DEFAULT_LAKE_CONFIG } from '../src/gen/lakes';
import { makeMinimalConfig } from './helpers';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Generate a manager with a few chunks pre-loaded. */
async function buildManager(seed: number) {
  const config = makeMinimalConfig(seed);
  config.lakeConfig = DEFAULT_LAKE_CONFIG;
  config.maxCacheSize = 100; // Increase cache size to prevent eviction
  const manager = new ChunkManager(config);
  await Promise.all([
    manager.getChunk(0, 0),
    manager.getChunk(1, 0),
    manager.getChunk(0, 1),
  ]);
  return manager;
}

/** Restore a serialized world into a fresh manager and return it. */
function restore(serialized: ReturnType<WorldSerializer['serialize']>, seed: number) {
  const config = makeMinimalConfig(seed);
  config.lakeConfig = DEFAULT_LAKE_CONFIG;
  const fresh = new ChunkManager(config);
  const ser = new WorldSerializer();
  ser.deserialize(serialized, fresh);
  return fresh;
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('Serialization round-trip', () => {
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
