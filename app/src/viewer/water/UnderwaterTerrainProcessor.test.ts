import { describe, expect, it } from 'vitest';
import { BiomeType } from '@engine/index';
import { BIOME_COLORS } from '../materials';
import { adjustUnderwaterColors } from './UnderwaterTerrainProcessor';

describe('UnderwaterTerrainProcessor', () => {
  it('does not color pure ocean floor as bright beach sand', () => {
    const colors = adjustUnderwaterColors(
      new Float32Array([0.22, 0.22, 0.22, 0.22]),
      {
        sparseBiomeOffsets: new Uint16Array([0]),
        sparseBiomeTypes: new Uint8Array([BiomeType.OCEAN]),
        sparseBiomeWeights: new Float32Array([1]),
      },
      1,
      {
        seaLevel: 0.3,
        darkenFactor: 0.4,
        desaturationFactor: 0.5,
        enableDepthGradient: true,
      },
    );

    expect(colors[0]).not.toBeNull();
    expect(colors[0]!.r).toBeLessThan(BIOME_COLORS[BiomeType.BEACH].r * 0.25);
    expect(colors[0]!.g).toBeLessThan(BIOME_COLORS[BiomeType.BEACH].g * 0.25);
  });
});
