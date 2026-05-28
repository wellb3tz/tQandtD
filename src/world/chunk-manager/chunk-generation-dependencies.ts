import { NoiseEngine } from '../../core/noise';
import { ResourceGenerator } from '../../gen/resources';
import { StructurePlacer } from '../../gen/structures';
import { TerrainGenerator } from '../../gen/terrain';
import { BiomeSystem } from '../biome';
import { EnhancedBiomeSystem } from '../enhanced-biome';
import type { WorldConfig } from '../world-config';

export interface ChunkGenerationDependencies {
  terrainGenerator: TerrainGenerator;
  biomeSystem: BiomeSystem;
  resourceGenerator: ResourceGenerator;
  structurePlacer: StructurePlacer;
  noiseEngine3D: NoiseEngine | null;
  enhancedBiomeSystem: EnhancedBiomeSystem | null;
}

export function createChunkGenerationDependencies(config: WorldConfig): ChunkGenerationDependencies {
  const terrainGenerator = new TerrainGenerator(config.terrainConfig);
  const noiseEngine3D = config.noise3DConfig?.enable3D
    ? new NoiseEngine(config.seed)
    : null;

  let biomeSystem: BiomeSystem;
  let enhancedBiomeSystem: EnhancedBiomeSystem | null;
  if (config.enhancedBiomeConfig) {
    enhancedBiomeSystem = new EnhancedBiomeSystem(config.seed, config.enhancedBiomeConfig);
    biomeSystem = enhancedBiomeSystem;
  } else {
    biomeSystem = new BiomeSystem(config.seed, config.biomeConfig);
    enhancedBiomeSystem = null;
  }

  return {
    terrainGenerator,
    biomeSystem,
    resourceGenerator: new ResourceGenerator(config.resourceConfig),
    structurePlacer: new StructurePlacer(config.structureConfig),
    noiseEngine3D,
    enhancedBiomeSystem,
  };
}
