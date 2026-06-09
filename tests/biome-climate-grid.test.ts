import { describe, expect, it } from 'vitest';
import {
  BiomeType,
  BiomeSystem,
  NUM_BIOMES,
  classifyLandBiomeFromClimate,
} from '../src';

describe('Biome climate grid', () => {
  it('keeps POLAR on the old GLACIER id for compatibility', () => {
    expect(BiomeType.POLAR).toBe(12);
    expect(BiomeType.GLACIER).toBe(BiomeType.POLAR);
    expect(NUM_BIOMES).toBe(15);
  });

  it('covers the full temperature and moisture range without fallback gaps', () => {
    const temperatures = [-1, -0.76, -0.75, -0.45, -0.10, 0.25, 0.55, 1];
    const moistures = [-1, -0.55, -0.15, 0.25, 0.60, 1];

    for (const temperature of temperatures) {
      for (const moisture of moistures) {
        const biome = classifyLandBiomeFromClimate(temperature, moisture);
        expect(biome).toBeGreaterThanOrEqual(BiomeType.OCEAN);
        expect(biome).toBeLessThan(NUM_BIOMES);
      }
    }
  });

  it('places steppe between plains, savanna, and desert', () => {
    expect(classifyLandBiomeFromClimate(0.10, -0.75)).toBe(BiomeType.STEPPE);
    expect(classifyLandBiomeFromClimate(0.35, -0.35)).toBe(BiomeType.STEPPE);
    expect(classifyLandBiomeFromClimate(0.65, -0.75)).toBe(BiomeType.DESERT);
    expect(classifyLandBiomeFromClimate(0.65, -0.35)).toBe(BiomeType.SAVANNA);
    expect(classifyLandBiomeFromClimate(0.10, -0.35)).toBe(BiomeType.PLAINS);
  });

  it('places dry forest between forest, steppe, and savanna', () => {
    expect(classifyLandBiomeFromClimate(0.35, 0.00)).toBe(BiomeType.DRY_FOREST);
    expect(classifyLandBiomeFromClimate(0.35, -0.35)).toBe(BiomeType.STEPPE);
    expect(classifyLandBiomeFromClimate(0.35, 0.35)).toBe(BiomeType.FOREST);
    expect(classifyLandBiomeFromClimate(0.65, 0.00)).toBe(BiomeType.SAVANNA);
  });

  it('uses the same grid through the legacy biome path', () => {
    const system = new BiomeSystem(1, {
      temperatureScale: 0.001,
      moistureScale: 0.001,
      blendRadius: 0.5,
    });

    (system as any).getTemperature = () => 0.35;
    (system as any).getMoisture = () => 0.00;

    expect(system.getBiome(0, 0, 0.5)).toBe(BiomeType.DRY_FOREST);
  });
});
