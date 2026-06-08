import { describe, expect, it } from 'vitest';
import {
  BiomeSystem,
  ClimateSystem,
  DEFAULT_CLIMATE_CONFIG,
  DEFAULT_DIRECTIONAL_CLIMATE_CONFIG,
  TerrainGenerator,
  sampleDirectionalClimateField,
} from '../src';

const directional = {
  ...DEFAULT_DIRECTIONAL_CLIMATE_CONFIG,
  enabled: true,
  scale: 1000,
};

describe('Directional climate field', () => {
  it('samples the neutral center and fantasy-region compass edges deterministically', () => {
    expect(sampleDirectionalClimateField(0, 0, directional)).toEqual({
      temperature: 0,
      moisture: 0,
      heightMultiplier: 0,
      oceanCoverage: 0.10,
      oceanCoverageWeight: 0,
    });

    expect(sampleDirectionalClimateField(1000, 0, directional)).toMatchObject({
      temperature: 0.20,
      moisture: 0.55,
      heightMultiplier: -0.25,
    });

    expect(sampleDirectionalClimateField(-1000, 0, directional)).toMatchObject({
      temperature: -0.05,
      moisture: -0.20,
      heightMultiplier: 0.30,
    });

    expect(sampleDirectionalClimateField(0, -1000, directional)).toMatchObject({
      temperature: -1.00,
      moisture: -1.00,
      heightMultiplier: 0.35,
    });

    expect(sampleDirectionalClimateField(0, 1000, directional)).toMatchObject({
      temperature: 1.00,
      moisture: -1.00,
      heightMultiplier: -0.15,
      oceanCoverage: 0.10,
      oceanCoverageWeight: 1,
    });
  });

  it('blends adjacent fantasy regions at diagonal positions', () => {
    const sample = sampleDirectionalClimateField(1000, -1000, directional);

    expect(sample.temperature).toBeCloseTo(-0.80, 6);
    expect(sample.moisture).toBeCloseTo(-0.45, 6);
    expect(sample.heightMultiplier).toBeCloseTo(0.10, 6);
  });

  it('ramps ocean coverage toward the dry southern extreme', () => {
    const center = sampleDirectionalClimateField(0, 0, directional);
    const halfwaySouth = sampleDirectionalClimateField(0, 500, directional);
    const farSouth = sampleDirectionalClimateField(0, 10000, directional);

    expect(center.oceanCoverageWeight).toBe(0);
    expect(halfwaySouth.oceanCoverage).toBeCloseTo(0.10, 6);
    expect(halfwaySouth.oceanCoverageWeight).toBeGreaterThan(0);
    expect(halfwaySouth.oceanCoverageWeight).toBeLessThan(1);
    expect(farSouth.oceanCoverage).toBeCloseTo(0.10, 6);
    expect(farSouth.oceanCoverageWeight).toBe(1);
  });

  it('keeps the center on the legacy climate path while edges still reach the preset', () => {
    const seed = 42;
    const x = 0;
    const y = 0;
    const height = 0.5;
    const getHeight = () => 0.5;

    const baseClimate = new ClimateSystem(seed, {
      ...DEFAULT_CLIMATE_CONFIG,
    });
    const directionalClimate = new ClimateSystem(42, {
      ...DEFAULT_CLIMATE_CONFIG,
      directionalClimateConfig: directional,
    });

    expect(directionalClimate.getTemperature(x, y, height)).toBeCloseTo(baseClimate.getTemperature(x, y, height), 6);
    expect(directionalClimate.getMoisture(x, y, height, getHeight)).toBeCloseTo(baseClimate.getMoisture(x, y, height, getHeight), 6);

    const northEdge = sampleDirectionalClimateField(0, -10000, directional);
    expect(directionalClimate.getTemperature(0, -10000, height)).toBeCloseTo(northEdge.temperature, 6);
    expect(directionalClimate.getMoisture(0, -10000, height, getHeight)).toBeCloseTo(northEdge.moisture, 6);
  });

  it('preserves the legacy biome noise in the center for forests and swamps', () => {
    const seed = 42;
    const biomeConfig = {
      temperatureScale: 0.001,
      moistureScale: 0.001,
      blendRadius: 0.5,
    };

    const baseBiome = new BiomeSystem(seed, biomeConfig);
    const directionalBiome = new BiomeSystem(seed, {
      ...biomeConfig,
      directionalClimateConfig: directional,
    });

    expect(directionalBiome.getTemperature(0, 0)).toBeCloseTo(baseBiome.getTemperature(0, 0), 6);
    expect(directionalBiome.getMoisture(0, 0)).toBeCloseTo(baseBiome.getMoisture(0, 0), 6);
  });

  it('keeps the disabled preset path identical to the legacy climate path', () => {
    const seed = 42;
    const x = 750;
    const y = -500;
    const height = 0.5;
    const getHeight = () => 0.5;

    const baseClimate = new ClimateSystem(seed, {
      ...DEFAULT_CLIMATE_CONFIG,
    });
    const disabledClimate = new ClimateSystem(seed, {
      ...DEFAULT_CLIMATE_CONFIG,
      directionalClimateConfig: {
        ...directional,
        enabled: false,
      },
    });

    expect(disabledClimate.getTemperature(x, y, height)).toBe(baseClimate.getTemperature(x, y, height));
    expect(disabledClimate.getMoisture(x, y, height, getHeight)).toBe(baseClimate.getMoisture(x, y, height, getHeight));
  });

  it('biases terrain through the height multiplier only', () => {
    const seed = 42;
    const x = 1000;
    const y = -1000;
    const baseTerrain = new TerrainGenerator({
      baseScale: 0.02,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
      enableContinentalness: false,
    });
    const directionalTerrain = new TerrainGenerator({
      baseScale: 0.02,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      warpStrength: 10,
      heightMultiplier: 1.0,
      enableContinentalness: false,
      directionalClimateConfig: directional,
    });

    const baseHeight = baseTerrain.getHeightAt(x, y, seed);
    const diff = directionalTerrain.getHeightAt(x, y, seed) - baseHeight;
    const multiplierOffset = sampleDirectionalClimateField(x, y, directional).heightMultiplier * 0.12;
    expect(diff).toBeCloseTo(baseHeight * multiplierOffset, 6);
  });
});
