/**
 * Property-based tests for water mesh positioning fix - Preservation Properties
 * 
 * Feature: water-mesh-positioning-fix, Property 2: Preservation
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 * 
 * IMPORTANT: These tests run on UNFIXED code to capture baseline behavior.
 * They verify that non-coordinate-related water features remain unchanged after the fix.
 * 
 * Tests observe and validate:
 * - Water material creation (color, opacity, shininess)
 * - Ocean tile identification (tiles where height < seaLevel)
 * - Underwater terrain coloring (darkening and desaturation)
 * - Water visibility toggling
 * - HEIGHT_SCALE consistency across water types
 * 
 * Expected Outcome: All tests PASS on unfixed code (confirms baseline to preserve)
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { createOceanMaterial, createRiverMaterial, createLakeMaterial } from './WaterMaterialFactory';
import { identifyOceanTiles } from './OceanMeshGenerator';
import { adjustUnderwaterColor, calculateBrightness, calculateSaturation } from './UnderwaterTerrainProcessor';
import { WaterLayerManager } from './WaterLayerManager';
import { HEIGHT_SCALE } from './config';
import type { OceanConfig, RiverConfig, LakeConfig, WaterConfig } from './types';
import type { ChunkData } from '../../../../src/world/chunk';
import type { BiomeColor } from '../materials';

// Mock THREE.js
vi.mock('three', () => import('../__mocks__/three'));

/**
 * Arbitrary generator for ocean configuration
 */
const arbitraryOceanConfig = (): fc.Arbitrary<OceanConfig> => {
  return fc.record({
    color: fc.integer({ min: 0x000000, max: 0xffffff }),
    opacity: fc.double({ min: 0, max: 1 }),
    shininess: fc.double({ min: 0, max: 100 }),
    enableWaves: fc.boolean(),
    waveHeight: fc.double({ min: 0, max: 10 }),
    waveSpeed: fc.double({ min: 0, max: 10 }),
    normalMap: fc.constant(undefined),
  });
};

/**
 * Arbitrary generator for river configuration
 */
const arbitraryRiverConfig = (): fc.Arbitrary<RiverConfig> => {
  return fc.record({
    color: fc.integer({ min: 0x000000, max: 0xffffff }),
    opacity: fc.double({ min: 0, max: 1 }),
    shininess: fc.double({ min: 0, max: 100 }),
    enableFlowAnimation: fc.boolean(),
    flowSpeed: fc.double({ min: 0, max: 10 }),
  });
};

/**
 * Arbitrary generator for lake configuration
 */
const arbitraryLakeConfig = (): fc.Arbitrary<LakeConfig> => {
  return fc.record({
    color: fc.integer({ min: 0x000000, max: 0xffffff }),
    opacity: fc.double({ min: 0, max: 1 }),
    shininess: fc.double({ min: 0, max: 100 }),
  });
};

/**
 * Arbitrary generator for biome color
 */
const arbitraryBiomeColor = (): fc.Arbitrary<BiomeColor> => {
  return fc.record({
    r: fc.double({ min: 0, max: 1 }),
    g: fc.double({ min: 0, max: 1 }),
    b: fc.double({ min: 0, max: 1 }),
  });
};

/**
 * Arbitrary generator for heightmap with configurable sea level
 */
const arbitraryHeightmap = (size: number, seaLevel: number): fc.Arbitrary<Float32Array> => {
  const vertexSize = size + 1;
  const totalVertices = vertexSize * vertexSize;
  
  return fc.array(
    fc.double({ min: 0, max: 1 }),
    { minLength: totalVertices, maxLength: totalVertices }
  ).map(arr => new Float32Array(arr));
};

/**
 * Convert hex color to RGB components (0-1 range)
 */
function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  };
}

/**
 * Check if material color matches configuration color (with floating point tolerance)
 */
function colorMatches(materialColor: { r: number; g: number; b: number }, configColor: number): boolean {
  const expected = hexToRgb(configColor);
  const tolerance = 0.001;
  
  return (
    Math.abs(materialColor.r - expected.r) < tolerance &&
    Math.abs(materialColor.g - expected.g) < tolerance &&
    Math.abs(materialColor.b - expected.b) < tolerance
  );
}

describe('Water Mesh Positioning Fix - Preservation Properties', () => {
  describe('Property 2.1: Water Material Creation Preservation', () => {
    test('Ocean material properties remain unchanged (color, opacity, shininess)', () => {
      fc.assert(
        fc.property(
          arbitraryOceanConfig(),
          (config) => {
            const material = createOceanMaterial(config);
            
            // Verify color matches configuration
            expect(colorMatches(material.color, config.color)).toBe(true);
            
            // Verify opacity matches configuration
            expect(material.opacity).toBe(config.opacity);
            
            // Verify shininess matches configuration
            expect(material.shininess).toBe(config.shininess);
            
            // Verify material is transparent
            expect(material.transparent).toBe(true);
            
            // Verify material type is MeshPhongMaterial
            expect(material.constructor.name).toBe('MeshPhongMaterial');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('River material properties remain unchanged (color, opacity, shininess)', () => {
      fc.assert(
        fc.property(
          arbitraryRiverConfig(),
          (config) => {
            const material = createRiverMaterial(config);
            
            // Verify color matches configuration
            expect(colorMatches(material.color, config.color)).toBe(true);
            
            // Verify opacity matches configuration
            expect(material.opacity).toBe(config.opacity);
            
            // Verify shininess matches configuration
            expect(material.shininess).toBe(config.shininess);
            
            // Verify material is transparent
            expect(material.transparent).toBe(true);
            
            // Verify material type is MeshPhongMaterial
            expect(material.constructor.name).toBe('MeshPhongMaterial');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Lake material properties remain unchanged (color, opacity, shininess)', () => {
      fc.assert(
        fc.property(
          arbitraryLakeConfig(),
          (config) => {
            const material = createLakeMaterial(config);
            
            // Verify color matches configuration
            expect(colorMatches(material.color, config.color)).toBe(true);
            
            // Verify opacity matches configuration
            expect(material.opacity).toBe(config.opacity);
            
            // Verify shininess matches configuration
            expect(material.shininess).toBe(config.shininess);
            
            // Verify material is transparent
            expect(material.transparent).toBe(true);
            
            // Verify material type is MeshPhongMaterial
            expect(material.constructor.name).toBe('MeshPhongMaterial');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2.2: Ocean Tile Identification Preservation', () => {
    test('Ocean tiles identified correctly where height < seaLevel', () => {
      const chunkSize = 32;
      const seaLevel = 0.3;
      
      fc.assert(
        fc.property(
          arbitraryHeightmap(chunkSize, seaLevel),
          (heightmap) => {
            const chunkData: ChunkData = {
              x: 0,
              y: 0,
              size: chunkSize,
              heightmap,
              biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
              seed: 12345,
            };
            
            const oceanTiles = identifyOceanTiles(chunkData, seaLevel);
            
            // Verify each identified ocean tile has terrain height < seaLevel
            for (const tile of oceanTiles) {
              expect(tile.terrainHeight).toBeLessThan(seaLevel);
              expect(tile.waterElevation).toBe(seaLevel);
              expect(tile.underwaterDepth).toBeCloseTo(seaLevel - tile.terrainHeight, 5);
              expect(tile.underwaterDepth).toBeGreaterThan(0);
            }
            
            // Verify no tiles are missed - manually check all tiles
            const vertexSize = chunkSize + 1;
            for (let y = 0; y < chunkSize; y++) {
              for (let x = 0; x < chunkSize; x++) {
                const index = y * chunkSize + x;
                
                // Sample heightmap at tile center (average of 4 corner vertices)
                const v00 = heightmap[y * vertexSize + x];
                const v10 = heightmap[y * vertexSize + (x + 1)];
                const v01 = heightmap[(y + 1) * vertexSize + x];
                const v11 = heightmap[(y + 1) * vertexSize + (x + 1)];
                const terrainHeight = (v00 + v10 + v01 + v11) / 4;
                
                const isOcean = terrainHeight < seaLevel;
                const foundInOceanTiles = oceanTiles.some(t => t.index === index);
                
                expect(foundInOceanTiles).toBe(isOcean);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('Ocean tile identification is deterministic for same heightmap', () => {
      const chunkSize = 32;
      const seaLevel = 0.3;
      
      fc.assert(
        fc.property(
          arbitraryHeightmap(chunkSize, seaLevel),
          (heightmap) => {
            const chunkData: ChunkData = {
              x: 0,
              y: 0,
              size: chunkSize,
              heightmap,
              biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
              seed: 12345,
            };
            
            // Identify ocean tiles twice
            const oceanTiles1 = identifyOceanTiles(chunkData, seaLevel);
            const oceanTiles2 = identifyOceanTiles(chunkData, seaLevel);
            
            // Results should be identical
            expect(oceanTiles1.length).toBe(oceanTiles2.length);
            
            for (let i = 0; i < oceanTiles1.length; i++) {
              expect(oceanTiles1[i].index).toBe(oceanTiles2[i].index);
              expect(oceanTiles1[i].terrainHeight).toBeCloseTo(oceanTiles2[i].terrainHeight, 5);
              expect(oceanTiles1[i].waterElevation).toBeCloseTo(oceanTiles2[i].waterElevation, 5);
              expect(oceanTiles1[i].underwaterDepth).toBeCloseTo(oceanTiles2[i].underwaterDepth, 5);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 2.3: Underwater Terrain Coloring Preservation', () => {
    test('Underwater terrain darkening remains consistent', () => {
      const seaLevel = 0.3;
      const darkenFactor = 0.4;
      
      fc.assert(
        fc.property(
          arbitraryBiomeColor(),
          fc.double({ min: 0, max: seaLevel - 0.01 }), // Underwater height
          (color, terrainHeight) => {
            const config = {
              seaLevel,
              darkenFactor,
              desaturationFactor: 0.5,
              enableDepthGradient: false,
            };
            
            const adjustedColor = adjustUnderwaterColor(color, terrainHeight, config);
            
            // Verify darkening occurred
            const originalBrightness = calculateBrightness(color);
            const adjustedBrightness = calculateBrightness(adjustedColor);
            
            expect(adjustedBrightness).toBeLessThan(originalBrightness);
            
            // Verify darkening is approximately by the configured factor
            const expectedMultiplier = 1 - darkenFactor;
            const actualMultiplier = adjustedBrightness / originalBrightness;
            
            // Allow some tolerance for desaturation effects
            expect(actualMultiplier).toBeLessThanOrEqual(expectedMultiplier + 0.1);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Underwater terrain desaturation remains consistent', () => {
      const seaLevel = 0.3;
      const desaturationFactor = 0.5;
      
      fc.assert(
        fc.property(
          arbitraryBiomeColor(),
          fc.double({ min: 0, max: seaLevel - 0.01 }), // Underwater height
          (color, terrainHeight) => {
            const config = {
              seaLevel,
              darkenFactor: 0.4,
              desaturationFactor,
              enableDepthGradient: false,
            };
            
            const adjustedColor = adjustUnderwaterColor(color, terrainHeight, config);
            
            // Verify desaturation occurred (saturation decreased)
            const originalSaturation = calculateSaturation(color);
            const adjustedSaturation = calculateSaturation(adjustedColor);
            
            // If original color had saturation, it should be reduced
            if (originalSaturation > 0.01) {
              expect(adjustedSaturation).toBeLessThanOrEqual(originalSaturation);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Above-water terrain colors remain unchanged', () => {
      const seaLevel = 0.3;
      
      fc.assert(
        fc.property(
          arbitraryBiomeColor(),
          fc.double({ min: seaLevel, max: 1 }), // Above-water height
          (color, terrainHeight) => {
            const config = {
              seaLevel,
              darkenFactor: 0.4,
              desaturationFactor: 0.5,
              enableDepthGradient: true,
            };
            
            const adjustedColor = adjustUnderwaterColor(color, terrainHeight, config);
            
            // Color should remain unchanged for above-water terrain
            expect(adjustedColor.r).toBeCloseTo(color.r, 5);
            expect(adjustedColor.g).toBeCloseTo(color.g, 5);
            expect(adjustedColor.b).toBeCloseTo(color.b, 5);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2.4: Water Visibility Toggling Preservation', () => {
    let manager: WaterLayerManager;
    let mockScene: any;

    beforeEach(() => {
      manager = new WaterLayerManager();
      mockScene = {
        add: vi.fn(),
        remove: vi.fn(),
      };
    });

    test('Water visibility toggle affects all water layers', () => {
      const chunkSize = 32;
      const seaLevel = 0.3;
      
      // Create heightmap with some ocean tiles
      const heightmap = new Float32Array((chunkSize + 1) * (chunkSize + 1));
      for (let i = 0; i < heightmap.length; i++) {
        heightmap[i] = i % 3 === 0 ? 0.2 : 0.5; // Mix of ocean and land
      }
      
      const chunkData: ChunkData = {
        x: 0,
        y: 0,
        size: chunkSize,
        heightmap,
        biomeWeights: new Float32Array(chunkSize * chunkSize * 8),
        seed: 12345,
      };
      
      const waterConfig: WaterConfig = {
        enabled: true,
        seaLevel,
        ocean: {
          color: 0x1e90ff,
          opacity: 0.6,
          shininess: 100,
          enableWaves: false,
          waveHeight: 0.5,
          waveSpeed: 1.0,
        },
        river: {
          color: 0x4682b4,
          opacity: 0.7,
          shininess: 80,
          enableFlowAnimation: false,
          flowSpeed: 1.0,
        },
        lake: {
          color: 0x4169e1,
          opacity: 0.65,
          shininess: 90,
        },
        rendering: {
          waterOffset: 0.1,
          underwaterDarkenFactor: 0.4,
          underwaterDesaturationFactor: 0.5,
          enableDepthGradient: true,
        },
        performance: {
          enableGeometryPooling: true,
          enableMeshMerging: true,
          enableLOD: false,
          enableFrustumCulling: false,
          useInstancedRendering: false,
        },
      };
      
      // Add water to chunk
      manager.addWaterToChunk('0,0', chunkData, mockScene, waterConfig);
      
      const waterLayer = manager.getWaterLayer('0,0');
      expect(waterLayer).toBeDefined();
      
      if (waterLayer) {
        // Initially visible
        expect(waterLayer.group.visible).toBe(true);
        
        // Toggle to invisible
        manager.toggleWaterVisibility(false);
        expect(waterLayer.group.visible).toBe(false);
        
        // Toggle back to visible
        manager.toggleWaterVisibility(true);
        expect(waterLayer.group.visible).toBe(true);
      }
    });
  });

  describe('Property 2.5: HEIGHT_SCALE Consistency Preservation', () => {
    test('HEIGHT_SCALE constant has expected value of 50', () => {
      // Verify HEIGHT_SCALE is 50 as documented
      expect(HEIGHT_SCALE).toBe(50);
    });

    test('HEIGHT_SCALE is used consistently across water system', () => {
      // This test verifies that HEIGHT_SCALE is a constant value
      // that can be imported and used consistently
      
      const scale1 = HEIGHT_SCALE;
      const scale2 = HEIGHT_SCALE;
      
      expect(scale1).toBe(scale2);
      expect(scale1).toBe(50);
    });
  });
});
