import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { ChunkManager, WorldConfig } from '../../src/world/chunk-manager';
import { BiomeType } from '../../src/world/chunk';

/**
 * Bug Condition Exploration Test for Chunk Boundary Biome Discontinuity
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 * 
 * This test encodes the expected behavior (seamless boundaries) and will validate
 * the fix when it passes after implementation.
 * 
 * GOAL: Surface counterexamples that demonstrate visible seams at chunk boundaries.
 */
describe.skip('Bug Condition Exploration: Chunk Boundary Biome Discontinuity', () => {
  
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
      blendRadius: 10, // This is key - blend radius extends beyond chunk boundaries
    },
    resourceConfig: {
      types: [], // Empty for this test
      clusterScale: 20,
      densityThreshold: 0.5,
    },
    structureConfig: {
      types: [], // Empty for this test
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
   * Property 1: Bug Condition - Chunk Boundary Biome Discontinuity
   * 
   * Tests that biome values and blend weights are continuous across chunk boundaries.
   * This test is SCOPED to positions near chunk boundaries (within blendRadius distance).
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS with counterexamples showing:
   * - Different biome values at shared boundary positions
   * - Discontinuous blend weights across boundaries
   * - Visible seams in biome transitions
   */
  test('Property 1: Biome values should be continuous across horizontal chunk boundaries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 9999 }), // seed
        fc.integer({ min: -5, max: 5 }), // chunkX for first chunk
        fc.integer({ min: -5, max: 5 }), // chunkY
        fc.integer({ min: 0, max: 31 }), // y position along boundary
        (seed, chunkX, chunkY, boundaryY) => {
          const config: WorldConfig = {
            ...defaultConfig,
            seed,
          };
          
          const manager = new ChunkManager(config);
          
          // Generate two horizontally adjacent chunks
          const chunk1 = manager.generateChunk(chunkX, chunkY);
          const chunk2 = manager.generateChunk(chunkX + 1, chunkY);
          
          // Check boundary positions (right edge of chunk1, left edge of chunk2)
          // These positions share the same world coordinates
          const size = config.chunkSize;
          
          // Right edge of chunk1 (local x = 31)
          const index1 = boundaryY * size + (size - 1);
          const biome1 = chunk1.biomeMap[index1];
          
          // Left edge of chunk2 (local x = 0)
          const index2 = boundaryY * size + 0;
          const biome2 = chunk2.biomeMap[index2];
          
          // Get blend weights for both positions
          const numBiomes = 8;
          const weights1 = new Map<BiomeType, number>();
          const weights2 = new Map<BiomeType, number>();
          
          for (let b = 0; b < numBiomes; b++) {
            const w1 = chunk1.biomeWeights[index1 * numBiomes + b];
            const w2 = chunk2.biomeWeights[index2 * numBiomes + b];
            if (w1 > 0) weights1.set(b, w1);
            if (w2 > 0) weights2.set(b, w2);
          }
          
          // EXPECTED BEHAVIOR: Biomes should be identical or blend weights should be very similar
          // At chunk boundaries, the biome sampling should use world coordinates consistently
          
          // Check if biomes match
          const biomesMatch = biome1 === biome2;
          
          // Check if blend weights are continuous (similar within tolerance)
          let weightsContinuous = true;
          const tolerance = 0.15; // Allow 15% difference for smooth transitions
          
          // Check all biome types
          for (let b = 0; b < numBiomes; b++) {
            const w1 = weights1.get(b) || 0;
            const w2 = weights2.get(b) || 0;
            const diff = Math.abs(w1 - w2);
            
            if (diff > tolerance) {
              weightsContinuous = false;
              break;
            }
          }
          
          // The boundary should be seamless: either biomes match OR weights transition smoothly
          const isSeamless = biomesMatch || weightsContinuous;
          
          // CRITICAL: On unfixed code, this assertion will FAIL
          // This proves the bug exists and provides counterexamples
          expect(isSeamless).toBe(true);
          
          // If assertion fails, log the counterexample for debugging
          if (!isSeamless) {
            console.log('COUNTEREXAMPLE FOUND:');
            console.log(`  Seed: ${seed}`);
            console.log(`  Chunks: (${chunkX}, ${chunkY}) and (${chunkX + 1}, ${chunkY})`);
            console.log(`  Boundary Y: ${boundaryY}`);
            console.log(`  Biome1: ${biome1}, Biome2: ${biome2}`);
            console.log(`  Weights1:`, Array.from(weights1.entries()));
            console.log(`  Weights2:`, Array.from(weights2.entries()));
          }
        }
      ),
      { numRuns: 50 } // Run 50 test cases to find counterexamples
    );
  });

  test('Property 1: Biome values should be continuous across vertical chunk boundaries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 9999 }), // seed
        fc.integer({ min: -5, max: 5 }), // chunkX
        fc.integer({ min: -5, max: 5 }), // chunkY for first chunk
        fc.integer({ min: 0, max: 31 }), // x position along boundary
        (seed, chunkX, chunkY, boundaryX) => {
          const config: WorldConfig = {
            ...defaultConfig,
            seed,
          };
          
          const manager = new ChunkManager(config);
          
          // Generate two vertically adjacent chunks
          const chunk1 = manager.generateChunk(chunkX, chunkY);
          const chunk2 = manager.generateChunk(chunkX, chunkY + 1);
          
          // Check boundary positions (bottom edge of chunk1, top edge of chunk2)
          const size = config.chunkSize;
          
          // Bottom edge of chunk1 (local y = 31)
          const index1 = (size - 1) * size + boundaryX;
          const biome1 = chunk1.biomeMap[index1];
          
          // Top edge of chunk2 (local y = 0)
          const index2 = 0 * size + boundaryX;
          const biome2 = chunk2.biomeMap[index2];
          
          // Get blend weights
          const numBiomes = 8;
          const weights1 = new Map<BiomeType, number>();
          const weights2 = new Map<BiomeType, number>();
          
          for (let b = 0; b < numBiomes; b++) {
            const w1 = chunk1.biomeWeights[index1 * numBiomes + b];
            const w2 = chunk2.biomeWeights[index2 * numBiomes + b];
            if (w1 > 0) weights1.set(b, w1);
            if (w2 > 0) weights2.set(b, w2);
          }
          
          // Check continuity
          const biomesMatch = biome1 === biome2;
          
          let weightsContinuous = true;
          const tolerance = 0.15;
          
          for (let b = 0; b < numBiomes; b++) {
            const w1 = weights1.get(b) || 0;
            const w2 = weights2.get(b) || 0;
            const diff = Math.abs(w1 - w2);
            
            if (diff > tolerance) {
              weightsContinuous = false;
              break;
            }
          }
          
          const isSeamless = biomesMatch || weightsContinuous;
          
          expect(isSeamless).toBe(true);
          
          if (!isSeamless) {
            console.log('COUNTEREXAMPLE FOUND:');
            console.log(`  Seed: ${seed}`);
            console.log(`  Chunks: (${chunkX}, ${chunkY}) and (${chunkX}, ${chunkY + 1})`);
            console.log(`  Boundary X: ${boundaryX}`);
            console.log(`  Biome1: ${biome1}, Biome2: ${biome2}`);
            console.log(`  Weights1:`, Array.from(weights1.entries()));
            console.log(`  Weights2:`, Array.from(weights2.entries()));
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 1: Biome blend weights should be continuous at corner boundaries', () => {
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
          
          // Generate 4 chunks meeting at a corner
          const chunk00 = manager.generateChunk(chunkX, chunkY);
          const chunk10 = manager.generateChunk(chunkX + 1, chunkY);
          const chunk01 = manager.generateChunk(chunkX, chunkY + 1);
          const chunk11 = manager.generateChunk(chunkX + 1, chunkY + 1);
          
          const size = config.chunkSize;
          
          // Get corner positions (bottom-right, bottom-left, top-right, top-left)
          const index00 = (size - 1) * size + (size - 1); // bottom-right of chunk00
          const index10 = (size - 1) * size + 0;          // bottom-left of chunk10
          const index01 = 0 * size + (size - 1);          // top-right of chunk01
          const index11 = 0 * size + 0;                   // top-left of chunk11
          
          const biome00 = chunk00.biomeMap[index00];
          const biome10 = chunk10.biomeMap[index10];
          const biome01 = chunk01.biomeMap[index01];
          const biome11 = chunk11.biomeMap[index11];
          
          // Get blend weights for all 4 corners
          const numBiomes = 8;
          const weights00 = new Map<BiomeType, number>();
          const weights10 = new Map<BiomeType, number>();
          const weights01 = new Map<BiomeType, number>();
          const weights11 = new Map<BiomeType, number>();
          
          for (let b = 0; b < numBiomes; b++) {
            const w00 = chunk00.biomeWeights[index00 * numBiomes + b];
            const w10 = chunk10.biomeWeights[index10 * numBiomes + b];
            const w01 = chunk01.biomeWeights[index01 * numBiomes + b];
            const w11 = chunk11.biomeWeights[index11 * numBiomes + b];
            
            if (w00 > 0) weights00.set(b, w00);
            if (w10 > 0) weights10.set(b, w10);
            if (w01 > 0) weights01.set(b, w01);
            if (w11 > 0) weights11.set(b, w11);
          }
          
          // Check if all corners have similar biomes or blend weights
          const tolerance = 0.2; // Slightly higher tolerance for corners (4-way junction)
          
          // Compare each pair of adjacent corners
          const pairs = [
            [weights00, weights10],
            [weights00, weights01],
            [weights10, weights11],
            [weights01, weights11],
          ];
          
          let allPairsContinuous = true;
          
          for (const [w1, w2] of pairs) {
            for (let b = 0; b < numBiomes; b++) {
              const weight1 = w1.get(b) || 0;
              const weight2 = w2.get(b) || 0;
              const diff = Math.abs(weight1 - weight2);
              
              if (diff > tolerance) {
                allPairsContinuous = false;
                break;
              }
            }
            if (!allPairsContinuous) break;
          }
          
          expect(allPairsContinuous).toBe(true);
          
          if (!allPairsContinuous) {
            console.log('COUNTEREXAMPLE FOUND (Corner):');
            console.log(`  Seed: ${seed}`);
            console.log(`  Chunks: (${chunkX}, ${chunkY}), (${chunkX+1}, ${chunkY}), (${chunkX}, ${chunkY+1}), (${chunkX+1}, ${chunkY+1})`);
            console.log(`  Biomes: ${biome00}, ${biome10}, ${biome01}, ${biome11}`);
            console.log(`  Weights00:`, Array.from(weights00.entries()));
            console.log(`  Weights10:`, Array.from(weights10.entries()));
            console.log(`  Weights01:`, Array.from(weights01.entries()));
            console.log(`  Weights11:`, Array.from(weights11.entries()));
          }
        }
      ),
      { numRuns: 30 } // Fewer runs for corner test (more expensive)
    );
  });
});
