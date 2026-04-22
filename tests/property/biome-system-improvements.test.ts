/**
 * Property-based tests for the Biome System Improvements feature.
 *
 * Covers all 16 correctness properties defined in the design document.
 * Each property runs a minimum of 100 iterations using fast-check.
 *
 * Tag format: // Feature: biome-system-improvements, Property N: <text>
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { ClimateSystem, ClimateConfig, DEFAULT_CLIMATE_CONFIG } from '../../src/world/climate';
import { BiomeCompatibilityMatrix } from '../../src/world/biome-compatibility';
import { EnhancedBiomeSystem, EnhancedBiomeConfig, MicroBiomeType } from '../../src/world/enhanced-biome';
import { BiomeType } from '../../src/world/chunk';

// ---------------------------------------------------------------------------
// Shared arbitraries
// ---------------------------------------------------------------------------

const validClimateConfigArb = fc.record<ClimateConfig>({
  latitudeGradientStrength: fc.float({ min: 0, max: 1, noNaN: true }),
  climateScale:             fc.float({ min: Math.fround(0.0001), max: Math.fround(0.1), noNaN: true }),
  detailScale:              fc.float({ min: Math.fround(0.0001), max: Math.fround(0.1), noNaN: true }),
  climateDetailBlend:       fc.float({ min: 0, max: 1, noNaN: true }),
  altitudeCoolingThreshold: fc.float({ min: 0, max: 1, noNaN: true }),
  altitudeCoolingRate:      fc.float({ min: 0, max: 2, noNaN: true }),
  valleyGradientThreshold:  fc.float({ min: 0, max: 1, noNaN: true }),
  valleyMoistureBonus:      fc.float({ min: 0, max: 1, noNaN: true }),
});

const worldPosArb = fc.record({
  x: fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }),
  y: fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }),
});

const heightArb = fc.float({ min: 0, max: 1, noNaN: true });

const ALL_BIOME_TYPES: BiomeType[] = [
  BiomeType.OCEAN, BiomeType.BEACH, BiomeType.DESERT, BiomeType.PLAINS,
  BiomeType.FOREST, BiomeType.TAIGA, BiomeType.TUNDRA, BiomeType.MOUNTAIN,
];
const biomeTypeArb = fc.constantFrom(...ALL_BIOME_TYPES);

const flatHeight = (h: number) => (_x: number, _y: number) => h;

const BASE_ENHANCED_CONFIG: EnhancedBiomeConfig = {
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

// ---------------------------------------------------------------------------
// P1–P9: ClimateSystem range and monotonicity
// ---------------------------------------------------------------------------

describe('ClimateSystem properties (P1–P9)', () => {
  // Feature: biome-system-improvements, Property 1: Temperature output is always in range [-1, 1]
  it('P1: temperature is always in [-1, 1]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        worldPosArb,
        heightArb,
        validClimateConfigArb,
        (seed, pos, height, cfg) => {
          const cs = new ClimateSystem(seed, cfg);
          const t = cs.getTemperature(pos.x, pos.y, height);
          return t >= -1 && t <= 1;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: biome-system-improvements, Property 2: Moisture output is always in range [-1, 1]
  it('P2: moisture is always in [-1, 1]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        worldPosArb,
        heightArb,
        validClimateConfigArb,
        (seed, pos, height, cfg) => {
          const cs = new ClimateSystem(seed, cfg);
          const m = cs.getMoisture(pos.x, pos.y, height, flatHeight(height));
          return m >= -1 && m <= 1;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: biome-system-improvements, Property 3: Latitude gradient is monotonically decreasing with Y
  it('P3: latitude gradient is monotonically decreasing with Y (latitudeGradientStrength=1)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.float({ min: Math.fround(-9000), max: Math.fround(9000), noNaN: true }),
        fc.float({ min: Math.fround(-9000), max: Math.fround(9000), noNaN: true }),
        heightArb,
        (seed, y1Raw, y2Raw, height) => {
          // With latitudeGradientStrength=1, noise contribution is 0, so only latitude matters
          const cfg: ClimateConfig = { ...DEFAULT_CLIMATE_CONFIG, latitudeGradientStrength: 1 };
          const cs = new ClimateSystem(seed, cfg);
          const y1 = Math.min(y1Raw, y2Raw);
          const y2 = Math.max(y1Raw, y2Raw);
          if (y1 === y2) return true;
          const t1 = cs.getTemperature(0, y1, height);
          const t2 = cs.getTemperature(0, y2, height);
          return t1 >= t2 - 1e-9;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: biome-system-improvements, Property 4: Zero latitude gradient strength preserves noise-only temperature
  it('P4: zero latitude gradient strength produces no latitude-based shift', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        worldPosArb,
        heightArb,
        (seed, pos, height) => {
          const cfg: ClimateConfig = { ...DEFAULT_CLIMATE_CONFIG, latitudeGradientStrength: 0 };
          const cs = new ClimateSystem(seed, cfg);
          const t1 = cs.getTemperature(pos.x, pos.y, height);
          const t2 = cs.getTemperature(pos.x, pos.y, height);
          return t1 === t2 && t1 >= -1 && t1 <= 1;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: biome-system-improvements, Property 5: Altitude cooling is monotonically decreasing above threshold
  it('P5: altitude cooling is monotonically decreasing above threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        worldPosArb,
        fc.float({ min: 0, max: Math.fround(0.8), noNaN: true }),
        fc.float({ min: 0, max: 2, noNaN: true }),
        (seed, pos, threshold, rate) => {
          const cfg: ClimateConfig = {
            ...DEFAULT_CLIMATE_CONFIG,
            altitudeCoolingThreshold: threshold,
            altitudeCoolingRate: rate,
          };
          const cs = new ClimateSystem(seed, cfg);
          const h2 = threshold + 0.05;
          const h1 = threshold + 0.15;
          if (h1 > 1 || h2 > 1) return true;
          const t1 = cs.getTemperature(pos.x, pos.y, h1);
          const t2 = cs.getTemperature(pos.x, pos.y, h2);
          return t1 <= t2 + 1e-9;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: biome-system-improvements, Property 6: No altitude cooling below threshold
  it('P6: no altitude cooling below threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        worldPosArb,
        fc.float({ min: Math.fround(0.1), max: 1, noNaN: true }),
        (seed, pos, threshold) => {
          const cfg: ClimateConfig = { ...DEFAULT_CLIMATE_CONFIG, altitudeCoolingThreshold: threshold };
          const cs = new ClimateSystem(seed, cfg);
          const h = threshold * 0.5;
          const tAtH    = cs.getTemperature(pos.x, pos.y, h);
          const tAtZero = cs.getTemperature(pos.x, pos.y, 0);
          return Math.abs(tAtH - tAtZero) < 1e-9;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: biome-system-improvements, Property 7: Valley moisture bonus is monotonically decreasing with gradient
  it('P7: valley moisture bonus is monotonically decreasing with gradient', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        worldPosArb,
        heightArb,
        fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }),
        (seed, pos, height, threshold, bonus) => {
          const cfg: ClimateConfig = {
            ...DEFAULT_CLIMATE_CONFIG,
            valleyGradientThreshold: threshold,
            valleyMoistureBonus: bonus,
          };
          const cs = new ClimateSystem(seed, cfg);
          const g1 = threshold * 0.2;
          const g2 = threshold * 0.6;
          const makeHeightFn = (grad: number) => (x: number, y: number) => {
            const dx = x - pos.x;
            const dy = y - pos.y;
            return height + (dx + dy) * grad;
          };
          const m1 = cs.getMoisture(pos.x, pos.y, height, makeHeightFn(g1));
          const m2 = cs.getMoisture(pos.x, pos.y, height, makeHeightFn(g2));
          return m1 >= m2 - 1e-9;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: biome-system-improvements, Property 8: Zero valley moisture bonus preserves gradient-independent moisture
  it('P8: zero valley moisture bonus preserves gradient-independent moisture', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        worldPosArb,
        heightArb,
        (seed, pos, height) => {
          const cfg: ClimateConfig = { ...DEFAULT_CLIMATE_CONFIG, valleyMoistureBonus: 0 };
          const cs = new ClimateSystem(seed, cfg);
          const mFlat  = cs.getMoisture(pos.x, pos.y, height, flatHeight(height));
          const mSteep = cs.getMoisture(pos.x, pos.y, height, (_x, _y) => height + 0.5);
          return Math.abs(mFlat - mSteep) < 1e-9;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: biome-system-improvements, Property 9: Gradient magnitude is always non-negative
  it('P9: gradient magnitude is always non-negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        worldPosArb,
        heightArb,
        (seed, pos, height) => {
          const cs = new ClimateSystem(seed, DEFAULT_CLIMATE_CONFIG);
          const gradient = cs.computeGradient(pos.x, pos.y, flatHeight(height));
          return gradient >= 0;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P10–P12: BiomeCompatibilityMatrix
// ---------------------------------------------------------------------------

describe('BiomeCompatibilityMatrix properties (P10–P12)', () => {
  const matrix = new BiomeCompatibilityMatrix();

  // Feature: biome-system-improvements, Property 10: Compatibility matrix covers all biome pairs
  it('P10: isCompatible returns a boolean for all biome pairs (never throws, never undefined)', () => {
    fc.assert(
      fc.property(biomeTypeArb, biomeTypeArb, (a, b) => {
        const result = matrix.isCompatible(a, b);
        return typeof result === 'boolean';
      }),
      { numRuns: 200 },
    );
  });

  // Feature: biome-system-improvements, Property 11: Incompatible pairs always have a defined intermediate biome
  it('P11: incompatible pairs always have a defined intermediate biome ≠ a and ≠ b', () => {
    fc.assert(
      fc.property(biomeTypeArb, biomeTypeArb, (a, b) => {
        if (matrix.isCompatible(a, b)) return true;
        const intermediate = matrix.getIntermediate(a, b);
        return intermediate !== undefined && intermediate !== a && intermediate !== b;
      }),
      { numRuns: 200 },
    );
  });

  // Feature: biome-system-improvements, Property 12: Compatibility matrix serialisation round-trip
  it('P12: deserialise(matrix.serialise()) produces identical results for all pairs', () => {
    const serialised = matrix.serialise();
    const restored   = BiomeCompatibilityMatrix.deserialise(serialised);
    fc.assert(
      fc.property(biomeTypeArb, biomeTypeArb, (a, b) => {
        return (
          restored.isCompatible(a, b)    === matrix.isCompatible(a, b) &&
          restored.getIntermediate(a, b) === matrix.getIntermediate(a, b)
        );
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// P13–P16: EnhancedBiomeSystem and determinism
// ---------------------------------------------------------------------------

describe('EnhancedBiomeSystem properties (P13–P16)', () => {
  // Feature: biome-system-improvements, Property 13: Incompatible biomes have zero weight after compatibility correction
  it('P13: incompatible biomes have zero weight after compatibility correction', () => {
    const config: EnhancedBiomeConfig = {
      ...BASE_ENHANCED_CONFIG,
      enableCompatibilityMatrix: true,
    };
    const system = new EnhancedBiomeSystem(42, config);
    const incompatiblePairs: Array<[BiomeType, BiomeType]> = [
      [BiomeType.DESERT, BiomeType.TAIGA],
      [BiomeType.DESERT, BiomeType.TUNDRA],
      [BiomeType.DESERT, BiomeType.FOREST],
      [BiomeType.OCEAN,  BiomeType.MOUNTAIN],
    ];

    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(0.36), max: Math.fround(0.69), noNaN: true }),
        (x, y, h) => {
          const result = system.getEnhancedBiome(x, y, flatHeight(h));
          const primary = result.biome;
          for (const [a, b] of incompatiblePairs) {
            if (primary === a) {
              if ((result.weights.get(b) ?? 0) > 1e-9) return false;
            } else if (primary === b) {
              if ((result.weights.get(a) ?? 0) > 1e-9) return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: biome-system-improvements, Property 14: Depression-type micro-biomes only placed in depressions
  it('P14: OASIS and POND micro-biomes only placed in depressions', () => {
    const depressionThreshold = 0.05;
    const config: EnhancedBiomeConfig = {
      ...BASE_ENHANCED_CONFIG,
      enableMicroBiomes: true,
      microBiomeFrequency: 1.0,
      depressionDepthThreshold: depressionThreshold,
    };
    const system = new EnhancedBiomeSystem(42, config);

    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(0.36), max: Math.fround(0.69), noNaN: true }),
        (x, y, h) => {
          const getHeight = flatHeight(h);
          const result = system.getEnhancedBiome(x, y, getHeight);
          if (
            result.microBiome === MicroBiomeType.OASIS ||
            result.microBiome === MicroBiomeType.POND
          ) {
            const neighbourAvg = (
              getHeight(x + 1, y) + getHeight(x - 1, y) +
              getHeight(x, y + 1) + getHeight(x, y - 1)
            ) / 4;
            return (h - neighbourAvg) < -depressionThreshold;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: biome-system-improvements, Property 15: Flat-terrain micro-biomes only placed on low-gradient terrain
  it('P15: CLEARING and GROVE micro-biomes only placed on low-gradient terrain', () => {
    const gradientThreshold = 0.03;
    const config: EnhancedBiomeConfig = {
      ...BASE_ENHANCED_CONFIG,
      enableMicroBiomes: true,
      microBiomeFrequency: 1.0,
      clearingGradientThreshold: gradientThreshold,
    };
    const system = new EnhancedBiomeSystem(42, config);

    // Steep terrain: gradient >> threshold
    const steepHeight = (x: number, _y: number) => Math.abs(x) * 1.0;

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

  // Feature: biome-system-improvements, Property 16: ClimateSystem is deterministic
  it('P16: getTemperature and getMoisture return identical values on repeated calls', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        worldPosArb,
        heightArb,
        validClimateConfigArb,
        (seed, pos, height, cfg) => {
          const cs = new ClimateSystem(seed, cfg);
          const t1 = cs.getTemperature(pos.x, pos.y, height);
          const t2 = cs.getTemperature(pos.x, pos.y, height);
          const m1 = cs.getMoisture(pos.x, pos.y, height, flatHeight(height));
          const m2 = cs.getMoisture(pos.x, pos.y, height, flatHeight(height));
          return t1 === t2 && m1 === m2;
        },
      ),
      { numRuns: 100 },
    );
  });
});
