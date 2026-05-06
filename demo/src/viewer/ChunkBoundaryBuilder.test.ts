import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type ChunkData } from '../../../src/index';
import { createChunkBoundaries } from './ChunkBoundaryBuilder';

describe('ChunkBoundaryBuilder', () => {
  it('draws only the top and left chunk edges in world coordinates', () => {
    const boundaries = createChunkBoundaries(2, 3, createChunkData());
    const position = boundaries.geometry.getAttribute('position') as THREE.BufferAttribute;

    expect(boundaries).toBeInstanceOf(THREE.LineSegments);
    expect(position.count).toBe(4);
    expect(position.getX(0)).toBe(4);
    expect(position.getY(0)).toBeCloseTo(0.1 * 50);
    expect(position.getZ(0)).toBe(6);
    expect(position.getX(1)).toBe(6);
    expect(position.getY(1)).toBeCloseTo(0.3 * 50);
    expect(position.getZ(1)).toBe(6);
    expect(position.getX(3)).toBe(4);
    expect(position.getY(3)).toBeCloseTo(0.6 * 50);
    expect(position.getZ(3)).toBe(8);
  });

  it('uses seamless heightmap indexing for the bottom-left corner', () => {
    const boundaries = createChunkBoundaries(0, 0, createChunkData());
    const position = boundaries.geometry.getAttribute('position') as THREE.BufferAttribute;

    expect(position.getY(3)).toBeCloseTo(0.6 * 50);
    expect(position.getY(3)).not.toBeCloseTo(0.5 * 50);
  });
});

function createChunkData(): ChunkData {
  return {
    size: 2,
    heightmap: new Float32Array([
      0.1, 0.2, 0.3,
      0.4, 0.5, 0.55,
      0.6, 0.7, 0.8,
    ]),
    biomeMap: new Uint8Array(4),
    resources: [],
    structures: [],
  } as unknown as ChunkData;
}
