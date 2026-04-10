// Resource cluster generation

import { SeededRNG } from '../core/rng.js';
import { NoiseEngine } from '../core/noise.js';
import { BiomeType, ChunkData, Resource, ResourceType } from '../world/chunk.js';

/**
 * Configuration for a specific resource type
 */
export interface ResourceTypeConfig {
  type: ResourceType;
  rarity: number; // 0-1, higher = more rare
  biomes: BiomeType[]; // Biomes where this resource can spawn
  minAmount: number;
  maxAmount: number;
}

/**
 * Configuration for resource generation
 */
export interface ResourceConfig {
  types: ResourceTypeConfig[];
  clusterScale: number; // Scale for noise-based clustering
  densityThreshold: number; // Noise threshold for resource placement (0-1)
}

/**
 * Generates resources in clusters based on biome and noise
 */
export class ResourceGenerator {
  private config: ResourceConfig;

  constructor(config: ResourceConfig) {
    this.config = config;
  }

  /**
   * Generate resources for a chunk
   * @param chunkData The chunk data containing heightmap and biome information
   * @param chunkSeed The seed for this specific chunk
   * @returns Array of resources placed in the chunk
   */
  generateResources(chunkData: ChunkData, chunkSeed: number): Resource[] {
    const resources: Resource[] = [];
    const { size, biomeMap } = chunkData;

    // Generate resources for each configured type
    for (const typeConfig of this.config.types) {
      // Create a noise engine with a seed derived from chunk seed and resource type
      const resourceSeed = chunkSeed + typeConfig.type;
      const noiseEngine = new NoiseEngine(resourceSeed);
      const rng = new SeededRNG(resourceSeed);

      // Sample each position in the chunk
      for (let localY = 0; localY < size; localY++) {
        for (let localX = 0; localX < size; localX++) {
          const index = localY * size + localX;
          const biome = biomeMap[index] as BiomeType;

          // Check if this biome supports this resource type
          if (!typeConfig.biomes.includes(biome)) {
            continue;
          }

          // Calculate world coordinates for noise sampling
          const worldX = chunkData.x * size + localX;
          const worldY = chunkData.y * size + localY;

          // Sample noise to determine resource density
          const noiseValue = noiseEngine.noise2D(
            worldX / this.config.clusterScale,
            worldY / this.config.clusterScale
          );

          // Normalize noise from [-1, 1] to [0, 1]
          const normalizedNoise = (noiseValue + 1) / 2;

          // Apply rarity modifier - higher rarity means higher threshold
          const threshold = this.config.densityThreshold + (typeConfig.rarity * 0.3);

          // Place resource if noise exceeds threshold
          if (normalizedNoise > threshold) {
            const amount = rng.nextInt(typeConfig.minAmount, typeConfig.maxAmount + 1);
            resources.push({
              x: localX,
              y: localY,
              type: typeConfig.type,
              amount,
            });
          }
        }
      }
    }

    return resources;
  }
}
