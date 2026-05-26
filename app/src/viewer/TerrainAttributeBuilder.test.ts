import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BiomeType, calculateRiverBankInfluence, type ChunkData } from '@engine/index';
import {
  applyTerrainDetailAndColorModulation,
  calculateVertexSurfaceWeights,
  getRiverbedDarkening,
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

  it('paints damp riverbank surfaces outside the channel', () => {
    const data = createRiverChunk({
      size: 4,
      heightmap: new Float32Array(25).fill(0.48),
      biomeMap: new Uint8Array(16).fill(BiomeType.PLAINS),
      rivers: [{
        riverId: 'river_1',
        pathId: 'river_1:main',
        isTributary: false,
        points: [
          { x: 0, y: 1, height: 0.48, surfaceLevel: 0.48, width: 1, depth: 0.04, channelWidth: 1, valleyWidth: 6, flowX: 1, flowY: 0 },
          { x: 4, y: 1, height: 0.48, surfaceLevel: 0.48, width: 1, depth: 0.04, channelWidth: 1, valleyWidth: 6, flowX: 1, flowY: 0 },
        ],
        bounds: { minX: 0, maxX: 4, minY: 1, maxY: 1 },
      }],
    });

    const weights = calculateVertexSurfaceWeights(data, 2, 3);

    expect(getRiverTrenchDarkening(data, 2, 3)).toBe(1);
    expect(calculateRiverBankInfluence(data, 2, 3)).toBeGreaterThan(0);
    expect(weights.swampMud + weights.beach + weights.forestFloor).toBeGreaterThan(0);
    expect(weights.riverbed).toBe(0);
  });

  it('uses muted seabed texture weights for underwater ocean tiles', () => {
    const data = {
      size: 1,
      heightmap: new Float32Array([0.22, 0.22, 0.22, 0.22]),
      biomeMap: new Uint8Array([BiomeType.OCEAN]),
      resources: [],
      structures: [],
    } as unknown as ChunkData;

    const weights = calculateVertexSurfaceWeights(data, 0, 0);

    expect(weights.riverbed).toBe(1);
    expect(weights.beach).toBe(0);
    expect(weights.plains).toBe(0);
  });

  it('keeps dry riverbeds visible without treating them as wet water channels', () => {
    const data = createRiverChunk({
      rivers: [{
        riverId: 'river_1',
        pathId: 'river_1:main',
        isTributary: false,
        state: 'dry',
        points: [
          { x: 0, y: 0, height: 0.31, surfaceLevel: 0.31, width: 1, depth: 0.04, channelWidth: 2, flowX: 1, flowY: 0 },
          { x: 1, y: 0, height: 0.31, surfaceLevel: 0.31, width: 1, depth: 0.04, channelWidth: 2, flowX: 1, flowY: 0 },
        ],
        bounds: { minX: 0, maxX: 1, minY: 0, maxY: 0 },
      }],
    });

    expect(getRiverTrenchDarkening(data, 0, 0)).toBe(1);
    expect(getRiverbedDarkening(data, 0, 0)).toBeLessThan(1);
    expect(calculateVertexSurfaceWeights(data, 0, 0).riverbed).toBe(1);
  });

  it('biases lowland tiles near lakes toward wetter surfaces', () => {
    const data = {
      size: 2,
      heightmap: new Float32Array([
        0.34, 0.35, 0.36,
        0.35, 0.36, 0.37,
        0.36, 0.37, 0.38,
      ]),
      biomeMap: new Uint8Array([
        BiomeType.PLAINS,
        BiomeType.PLAINS,
        BiomeType.PLAINS,
        BiomeType.PLAINS,
      ]),
      lakes: [{
        waterLevel: 0.36,
        tiles: new Set([0]),
        maxDepth: 0.03,
      }],
      resources: [],
      structures: [],
    } as unknown as ChunkData;

    const weights = calculateVertexSurfaceWeights(data, 1, 1);

    expect(weights.swampMud + weights.forestFloor).toBeGreaterThan(0);
    expect(weights.plains).toBeLessThan(1);
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

  it('extends wet detail masks onto riverbanks without marking them as riverbed', () => {
    const data = createRiverChunk({
      size: 4,
      heightmap: new Float32Array(25).fill(0.48),
      biomeMap: new Uint8Array(16).fill(BiomeType.PLAINS),
      rivers: [{
        riverId: 'river_1',
        pathId: 'river_1:main',
        isTributary: false,
        points: [
          { x: 0, y: 1, height: 0.48, surfaceLevel: 0.48, width: 1, depth: 0.04, channelWidth: 1, valleyWidth: 6, flowX: 1, flowY: 0 },
          { x: 4, y: 1, height: 0.48, surfaceLevel: 0.48, width: 1, depth: 0.04, channelWidth: 1, valleyWidth: 6, flowX: 1, flowY: 0 },
        ],
        bounds: { minX: 0, maxX: 4, minY: 1, maxY: 1 },
      }],
    });
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      2, 24, 2,
      3, 24, 2,
      2, 24, 3,
      3, 24, 3,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12).fill(0.5), 3));
    geometry.setIndex([0, 2, 1, 1, 2, 3]);
    geometry.computeVertexNormals();

    const detailBlend = applyTerrainDetailAndColorModulation({
      geometry,
      vertices,
      data,
      chunkSize: 4,
      worldXBase: 0,
      worldZBase: 0,
      seaLevel: 0.3,
      heightScale: 50,
    });

    expect(detailBlend[2]).toBeGreaterThan(0);
    expect(detailBlend[3]).toBe(0);
  });

  it('uses climate snow line and local temperature in the legacy detail helper', () => {
    const data = createRiverChunk({
      heightmap: new Float32Array([0.9, 0.9, 0.9, 0.9]),
      biomeMap: new Uint8Array([BiomeType.MOUNTAIN]),
      climateSnowLine: 0.95,
      temperatureMap: new Float32Array([0.5]),
    });
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 45, 0,
      1, 45, 0,
      0, 45, 1,
      1, 45, 1,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12).fill(0.4), 3));
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

    expect(detailBlend[1]).toBe(0);
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
