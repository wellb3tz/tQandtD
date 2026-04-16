/**
 * Property test: Underwater Color Darkening
 * 
 * Feature: comprehensive-water-system, Property 7: Underwater Color Darkening
 * Validates: Requirements 2.5, 6.1, 6.2
 * 
 * Verifies that underwater terrain colors are darkened by a factor
 * between 0.3 and 0.5 (30-50%) compared to above-water biome colors.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  adjustUnderwaterColor,
  darkenColor,
  calculateBrightness,
  type UnderwaterAdjustmentConfig,
} from './UnderwaterTerrainProcessor';
import type { BiomeColor } from '../materials';

describe('Property 7: Underwater Color Darkening', () => {
  const seaLevel = 0.3;
  const config: UnderwaterAdjustmentConfig = {
    seaLevel,
    darkenFactor: 0.4,
    desaturationFactor: 0.5,
    enableDepthGradient: true,
  };

  /**
   * Calculate effective darkening factor from original and adjusted colors
   */
  function calculateDarkenFactor(original: BiomeColor, adjusted: BiomeColor): number {
    const originalBrightness = calculateBrightness(original);
    const adjustedBrightness = calculateBrightness(adjusted);

    if (originalBrightness === 0) {
      return 0;
    }

    return 1 - adjustedBrightness / originalBrightness;
  }

  it('Feature: comprehensive-water-system, Property 7: Underwater Color Darkening', () => {
    // Arbitrary color (non-black to avoid division by zero)
    const arbColor = fc.record({
      r: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
      g: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
      b: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
    });

    // Arbitrary underwater height (below sea level)
    const arbUnderwaterHeight = fc.float({ min: 0, max: Math.fround(seaLevel - 0.01), noNaN: true });

    fc.assert(
      fc.property(arbColor, arbUnderwaterHeight, (color, terrainHeight) => {
        // Adjust underwater color
        const adjustedColor = adjustUnderwaterColor(color, terrainHeight, config);

        // Verify adjusted color is darker than original
        const originalBrightness = calculateBrightness(color);
        const adjustedBrightness = calculateBrightness(adjustedColor);
        expect(adjustedBrightness).toBeLessThan(originalBrightness);

        // Verify significant darkening occurred (at least 20% reduction)
        const reductionRatio = adjustedBrightness / originalBrightness;
        expect(reductionRatio).toBeLessThan(0.8);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should apply base darkening factor without depth gradient', () => {
    const configNoGradient: UnderwaterAdjustmentConfig = {
      ...config,
      enableDepthGradient: false,
    };

    fc.assert(
      fc.property(
        fc.record({
          r: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
          g: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
          b: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
        }),
        fc.float({ min: Math.fround(0), max: Math.fround(seaLevel - 0.01), noNaN: true }),
        (color, terrainHeight) => {
          // Adjust underwater color without depth gradient
          const adjustedColor = adjustUnderwaterColor(color, terrainHeight, configNoGradient);

          // Verify adjusted color is darker than original
          const originalBrightness = calculateBrightness(color);
          const adjustedBrightness = calculateBrightness(adjustedColor);
          expect(adjustedBrightness).toBeLessThan(originalBrightness);

          // Verify significant darkening occurred (at least 20% reduction)
          const reductionRatio = adjustedBrightness / originalBrightness;
          expect(reductionRatio).toBeLessThan(0.8);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should darken colors consistently across different color values', () => {
    fc.assert(
      fc.property(
        fc.record({
          r: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
          g: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
          b: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
        }),
        fc.float({ min: Math.fround(0.3), max: Math.fround(0.5), noNaN: true }),
        (color, darkenFactor) => {
          // Apply darkening directly
          const darkened = darkenColor(color, darkenFactor);

          // Verify darkening is within expected range
          const actualFactor = calculateDarkenFactor(color, darkened);
          expect(actualFactor).toBeCloseTo(darkenFactor, 2);

          // Verify all components are darkened proportionally
          const multiplier = 1 - darkenFactor;
          expect(darkened.r).toBeCloseTo(color.r * multiplier, 5);
          expect(darkened.g).toBeCloseTo(color.g * multiplier, 5);
          expect(darkened.b).toBeCloseTo(color.b * multiplier, 5);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not darken above-water terrain', () => {
    fc.assert(
      fc.property(
        fc.record({
          r: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
          g: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
          b: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
        }),
        fc.float({ min: Math.fround(seaLevel), max: Math.fround(1), noNaN: true }),
        (color, terrainHeight) => {
          // Adjust color for above-water terrain
          const adjustedColor = adjustUnderwaterColor(color, terrainHeight, config);

          // Should return original color unchanged
          expect(adjustedColor.r).toBeCloseTo(color.r, 5);
          expect(adjustedColor.g).toBeCloseTo(color.g, 5);
          expect(adjustedColor.b).toBeCloseTo(color.b, 5);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply stronger darkening to deeper tiles with gradient enabled', () => {
    fc.assert(
      fc.property(
        fc.record({
          r: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
          g: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
          b: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
        }),
        (color) => {
          // Test shallow vs deep underwater
          const shallowHeight = seaLevel - 0.05;
          const deepHeight = seaLevel - 0.2;

          const shallowAdjusted = adjustUnderwaterColor(color, shallowHeight, config);
          const deepAdjusted = adjustUnderwaterColor(color, deepHeight, config);

          // Deep should be darker than shallow
          const shallowBrightness = calculateBrightness(shallowAdjusted);
          const deepBrightness = calculateBrightness(deepAdjusted);

          expect(deepBrightness).toBeLessThan(shallowBrightness);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
