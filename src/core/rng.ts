/**
 * Deterministic random number generator using the mulberry32 algorithm.
 * Provides reproducible random sequences based on a numeric seed.
 */
export class SeededRNG {
  private state: number;

  /**
   * Creates a new SeededRNG instance with the given seed.
   * @param seed - Numeric seed value for initialization
   * @throws {Error} If seed is NaN or infinite
   */
  constructor(seed: number) {
    if (!Number.isFinite(seed)) {
      throw new Error('Invalid seed: seed must be a finite number');
    }
    // Ensure seed is a 32-bit integer
    this.state = seed >>> 0;
  }

  /**
   * Generates the next random integer in the range [min, max).
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (exclusive)
   * @returns Random integer in [min, max)
   * @throws {Error} If min >= max or if values are not finite
   */
  nextInt(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error('Invalid range: min and max must be finite numbers');
    }
    if (min >= max) {
      throw new Error('Invalid range: min must be less than max');
    }
    const range = max - min;
    return Math.floor(this.nextFloat() * range) + min;
  }

  /**
   * Generates the next random float in the range [0, 1).
   * @returns Random float in [0, 1)
   */
  nextFloat(): number {
    // Mulberry32 algorithm
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Creates a new RNG instance with a derived seed.
   * Useful for creating independent RNG streams for different purposes.
   * @param offset - Numeric offset to add to the current seed
   * @returns New SeededRNG instance with derived seed
   */
  derive(offset: number): SeededRNG {
    if (!Number.isFinite(offset)) {
      throw new Error('Invalid offset: offset must be a finite number');
    }
    // Create a new RNG with a derived seed
    return new SeededRNG(this.state + offset);
  }
}
