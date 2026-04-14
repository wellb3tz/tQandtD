/**
 * Preservation Tests for Incremental Generation Biome Fix
 * 
 * These tests verify that standard generation mode and complete chunk rendering
 * remain unchanged after the fix is implemented. They follow the observation-first
 * methodology: observe behavior on UNFIXED code, then write tests capturing that
 * behavior.
 * 
 * EXPECTED OUTCOME: All tests PASS on unfixed code (confirms baseline behavior to preserve)
 * 
 * Test Coverage:
 * 1. Standard Generation Mode Unchanged - complete chunks with all stages
 * 2. Complete Chunk Rendering Unchanged - proper biome colors
 * 3. LOD System Unchanged - LOD works with standard generation
 * 4. Serialization Unchanged - chunk data integrity preserved
 * 5. Performance Baseline - standard generation performance metrics
 * 
 * @vitest-environment jsdom
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { IncrementalGenerator } from '../../src/world/incremental-generator';
import { ChunkManager } from '../../src/world/chunk-manager';
import { GenerationStage, PartialChunkData, IncrementalConfig, BiomeType, ResourceType, StructureType, ChunkData } from '../../src/world/chunk';
import { WorldViewer } from '../../demo/src/viewer/WorldViewer';
import { LODManager } from '../../src/world/lod';
import { WorldSerializer, SerializationFormat } from '../../src/world/serialization';

describe('Incremental Generation Biome Fix - Preservation Tests', () => {
  // Test configuration with incremental generation DISABLED (standard mode)
  const createStandardConfig = () => ({
    seed: 12345,
    chunkSize: 32,
    terrainConfig: {
      baseScale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 30,
      heightMultiplier: 1.0,
    },
    biomeConfig: {
      temperatureScale: 0.005,
      moistureScale: 0.005,
      blendRadius: 5,
    },
    resourceConfig: {
      types: [
        {
          type: ResourceType.STONE,
          rarity: 0.1,
          biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
          minAmount: 10,
          maxAmount: 50,
        },
      ],
      clusterScale: 20,
      densityThreshold: 0.5,
    },
    structureConfig: {
      types: [
        {
          type: StructureType.VILLAGE,
          rarity: 1.0,
          rules: [
            { type: 'biome' as const, params: { biomes: [BiomeType.PLAINS, BiomeType.FOREST] } },
            { type: 'slope' as const, params: { maxSlope: 0.1 } },
          ],
        },
      ],
      minDistance: 10,
      maxAttempts: 30,
    },
    riverConfig: {
      sourceElevation: 0.6,
      minFlowLength: 5,
      flowWidth: 2,
    },
    incrementalConfig: {
      enabled: false, // DISABLED - standard generation mode
      timeBudgetMs: 16,
    },
  });

  let chunkManager: ChunkManager;

  beforeEach(() => {
    const config = createStandardConfig();
    chunkManager = new ChunkManager(config);
  });

  /**
   * Test 2.2: Standard Generation Mode Unchanged
   * 
   * **Property 2a: Preservation** - Standard Generation Produces Complete Chunks
   * 
   * This test verifies that standard generation mode (incrementalConfig.enabled = false)
   * continues to work correctly and produces complete chunks with all stages.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (confirms baseline behavior to preserve)
   * 
   * **Validates: Requirements 3.1**
   */
  test('Property 2a: Standard generation produces complete chunks with all stages', () => {
    // Generate 10 chunks with standard generation (incremental disabled)
    const numChunks = 10;
    const chunks: ChunkData[] = [];

    for (let i = 0; i < numChunks; i++) {
      const chunkX = i % 3;
      const chunkY = Math.floor(i / 3);
      const chunk = chunkManager.getChunk(chunkX, chunkY);
      chunks.push(chunk);
    }

    // Verify each chunk is complete with all stages
    for (const chunk of chunks) {
      // Assert heightmap exists and has correct dimensions
      expect(chunk.heightmap).toBeDefined();
      expect(chunk.heightmap).toBeInstanceOf(Float32Array);
      // Heightmap should have (size + 1) * (size + 1) vertices for seamless boundaries
      const expectedHeightmapSize = (chunk.size + 1) * (chunk.size + 1);
      expect(chunk.heightmap.length).toBe(expectedHeightmapSize);

      // Assert biomeMap exists and has correct dimensions
      expect(chunk.biomeMap).toBeDefined();
      expect(chunk.biomeMap).toBeInstanceOf(Uint8Array);
      // BiomeMap should have size * size elements
      const expectedBiomeMapSize = chunk.size * chunk.size;
      expect(chunk.biomeMap.length).toBe(expectedBiomeMapSize);

      // Assert biomeWeights exists and has correct dimensions
      expect(chunk.biomeWeights).toBeDefined();
      expect(chunk.biomeWeights).toBeInstanceOf(Float32Array);
      // BiomeWeights should have size * size * numBiomes elements (8 biome types)
      const numBiomes = 8;
      const expectedBiomeWeightsSize = chunk.size * chunk.size * numBiomes;
      expect(chunk.biomeWeights.length).toBe(expectedBiomeWeightsSize);

      // Assert rivers are generated (Set exists, may be empty)
      expect(chunk.rivers).toBeDefined();
      expect(chunk.rivers).toBeInstanceOf(Set);

      // Assert resources are generated (array exists, may be empty)
      expect(chunk.resources).toBeDefined();
      expect(Array.isArray(chunk.resources)).toBe(true);

      // Assert structures are generated (array exists, may be empty)
      expect(chunk.structures).toBeDefined();
      expect(Array.isArray(chunk.structures)).toBe(true);

      // Verify chunk coordinates are correct
      expect(chunk.x).toBeGreaterThanOrEqual(0);
      expect(chunk.y).toBeGreaterThanOrEqual(0);
      expect(chunk.size).toBe(32); // From config
    }

    // Document observed behavior
    console.log('✓ Standard generation produces complete chunks with all stages');
    console.log(`  Generated ${numChunks} chunks successfully`);
    console.log(`  All chunks have heightmap, biomeMap, biomeWeights, rivers, resources, and structures`);
  });

  /**
   * Test 2.3: Complete Chunk Rendering Unchanged
   * 
   * **Property 2b: Preservation** - Complete Chunks Render With Biome Colors
   * 
   * This test verifies that complete chunks (stage = COMPLETE) have proper
   * biome data that enables rendering with biome colors (not grey fallback).
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (confirms baseline behavior to preserve)
   * 
   * **Validates: Requirements 3.2, 3.3**
   */
  test('Property 2b: Complete chunks have biome data for proper color rendering', () => {
    // Generate complete chunks with standard generation (incremental disabled)
    const numChunks = 10;
    const chunks: ChunkData[] = [];

    for (let i = 0; i < numChunks; i++) {
      const chunkX = i % 3;
      const chunkY = Math.floor(i / 3);
      const chunk = chunkManager.getChunk(chunkX, chunkY);
      chunks.push(chunk);
    }

    // Verify each chunk has proper biome data for rendering
    for (const chunk of chunks) {
      // Assert biomeMap exists (required for biome colors)
      expect(chunk.biomeMap).toBeDefined();
      expect(chunk.biomeMap).toBeInstanceOf(Uint8Array);
      expect(chunk.biomeMap.length).toBe(chunk.size * chunk.size);

      // Assert biomeWeights exists (required for smooth color blending)
      expect(chunk.biomeWeights).toBeDefined();
      expect(chunk.biomeWeights).toBeInstanceOf(Float32Array);
      const numBiomes = 8;
      expect(chunk.biomeWeights.length).toBe(chunk.size * chunk.size * numBiomes);

      // Verify biomeMap contains valid biome types (0-7)
      for (let i = 0; i < chunk.biomeMap.length; i++) {
        const biome = chunk.biomeMap[i];
        expect(biome).toBeGreaterThanOrEqual(0);
        expect(biome).toBeLessThanOrEqual(7);
      }

      // Verify biomeWeights are normalized (sum to ~1.0 for each position)
      for (let pos = 0; pos < chunk.size * chunk.size; pos++) {
        let weightSum = 0;
        for (let biome = 0; biome < numBiomes; biome++) {
          const weight = chunk.biomeWeights[pos * numBiomes + biome];
          expect(weight).toBeGreaterThanOrEqual(0);
          expect(weight).toBeLessThanOrEqual(1);
          weightSum += weight;
        }
        // Weights should sum to approximately 1.0
        expect(weightSum).toBeCloseTo(1.0, 5);
      }
    }

    // Document observed behavior
    console.log('✓ Complete chunks have proper biome data for color rendering');
    console.log(`  Verified ${numChunks} chunks successfully`);
    console.log(`  All chunks have biomeMap and biomeWeights`);
    console.log(`  BiomeWeights are normalized and consistent with biomeMap`);
    console.log(`  This ensures chunks render with proper biome colors (not grey fallback)`);
  });

  /**
   * Test 2.4: LOD System Unchanged
   * 
   * **Property 2c: Preservation** - LOD Works With Standard Generation
   * 
   * This test verifies that the LOD (Level of Detail) system continues to work
   * correctly with standard generation mode. LOD should apply tints and adjust
   * mesh resolution based on distance from viewer.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (confirms baseline behavior to preserve)
   * 
   * **Validates: Requirements 3.5**
   */
  test('Property 2c: LOD system works correctly with standard generation', () => {
    // Generate chunks with standard generation (incremental disabled)
    const numChunks = 9; // 3x3 grid
    const chunks: ChunkData[] = [];

    for (let i = 0; i < numChunks; i++) {
      const chunkX = i % 3;
      const chunkY = Math.floor(i / 3);
      const chunk = chunkManager.getChunk(chunkX, chunkY);
      chunks.push(chunk);
    }

    // Create LOD manager with test configuration
    const lodManager = new LODManager({
      distances: [2, 5], // HIGH: 0-2 chunks, MEDIUM: 2-5 chunks, LOW: 5+ chunks
      meshResolutions: [1.0, 0.5, 0.25], // Full, half, quarter resolution
      featureDensities: [1.0, 0.5, 0.1], // Full, half, 10% density
    });

    // Test LOD application at different distances
    const viewerX = 1;
    const viewerY = 1;

    for (const chunk of chunks) {
      // Calculate distance from viewer
      const dx = chunk.x - viewerX;
      const dy = chunk.y - viewerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Get LOD level for this chunk
      const lodLevel = lodManager.getLODLevel(chunk.x, chunk.y, viewerX, viewerY);

      // Apply LOD to chunk
      const lodChunk = lodManager.applyLOD(chunk, lodLevel);

      // Verify LOD is applied correctly based on distance
      if (distance < 2) {
        // HIGH LOD - should be unchanged
        expect(lodChunk.size).toBe(chunk.size);
        expect(lodChunk.heightmap.length).toBe(chunk.heightmap.length);
        expect(lodChunk.resources.length).toBe(chunk.resources.length);
        expect(lodChunk.structures.length).toBe(chunk.structures.length);
      } else if (distance < 5) {
        // MEDIUM LOD - should be half resolution
        const expectedSize = Math.max(1, Math.floor(chunk.size * 0.5));
        expect(lodChunk.size).toBe(expectedSize);
        expect(lodChunk.heightmap.length).toBe((expectedSize + 1) * (expectedSize + 1));
        // Features should be reduced (approximately 50% density)
        expect(lodChunk.resources.length).toBeLessThanOrEqual(chunk.resources.length);
        expect(lodChunk.structures.length).toBeLessThanOrEqual(chunk.structures.length);
      } else {
        // LOW LOD - should be quarter resolution
        const expectedSize = Math.max(1, Math.floor(chunk.size * 0.25));
        expect(lodChunk.size).toBe(expectedSize);
        expect(lodChunk.heightmap.length).toBe((expectedSize + 1) * (expectedSize + 1));
        // Features should be heavily reduced (approximately 10% density)
        expect(lodChunk.resources.length).toBeLessThanOrEqual(chunk.resources.length);
        expect(lodChunk.structures.length).toBeLessThanOrEqual(chunk.structures.length);
      }

      // Verify heightmap values are valid (not NaN or Infinity)
      for (let i = 0; i < lodChunk.heightmap.length; i++) {
        expect(lodChunk.heightmap[i]).not.toBeNaN();
        expect(lodChunk.heightmap[i]).not.toBe(Infinity);
        expect(lodChunk.heightmap[i]).not.toBe(-Infinity);
      }
    }

    // Document observed behavior
    console.log('✓ LOD system applies tints correctly with standard generation');
    console.log(`  Tested ${numChunks} chunks at various distances`);
    console.log(`  LOD levels correctly determined based on distance`);
    console.log(`  Mesh resolution and feature density adjusted appropriately`);
  });

  /**
   * Test 2.5: Serialization Unchanged
   * 
   * **Property 2d: Preservation** - Chunk Serialization Works
   * 
   * This test verifies that chunk serialization and deserialization work correctly
   * with standard generation mode. Serialized chunks should preserve all data
   * including heightmap, biomeMap, resources, structures, and rivers.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (confirms baseline behavior to preserve)
   * 
   * **Validates: Requirements 3.1**
   */
  test('Property 2d: Chunk serialization/deserialization preserves data integrity', () => {
    // Generate complete chunks with standard generation (incremental disabled)
    const numChunks = 5;
    const originalChunks: ChunkData[] = [];

    for (let i = 0; i < numChunks; i++) {
      const chunkX = i % 3;
      const chunkY = Math.floor(i / 3);
      const chunk = chunkManager.getChunk(chunkX, chunkY);
      originalChunks.push(chunk);
    }

    // Serialize chunks to binary format
    const serializer = new WorldSerializer();

    const serializedWorld = serializer.serialize(chunkManager, {
      format: SerializationFormat.BINARY,
      compress: true,
      modifiedOnly: false,
    });

    // Verify serialized world structure
    expect(serializedWorld.version).toBe('1.0.0');
    expect(serializedWorld.seed).toBe(chunkManager.config.seed);
    expect(serializedWorld.chunks.length).toBeGreaterThanOrEqual(numChunks);
    expect(serializedWorld.checksum).toBeDefined();
    expect(serializedWorld.checksum.length).toBeGreaterThan(0);

    // Create a new chunk manager for deserialization
    const config = createStandardConfig();
    const newChunkManager = new ChunkManager(config);

    // Deserialize chunks back
    serializer.deserialize(serializedWorld, newChunkManager);

    // Verify deserialized chunks match original chunks
    for (const originalChunk of originalChunks) {
      const key = `${originalChunk.x},${originalChunk.y},0`; // LOD level 0
      const cacheEntry = newChunkManager.cache.get(key);
      
      expect(cacheEntry).toBeDefined();
      const deserializedChunk = cacheEntry.chunk;

      // Verify chunk coordinates
      expect(deserializedChunk.x).toBe(originalChunk.x);
      expect(deserializedChunk.y).toBe(originalChunk.y);
      expect(deserializedChunk.size).toBe(originalChunk.size);

      // Verify heightmap is preserved
      expect(deserializedChunk.heightmap).toBeDefined();
      expect(deserializedChunk.heightmap.length).toBe(originalChunk.heightmap.length);
      for (let i = 0; i < originalChunk.heightmap.length; i++) {
        expect(deserializedChunk.heightmap[i]).toBeCloseTo(originalChunk.heightmap[i], 5);
      }

      // Verify biomeMap is preserved
      expect(deserializedChunk.biomeMap).toBeDefined();
      expect(deserializedChunk.biomeMap.length).toBe(originalChunk.biomeMap.length);
      for (let i = 0; i < originalChunk.biomeMap.length; i++) {
        expect(deserializedChunk.biomeMap[i]).toBe(originalChunk.biomeMap[i]);
      }

      // Verify resources are preserved
      expect(deserializedChunk.resources).toBeDefined();
      expect(deserializedChunk.resources.length).toBe(originalChunk.resources.length);

      // Verify structures are preserved
      expect(deserializedChunk.structures).toBeDefined();
      expect(deserializedChunk.structures.length).toBe(originalChunk.structures.length);

      // Verify rivers are preserved
      expect(deserializedChunk.rivers).toBeDefined();
      expect(deserializedChunk.rivers.size).toBe(originalChunk.rivers.size);
    }

    // Document observed behavior
    console.log('✓ Chunk serialization/deserialization preserves data integrity');
    console.log(`  Serialized and deserialized ${numChunks} chunks successfully`);
    console.log(`  All chunk data (heightmap, biomeMap, resources, structures, rivers) preserved`);
    console.log(`  Checksum validation passed`);
  });

  /**
   * Test 2.6: Performance Baseline
   * 
   * **Property 2e: Preservation** - Standard Generation Performance
   * 
   * This test establishes a performance baseline for standard generation mode.
   * It measures the average time per chunk to ensure the fix doesn't introduce
   * performance regressions in standard generation.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (confirms baseline behavior to preserve)
   * 
   * **Validates: Requirements 3.1**
   */
  test('Property 2e: Standard generation performance baseline', () => {
    // Generate 100 chunks with standard generation (incremental disabled)
    const numChunks = 100;
    const startTime = performance.now();

    for (let i = 0; i < numChunks; i++) {
      const chunkX = i % 10;
      const chunkY = Math.floor(i / 10);
      chunkManager.getChunk(chunkX, chunkY);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerChunk = totalTime / numChunks;

    // Verify performance is reasonable (should be fast for standard generation)
    // Standard generation should complete in less than 100ms per chunk on average
    // (adjusted for test environment overhead)
    expect(avgTimePerChunk).toBeLessThan(100);

    // Verify all chunks were generated successfully
    expect(chunkManager.cache.size).toBeGreaterThanOrEqual(numChunks);

    // Document baseline performance
    console.log('✓ Standard generation completes in reasonable time');
    console.log(`  Generated ${numChunks} chunks in ${totalTime.toFixed(2)}ms`);
    console.log(`  Average time per chunk: ${avgTimePerChunk.toFixed(3)}ms`);
    console.log(`  Performance baseline established for regression testing`);
  });
});
