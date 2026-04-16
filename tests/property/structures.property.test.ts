// Property-based tests for structure placement

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { StructurePlacer, StructureConfig } from '../../src/gen/structures.js';
import { BiomeType, ChunkData, StructureType } from '../../src/world/chunk.js';

describe('StructurePlacer Properties', () => {
  // Feature: procedural-world-engine, Property 10: Structure Minimum Distance
  // **Validates: Requirements 6.2**
  test('Property 10: All structures maintain minimum distance constraint', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 16, max: 64 }),
        fc.float({ min: 3, max: 10, noNaN: true }),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        (seed, chunkSize, minDistance, chunkX, chunkY) => {
          // Create a structure config with minimum distance constraint
          const config: StructureConfig = {
            types: [
              {
                type: StructureType.VILLAGE,
                rarity: 1.0,
                rules: [], // No placement rules for this test
              },
            ],
            minDistance,
            maxAttempts: 30,
          };

          const placer = new StructurePlacer(config);

          // Create mock chunk data
          const heightmap = new Float32Array(chunkSize * chunkSize).fill(0.5);
          const biomeMap = new Uint8Array(chunkSize * chunkSize).fill(BiomeType.PLAINS);
          const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);

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

          // Generate structures
          const structures = placer.generateStructures(chunkData, seed);

          // Verify minimum distance constraint between all pairs
          for (let i = 0; i < structures.length; i++) {
            for (let j = i + 1; j < structures.length; j++) {
              const s1 = structures[i];
              const s2 = structures[j];
              const dx = s1.x - s2.x;
              const dy = s1.y - s2.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              expect(distance).toBeGreaterThanOrEqual(minDistance);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: procedural-world-engine, Property 11: Structure Placement Rules
  // **Validates: Requirements 6.3**
  test('Property 11: All structures satisfy configured placement rules', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 16, max: 64 }),
        fc.constantFrom(
          // Test biome rule
          {
            type: 'biome' as const,
            allowedBiomes: [BiomeType.PLAINS, BiomeType.FOREST],
          },
          // Test slope rule
          {
            type: 'slope' as const,
            maxSlope: 0.2,
          },
          // Test elevation rule
          {
            type: 'elevation' as const,
            minHeight: 0.3,
            maxHeight: 0.7,
          },
          // Test nearWater rule
          {
            type: 'nearWater' as const,
            maxDistance: 5,
          }
        ),
        (seed, chunkSize, ruleConfig) => {
          // Create placement rules based on the test configuration
          const rules = [];
          if (ruleConfig.type === 'biome') {
            rules.push({
              type: 'biome' as const,
              params: { biomes: ruleConfig.allowedBiomes },
            });
          } else if (ruleConfig.type === 'slope') {
            rules.push({
              type: 'slope' as const,
              params: { maxSlope: ruleConfig.maxSlope },
            });
          } else if (ruleConfig.type === 'elevation') {
            rules.push({
              type: 'elevation' as const,
              params: {
                minHeight: ruleConfig.minHeight,
                maxHeight: ruleConfig.maxHeight,
              },
            });
          } else if (ruleConfig.type === 'nearWater') {
            rules.push({
              type: 'nearWater' as const,
              params: { maxDistance: ruleConfig.maxDistance },
            });
          }

          const config: StructureConfig = {
            types: [
              {
                type: StructureType.VILLAGE,
                rarity: 1.0,
                rules,
              },
            ],
            minDistance: 5,
            maxAttempts: 30,
          };

          const placer = new StructurePlacer(config);

          // Create chunk data with varied terrain
          const heightmap = new Float32Array(chunkSize * chunkSize);
          const biomeMap = new Uint8Array(chunkSize * chunkSize);
          const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);
          const rivers = new Set<number>();

          // Fill with varied data
          for (let i = 0; i < chunkSize * chunkSize; i++) {
            const x = i % chunkSize;
            const y = Math.floor(i / chunkSize);
            
            // Create varied heightmap
            heightmap[i] = 0.3 + 0.4 * Math.sin((x + y) / 5);
            
            // Create varied biome map
            biomeMap[i] = (x + y) % 2 === 0 ? BiomeType.PLAINS : BiomeType.FOREST;
            
            // Add some river tiles
            if (x === chunkSize / 2 || y === chunkSize / 2) {
              rivers.add(i);
            }
          }

          const chunkData: ChunkData = {
            x: 0,
            y: 0,
            size: chunkSize,
            heightmap,
            biomeMap,
            biomeWeights,
            resources: [],
            structures: [],
            rivers,
          };

          // Generate structures
          const structures = placer.generateStructures(chunkData, seed);

          // Verify each structure satisfies the placement rules
          for (const structure of structures) {
            const index = structure.y * chunkSize + structure.x;

            if (ruleConfig.type === 'biome') {
              const biome = biomeMap[index];
              expect(ruleConfig.allowedBiomes).toContain(biome);
            } else if (ruleConfig.type === 'slope') {
              // Calculate slope at structure position
              const centerHeight = heightmap[index];
              let maxDiff = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  const nx = structure.x + dx;
                  const ny = structure.y + dy;
                  if (nx >= 0 && nx < chunkSize && ny >= 0 && ny < chunkSize) {
                    const neighborIndex = ny * chunkSize + nx;
                    const diff = Math.abs(heightmap[neighborIndex] - centerHeight);
                    maxDiff = Math.max(maxDiff, diff);
                  }
                }
              }
              expect(maxDiff).toBeLessThanOrEqual(ruleConfig.maxSlope);
            } else if (ruleConfig.type === 'elevation') {
              const height = heightmap[index];
              expect(height).toBeGreaterThanOrEqual(ruleConfig.minHeight);
              expect(height).toBeLessThanOrEqual(ruleConfig.maxHeight);
            } else if (ruleConfig.type === 'nearWater') {
              // Calculate distance to nearest water
              let minDistance = Infinity;
              for (const riverIndex of rivers) {
                const riverX = riverIndex % chunkSize;
                const riverY = Math.floor(riverIndex / chunkSize);
                const dx = structure.x - riverX;
                const dy = structure.y - riverY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                minDistance = Math.min(minDistance, distance);
              }
              expect(minDistance).toBeLessThanOrEqual(ruleConfig.maxDistance);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: procedural-world-engine, Property 12: Structure Generation Determinism
  // **Validates: Requirements 6.5**
  test('Property 12: Structure generation is deterministic for same seed', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 16, max: 64 }),
        fc.float({ min: 3, max: 10, noNaN: true }),
        (seed, chunkSize, minDistance) => {
          const config: StructureConfig = {
            types: [
              {
                type: StructureType.VILLAGE,
                rarity: 0.5,
                rules: [
                  {
                    type: 'biome',
                    params: { biomes: [BiomeType.PLAINS, BiomeType.FOREST] },
                  },
                ],
              },
              {
                type: StructureType.RUINS,
                rarity: 0.3,
                rules: [
                  {
                    type: 'elevation',
                    params: { minHeight: 0.4, maxHeight: 0.8 },
                  },
                ],
              },
              {
                type: StructureType.TOWER,
                rarity: 0.2,
                rules: [
                  {
                    type: 'slope',
                    params: { maxSlope: 0.1 },
                  },
                ],
              },
            ],
            minDistance,
            maxAttempts: 30,
          };

          const placer = new StructurePlacer(config);

          // Create chunk data with varied terrain
          const heightmap = new Float32Array(chunkSize * chunkSize);
          const biomeMap = new Uint8Array(chunkSize * chunkSize);
          const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);

          for (let i = 0; i < chunkSize * chunkSize; i++) {
            const x = i % chunkSize;
            const y = Math.floor(i / chunkSize);
            heightmap[i] = 0.3 + 0.4 * Math.sin((x + y) / 5);
            biomeMap[i] = (x + y) % 2 === 0 ? BiomeType.PLAINS : BiomeType.FOREST;
          }

          const chunkData: ChunkData = {
            x: 0,
            y: 0,
            size: chunkSize,
            heightmap,
            biomeMap,
            biomeWeights,
            resources: [],
            structures: [],
            rivers: new Set(),
          };

          // Generate structures twice with same seed
          const structures1 = placer.generateStructures(chunkData, seed);
          const structures2 = placer.generateStructures(chunkData, seed);

          // Verify identical results
          expect(structures1.length).toBe(structures2.length);

          for (let i = 0; i < structures1.length; i++) {
            expect(structures1[i].x).toBe(structures2[i].x);
            expect(structures1[i].y).toBe(structures2[i].y);
            expect(structures1[i].type).toBe(structures2[i].type);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

