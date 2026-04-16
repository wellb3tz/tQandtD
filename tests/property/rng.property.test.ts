import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { SeededRNG } from '../../src/core/rng';

describe('SeededRNG Property Tests', () => {
  // Feature: procedural-world-engine, Property 1: RNG Determinism
  // **Validates: Requirements 1.2**
  test('RNG produces identical sequences for same seed', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.integer({ min: 1, max: 100 }), // number of calls
        (seed, numCalls) => {
          const rng1 = new SeededRNG(seed);
          const rng2 = new SeededRNG(seed);
          
          const sequence1 = Array.from({ length: numCalls }, () => rng1.nextFloat());
          const sequence2 = Array.from({ length: numCalls }, () => rng2.nextFloat());
          
          expect(sequence1).toEqual(sequence2);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: procedural-world-engine, Property 2: RNG Float Range
  // **Validates: Requirements 1.5**
  test('nextFloat always returns values in [0, 1)', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.integer({ min: 1, max: 100 }), // number of calls
        (seed, numCalls) => {
          const rng = new SeededRNG(seed);
          
          for (let i = 0; i < numCalls; i++) {
            const value = rng.nextFloat();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('nextInt always returns integers in specified range', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.integer({ min: -1000, max: 1000 }), // min
        fc.integer({ min: 1, max: 100 }), // range size
        fc.integer({ min: 1, max: 50 }), // number of calls
        (seed, min, rangeSize, numCalls) => {
          const max = min + rangeSize;
          const rng = new SeededRNG(seed);
          
          for (let i = 0; i < numCalls; i++) {
            const value = rng.nextInt(min, max);
            expect(value).toBeGreaterThanOrEqual(min);
            expect(value).toBeLessThan(max);
            expect(Number.isInteger(value)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('derive creates deterministic derived RNGs', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.integer(), // offset
        fc.integer({ min: 1, max: 50 }), // number of calls
        (seed, offset, numCalls) => {
          const rng1 = new SeededRNG(seed);
          const rng2 = new SeededRNG(seed);
          
          const derived1 = rng1.derive(offset);
          const derived2 = rng2.derive(offset);
          
          const sequence1 = Array.from({ length: numCalls }, () => derived1.nextFloat());
          const sequence2 = Array.from({ length: numCalls }, () => derived2.nextFloat());
          
          expect(sequence1).toEqual(sequence2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('different seeds produce different sequences', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed1
        fc.integer(), // seed2
        fc.integer({ min: 10, max: 50 }), // number of calls
        (seed1, seed2, numCalls) => {
          // Skip if seeds are the same
          fc.pre(seed1 !== seed2);
          
          const rng1 = new SeededRNG(seed1);
          const rng2 = new SeededRNG(seed2);
          
          const sequence1 = Array.from({ length: numCalls }, () => rng1.nextFloat());
          const sequence2 = Array.from({ length: numCalls }, () => rng2.nextFloat());
          
          // Different seeds should produce different sequences
          // (with extremely high probability)
          expect(sequence1).not.toEqual(sequence2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('RNG state advances independently', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.integer({ min: 1, max: 20 }), // calls for rng1
        fc.integer({ min: 1, max: 20 }), // calls for rng2
        (seed, calls1, calls2) => {
          const rng1 = new SeededRNG(seed);
          const rng2 = new SeededRNG(seed);
          
          // Advance rng1
          for (let i = 0; i < calls1; i++) {
            rng1.nextFloat();
          }
          
          // Advance rng2
          for (let i = 0; i < calls2; i++) {
            rng2.nextFloat();
          }
          
          // If they made the same number of calls, next values should match
          if (calls1 === calls2) {
            expect(rng1.nextFloat()).toBe(rng2.nextFloat());
          } else {
            // Otherwise they should differ
            expect(rng1.nextFloat()).not.toBe(rng2.nextFloat());
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

