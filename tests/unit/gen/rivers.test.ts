// Unit tests for river generation

import { describe, test, expect } from 'vitest';
import { RiverGenerator, RiverConfig } from '../../../src/gen/rivers.js';
import { BiomeType, ChunkData } from '../../../src/world/chunk.js';

describe('RiverGenerator', () => {
  // Helper to create basic chunk data
  const createChunkData = (size: number, heightmap?: Float32Array): ChunkData => {
    const defaultHeightmap = new Float32Array(size * size);
    // Create default gradient from high to low
    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      defaultHeightmap[i] = 1.0 - (x + y) / (size * 2);
    }

    return {
      x: 0,
      y: 0,
      size,
      heightmap: heightmap || defaultHeightmap,
      biomeMap: new Uint8Array(size * size).fill(BiomeType.PLAINS),
      biomeWeights: new Float32Array(size * size * 8),
      resources: [],
      structures: [],
      rivers: new Set(),
    };
  };

  describe('River Source Selection', () => {
    test('rivers start at high elevations', () => {
      const config: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      const chunkData = createChunkData(32);

      const rivers = generator.generateRivers(chunkData, 12345);

      // Find the highest elevation river tiles (likely sources)
      let maxRiverHeight = -1;
      for (const index of rivers) {
        const height = chunkData.heightmap[index];
        maxRiverHeight = Math.max(maxRiverHeight, height);
      }

      // At least one river tile should be at or above source elevation
      expect(maxRiverHeight).toBeGreaterThanOrEqual(config.sourceElevation);
    });

    test('no rivers generated when no high elevation areas exist', () => {
      const config: RiverConfig = {
        sourceElevation: 0.9,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      
      // Create flat low terrain
      const heightmap = new Float32Array(32 * 32).fill(0.3);
      const chunkData = createChunkData(32, heightmap);

      const rivers = generator.generateRivers(chunkData, 12345);

      // Should have no rivers (no sources above 0.9)
      expect(rivers.size).toBe(0);
    });
  });

  describe('River Flow', () => {
    test('rivers are marked in chunk data', () => {
      const config: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      const chunkData = createChunkData(32);

      const rivers = generator.generateRivers(chunkData, 12345);

      // Rivers should be a Set of indices
      expect(rivers).toBeInstanceOf(Set);
      
      // All indices should be valid
      for (const index of rivers) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(32 * 32);
      }
    });

    test('rivers respect minimum flow length', () => {
      const config: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 10,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      const chunkData = createChunkData(32);

      const rivers = generator.generateRivers(chunkData, 12345);

      // If rivers exist, they should be reasonably long
      // (hard to test exact length without internal access, but we can check size)
      if (rivers.size > 0) {
        expect(rivers.size).toBeGreaterThanOrEqual(config.minFlowLength);
      }
    });

    test('rivers terminate at ocean level', () => {
      const config: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      
      // Create terrain that slopes to ocean level
      const heightmap = new Float32Array(32 * 32);
      for (let i = 0; i < 32 * 32; i++) {
        const x = i % 32;
        const y = Math.floor(i / 32);
        // Slope from 0.9 to 0.1
        heightmap[i] = 0.9 - (x + y) / (32 * 2) * 0.8;
      }
      
      const chunkData = createChunkData(32, heightmap);

      const rivers = generator.generateRivers(chunkData, 12345);

      // Find lowest river tile
      let minRiverHeight = Infinity;
      for (const index of rivers) {
        const height = chunkData.heightmap[index];
        minRiverHeight = Math.min(minRiverHeight, height);
      }

      // Lowest river tile should be at or below ocean level (0.3)
      if (rivers.size > 0) {
        expect(minRiverHeight).toBeLessThanOrEqual(0.35);
      }
    });
  });

  describe('River Width', () => {
    test('river width is applied correctly', () => {
      const config1: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const config2: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 3,
      };

      const generator1 = new RiverGenerator(config1);
      const generator2 = new RiverGenerator(config2);
      
      const chunkData1 = createChunkData(32);
      const chunkData2 = createChunkData(32);

      const rivers1 = generator1.generateRivers(chunkData1, 12345);
      const rivers2 = generator2.generateRivers(chunkData2, 12345);

      // Wider rivers should have more tiles
      if (rivers1.size > 0) {
        expect(rivers2.size).toBeGreaterThanOrEqual(rivers1.size);
      }
    });

    test('flowWidth of 1 produces narrow rivers', () => {
      const config: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      const chunkData = createChunkData(32);

      const rivers = generator.generateRivers(chunkData, 12345);

      // With width 1, rivers should be relatively narrow
      // Check that not all tiles are rivers
      expect(rivers.size).toBeLessThan(32 * 32 * 0.5);
    });
  });

  describe('Edge Cases', () => {
    test('handles flat terrain gracefully', () => {
      const config: RiverConfig = {
        sourceElevation: 0.5,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      
      // Create completely flat terrain
      const heightmap = new Float32Array(32 * 32).fill(0.6);
      const chunkData = createChunkData(32, heightmap);

      const rivers = generator.generateRivers(chunkData, 12345);

      // Should handle gracefully (may have no or very short rivers)
      expect(rivers).toBeInstanceOf(Set);
    });

    test('handles small chunks', () => {
      const config: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 2,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      const chunkData = createChunkData(8);

      const rivers = generator.generateRivers(chunkData, 12345);

      // Should handle gracefully
      expect(rivers).toBeInstanceOf(Set);
      
      // All indices should be valid
      for (const index of rivers) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(8 * 8);
      }
    });

    test('handles terrain with local minima', () => {
      const config: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      
      // Create terrain with a local minimum in the center
      const heightmap = new Float32Array(32 * 32);
      for (let i = 0; i < 32 * 32; i++) {
        const x = i % 32;
        const y = Math.floor(i / 32);
        const dx = x - 16;
        const dy = y - 16;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        // Bowl shape: high at edges, low in center
        heightmap[i] = 0.3 + distFromCenter / 32 * 0.6;
      }
      
      const chunkData = createChunkData(32, heightmap);

      const rivers = generator.generateRivers(chunkData, 12345);

      // Rivers should terminate at the local minimum
      // Find the center tile
      const centerIndex = 16 * 32 + 16;
      
      // If rivers exist, some should reach near the center
      if (rivers.size > 0) {
        let hasNearCenter = false;
        for (const index of rivers) {
          const x = index % 32;
          const y = Math.floor(index / 32);
          const dx = x - 16;
          const dy = y - 16;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 5) {
            hasNearCenter = true;
            break;
          }
        }
        expect(hasNearCenter).toBe(true);
      }
    });
  });

  describe('Determinism', () => {
    test('same seed produces same rivers', () => {
      const config: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      const chunkData1 = createChunkData(32);
      const chunkData2 = createChunkData(32);

      const rivers1 = generator.generateRivers(chunkData1, 12345);
      const rivers2 = generator.generateRivers(chunkData2, 12345);

      // Convert to sorted arrays for comparison
      const array1 = Array.from(rivers1).sort((a, b) => a - b);
      const array2 = Array.from(rivers2).sort((a, b) => a - b);

      expect(array1).toEqual(array2);
    });

    test('different seeds produce different rivers', () => {
      const config: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const generator = new RiverGenerator(config);
      const chunkData1 = createChunkData(32);
      const chunkData2 = createChunkData(32);

      const rivers1 = generator.generateRivers(chunkData1, 12345);
      const rivers2 = generator.generateRivers(chunkData2, 54321);

      // Convert to sorted arrays for comparison
      const array1 = Array.from(rivers1).sort((a, b) => a - b);
      const array2 = Array.from(rivers2).sort((a, b) => a - b);

      // Very unlikely to be identical with different seeds
      expect(array1).not.toEqual(array2);
    });
  });

  describe('Configuration', () => {
    test('higher source elevation produces fewer rivers', () => {
      const config1: RiverConfig = {
        sourceElevation: 0.6,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const config2: RiverConfig = {
        sourceElevation: 0.9,
        minFlowLength: 3,
        flowWidth: 1,
      };

      const generator1 = new RiverGenerator(config1);
      const generator2 = new RiverGenerator(config2);
      
      const chunkData1 = createChunkData(32);
      const chunkData2 = createChunkData(32);

      const rivers1 = generator1.generateRivers(chunkData1, 12345);
      const rivers2 = generator2.generateRivers(chunkData2, 12345);

      // Lower source elevation should produce more rivers
      expect(rivers1.size).toBeGreaterThanOrEqual(rivers2.size);
    });

    test('longer minimum flow length produces fewer rivers', () => {
      const config1: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 2,
        flowWidth: 1,
      };

      const config2: RiverConfig = {
        sourceElevation: 0.7,
        minFlowLength: 15,
        flowWidth: 1,
      };

      const generator1 = new RiverGenerator(config1);
      const generator2 = new RiverGenerator(config2);
      
      const chunkData1 = createChunkData(32);
      const chunkData2 = createChunkData(32);

      const rivers1 = generator1.generateRivers(chunkData1, 12345);
      const rivers2 = generator2.generateRivers(chunkData2, 12345);

      // Shorter minimum length should allow more rivers
      expect(rivers1.size).toBeGreaterThanOrEqual(rivers2.size);
    });
  });
});
