import { describe, expect, it, vi } from 'vitest';
import { BiomeType } from '../src/world/chunk';
import { generateChunkBiomeData } from '../src/world/chunk-manager/chunk-biome-processing';
import type { BiomeSystem } from '../src/world/biome';

describe('chunk biome processing', () => {
  it('keeps sampled height and biome caches independent for blended samples', () => {
    const sampledHeights: number[] = [];
    const biomeSystem = {
      getBiome: vi.fn((_x: number, _y: number, height: number) => {
        sampledHeights.push(height);
        return BiomeType.FOREST;
      }),
      getBiomeWeightsWithRadius: (
        x: number,
        y: number,
        getHeight: (worldX: number, worldY: number) => number,
        _radius: number,
        _biomeCache?: Map<string, BiomeType>,
        biomeLookup?: (x: number, y: number, height: number) => BiomeType,
      ) => {
        const height = getHeight(x + 0.5, y + 0.5);
        const biome = biomeLookup?.(x + 0.5, y + 0.5, height) ?? BiomeType.OCEAN;
        return new Map([[biome, 1]]);
      },
      getTemperature: () => 0,
    } as unknown as BiomeSystem;

    const result = generateChunkBiomeData(0, 0, new Float32Array([0, 1, 1, 1]), {
      chunkSize: 1,
      worldSeed: 1,
      biomeConfig: {
        temperatureScale: 100,
        moistureScale: 100,
        blendRadius: 1,
      },
      biomeSystem,
      enhancedBiomeSystem: null,
      getTerrainHeightAt: () => {
        throw new Error('in-chunk samples should use the provided heightmap');
      },
      enablePerformanceMetrics: false,
    });

    expect(Array.from(result.sparseBiomeTypes)).toEqual([BiomeType.FOREST]);
    expect(sampledHeights).toContain(0.75);
  });
});
