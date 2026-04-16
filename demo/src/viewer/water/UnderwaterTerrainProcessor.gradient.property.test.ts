/**
 * Property test: Depth-Based Gradient Application
 * 
 * Feature: comprehensive-water-system, Property 13: Depth-Based Gradient Application
 * Validates: Requirements 6.6
 * 
 * Verifies that underwater terrain color adjustment includes a depth-based gradient
 * where deeper tiles (further below seaLevel) are darker than shallower tiles.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  adjustUnderwaterColor,
  applyDepthGradient,
  calculateBrightness,
  type UnderwaterAdjustmentConfig,
} from './UnderwaterTerrainProcessor';

describe('Property 13: Depth-Based Gradient Application', () => {
  const seaLevel = 0.3;
  const config: UnderwaterAdjustmentConfig = {
    seaLevel,
    darkenFactor: 0.4,
    desaturationFactor: 0.5,
    enableDepthGradient: true,
  };

  it('Feature: comprehensive-water-system, Property 13: Depth-Based Gradient Application', () => {
    // Arbitrary color
    const arbColor = fc.record({
      r: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
      g: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
      b: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
    });

    // Arbitrary pair of underwater heights (shallow and deep)
    const arbHeightPair = fc
      .tuple(fc.float({ min: 0, max: Math.fround(seaLevel - 0.01), noNaN: true }), fc.float({ min: 0, max: Math.fround(seaLevel - 0.01), noNaN: true }))
      .filter(([h1, h2]) => Math.abs(h1 - h2) > 0.02); // Ensure meaningful difference

    fc.assert(
      fc.property(arbColor, arbHeightPair, (color, [height1, height2]) => {
        // Determine which is shallower and which is deeper
        const shallowHeight = Math.max(height1, height2);
        const deepHeight = Math.min(height1, height2);

        // Adjust colors for both depths
        const shallowAdjusted = adjustUnderwaterColor(color, shallowHeight, config);
        const deepAdjusted = adjustUnderwaterColor(color, deepHeight, config);

        // Calculate brightness for both
        const shallowBrightness = calculateBrightness(shallowAdjusted);
        const deepBrightness = calculateBrightness(deepAdjusted);

        // Deeper tiles should be darker (lower brightness)
        expect(deepBrightness).toBeLessThan(shallowBrightness);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should increase darkening factor with depth', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.3), max: Math.fround(0.5), noNaN: true }),
        fc.tuple(fc.float({ min: Math.fround(0.01), max: Math.fround(0.3), noNaN: true }), fc.float({ min: Math.fround(0.01), max: Math.fround(0.3), noNaN: true })).filter(
          ([d1, d2]) => Math.abs(d1 - d2) > 0.02
        ),
        (baseFactor, [depth1, depth2]) => {
          // Determine shallow and deep
          const shallowDepth = Math.min(depth1, depth2);
          const deepDepth = Math.max(depth1, depth2);

          // Apply depth gradient
          const shallowFactor = applyDepthGradient(baseFactor, shallowDepth, seaLevel);
          const deepFactor = applyDepthGradient(baseFactor, deepDepth, seaLevel);

          // Deeper should have higher darkening factor
          expect(deepFactor).toBeGreaterThan(shallowFactor);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply gradient proportional to depth', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.3), max: Math.fround(0.5), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.3), noNaN: true }),
        (baseFactor, depth) => {
          // Apply depth gradient
          const adjustedFactor = applyDepthGradient(baseFactor, depth, seaLevel);

          // Adjusted factor should be >= base factor
          expect(adjustedFactor).toBeGreaterThanOrEqual(baseFactor);

          // Adjusted factor should not exceed 1.0
          expect(adjustedFactor).toBeLessThanOrEqual(1);

          // Calculate expected multiplier based on normalized depth
          const normalizedDepth = Math.min(depth / seaLevel, 1);
          const expectedMultiplier = 1 + normalizedDepth * 0.2;
          const expectedFactor = Math.min(baseFactor * expectedMultiplier, 1);

          // Verify calculation
          expect(adjustedFactor).toBeCloseTo(expectedFactor, 5);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not apply gradient when disabled', () => {
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
        fc.tuple(fc.float({ min: Math.fround(0), max: Math.fround(seaLevel - 0.01), noNaN: true }), fc.float({ min: Math.fround(0), max: Math.fround(seaLevel - 0.01), noNaN: true })).filter(
          ([h1, h2]) => Math.abs(h1 - h2) > 0.02
        ),
        (color, [height1, height2]) => {
          // Adjust colors for both depths without gradient
          const adjusted1 = adjustUnderwaterColor(color, height1, configNoGradient);
          const adjusted2 = adjustUnderwaterColor(color, height2, configNoGradient);

          // Brightness should be very similar (only minor differences from desaturation)
          const brightness1 = calculateBrightness(adjusted1);
          const brightness2 = calculateBrightness(adjusted2);
          const brightnessDiff = Math.abs(brightness1 - brightness2);

          // Difference should be minimal (< 1%)
          expect(brightnessDiff).toBeLessThan(0.01);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create smooth gradient across depth range', () => {
    fc.assert(
      fc.property(
        fc.record({
          r: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
          g: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
          b: fc.float({ min: Math.fround(0.1), max: Math.fround(1), noNaN: true }),
        }),
        (color) => {
          // Test multiple depths from shallow to deep
          const depths = [0.05, 0.1, 0.15, 0.2, 0.25];
          const heights = depths.map((d) => seaLevel - d);

          // Adjust colors for all depths
          const adjustedColors = heights.map((h) => adjustUnderwaterColor(color, h, config));
          const brightnesses = adjustedColors.map((c) => calculateBrightness(c));

          // Verify brightness decreases monotonically with depth
          for (let i = 1; i < brightnesses.length; i++) {
            expect(brightnesses[i]).toBeLessThanOrEqual(brightnesses[i - 1]);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply maximum gradient at maximum depth', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.3), max: Math.fround(0.5), noNaN: true }),
        (baseFactor) => {
          // Apply gradient at maximum depth (equal to sea level)
          const maxDepth = seaLevel;
          const adjustedFactor = applyDepthGradient(baseFactor, maxDepth, seaLevel);

          // Should apply 20% additional darkening
          const expectedFactor = Math.min(baseFactor * 1.2, 1);
          expect(adjustedFactor).toBeCloseTo(expectedFactor, 5);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return base factor for zero depth', () => {
    fc.assert(
      fc.property(fc.float({ min: Math.fround(0.3), max: Math.fround(0.5), noNaN: true }), (baseFactor) => {
        // Apply gradient at zero depth
        const adjustedFactor = applyDepthGradient(baseFactor, 0, seaLevel);

        // Should return base factor unchanged
        expect(adjustedFactor).toBe(baseFactor);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
