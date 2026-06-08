import { describe, expect, it } from 'vitest';
import { WorldApp } from './WorldApp';
import {
  createJourneyWorldConfigPatch,
  getJourneyWorldSizeConfig,
} from './journeyWorldSize';

describe('journey world size presets', () => {
  it('derives chunk-aligned larger journey sizes', () => {
    const medium = getJourneyWorldSizeConfig('M', 32);
    const large = getJourneyWorldSizeConfig('L', 32);
    const extraLarge = getJourneyWorldSizeConfig('XL', 32);

    expect(medium).toMatchObject({
      chunkSpan: 12,
      directionalScale: 192,
      bounds: {
        minChunkX: -6,
        maxChunkX: 5,
        minWorldX: -3840,
        maxWorldX: 3840,
      },
    });
    expect(large).toMatchObject({
      chunkSpan: 24,
      directionalScale: 384,
      bounds: {
        minChunkX: -12,
        maxChunkX: 11,
        minWorldZ: -7680,
        maxWorldZ: 7680,
      },
    });
    expect(extraLarge).toMatchObject({
      chunkSpan: 48,
      directionalScale: 768,
      bounds: {
        minChunkY: -24,
        maxChunkY: 23,
        minWorldX: -15360,
        maxWorldX: 15360,
      },
    });
  });

  it('applies directional climate scale consistently across world config systems', () => {
    const app = new WorldApp();
    const size = app.setJourneyWorldSize('XL');
    const config = app.getConfigSnapshot();

    expect(size?.preset).toBe('XL');
    expect(config.terrainConfig.directionalClimateConfig).toMatchObject({
      enabled: true,
      preset: 'fantasy-regions',
      scale: 768,
    });
    expect(config.biomeConfig.directionalClimateConfig).toMatchObject({
      enabled: true,
      preset: 'fantasy-regions',
      scale: 768,
    });
    expect(config.enhancedBiomeConfig?.directionalClimateConfig).toMatchObject({
      enabled: true,
      preset: 'fantasy-regions',
      scale: 768,
    });
  });

  it('builds a config patch without changing unrelated terrain values', () => {
    const app = new WorldApp();
    const config = app.getConfigSnapshot();
    const size = getJourneyWorldSizeConfig('M', config.chunkSize);
    const patch = createJourneyWorldConfigPatch(config, size);

    expect(patch.terrainConfig).toEqual({
      directionalClimateConfig: {
        enabled: true,
        preset: 'fantasy-regions',
        scale: 192,
      },
    });
  });
});
