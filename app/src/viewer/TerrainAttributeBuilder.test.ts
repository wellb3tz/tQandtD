import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BiomeType, type ChunkData } from '../../../src/index';
import {
  applyTerrainDetailAndColorModulation,
  calculateVertexSurfaceWeights,
  getRiverTrenchDarkening,
} from './TerrainAttributeBuilder';

describe('TerrainAttributeBuilder', () => {
  it('normalizes surface weights from adjacent biome tiles', () => {
    const data = {
      size: 2,
      heightmap: new Float32Array(9),
      biomeMap: new Uint8Array([
        BiomeType.PLAINS,
        BiomeType.DESERT,
        BiomeType.BEACH,
        BiomeType.FOREST,
      ]),
      resources: [],
      structures: [],
    } as unknown as ChunkData;

    const weights = calculateVertexSurfaceWeights(data, 1, 1);
    const sum = Object.values(weights).reduce((total, weight) => total + weight, 0);

    expect(sum).toBeCloseTo(1);
    expect(weights.plains).toBeCloseTo(0.25);
    expect(weights.desert).toBeCloseTo(0.25);
    expect(weights.beach).toBeCloseTo(0.25);
    expect(weights.forestFloor).toBeCloseTo(0.25);
  });

  it('marks wide river channels as riverbed surface and detail', () => {
    const data = createRiverChunk();

    expect(getRiverTrenchDarkening(data, 0, 0)).toBeLessThan(1);
    expect(calculateVertexSurfaceWeights(data, 0, 0).riverbed).toBe(1);
  });

  it('builds cliff, snow, shoreline, and riverbed detail masks', () => {
    const data = createRiverChunk({
      heightmap: new Float32Array([0.31, 0.92, 0.31, 0.84]),
      biomeMap: new Uint8Array([BiomeType.MOUNTAIN]),
    });
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 15.5, 0,
      1, 46, 0,
      0, 15.5, 1,
      1, 42, 1,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([
      0.4, 0.4, 0.4,
      0.4, 0.4, 0.4,
      0.4, 0.4, 0.4,
      0.4, 0.4, 0.4,
    ]), 3));
    geometry.setIndex([0, 2, 1, 1, 2, 3]);
    geometry.computeVertexNormals();

    const detailBlend = applyTerrainDetailAndColorModulation({
      geometry,
      vertices,
      data,
      chunkSize: 1,
      worldXBase: 0,
      worldZBase: 0,
      seaLevel: 0.3,
      heightScale: 50,
    });

    expect(detailBlend[0]).toBeGreaterThan(0);
    expect(detailBlend[1 * 4 + 1]).toBeGreaterThan(0);
    expect(detailBlend[0 * 4 + 2]).toBeGreaterThan(0);
    expect(detailBlend[0 * 4 + 3]).toBeGreaterThan(0);
  });
});

function createRiverChunk(overrides: Partial<ChunkData> = {}): ChunkData {
  return {
    size: 1,
    heightmap: new Float32Array([0.31, 0.31, 0.84, 0.84]),
    biomeMap: new Uint8Array([BiomeType.MOUNTAIN]),
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
  } as unknown as ChunkData;
}
