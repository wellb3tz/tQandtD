import { describe, test, expect } from 'vitest';
import { TerrainGenerator } from './terrain';

describe('TerrainGenerator.getHeightAt()', () => {
  test('produces same height as generateHeightmap() for same position', () => {
    const config = {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 30,
      heightMultiplier: 1.0,
    };
    const generator = new TerrainGenerator(config);
    const seed = 12345;
    const chunkSize = 32;
    const chunkX = 0;
    const chunkY = 0;

    // Generate heightmap for chunk
    const heightmap = generator.generateHeightmap(seed, chunkSize, chunkX, chunkY);

    // Sample several positions and verify they match
    for (let y = 0; y <= chunkSize; y += 8) {
      for (let x = 0; x <= chunkSize; x += 8) {
        const worldX = chunkX * chunkSize + x;
        const worldY = chunkY * chunkSize + y;
        const vertexCount = chunkSize + 1;
        const heightmapValue = heightmap[y * vertexCount + x];
        const sampledValue = generator.getHeightAt(worldX, worldY, seed);
        
        expect(sampledValue).toBeCloseTo(heightmapValue, 6);
      }
    }
  });

  test('is deterministic - same position and seed returns same height', () => {
    const config = {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 30,
      heightMultiplier: 1.0,
    };
    const generator = new TerrainGenerator(config);
    const seed = 54321;
    const worldX = 100;
    const worldY = 200;

    const height1 = generator.getHeightAt(worldX, worldY, seed);
    const height2 = generator.getHeightAt(worldX, worldY, seed);
    const height3 = generator.getHeightAt(worldX, worldY, seed);

    expect(height1).toBe(height2);
    expect(height2).toBe(height3);
  });

  test('returns values in [0, 1] range', () => {
    const config = {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 30,
      heightMultiplier: 1.0,
    };
    const generator = new TerrainGenerator(config);
    const seed = 99999;

    // Test multiple positions
    for (let i = 0; i < 100; i++) {
      const worldX = Math.floor(Math.random() * 1000);
      const worldY = Math.floor(Math.random() * 1000);
      const height = generator.getHeightAt(worldX, worldY, seed);

      expect(height).toBeGreaterThanOrEqual(0);
      expect(height).toBeLessThanOrEqual(1);
    }
  });

  test('works across chunk boundaries', () => {
    const config = {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 30,
      heightMultiplier: 1.0,
    };
    const generator = new TerrainGenerator(config);
    const seed = 11111;
    const chunkSize = 32;

    // Generate two adjacent chunks
    const chunk0 = generator.generateHeightmap(seed, chunkSize, 0, 0);
    const chunk1 = generator.generateHeightmap(seed, chunkSize, 1, 0);

    // Verify boundary consistency
    // Right edge of chunk 0 should match left edge of chunk 1
    const vertexCount = chunkSize + 1;
    for (let y = 0; y <= chunkSize; y++) {
      const worldX = chunkSize; // Boundary position
      const worldY = y;
      
      // Sample from chunk 0's right edge (x = chunkSize)
      const chunk0Height = chunk0[y * vertexCount + chunkSize];
      
      // Sample from chunk 1's left edge (x = 0)
      const chunk1Height = chunk1[y * vertexCount + 0];
      
      // Sample using getHeightAt
      const sampledHeight = generator.getHeightAt(worldX, worldY, seed);
      
      // All three should match
      expect(sampledHeight).toBeCloseTo(chunk0Height, 6);
      expect(sampledHeight).toBeCloseTo(chunk1Height, 6);
    }
  });

  test('handles 3D noise when enabled', () => {
    const config = {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 30,
      heightMultiplier: 1.0,
      enable3D: true,
      zScale: 0.5,
    };
    const generator = new TerrainGenerator(config);
    const seed = 77777;
    const chunkSize = 32;

    // Generate heightmap with 3D noise
    const heightmap = generator.generateHeightmap(seed, chunkSize, 0, 0);

    // Verify getHeightAt matches
    const worldX = 10;
    const worldY = 15;
    const vertexCount = chunkSize + 1;
    const heightmapValue = heightmap[worldY * vertexCount + worldX];
    const sampledValue = generator.getHeightAt(worldX, worldY, seed);

    expect(sampledValue).toBeCloseTo(heightmapValue, 6);
  });
});
