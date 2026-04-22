import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { BiomeCompatibilityMatrix } from './biome-compatibility';
import { BiomeType } from './chunk';

// All BiomeType values for use in property tests
const ALL_BIOME_TYPES: BiomeType[] = [
  BiomeType.OCEAN,
  BiomeType.BEACH,
  BiomeType.DESERT,
  BiomeType.PLAINS,
  BiomeType.FOREST,
  BiomeType.TAIGA,
  BiomeType.TUNDRA,
  BiomeType.MOUNTAIN,
];

const biomeTypeArb = fc.constantFrom(...ALL_BIOME_TYPES);

// ---------------------------------------------------------------------------
// Task 5.1 — Example-based unit tests
// ---------------------------------------------------------------------------

describe('BiomeCompatibilityMatrix — unit tests', () => {
  const matrix = new BiomeCompatibilityMatrix();

  describe('incompatible pairs', () => {
    it('DESERT↔TAIGA is incompatible with PLAINS as intermediate', () => {
      expect(matrix.isCompatible(BiomeType.DESERT, BiomeType.TAIGA)).toBe(false);
      expect(matrix.getIntermediate(BiomeType.DESERT, BiomeType.TAIGA)).toBe(BiomeType.PLAINS);
    });

    it('DESERT↔TUNDRA is incompatible with PLAINS as intermediate', () => {
      expect(matrix.isCompatible(BiomeType.DESERT, BiomeType.TUNDRA)).toBe(false);
      expect(matrix.getIntermediate(BiomeType.DESERT, BiomeType.TUNDRA)).toBe(BiomeType.PLAINS);
    });

    it('DESERT↔FOREST is incompatible with PLAINS as intermediate', () => {
      expect(matrix.isCompatible(BiomeType.DESERT, BiomeType.FOREST)).toBe(false);
      expect(matrix.getIntermediate(BiomeType.DESERT, BiomeType.FOREST)).toBe(BiomeType.PLAINS);
    });

    it('OCEAN↔MOUNTAIN is incompatible with BEACH as intermediate', () => {
      expect(matrix.isCompatible(BiomeType.OCEAN, BiomeType.MOUNTAIN)).toBe(false);
      expect(matrix.getIntermediate(BiomeType.OCEAN, BiomeType.MOUNTAIN)).toBe(BiomeType.BEACH);
    });
  });

  describe('compatible pairs', () => {
    it('PLAINS↔FOREST is compatible with no intermediate', () => {
      expect(matrix.isCompatible(BiomeType.PLAINS, BiomeType.FOREST)).toBe(true);
      expect(matrix.getIntermediate(BiomeType.PLAINS, BiomeType.FOREST)).toBeUndefined();
    });

    it('OCEAN↔BEACH is compatible', () => {
      expect(matrix.isCompatible(BiomeType.OCEAN, BiomeType.BEACH)).toBe(true);
    });

    it('PLAINS↔PLAINS is compatible (self-pair)', () => {
      expect(matrix.isCompatible(BiomeType.PLAINS, BiomeType.PLAINS)).toBe(true);
    });
  });

  describe('symmetry', () => {
    it('isCompatible(DESERT, TAIGA) === isCompatible(TAIGA, DESERT)', () => {
      expect(matrix.isCompatible(BiomeType.DESERT, BiomeType.TAIGA))
        .toBe(matrix.isCompatible(BiomeType.TAIGA, BiomeType.DESERT));
    });

    it('getIntermediate(DESERT, TAIGA) === getIntermediate(TAIGA, DESERT)', () => {
      expect(matrix.getIntermediate(BiomeType.DESERT, BiomeType.TAIGA))
        .toBe(matrix.getIntermediate(BiomeType.TAIGA, BiomeType.DESERT));
    });

    it('isCompatible(OCEAN, MOUNTAIN) === isCompatible(MOUNTAIN, OCEAN)', () => {
      expect(matrix.isCompatible(BiomeType.OCEAN, BiomeType.MOUNTAIN))
        .toBe(matrix.isCompatible(BiomeType.MOUNTAIN, BiomeType.OCEAN));
    });
  });

  describe('serialise / deserialise', () => {
    it('round-trip preserves all compatibility rules', () => {
      const serialised = matrix.serialise();
      const restored = BiomeCompatibilityMatrix.deserialise(serialised);

      for (const a of ALL_BIOME_TYPES) {
        for (const b of ALL_BIOME_TYPES) {
          expect(restored.isCompatible(a, b)).toBe(matrix.isCompatible(a, b));
          expect(restored.getIntermediate(a, b)).toBe(matrix.getIntermediate(a, b));
        }
      }
    });

    it('serialised version is 1', () => {
      expect(matrix.serialise().version).toBe(1);
    });

    it('serialised arrays have correct length (NUM_BIOMES²)', () => {
      const s = matrix.serialise();
      expect(s.compatible.length).toBe(64);
      expect(s.intermediate.length).toBe(64);
    });
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('BiomeCompatibilityMatrix — property tests', () => {
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
        if (matrix.isCompatible(a, b)) return true; // skip compatible pairs
        const intermediate = matrix.getIntermediate(a, b);
        return (
          intermediate !== undefined &&
          intermediate !== a &&
          intermediate !== b
        );
      }),
      { numRuns: 200 },
    );
  });

  // Feature: biome-system-improvements, Property 12: Compatibility matrix serialisation round-trip
  it('P12: deserialise(matrix.serialise()) produces identical results for all pairs', () => {
    const serialised = matrix.serialise();
    const restored = BiomeCompatibilityMatrix.deserialise(serialised);

    fc.assert(
      fc.property(biomeTypeArb, biomeTypeArb, (a, b) => {
        return (
          restored.isCompatible(a, b) === matrix.isCompatible(a, b) &&
          restored.getIntermediate(a, b) === matrix.getIntermediate(a, b)
        );
      }),
      { numRuns: 200 },
    );
  });

  // Symmetry property
  it('isCompatible is symmetric for all biome pairs', () => {
    fc.assert(
      fc.property(biomeTypeArb, biomeTypeArb, (a, b) => {
        return matrix.isCompatible(a, b) === matrix.isCompatible(b, a);
      }),
      { numRuns: 200 },
    );
  });

  // Intermediate symmetry
  it('getIntermediate is symmetric for all biome pairs', () => {
    fc.assert(
      fc.property(biomeTypeArb, biomeTypeArb, (a, b) => {
        return matrix.getIntermediate(a, b) === matrix.getIntermediate(b, a);
      }),
      { numRuns: 200 },
    );
  });
});
