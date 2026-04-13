import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { NoiseEngine, NoiseConfig } from '../../../src/core/noise';

describe('NoiseEngine', () => {
  describe('constructor', () => {
    test('accepts valid numeric seed', () => {
      expect(() => new NoiseEngine(12345)).not.toThrow();
      expect(() => new NoiseEngine(0)).not.toThrow();
      expect(() => new NoiseEngine(-999)).not.toThrow();
    });
  });

  describe('noise2D', () => {
    // Requirements 10.2: Test noise output range [-1, 1]
    test('generates values in range [-1, 1]', () => {
      const noise = new NoiseEngine(12345);
      
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const value = noise.noise2D(x, y);
        
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    test('produces identical values for same coordinates and seed', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(42);
      
      const testPoints = [
        [0, 0],
        [1.5, 2.7],
        [-10, 5],
        [100.123, -50.456]
      ];
      
      for (const [x, y] of testPoints) {
        expect(noise1.noise2D(x, y)).toBe(noise2.noise2D(x, y));
      }
    });

    test('produces different values for different seeds', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(43);
      
      const value1 = noise1.noise2D(10, 20);
      const value2 = noise2.noise2D(10, 20);
      
      expect(value1).not.toBe(value2);
    });

    test('produces different values for different coordinates', () => {
      const noise = new NoiseEngine(12345);
      
      const value1 = noise.noise2D(0, 0);
      const value2 = noise.noise2D(1, 1);
      const value3 = noise.noise2D(10, 10);
      
      expect(value1).not.toBe(value2);
      expect(value2).not.toBe(value3);
      expect(value1).not.toBe(value3);
    });

    test('handles invalid coordinates gracefully', () => {
      const noise = new NoiseEngine(12345);
      
      expect(noise.noise2D(NaN, 0)).toBe(0);
      expect(noise.noise2D(0, NaN)).toBe(0);
      expect(noise.noise2D(Infinity, 0)).toBe(0);
      expect(noise.noise2D(0, -Infinity)).toBe(0);
    });

    test('produces smooth continuous values', () => {
      const noise = new NoiseEngine(12345);
      
      // Sample along a line and check that adjacent values are similar
      const samples: number[] = [];
      for (let i = 0; i < 10; i++) {
        samples.push(noise.noise2D(i * 0.1, 0));
      }
      
      // Check that adjacent samples don't differ too much (smoothness)
      for (let i = 1; i < samples.length; i++) {
        const diff = Math.abs(samples[i] - samples[i - 1]);
        expect(diff).toBeLessThan(0.5); // Reasonable threshold for smoothness
      }
    });
  });

  describe('fbm', () => {
    const defaultConfig: NoiseConfig = {
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 1.0
    };

    // Requirements 10.2: Test fBM with different octave counts
    test('generates values approximately in range [-1, 1]', () => {
      const noise = new NoiseEngine(12345);
      
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const value = noise.fbm(x, y, defaultConfig);
        
        // fBM should be normalized to approximately [-1, 1]
        expect(value).toBeGreaterThan(-1.5);
        expect(value).toBeLessThan(1.5);
      }
    });

    test('produces identical values for same inputs', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(42);
      
      const value1 = noise1.fbm(10, 20, defaultConfig);
      const value2 = noise2.fbm(10, 20, defaultConfig);
      
      expect(value1).toBe(value2);
    });

    // Requirements 10.2: Test fBM with different octave counts
    test('different octave counts produce different results', () => {
      const noise = new NoiseEngine(12345);
      
      const config1: NoiseConfig = { ...defaultConfig, octaves: 1 };
      const config2: NoiseConfig = { ...defaultConfig, octaves: 4 };
      const config3: NoiseConfig = { ...defaultConfig, octaves: 8 };
      
      const value1 = noise.fbm(10, 20, config1);
      const value2 = noise.fbm(10, 20, config2);
      const value3 = noise.fbm(10, 20, config3);
      
      expect(value1).not.toBe(value2);
      expect(value2).not.toBe(value3);
      expect(value1).not.toBe(value3);
    });

    test('different persistence values produce different results', () => {
      const noise = new NoiseEngine(12345);
      
      const config1: NoiseConfig = { ...defaultConfig, persistence: 0.3 };
      const config2: NoiseConfig = { ...defaultConfig, persistence: 0.7 };
      
      const value1 = noise.fbm(10, 20, config1);
      const value2 = noise.fbm(10, 20, config2);
      
      expect(value1).not.toBe(value2);
    });

    test('different lacunarity values produce different results', () => {
      const noise = new NoiseEngine(12345);
      
      const config1: NoiseConfig = { ...defaultConfig, lacunarity: 1.5 };
      const config2: NoiseConfig = { ...defaultConfig, lacunarity: 3.0 };
      
      const value1 = noise.fbm(10, 20, config1);
      const value2 = noise.fbm(10, 20, config2);
      
      expect(value1).not.toBe(value2);
    });

    test('different scale values produce different results', () => {
      const noise = new NoiseEngine(12345);
      
      const config1: NoiseConfig = { ...defaultConfig, scale: 0.5 };
      const config2: NoiseConfig = { ...defaultConfig, scale: 2.0 };
      
      const value1 = noise.fbm(10, 20, config1);
      const value2 = noise.fbm(10, 20, config2);
      
      expect(value1).not.toBe(value2);
    });

    // Requirements 10.5: Test invalid config handling
    test('throws error for invalid octaves', () => {
      const noise = new NoiseEngine(12345);
      const invalidConfig: NoiseConfig = { ...defaultConfig, octaves: 0 };
      
      expect(() => noise.fbm(10, 20, invalidConfig)).toThrow('Invalid config: octaves');
    });

    // Requirements 10.5: Test invalid config handling
    test('throws error for invalid persistence', () => {
      const noise = new NoiseEngine(12345);
      const invalidConfig: NoiseConfig = { ...defaultConfig, persistence: 0 };
      
      expect(() => noise.fbm(10, 20, invalidConfig)).toThrow('Invalid config: persistence');
    });

    // Requirements 10.5: Test invalid config handling
    test('throws error for invalid lacunarity', () => {
      const noise = new NoiseEngine(12345);
      const invalidConfig: NoiseConfig = { ...defaultConfig, lacunarity: -1 };
      
      expect(() => noise.fbm(10, 20, invalidConfig)).toThrow('Invalid config: lacunarity');
    });

    test('single octave produces same result as noise2D with scale', () => {
      const noise = new NoiseEngine(12345);
      const config: NoiseConfig = {
        octaves: 1,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 1.0
      };
      
      const x = 10, y = 20;
      const fbmValue = noise.fbm(x, y, config);
      const noiseValue = noise.noise2D(x * config.scale, y * config.scale);
      
      expect(fbmValue).toBeCloseTo(noiseValue, 10);
    });
  });

  describe('fbm3D', () => {
    const defaultConfig: NoiseConfig = {
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 1.0
    };

    // Requirements 1.3, 1.4: Test 3D fBM with different octave counts
    test('generates values approximately in range [-1, 1]', () => {
      const noise = new NoiseEngine(12345);
      
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const z = Math.random() * 100;
        const value = noise.fbm3D(x, y, z, defaultConfig);
        
        // fBM should be normalized to approximately [-1, 1]
        expect(value).toBeGreaterThan(-1.5);
        expect(value).toBeLessThan(1.5);
      }
    });

    test('produces identical values for same inputs', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(42);
      
      const value1 = noise1.fbm3D(10, 20, 30, defaultConfig);
      const value2 = noise2.fbm3D(10, 20, 30, defaultConfig);
      
      expect(value1).toBe(value2);
    });

    // Requirements 1.3, 1.4: Test 3D fBM with different octave counts
    test('different octave counts produce different results', () => {
      const noise = new NoiseEngine(12345);
      
      const config1: NoiseConfig = { ...defaultConfig, octaves: 1 };
      const config2: NoiseConfig = { ...defaultConfig, octaves: 4 };
      const config3: NoiseConfig = { ...defaultConfig, octaves: 8 };
      
      const value1 = noise.fbm3D(5.5, 7.3, 9.2, config1);
      const value2 = noise.fbm3D(5.5, 7.3, 9.2, config2);
      const value3 = noise.fbm3D(5.5, 7.3, 9.2, config3);
      
      expect(value1).not.toBe(value2);
      expect(value2).not.toBe(value3);
      expect(value1).not.toBe(value3);
    });

    test('different persistence values produce different results', () => {
      const noise = new NoiseEngine(12345);
      
      const config1: NoiseConfig = { ...defaultConfig, persistence: 0.3 };
      const config2: NoiseConfig = { ...defaultConfig, persistence: 0.7 };
      
      const value1 = noise.fbm3D(5.5, 7.3, 9.2, config1);
      const value2 = noise.fbm3D(5.5, 7.3, 9.2, config2);
      
      expect(value1).not.toBe(value2);
    });

    test('different lacunarity values produce different results', () => {
      const noise = new NoiseEngine(12345);
      
      const config1: NoiseConfig = { ...defaultConfig, lacunarity: 1.5 };
      const config2: NoiseConfig = { ...defaultConfig, lacunarity: 3.0 };
      
      const value1 = noise.fbm3D(10, 20, 30, config1);
      const value2 = noise.fbm3D(10, 20, 30, config2);
      
      expect(value1).not.toBe(value2);
    });

    test('different scale values produce different results', () => {
      const noise = new NoiseEngine(12345);
      
      const config1: NoiseConfig = { ...defaultConfig, scale: 0.5 };
      const config2: NoiseConfig = { ...defaultConfig, scale: 2.0 };
      
      const value1 = noise.fbm3D(5.5, 7.3, 9.2, config1);
      const value2 = noise.fbm3D(5.5, 7.3, 9.2, config2);
      
      expect(value1).not.toBe(value2);
    });

    // Requirements 1.4: Test invalid config handling
    test('throws error for invalid octaves', () => {
      const noise = new NoiseEngine(12345);
      const invalidConfig: NoiseConfig = { ...defaultConfig, octaves: 0 };
      
      expect(() => noise.fbm3D(10, 20, 30, invalidConfig)).toThrow('Invalid config: octaves');
    });

    // Requirements 1.4: Test invalid config handling
    test('throws error for invalid persistence', () => {
      const noise = new NoiseEngine(12345);
      const invalidConfig: NoiseConfig = { ...defaultConfig, persistence: 0 };
      
      expect(() => noise.fbm3D(10, 20, 30, invalidConfig)).toThrow('Invalid config: persistence');
    });

    // Requirements 1.4: Test invalid config handling
    test('throws error for invalid lacunarity', () => {
      const noise = new NoiseEngine(12345);
      const invalidConfig: NoiseConfig = { ...defaultConfig, lacunarity: -1 };
      
      expect(() => noise.fbm3D(10, 20, 30, invalidConfig)).toThrow('Invalid config: lacunarity');
    });

    test('single octave produces same result as noise3D with scale', () => {
      const noise = new NoiseEngine(12345);
      const config: NoiseConfig = {
        octaves: 1,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 1.0
      };
      
      const x = 10, y = 20, z = 30;
      const fbmValue = noise.fbm3D(x, y, z, config);
      const noiseValue = noise.noise3D(x * config.scale, y * config.scale, z * config.scale);
      
      expect(fbmValue).toBeCloseTo(noiseValue, 10);
    });

    test('varying z coordinate produces different results', () => {
      const noise = new NoiseEngine(12345);
      
      const value1 = noise.fbm3D(10, 20, 0, defaultConfig);
      const value2 = noise.fbm3D(10, 20, 5, defaultConfig);
      const value3 = noise.fbm3D(10, 20, 10, defaultConfig);
      
      expect(value1).not.toBe(value2);
      expect(value2).not.toBe(value3);
      expect(value1).not.toBe(value3);
    });
  });

  describe('domainWarp', () => {
    // Requirements 10.3: Test domain warping produces different coordinates
    test('returns warped coordinates', () => {
      const noise = new NoiseEngine(12345);
      
      const [warpedX, warpedY] = noise.domainWarp(10, 20, 5);
      
      expect(typeof warpedX).toBe('number');
      expect(typeof warpedY).toBe('number');
      expect(Number.isFinite(warpedX)).toBe(true);
      expect(Number.isFinite(warpedY)).toBe(true);
    });

    // Requirements 10.3: Test domain warping produces different coordinates
    test('produces different coordinates than input', () => {
      const noise = new NoiseEngine(12345);
      const x = 10, y = 20;
      const strength = 5;
      
      const [warpedX, warpedY] = noise.domainWarp(x, y, strength);
      
      // With non-zero strength, coordinates should be warped
      expect(warpedX).not.toBe(x);
      expect(warpedY).not.toBe(y);
    });

    test('zero strength returns approximately original coordinates', () => {
      const noise = new NoiseEngine(12345);
      const x = 10, y = 20;
      
      const [warpedX, warpedY] = noise.domainWarp(x, y, 0);
      
      // With zero strength, should return original coordinates
      expect(warpedX).toBeCloseTo(x, 10);
      expect(warpedY).toBeCloseTo(y, 10);
    });

    test('produces identical warped coordinates for same seed', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(42);
      
      const [x1, y1] = noise1.domainWarp(10, 20, 5);
      const [x2, y2] = noise2.domainWarp(10, 20, 5);
      
      expect(x1).toBe(x2);
      expect(y1).toBe(y2);
    });

    test('produces different warped coordinates for different seeds', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(43);
      
      const [x1, y1] = noise1.domainWarp(10, 20, 5);
      const [x2, y2] = noise2.domainWarp(10, 20, 5);
      
      expect(x1).not.toBe(x2);
      expect(y1).not.toBe(y2);
    });

    test('larger strength produces larger displacement', () => {
      const noise = new NoiseEngine(12345);
      const x = 10, y = 20;
      
      const [x1, y1] = noise.domainWarp(x, y, 1);
      const [x2, y2] = noise.domainWarp(x, y, 10);
      
      const dist1 = Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2);
      const dist2 = Math.sqrt((x2 - x) ** 2 + (y2 - y) ** 2);
      
      // Larger strength should generally produce larger displacement
      expect(dist2).toBeGreaterThan(dist1);
    });
  });

  describe('domainWarp3D', () => {
    // Requirements 1.3: Test 3D domain warping produces different coordinates
    test('returns warped 3D coordinates', () => {
      const noise = new NoiseEngine(12345);
      
      const [warpedX, warpedY, warpedZ] = noise.domainWarp3D(10, 20, 30, 5);
      
      expect(typeof warpedX).toBe('number');
      expect(typeof warpedY).toBe('number');
      expect(typeof warpedZ).toBe('number');
      expect(Number.isFinite(warpedX)).toBe(true);
      expect(Number.isFinite(warpedY)).toBe(true);
      expect(Number.isFinite(warpedZ)).toBe(true);
    });

    // Requirements 1.3: Test 3D domain warping produces different coordinates
    test('produces different coordinates than input', () => {
      const noise = new NoiseEngine(12345);
      const x = 10, y = 20, z = 30;
      const strength = 5;
      
      const [warpedX, warpedY, warpedZ] = noise.domainWarp3D(x, y, z, strength);
      
      // With non-zero strength, coordinates should be warped
      expect(warpedX).not.toBe(x);
      expect(warpedY).not.toBe(y);
      expect(warpedZ).not.toBe(z);
    });

    test('zero strength returns approximately original coordinates', () => {
      const noise = new NoiseEngine(12345);
      const x = 10, y = 20, z = 30;
      
      const [warpedX, warpedY, warpedZ] = noise.domainWarp3D(x, y, z, 0);
      
      // With zero strength, should return original coordinates
      expect(warpedX).toBeCloseTo(x, 10);
      expect(warpedY).toBeCloseTo(y, 10);
      expect(warpedZ).toBeCloseTo(z, 10);
    });

    test('produces identical warped coordinates for same seed', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(42);
      
      const [x1, y1, z1] = noise1.domainWarp3D(10, 20, 30, 5);
      const [x2, y2, z2] = noise2.domainWarp3D(10, 20, 30, 5);
      
      expect(x1).toBe(x2);
      expect(y1).toBe(y2);
      expect(z1).toBe(z2);
    });

    test('produces different warped coordinates for different seeds', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(43);
      
      const [x1, y1, z1] = noise1.domainWarp3D(10, 20, 30, 5);
      const [x2, y2, z2] = noise2.domainWarp3D(10, 20, 30, 5);
      
      expect(x1).not.toBe(x2);
      expect(y1).not.toBe(y2);
      expect(z1).not.toBe(z2);
    });

    test('larger strength produces larger displacement', () => {
      const noise = new NoiseEngine(12345);
      const x = 10, y = 20, z = 30;
      
      const [x1, y1, z1] = noise.domainWarp3D(x, y, z, 1);
      const [x2, y2, z2] = noise.domainWarp3D(x, y, z, 10);
      
      const dist1 = Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2 + (z1 - z) ** 2);
      const dist2 = Math.sqrt((x2 - x) ** 2 + (y2 - y) ** 2 + (z2 - z) ** 2);
      
      // Larger strength should generally produce larger displacement
      expect(dist2).toBeGreaterThan(dist1);
    });

    test('warps all three dimensions independently', () => {
      const noise = new NoiseEngine(12345);
      const x = 10, y = 20, z = 30;
      const strength = 5;
      
      const [warpedX, warpedY, warpedZ] = noise.domainWarp3D(x, y, z, strength);
      
      // Each dimension should be warped independently
      const offsetX = warpedX - x;
      const offsetY = warpedY - y;
      const offsetZ = warpedZ - z;
      
      // Offsets should be different (with high probability)
      expect(offsetX).not.toBe(offsetY);
      expect(offsetY).not.toBe(offsetZ);
      expect(offsetX).not.toBe(offsetZ);
    });
  });

  describe('noise3D', () => {
    // Requirements 1.1, 1.2: Test 3D noise output range [-1, 1]
    test('generates values in range [-1, 1]', () => {
      const noise = new NoiseEngine(12345);
      
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const z = Math.random() * 100;
        const value = noise.noise3D(x, y, z);
        
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    test('produces identical values for same coordinates and seed', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(42);
      
      const testPoints = [
        [0, 0, 0],
        [1.5, 2.7, 3.2],
        [-10, 5, -7],
        [100.123, -50.456, 25.789]
      ];
      
      for (const [x, y, z] of testPoints) {
        expect(noise1.noise3D(x, y, z)).toBe(noise2.noise3D(x, y, z));
      }
    });

    test('produces different values for different seeds', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(43);
      
      const value1 = noise1.noise3D(10.5, 20.3, 30.7);
      const value2 = noise2.noise3D(10.5, 20.3, 30.7);
      
      expect(value1).not.toBe(value2);
    });

    test('produces different values for different coordinates', () => {
      const noise = new NoiseEngine(12345);
      
      const value1 = noise.noise3D(0.1, 0.1, 0.1);
      const value2 = noise.noise3D(1.2, 1.3, 1.4);
      const value3 = noise.noise3D(10.5, 10.6, 10.7);
      
      expect(value1).not.toBe(value2);
      expect(value2).not.toBe(value3);
      expect(value1).not.toBe(value3);
    });

    // Requirements 1.1, 1.2: Test invalid coordinate handling
    test('handles invalid coordinates gracefully', () => {
      const noise = new NoiseEngine(12345);
      
      expect(noise.noise3D(NaN, 0, 0)).toBe(0);
      expect(noise.noise3D(0, NaN, 0)).toBe(0);
      expect(noise.noise3D(0, 0, NaN)).toBe(0);
      expect(noise.noise3D(Infinity, 0, 0)).toBe(0);
      expect(noise.noise3D(0, -Infinity, 0)).toBe(0);
      expect(noise.noise3D(0, 0, Infinity)).toBe(0);
    });

    test('produces smooth continuous values', () => {
      const noise = new NoiseEngine(12345);
      
      // Sample along a line and check that adjacent values are similar
      const samples: number[] = [];
      for (let i = 0; i < 10; i++) {
        samples.push(noise.noise3D(i * 0.1, 0, 0));
      }
      
      // Check that adjacent samples don't differ too much (smoothness)
      for (let i = 1; i < samples.length; i++) {
        const diff = Math.abs(samples[i] - samples[i - 1]);
        expect(diff).toBeLessThan(0.5); // Reasonable threshold for smoothness
      }
    });

    test('varying z coordinate produces different values', () => {
      const noise = new NoiseEngine(12345);
      
      const value1 = noise.noise3D(10, 20, 0);
      const value2 = noise.noise3D(10, 20, 5);
      const value3 = noise.noise3D(10, 20, 10);
      
      expect(value1).not.toBe(value2);
      expect(value2).not.toBe(value3);
      expect(value1).not.toBe(value3);
    });

    // Feature: 3d-world-generation-enhancements, Property 1: 3D noise determinism
    // **Validates: Requirements 1.5**
    test('3D noise produces same output for same seed and coordinates', () => {
      fc.assert(
        fc.property(
          fc.integer(),           // seed
          fc.float({ min: -1000, max: 1000, noNaN: true }),  // x
          fc.float({ min: -1000, max: 1000, noNaN: true }),  // y
          fc.float({ min: -1000, max: 1000, noNaN: true }),  // z
          (seed, x, y, z) => {
            const engine1 = new NoiseEngine(seed);
            const engine2 = new NoiseEngine(seed);
            const value1 = engine1.noise3D(x, y, z);
            const value2 = engine2.noise3D(x, y, z);
            return Math.abs(value1 - value2) < 1e-10;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Requirements 1.1, 1.2: Edge case tests for 3D noise
  describe('noise3D edge cases', () => {
    test('handles zero coordinates', () => {
      const noise = new NoiseEngine(12345);
      
      // Test all combinations of zero coordinates
      const value1 = noise.noise3D(0, 0, 0);
      const value2 = noise.noise3D(0, 0, 1);
      const value3 = noise.noise3D(0, 1, 0);
      const value4 = noise.noise3D(1, 0, 0);
      const value5 = noise.noise3D(0, 1, 1);
      const value6 = noise.noise3D(1, 0, 1);
      const value7 = noise.noise3D(1, 1, 0);
      
      // All values should be valid numbers in range [-1, 1]
      expect(value1).toBeGreaterThanOrEqual(-1);
      expect(value1).toBeLessThanOrEqual(1);
      expect(Number.isFinite(value1)).toBe(true);
      
      // Zero coordinates should produce deterministic results
      const noise2 = new NoiseEngine(12345);
      expect(noise2.noise3D(0, 0, 0)).toBe(value1);
      
      // Different combinations should produce different values
      expect(value1).not.toBe(value2);
      expect(value1).not.toBe(value3);
      expect(value1).not.toBe(value4);
    });

    test('handles very large positive coordinates', () => {
      const noise = new NoiseEngine(12345);
      
      const largeValues = [
        [1e6, 1e6, 1e6],
        [1e8, 1e8, 1e8],
        [1e10, 0, 0],
        [0, 1e10, 0],
        [0, 0, 1e10],
        [Number.MAX_SAFE_INTEGER / 2, Number.MAX_SAFE_INTEGER / 2, Number.MAX_SAFE_INTEGER / 2]
      ];
      
      for (const [x, y, z] of largeValues) {
        const value = noise.noise3D(x, y, z);
        
        // Should produce valid values in range
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
        expect(Number.isFinite(value)).toBe(true);
      }
    });

    test('handles very large negative coordinates', () => {
      const noise = new NoiseEngine(12345);
      
      const largeNegativeValues = [
        [-1e6, -1e6, -1e6],
        [-1e8, -1e8, -1e8],
        [-1e10, 0, 0],
        [0, -1e10, 0],
        [0, 0, -1e10],
        [-Number.MAX_SAFE_INTEGER / 2, -Number.MAX_SAFE_INTEGER / 2, -Number.MAX_SAFE_INTEGER / 2]
      ];
      
      for (const [x, y, z] of largeNegativeValues) {
        const value = noise.noise3D(x, y, z);
        
        // Should produce valid values in range
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
        expect(Number.isFinite(value)).toBe(true);
      }
    });

    test('handles negative coordinates', () => {
      const noise = new NoiseEngine(12345);
      
      const negativeCoords = [
        [-1, -1, -1],
        [-10, -20, -30],
        [-100.5, -200.7, -300.9],
        [-1, 1, -1],
        [1, -1, 1],
        [-1, -1, 1]
      ];
      
      for (const [x, y, z] of negativeCoords) {
        const value = noise.noise3D(x, y, z);
        
        // Should produce valid values in range
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
        expect(Number.isFinite(value)).toBe(true);
      }
      
      // Negative coordinates should produce deterministic results
      const noise2 = new NoiseEngine(12345);
      expect(noise2.noise3D(-10, -20, -30)).toBe(noise.noise3D(-10, -20, -30));
    });

    test('handles mixed positive and negative large coordinates', () => {
      const noise = new NoiseEngine(12345);
      
      const mixedCoords = [
        [1e6, -1e6, 1e6],
        [-1e8, 1e8, -1e8],
        [1e10, -1e10, 0],
        [-1e10, 1e10, 1e10]
      ];
      
      for (const [x, y, z] of mixedCoords) {
        const value = noise.noise3D(x, y, z);
        
        // Should produce valid values in range
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
        expect(Number.isFinite(value)).toBe(true);
      }
    });

    test('handles NaN inputs gracefully', () => {
      const noise = new NoiseEngine(12345);
      
      // Test all combinations of NaN
      expect(noise.noise3D(NaN, 0, 0)).toBe(0);
      expect(noise.noise3D(0, NaN, 0)).toBe(0);
      expect(noise.noise3D(0, 0, NaN)).toBe(0);
      expect(noise.noise3D(NaN, NaN, 0)).toBe(0);
      expect(noise.noise3D(NaN, 0, NaN)).toBe(0);
      expect(noise.noise3D(0, NaN, NaN)).toBe(0);
      expect(noise.noise3D(NaN, NaN, NaN)).toBe(0);
      
      // Mixed with valid coordinates
      expect(noise.noise3D(NaN, 10, 20)).toBe(0);
      expect(noise.noise3D(10, NaN, 20)).toBe(0);
      expect(noise.noise3D(10, 20, NaN)).toBe(0);
    });

    test('handles Infinity inputs gracefully', () => {
      const noise = new NoiseEngine(12345);
      
      // Test positive infinity
      expect(noise.noise3D(Infinity, 0, 0)).toBe(0);
      expect(noise.noise3D(0, Infinity, 0)).toBe(0);
      expect(noise.noise3D(0, 0, Infinity)).toBe(0);
      expect(noise.noise3D(Infinity, Infinity, Infinity)).toBe(0);
      
      // Test negative infinity
      expect(noise.noise3D(-Infinity, 0, 0)).toBe(0);
      expect(noise.noise3D(0, -Infinity, 0)).toBe(0);
      expect(noise.noise3D(0, 0, -Infinity)).toBe(0);
      expect(noise.noise3D(-Infinity, -Infinity, -Infinity)).toBe(0);
      
      // Mixed positive and negative infinity
      expect(noise.noise3D(Infinity, -Infinity, 0)).toBe(0);
      expect(noise.noise3D(-Infinity, Infinity, Infinity)).toBe(0);
      
      // Mixed with valid coordinates
      expect(noise.noise3D(Infinity, 10, 20)).toBe(0);
      expect(noise.noise3D(10, -Infinity, 20)).toBe(0);
      expect(noise.noise3D(10, 20, Infinity)).toBe(0);
    });

    test('handles mixed NaN and Infinity inputs', () => {
      const noise = new NoiseEngine(12345);
      
      expect(noise.noise3D(NaN, Infinity, 0)).toBe(0);
      expect(noise.noise3D(Infinity, NaN, 0)).toBe(0);
      expect(noise.noise3D(0, NaN, Infinity)).toBe(0);
      expect(noise.noise3D(NaN, Infinity, -Infinity)).toBe(0);
      expect(noise.noise3D(Infinity, NaN, Infinity)).toBe(0);
    });

    test('edge case coordinates produce deterministic results', () => {
      const noise1 = new NoiseEngine(42);
      const noise2 = new NoiseEngine(42);
      
      const edgeCases = [
        [0, 0, 0],
        [-1e6, -1e6, -1e6],
        [1e6, 1e6, 1e6],
        [-100, 100, -100],
        [0.0001, 0.0001, 0.0001]
      ];
      
      for (const [x, y, z] of edgeCases) {
        const value1 = noise1.noise3D(x, y, z);
        const value2 = noise2.noise3D(x, y, z);
        expect(value1).toBe(value2);
      }
    });
  });
});
