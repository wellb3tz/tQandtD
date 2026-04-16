import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { TerrainGenerator, TerrainConfig } from '../../src/gen/terrain';

describe('TerrainGenerator Property Tests', () => {
  // Generator for valid TerrainConfig
  const terrainConfigArb = fc.record({
    baseScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
    octaves: fc.integer({ min: 1, max: 8 }),
    persistence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }),
    lacunarity: fc.float({ min: Math.fround(1.5), max: Math.fround(4.0), noNaN: true }),
    warpStrength: fc.float({ min: 0, max: 20, noNaN: true }),
    heightMultiplier: fc.float({ min: Math.fround(0.5), max: Math.fround(2.0), noNaN: true }),
  });

  // Feature: procedural-world-engine, Property 6: Heightmap Size Correctness
  // **Validates: Requirements 3.3**
  test('generateHeightmap produces array with exactly (chunkSize+1)² elements', () => {
    fc.assert(
      fc.property(
        terrainConfigArb,
        fc.integer(), // chunkSeed
        fc.integer({ min: 4, max: 128 }), // chunkSize
        (config, chunkSeed, chunkSize) => {
          const generator = new TerrainGenerator(config);
          const heightmap = generator.generateHeightmap(chunkSeed, chunkSize);
          
          expect(heightmap).toBeInstanceOf(Float32Array);
          // After seamless chunk boundaries fix: heightmap has (chunkSize + 1) x (chunkSize + 1) vertices
          expect(heightmap.length).toBe((chunkSize + 1) * (chunkSize + 1));
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: procedural-world-engine, Property 7: Terrain Generation Determinism
  // **Validates: Requirements 3.4**
  test('generateHeightmap produces identical heightmaps for same seed and config', () => {
    fc.assert(
      fc.property(
        terrainConfigArb,
        fc.integer(), // chunkSeed
        fc.integer({ min: 4, max: 64 }), // chunkSize
        (config, chunkSeed, chunkSize) => {
          const generator = new TerrainGenerator(config);
          
          const heightmap1 = generator.generateHeightmap(chunkSeed, chunkSize);
          const heightmap2 = generator.generateHeightmap(chunkSeed, chunkSize);
          
          expect(heightmap1.length).toBe(heightmap2.length);
          
          // All values should be identical
          for (let i = 0; i < heightmap1.length; i++) {
            expect(heightmap1[i]).toBe(heightmap2[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getHeight produces identical values for same position and seed', () => {
    fc.assert(
      fc.property(
        terrainConfigArb,
        fc.integer(), // seed
        fc.float({ min: -1000, max: 1000, noNaN: true }), // x
        fc.float({ min: -1000, max: 1000, noNaN: true }), // y
        (config, seed, x, y) => {
          const generator = new TerrainGenerator(config);
          
          const height1 = generator.getHeight(x, y, seed);
          const height2 = generator.getHeight(x, y, seed);
          
          expect(height1).toBe(height2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('all height values are in [0, 1] range', () => {
    fc.assert(
      fc.property(
        terrainConfigArb,
        fc.integer(), // chunkSeed
        fc.integer({ min: 4, max: 64 }), // chunkSize
        (config, chunkSeed, chunkSize) => {
          const generator = new TerrainGenerator(config);
          const heightmap = generator.generateHeightmap(chunkSeed, chunkSize);
          
          for (let i = 0; i < heightmap.length; i++) {
            expect(heightmap[i]).toBeGreaterThanOrEqual(0);
            expect(heightmap[i]).toBeLessThanOrEqual(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getHeight returns values in [0, 1] range', () => {
    fc.assert(
      fc.property(
        terrainConfigArb,
        fc.integer(), // seed
        fc.float({ min: -1000, max: 1000, noNaN: true }), // x
        fc.float({ min: -1000, max: 1000, noNaN: true }), // y
        (config, seed, x, y) => {
          const generator = new TerrainGenerator(config);
          const height = generator.getHeight(x, y, seed);
          
          expect(height).toBeGreaterThanOrEqual(0);
          expect(height).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('different seeds produce different heightmaps', () => {
    fc.assert(
      fc.property(
        terrainConfigArb,
        fc.integer(), // seed1
        fc.integer(), // seed2
        fc.integer({ min: 16, max: 32 }), // chunkSize (larger to avoid degenerate cases)
        (config, seed1, seed2, chunkSize) => {
          // Skip if seeds are the same
          fc.pre(seed1 !== seed2);
          
          // Skip degenerate cases where terrain would be too uniform
          // (very small scale with no warping can produce nearly identical terrain)
          fc.pre(config.baseScale > 0.01 || config.warpStrength > 10);
          
          // Skip if seeds are too close (can produce similar patterns)
          fc.pre(Math.abs(seed1 - seed2) > 100);
          
          const generator = new TerrainGenerator(config);
          
          const heightmap1 = generator.generateHeightmap(seed1, chunkSize);
          const heightmap2 = generator.generateHeightmap(seed2, chunkSize);
          
          // At least some values should be different
          let differenceCount = 0;
          for (let i = 0; i < heightmap1.length; i++) {
            if (heightmap1[i] !== heightmap2[i]) {
              differenceCount++;
            }
          }
          
          // With different seeds, we expect at least some differences
          expect(differenceCount).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('heightmap values are finite', () => {
    fc.assert(
      fc.property(
        terrainConfigArb,
        fc.integer(), // chunkSeed
        fc.integer({ min: 4, max: 64 }), // chunkSize
        (config, chunkSeed, chunkSize) => {
          const generator = new TerrainGenerator(config);
          const heightmap = generator.generateHeightmap(chunkSeed, chunkSize);
          
          for (let i = 0; i < heightmap.length; i++) {
            expect(Number.isFinite(heightmap[i])).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getHeight returns finite values', () => {
    fc.assert(
      fc.property(
        terrainConfigArb,
        fc.integer(), // seed
        fc.float({ min: -1000, max: 1000, noNaN: true }), // x
        fc.float({ min: -1000, max: 1000, noNaN: true }), // y
        (config, seed, x, y) => {
          const generator = new TerrainGenerator(config);
          const height = generator.getHeight(x, y, seed);
          
          expect(Number.isFinite(height)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('heightMultiplier affects terrain height', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.integer({ min: 8, max: 32 }), // chunkSize
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }), // baseScale
        fc.integer({ min: 1, max: 8 }), // octaves
        fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }), // persistence
        fc.float({ min: Math.fround(1.5), max: Math.fround(4.0), noNaN: true }), // lacunarity
        fc.float({ min: 0, max: 20, noNaN: true }), // warpStrength
        (seed, chunkSize, baseScale, octaves, persistence, lacunarity, warpStrength) => {
          const config1: TerrainConfig = {
            baseScale,
            octaves,
            persistence,
            lacunarity,
            warpStrength,
            heightMultiplier: 0.5,
          };
          
          const config2: TerrainConfig = {
            baseScale,
            octaves,
            persistence,
            lacunarity,
            warpStrength,
            heightMultiplier: 1.5,
          };
          
          const generator1 = new TerrainGenerator(config1);
          const generator2 = new TerrainGenerator(config2);
          
          const heightmap1 = generator1.generateHeightmap(seed, chunkSize);
          const heightmap2 = generator2.generateHeightmap(seed, chunkSize);
          
          // Calculate average heights
          const avg1 = heightmap1.reduce((sum, h) => sum + h, 0) / heightmap1.length;
          const avg2 = heightmap2.reduce((sum, h) => sum + h, 0) / heightmap2.length;
          
          // Higher multiplier should generally produce higher average height
          // (unless clamping to [0,1] affects it significantly)
          expect(avg2).toBeGreaterThanOrEqual(avg1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('different configs produce different terrain patterns', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.integer({ min: 8, max: 32 }), // chunkSize
        terrainConfigArb, // config1
        terrainConfigArb, // config2
        (seed, chunkSize, config1, config2) => {
          // Skip if configs are too similar
          fc.pre(
            config1.octaves !== config2.octaves ||
            Math.abs(config1.baseScale - config2.baseScale) > 0.01 ||
            Math.abs(config1.warpStrength - config2.warpStrength) > 1
          );
          
          const generator1 = new TerrainGenerator(config1);
          const generator2 = new TerrainGenerator(config2);
          
          const heightmap1 = generator1.generateHeightmap(seed, chunkSize);
          const heightmap2 = generator2.generateHeightmap(seed, chunkSize);
          
          // Different configs should produce different terrain
          let differenceCount = 0;
          for (let i = 0; i < heightmap1.length; i++) {
            if (Math.abs(heightmap1[i] - heightmap2[i]) > 0.001) {
              differenceCount++;
            }
          }
          
          // Expect at least some differences
          expect(differenceCount).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

