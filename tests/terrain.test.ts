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

    it('keeps mountain relief bounded while allowing geometric cliff walls', () => {
      const config = createDefaultWorldConfig({
        seed: 12345,
        chunkSize: 32,
      });
      const gen = new TerrainGenerator(config.terrainConfig);
      const chunkSize = config.chunkSize;
      const heightmap = gen.generateHeightmap(config.seed, chunkSize, 0, 0);
      const { maxDelta, steepEdgeCount } = getAdjacentHeightDeltaStats(heightmap, chunkSize);

      expect(maxDelta).toBeLessThanOrEqual(0.36);
      expect(steepEdgeCount).toBeGreaterThanOrEqual(0);
    });

    it('keeps continental ocean shelves sloped instead of clamped near sea level', () => {
      const seaLevel = 0.3;
      const config = createDefaultWorldConfig({
        seed: 12345,
        chunkSize: 32,
      });
      const gen = new TerrainGenerator(config.terrainConfig);
      const nearShoreOceanHeights: number[] = [];

      for (let chunkY = -3; chunkY <= 3; chunkY++) {
        for (let chunkX = -3; chunkX <= 3; chunkX++) {
          const heightmap = gen.generateHeightmap(config.seed, config.chunkSize, chunkX, chunkY);
          for (const height of heightmap) {
            if (height >= seaLevel - 0.04 && height < seaLevel) {
              nearShoreOceanHeights.push(height);
            }
          }
        }
      }

      expect(nearShoreOceanHeights.length).toBeGreaterThan(20);

      const clampedShelfHeight = seaLevel - 0.001;
      const nearlyFlatShelfVertices = nearShoreOceanHeights.filter(
        height => Math.abs(height - clampedShelfHeight) < 0.00001,
      );
      const distinctHeightBuckets = new Set(
        nearShoreOceanHeights.map(height => Math.round(height * 10000)),
      );

      expect(nearlyFlatShelfVertices.length / nearShoreOceanHeights.length).toBeLessThan(0.2);
      expect(distinctHeightBuckets.size).toBeGreaterThan(12);
    });

    it('adds deterministic cliff shaping as a mountain overlay', () => {
      const baseConfig = createDefaultWorldConfig({
        seed: 24680,
        chunkSize: 32,
        terrainConfig: {
          cliffStrength: 0,
        },
      });
      const cliffConfig = createDefaultWorldConfig({
        seed: 24680,
        chunkSize: 32,
        terrainConfig: {
          cliffStrength: 1,
        },
      });
      const cliffGen = new TerrainGenerator(cliffConfig.terrainConfig);
      const baseGen = new TerrainGenerator(baseConfig.terrainConfig);

      let changedHighlandVertices = 0;
      let strongestMaxDelta = 0;
      let strongestSteepEdges = 0;

      for (let chunkY = -3; chunkY <= 3; chunkY++) {
        for (let chunkX = -3; chunkX <= 3; chunkX++) {
          const base = baseGen.generateHeightmap(baseConfig.seed, baseConfig.chunkSize, chunkX, chunkY);
          const cliffs = cliffGen.generateHeightmap(cliffConfig.seed, cliffConfig.chunkSize, chunkX, chunkY);

          for (let i = 0; i < cliffs.length; i++) {
            expect(cliffs[i]).toBeGreaterThanOrEqual(0);
            expect(cliffs[i]).toBeLessThanOrEqual(1);
            if (base[i] > 0.54 && Math.abs(base[i] - cliffs[i]) > 0.002) {
              changedHighlandVertices++;
            }
          }

          const stats = getAdjacentHeightDeltaStats(cliffs, cliffConfig.chunkSize);
          strongestMaxDelta = Math.max(strongestMaxDelta, stats.maxDelta);
          strongestSteepEdges = Math.max(strongestSteepEdges, stats.steepEdgeCount);
        }
      }

      expect(changedHighlandVertices).toBeGreaterThan(10);
      expect(strongestMaxDelta).toBeGreaterThan(0.10);
      expect(strongestMaxDelta).toBeLessThanOrEqual(0.30);
      expect(strongestSteepEdges).toBeGreaterThan(0);
    });
  });
});

function getMaxAdjacentHeightDelta(heightmap: Float32Array, chunkSize: number): number {
  return getAdjacentHeightDeltaStats(heightmap, chunkSize).maxDelta;
}

function getAdjacentHeightDeltaStats(heightmap: Float32Array, chunkSize: number): {
  maxDelta: number;
  steepEdgeCount: number;
} {
  const vSize = chunkSize + 1;
  let maxDelta = 0;
  let steepEdgeCount = 0;

  for (let y = 0; y <= chunkSize; y++) {
    for (let x = 0; x <= chunkSize; x++) {
      const height = heightmap[y * vSize + x];

      if (x < chunkSize) {
        const delta = Math.abs(height - heightmap[y * vSize + x + 1]);
        maxDelta = Math.max(maxDelta, delta);
        if (delta > 0.08) steepEdgeCount++;
      }

      if (y < chunkSize) {
        const delta = Math.abs(height - heightmap[(y + 1) * vSize + x]);
        maxDelta = Math.max(maxDelta, delta);
        if (delta > 0.08) steepEdgeCount++;
      }
    }
  }

  return { maxDelta, steepEdgeCount };
}
