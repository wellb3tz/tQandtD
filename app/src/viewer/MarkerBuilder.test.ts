import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceType, StructureType, type ChunkData } from '../../../src/index';
import {
  createResourceMarkers,
  createStructureMarkers,
  getResourceColor,
  getStructureColor,
} from './MarkerBuilder';

describe('MarkerBuilder', () => {
  it('maps numeric and named resource colors', () => {
    expect(getResourceColor(ResourceType.IRON)).toBe(0xc0c0c0);
    expect(getResourceColor(ResourceType.GOLD)).toBe(0xffd700);
    expect(getResourceColor('wood')).toBe(0x8b4513);
    expect(getResourceColor('unknown')).toBe(0xff00ff);
  });

  it('maps structure colors with magenta fallback', () => {
    expect(getStructureColor(StructureType.VILLAGE)).toBe(0x8b4513);
    expect(getStructureColor(String(StructureType.TOWER))).toBe(0xdaa520);
    expect(getStructureColor(999)).toBe(0xff00ff);
  });

  it('places resource markers using seamless heightmap indexing', () => {
    const group = createResourceMarkers(2, 3, {
      ...createChunkData(),
      resources: [{ x: 1, y: 1, type: ResourceType.GOLD, amount: 2 }],
    });
    const marker = group.children[0] as THREE.Mesh;
    const material = marker.material as THREE.MeshBasicMaterial;

    expect(marker.position.x).toBe(5);
    expect(marker.position.z).toBe(7);
    expect(marker.position.y).toBeCloseTo(0.7 * 50 + 1);
    expect(material.color.getHex()).toBe(0xffd700);
  });

  it('creates structure-specific geometry and height offsets', () => {
    const group = createStructureMarkers(0, 0, {
      ...createChunkData(),
      structures: [{ x: 1, y: 1, type: StructureType.TOWER }],
    });
    const marker = group.children[0] as THREE.Mesh;

    expect(marker.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(marker.position.y).toBeCloseTo(0.7 * 50 + 2.5);
    expect((marker.material as THREE.MeshLambertMaterial).color.getHex()).toBe(0xdaa520);
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
    resources: [],
    structures: [],
  } as unknown as ChunkData;
}
