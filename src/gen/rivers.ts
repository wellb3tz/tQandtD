import { SeededRNG } from '../core/rng';
import { ChunkData } from '../world/chunk';

/**
 * Configuration for river generation
 */
export interface RiverConfig {
  /** Minimum elevation for river sources */
  sourceElevation: number;
  /** Minimum length for a river to be kept */
  minFlowLength: number;
  /** Width of river paths (in tiles) */
  flowWidth: number;
}

/**
 * Generates rivers using downhill flow algorithm.
 * Rivers follow the steepest descent based on heightmap.
 */
export class RiverGenerator {
  private config: RiverConfig;

  /**
   * Creates a new RiverGenerator with the given configuration.
   * @param config - River generation parameters
   */
  constructor(config: RiverConfig) {
    this.config = config;
  }

  /**
   * Generates rivers for a chunk.
   * @param chunkData - The chunk data containing heightmap
   * @param chunkSeed - Unique seed for this chunk
   * @returns Set of flat indices representing river tiles
   */
  generateRivers(chunkData: ChunkData, chunkSeed: number): Set<number> {
    const { heightmap, size } = chunkData;
    const rng = new SeededRNG(chunkSeed);
    const allRiverTiles = new Set<number>();

    // Find potential river sources (high elevation tiles)
    const sources = this.findRiverSources(heightmap, size, rng);

    // Trace each river from its source
    for (const sourceIndex of sources) {
      const riverPath = this.traceRiverPath(heightmap, size, sourceIndex);

      // Only keep rivers that meet minimum length requirement
      if (riverPath.length >= this.config.minFlowLength) {
        // Apply flow width to widen the river
        const widenedPath = this.widenRiverPath(riverPath, size);
        widenedPath.forEach(index => allRiverTiles.add(index));
      }
    }

    return allRiverTiles;
  }

  /**
   * Finds potential river source positions at high elevations.
   * @param heightmap - The chunk heightmap
   * @param size - Chunk size
   * @param rng - Random number generator
   * @returns Array of flat indices for river sources
   */
  private findRiverSources(
    heightmap: Float32Array,
    size: number,
    rng: SeededRNG
  ): number[] {
    const sources: number[] = [];

    // Sample a few random positions and check if they're high enough
    const numAttempts = Math.floor(size * size * 0.05); // 5% of tiles

    for (let i = 0; i < numAttempts; i++) {
      const x = rng.nextInt(0, size);
      const y = rng.nextInt(0, size);
      const index = y * size + x;

      if (heightmap[index] >= this.config.sourceElevation) {
        sources.push(index);
      }
    }

    return sources;
  }

  /**
   * Traces a river path from a source using downhill flow.
   * @param heightmap - The chunk heightmap
   * @param size - Chunk size
   * @param sourceIndex - Starting position flat index
   * @returns Array of flat indices representing the river path
   */
  private traceRiverPath(
    heightmap: Float32Array,
    size: number,
    sourceIndex: number
  ): number[] {
    const path: number[] = [];
    const visited = new Set<number>();
    let currentIndex = sourceIndex;

    // Ocean level threshold (from design doc)
    const oceanLevel = 0.3;

    while (true) {
      // Mark current position as part of river
      path.push(currentIndex);
      visited.add(currentIndex);

      const currentHeight = heightmap[currentIndex];

      // Termination condition 1: Reached ocean level
      if (currentHeight < oceanLevel) {
        break;
      }

      // Find steepest descent among 8 neighbors
      const nextIndex = this.findSteepestDescent(
        heightmap,
        size,
        currentIndex,
        visited
      );

      // Termination condition 2: Local minimum (no lower neighbors)
      if (nextIndex === -1) {
        break;
      }

      currentIndex = nextIndex;
    }

    return path;
  }

  /**
   * Finds the neighbor with the steepest descent.
   * @param heightmap - The chunk heightmap
   * @param size - Chunk size
   * @param currentIndex - Current position flat index
   * @param visited - Set of already visited indices
   * @returns Flat index of steepest neighbor, or -1 if none found
   */
  private findSteepestDescent(
    heightmap: Float32Array,
    size: number,
    currentIndex: number,
    visited: Set<number>
  ): number {
    const x = currentIndex % size;
    const y = Math.floor(currentIndex / size);
    const currentHeight = heightmap[currentIndex];

    let steepestIndex = -1;
    let steepestDescent = 0;

    // Check all 8 neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;

        // Check bounds
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

        const neighborIndex = ny * size + nx;

        // Skip if already visited
        if (visited.has(neighborIndex)) continue;

        const neighborHeight = heightmap[neighborIndex];
        const descent = currentHeight - neighborHeight;

        // Find steepest descent (must be downhill)
        if (descent > steepestDescent) {
          steepestDescent = descent;
          steepestIndex = neighborIndex;
        }
      }
    }

    return steepestIndex;
  }

  /**
   * Widens a river path by adding adjacent tiles.
   * @param path - Original river path
   * @param size - Chunk size
   * @returns Set of flat indices including widened river
   */
  private widenRiverPath(path: number[], size: number): Set<number> {
    const widened = new Set<number>();

    for (const index of path) {
      widened.add(index);

      // Add adjacent tiles based on flow width
      if (this.config.flowWidth > 1) {
        const x = index % size;
        const y = Math.floor(index / size);

        const radius = Math.floor(this.config.flowWidth / 2);

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              widened.add(ny * size + nx);
            }
          }
        }
      }
    }

    return widened;
  }
}
