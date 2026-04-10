import { describe, test, expect } from 'vitest';
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
});
