import { describe, expect, it } from 'vitest';
import { BiomeType, createSparseBiomeWeights } from '@engine/index';
import { planFoliagePlacements } from './FoliagePlacementPlanner';

describe('planFoliagePlacements', () => {
  it('uses sparse biome weights when deciding whether blended tiles can grow trees', () => {
    const tileWeights = Array.from({ length: 16 }, () => new Map([
      [BiomeType.PLAINS, 0.35],
      [BiomeType.FOREST, 0.65],
    ]));
    const sparse = createSparseBiomeWeights(tileWeights, 16);

    const plan = planFoliagePlacements(0, 0, {
      size: 4,
      heightmap: new Float32Array(25).fill(0.5),
      biomeMap: new Uint8Array(16).fill(BiomeType.PLAINS),
      sparseBiomeTypes: sparse.types,
      sparseBiomeWeights: sparse.weights,
      sparseBiomeOffsets: sparse.offsets,
      resources: [],
      structures: [],
    }, 0.3);

    expect(plan).toBeDefined();
    expect(plan?.treePlacements.length).toBeGreaterThan(0);
  });

  it('skips every foliage type on lake-covered tiles', () => {
    const plan = planFoliagePlacements(0, 0, {
      size: 4,
      heightmap: new Float32Array(25).fill(0.5),
      biomeMap: new Uint8Array(16).fill(BiomeType.FOREST),
      lakes: [{
        waterLevel: 0.55,
        tiles: new Set(Array.from({ length: 16 }, (_, index) => index)),
        maxDepth: 0.08,
        minTerrainHeight: 0.5,
      }],
      resources: [],
      structures: [],
    }, 0.3);

    expect(plan).toBeUndefined();
  });

  it('caps dense forest while preserving placements from trailing rows', () => {
    const plan = planFoliagePlacements(0, 0, {
      size: 32,
      heightmap: new Float32Array(33 * 33).fill(0.5),
      biomeMap: new Uint8Array(32 * 32).fill(BiomeType.FOREST),
      resources: [],
      structures: [],
    }, 0.3);

    expect(plan).toBeDefined();
    expect(plan?.treePlacements.length).toBeGreaterThan(512);
    expect(plan?.treePlacements.length).toBeLessThanOrEqual(2048);
    expect(plan?.treePlacements.some(placement => placement.z >= 31)).toBe(true);
    expect(plan?.clearingCount).toBeGreaterThan(0);
  });
});
