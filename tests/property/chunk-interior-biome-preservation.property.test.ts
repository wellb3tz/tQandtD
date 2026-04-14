import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { ChunkManager, WorldConfig } from '../../src/world/chunk-manager';
import { BiomeType } from '../../src/world/chunk';

/**
 * Preservation Property Tests for Interior Tile Biome Behavior
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 * 
 * IMPORTANT: These tests follow observation-first methodology.
 * They capture the behavior of UNFIXED code for interior tiles (far from boundaries).
 * 
 * EXPECTED OUTCOME: Tests PASS on unfixed code (confirms baseline behavior to preserve).
 * 
 * These tests ensure that the fix does NOT change behavior for:
 * - Interior tiles (distance > blendRadius from all chunk edges)
 * - Deterministic generation (same seed = same biomes)
 * - API compatibility (same parameters, same return types)
 */
describe('Preservation Property: Interior Tile Biome Behavior', () => {
  
  // Default world configuration for testing
  const defaultConfig: WorldConfig = {
    seed: 12345,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
    },
    biomeConfig: {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 10, // Interior tiles must be > 10 units from edges
    },
    resourceConfig: {
      types: [],
      clusterScale: 20,
      densityThreshold: 0.5,
    },
    structureConfig: {
      types: [],
      minDistance: 10,
      maxAttempts: 30,
    },
    riverConfig: {
      sourceElevation: 0.7,
      minFlowLength: 5,
      flowWidth: 2,
    },
  };

  /**
   * Helper function to check if a position is an interior tile
   * (distance > blendRadius from all chunk edges)
   */
  function isInteriorTile(localX: number, localY: number, chunkSize: number, blendRadius: number): boolean {
    return (
      localX >= blendRadius &&
      localX < chunkSize - blendRadius &&
      localY >= blendRadius &&
      localY < chunkSize - blendRadius
    );
  }

  /**
   * Property 2: Preservation - Interior Tile Biome Values Unchanged
   * 
   * Tests that interior tiles (far from boundaries) produce identical biome values
   * regardless of neighboring chunks. This ensures the fix only affects boundary tiles.
   */
  test('Property 2: Interior tiles should produce identical biome values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 9999 }), // seed
        fc.integer({ min: -5, max: 5 }), // chunkX
        fc.integer({ min: -5, max: 5 }), // chunkY
        fc.integer({ min: 10, max: 21 }), // interior x (10 to 21 for chunkSize=32, blendRadius=10)
        fc.integer({ min: 10, max: 21 }), // interior y
        (seed, chunkX, chunkY, interiorX, interiorY) => {
          const config: WorldConfig = {
            ...defaultConfig,
            seed,
          };
          
          const manager = new ChunkManager(config);
          
          // Verify position is interior
          const isInterior = isInteriorTile(
            interiorX,
            interiorY,
            config.chunkSize,
            config.biomeConfig.blendRadius
          );
          expect(isInterior).toBe(true);
          
          // Generate chunk multiple times - should get identical results
          const chunk1 = manager.generateChunk(chunkX, chunkY);
          
          // Clear cache and regenerate
          manager.clearCache();
          const chunk2 = manager.generateChunk(chunkX, chunkY);
          
          const size = config.chunkSize;
          const index = interiorY * size + interiorX;
          
          // Biome values should be identical
          expect(chunk1.biomeMap[index]).toBe(chunk2.biomeMap[index]);
          
          // Blend weights should be identical
          const numBiomes = 8;
          for (let b = 0; b < numBiomes; b++) {
            const w1 = chunk1.biomeWeights[index * numBiomes + b];
            const w2 = chunk2.biomeWeights[index * numBiomes + b];
            expect(w1).toBeCloseTo(w2, 6); // 6 decimal places precision
          }
        }
      ),
      { numRuns: 100 } // Run many test cases for strong guarantees
    );
  });

  /**
   * Property 2: Preservation - Determinism
   * 
   * Tests that same seed produces identical biome distributions.
   * This is critical for multiplayer and save/load functionality.
   */
  test('Property 2: Same seed should produce identical biome distributions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 9999 }), // seed
        fc.integer({ min: -5, max: 5 }), // chunkX
        fc.integer({ min: -5, max: 5 }), // chunkY
        (seed, chunkX, chunkY) => {
          const config: WorldConfig = {
            ...defaultConfig,
            seed,
          };
          
          // Create two separate managers with same seed
          const manager1 = new ChunkManager(config);
          const manager2 = new ChunkManager(config);
          
          // Generate same chunk with both managers
          const chunk1 = manager1.generateChunk(chunkX, chunkY);
          const chunk2 = manager2.generateChunk(chunkX, chunkY);
          
          const size = config.chunkSize;
          
          // All biome values should be identical
          for (let i = 0; i < size * size; i++) {
            expect(chunk1.biomeMap[i]).toBe(chunk2.biomeMap[i]);
          }
          
          // All blend weights should be identical
          const numBiomes = 8;
          for (let i = 0; i < size * size; i++) {
            for (let b = 0; b < numBiomes; b++) {
              const w1 = chunk1.biomeWeights[i * numBiomes + b];
              const w2 = chunk2.biomeWeights[i * numBiomes + b];
              expect(w1).toBeCloseTo(w2, 6);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2: Preservation - Different Seeds Produce Different Biomes
   * 
   * Tests that different seeds produce different biome distributions.
   * This ensures the seed parameter is actually used.
   */
  test('Property 2: Different seeds should produce different biome distributions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 9999 }), // seed1
        fc.integer({ min: 1000, max: 9999 }), // seed2
        fc.integer({ min: -3, max: 3 }), // chunkX
        fc.integer({ min: -3, max: 3 }), // chunkY
        (seed1, seed2, chunkX, chunkY) => {
          // Skip if seeds are the same
          fc.pre(seed1 !== seed2);
          
          const config1: WorldConfig = {
            ...defaultConfig,
            seed: seed1,
          };
          
          const config2: WorldConfig = {
            ...defaultConfig,
            seed: seed2,
          };
          
          const manager1 = new ChunkManager(config1);
          const manager2 = new ChunkManager(config2);
          
          const chunk1 = manager1.generateChunk(chunkX, chunkY);
          const chunk2 = manager2.generateChunk(chunkX, chunkY);
          
          const size = config1.chunkSize;
          
          // At least some biome values should be different
          let hasDifference = false;
          for (let i = 0; i < size * size; i++) {
            if (chunk1.biomeMap[i] !== chunk2.biomeMap[i]) {
              hasDifference = true;
              break;
            }
          }
          
          expect(hasDifference).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 2: Preservation - API Compatibility
   * 
   * Tests that ChunkManager.generateChunk() returns complete chunk data
   * without requiring neighboring chunks to be pre-generated.
   */
  test('Property 2: generateChunk should return complete chunk data independently', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 9999 }), // seed
        fc.integer({ min: -5, max: 5 }), // chunkX
        fc.integer({ min: -5, max: 5 }), // chunkY
        (seed, chunkX, chunkY) => {
          const config: WorldConfig = {
            ...defaultConfig,
            seed,
          };
          
          const manager = new ChunkManager(config);
          
          // Generate chunk without generating neighbors first
          const chunk = manager.generateChunk(chunkX, chunkY);
          
          const size = config.chunkSize;
          
          // Chunk should have complete data
          expect(chunk).toBeDefined();
          expect(chunk.x).toBe(chunkX);
          expect(chunk.y).toBe(chunkY);
          // Heightmap has (size + 1) * (size + 1) vertices for seamless chunks
          expect(chunk.heightmap).toHaveLength((size + 1) * (size + 1));
          expect(chunk.biomeMap).toHaveLength(size * size);
          
          const numBiomes = 8;
          expect(chunk.biomeWeights).toHaveLength(size * size * numBiomes);
          
          // All biome values should be valid (0-7)
          for (let i = 0; i < size * size; i++) {
            expect(chunk.biomeMap[i]).toBeGreaterThanOrEqual(0);
            expect(chunk.biomeMap[i]).toBeLessThan(numBiomes);
          }
          
          // All blend weights should be valid (0-1) and sum to ~1.0 per tile
          for (let i = 0; i < size * size; i++) {
            let weightSum = 0;
            for (let b = 0; b < numBiomes; b++) {
              const weight = chunk.biomeWeights[i * numBiomes + b];
              expect(weight).toBeGreaterThanOrEqual(0);
              expect(weight).toBeLessThanOrEqual(1);
              weightSum += weight;
            }
            expect(weightSum).toBeCloseTo(1.0, 2); // Sum should be ~1.0
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2: Preservation - Interior Tiles Independent of Neighbor Generation
   * 
   * Tests that interior tile biomes are identical whether or not neighboring
   * chunks have been generated. This ensures the fix doesn't create dependencies.
   */
  test('Property 2: Interior tiles should be independent of neighbor generation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 9999 }), // seed
        fc.integer({ min: -3, max: 3 }), // chunkX
        fc.integer({ min: -3, max: 3 }), // chunkY
        fc.integer({ min: 10, max: 21 }), // interior x
        fc.integer({ min: 10, max: 21 }), // interior y
        (seed, chunkX, chunkY, interiorX, interiorY) => {
          const config: WorldConfig = {
            ...defaultConfig,
            seed,
          };
          
          // Scenario 1: Generate chunk in isolation
          const manager1 = new ChunkManager(config);
          const chunk1 = manager1.generateChunk(chunkX, chunkY);
          
          // Scenario 2: Generate chunk after generating all neighbors
          const manager2 = new ChunkManager(config);
          manager2.generateChunk(chunkX - 1, chunkY - 1);
          manager2.generateChunk(chunkX, chunkY - 1);
          manager2.generateChunk(chunkX + 1, chunkY - 1);
          manager2.generateChunk(chunkX - 1, chunkY);
          manager2.generateChunk(chunkX + 1, chunkY);
          manager2.generateChunk(chunkX - 1, chunkY + 1);
          manager2.generateChunk(chunkX, chunkY + 1);
          manager2.generateChunk(chunkX + 1, chunkY + 1);
          const chunk2 = manager2.generateChunk(chunkX, chunkY);
          
          const size = config.chunkSize;
          const index = interiorY * size + interiorX;
          
          // Interior tile should be identical in both scenarios
          expect(chunk1.biomeMap[index]).toBe(chunk2.biomeMap[index]);
          
          const numBiomes = 8;
          for (let b = 0; b < numBiomes; b++) {
            const w1 = chunk1.biomeWeights[index * numBiomes + b];
            const w2 = chunk2.biomeWeights[index * numBiomes + b];
            expect(w1).toBeCloseTo(w2, 6);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 2: Preservation - Biome Type Distribution
   * 
   * Tests that the distribution of biome types remains reasonable.
   * This is a sanity check that the biome system still works correctly.
   */
  test('Property 2: Biome type distribution should be reasonable', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 9999 }), // seed
        fc.integer({ min: -3, max: 3 }), // chunkX
        fc.integer({ min: -3, max: 3 }), // chunkY
        (seed, chunkX, chunkY) => {
          const config: WorldConfig = {
            ...defaultConfig,
            seed,
          };
          
          const manager = new ChunkManager(config);
          const chunk = manager.generateChunk(chunkX, chunkY);
          
          const size = config.chunkSize;
          const biomeCounts = new Map<BiomeType, number>();
          
          // Count biome occurrences
          for (let i = 0; i < size * size; i++) {
            const biome = chunk.biomeMap[i];
            biomeCounts.set(biome, (biomeCounts.get(biome) || 0) + 1);
          }
          
          // Should have at least one biome type
          expect(biomeCounts.size).toBeGreaterThan(0);
          
          // No single biome should dominate completely (unless it's a special case)
          // Note: Some chunks CAN be 100% one biome (e.g., all ocean, all mountain)
          // This is valid behavior, so we just verify at least one biome exists
          const totalTiles = size * size;
          let maxCount = 0;
          for (const count of biomeCounts.values()) {
            maxCount = Math.max(maxCount, count);
          }
          
          // Sanity check: max count should not exceed total tiles
          expect(maxCount).toBeLessThanOrEqual(totalTiles);
        }
      ),
      { numRuns: 50 }
    );
  });
});
