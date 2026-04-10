import { describe, test, expect } from 'vitest';
import { hash, chunkSeed } from '../../../src/core/hash';

describe('hash', () => {
  test('produces consistent output for same inputs', () => {
    const result1 = hash(1, 2, 3);
    const result2 = hash(1, 2, 3);
    
    expect(result1).toBe(result2);
  });

  test('produces consistent output for single value', () => {
    const result1 = hash(42);
    const result2 = hash(42);
    
    expect(result1).toBe(result2);
  });

  test('produces consistent output for many values', () => {
    const result1 = hash(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    const result2 = hash(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    
    expect(result1).toBe(result2);
  });

  test('different inputs produce different hashes', () => {
    const result1 = hash(1, 2, 3);
    const result2 = hash(4, 5, 6);
    
    expect(result1).not.toBe(result2);
  });

  test('order of inputs matters', () => {
    const result1 = hash(1, 2, 3);
    const result2 = hash(3, 2, 1);
    
    expect(result1).not.toBe(result2);
  });

  test('different number of inputs produces different hashes', () => {
    const result1 = hash(1, 2);
    const result2 = hash(1, 2, 3);
    
    expect(result1).not.toBe(result2);
  });

  test('handles zero values', () => {
    const result1 = hash(0);
    const result2 = hash(0, 0, 0);
    
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1).not.toBe(result2);
  });

  test('handles negative numbers', () => {
    const result1 = hash(-1, -2, -3);
    const result2 = hash(-1, -2, -3);
    
    expect(result1).toBe(result2);
  });

  test('handles mix of positive and negative numbers', () => {
    const result1 = hash(-10, 0, 10);
    const result2 = hash(-10, 0, 10);
    
    expect(result1).toBe(result2);
  });

  test('handles large numbers', () => {
    const result1 = hash(1000000, 2000000, 3000000);
    const result2 = hash(1000000, 2000000, 3000000);
    
    expect(result1).toBe(result2);
  });

  test('returns 32-bit integer', () => {
    const result = hash(1, 2, 3);
    
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(-2147483648); // Min 32-bit signed int
    expect(result).toBeLessThanOrEqual(2147483647);    // Max 32-bit signed int
  });

  test('handles empty input', () => {
    const result = hash();
    
    expect(result).toBeDefined();
    expect(Number.isInteger(result)).toBe(true);
  });

  test('produces good distribution for sequential inputs', () => {
    const hashes = new Set<number>();
    
    for (let i = 0; i < 100; i++) {
      hashes.add(hash(i));
    }
    
    // Should have many unique hashes (good distribution)
    expect(hashes.size).toBeGreaterThan(95);
  });
});

describe('chunkSeed', () => {
  test('produces consistent seed for same coordinates', () => {
    const seed1 = chunkSeed(1000, 5, 10);
    const seed2 = chunkSeed(1000, 5, 10);
    
    expect(seed1).toBe(seed2);
  });

  test('different chunk coordinates produce different seeds', () => {
    const worldSeed = 1000;
    const seed1 = chunkSeed(worldSeed, 0, 0);
    const seed2 = chunkSeed(worldSeed, 1, 0);
    const seed3 = chunkSeed(worldSeed, 0, 1);
    
    expect(seed1).not.toBe(seed2);
    expect(seed1).not.toBe(seed3);
    expect(seed2).not.toBe(seed3);
  });

  test('different world seeds produce different chunk seeds', () => {
    const seed1 = chunkSeed(1000, 5, 10);
    const seed2 = chunkSeed(2000, 5, 10);
    
    expect(seed1).not.toBe(seed2);
  });

  test('handles negative chunk coordinates', () => {
    const seed1 = chunkSeed(1000, -5, -10);
    const seed2 = chunkSeed(1000, -5, -10);
    
    expect(seed1).toBe(seed2);
  });

  test('negative and positive coordinates produce different seeds', () => {
    const worldSeed = 1000;
    const seed1 = chunkSeed(worldSeed, 5, 10);
    const seed2 = chunkSeed(worldSeed, -5, -10);
    
    expect(seed1).not.toBe(seed2);
  });

  test('handles zero coordinates', () => {
    const seed1 = chunkSeed(1000, 0, 0);
    const seed2 = chunkSeed(1000, 0, 0);
    
    expect(seed1).toBe(seed2);
  });

  test('returns 32-bit integer', () => {
    const seed = chunkSeed(1000, 5, 10);
    
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(-2147483648);
    expect(seed).toBeLessThanOrEqual(2147483647);
  });

  test('produces good distribution for nearby chunks', () => {
    const worldSeed = 1000;
    const seeds = new Set<number>();
    
    // Generate seeds for a 10x10 grid of chunks
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        seeds.add(chunkSeed(worldSeed, x, y));
      }
    }
    
    // Should have all unique seeds (good distribution)
    expect(seeds.size).toBe(100);
  });

  test('swapping coordinates produces different seeds', () => {
    const worldSeed = 1000;
    const seed1 = chunkSeed(worldSeed, 5, 10);
    const seed2 = chunkSeed(worldSeed, 10, 5);
    
    expect(seed1).not.toBe(seed2);
  });
});
