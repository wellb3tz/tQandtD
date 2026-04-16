/**
 * Property-based tests for water material factory
 * 
 * Tests universal correctness properties across randomized configurations
 */

import { describe, test, expect, vi } from 'vitest';
import fc from 'fast-check';
import { createOceanMaterial, createRiverMaterial, createLakeMaterial } from './WaterMaterialFactory';
import type { OceanConfig, RiverConfig, LakeConfig } from './types';

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
    normalMap: fc.constant(undefined), // Skip texture for simplicity
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

describe('WaterMaterialFactory Property Tests', () => {
  // Feature: comprehensive-water-system, Property 12: Water Material Configuration Reflection
  // **Validates: Requirements 5.2**
  test('Ocean material properties exactly match configuration values', () => {
    fc.assert(
      fc.property(
        arbitraryOceanConfig(),
        (config) => {
          const material = createOceanMaterial(config);
          
          // Verify color matches
          expect(colorMatches(material.color, config.color)).toBe(true);
          
          // Verify opacity matches
          expect(material.opacity).toBe(config.opacity);
          
          // Verify shininess matches
          expect(material.shininess).toBe(config.shininess);
          
          // Verify material is transparent
          expect(material.transparent).toBe(true);
          
          // Verify material type
          expect(material.constructor.name).toBe('MeshPhongMaterial');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 12: Water Material Configuration Reflection
  // **Validates: Requirements 5.2**
  test('River material properties exactly match configuration values', () => {
    fc.assert(
      fc.property(
        arbitraryRiverConfig(),
        (config) => {
          const material = createRiverMaterial(config);
          
          // Verify color matches
          expect(colorMatches(material.color, config.color)).toBe(true);
          
          // Verify opacity matches
          expect(material.opacity).toBe(config.opacity);
          
          // Verify shininess matches
          expect(material.shininess).toBe(config.shininess);
          
          // Verify material is transparent
          expect(material.transparent).toBe(true);
          
          // Verify material type
          expect(material.constructor.name).toBe('MeshPhongMaterial');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 12: Water Material Configuration Reflection
  // **Validates: Requirements 5.2**
  test('Lake material properties exactly match configuration values', () => {
    fc.assert(
      fc.property(
        arbitraryLakeConfig(),
        (config) => {
          const material = createLakeMaterial(config);
          
          // Verify color matches
          expect(colorMatches(material.color, config.color)).toBe(true);
          
          // Verify opacity matches
          expect(material.opacity).toBe(config.opacity);
          
          // Verify shininess matches
          expect(material.shininess).toBe(config.shininess);
          
          // Verify material is transparent
          expect(material.transparent).toBe(true);
          
          // Verify material type
          expect(material.constructor.name).toBe('MeshPhongMaterial');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: comprehensive-water-system, Property 12: Water Material Configuration Reflection
  // **Validates: Requirements 5.2**
  test('All water material types reflect their configuration independently', () => {
    fc.assert(
      fc.property(
        arbitraryOceanConfig(),
        arbitraryRiverConfig(),
        arbitraryLakeConfig(),
        (oceanConfig, riverConfig, lakeConfig) => {
          const oceanMaterial = createOceanMaterial(oceanConfig);
          const riverMaterial = createRiverMaterial(riverConfig);
          const lakeMaterial = createLakeMaterial(lakeConfig);
          
          // Each material should match its own configuration
          expect(colorMatches(oceanMaterial.color, oceanConfig.color)).toBe(true);
          expect(oceanMaterial.opacity).toBe(oceanConfig.opacity);
          expect(oceanMaterial.shininess).toBe(oceanConfig.shininess);
          
          expect(colorMatches(riverMaterial.color, riverConfig.color)).toBe(true);
          expect(riverMaterial.opacity).toBe(riverConfig.opacity);
          expect(riverMaterial.shininess).toBe(riverConfig.shininess);
          
          expect(colorMatches(lakeMaterial.color, lakeConfig.color)).toBe(true);
          expect(lakeMaterial.opacity).toBe(lakeConfig.opacity);
          expect(lakeMaterial.shininess).toBe(lakeConfig.shininess);
        }
      ),
      { numRuns: 100 }
    );
  });
});
