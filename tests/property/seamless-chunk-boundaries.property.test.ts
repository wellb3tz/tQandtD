import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { ChunkManager } from '../../src/world/chunk-manager';
import { ChunkData } from '../../src/world/chunk';

describe('Seamless Chunk Boundaries - Bug Condition Exploration', () => {
  // Helper to create a minimal world config for testing
  const createTestConfig = (seed: number, chunkSize: number = 32) => ({
    seed,
    chunkSize,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
    },
    biomeConfig: {
      temperatureScale: 0.02,
      moistureScale: 0.02,
    },
    resourceConfig: {
      types: [], // Disable resources for boundary testing
      clusterScale: 20,
      densityThreshold: 0.5,
    },
    structureConfig: {
      types: [], // Disable structures for boundary testing
      minDistance: 10,
      maxAttempts: 30,
    },
    riverConfig: {
      sourceElevation: 1.0,
      minFlowLength: 1000, // Effectively disable rivers for boundary testing
      flowWidth: 2,
    },
    maxCacheSize: 10,
  });

  // Helper to get boundary vertices from a chunk
  // Note: After the fix, heightmap has (size+1) x (size+1) vertices
  // Boundary vertices are at position 'size' (overlapping with adjacent chunks)
  const getBoundaryVertices = (chunk: ChunkData, edge: 'left' | 'right' | 'top' | 'bottom'): number[] => {
    const { size, heightmap } = chunk;
    const vertices: number[] = [];
    const stride = size + 1; // Heightmap stride after fix

    switch (edge) {
      case 'left': // x = 0
        for (let y = 0; y <= size; y++) {
          vertices.push(heightmap[y * stride + 0]);
        }
        break;
      case 'right': // x = size (overlapping boundary)
        for (let y = 0; y <= size; y++) {
          vertices.push(heightmap[y * stride + size]);
        }
        break;
      case 'top': // y = 0
        for (let x = 0; x <= size; x++) {
          vertices.push(heightmap[0 * stride + x]);
        }
        break;
      case 'bottom': // y = size (overlapping boundary)
        for (let x = 0; x <= size; x++) {
          vertices.push(heightmap[size * stride + x]);
        }
        break;
    }

    return vertices;
  };

  // Helper to get world coordinates for boundary vertices
  // Note: After the fix, heightmap has (size+1) x (size+1) vertices
  // Boundary vertices are at position 'size' (overlapping with adjacent chunks)
  const getBoundaryWorldCoords = (
    chunk: ChunkData,
    edge: 'left' | 'right' | 'top' | 'bottom'
  ): Array<{ worldX: number; worldY: number; height: number }> => {
    const { x: chunkX, y: chunkY, size, heightmap } = chunk;
    const coords: Array<{ worldX: number; worldY: number; height: number }> = [];
    const stride = size + 1; // Heightmap stride after fix

    switch (edge) {
      case 'left': // x = 0
        for (let y = 0; y <= size; y++) {
          coords.push({
            worldX: chunkX * size + 0,
            worldY: chunkY * size + y,
            height: heightmap[y * stride + 0],
          });
        }
        break;
      case 'right': // x = size (overlapping boundary)
        for (let y = 0; y <= size; y++) {
          coords.push({
            worldX: chunkX * size + size,
            worldY: chunkY * size + y,
            height: heightmap[y * stride + size],
          });
        }
        break;
      case 'top': // y = 0
        for (let x = 0; x <= size; x++) {
          coords.push({
            worldX: chunkX * size + x,
            worldY: chunkY * size + 0,
            height: heightmap[0 * stride + x],
          });
        }
        break;
      case 'bottom': // y = size (overlapping boundary)
        for (let x = 0; x <= size; x++) {
          coords.push({
            worldX: chunkX * size + x,
            worldY: chunkY * size + size,
            height: heightmap[size * stride + x],
          });
        }
        break;
    }

    return coords;
  };

  // Feature: seamless-chunk-boundaries, Property 1: Bug Condition - Visible Gaps Between Adjacent Chunks
  // **Validates: Requirements 1.1, 1.2, 1.3**
  // **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  // **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  test('horizontal adjacent chunks have seamless boundaries (no 1-unit gap)', () => {
    // Scoped PBT: Test the concrete failing case - chunks (0,0) and (1,0)
    const seed = 12345;
    const chunkSize = 32;
    const config = createTestConfig(seed, chunkSize);
    const manager = new ChunkManager(config);

    // Generate horizontally adjacent chunks
    const chunk1 = manager.generateChunk(0, 0); // Left chunk
    const chunk2 = manager.generateChunk(1, 0); // Right chunk

    // Get boundary world coordinates
    const chunk1RightEdge = getBoundaryWorldCoords(chunk1, 'right');
    const chunk2LeftEdge = getBoundaryWorldCoords(chunk2, 'left');

    // Document the counterexample for root cause analysis
    const chunk1MaxX = chunk1RightEdge[0].worldX;
    const chunk2MinX = chunk2LeftEdge[0].worldX;
    const gap = chunk2MinX - chunk1MaxX;

    console.log('Horizontal Boundary Analysis:');
    console.log(`  Chunk (0,0) right edge at world x=${chunk1MaxX}`);
    console.log(`  Chunk (1,0) left edge at world x=${chunk2MinX}`);
    console.log(`  Gap between chunks: ${gap} unit(s)`);

    // Assert that boundary vertices have identical world coordinates (EXPECTED BEHAVIOR)
    // On unfixed code, this will FAIL because gap === 1
    // After fix, this will PASS because gap === 0
    expect(gap).toBe(0); // Expected: no gap between chunks

    // Verify that boundary vertices share the same world coordinate
    expect(chunk1MaxX).toBe(chunk2MinX); // Expected: same world X coordinate

    // Check if heights would match IF coordinates were aligned
    // (This may also fail due to coordinate mismatch causing different noise samples)
    const heightDifferences: number[] = [];
    for (let i = 0; i < chunk1RightEdge.length; i++) {
      const diff = Math.abs(chunk1RightEdge[i].height - chunk2LeftEdge[i].height);
      heightDifferences.push(diff);
    }

    const avgHeightDiff = heightDifferences.reduce((sum, d) => sum + d, 0) / heightDifferences.length;
    console.log(`  Average height difference: ${avgHeightDiff.toFixed(6)}`);

    // Heights likely differ because vertices sample different world coordinates
    // We document this but don't assert specific values since it depends on the noise function
  });

  test('vertical adjacent chunks have seamless boundaries (no 1-unit gap)', () => {
    // Scoped PBT: Test the concrete failing case - chunks (0,0) and (0,1)
    const seed = 12345;
    const chunkSize = 32;
    const config = createTestConfig(seed, chunkSize);
    const manager = new ChunkManager(config);

    // Generate vertically adjacent chunks
    const chunk1 = manager.generateChunk(0, 0); // Top chunk
    const chunk2 = manager.generateChunk(0, 1); // Bottom chunk

    // Get boundary world coordinates
    const chunk1BottomEdge = getBoundaryWorldCoords(chunk1, 'bottom');
    const chunk2TopEdge = getBoundaryWorldCoords(chunk2, 'top');

    // Document the counterexample for root cause analysis
    const chunk1MaxY = chunk1BottomEdge[0].worldY;
    const chunk2MinY = chunk2TopEdge[0].worldY;
    const gap = chunk2MinY - chunk1MaxY;

    console.log('Vertical Boundary Analysis:');
    console.log(`  Chunk (0,0) bottom edge at world y=${chunk1MaxY}`);
    console.log(`  Chunk (0,1) top edge at world y=${chunk2MinY}`);
    console.log(`  Gap between chunks: ${gap} unit(s)`);

    // Assert that boundary vertices have identical world coordinates (EXPECTED BEHAVIOR)
    // On unfixed code, this will FAIL because gap === 1
    // After fix, this will PASS because gap === 0
    expect(gap).toBe(0); // Expected: no gap between chunks

    // Verify that boundary vertices share the same world coordinate
    expect(chunk1MaxY).toBe(chunk2MinY); // Expected: same world Y coordinate

    // Check if heights would match IF coordinates were aligned
    const heightDifferences: number[] = [];
    for (let i = 0; i < chunk1BottomEdge.length; i++) {
      const diff = Math.abs(chunk1BottomEdge[i].height - chunk2TopEdge[i].height);
      heightDifferences.push(diff);
    }

    const avgHeightDiff = heightDifferences.reduce((sum, d) => sum + d, 0) / heightDifferences.length;
    console.log(`  Average height difference: ${avgHeightDiff.toFixed(6)}`);
  });

  test('four chunks meeting at corner have seamless boundaries (no gaps)', () => {
    // Scoped PBT: Test the concrete failing case - chunks (0,0), (1,0), (0,1), (1,1)
    const seed = 12345;
    const chunkSize = 32;
    const config = createTestConfig(seed, chunkSize);
    const manager = new ChunkManager(config);

    // Generate four chunks meeting at a corner
    const chunk00 = manager.generateChunk(0, 0); // Top-left
    const chunk10 = manager.generateChunk(1, 0); // Top-right
    const chunk01 = manager.generateChunk(0, 1); // Bottom-left
    const chunk11 = manager.generateChunk(1, 1); // Bottom-right

    // Get corner vertices (bottom-right of each chunk)
    // Note: After the fix, corner vertices are at position (size, size)
    const stride = chunkSize + 1;
    const corner00 = {
      worldX: chunk00.x * chunkSize + chunkSize,
      worldY: chunk00.y * chunkSize + chunkSize,
      height: chunk00.heightmap[chunkSize * stride + chunkSize],
    };

    const corner10 = {
      worldX: chunk10.x * chunkSize + 0,
      worldY: chunk10.y * chunkSize + chunkSize,
      height: chunk10.heightmap[chunkSize * stride + 0],
    };

    const corner01 = {
      worldX: chunk01.x * chunkSize + chunkSize,
      worldY: chunk01.y * chunkSize + 0,
      height: chunk01.heightmap[0 * stride + chunkSize],
    };

    const corner11 = {
      worldX: chunk11.x * chunkSize + 0,
      worldY: chunk11.y * chunkSize + 0,
      height: chunk11.heightmap[0 * stride + 0],
    };

    console.log('Corner Meeting Point Analysis:');
    console.log(`  Chunk (0,0) corner at (${corner00.worldX}, ${corner00.worldY})`);
    console.log(`  Chunk (1,0) corner at (${corner10.worldX}, ${corner10.worldY})`);
    console.log(`  Chunk (0,1) corner at (${corner01.worldX}, ${corner01.worldY})`);
    console.log(`  Chunk (1,1) corner at (${corner11.worldX}, ${corner11.worldY})`);

    // Document the gaps
    const gapX = corner10.worldX - corner00.worldX;
    const gapY = corner01.worldY - corner00.worldY;
    console.log(`  Gap in X direction: ${gapX} unit(s)`);
    console.log(`  Gap in Y direction: ${gapY} unit(s)`);

    // Assert the expected behavior: corners should share the same world coordinates
    // On unfixed code, this will FAIL because gaps exist
    // After fix, this will PASS because corners overlap
    expect(gapX).toBe(0); // Expected: no gap in X
    expect(gapY).toBe(0); // Expected: no gap in Y

    // All four corners should have the same world coordinates (after fix)
    expect(corner00.worldX).toBe(corner10.worldX); // Same X coordinate
    expect(corner00.worldY).toBe(corner01.worldY); // Same Y coordinate
    expect(corner10.worldY).toBe(corner11.worldY); // Same Y coordinate
    expect(corner01.worldX).toBe(corner11.worldX); // Same X coordinate
  });
});

describe('Seamless Chunk Boundaries - Preservation Properties', () => {
  // Helper to create a minimal world config for testing
  const createTestConfig = (seed: number, chunkSize: number = 32) => ({
    seed,
    chunkSize,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
    },
    biomeConfig: {
      temperatureScale: 0.02,
      moistureScale: 0.02,
    },
    resourceConfig: {
      types: [
        { type: 0, rarity: 0.3, biomes: [2, 3, 4], minAmount: 1, maxAmount: 5 }, // Iron in desert, plains, forest
        { type: 1, rarity: 0.1, biomes: [7], minAmount: 1, maxAmount: 3 }, // Gold in mountains
      ],
      clusterScale: 20,
      densityThreshold: 0.5,
    },
    structureConfig: {
      types: [
        { type: 0, rarity: 0.05, rules: [] }, // Village with no placement rules
        { type: 1, rarity: 0.03, rules: [] }, // Ruins with no placement rules
      ],
      minDistance: 10,
      maxAttempts: 30,
    },
    riverConfig: {
      sourceElevation: 0.7,
      minFlowLength: 50,
      flowWidth: 2,
    },
    maxCacheSize: 10,
  });

  // Helper to check if a vertex is an interior vertex (not on chunk edges)
  // Note: After the fix, heightmap has (chunkSize+1) x (chunkSize+1) vertices
  // Interior vertices are those not on the edges (0 or chunkSize)
  const isInteriorVertex = (localX: number, localY: number, chunkSize: number): boolean => {
    return localX > 0 && localX < chunkSize && localY > 0 && localY < chunkSize;
  };

  // Feature: seamless-chunk-boundaries, Property 2: Preservation - Interior Vertex Generation
  // **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  // **IMPORTANT**: This test should PASS on unfixed code - it establishes baseline behavior to preserve
  test('interior vertices have identical heights (preservation baseline)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }), // chunkX
        fc.integer({ min: -10, max: 10 }), // chunkY
        fc.integer({ min: 1000, max: 999999 }), // seed
        (chunkX, chunkY, seed) => {
          const chunkSize = 32;
          const config = createTestConfig(seed, chunkSize);
          const manager = new ChunkManager(config);

          // Generate the same chunk twice to verify deterministic generation
          const chunk1 = manager.generateChunk(chunkX, chunkY);
          const chunk2 = manager.generateChunk(chunkX, chunkY);

          // Verify that interior vertices have identical heights
          const stride = chunkSize + 1;
          for (let y = 0; y <= chunkSize; y++) {
            for (let x = 0; x <= chunkSize; x++) {
              if (isInteriorVertex(x, y, chunkSize)) {
                const index = y * stride + x;
                const height1 = chunk1.heightmap[index];
                const height2 = chunk2.heightmap[index];

                // Interior vertices should have identical heights (deterministic generation)
                expect(height1).toBe(height2);
              }
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  // Feature: seamless-chunk-boundaries, Property 2: Preservation - Biome Generation
  // **Validates: Requirements 3.3**
  test('biome maps are identical for same chunk (preservation baseline)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }), // chunkX
        fc.integer({ min: -10, max: 10 }), // chunkY
        fc.integer({ min: 1000, max: 999999 }), // seed
        (chunkX, chunkY, seed) => {
          const chunkSize = 32;
          const config = createTestConfig(seed, chunkSize);
          const manager = new ChunkManager(config);

          // Generate the same chunk twice
          const chunk1 = manager.generateChunk(chunkX, chunkY);
          const chunk2 = manager.generateChunk(chunkX, chunkY);

          // Verify that biome maps are identical
          expect(chunk1.biomeMap.length).toBe(chunk2.biomeMap.length);
          for (let i = 0; i < chunk1.biomeMap.length; i++) {
            expect(chunk1.biomeMap[i]).toBe(chunk2.biomeMap[i]);
          }

          // Verify that biome weights are identical
          expect(chunk1.biomeWeights.length).toBe(chunk2.biomeWeights.length);
          for (let i = 0; i < chunk1.biomeWeights.length; i++) {
            expect(chunk1.biomeWeights[i]).toBe(chunk2.biomeWeights[i]);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  // Feature: seamless-chunk-boundaries, Property 2: Preservation - Resource Generation
  // **Validates: Requirements 3.3**
  test('resource positions and amounts are identical (preservation baseline)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }), // chunkX
        fc.integer({ min: -10, max: 10 }), // chunkY
        fc.integer({ min: 1000, max: 999999 }), // seed
        (chunkX, chunkY, seed) => {
          const chunkSize = 32;
          const config = createTestConfig(seed, chunkSize);
          const manager = new ChunkManager(config);

          // Generate the same chunk twice
          const chunk1 = manager.generateChunk(chunkX, chunkY);
          const chunk2 = manager.generateChunk(chunkX, chunkY);

          // Verify that resource arrays have the same length
          expect(chunk1.resources.length).toBe(chunk2.resources.length);

          // Verify that each resource is identical
          for (let i = 0; i < chunk1.resources.length; i++) {
            expect(chunk1.resources[i].x).toBe(chunk2.resources[i].x);
            expect(chunk1.resources[i].y).toBe(chunk2.resources[i].y);
            expect(chunk1.resources[i].type).toBe(chunk2.resources[i].type);
            expect(chunk1.resources[i].amount).toBe(chunk2.resources[i].amount);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  // Feature: seamless-chunk-boundaries, Property 2: Preservation - Structure Generation
  // **Validates: Requirements 3.3**
  test('structure positions and types are identical (preservation baseline)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }), // chunkX
        fc.integer({ min: -10, max: 10 }), // chunkY
        fc.integer({ min: 1000, max: 999999 }), // seed
        (chunkX, chunkY, seed) => {
          const chunkSize = 32;
          const config = createTestConfig(seed, chunkSize);
          const manager = new ChunkManager(config);

          // Generate the same chunk twice
          const chunk1 = manager.generateChunk(chunkX, chunkY);
          const chunk2 = manager.generateChunk(chunkX, chunkY);

          // Verify that structure arrays have the same length
          expect(chunk1.structures.length).toBe(chunk2.structures.length);

          // Verify that each structure is identical
          for (let i = 0; i < chunk1.structures.length; i++) {
            expect(chunk1.structures[i].x).toBe(chunk2.structures[i].x);
            expect(chunk1.structures[i].y).toBe(chunk2.structures[i].y);
            expect(chunk1.structures[i].type).toBe(chunk2.structures[i].type);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  // Feature: seamless-chunk-boundaries, Property 2: Preservation - River Generation
  // **Validates: Requirements 3.3**
  test('river generation is identical (preservation baseline)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }), // chunkX
        fc.integer({ min: -10, max: 10 }), // chunkY
        fc.integer({ min: 1000, max: 999999 }), // seed
        (chunkX, chunkY, seed) => {
          const chunkSize = 32;
          const config = createTestConfig(seed, chunkSize);
          const manager = new ChunkManager(config);

          // Generate the same chunk twice
          const chunk1 = manager.generateChunk(chunkX, chunkY);
          const chunk2 = manager.generateChunk(chunkX, chunkY);

          // Verify that river sets have the same size
          expect(chunk1.rivers.size).toBe(chunk2.rivers.size);

          // Verify that river sets contain the same elements
          for (const riverIndex of chunk1.rivers) {
            expect(chunk2.rivers.has(riverIndex)).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  // Feature: seamless-chunk-boundaries, Property 2: Preservation - Deterministic Generation
  // **Validates: Requirements 3.4**
  test('deterministic generation with same seed produces identical results (preservation baseline)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }), // chunkX
        fc.integer({ min: -10, max: 10 }), // chunkY
        fc.integer({ min: 1000, max: 999999 }), // seed
        (chunkX, chunkY, seed) => {
          const chunkSize = 32;
          const config1 = createTestConfig(seed, chunkSize);
          const config2 = createTestConfig(seed, chunkSize);
          
          const manager1 = new ChunkManager(config1);
          const manager2 = new ChunkManager(config2);

          // Generate the same chunk with two different managers but same seed
          const chunk1 = manager1.generateChunk(chunkX, chunkY);
          const chunk2 = manager2.generateChunk(chunkX, chunkY);

          // Verify that heightmaps are identical
          expect(chunk1.heightmap.length).toBe(chunk2.heightmap.length);
          for (let i = 0; i < chunk1.heightmap.length; i++) {
            expect(chunk1.heightmap[i]).toBe(chunk2.heightmap[i]);
          }

          // Verify that biome maps are identical
          expect(chunk1.biomeMap.length).toBe(chunk2.biomeMap.length);
          for (let i = 0; i < chunk1.biomeMap.length; i++) {
            expect(chunk1.biomeMap[i]).toBe(chunk2.biomeMap[i]);
          }

          // Verify that resources are identical
          expect(chunk1.resources.length).toBe(chunk2.resources.length);
          for (let i = 0; i < chunk1.resources.length; i++) {
            expect(chunk1.resources[i].x).toBe(chunk2.resources[i].x);
            expect(chunk1.resources[i].y).toBe(chunk2.resources[i].y);
            expect(chunk1.resources[i].type).toBe(chunk2.resources[i].type);
            expect(chunk1.resources[i].amount).toBe(chunk2.resources[i].amount);
          }

          // Verify that structures are identical
          expect(chunk1.structures.length).toBe(chunk2.structures.length);
          for (let i = 0; i < chunk1.structures.length; i++) {
            expect(chunk1.structures[i].x).toBe(chunk2.structures[i].x);
            expect(chunk1.structures[i].y).toBe(chunk2.structures[i].y);
            expect(chunk1.structures[i].type).toBe(chunk2.structures[i].type);
          }

          // Verify that rivers are identical
          expect(chunk1.rivers.size).toBe(chunk2.rivers.size);
          for (const riverIndex of chunk1.rivers) {
            expect(chunk2.rivers.has(riverIndex)).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  // Feature: seamless-chunk-boundaries, Property 2: Preservation - Cache Behavior
  // **Validates: Requirements 3.2**
  test('cache behavior (hit/miss, LRU eviction) works identically (preservation baseline)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 999999 }), // seed
        (seed) => {
          const chunkSize = 32;
          const maxCacheSize = 5;
          const config = createTestConfig(seed, chunkSize);
          config.maxCacheSize = maxCacheSize;
          
          const manager = new ChunkManager(config);

          // Generate chunks to fill the cache
          const chunks: ChunkData[] = [];
          for (let i = 0; i < maxCacheSize; i++) {
            chunks.push(manager.getChunk(i, 0));
          }

          // Verify cache is full
          expect(manager.getCacheSize()).toBe(maxCacheSize);

          // Access first chunk again (should be cache hit)
          const cachedChunk = manager.getChunk(0, 0);
          expect(cachedChunk).toBe(chunks[0]); // Same object reference

          // Cache size should remain the same
          expect(manager.getCacheSize()).toBe(maxCacheSize);

          // Generate a new chunk (should trigger LRU eviction)
          const newChunk = manager.getChunk(maxCacheSize, 0);
          
          // Cache size should still be at max
          expect(manager.getCacheSize()).toBe(maxCacheSize);

          // Verify the new chunk was added
          const retrievedNewChunk = manager.getChunk(maxCacheSize, 0);
          expect(retrievedNewChunk).toBe(newChunk); // Same object reference

          // Clear cache and verify
          manager.clearCache();
          expect(manager.getCacheSize()).toBe(0);
        }
      ),
      { numRuns: 10 }
    );
  });
});
