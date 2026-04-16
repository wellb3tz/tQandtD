/**
 * Property test: Underwater Color Desaturation
 * 
 * Feature: comprehensive-water-system, Property 8: Underwater Color Desaturation
 * Validates: Requirements 2.5, 6.3
 * 
 * Verifies that underwater terrain colors are desaturated to simulate depth,
 * with saturation reduced compared to above-water biome colors.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  adjustUnderwaterColor,
  desaturateColor,
  calculateSaturation,
  type UnderwaterAdjustmentConfig,
} from './UnderwaterTerrainProcessor';
import type { BiomeColor } from '../materials';

describe('Property 8: Underwater Color Desaturation', () => {
  const seaLevel = 0.3;
  const config: UnderwaterAdjustmentConfig = {
    seaLevel,
    darkenFactor: 0.4,
    desaturationFactor: 0.5,
    enableDepthGradient: true,
  };

  it('Feature: comprehensive-water-system, Property 8: Underwater Color Desaturation', () => {
    // Arbitrary saturated color (avoid grayscale)
    const arbColor = fc
      .record({
        r: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        g: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        b: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
      })
      .filter((color) => {
        // Filter out grayscale colors (saturation > 0.1)
        const saturation = calculateSaturation(color);
        return saturation > 0.1;
      });

    // Arbitrary underwater height (below sea level)
    const arbUnderwaterHeight = fc.float({ min: 0, max: Math.fround(seaLevel - 0.01), noNaN: true });

    fc.assert(
      fc.property(arbColor, arbUnderwaterHeight, (color, terrainHeight) => {
        // Adjust underwater color
        const adjustedColor = adjustUnderwaterColor(color, terrainHeight, config);

        // Calculate saturation before and after
        const originalSaturation = calculateSaturation(color);
        const adjustedSaturation = calculateSaturation(adjustedColor);

        // Verify saturation is reduced
        expect(adjustedSaturation).toBeLessThan(originalSaturation);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should desaturate colors proportionally to desaturation factor', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            r: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
            g: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
            b: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          })
          .filter((color) => calculateSaturation(color) > 0.1),
        fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
        (color, desaturationFactor) => {
          // Apply desaturation directly
          const desaturated = desaturateColor(color, desaturationFactor);

          // Calculate saturation reduction
          const originalSaturation = calculateSaturation(color);
          const desaturatedSaturation = calculateSaturation(desaturated);

          // Verify saturation is reduced
          expect(desaturatedSaturation).toBeLessThanOrEqual(originalSaturation);

          // Higher desaturation factor should result in lower saturation
          if (desaturationFactor > 0.5) {
            const lessDesaturated = desaturateColor(color, 0.5);
            const lessDesaturatedSaturation = calculateSaturation(lessDesaturated);
            expect(desaturatedSaturation).toBeLessThanOrEqual(lessDesaturatedSaturation);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve luminance during desaturation', () => {
    fc.assert(
      fc.property(
        fc.record({
          r: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          g: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          b: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        }),
        fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        (color, desaturationFactor) => {
          // Apply desaturation
          const desaturated = desaturateColor(color, desaturationFactor);

          // Calculate luminance using standard formula
          const originalLuminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
          const desaturatedLuminance = 0.299 * desaturated.r + 0.587 * desaturated.g + 0.114 * desaturated.b;

          // Luminance should be preserved (within floating point precision)
          expect(desaturatedLuminance).toBeCloseTo(originalLuminance, 5);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should convert to grayscale when desaturation factor is 1', () => {
    fc.assert(
      fc.property(
        fc.record({
          r: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          g: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          b: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        }),
        (color) => {
          // Apply full desaturation
          const desaturated = desaturateColor(color, 1);

          // All components should be equal (grayscale)
          expect(desaturated.r).toBeCloseTo(desaturated.g, 5);
          expect(desaturated.g).toBeCloseTo(desaturated.b, 5);

          // Saturation should be zero (or very close)
          const saturation = calculateSaturation(desaturated);
          expect(saturation).toBeLessThan(0.01);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not change color when desaturation factor is 0', () => {
    fc.assert(
      fc.property(
        fc.record({
          r: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          g: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          b: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        }),
        (color) => {
          // Apply zero desaturation
          const desaturated = desaturateColor(color, 0);

          // Color should remain unchanged
          expect(desaturated.r).toBeCloseTo(color.r, 5);
          expect(desaturated.g).toBeCloseTo(color.g, 5);
          expect(desaturated.b).toBeCloseTo(color.b, 5);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not desaturate above-water terrain', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            r: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
            g: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
            b: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          })
          .filter((color) => calculateSaturation(color) > 0.1),
        fc.float({ min: Math.fround(seaLevel), max: Math.fround(1), noNaN: true }),
        (color, terrainHeight) => {
          // Adjust color for above-water terrain
          const adjustedColor = adjustUnderwaterColor(color, terrainHeight, config);

          // Should return original color unchanged
          expect(adjustedColor.r).toBeCloseTo(color.r, 5);
          expect(adjustedColor.g).toBeCloseTo(color.g, 5);
          expect(adjustedColor.b).toBeCloseTo(color.b, 5);

          // Saturation should be unchanged
          const originalSaturation = calculateSaturation(color);
          const adjustedSaturation = calculateSaturation(adjustedColor);
          expect(adjustedSaturation).toBeCloseTo(originalSaturation, 5);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should desaturate underwater terrain consistently', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            r: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
            g: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
            b: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          })
          .filter((color) => calculateSaturation(color) > 0.1),
        fc.float({ min: Math.fround(0), max: Math.fround(seaLevel - 0.01), noNaN: true }),
        (color, terrainHeight) => {
          // Adjust underwater color
          const adjustedColor = adjustUnderwaterColor(color, terrainHeight, config);

          // Calculate saturation reduction
          const originalSaturation = calculateSaturation(color);
          const adjustedSaturation = calculateSaturation(adjustedColor);

          // Verify saturation is reduced
          expect(adjustedSaturation).toBeLessThan(originalSaturation);

          // Verify reduction is significant (at least 10% reduction)
          const reductionRatio = adjustedSaturation / originalSaturation;
          expect(reductionRatio).toBeLessThan(0.9);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
