import { describe, test, expect } from 'vitest';
import { TerrainGenerator, TerrainConfig } from '../../../src/gen/terrain';

describe('TerrainGenerator', () => {
  const defaultConfig: TerrainConfig = {
    baseScale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 10,
    heightMultiplier: 1.0,
  };

  describe('constructor', () => {
    test('accepts valid terrain config', () => {
      expect(() => new TerrainGenerator(defaultConfig)).not.toThrow();
    });
  });

  describe('generateHeightmap', () => {
    // Requirements 3.3: Test heightmap size correctness
    test('generates heightmap with correct size', () => {
      const generator = new TerrainGenerator(defaultConfig);
      const chunkSize = 32;
      
      const heightmap = generator.generateHeightmap(12345, chunkSize);
      
      expect(heightmap).toBeInstanceOf(Float32Array);
      // After seamless chunk boundaries fix: heightmap has (chunkSize + 1) x (chunkSize + 1) vertices
      expect(heightmap.length).toBe((chunkSize + 1) * (chunkSize + 1));
    });

    test('generates heightmap for different chunk sizes', () => {
      const generator = new TerrainGenerator(defaultConfig);
      
      const sizes = [8, 16, 32, 64];
      for (const size of sizes) {
        const heightmap = generator.generateHeightmap(12345, size);
        // After seamless chunk boundaries fix: heightmap has (size + 1) x (size + 1) vertices
        expect(heightmap.length).toBe((size + 1) * (size + 1));
      }
    });

    // Requirements 3.3: Test height values are in [0, 1] range
    test('generates height values in [0, 1] range', () => {
      const generator = new TerrainGenerator(defaultConfig);
      const heightmap = generator.generateHeightmap(12345, 32);
      
      for (let i = 0; i < heightmap.length; i++) {
        expect(heightmap[i]).toBeGreaterThanOrEqual(0);
        expect(heightmap[i]).toBeLessThanOrEqual(1);
      }
    });

    // Requirements 3.4: Test terrain generation determinism
    test('generates identical heightmaps for same seed', () => {
      const generator = new TerrainGenerator(defaultConfig);
      const seed = 42;
      const chunkSize = 16;
      
      const heightmap1 = generator.generateHeightmap(seed, chunkSize);
      const heightmap2 = generator.generateHeightmap(seed, chunkSize);
      
      expect(heightmap1.length).toBe(heightmap2.length);
      for (let i = 0; i < heightmap1.length; i++) {
        expect(heightmap1[i]).toBe(heightmap2[i]);
      }
    });

    test('generates different heightmaps for different seeds', () => {
      const generator = new TerrainGenerator(defaultConfig);
      const chunkSize = 16;
      
      const heightmap1 = generator.generateHeightmap(42, chunkSize);
      const heightmap2 = generator.generateHeightmap(43, chunkSize);
      
      // At least some values should be different
      let differenceCount = 0;
      for (let i = 0; i < heightmap1.length; i++) {
        if (heightmap1[i] !== heightmap2[i]) {
          differenceCount++;
        }
      }
      
      expect(differenceCount).toBeGreaterThan(0);
    });

    // Requirements 3.5: Test different configs produce different terrain
    test('different configs produce different heightmaps', () => {
      const config1: TerrainConfig = { ...defaultConfig, octaves: 2 };
      const config2: TerrainConfig = { ...defaultConfig, octaves: 6 };
      
      const generator1 = new TerrainGenerator(config1);
      const generator2 = new TerrainGenerator(config2);
      
      const heightmap1 = generator1.generateHeightmap(12345, 16);
      const heightmap2 = generator2.generateHeightmap(12345, 16);
      
      // At least some values should be different
      let differenceCount = 0;
      for (let i = 0; i < heightmap1.length; i++) {
        if (heightmap1[i] !== heightmap2[i]) {
          differenceCount++;
        }
      }
      
      expect(differenceCount).toBeGreaterThan(0);
    });

    test('heightMultiplier affects height values', () => {
      const config1: TerrainConfig = { ...defaultConfig, heightMultiplier: 0.5 };
      const config2: TerrainConfig = { ...defaultConfig, heightMultiplier: 1.0 };
      
      const generator1 = new TerrainGenerator(config1);
      const generator2 = new TerrainGenerator(config2);
      
      const heightmap1 = generator1.generateHeightmap(12345, 16);
      const heightmap2 = generator2.generateHeightmap(12345, 16);
      
      // With lower multiplier, average height should be lower
      const avg1 = heightmap1.reduce((sum, h) => sum + h, 0) / heightmap1.length;
      const avg2 = heightmap2.reduce((sum, h) => sum + h, 0) / heightmap2.length;
      
      expect(avg1).toBeLessThan(avg2);
    });
  });

  describe('getHeight', () => {
    test('returns height value in [0, 1] range', () => {
      const generator = new TerrainGenerator(defaultConfig);
      
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const height = generator.getHeight(x, y, 12345);
        
        expect(height).toBeGreaterThanOrEqual(0);
        expect(height).toBeLessThanOrEqual(1);
      }
    });

    test('returns identical height for same position and seed', () => {
      const generator = new TerrainGenerator(defaultConfig);
      const x = 10, y = 20, seed = 42;
      
      const height1 = generator.getHeight(x, y, seed);
      const height2 = generator.getHeight(x, y, seed);
      
      expect(height1).toBe(height2);
    });

    test('returns different heights for different positions', () => {
      const generator = new TerrainGenerator(defaultConfig);
      const seed = 12345;
      
      const height1 = generator.getHeight(0, 0, seed);
      const height2 = generator.getHeight(10, 10, seed);
      const height3 = generator.getHeight(50, 50, seed);
      
      // At least some should be different
      expect(
        height1 !== height2 || height2 !== height3 || height1 !== height3
      ).toBe(true);
    });

    test('returns different heights for different seeds', () => {
      const generator = new TerrainGenerator(defaultConfig);
      const x = 10, y = 20;
      
      const height1 = generator.getHeight(x, y, 42);
      const height2 = generator.getHeight(x, y, 43);
      
      expect(height1).not.toBe(height2);
    });

    test('matches heightmap values for chunk positions', () => {
      const generator = new TerrainGenerator(defaultConfig);
      const seed = 12345;
      const chunkSize = 16;
      const chunkX = 0;
      const chunkY = 0;
      
      const heightmap = generator.generateHeightmap(seed, chunkSize, chunkX, chunkY);
      
      // After seamless chunk boundaries fix: heightmap has (chunkSize + 1) x (chunkSize + 1) vertices
      const stride = chunkSize + 1;
      
      // Check a few positions
      for (let y = 0; y < chunkSize; y += 5) {
        for (let x = 0; x < chunkSize; x += 5) {
          const index = y * stride + x;
          const heightFromMap = heightmap[index];
          // getHeight expects world coordinates
          const worldX = chunkX * chunkSize + x;
          const worldY = chunkY * chunkSize + y;
          const heightFromGet = generator.getHeight(worldX, worldY, seed);
          
          // Use toBeCloseTo to account for floating-point precision differences
          expect(heightFromGet).toBeCloseTo(heightFromMap, 5);
        }
      }
    });
  });

  describe('domain warping and fBM integration', () => {
    test('warpStrength affects terrain generation', () => {
      const config1: TerrainConfig = { ...defaultConfig, warpStrength: 0 };
      const config2: TerrainConfig = { ...defaultConfig, warpStrength: 20 };
      
      const generator1 = new TerrainGenerator(config1);
      const generator2 = new TerrainGenerator(config2);
      
      const heightmap1 = generator1.generateHeightmap(12345, 16);
      const heightmap2 = generator2.generateHeightmap(12345, 16);
      
      // Different warp strengths should produce different terrain
      let differenceCount = 0;
      for (let i = 0; i < heightmap1.length; i++) {
        if (heightmap1[i] !== heightmap2[i]) {
          differenceCount++;
        }
      }
      
      expect(differenceCount).toBeGreaterThan(0);
    });

    test('baseScale affects terrain frequency', () => {
      const config1: TerrainConfig = { ...defaultConfig, baseScale: 0.005 };
      const config2: TerrainConfig = { ...defaultConfig, baseScale: 0.02 };
      
      const generator1 = new TerrainGenerator(config1);
      const generator2 = new TerrainGenerator(config2);
      
      const heightmap1 = generator1.generateHeightmap(12345, 16);
      const heightmap2 = generator2.generateHeightmap(12345, 16);
      
      // Different scales should produce different terrain
      let differenceCount = 0;
      for (let i = 0; i < heightmap1.length; i++) {
        if (heightmap1[i] !== heightmap2[i]) {
          differenceCount++;
        }
      }
      
      expect(differenceCount).toBeGreaterThan(0);
    });
  });
});

