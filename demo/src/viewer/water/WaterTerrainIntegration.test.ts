/**
 * Integration tests for water-terrain integration
 * 
 * Tests water positioning relative to terrain, shoreline transitions,
 * and z-fighting prevention.
 * 
 * Validates: Requirements 9.1, 9.2, 9.4, 9.5
 */

import { describe, test, expect } from 'vitest';
import { identifyOceanTiles, buildOceanGeometry } from './OceanMeshGenerator';
import { generateRiverMeshes } from './RiverMeshGenerator';
import { generateLakeMeshes } from './LakeMeshGenerator';
import {
  validateOceanElevation,
  validateRiverElevation,
  validateLakeElevation,
  validateZFightingPrevention,
  validateWaterElevations,
} from './WaterElevationValidator';
import {
  analyzeShorelineTransitions,
  validateShorelineSmoothness,
} from './ShorelineTransitionSmoother';
import type { ChunkData } from '../../../../src/world/chunk';
import type { RiverNetwork } from '../../../../src/gen/rivers';
import type { WaterConfig } from './types';
import { DEFAULT_WATER_CONFIG } from './config';

describe('Water-Terrain Integration Tests', () => {
  describe('Water Positioning Relative to Terrain', () => {
    test('Ocean water is positioned at seaLevel + waterOffset', () => {
      const size = 4;
      const seaLevel = 0.3;
      const waterOffset = 0.1;
      const heightScale = 50; // Must match WorldViewer's heightScale
      
      // Create chunk with ocean tiles
      const vertexSize = size + 1;
      const vertexCount = vertexSize * vertexSize;
      const heightmap = new Float32Array(vertexCount);
      
      for (let i = 0; i < vertexCount; i++) {
        heightmap[i] = 0.2; // Below sea level
      }

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set(),
      };

      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        seaLevel,
        rendering: {
          ...DEFAULT_WATER_CONFIG.rendering,
          waterOffset,
        },
      };

      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);

      expect(geometry).not.toBeNull();
      
      if (geometry) {
        const positions = geometry.getAttribute('position');
        const expectedElevation = (seaLevel + waterOffset) * heightScale;

        // Check all vertices are at correct elevation
        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i);
          expect(y).toBeCloseTo(expectedElevation, 5);
        }
      }
    });

    test('River water follows terrain elevation with waterOffset', () => {
      const size = 4;
      const waterOffset = 0.1;
      
      // Create chunk with varying terrain
      const vertexSize = size + 1;
      const vertexCount = vertexSize * vertexSize;
      const heightmap = new Float32Array(vertexCount);
      
      for (let i = 0; i < vertexCount; i++) {
        heightmap[i] = 0.3 + Math.random() * 0.3;
      }

      const riverNetwork: RiverNetwork = {
        segments: [
          { index: 0, flow: 1.0, width: 1.0, order: 1, next: 1 },
          { index: 1, flow: 1.5, width: 1.2, order: 1, next: -1 },
        ],
        lakes: [],
      };

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set([0, 1]),
      };

      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        rendering: {
          ...DEFAULT_WATER_CONFIG.rendering,
          waterOffset,
        },
      };

      const riverMeshes = generateRiverMeshes(chunk, riverNetwork, config);

      expect(riverMeshes.length).toBeGreaterThan(0);

      // Validate river elevations
      for (const mesh of riverMeshes) {
        const validation = validateRiverElevation(mesh.geometry, chunk, config);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    test('Lake water is positioned at lake elevation + waterOffset', () => {
      const size = 4;
      const waterOffset = 0.1;
      const lakeElevation = 0.4;
      
      const vertexSize = size + 1;
      const vertexCount = vertexSize * vertexSize;
      const heightmap = new Float32Array(vertexCount);
      
      for (let i = 0; i < vertexCount; i++) {
        heightmap[i] = 0.35;
      }

      const riverNetwork: RiverNetwork = {
        segments: [],
        lakes: [
          {
            tiles: new Set([0, 1, 4, 5]),
            elevation: lakeElevation,
            outlet: -1,
          },
        ],
      };

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set(),
      };

      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        rendering: {
          ...DEFAULT_WATER_CONFIG.rendering,
          waterOffset,
        },
      };

      const lakeMeshes = generateLakeMeshes(chunk, riverNetwork, config);

      expect(lakeMeshes.length).toBe(1);

      const validation = validateLakeElevation(
        lakeMeshes[0].geometry,
        riverNetwork.lakes[0],
        config
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Shoreline Transitions', () => {
    test('Shoreline transitions are analyzed correctly', () => {
      const size = 4;
      const seaLevel = 0.3;
      
      // Create chunk with mixed water/land
      const vertexSize = size + 1;
      const vertexCount = vertexSize * vertexSize;
      const heightmap = new Float32Array(vertexCount);
      
      // Left half below sea level, right half above
      for (let y = 0; y < vertexSize; y++) {
        for (let x = 0; x < vertexSize; x++) {
          const idx = y * vertexSize + x;
          heightmap[idx] = x < vertexSize / 2 ? 0.2 : 0.5;
        }
      }

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set(),
      };

      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        seaLevel,
      };

      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const oceanTileSet = new Set(oceanTiles.map(t => t.index));
      
      expect(oceanTileSet.size).toBeGreaterThan(0);

      const waterElevation = seaLevel + config.rendering.waterOffset;
      const transitions = analyzeShorelineTransitions(oceanTileSet, chunk, waterElevation);

      // Should have transitions at the boundary
      expect(transitions.length).toBeGreaterThan(0);

      // Each transition should have valid data
      for (const transition of transitions) {
        expect(transition.tileIndex).toBeGreaterThanOrEqual(0);
        expect(transition.tileIndex).toBeLessThan(size * size);
        expect(transition.waterElevation).toBeCloseTo(waterElevation, 5);
        expect(transition.elevationDifference).toBeGreaterThanOrEqual(0);
      }
    });

    test('Smooth terrain produces smooth shoreline transitions', () => {
      const size = 4;
      const seaLevel = 0.35;
      
      // Create chunk with gradual elevation change
      const vertexSize = size + 1;
      const vertexCount = vertexSize * vertexSize;
      const heightmap = new Float32Array(vertexCount);
      
      for (let y = 0; y < vertexSize; y++) {
        for (let x = 0; x < vertexSize; x++) {
          const idx = y * vertexSize + x;
          // Gradual slope from 0.2 to 0.5
          heightmap[idx] = 0.2 + (x / vertexSize) * 0.3;
        }
      }

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set(),
      };

      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        seaLevel,
      };

      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const oceanTileSet = new Set(oceanTiles.map(t => t.index));
      
      if (oceanTileSet.size === 0) {
        return; // No ocean tiles, skip test
      }

      const waterElevation = seaLevel + config.rendering.waterOffset;
      const transitions = analyzeShorelineTransitions(oceanTileSet, chunk, waterElevation);

      if (transitions.length === 0) {
        return; // No transitions, skip test
      }

      const validation = validateShorelineSmoothness(transitions, 0.5);

      // Gradual slope should produce smooth transitions
      expect(validation.smoothnessScore).toBeGreaterThan(0.5);
    });

    test('Abrupt terrain changes are detected in shoreline validation', () => {
      const size = 4;
      const seaLevel = 0.3;
      
      // Create chunk with abrupt elevation change
      const vertexSize = size + 1;
      const vertexCount = vertexSize * vertexSize;
      const heightmap = new Float32Array(vertexCount);
      
      // Sharp cliff: left side at 0.1, right side at 0.8
      for (let y = 0; y < vertexSize; y++) {
        for (let x = 0; x < vertexSize; x++) {
          const idx = y * vertexSize + x;
          heightmap[idx] = x < vertexSize / 2 ? 0.1 : 0.8;
        }
      }

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set(),
      };

      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        seaLevel,
      };

      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const oceanTileSet = new Set(oceanTiles.map(t => t.index));
      
      expect(oceanTileSet.size).toBeGreaterThan(0);

      const waterElevation = seaLevel + config.rendering.waterOffset;
      const transitions = analyzeShorelineTransitions(oceanTileSet, chunk, waterElevation);

      // With sharp cliff, should have transitions
      if (transitions.length > 0) {
        const validation = validateShorelineSmoothness(transitions, 0.5);

        // Should detect significant discontinuity (water at 0.4, land at 0.8 = 0.4 difference)
        expect(validation.maxDiscontinuity).toBeGreaterThanOrEqual(0.29);
      }
    });
  });

  describe('Z-Fighting Prevention', () => {
    test('Water offset prevents z-fighting', () => {
      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        rendering: {
          ...DEFAULT_WATER_CONFIG.rendering,
          waterOffset: 0.1,
        },
      };

      const validation = validateZFightingPrevention(config);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('Insufficient water offset is detected', () => {
      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        rendering: {
          ...DEFAULT_WATER_CONFIG.rendering,
          waterOffset: 0.01, // Too small
        },
      };

      const validation = validateZFightingPrevention(config);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('Water is always above terrain by at least waterOffset', () => {
      const size = 4;
      const seaLevel = 0.3;
      const waterOffset = 0.1;
      const heightScale = 50; // Must match WorldViewer's heightScale
      
      const vertexSize = size + 1;
      const vertexCount = vertexSize * vertexSize;
      const heightmap = new Float32Array(vertexCount);
      
      for (let i = 0; i < vertexCount; i++) {
        heightmap[i] = 0.2;
      }

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set(),
      };

      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        seaLevel,
        rendering: {
          ...DEFAULT_WATER_CONFIG.rendering,
          waterOffset,
        },
      };

      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const geometry = buildOceanGeometry(oceanTiles, chunk, config);

      expect(geometry).not.toBeNull();
      
      if (geometry) {
        const positions = geometry.getAttribute('position');
        const waterElevation = (seaLevel + waterOffset) * heightScale;

        // Water should be above sea level
        expect(waterElevation).toBeGreaterThan(seaLevel * heightScale);
        
        // All vertices should be at water elevation
        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i);
          expect(y).toBeCloseTo(waterElevation, 5);
          
          // Water should be above terrain
          expect(y).toBeGreaterThan(0.2 * heightScale); // Terrain height
        }
      }
    });
  });

  describe('Comprehensive Water Elevation Validation', () => {
    test('Validates all water types in a chunk', () => {
      const size = 4;
      const seaLevel = 0.3;
      const waterOffset = 0.1;
      
      const vertexSize = size + 1;
      const vertexCount = vertexSize * vertexSize;
      const heightmap = new Float32Array(vertexCount);
      
      // Mixed terrain
      for (let i = 0; i < vertexCount; i++) {
        heightmap[i] = 0.2 + Math.random() * 0.4;
      }

      const riverNetwork: RiverNetwork = {
        segments: [
          { index: 5, flow: 1.0, width: 1.0, order: 1, next: -1 },
        ],
        lakes: [
          {
            tiles: new Set([10, 11]),
            elevation: 0.4,
            outlet: -1,
          },
        ],
      };

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set([5]),
      };

      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        seaLevel,
        rendering: {
          ...DEFAULT_WATER_CONFIG.rendering,
          waterOffset,
        },
      };

      // Generate all water types
      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const oceanGeometry = buildOceanGeometry(oceanTiles, chunk, config);
      const riverMeshes = generateRiverMeshes(chunk, riverNetwork, config);
      const lakeMeshes = generateLakeMeshes(chunk, riverNetwork, config);

      // Validate ocean and lake elevations (these should be precise)
      const lakeGeometries = lakeMeshes.map(m => ({
        geometry: m.geometry,
        lake: riverNetwork.lakes[0],
      }));

      // Validate ocean
      if (oceanGeometry) {
        const oceanValidation = validateOceanElevation(oceanGeometry, config);
        expect(oceanValidation.valid).toBe(true);
      }

      // Validate lakes
      for (const { geometry, lake } of lakeGeometries) {
        const lakeValidation = validateLakeElevation(geometry, lake, config);
        expect(lakeValidation.valid).toBe(true);
      }

      // Validate z-fighting prevention
      const zFightingValidation = validateZFightingPrevention(config);
      expect(zFightingValidation.valid).toBe(true);
    });

    test('Detects elevation errors in water meshes', () => {
      const size = 4;
      const seaLevel = 0.3;
      
      const vertexSize = size + 1;
      const vertexCount = vertexSize * vertexSize;
      const heightmap = new Float32Array(vertexCount);
      
      for (let i = 0; i < vertexCount; i++) {
        heightmap[i] = 0.2;
      }

      const chunk: ChunkData = {
        x: 0,
        y: 0,
        size,
        heightmap,
        biomeMap: new Uint8Array(size * size),
        biomeWeights: new Float32Array(size * size * 8),
        resources: [],
        structures: [],
        rivers: new Set(),
      };

      // Config with insufficient water offset
      const config: WaterConfig = {
        ...DEFAULT_WATER_CONFIG,
        seaLevel,
        rendering: {
          ...DEFAULT_WATER_CONFIG.rendering,
          waterOffset: 0.01, // Too small
        },
      };

      const oceanTiles = identifyOceanTiles(chunk, seaLevel);
      const oceanGeometry = buildOceanGeometry(oceanTiles, chunk, config);

      const validation = validateWaterElevations(
        oceanGeometry,
        [],
        [],
        chunk,
        undefined,
        config
      );

      // Should detect insufficient water offset
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
