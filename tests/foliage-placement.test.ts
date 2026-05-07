import { describe, expect, it } from 'vitest';
import {
  BiomeType,
  createSparseBiomeWeights,
  planFoliagePlacements,
} from '../src';

const HEIGHT_SCALE = 50;
const TREE_AND_PROP_PROTOTYPE_MIN_Y = -0.50;

describe('foliage placement planner', () => {
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
    expect(plan?.treePlacements.length).toBeLessThanOrEqual(512);
    expect(plan?.treePlacements.some(placement => placement.z >= 31)).toBe(true);
    expect(plan?.clearingCount).toBeGreaterThan(0);
  });

  it('does not create shoreline shrubs near rivers or lake banks', () => {
    const riverPlan = planFoliagePlacements(0, 0, {
      size: 8,
      heightmap: new Float32Array(81).fill(0.5),
      biomeMap: new Uint8Array(64).fill(BiomeType.FOREST),
      rivers: [{
        riverId: 'river_bank_1',
        pathId: 'river_bank_1:main',
        isTributary: false,
        points: [
          { x: 0.5, y: 0, height: 0.5, surfaceLevel: 0.5, width: 1, depth: 0.04, channelWidth: 1.6, flowX: 0, flowY: 1 },
          { x: 0.5, y: 8, height: 0.5, surfaceLevel: 0.5, width: 1, depth: 0.04, channelWidth: 1.6, flowX: 0, flowY: 1 },
        ],
        bounds: { minX: 0.5, maxX: 0.5, minY: 0, maxY: 8 },
      }],
      resources: [],
      structures: [],
    }, 0.3);

    const lakePlan = planFoliagePlacements(0, 0, {
      size: 8,
      heightmap: new Float32Array(81).fill(0.5),
      biomeMap: new Uint8Array(64).fill(BiomeType.FOREST),
      lakes: [{
        waterLevel: 0.55,
        tiles: new Set([27, 28, 35, 36]),
        maxDepth: 0.08,
        minTerrainHeight: 0.5,
      }],
      resources: [],
      structures: [],
    }, 0.3);

    expect(riverPlan).toBeDefined();
    expect(lakePlan).toBeDefined();
    expect(riverPlan?.shrubPlacements).toHaveLength(0);
    expect(lakePlan?.shrubPlacements).toHaveLength(0);
  });

  it('anchors foliage to the terrain surface at the jittered placement point', () => {
    const size = 16;
    const verticesPerSide = size + 1;
    const heightmap = new Float32Array(verticesPerSide * verticesPerSide);
    for (let y = 0; y < verticesPerSide; y++) {
      for (let x = 0; x < verticesPerSide; x++) {
        heightmap[y * verticesPerSide + x] = 0.74 - x * 0.006 - y * 0.005;
      }
    }

    const plan = planFoliagePlacements(0, 0, {
      size,
      heightmap,
      biomeMap: new Uint8Array(size * size).fill(BiomeType.FOREST),
      resources: [],
      structures: [],
    }, 0.3);

    expect(plan).toBeDefined();
    expect(plan?.treePlacements.length).toBeGreaterThan(0);

    for (const placement of plan!.treePlacements) {
      const expectedSurface = sampleTerrainSurface(heightmap, size, placement.x, placement.z) * HEIGHT_SCALE;
      const actualBase = placement.y + TREE_AND_PROP_PROTOTYPE_MIN_Y * placement.height;
      expect(actualBase).toBeCloseTo(expectedSurface, 5);
    }

    for (const placement of plan!.terrainPropPlacements) {
      const expectedSurface = sampleTerrainSurface(heightmap, size, placement.x, placement.z) * HEIGHT_SCALE;
      const actualBase = placement.y + TREE_AND_PROP_PROTOTYPE_MIN_Y * placement.height;
      expect(actualBase).toBeCloseTo(expectedSurface, 5);
    }

    expect(plan!.shrubPlacements).toHaveLength(0);
  });
});

function sampleTerrainSurface(heightmap: Float32Array, size: number, worldX: number, worldZ: number): number {
  const verticesPerSide = size + 1;
  const tileX = Math.min(size - 1, Math.max(0, Math.floor(worldX)));
  const tileZ = Math.min(size - 1, Math.max(0, Math.floor(worldZ)));
  const localX = worldX - tileX;
  const localZ = worldZ - tileZ;
  const topLeftIndex = tileZ * verticesPerSide + tileX;
  const h00 = heightmap[topLeftIndex];
  const h10 = heightmap[topLeftIndex + 1];
  const h01 = heightmap[topLeftIndex + verticesPerSide];
  const h11 = heightmap[topLeftIndex + verticesPerSide + 1];

  if (localX + localZ <= 1) {
    return h00 + localX * (h10 - h00) + localZ * (h01 - h00);
  }

  return h11 + (1 - localX) * (h01 - h11) + (1 - localZ) * (h10 - h11);
}
