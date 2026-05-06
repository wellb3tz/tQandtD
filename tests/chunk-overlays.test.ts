import { describe, expect, it } from 'vitest';
import {
  ResourceType,
  StructureType,
  buildChunkBoundaryLineData,
  buildResourceMarkerPlacements,
  buildStructureMarkerPlacements,
  getResourceMarkerColor,
  getStructureMarkerColor,
  type ChunkData,
} from '../src';

describe('chunk overlay rendering data', () => {
  it('builds top and left boundary line positions', () => {
    const boundary = buildChunkBoundaryLineData(2, 3, createChunkData(), { heightScale: 50 });

    expect(boundary.positions).toHaveLength(12);
    expect(boundary.positions[0]).toBe(4);
    expect(boundary.positions[1]).toBeCloseTo(5);
    expect(boundary.positions[2]).toBe(6);
    expect(boundary.positions[3]).toBe(6);
    expect(boundary.positions[4]).toBeCloseTo(0.3 * 50);
    expect(boundary.positions[9]).toBe(4);
    expect(boundary.positions[10]).toBeCloseTo(0.6 * 50);
    expect(boundary.positions[11]).toBe(8);
  });

  it('builds resource marker placements with colors and terrain height offsets', () => {
    const placements = buildResourceMarkerPlacements(2, 3, {
      ...createChunkData(),
      resources: [{ x: 1, y: 1, type: ResourceType.GOLD, amount: 2 }],
    }, { heightScale: 50 });

    expect(placements).toHaveLength(1);
    expect(placements[0]).toMatchObject({
      x: 5,
      z: 7,
      color: 0xffd700,
    });
    expect(placements[0].y).toBeCloseTo(0.7 * 50 + 1);
    expect(getResourceMarkerColor('wood')).toBe(0x8b4513);
    expect(getResourceMarkerColor('unknown')).toBe(0xff00ff);
  });

  it('builds structure marker placements with geometry descriptors', () => {
    const placements = buildStructureMarkerPlacements(0, 0, {
      ...createChunkData(),
      structures: [{ x: 1, y: 1, type: StructureType.TOWER }],
    }, { heightScale: 50 });

    expect(placements).toHaveLength(1);
    expect(placements[0]).toMatchObject({
      x: 1,
      z: 1,
      color: 0xdaa520,
      geometryKind: 'box',
      width: 1.5,
      height: 5,
      depth: 1.5,
    });
    expect(placements[0].y).toBeCloseTo(0.7 * 50 + 2.5);
    expect(getStructureMarkerColor(999)).toBe(0xff00ff);
  });
});

function createChunkData(): ChunkData {
  return {
    size: 2,
    heightmap: new Float32Array([
      0.1, 0.2, 0.3,
      0.4, 0.7, 0.5,
      0.6, 0.8, 0.9,
    ]),
    biomeMap: new Uint8Array(4),
    biomeWeights: new Float32Array(4 * 13),
    resources: [],
    structures: [],
  } as ChunkData;
}
