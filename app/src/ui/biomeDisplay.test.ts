import { describe, expect, it } from 'vitest';
import { BiomeType } from '@engine/index';
import { getBiomeCssColor, getBiomeDisplayName, getBiomeRgb255 } from './biomeDisplay';
import { getBiomeColor } from '../viewer/materials';

describe('biomeDisplay', () => {
  it('derives biome names from the current enum', () => {
    expect(getBiomeDisplayName(BiomeType.OCEAN)).toBe('Ocean');
    expect(getBiomeDisplayName(BiomeType.RAINFOREST)).toBe('Rainforest');
    expect(getBiomeDisplayName(BiomeType.POLAR)).toBe('Polar');
    expect(getBiomeDisplayName(BiomeType.DRY_FOREST)).toBe('Dry Forest');
    expect(getBiomeDisplayName(999)).toBe('Unknown');
  });

  it('converts shared renderer biome colors to UI image RGB values', () => {
    const color = getBiomeColor(BiomeType.OCEAN);

    expect(getBiomeRgb255(BiomeType.OCEAN)).toEqual([
      Math.round(color.r * 255),
      Math.round(color.g * 255),
      Math.round(color.b * 255),
    ]);
    expect(getBiomeCssColor(BiomeType.OCEAN)).toBe('rgb(24,80,150)');
  });
});
