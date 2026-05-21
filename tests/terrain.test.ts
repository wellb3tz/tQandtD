/**
 * Terrain generation tests
 *
 * Validates heightmap correctness, value ranges, and the seamless boundary
 * property - the most important structural guarantee of the chunk system.
 */

import { describe, it, expect } from 'vitest';
import { ChunkManager } from '../src/world/chunk-manager';
import { TerrainGenerator } from '../src/gen/terrain';
import { createDefaultWorldConfig } from '../src/config/default-world-config';
import { makeMinimalConfig } from './helpers';

describe('Terrain', () => {
  describe('heightmap shape', () => {
    it('has (size+1)^2 vertices for seamless boundaries', async () => {
      const manager = new ChunkManager(makeMinimalConfig(1));
      const chunk = await manager.getChunk(0, 0);
      const expected = (chunk.size + 1) * (chunk.size + 1);
      expect(chunk.heightmap.length).toBe(expected);
    });

    it('all height values are in [0, 1]', async () => {
      const manager = new ChunkManager(makeMinimalConfig(1));
      const chunk = await manager.getChunk(0, 0);
      for (let i = 0; i < chunk.heightmap.length; i++) {
        expect(chunk.heightmap[i]).toBeGreaterThanOrEqual(0);
        expect(chunk.heightmap[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('seamless boundaries', () => {
    it('right edge of chunk (0,0) matches left edge of chunk (1,0)', async () => {
      const manager = new ChunkManager(makeMinimalConfig(42));
      const [left, right] = await Promise.all([
        manager.getChunk(0, 0),
        manager.getChunk(1, 0),
      ]);

      const size = left.size;
      const vSize = size + 1;

      for (let y = 0; y <= size; y++) {
        const leftEdge  = left.heightmap[y * vSize + size];   // rightmost column of left chunk
        const rightEdge = right.heightmap[y * vSize + 0];     // leftmost column of right chunk
        expect(leftEdge).toBeCloseTo(rightEdge, 5);
      }
    });

    it('bottom edge of chunk (0,0) matches top edge of chunk (0,1)', async () => {
      const manager = new ChunkManager(makeMinimalConfig(42));
      const [top, bottom] = await Promise.all([
        manager.getChunk(0, 0),
        manager.getChunk(0, 1),
      ]);

      const size = top.size;
      const vSize = size + 1;

      for (let x = 0; x <= size; x++) {
        const topEdge    = top.heightmap[size * vSize + x];   // bottom row of top chunk
        const bottomEdge = bottom.heightmap[0 * vSize + x];   // top row of bottom chunk
        expect(topEdge).toBeCloseTo(bottomEdge, 5);
      }
    });

    it('corner vertex is shared by all four adjacent chunks', async () => {
      const manager = new ChunkManager(makeMinimalConfig(7));
      const [c00, c10, c01, c11] = await Promise.all([
        manager.getChunk(0, 0),
        manager.getChunk(1, 0),
        manager.getChunk(0, 1),
        manager.getChunk(1, 1),
      ]);

      const size = c00.size;
      const vSize = size + 1;

      const h00 = c00.heightmap[size * vSize + size];  // bottom-right of (0,0)
      const h10 = c10.heightmap[size * vSize + 0];     // bottom-left  of (1,0)
      const h01 = c01.heightmap[0 * vSize + size];     // top-right    of (0,1)
      const h11 = c11.heightmap[0 * vSize + 0];        // top-left     of (1,1)

      expect(h00).toBeCloseTo(h10, 5);
      expect(h00).toBeCloseTo(h01, 5);
      expect(h00).toBeCloseTo(h11, 5);
    });
  });

  describe('TerrainGenerator standalone', () => {
    it('getHeightAt returns same value as heightmap at matching world coordinate', () => {
      const config = makeMinimalConfig(5).terrainConfig;
      const gen = new TerrainGenerator(config);
      const seed = 5;
      const chunkSize = 16;

      const heightmap = gen.generateHeightmap(seed, chunkSize, 2, 3);
      const vSize = chunkSize + 1;

      // Sample a few interior vertices
      for (const [lx, ly] of [[0, 0], [8, 4], [16, 16]]) {
        const worldX = 2 * chunkSize + lx;
        const worldY = 3 * chunkSize + ly;
        const fromMap = heightmap[ly * vSize + lx];
        const fromGet = gen.getHeightAt(worldX, worldY, seed);
        expect(fromMap).toBeCloseTo(fromGet, 5);
      }
    });

    it('avoids needle-like mountain height jumps between adjacent vertices', () => {
      const config = createDefaultWorldConfig({
        seed: 12345,
        chunkSize: 32,
      });
      const gen = new TerrainGenerator(config.terrainConfig);
      const chunkSize = config.chunkSize;
      const heightmap = gen.generateHeightmap(config.seed, chunkSize, 0, 0);

      expect(getMaxAdjacentHeightDelta(heightmap, chunkSize)).toBeLessThanOrEqual(0.18);
    });
  });
});

function getMaxAdjacentHeightDelta(heightmap: Float32Array, chunkSize: number): number {
  const vSize = chunkSize + 1;
  let maxDelta = 0;

  for (let y = 0; y <= chunkSize; y++) {
    for (let x = 0; x <= chunkSize; x++) {
      const height = heightmap[y * vSize + x];

      if (x < chunkSize) {
        maxDelta = Math.max(maxDelta, Math.abs(height - heightmap[y * vSize + x + 1]));
      }

      if (y < chunkSize) {
        maxDelta = Math.max(maxDelta, Math.abs(height - heightmap[(y + 1) * vSize + x]));
      }
    }
  }

  return maxDelta;
}
