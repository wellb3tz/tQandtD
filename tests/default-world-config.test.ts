import { describe, expect, it } from 'vitest';
import {
  cloneWorldConfig,
  createDefaultWorldConfig,
  deriveNoise3DConfig,
  mergeWorldConfig,
  prepareWorldConfig,
  validateWorldConfig,
} from '../src';

describe('createDefaultWorldConfig', () => {
  it('creates a valid default world config', () => {
    const config = createDefaultWorldConfig();

    expect(config.seed).toBe(12345);
    expect(config.chunkSize).toBe(32);
    expect(() => validateWorldConfig(config)).not.toThrow();
  });

  it('returns fresh nested config objects', () => {
    const first = createDefaultWorldConfig();
    const second = createDefaultWorldConfig();

    first.resourceConfig.types[0].biomes.push(99);
    first.lakeConfig!.allowedBiomes.push(99);
    first.riverConfig!.enabled = false;

    expect(second.resourceConfig.types[0].biomes).not.toContain(99);
    expect(second.lakeConfig!.allowedBiomes).not.toContain(99);
    expect(second.riverConfig!.enabled).not.toBe(false);
  });

  it('accepts top-level overrides', () => {
    const config = createDefaultWorldConfig({ seed: 7, chunkSize: 16 });

    expect(config.seed).toBe(7);
    expect(config.chunkSize).toBe(16);
    expect(() => validateWorldConfig(config)).not.toThrow();
  });

  it('accepts nested overrides without dropping default fields', () => {
    const config = createDefaultWorldConfig({
      terrainConfig: {
        baseScale: 0.02,
        enable3D: true,
        zScale: 0.75,
      },
      riverConfig: {
        enabled: false,
      },
    });

    expect(config.terrainConfig.baseScale).toBe(0.02);
    expect(config.terrainConfig.octaves).toBe(4);
    expect(config.riverConfig!.enabled).toBe(false);
    expect(config.riverConfig!.allowedSourceBiomes.length).toBeGreaterThan(0);
    expect(config.noise3DConfig).toMatchObject({
      enable3D: true,
      scale: 0.02,
      zScale: 0.75,
    });
    expect(() => validateWorldConfig(config)).not.toThrow();
  });
});

describe('world config helpers', () => {
  it('derives 3D noise config from terrain config only when enabled', () => {
    const config = createDefaultWorldConfig();

    expect(deriveNoise3DConfig(config.terrainConfig)).toBeUndefined();

    const noiseConfig = deriveNoise3DConfig({
      ...config.terrainConfig,
      enable3D: true,
      baseScale: 0.04,
      zScale: 0.9,
    });

    expect(noiseConfig).toEqual({
      enable3D: true,
      octaves: config.terrainConfig.octaves,
      persistence: config.terrainConfig.persistence,
      lacunarity: config.terrainConfig.lacunarity,
      scale: 0.04,
      zScale: 0.9,
    });
  });

  it('prepares config by rebuilding stale noise3D config', () => {
    const base = createDefaultWorldConfig({
      terrainConfig: {
        enable3D: true,
        baseScale: 0.02,
      },
    });

    const prepared = prepareWorldConfig(base, {
      terrainConfig: {
        enable3D: false,
      },
    });

    expect(prepared.noise3DConfig).toBeUndefined();
    expect(prepared.terrainConfig.baseScale).toBe(0.02);
  });

  it('clones nested mutable config values', () => {
    const onChunkInvalidated = () => undefined;
    const original = createDefaultWorldConfig({ onChunkInvalidated });
    const clone = cloneWorldConfig(original);

    clone.resourceConfig.types[0].biomes.push(99);
    clone.lakeConfig!.allowedBiomes.push(99);
    clone.riverConfig!.allowedSourceBiomes.push(99);

    expect(clone.onChunkInvalidated).toBe(onChunkInvalidated);
    expect(original.resourceConfig.types[0].biomes).not.toContain(99);
    expect(original.lakeConfig!.allowedBiomes).not.toContain(99);
    expect(original.riverConfig!.allowedSourceBiomes).not.toContain(99);
  });

  it('merges nested config sections', () => {
    const base = createDefaultWorldConfig();
    const merged = mergeWorldConfig(base, {
      biomeConfig: {
        blendRadius: 2,
      },
      lakeConfig: {
        maxLakeTiles: 120,
      },
    });

    expect(merged.biomeConfig.blendRadius).toBe(2);
    expect(merged.biomeConfig.temperatureScale).toBe(base.biomeConfig.temperatureScale);
    expect(merged.lakeConfig!.maxLakeTiles).toBe(120);
    expect(merged.lakeConfig!.allowedBiomes).toEqual(base.lakeConfig!.allowedBiomes);
  });
});
