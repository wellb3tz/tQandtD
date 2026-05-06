import { describe, expect, it } from 'vitest';
import {
  BiomeType,
  RIVER_TRENCH_DARKEN_STRENGTH,
  calculateRiverTrenchInfluence,
  getRiverTrenchDarkening,
  type ChunkData,
} from '../src';

describe('terrain detail helpers', () => {
  it('calculates river trench influence independently from Three.js', () => {
    const data = createRiverChunk();

    expect(calculateRiverTrenchInfluence(data, 0, 0)).toBeCloseTo(1);
    expect(getRiverTrenchDarkening(data, 0, 0)).toBeCloseTo(1 - RIVER_TRENCH_DARKEN_STRENGTH);
    expect(calculateRiverTrenchInfluence(data, 0, 2)).toBe(0);
    expect(getRiverTrenchDarkening(data, 0, 2)).toBe(1);
  });

  it('interpolates channel width along river segments', () => {
    const data = createRiverChunk({
      rivers: [{
        riverId: 'river_1',
        pathId: 'river_1:main',
        isTributary: false,
        points: [
          { x: 0, y: 0, height: 0.3, surfaceLevel: 0.31, width: 1, depth: 0.04, channelWidth: 1, flowX: 1, flowY: 0 },
          { x: 4, y: 0, height: 0.3, surfaceLevel: 0.31, width: 1, depth: 0.04, channelWidth: 3, flowX: 1, flowY: 0 },
        ],
        bounds: { minX: 0, maxX: 4, minY: 0, maxY: 0 },
      }],
    });

    expect(calculateRiverTrenchInfluence(data, 2, 0.9)).toBeGreaterThan(0);
    expect(calculateRiverTrenchInfluence(data, 0, 0.9)).toBe(0);
  });
});

function createRiverChunk(overrides: Partial<ChunkData> = {}): ChunkData {
  return {
    size: 1,
    heightmap: new Float32Array([0.31, 0.31, 0.84, 0.84]),
    biomeMap: new Uint8Array([BiomeType.MOUNTAIN]),
    biomeWeights: new Float32Array(13),
    rivers: [{
      riverId: 'river_1',
      pathId: 'river_1:main',
      isTributary: false,
      points: [
        { x: 0, y: 0, height: 0.31, surfaceLevel: 0.31, width: 1, depth: 0.04, channelWidth: 2, flowX: 1, flowY: 0 },
        { x: 1, y: 0, height: 0.31, surfaceLevel: 0.31, width: 1, depth: 0.04, channelWidth: 2, flowX: 1, flowY: 0 },
      ],
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 0 },
    }],
    resources: [],
    structures: [],
    ...overrides,
  } as ChunkData;
}
