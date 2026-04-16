// Property-based tests for resource generation

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { ResourceGenerator, ResourceConfig } from '../../src/gen/resources.js';
import { BiomeType, ChunkData, ResourceType } from '../../src/world/chunk.js';

describe('ResourceGenerator Properties', () => {
  // Feature: procedural-world-engine, Property 8: Resource-Biome Matching
  // **Validates: Requirements 5.3**
  test('Property 8: All generated resources match their biome constraints', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 8, max: 64 }),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        (seed, chunkSize, chunkX, chunkY) => {
          // Create a resource config with specific biome constraints
          const config: ResourceConfig = {
            types: [
              {
                type: ResourceType.IRON,
                rarity: 0.3,
                biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS],
                minAmount: 1,
                maxAmount: 10,
              },
              {
                type: ResourceType.WOOD,
                rarity: 0.2,
                biomes: [BiomeType.FOREST, BiomeType.TAIGA],
                minAmount: 5,
                maxAmount: 20,
              },
              {
                type: ResourceType.GOLD,
                rarity: 0.7,
                biomes: [BiomeType.MOUNTAIN, BiomeType.DESERT],
                minAmount: 1,
                maxAmount: 5,
              },
            ],
            clusterScale: 20,
            densityThreshold: 0.5,
          };

          const generator = new ResourceGenerator(config);

          // Create mock chunk data with varied biomes
          const heightmap = new Float32Array(chunkSize * chunkSize);
          const biomeMap = new Uint8Array(chunkSize * chunkSize);
          const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);

          // Fill with random biomes
          for (let i = 0; i < chunkSize * chunkSize; i++) {
            biomeMap[i] = (i % 8) as BiomeType; // Cycle through all biome types
          }

          const chunkData: ChunkData = {
            x: chunkX,
            y: chunkY,
            size: chunkSize,
            heightmap,
            biomeMap,
            biomeWeights,
            resources: [],
            structures: [],
            rivers: new Set(),
          };

          // Generate resources
          const resources = generator.generateResources(chunkData, seed);

          // Verify each resource is in a valid biome for its type
          for (const resource of resources) {
            const index = resource.y * chunkSize + resource.x;
            const biome = biomeMap[index] as BiomeType;
            const typeConfig = config.types.find((t) => t.type === resource.type);

            expect(typeConfig).toBeDefined();
            expect(typeConfig!.biomes).toContain(biome);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: procedural-world-engine, Property 9: Resource Generation Determinism
  // **Validates: Requirements 5.4**
  test('Property 9: Resource generation is deterministic for same seed', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 8, max: 64 }),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        (seed, chunkSize, chunkX, chunkY) => {
          const config: ResourceConfig = {
            types: [
              {
                type: ResourceType.STONE,
                rarity: 0.2,
                biomes: [BiomeType.MOUNTAIN, BiomeType.PLAINS, BiomeType.DESERT],
                minAmount: 10,
                maxAmount: 50,
              },
              {
                type: ResourceType.COAL,
                rarity: 0.4,
                biomes: [BiomeType.MOUNTAIN, BiomeType.FOREST],
                minAmount: 5,
                maxAmount: 15,
              },
            ],
            clusterScale: 25,
            densityThreshold: 0.6,
          };

          const generator = new ResourceGenerator(config);

          // Create identical chunk data
          const createChunkData = (): ChunkData => {
            const heightmap = new Float32Array(chunkSize * chunkSize);
            const biomeMap = new Uint8Array(chunkSize * chunkSize);
            const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);

            // Fill with deterministic biomes
            for (let i = 0; i < chunkSize * chunkSize; i++) {
              biomeMap[i] = BiomeType.MOUNTAIN; // Use a biome that supports all resources
            }

            return {
              x: chunkX,
              y: chunkY,
              size: chunkSize,
              heightmap,
              biomeMap,
              biomeWeights,
              resources: [],
              structures: [],
              rivers: new Set(),
            };
          };

          // Generate resources twice with same seed
          const resources1 = generator.generateResources(createChunkData(), seed);
          const resources2 = generator.generateResources(createChunkData(), seed);

          // Should produce identical results
          expect(resources1.length).toBe(resources2.length);

          // Sort both arrays for comparison
          const sort = (a: any, b: any) => {
            if (a.x !== b.x) return a.x - b.x;
            if (a.y !== b.y) return a.y - b.y;
            return a.type - b.type;
          };

          resources1.sort(sort);
          resources2.sort(sort);

          for (let i = 0; i < resources1.length; i++) {
            expect(resources1[i].x).toBe(resources2[i].x);
            expect(resources1[i].y).toBe(resources2[i].y);
            expect(resources1[i].type).toBe(resources2[i].type);
            expect(resources1[i].amount).toBe(resources2[i].amount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

