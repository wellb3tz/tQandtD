/**
 * Hash utilities for deterministic seed derivation
 * Uses bit-mixing for fast, deterministic hashing
 */

/**
 * Combines multiple numeric values into a single hash value
 * Uses a simple but effective bit-mixing algorithm for speed and determinism
 * 
 * @param values - Numbers to combine into a hash
 * @returns A 32-bit integer hash value
 */
export function hash(...values: number[]): number {
  let h = 0x811c9dc5; // FNV-1a offset basis (32-bit)
  
  for (const value of values) {
    // Convert to 32-bit integer
    const v = value | 0;
    
    // Mix in the bytes of the value
    h ^= (v & 0xff);
    h = Math.imul(h, 0x01000193); // FNV-1a prime
    
    h ^= ((v >> 8) & 0xff);
    h = Math.imul(h, 0x01000193);
    
    h ^= ((v >> 16) & 0xff);
    h = Math.imul(h, 0x01000193);
    
    h ^= ((v >> 24) & 0xff);
    h = Math.imul(h, 0x01000193);
  }
  
  // Final avalanche mixing
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  
  return h | 0; // Ensure 32-bit signed integer
}

/**
 * Generates a unique seed for a chunk based on world seed and chunk coordinates
 * Ensures different chunks get different seeds for independent generation
 * 
 * @param worldSeed - The world's base seed
 * @param chunkX - Chunk X coordinate
 * @param chunkY - Chunk Y coordinate
 * @returns A unique seed for this chunk
 */
export function chunkSeed(worldSeed: number, chunkX: number, chunkY: number): number {
  return hash(worldSeed, chunkX, chunkY);
}
