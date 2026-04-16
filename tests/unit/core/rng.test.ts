import { describe, test, expect } from 'vitest';
import { SeededRNG } from '../../../src/core/rng';

describe('SeededRNG', () => {
  describe('constructor', () => {
    test('accepts valid numeric seed', () => {
      expect(() => new SeededRNG(12345)).not.toThrow();
      expect(() => new SeededRNG(0)).not.toThrow();
      expect(() => new SeededRNG(-999)).not.toThrow();
    });

    test('throws error for NaN seed', () => {
      expect(() => new SeededRNG(NaN)).toThrow('Invalid seed');
    });

    test('throws error for infinite seed', () => {
      expect(() => new SeededRNG(Infinity)).toThrow('Invalid seed');
      expect(() => new SeededRNG(-Infinity)).toThrow('Invalid seed');
    });
  });

  describe('nextFloat', () => {
    test('generates values in range [0, 1)', () => {
      const rng = new SeededRNG(12345);
      
      for (let i = 0; i < 1000; i++) {
        const value = rng.nextFloat();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    test('generates different values in sequence', () => {
      const rng = new SeededRNG(12345);
      const values = new Set<number>();
      
      for (let i = 0; i < 100; i++) {
        values.add(rng.nextFloat());
      }
      
      // Should have many unique values (allowing for some collisions)
      expect(values.size).toBeGreaterThan(90);
    });

    test('produces identical sequences for same seed', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      
      for (let i = 0; i < 100; i++) {
        expect(rng1.nextFloat()).toBe(rng2.nextFloat());
      }
    });

    test('produces different sequences for different seeds', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(43);
      
      const seq1 = Array.from({ length: 10 }, () => rng1.nextFloat());
      const seq2 = Array.from({ length: 10 }, () => rng2.nextFloat());
      
      expect(seq1).not.toEqual(seq2);
    });
  });

  describe('nextInt', () => {
    test('generates integers in specified range', () => {
      const rng = new SeededRNG(12345);
      const min = 10;
      const max = 20;
      
      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(min, max);
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThan(max);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    test('handles boundary values correctly', () => {
      const rng = new SeededRNG(12345);
      
      // Test with min = 0
      for (let i = 0; i < 50; i++) {
        const value = rng.nextInt(0, 10);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(10);
      }
      
      // Test with negative range
      for (let i = 0; i < 50; i++) {
        const value = rng.nextInt(-10, 0);
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThan(0);
      }
    });

    test('throws error when min >= max', () => {
      const rng = new SeededRNG(12345);
      
      expect(() => rng.nextInt(10, 10)).toThrow('Invalid range');
      expect(() => rng.nextInt(20, 10)).toThrow('Invalid range');
    });

    test('throws error for non-finite values', () => {
      const rng = new SeededRNG(12345);
      
      expect(() => rng.nextInt(NaN, 10)).toThrow('Invalid range');
      expect(() => rng.nextInt(0, Infinity)).toThrow('Invalid range');
      expect(() => rng.nextInt(-Infinity, 10)).toThrow('Invalid range');
    });

    test('generates all values in small range eventually', () => {
      const rng = new SeededRNG(12345);
      const min = 0;
      const max = 5;
      const values = new Set<number>();
      
      // Generate enough samples to likely hit all values
      for (let i = 0; i < 100; i++) {
        values.add(rng.nextInt(min, max));
      }
      
      // Should have seen most or all values in the range
      expect(values.size).toBeGreaterThanOrEqual(4);
    });

    test('boundary values: generates min value', () => {
      const rng = new SeededRNG(12345);
      const min = 10;
      const max = 20;
      const values = new Set<number>();
      
      // Generate many samples to ensure we hit the minimum
      for (let i = 0; i < 1000; i++) {
        values.add(rng.nextInt(min, max));
      }
      
      // Should include the minimum value
      expect(values.has(min)).toBe(true);
    });

    test('boundary values: never generates max value', () => {
      const rng = new SeededRNG(12345);
      const min = 10;
      const max = 20;
      
      // Generate many samples
      for (let i = 0; i < 1000; i++) {
        const value = rng.nextInt(min, max);
        // Max should never be generated (exclusive upper bound)
        expect(value).not.toBe(max);
      }
    });

    test('boundary values: generates max-1 value', () => {
      const rng = new SeededRNG(12345);
      const min = 10;
      const max = 20;
      const values = new Set<number>();
      
      // Generate many samples to ensure we hit max-1
      for (let i = 0; i < 1000; i++) {
        values.add(rng.nextInt(min, max));
      }
      
      // Should include max-1 (the highest possible value)
      expect(values.has(max - 1)).toBe(true);
    });

    test('boundary values: single value range', () => {
      const rng = new SeededRNG(12345);
      
      // Range [5, 6) should only produce 5
      for (let i = 0; i < 100; i++) {
        expect(rng.nextInt(5, 6)).toBe(5);
      }
    });

    test('boundary values: large range', () => {
      const rng = new SeededRNG(12345);
      const min = -1000000;
      const max = 1000000;
      
      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(min, max);
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThan(max);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });

  describe('derive', () => {
    test('creates new RNG with derived seed', () => {
      const rng1 = new SeededRNG(100);
      const rng2 = rng1.derive(50);
      
      expect(rng2).toBeInstanceOf(SeededRNG);
      expect(rng2).not.toBe(rng1);
    });

    test('derived RNG produces different sequence than original', () => {
      const rng1 = new SeededRNG(100);
      const rng2 = rng1.derive(50);
      
      const seq1 = Array.from({ length: 10 }, () => rng1.nextFloat());
      const seq2 = Array.from({ length: 10 }, () => rng2.nextFloat());
      
      expect(seq1).not.toEqual(seq2);
    });

    test('same derivation produces same sequence', () => {
      const rng1 = new SeededRNG(100);
      const rng2 = new SeededRNG(100);
      
      const derived1 = rng1.derive(50);
      const derived2 = rng2.derive(50);
      
      const seq1 = Array.from({ length: 10 }, () => derived1.nextFloat());
      const seq2 = Array.from({ length: 10 }, () => derived2.nextFloat());
      
      expect(seq1).toEqual(seq2);
    });

    test('throws error for non-finite offset', () => {
      const rng = new SeededRNG(100);
      
      expect(() => rng.derive(NaN)).toThrow('Invalid offset');
      expect(() => rng.derive(Infinity)).toThrow('Invalid offset');
    });

    test('different offsets produce different sequences', () => {
      const rng = new SeededRNG(100);
      const derived1 = rng.derive(1);
      const derived2 = rng.derive(2);
      
      const seq1 = Array.from({ length: 10 }, () => derived1.nextFloat());
      const seq2 = Array.from({ length: 10 }, () => derived2.nextFloat());
      
      expect(seq1).not.toEqual(seq2);
    });
  });
});

