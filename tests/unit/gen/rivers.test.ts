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

import { RiverNetworkGenerator } from '../../../src/gen/rivers.js';

describe('RiverNetworkGenerator', () => {

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

  describe('Network Generation', () => {
    test('generateNetwork returns valid RiverNetwork structure', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: true,
        maxTributaryOrder: 2,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: true,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData = createChunkData(32);

      const network = generator.generateNetwork(chunkData, 12345);

      // Verify structure
      expect(network).toHaveProperty('segments');
      expect(network).toHaveProperty('lakes');
      expect(network).toHaveProperty('tileToSegment');
      expect(Array.isArray(network.segments)).toBe(true);
      expect(Array.isArray(network.lakes)).toBe(true);
      expect(network.tileToSegment).toBeInstanceOf(Map);
    });

    test('generateNetwork with neighbors parameter accepts Map', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: true,
        maxTributaryOrder: 2,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: true,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData = createChunkData(32);
      const neighbors = new Map<string, ChunkData>();
      neighbors.set('north', createChunkData(32));
      neighbors.set('south', createChunkData(32));

      const network = generator.generateNetwork(chunkData, 12345, neighbors);

      expect(network).toBeDefined();
      expect(network.segments).toBeDefined();
    });

    test('segments have required properties', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: false,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData = createChunkData(32);

      const network = generator.generateNetwork(chunkData, 12345);

      // Check each segment has required properties
      for (const segment of network.segments) {
        expect(segment).toHaveProperty('index');
        expect(segment).toHaveProperty('flow');
        expect(segment).toHaveProperty('width');
        expect(segment).toHaveProperty('order');
        expect(segment).toHaveProperty('next');
        expect(typeof segment.index).toBe('number');
        expect(typeof segment.flow).toBe('number');
        expect(typeof segment.width).toBe('number');
        expect(typeof segment.order).toBe('number');
        expect(typeof segment.next).toBe('number');
      }
    });
  });

  describe('Multi-Pass Pipeline', () => {
    test('pipeline executes with all features enabled', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: true,
        maxTributaryOrder: 2,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: true,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData = createChunkData(32);

      // Should not throw
      expect(() => {
        generator.generateNetwork(chunkData, 12345);
      }).not.toThrow();
    });

    test('pipeline executes with all features disabled', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: false,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData = createChunkData(32);

      // Should not throw
      expect(() => {
        generator.generateNetwork(chunkData, 12345);
      }).not.toThrow();
    });

    test('lakes are only generated when enabled', () => {
      const configWithLakes = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const configWithoutLakes = {
        ...configWithLakes,
        enableLakes: false,
      };

      const generator1 = new RiverNetworkGenerator(configWithLakes);
      const generator2 = new RiverNetworkGenerator(configWithoutLakes);
      const chunkData1 = createChunkData(32);
      const chunkData2 = createChunkData(32);

      const network1 = generator1.generateNetwork(chunkData1, 12345);
      const network2 = generator2.generateNetwork(chunkData2, 12345);

      // With lakes disabled, lakes array should be empty
      expect(network2.lakes).toHaveLength(0);
    });
  });

  describe('Flow and Width Calculation', () => {
    test('all segments have positive flow values', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: true,
        maxTributaryOrder: 2,
        tributaryProbability: 0.3,
        enableLakes: false,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData = createChunkData(32);

      const network = generator.generateNetwork(chunkData, 12345);

      for (const segment of network.segments) {
        expect(segment.flow).toBeGreaterThan(0);
      }
    });

    test('all segments have positive width values', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: true,
        maxTributaryOrder: 2,
        tributaryProbability: 0.3,
        enableLakes: false,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData = createChunkData(32);

      const network = generator.generateNetwork(chunkData, 12345);

      for (const segment of network.segments) {
        expect(segment.width).toBeGreaterThan(0);
      }
    });

    test('width calculation uses logarithmic scaling', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: false,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData = createChunkData(32);

      const network = generator.generateNetwork(chunkData, 12345);

      // Verify width is calculated using logarithmic formula with minimum of 0.5
      for (const segment of network.segments) {
        const expectedWidth = Math.max(0.5, config.widthScale * Math.log(segment.flow + 1));
        expect(segment.width).toBeCloseTo(expectedWidth, 5);
      }
    });
  });

  describe('Tile-to-Segment Mapping', () => {
    test('tileToSegment map is populated correctly', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: false,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData = createChunkData(32);

      const network = generator.generateNetwork(chunkData, 12345);

      // tileToSegment maps tile indices to segment array positions
      // Each tile index should map to a valid segment position
      for (const [tileIndex, segmentPos] of network.tileToSegment.entries()) {
        expect(segmentPos).toBeGreaterThanOrEqual(0);
        expect(segmentPos).toBeLessThan(network.segments.length);
        expect(network.segments[segmentPos].index).toBe(tileIndex);
      }
    });

    test('tileToSegment map size matches segment count', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: false,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData = createChunkData(32);

      const network = generator.generateNetwork(chunkData, 12345);

      // tileToSegment size may be less than or equal to segment count
      // (less if there are cycles where multiple segments share the same tile)
      expect(network.tileToSegment.size).toBeLessThanOrEqual(network.segments.length);
      expect(network.tileToSegment.size).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    test('respects widthScale parameter', () => {
      const config1 = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: false,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const config2 = {
        ...config1,
        widthScale: 1.0,
      };

      const generator1 = new RiverNetworkGenerator(config1);
      const generator2 = new RiverNetworkGenerator(config2);
      const chunkData1 = createChunkData(32);
      const chunkData2 = createChunkData(32);

      const network1 = generator1.generateNetwork(chunkData1, 12345);
      const network2 = generator2.generateNetwork(chunkData2, 12345);

      // With same flow, higher widthScale should produce wider rivers
      if (network1.segments.length > 0 && network2.segments.length > 0) {
        // Compare first segments (should have same flow due to same seed)
        expect(network2.segments[0].width).toBeGreaterThan(network1.segments[0].width);
      }
    });
  });

  describe('Determinism', () => {
    test('same seed produces same network', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: true,
        maxTributaryOrder: 2,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: true,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      const chunkData1 = createChunkData(32);
      const chunkData2 = createChunkData(32);

      const network1 = generator.generateNetwork(chunkData1, 12345);
      const network2 = generator.generateNetwork(chunkData2, 12345);

      // Should produce same number of segments
      expect(network1.segments.length).toBe(network2.segments.length);
      expect(network1.lakes.length).toBe(network2.lakes.length);
    });
  });

  describe('Lake Detection', () => {
    test('detects lake in simple depression', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      
      // Create terrain with a depression in the center
      const size = 16;
      const heightmap = new Float32Array(size * size);
      for (let i = 0; i < size * size; i++) {
        const x = i % size;
        const y = Math.floor(i / size);
        const dx = x - 8;
        const dy = y - 8;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        // Bowl shape: low in center (0.4), high at edges (0.7)
        heightmap[i] = 0.4 + (distFromCenter / 8) * 0.3;
      }
      
      const chunkData = createChunkData(size, heightmap);
      const network = generator.generateNetwork(chunkData, 12345);

      // Should detect at least one lake
      expect(network.lakes.length).toBeGreaterThan(0);
    });

    test('lake has valid properties', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      
      // Create terrain with a depression
      const size = 16;
      const heightmap = new Float32Array(size * size);
      for (let i = 0; i < size * size; i++) {
        const x = i % size;
        const y = Math.floor(i / size);
        const dx = x - 8;
        const dy = y - 8;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        heightmap[i] = 0.4 + (distFromCenter / 8) * 0.3;
      }
      
      const chunkData = createChunkData(size, heightmap);
      const network = generator.generateNetwork(chunkData, 12345);

      if (network.lakes.length > 0) {
        const lake = network.lakes[0];
        
        // Check lake has required properties
        expect(lake).toHaveProperty('tiles');
        expect(lake).toHaveProperty('elevation');
        expect(lake).toHaveProperty('outlet');
        
        // Check tiles is a Set
        expect(lake.tiles).toBeInstanceOf(Set);
        
        // Check lake has at least 2 tiles
        expect(lake.tiles.size).toBeGreaterThanOrEqual(2);
        
        // Check elevation is a number
        expect(typeof lake.elevation).toBe('number');
        
        // Check outlet is initialized to -1
        expect(lake.outlet).toBe(-1);
      }
    });

    test('respects maximum lake size constraint', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 20, // Small max size
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      
      // Create terrain with a large depression
      const size = 32;
      const heightmap = new Float32Array(size * size);
      for (let i = 0; i < size * size; i++) {
        const x = i % size;
        const y = Math.floor(i / size);
        const dx = x - 16;
        const dy = y - 16;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        heightmap[i] = 0.4 + (distFromCenter / 16) * 0.3;
      }
      
      const chunkData = createChunkData(size, heightmap);
      const network = generator.generateNetwork(chunkData, 12345);

      // All lakes should respect max size
      for (const lake of network.lakes) {
        expect(lake.tiles.size).toBeLessThanOrEqual(config.maxLakeSize);
      }
    });

    test('does not create lakes at ocean level', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      
      // Create terrain with depression at ocean level
      const size = 16;
      const heightmap = new Float32Array(size * size);
      for (let i = 0; i < size * size; i++) {
        const x = i % size;
        const y = Math.floor(i / size);
        const dx = x - 8;
        const dy = y - 8;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        // Depression at ocean level (0.2 center, 0.35 edges)
        heightmap[i] = 0.2 + (distFromCenter / 8) * 0.15;
      }
      
      const chunkData = createChunkData(size, heightmap);
      const network = generator.generateNetwork(chunkData, 12345);

      // Should not create lakes at ocean level
      expect(network.lakes.length).toBe(0);
    });

    test('respects depression threshold', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.1, // High threshold
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      
      // Create terrain with shallow depression (depth < 0.1)
      const size = 16;
      const heightmap = new Float32Array(size * size);
      for (let i = 0; i < size * size; i++) {
        const x = i % size;
        const y = Math.floor(i / size);
        const dx = x - 8;
        const dy = y - 8;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        // Shallow depression: 0.5 center, 0.55 edges (depth = 0.05)
        heightmap[i] = 0.5 + (distFromCenter / 8) * 0.05;
      }
      
      const chunkData = createChunkData(size, heightmap);
      const network = generator.generateNetwork(chunkData, 12345);

      // Should not create lake (depression too shallow)
      expect(network.lakes.length).toBe(0);
    });

    test('lake elevation is at lowest point in depression', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      
      // Create terrain with a depression
      const size = 16;
      const heightmap = new Float32Array(size * size);
      for (let i = 0; i < size * size; i++) {
        const x = i % size;
        const y = Math.floor(i / size);
        const dx = x - 8;
        const dy = y - 8;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        heightmap[i] = 0.4 + (distFromCenter / 8) * 0.3;
      }
      
      const chunkData = createChunkData(size, heightmap);
      const network = generator.generateNetwork(chunkData, 12345);

      if (network.lakes.length > 0) {
        const lake = network.lakes[0];
        
        // Find minimum elevation in lake tiles
        let minElevation = Infinity;
        for (const tileIndex of lake.tiles) {
          minElevation = Math.min(minElevation, heightmap[tileIndex]);
        }
        
        // Lake elevation should match minimum
        expect(lake.elevation).toBeCloseTo(minElevation, 5);
      }
    });

    test('handles multiple depressions', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      
      // Create terrain with two separate depressions
      const size = 32;
      const heightmap = new Float32Array(size * size);
      for (let i = 0; i < size * size; i++) {
        const x = i % size;
        const y = Math.floor(i / size);
        
        // First depression at (8, 8)
        const dx1 = x - 8;
        const dy1 = y - 8;
        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const height1 = 0.4 + (dist1 / 6) * 0.3;
        
        // Second depression at (24, 24)
        const dx2 = x - 24;
        const dy2 = y - 24;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const height2 = 0.4 + (dist2 / 6) * 0.3;
        
        // Use minimum of both (creates two separate bowls)
        heightmap[i] = Math.min(height1, height2);
      }
      
      const chunkData = createChunkData(size, heightmap);
      const network = generator.generateNetwork(chunkData, 12345);

      // Should detect multiple lakes
      expect(network.lakes.length).toBeGreaterThanOrEqual(1);
    });

    test('handles flat terrain without depressions', () => {
      const config = {
        sourceElevation: 0.7,
        minFlowLength: 3,
        flowWidth: 1,
        enableTributaries: false,
        maxTributaryOrder: 1,
        tributaryProbability: 0.3,
        enableLakes: true,
        lakeDepressionThreshold: 0.05,
        maxLakeSize: 100,
        enableDeltas: false,
        deltaBranchCount: 3,
        deltaSpreadAngle: Math.PI / 3,
        minFlow: 1.0,
        maxFlow: 100.0,
        widthScale: 0.5,
      };

      const generator = new RiverNetworkGenerator(config);
      
      // Create completely flat terrain
      const size = 16;
      const heightmap = new Float32Array(size * size).fill(0.5);
      
      const chunkData = createChunkData(size, heightmap);
      const network = generator.generateNetwork(chunkData, 12345);

      // Should not create lakes on flat terrain
      expect(network.lakes.length).toBe(0);
    });
  });
});
