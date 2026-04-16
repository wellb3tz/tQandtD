/**
 * Property test: Underwater Terrain Color Exclusion
 * 
 * Feature: comprehensive-water-system, Property 5: Underwater Terrain Color Exclusion
 * Validates: Requirements 1.5, 6.4, 6.5
 * 
 * Verifies that underwater terrain colors are NOT ocean biome colors,
 * but are derived from underlying terrain biomes.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  adjustUnderwaterColors,
  type UnderwaterAdjustmentConfig,
} from './UnderwaterTerrainProcessor';
import { BiomeType } from '../../../../src/world/chunk';
import { BIOME_COLORS } from '../materials';

describe('Property 5: Underwater Terrain Color Exclusion', () => {
  const seaLevel = 0.3;
  const config: UnderwaterAdjustmentConfig = {
    seaLevel,
    darkenFactor: 0.4,
    desaturationFactor: 0.5,
    enableDepthGradient: true,
  };

  /**
   * Check if two colors are approximately equal
   */
  function colorsEqual(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): boolean {
    const epsilon = 0.01;
    return (
      Math.abs(c1.r - c2.r) < epsilon &&
      Math.abs(c1.g - c2.g) < epsilon &&
      Math.abs(c1.b - c2.b) < epsilon
    );
  }

  it('Feature: comprehensive-water-system, Property 5: Underwater Terrain Color Exclusion', () => {
    // Arbitrary chunk size (2-8)
    const arbChunkSize = fc.integer({ min: 2, max: 8 });

    // Arbitrary underwater height (below sea level)
    const arbUnderwaterHeight = fc.float({ min: 0, max: Math.fround(seaLevel - 0.01) });

    // Arbitrary biome weights with ocean biome present
    const arbBiomeWeights = (chunkSize: number) =>
      fc.array(
        fc.record({
          oceanWeight: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
          otherBiome: fc.integer({ min: 1, max: 7 }) as fc.Arbitrary<BiomeType>,
          otherWeight: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
        }),
        { minLength: chunkSize * chunkSize, maxLength: chunkSize * chunkSize }
      );

    fc.assert(
      fc.property(
        arbChunkSize,
        arbUnderwaterHeight,
        fc.integer({ min: 0, max: 100 }), // seed for variation
        (chunkSize, underwaterHeight, seed) => {
          // Generate heightmap with all tiles underwater
          const heightmap = new Float32Array(chunkSize * chunkSize).fill(underwaterHeight);

          // Generate biome weights with ocean biome present
          const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);
          for (let i = 0; i < chunkSize * chunkSize; i++) {
            // Use seed to vary biome distribution
            const oceanWeight = ((seed + i * 7) % 100) / 100;
            const otherBiome = ((seed + i * 13) % 7) + 1; // 1-7 (exclude ocean)
            const otherWeight = 1 - oceanWeight;

            biomeWeights[i * 8 + BiomeType.OCEAN] = oceanWeight;
            biomeWeights[i * 8 + otherBiome] = otherWeight;
          }

          // Adjust underwater colors
          const colors = adjustUnderwaterColors(heightmap, biomeWeights, chunkSize, config);

          // Verify no colors match ocean biome color
          const oceanColor = BIOME_COLORS[BiomeType.OCEAN];

          for (const color of colors) {
            // Underwater terrain should NOT use ocean biome color
            expect(colorsEqual(color, oceanColor)).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use underlying terrain biome when ocean biome is present', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.float({ min: 0, max: Math.fround(seaLevel - 0.01) }),
        fc.integer({ min: 1, max: 7 }) as fc.Arbitrary<BiomeType>,
        (chunkSize, underwaterHeight, underlyingBiome) => {
          // Create heightmap with all tiles underwater
          const heightmap = new Float32Array(chunkSize * chunkSize).fill(underwaterHeight);

          // Create biome weights: 50% ocean, 50% underlying biome
          const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);
          for (let i = 0; i < chunkSize * chunkSize; i++) {
            biomeWeights[i * 8 + BiomeType.OCEAN] = 0.5;
            biomeWeights[i * 8 + underlyingBiome] = 0.5;
          }

          // Adjust underwater colors
          const colors = adjustUnderwaterColors(heightmap, biomeWeights, chunkSize, config);

          // Verify colors are derived from underlying biome, not ocean
          const oceanColor = BIOME_COLORS[BiomeType.OCEAN];
          const underlyingColor = BIOME_COLORS[underlyingBiome];

          for (const color of colors) {
            // Should not be ocean color
            expect(colorsEqual(color, oceanColor)).toBe(false);

            // Should be darkened/desaturated version of underlying biome
            // (brightness should be less than or equal to original, allowing for edge cases)
            const colorBrightness = Math.max(color.r, color.g, color.b);
            const underlyingBrightness = Math.max(underlyingColor.r, underlyingColor.g, underlyingColor.b);
            expect(colorBrightness).toBeLessThanOrEqual(underlyingBrightness);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should fallback to beach color when only ocean biome present', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.float({ min: 0, max: Math.fround(seaLevel - 0.01) }),
        (chunkSize, underwaterHeight) => {
          // Create heightmap with all tiles underwater
          const heightmap = new Float32Array(chunkSize * chunkSize).fill(underwaterHeight);

          // Create biome weights: 100% ocean
          const biomeWeights = new Float32Array(chunkSize * chunkSize * 8);
          for (let i = 0; i < chunkSize * chunkSize; i++) {
            biomeWeights[i * 8 + BiomeType.OCEAN] = 1.0;
          }

          // Adjust underwater colors
          const colors = adjustUnderwaterColors(heightmap, biomeWeights, chunkSize, config);

          // Verify colors are NOT ocean color
          const oceanColor = BIOME_COLORS[BiomeType.OCEAN];

          for (const color of colors) {
            expect(colorsEqual(color, oceanColor)).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
