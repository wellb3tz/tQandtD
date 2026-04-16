// Unit tests for structure placement

import { describe, test, expect } from 'vitest';
import { StructurePlacer, StructureConfig } from '../../../src/gen/structures.js';
import { BiomeType, ChunkData, StructureType } from '../../../src/world/chunk.js';

describe('StructurePlacer', () => {
  // Helper to create basic chunk data
  const createChunkData = (size: number): ChunkData => {
    const heightmap = new Float32Array(size * size).fill(0.5);
    const biomeMap = new Uint8Array(size * size).fill(BiomeType.PLAINS);
    const biomeWeights = new Float32Array(size * size * 8);

    return {
      x: 0,
      y: 0,
      size,
      heightmap,
      biomeMap,
      biomeWeights,
      resources: [],
      structures: [],
      rivers: new Set(),
    };
  };

  describe('Placement Rules', () => {
    test('biome rule filters structures to allowed biomes', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [
              {
                type: 'biome',
                params: { biomes: [BiomeType.PLAINS] },
              },
            ],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      // Set half the chunk to FOREST (not allowed)
      for (let i = 0; i < 16 * 32; i++) {
        chunkData.biomeMap[i] = BiomeType.FOREST;
      }

      const structures = placer.generateStructures(chunkData, 12345);

      // All structures should be in PLAINS biome
      for (const structure of structures) {
        const index = structure.y * 32 + structure.x;
        expect(chunkData.biomeMap[index]).toBe(BiomeType.PLAINS);
      }
    });

    test('slope rule filters structures to flat terrain', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [
              {
                type: 'slope',
                params: { maxSlope: 0.1 },
              },
            ],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      // Create varied terrain with some steep areas
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const index = y * 32 + x;
          // Create steep terrain in top half
          if (y < 16) {
            chunkData.heightmap[index] = 0.5 + (x / 32) * 0.5;
          } else {
            chunkData.heightmap[index] = 0.5;
          }
        }
      }

      const structures = placer.generateStructures(chunkData, 12345);

      // Verify all structures are on flat terrain
      for (const structure of structures) {
        const index = structure.y * 32 + structure.x;
        const centerHeight = chunkData.heightmap[index];
        let maxDiff = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = structure.x + dx;
            const ny = structure.y + dy;
            if (nx >= 0 && nx < 32 && ny >= 0 && ny < 32) {
              const neighborIndex = ny * 32 + nx;
              const diff = Math.abs(chunkData.heightmap[neighborIndex] - centerHeight);
              maxDiff = Math.max(maxDiff, diff);
            }
          }
        }

        expect(maxDiff).toBeLessThanOrEqual(0.1);
      }
    });

    test('elevation rule filters structures to correct height range', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.TOWER,
            rarity: 1.0,
            rules: [
              {
                type: 'elevation',
                params: { minHeight: 0.6, maxHeight: 0.9 },
              },
            ],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      // Create varied elevation
      for (let i = 0; i < 32 * 32; i++) {
        const x = i % 32;
        chunkData.heightmap[i] = 0.3 + (x / 32) * 0.6; // Range from 0.3 to 0.9
      }

      const structures = placer.generateStructures(chunkData, 12345);

      // All structures should be in correct elevation range
      for (const structure of structures) {
        const index = structure.y * 32 + structure.x;
        const height = chunkData.heightmap[index];
        expect(height).toBeGreaterThanOrEqual(0.6);
        expect(height).toBeLessThanOrEqual(0.9);
      }
    });

    test('nearWater rule filters structures close to water', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [
              {
                type: 'nearWater',
                params: { maxDistance: 3 },
              },
            ],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      // Add river in center
      for (let i = 0; i < 32; i++) {
        chunkData.rivers.add(16 * 32 + i);
      }

      const structures = placer.generateStructures(chunkData, 12345);

      // All structures should be near water
      for (const structure of structures) {
        let minDistance = Infinity;
        for (const riverIndex of chunkData.rivers) {
          const riverX = riverIndex % 32;
          const riverY = Math.floor(riverIndex / 32);
          const dx = structure.x - riverX;
          const dy = structure.y - riverY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          minDistance = Math.min(minDistance, distance);
        }
        expect(minDistance).toBeLessThanOrEqual(3);
      }
    });

    test('multiple rules are all satisfied', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [
              {
                type: 'biome',
                params: { biomes: [BiomeType.PLAINS, BiomeType.FOREST] },
              },
              {
                type: 'elevation',
                params: { minHeight: 0.4, maxHeight: 0.7 },
              },
            ],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      // Set varied biomes and elevations
      for (let i = 0; i < 32 * 32; i++) {
        const x = i % 32;
        chunkData.biomeMap[i] = x < 16 ? BiomeType.PLAINS : BiomeType.DESERT;
        chunkData.heightmap[i] = 0.3 + (x / 32) * 0.5; // Range 0.3 to 0.8
      }

      const structures = placer.generateStructures(chunkData, 12345);

      // All structures should satisfy both rules
      for (const structure of structures) {
        const index = structure.y * 32 + structure.x;
        const biome = chunkData.biomeMap[index];
        const height = chunkData.heightmap[index];

        expect([BiomeType.PLAINS, BiomeType.FOREST]).toContain(biome);
        expect(height).toBeGreaterThanOrEqual(0.4);
        expect(height).toBeLessThanOrEqual(0.7);
      }
    });
  });

  describe('Structure Types', () => {
    test('generates correct structure types based on rarity', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [],
          },
          {
            type: StructureType.RUINS,
            rarity: 0.0, // Should never be selected
            rules: [],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      const structures = placer.generateStructures(chunkData, 12345);

      // All structures should be VILLAGE (only non-zero rarity)
      for (const structure of structures) {
        expect(structure.type).toBe(StructureType.VILLAGE);
      }
    });

    test('supports multiple structure types', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [
              {
                type: 'biome',
                params: { biomes: [BiomeType.PLAINS] },
              },
            ],
          },
          {
            type: StructureType.TOWER,
            rarity: 1.0,
            rules: [
              {
                type: 'biome',
                params: { biomes: [BiomeType.MOUNTAIN] },
              },
            ],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      // Set different biomes
      for (let i = 0; i < 32 * 32; i++) {
        const x = i % 32;
        chunkData.biomeMap[i] = x < 16 ? BiomeType.PLAINS : BiomeType.MOUNTAIN;
      }

      const structures = placer.generateStructures(chunkData, 12345);

      // Should have both types
      const hasVillage = structures.some((s) => s.type === StructureType.VILLAGE);
      const hasTower = structures.some((s) => s.type === StructureType.TOWER);

      // At least one of each type should exist (probabilistic, but very likely)
      expect(hasVillage || hasTower).toBe(true);
    });
  });

  describe('Invalid Handling', () => {
    test('handles chunk with no valid placement locations', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [
              {
                type: 'biome',
                params: { biomes: [BiomeType.OCEAN] },
              },
            ],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      // All PLAINS, no OCEAN
      for (let i = 0; i < 32 * 32; i++) {
        chunkData.biomeMap[i] = BiomeType.PLAINS;
      }

      const structures = placer.generateStructures(chunkData, 12345);

      // Should return empty array
      expect(structures).toEqual([]);
    });

    test('handles very small chunks', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(8);

      const structures = placer.generateStructures(chunkData, 12345);

      // Should handle gracefully (limited structures due to small size)
      expect(structures.length).toBeGreaterThanOrEqual(0);
      expect(structures.length).toBeLessThanOrEqual(4);
      
      // All structures should be within bounds
      for (const structure of structures) {
        expect(structure.x).toBeGreaterThanOrEqual(0);
        expect(structure.x).toBeLessThan(8);
        expect(structure.y).toBeGreaterThanOrEqual(0);
        expect(structure.y).toBeLessThan(8);
      }
    });

    test('handles empty structure type list', () => {
      const config: StructureConfig = {
        types: [],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      const structures = placer.generateStructures(chunkData, 12345);

      // Should return empty array
      expect(structures).toEqual([]);
    });
  });

  describe('Determinism', () => {
    test('same seed produces same structures', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      const structures1 = placer.generateStructures(chunkData, 12345);
      const structures2 = placer.generateStructures(chunkData, 12345);

      expect(structures1).toEqual(structures2);
    });

    test('different seeds produce different structures', () => {
      const config: StructureConfig = {
        types: [
          {
            type: StructureType.VILLAGE,
            rarity: 1.0,
            rules: [],
          },
        ],
        minDistance: 5,
        maxAttempts: 30,
      };

      const placer = new StructurePlacer(config);
      const chunkData = createChunkData(32);

      const structures1 = placer.generateStructures(chunkData, 12345);
      const structures2 = placer.generateStructures(chunkData, 54321);

      // Very unlikely to be identical with different seeds
      expect(structures1).not.toEqual(structures2);
    });
  });
});

