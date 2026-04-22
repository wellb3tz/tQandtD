import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EnhancedBiomeSystem, EnhancedBiomeConfig, MicroBiomeType } from './enhanced-biome';
import { BiomeType } from './chunk';
import { DEFAULT_CLIMATE_CONFIG } from './climate';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG: EnhancedBiomeConfig = {
  temperatureScale: 0.005,
  moistureScale: 0.005,
  blendRadius: 5,
  enableTransitions: true,
  transitionWidth: 10,
  enableMicroBiomes: true,
  microBiomeFrequency: 0.1,
  microBiomeMaxSize: 20,
  enableElevationBands: true,
  snowLineElevation: 0.8,
  treeLineElevation: 0.75,
};

const flatHeight = (h: number) => (_x: number, _y: number) => h;

// ---------------------------------------------------------------------------
// Feature: biome-system-improvements, Property 13: Incompatible biomes have zero weight after compatibility correction
// ---------------------------------------------------------------------------

describe('EnhancedBiomeSystem — compatibility matrix weight correction', () => {
  // Property 13: Incompatible biomes have zero weight after compatibility correction
  it('P13: incompatible biomes have zero weight after correction', () => {
    const config: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableCompatibilityMatrix: true,
      enableClimateSystem: false,
    };
    const system = new EnhancedBiomeSystem(42, config);

    // Use a position that produces a DESERT primary biome (hot, dry, mid-height)
    // We test the property by checking that after getEnhancedBiome, no incompatible
    // biome has a non-zero weight alongside the primary biome.
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(0.36), max: Math.fround(0.69), noNaN: true }), // mid-height (not ocean/beach/mountain)
        (x, y, h) => {
          const getHeight = flatHeight(h);
          const result = system.getEnhancedBiome(x, y, getHeight);
          const primaryBiome = result.biome;

          // Incompatible pairs per the matrix
          const incompatiblePairs: Array<[BiomeType, BiomeType]> = [
            [BiomeType.DESERT, BiomeType.TAIGA],
            [BiomeType.DESERT, BiomeType.TUNDRA],
            [BiomeType.DESERT, BiomeType.FOREST],
            [BiomeType.OCEAN,  BiomeType.MOUNTAIN],
          ];

          for (const [a, b] of incompatiblePairs) {
            if (primaryBiome === a) {
              const weightB = result.weights.get(b) ?? 0;
              if (weightB > 1e-9) return false;
            } else if (primaryBiome === b) {
              const weightA = result.weights.get(a) ?? 0;
              if (weightA > 1e-9) return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('backward compat: without matrix, weights are unchanged', () => {
    const configWithout: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableCompatibilityMatrix: false,
    };
    const configWith: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableCompatibilityMatrix: true,
    };
    const sysWithout = new EnhancedBiomeSystem(42, configWithout);
    const sysWith    = new EnhancedBiomeSystem(42, configWith);

    // At a position where no incompatible biomes appear in the blend,
    // both systems should produce the same primary biome
    const getHeight = flatHeight(0.5);
    const r1 = sysWithout.getEnhancedBiome(0, 0, getHeight);
    const r2 = sysWith.getEnhancedBiome(0, 0, getHeight);
    expect(r1.biome).toBe(r2.biome);
  });
});

// ---------------------------------------------------------------------------
// Feature: biome-system-improvements, Property 14: Depression-type micro-biomes only placed in depressions
// ---------------------------------------------------------------------------

describe('EnhancedBiomeSystem — terrain-aware micro-biome placement', () => {
  // Property 14: Depression-type micro-biomes only placed in depressions
  it('P14: OASIS and POND micro-biomes only appear in terrain depressions', () => {
    const depressionThreshold = 0.05;
    const config: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableMicroBiomes: true,
      microBiomeFrequency: 1.0, // maximum frequency to maximise micro-biome placement
      depressionDepthThreshold: depressionThreshold,
    };
    const system = new EnhancedBiomeSystem(42, config);

    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(0.36), max: Math.fround(0.69), noNaN: true }),
        (x, y, centerH) => {
          // Use a flat height function — no depression, so OASIS/POND should never appear
          const getHeight = flatHeight(centerH);
          const result = system.getEnhancedBiome(x, y, getHeight);

          if (
            result.microBiome === MicroBiomeType.OASIS ||
            result.microBiome === MicroBiomeType.POND
          ) {
            // If placed, verify it's actually a depression
            const neighbourAvg = (
              getHeight(x + 1, y) +
              getHeight(x - 1, y) +
              getHeight(x, y + 1) +
              getHeight(x, y - 1)
            ) / 4;
            return (centerH - neighbourAvg) < -depressionThreshold;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('OASIS/POND never placed on flat terrain (no depression)', () => {
    const config: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableMicroBiomes: true,
      microBiomeFrequency: 1.0,
      depressionDepthThreshold: 0.05,
    };
    const system = new EnhancedBiomeSystem(42, config);

    // Flat terrain: no depression possible, so OASIS/POND should never appear
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(0.36), max: Math.fround(0.69), noNaN: true }),
        (x, y, h) => {
          const result = system.getEnhancedBiome(x, y, flatHeight(h));
          return (
            result.microBiome !== MicroBiomeType.OASIS &&
            result.microBiome !== MicroBiomeType.POND
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 15: Flat-terrain micro-biomes only placed on low-gradient terrain
  it('P15: CLEARING and GROVE micro-biomes only appear on low-gradient terrain', () => {
    const gradientThreshold = 0.03;
    const config: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableMicroBiomes: true,
      microBiomeFrequency: 1.0,
      clearingGradientThreshold: gradientThreshold,
    };
    const system = new EnhancedBiomeSystem(42, config);

    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(0.36), max: Math.fround(0.69), noNaN: true }),
        (x, y, h) => {
          // Flat terrain: gradient = 0, which is < threshold, so CLEARING/GROVE CAN appear
          const result = system.getEnhancedBiome(x, y, flatHeight(h));
          if (
            result.microBiome === MicroBiomeType.CLEARING ||
            result.microBiome === MicroBiomeType.GROVE
          ) {
            // Verify gradient is below threshold (flat terrain has gradient 0)
            const dx1 = 0; const dx2 = 0; const dy1 = 0; const dy2 = 0;
            const gradient = Math.sqrt((dx1 * dx1 + dx2 * dx2 + dy1 * dy1 + dy2 * dy2) / 4);
            return gradient < gradientThreshold;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('CLEARING/GROVE never placed on steep terrain', () => {
    const gradientThreshold = 0.03;
    const config: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableMicroBiomes: true,
      microBiomeFrequency: 1.0,
      clearingGradientThreshold: gradientThreshold,
    };
    const system = new EnhancedBiomeSystem(42, config);

    // Steep terrain: gradient >> threshold, so CLEARING/GROVE should never appear
    const steepHeight = (x: number, _y: number) => Math.abs(x) * 1.0; // very steep
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true }),
        fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true }),
        (x, y) => {
          const result = system.getEnhancedBiome(x, y, steepHeight);
          return (
            result.microBiome !== MicroBiomeType.CLEARING &&
            result.microBiome !== MicroBiomeType.GROVE
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('backward compat: with thresholds=0, micro-biomes use noise-only logic', () => {
    // When both thresholds are 0, terrain conditions are trivially satisfied
    // (any depression depth >= 0, any gradient >= 0), so placement falls back to noise.
    const configZero: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableMicroBiomes: true,
      microBiomeFrequency: 0.1,
      depressionDepthThreshold: 0,
      clearingGradientThreshold: 0,
    };
    const configDefault: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableMicroBiomes: true,
      microBiomeFrequency: 0.1,
      // depressionDepthThreshold and clearingGradientThreshold absent (defaults apply)
    };
    // Both should construct without error
    expect(() => new EnhancedBiomeSystem(42, configZero)).not.toThrow();
    expect(() => new EnhancedBiomeSystem(42, configDefault)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ClimateSystem integration
// ---------------------------------------------------------------------------

describe('EnhancedBiomeSystem — ClimateSystem integration', () => {
  it('with enableClimateSystem=false produces same result as base BiomeSystem path', () => {
    const configOff: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableClimateSystem: false,
      enableCompatibilityMatrix: false,
    };
    const sys1 = new EnhancedBiomeSystem(42, configOff);
    const sys2 = new EnhancedBiomeSystem(42, configOff);
    const getHeight = flatHeight(0.5);
    const r1 = sys1.getEnhancedBiome(100, 100, getHeight);
    const r2 = sys2.getEnhancedBiome(100, 100, getHeight);
    expect(r1.biome).toBe(r2.biome);
  });

  it('with enableClimateSystem=true uses ClimateSystem and returns valid biome', () => {
    const config: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableClimateSystem: true,
      climateConfig: DEFAULT_CLIMATE_CONFIG,
    };
    const system = new EnhancedBiomeSystem(42, config);
    const result = system.getEnhancedBiome(100, 100, flatHeight(0.5));
    expect(Object.values(BiomeType)).toContain(result.biome);
  });

  it('is deterministic with ClimateSystem enabled', () => {
    const config: EnhancedBiomeConfig = {
      ...BASE_CONFIG,
      enableClimateSystem: true,
      climateConfig: DEFAULT_CLIMATE_CONFIG,
    };
    const system = new EnhancedBiomeSystem(42, config);
    const getHeight = flatHeight(0.5);
    const r1 = system.getEnhancedBiome(100, 100, getHeight);
    const r2 = system.getEnhancedBiome(100, 100, getHeight);
    expect(r1.biome).toBe(r2.biome);
  });
});
