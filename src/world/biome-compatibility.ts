import { BiomeType } from './chunk';

/** Total number of BiomeType values. */
const NUM_BIOMES = 13; // OCEAN=0 ... GLACIER=12

/**
 * Plain JSON-safe serialisation of a BiomeCompatibilityMatrix.
 */
export interface SerializedCompatibilityMatrix {
  /** Schema version - always 1 for this implementation. */
  version: 1;
  /**
   * Flat array of length NUM_BIOMES^2 encoding compatibility.
   * 1 = compatible, 0 = incompatible.
   * Index: a * NUM_BIOMES + b
   * NUM_BIOMES = 13 (OCEAN=0 ... GLACIER=12)
   */
  compatible: number[];
  /**
   * Flat array of length NUM_BIOMES^2 encoding the intermediate biome index.
   * -1 means no intermediate (pair is compatible).
   * Index: a * NUM_BIOMES + b
   * NUM_BIOMES = 13 (OCEAN=0 ... GLACIER=12)
   */
  intermediate: number[];
}

/**
 * Encodes which biome pairs are geographically compatible as direct neighbours
 * and, for incompatible pairs, which intermediate biome must be inserted.
 *
 * All lookups are O(1) via pre-computed flat arrays indexed by
 * `a * NUM_BIOMES + b`.
 *
 * Built-in incompatible pairs (symmetric):
 * - DESERT <-> TAIGA      -> intermediate: PLAINS
 * - DESERT <-> TUNDRA     -> intermediate: PLAINS
 * - DESERT <-> FOREST     -> intermediate: PLAINS
 * - DESERT <-> GLACIER    -> intermediate: TUNDRA
 * - OCEAN  <-> MOUNTAIN   -> intermediate: BEACH
 * - OCEAN  <-> VOLCANIC   -> intermediate: BEACH
 * - GLACIER <-> RAINFOREST -> intermediate: FOREST
 * - GLACIER <-> SWAMP     -> intermediate: PLAINS
 * - SAVANNA <-> TAIGA     -> intermediate: PLAINS
 * - SAVANNA <-> TUNDRA    -> intermediate: PLAINS
 * - SAVANNA <-> GLACIER   -> intermediate: TUNDRA
 */
export class BiomeCompatibilityMatrix {
  /** Flat array: 1 = compatible, 0 = incompatible. */
  private readonly _compatible: Uint8Array;
  /** Flat array: intermediate biome index, or -1 if none. */
  private readonly _intermediate: Int8Array;

  /**
   * Creates a new BiomeCompatibilityMatrix with the built-in incompatible pairs
   * pre-computed at construction time.
   */
  constructor() {
    this._compatible   = new Uint8Array(NUM_BIOMES * NUM_BIOMES);
    this._intermediate = new Int8Array(NUM_BIOMES * NUM_BIOMES).fill(-1);

    // Mark all pairs compatible by default
    this._compatible.fill(1);

    // Register built-in incompatible pairs
    this.markIncompatible(BiomeType.DESERT,     BiomeType.TAIGA,       BiomeType.PLAINS);
    this.markIncompatible(BiomeType.DESERT,     BiomeType.TUNDRA,      BiomeType.PLAINS);
    this.markIncompatible(BiomeType.DESERT,     BiomeType.FOREST,      BiomeType.PLAINS);
    this.markIncompatible(BiomeType.DESERT,     BiomeType.GLACIER,     BiomeType.TUNDRA);
    this.markIncompatible(BiomeType.OCEAN,      BiomeType.MOUNTAIN,    BiomeType.BEACH);
    this.markIncompatible(BiomeType.OCEAN,      BiomeType.VOLCANIC,    BiomeType.BEACH);
    this.markIncompatible(BiomeType.GLACIER,    BiomeType.RAINFOREST,  BiomeType.FOREST);
    this.markIncompatible(BiomeType.GLACIER,    BiomeType.SWAMP,       BiomeType.PLAINS);
    this.markIncompatible(BiomeType.SAVANNA,    BiomeType.TAIGA,       BiomeType.PLAINS);
    this.markIncompatible(BiomeType.SAVANNA,    BiomeType.TUNDRA,      BiomeType.PLAINS);
    this.markIncompatible(BiomeType.SAVANNA,    BiomeType.GLACIER,     BiomeType.TUNDRA);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns true if biomeA and biomeB can be direct neighbours.
   * O(1) lookup.
   * @param a - First biome type.
   * @param b - Second biome type.
   */
  isCompatible(a: BiomeType, b: BiomeType): boolean {
    return this._compatible[a * NUM_BIOMES + b] === 1;
  }

  /**
   * Returns the intermediate BiomeType that must appear between an incompatible
   * pair, or undefined for compatible pairs.
   * O(1) lookup.
   * @param a - First biome type.
   * @param b - Second biome type.
   */
  getIntermediate(a: BiomeType, b: BiomeType): BiomeType | undefined {
    const v = this._intermediate[a * NUM_BIOMES + b];
    return v === -1 ? undefined : (v as BiomeType);
  }

  /**
   * Serialises the matrix to a plain JSON-safe object.
   */
  serialise(): SerializedCompatibilityMatrix {
    return {
      version: 1,
      compatible:   Array.from(this._compatible),
      intermediate: Array.from(this._intermediate),
    };
  }

  /**
   * Deserialises a matrix from a plain JSON-safe object produced by `serialise()`.
   * @param data - Serialised matrix data.
   */
  static deserialise(data: SerializedCompatibilityMatrix): BiomeCompatibilityMatrix {
    const m = new BiomeCompatibilityMatrix();
    // Overwrite the pre-computed arrays with the serialised data
    for (let i = 0; i < NUM_BIOMES * NUM_BIOMES; i++) {
      m._compatible[i]   = data.compatible[i];
      m._intermediate[i] = data.intermediate[i];
    }
    return m;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Marks a pair as incompatible (symmetric) and records the intermediate biome.
   */
  private markIncompatible(a: BiomeType, b: BiomeType, intermediate: BiomeType): void {
    this._compatible[a * NUM_BIOMES + b] = 0;
    this._compatible[b * NUM_BIOMES + a] = 0;
    this._intermediate[a * NUM_BIOMES + b] = intermediate;
    this._intermediate[b * NUM_BIOMES + a] = intermediate;
  }
}
