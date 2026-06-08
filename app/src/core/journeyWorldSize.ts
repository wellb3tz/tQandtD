import {
  DEFAULT_CLIMATE_CONFIG,
  DEFAULT_DIRECTIONAL_CLIMATE_CONFIG,
  TERRAIN_TILE_SIZE_METERS,
  type DirectionalClimateConfig,
  type WorldConfig,
  type WorldConfigOverrides,
} from '@engine/index';

export type JourneyWorldSizePreset = 'M' | 'L' | 'XL';

export interface JourneyWorldBounds {
  minChunkX: number;
  maxChunkX: number;
  minChunkY: number;
  maxChunkY: number;
  minWorldX: number;
  maxWorldX: number;
  minWorldZ: number;
  maxWorldZ: number;
}

export interface JourneyWorldSizeConfig {
  preset: JourneyWorldSizePreset;
  label: string;
  chunkSpan: number;
  sizeKm: number;
  directionalScale: number;
  bounds: JourneyWorldBounds;
}

export const DEFAULT_JOURNEY_WORLD_SIZE_PRESET: JourneyWorldSizePreset = 'L';

export const JOURNEY_WORLD_SIZE_CHUNK_SPANS: Record<JourneyWorldSizePreset, number> = {
  M: 12,
  L: 24,
  XL: 48,
};

export function getJourneyWorldSizeConfig(
  preset: JourneyWorldSizePreset,
  chunkSizeTiles: number,
): JourneyWorldSizeConfig {
  const chunkSpan = JOURNEY_WORLD_SIZE_CHUNK_SPANS[preset];
  const halfChunkSpan = chunkSpan / 2;
  const minChunk = -halfChunkSpan;
  const maxChunk = halfChunkSpan - 1;
  const worldSizeTiles = chunkSpan * chunkSizeTiles;
  const halfWorldSizeTiles = worldSizeTiles / 2;
  const halfWorldSizeMeters = halfWorldSizeTiles * TERRAIN_TILE_SIZE_METERS;
  const sizeKm = (worldSizeTiles * TERRAIN_TILE_SIZE_METERS) / 1000;

  return {
    preset,
    label: `${preset} ${sizeKm.toFixed(2)} km`,
    chunkSpan,
    sizeKm,
    directionalScale: halfWorldSizeTiles,
    bounds: {
      minChunkX: minChunk,
      maxChunkX: maxChunk,
      minChunkY: minChunk,
      maxChunkY: maxChunk,
      minWorldX: -halfWorldSizeMeters,
      maxWorldX: halfWorldSizeMeters,
      minWorldZ: -halfWorldSizeMeters,
      maxWorldZ: halfWorldSizeMeters,
    },
  };
}

export function isJourneyWorldSizePreset(value: string | null | undefined): value is JourneyWorldSizePreset {
  return value === 'M' || value === 'L' || value === 'XL';
}

export function createJourneyWorldConfigPatch(
  config: WorldConfig,
  size: JourneyWorldSizeConfig,
): WorldConfigOverrides {
  const directionalClimateConfig = createDirectionalClimateConfig(config, size.directionalScale);

  return {
    terrainConfig: {
      directionalClimateConfig,
    },
    biomeConfig: {
      directionalClimateConfig,
    },
    enhancedBiomeConfig: config.enhancedBiomeConfig
      ? {
          directionalClimateConfig,
          climateConfig: {
            ...DEFAULT_CLIMATE_CONFIG,
            ...config.enhancedBiomeConfig.climateConfig,
            directionalClimateConfig,
          },
        }
      : undefined,
  };
}

export function isChunkWithinJourneyBounds(
  chunkX: number,
  chunkY: number,
  bounds: JourneyWorldBounds | null | undefined,
): boolean {
  if (!bounds) return true;
  return (
    chunkX >= bounds.minChunkX &&
    chunkX <= bounds.maxChunkX &&
    chunkY >= bounds.minChunkY &&
    chunkY <= bounds.maxChunkY
  );
}

function createDirectionalClimateConfig(
  config: WorldConfig,
  scale: number,
): DirectionalClimateConfig {
  return {
    ...DEFAULT_DIRECTIONAL_CLIMATE_CONFIG,
    ...config.terrainConfig.directionalClimateConfig,
    ...config.biomeConfig.directionalClimateConfig,
    ...config.enhancedBiomeConfig?.directionalClimateConfig,
    enabled: true,
    preset: 'fantasy-regions',
    scale,
  };
}
