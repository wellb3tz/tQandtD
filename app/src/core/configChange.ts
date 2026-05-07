import type { WorldConfigOverrides } from '@engine/index';

const WORLD_REBUILD_CONFIG_KEYS = [
  'terrainConfig',
  'biomeConfig',
  'enhancedBiomeConfig',
  'resourceConfig',
  'structureConfig',
  'lakeConfig',
  'riverConfig',
  'noise3DConfig',
  'seed',
  'chunkSize',
  'maxCacheSize',
  'workerPoolConfig',
] as const satisfies readonly (keyof WorldConfigOverrides)[];

/**
 * Returns true when a config patch changes generated world data or runtime
 * generation infrastructure, requiring the active world session to be refreshed.
 */
export function requiresWorldRebuild(config: WorldConfigOverrides): boolean {
  return WORLD_REBUILD_CONFIG_KEYS.some((key) => key in config);
}

