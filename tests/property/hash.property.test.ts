import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { hash, chunkSeed } from '../../src/core/hash';

describe('Hash Property Tests', () => {
  // Feature: procedural-world-engine, Property 3: Chunk Seed Uniqueness
  // **Validates: Requirements 2.2**
  test('different chunk coordinates produce different chunk seeds', () => {
    fc.assert(
      fc.property(
        fc.integer(), // worldSeed
        fc.integer({ min: -1000, max: 1000 }), // chunkX1
        fc.integer({ min: -1000, max: 1000 }), // chunkY1
        fc.integer({ min: -1000, max: 1000 }), // chunkX2
        fc.integer({ min: -1000, max: 1000 }), // chunkY2
        (worldSeed, chunkX1, chunkY1, chunkX2, chunkY2) => {
          // Skip if coordinates are the same
          fc.pre(chunkX1 !== chunkX2 || chunkY1 !== chunkY2);
          
          const seed1 = chunkSeed(worldSeed, chunkX1, chunkY1);
          const seed2 = chunkSeed(worldSeed, chunkX2, chunkY2);
          
          // Different coordinates should produce different seeds
          expect(seed1).not.toBe(seed2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hash produces different values for different inputs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 1, maxLength: 10 }), // values1
        fc.array(fc.integer(), { minLength: 1, maxLength: 10 }), // values2
        (values1, values2) => {
          // Skip if arrays are identical
          fc.pre(JSON.stringify(values1) !== JSON.stringify(values2));
          
          const hash1 = hash(...values1);
          const hash2 = hash(...values2);
          
          // Different inputs should produce different hashes
          // (with extremely high probability)
          expect(hash1).not.toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hash is deterministic for same inputs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 10 }), // values
        (values) => {
          const hash1 = hash(...values);
          const hash2 = hash(...values);
          
          expect(hash1).toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('chunkSeed is deterministic for same coordinates', () => {
    fc.assert(
      fc.property(
        fc.integer(), // worldSeed
        fc.integer({ min: -10000, max: 10000 }), // chunkX
        fc.integer({ min: -10000, max: 10000 }), // chunkY
        (worldSeed, chunkX, chunkY) => {
          const seed1 = chunkSeed(worldSeed, chunkX, chunkY);
          const seed2 = chunkSeed(worldSeed, chunkX, chunkY);
          
          expect(seed1).toBe(seed2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('different world seeds produce different chunk seeds for same coordinates', () => {
    fc.assert(
      fc.property(
        fc.integer(), // worldSeed1
        fc.integer(), // worldSeed2
        fc.integer({ min: -1000, max: 1000 }), // chunkX
        fc.integer({ min: -1000, max: 1000 }), // chunkY
        (worldSeed1, worldSeed2, chunkX, chunkY) => {
          // Skip if world seeds are the same
          fc.pre(worldSeed1 !== worldSeed2);
          
          const seed1 = chunkSeed(worldSeed1, chunkX, chunkY);
          const seed2 = chunkSeed(worldSeed2, chunkX, chunkY);
          
          // Different world seeds should produce different chunk seeds
          expect(seed1).not.toBe(seed2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('swapping chunk coordinates produces different seeds', () => {
    fc.assert(
      fc.property(
        fc.integer(), // worldSeed
        fc.integer({ min: -1000, max: 1000 }), // chunkX
        fc.integer({ min: -1000, max: 1000 }), // chunkY
        (worldSeed, chunkX, chunkY) => {
          // Skip if coordinates are the same (swapping would have no effect)
          fc.pre(chunkX !== chunkY);
          
          const seed1 = chunkSeed(worldSeed, chunkX, chunkY);
          const seed2 = chunkSeed(worldSeed, chunkY, chunkX);
          
          // Swapping coordinates should produce different seeds
          expect(seed1).not.toBe(seed2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hash returns 32-bit signed integers', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 10 }), // values
        (values) => {
          const result = hash(...values);
          
          expect(Number.isInteger(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(-2147483648); // Min 32-bit signed int
          expect(result).toBeLessThanOrEqual(2147483647);    // Max 32-bit signed int
        }
      ),
      { numRuns: 100 }
    );
  });

  test('chunkSeed returns 32-bit signed integers', () => {
    fc.assert(
      fc.property(
        fc.integer(), // worldSeed
        fc.integer({ min: -10000, max: 10000 }), // chunkX
        fc.integer({ min: -10000, max: 10000 }), // chunkY
        (worldSeed, chunkX, chunkY) => {
          const seed = chunkSeed(worldSeed, chunkX, chunkY);
          
          expect(Number.isInteger(seed)).toBe(true);
          expect(seed).toBeGreaterThanOrEqual(-2147483648);
          expect(seed).toBeLessThanOrEqual(2147483647);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('nearby chunk coordinates produce well-distributed seeds', () => {
    fc.assert(
      fc.property(
        fc.integer(), // worldSeed
        fc.integer({ min: -100, max: 100 }), // baseX
        fc.integer({ min: -100, max: 100 }), // baseY
        (worldSeed, baseX, baseY) => {
          const seeds = new Set<number>();
          
          // Generate seeds for a 5x5 grid of nearby chunks
          for (let dx = 0; dx < 5; dx++) {
            for (let dy = 0; dy < 5; dy++) {
              seeds.add(chunkSeed(worldSeed, baseX + dx, baseY + dy));
            }
          }
          
          // All 25 seeds should be unique (good distribution)
          expect(seeds.size).toBe(25);
        }
      ),
      { numRuns: 100 }
    );
  });
});

