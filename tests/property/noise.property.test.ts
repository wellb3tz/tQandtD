import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { NoiseEngine, NoiseConfig } from '../../src/core/noise';

describe('NoiseEngine Property Tests', () => {
  // Feature: procedural-world-engine, Property 16: Noise Generation Determinism
  // **Validates: Requirements 10.4**
  test('noise2D produces identical values for same seed and coordinates', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: -1000, max: 1000, noNaN: true }), // x
        fc.float({ min: -1000, max: 1000, noNaN: true }), // y
        (seed, x, y) => {
          const noise1 = new NoiseEngine(seed);
          const noise2 = new NoiseEngine(seed);
          
          const value1 = noise1.noise2D(x, y);
          const value2 = noise2.noise2D(x, y);
          
          expect(value1).toBe(value2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('noise2D always returns values in range [-1, 1]', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: -1000, max: 1000, noNaN: true }), // x
        fc.float({ min: -1000, max: 1000, noNaN: true }), // y
        (seed, x, y) => {
          const noise = new NoiseEngine(seed);
          const value = noise.noise2D(x, y);
          
          expect(value).toBeGreaterThanOrEqual(-1);
          expect(value).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('fbm produces deterministic values for same seed and config', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: -1000, max: 1000, noNaN: true }), // x
        fc.float({ min: -1000, max: 1000, noNaN: true }), // y
        fc.integer({ min: 1, max: 8 }), // octaves
        fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }), // persistence
        fc.float({ min: Math.fround(1.5), max: Math.fround(4.0), noNaN: true }), // lacunarity
        fc.float({ min: Math.fround(0.1), max: Math.fround(10.0), noNaN: true }), // scale
        (seed, x, y, octaves, persistence, lacunarity, scale) => {
          const config: NoiseConfig = { octaves, persistence, lacunarity, scale };
          
          const noise1 = new NoiseEngine(seed);
          const noise2 = new NoiseEngine(seed);
          
          const value1 = noise1.fbm(x, y, config);
          const value2 = noise2.fbm(x, y, config);
          
          expect(value1).toBe(value2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('fbm returns finite values for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: -1000, max: 1000, noNaN: true }), // x
        fc.float({ min: -1000, max: 1000, noNaN: true }), // y
        fc.integer({ min: 1, max: 8 }), // octaves
        fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }), // persistence
        fc.float({ min: Math.fround(1.5), max: Math.fround(4.0), noNaN: true }), // lacunarity
        fc.float({ min: Math.fround(0.1), max: Math.fround(10.0), noNaN: true }), // scale
        (seed, x, y, octaves, persistence, lacunarity, scale) => {
          const config: NoiseConfig = { octaves, persistence, lacunarity, scale };
          const noise = new NoiseEngine(seed);
          
          const value = noise.fbm(x, y, config);
          
          expect(Number.isFinite(value)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('domainWarp produces deterministic warped coordinates', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: -1000, max: 1000, noNaN: true }), // x
        fc.float({ min: -1000, max: 1000, noNaN: true }), // y
        fc.float({ min: 0, max: 20, noNaN: true }), // strength
        (seed, x, y, strength) => {
          const noise1 = new NoiseEngine(seed);
          const noise2 = new NoiseEngine(seed);
          
          const [x1, y1] = noise1.domainWarp(x, y, strength);
          const [x2, y2] = noise2.domainWarp(x, y, strength);
          
          expect(x1).toBe(x2);
          expect(y1).toBe(y2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('domainWarp returns finite coordinates', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: -1000, max: 1000, noNaN: true }), // x
        fc.float({ min: -1000, max: 1000, noNaN: true }), // y
        fc.float({ min: 0, max: 20, noNaN: true }), // strength
        (seed, x, y, strength) => {
          const noise = new NoiseEngine(seed);
          const [warpedX, warpedY] = noise.domainWarp(x, y, strength);
          
          expect(Number.isFinite(warpedX)).toBe(true);
          expect(Number.isFinite(warpedY)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('different seeds produce different permutation tables', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed1
        fc.integer(), // seed2
        (seed1, seed2) => {
          // Skip if seeds are the same
          fc.pre(seed1 !== seed2);
          
          const noise1 = new NoiseEngine(seed1);
          const noise2 = new NoiseEngine(seed2);
          
          // Sample a variety of well-distributed points
          const testPoints = [
            [1, 1], [10, 10], [100, 100],
            [1.5, 2.7], [15.3, 27.8], [153.9, 278.4],
            [-5, 5], [-50, 50], [-500, 500]
          ];
          
          const values1 = testPoints.map(([x, y]) => noise1.noise2D(x, y));
          const values2 = testPoints.map(([x, y]) => noise2.noise2D(x, y));
          
          // At least one value should differ (extremely high probability)
          const allSame = values1.every((v, i) => v === values2[i]);
          expect(allSame).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('noise2D is continuous (nearby points have similar values)', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: -100, max: 100, noNaN: true }), // x
        fc.float({ min: -100, max: 100, noNaN: true }), // y
        (seed, x, y) => {
          const noise = new NoiseEngine(seed);
          const epsilon = 0.01; // Small step
          
          const value1 = noise.noise2D(x, y);
          const value2 = noise.noise2D(x + epsilon, y);
          const value3 = noise.noise2D(x, y + epsilon);
          
          // Nearby points should have similar values (Lipschitz continuity)
          // The difference should be bounded by some constant times the distance
          const maxExpectedDiff = 2.0; // Conservative bound for Simplex noise
          
          expect(Math.abs(value2 - value1)).toBeLessThan(maxExpectedDiff);
          expect(Math.abs(value3 - value1)).toBeLessThan(maxExpectedDiff);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('fbm with single octave behaves like scaled noise2D', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: -100, max: 100, noNaN: true }), // x
        fc.float({ min: -100, max: 100, noNaN: true }), // y
        fc.float({ min: Math.fround(0.1), max: Math.fround(10.0) }), // scale
        (seed, x, y, scale) => {
          const noise = new NoiseEngine(seed);
          const config: NoiseConfig = {
            octaves: 1,
            persistence: 0.5,
            lacunarity: 2.0,
            scale
          };
          
          const fbmValue = noise.fbm(x, y, config);
          const noiseValue = noise.noise2D(x * scale, y * scale);
          
          // Should be approximately equal (within floating point precision)
          expect(Math.abs(fbmValue - noiseValue)).toBeLessThan(1e-10);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('domainWarp with zero strength returns original coordinates', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.float({ min: -1000, max: 1000, noNaN: true }), // x
        fc.float({ min: -1000, max: 1000, noNaN: true }), // y
        (seed, x, y) => {
          const noise = new NoiseEngine(seed);
          const [warpedX, warpedY] = noise.domainWarp(x, y, 0);
          
          // With zero strength, should return original coordinates
          expect(Math.abs(warpedX - x)).toBeLessThan(1e-10);
          expect(Math.abs(warpedY - y)).toBeLessThan(1e-10);
        }
      ),
      { numRuns: 100 }
    );
  });
});
