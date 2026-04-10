import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { ChunkManager, WorldConfig } from '../../src/world/chunk-manager';

describe('ChunkManager Property Tests', () => {
  // Generator for valid WorldConfig
  const worldConfigArb = fc.record({
    seed: fc.integer(),
    chunkSize: fc.integer({ min: 4, max: 64 }),
    terrainConfig: fc.record({
      baseScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
      octaves: fc.integer({ min: 1, max: 8 }),
      persistence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }),
      lacunarity: fc.float({ min: Math.fround(1.5), max: Math.fround(4.0), noNaN: true }),
      warpStrength: fc.float({ min: 0, max: 20, noNaN: true }),
      heightMultiplier: fc.float({ min: Math.fround(0.5), max: Math.fround(2.0), noNaN: true }),
    }),
    biomeConfig: fc.record({
      temperatureScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
      moistureScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
      blendRadius: fc.float({ min: 1, max: 10, noNaN: true }),
    }),
    resourceConfig: fc.record({
      types: fc.constant([]), // Empty for property tests
      clusterScale: fc.float({ min: Math.fround(10), max: Math.fround(50), noNaN: true }),
      densityThreshold: fc.float({ min: Math.fround(0.3), max: Math.fround(0.8), noNaN: true }),
    }),
    structureConfig: fc.record({
      types: fc.constant([]), // Empty for property tests
      minDistance: fc.float({ min: Math.fround(5), max: Math.fround(20), noNaN: true }),
      maxAttempts: fc.integer({ min: 10, max: 50 }),
    }),
    riverConfig: fc.record({
      sourceElevation: fc.float({ min: Math.fround(0.5), max: Math.fround(0.9), noNaN: true }),
      minFlowLength: fc.integer({ min: 3, max: 20 }),
      flowWidth: fc.integer({ min: 1, max: 3 }),
    }),
  });

  // Feature: procedural-world-engine, Property 4: Chunk Generation Determinism
  // **Validates: Requirements 2.3**
  test('generating the same chunk multiple times produces identical data', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        (config, chunkX, chunkY) => {
          const manager = new ChunkManager(config);
          
          const chunk1 = manager.generateChunk(chunkX, chunkY);
          const chunk2 = manager.generateChunk(chunkX, chunkY);
          
          // Verify coordinates match
          expect(chunk1.x).toBe(chunk2.x);
          expect(chunk1.y).toBe(chunk2.y);
          expect(chunk1.size).toBe(chunk2.size);
          
          // Verify heightmap is identical
          expect(chunk1.heightmap.length).toBe(chunk2.heightmap.length);
          for (let i = 0; i < chunk1.heightmap.length; i++) {
            expect(chunk1.heightmap[i]).toBe(chunk2.heightmap[i]);
          }
          
          // Verify biome map is identical
          expect(chunk1.biomeMap.length).toBe(chunk2.biomeMap.length);
          for (let i = 0; i < chunk1.biomeMap.length; i++) {
            expect(chunk1.biomeMap[i]).toBe(chunk2.biomeMap[i]);
          }
          
          // Verify biome weights are identical
          expect(chunk1.biomeWeights.length).toBe(chunk2.biomeWeights.length);
          for (let i = 0; i < chunk1.biomeWeights.length; i++) {
            expect(chunk1.biomeWeights[i]).toBe(chunk2.biomeWeights[i]);
          }
          
          // Verify resources are identical
          expect(chunk1.resources.length).toBe(chunk2.resources.length);
          
          // Verify structures are identical
          expect(chunk1.structures.length).toBe(chunk2.structures.length);
          
          // Verify rivers are identical
          expect(chunk1.rivers.size).toBe(chunk2.rivers.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: procedural-world-engine, Property 5: Chunk Independence
  // **Validates: Requirements 2.4**
  test('generating a chunk succeeds without requiring adjacent chunks', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -1000, max: 1000 }), // chunkX
        fc.integer({ min: -1000, max: 1000 }), // chunkY
        (config, chunkX, chunkY) => {
          const manager = new ChunkManager(config);
          
          // Should be able to generate any chunk without generating neighbors
          const chunk = manager.generateChunk(chunkX, chunkY);
          
          // Verify chunk was generated successfully
          expect(chunk).toBeDefined();
          expect(chunk.x).toBe(chunkX);
          expect(chunk.y).toBe(chunkY);
          expect(chunk.size).toBe(config.chunkSize);
          expect(chunk.heightmap.length).toBe(config.chunkSize * config.chunkSize);
          expect(chunk.biomeMap.length).toBe(config.chunkSize * config.chunkSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getChunk returns cached chunk on subsequent calls', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        (config, chunkX, chunkY) => {
          const manager = new ChunkManager(config);
          
          const chunk1 = manager.getChunk(chunkX, chunkY);
          const chunk2 = manager.getChunk(chunkX, chunkY);
          
          // Should return the same object reference (cached)
          expect(chunk1).toBe(chunk2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('clearCache removes all cached chunks', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        (config, chunkX, chunkY) => {
          const manager = new ChunkManager(config);
          
          const chunk1 = manager.getChunk(chunkX, chunkY);
          manager.clearCache();
          const chunk2 = manager.getChunk(chunkX, chunkY);
          
          // After clearing cache, should get a new object (not same reference)
          expect(chunk1).not.toBe(chunk2);
          
          // But data should still be identical (deterministic generation)
          expect(chunk1.x).toBe(chunk2.x);
          expect(chunk1.y).toBe(chunk2.y);
          for (let i = 0; i < chunk1.heightmap.length; i++) {
            expect(chunk1.heightmap[i]).toBe(chunk2.heightmap[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('chunk has correct size and array dimensions', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        (config, chunkX, chunkY) => {
          const manager = new ChunkManager(config);
          const chunk = manager.generateChunk(chunkX, chunkY);
          
          const expectedSize = config.chunkSize * config.chunkSize;
          
          expect(chunk.size).toBe(config.chunkSize);
          expect(chunk.heightmap.length).toBe(expectedSize);
          expect(chunk.biomeMap.length).toBe(expectedSize);
          expect(chunk.biomeWeights.length).toBe(expectedSize * 8); // 8 biome types
        }
      ),
      { numRuns: 100 }
    );
  });

  test('different chunk coordinates produce different chunks', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX1
        fc.integer({ min: -100, max: 100 }), // chunkY1
        fc.integer({ min: -100, max: 100 }), // chunkX2
        fc.integer({ min: -100, max: 100 }), // chunkY2
        (config, chunkX1, chunkY1, chunkX2, chunkY2) => {
          // Skip if coordinates are the same
          fc.pre(chunkX1 !== chunkX2 || chunkY1 !== chunkY2);
          
          // Skip degenerate cases where terrain would be too uniform
          // Need reasonable scale for variation
          fc.pre(config.terrainConfig.baseScale >= 0.005);
          // Need multiple octaves for variation
          fc.pre(config.terrainConfig.octaves >= 2);
          // Need reasonable chunk size to detect differences
          fc.pre(config.chunkSize >= 16);
          // Need reasonable height multiplier
          fc.pre(config.terrainConfig.heightMultiplier >= 0.5);
          
          const manager = new ChunkManager(config);
          
          const chunk1 = manager.generateChunk(chunkX1, chunkY1);
          const chunk2 = manager.generateChunk(chunkX2, chunkY2);
          
          // Coordinates should be different
          expect(chunk1.x !== chunk2.x || chunk1.y !== chunk2.y).toBe(true);
          
          // At least some heightmap values should be different
          let differenceCount = 0;
          for (let i = 0; i < chunk1.heightmap.length; i++) {
            if (chunk1.heightmap[i] !== chunk2.heightmap[i]) {
              differenceCount++;
            }
          }
          
          expect(differenceCount).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('all heightmap values are in valid range [0, 1]', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        (config, chunkX, chunkY) => {
          const manager = new ChunkManager(config);
          const chunk = manager.generateChunk(chunkX, chunkY);
          
          for (let i = 0; i < chunk.heightmap.length; i++) {
            expect(chunk.heightmap[i]).toBeGreaterThanOrEqual(0);
            expect(chunk.heightmap[i]).toBeLessThanOrEqual(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('all biome values are valid BiomeType enum values', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        (config, chunkX, chunkY) => {
          const manager = new ChunkManager(config);
          const chunk = manager.generateChunk(chunkX, chunkY);
          
          for (let i = 0; i < chunk.biomeMap.length; i++) {
            const biome = chunk.biomeMap[i];
            // BiomeType enum values are 0-7
            expect(biome).toBeGreaterThanOrEqual(0);
            expect(biome).toBeLessThanOrEqual(7);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('biome weights sum to approximately 1.0 for each tile', () => {
    fc.assert(
      fc.property(
        worldConfigArb,
        fc.integer({ min: -100, max: 100 }), // chunkX
        fc.integer({ min: -100, max: 100 }), // chunkY
        (config, chunkX, chunkY) => {
          const manager = new ChunkManager(config);
          const chunk = manager.generateChunk(chunkX, chunkY);
          
          const numBiomes = 8;
          const numTiles = config.chunkSize * config.chunkSize;
          
          for (let tile = 0; tile < numTiles; tile++) {
            let sum = 0;
            const offset = tile * numBiomes;
            
            for (let b = 0; b < numBiomes; b++) {
              sum += chunk.biomeWeights[offset + b];
            }
            
            // Allow small floating point error
            expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('LRU cache evicts old entries when full', () => {
    fc.assert(
      fc.property(
        fc.integer(), // seed
        fc.integer({ min: 4, max: 32 }), // chunkSize
        (seed, chunkSize) => {
          const config: WorldConfig = {
            seed,
            chunkSize,
            maxCacheSize: 3, // Small cache for testing
            terrainConfig: {
              baseScale: 0.01,
              octaves: 4,
              persistence: 0.5,
              lacunarity: 2.0,
              warpStrength: 10,
              heightMultiplier: 1.0,
            },
            biomeConfig: {
              temperatureScale: 0.01,
              moistureScale: 0.01,
              blendRadius: 2,
            },
            resourceConfig: {
              types: [],
              clusterScale: 20,
              densityThreshold: 0.6,
            },
            structureConfig: {
              types: [],
              minDistance: 10,
              maxAttempts: 30,
            },
            riverConfig: {
              sourceElevation: 0.7,
              minFlowLength: 10,
              flowWidth: 1,
            },
          };
          
          const manager = new ChunkManager(config);
          
          // Fill cache
          const chunk1 = manager.getChunk(0, 0);
          const chunk2 = manager.getChunk(1, 0);
          const chunk3 = manager.getChunk(2, 0);
          
          // Access chunk1 and chunk2 again to make them more recently used
          manager.getChunk(0, 0);
          manager.getChunk(1, 0);
          
          // Add a new chunk, should evict chunk3 (least recently used)
          manager.getChunk(3, 0);
          
          // chunk1 and chunk2 should still be cached (same reference)
          expect(manager.getChunk(0, 0)).toBe(chunk1);
          expect(manager.getChunk(1, 0)).toBe(chunk2);
          
          // chunk3 should have been evicted (new reference)
          expect(manager.getChunk(2, 0)).not.toBe(chunk3);
        }
      ),
      { numRuns: 50 }
    );
  });
});
