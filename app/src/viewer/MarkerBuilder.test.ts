import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceType, StructureType, TERRAIN_HEIGHT_SCALE_METERS, TERRAIN_TILE_SIZE_METERS, type ChunkData } from '@engine/index';
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
    const mesh = group.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);
    const color = new THREE.Color();
    mesh.getColorAt(0, color);

    expect(position.x).toBe(5 * TERRAIN_TILE_SIZE_METERS);
    expect(position.z).toBe(7 * TERRAIN_TILE_SIZE_METERS);
    expect(position.y).toBeCloseTo(0.7 * TERRAIN_HEIGHT_SCALE_METERS + 1);
    expect(color.getHex()).toBe(0xffd700);
  });

  it('creates structure-specific geometry and height offsets', () => {
    const group = createStructureMarkers(0, 0, {
      ...createChunkData(),
      structures: [{ x: 1, y: 1, type: StructureType.TOWER }],
    });
    const mesh = group.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);
    const color = new THREE.Color();
    mesh.getColorAt(0, color);

    expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(position.y).toBeCloseTo(0.7 * TERRAIN_HEIGHT_SCALE_METERS + 2.5);
    expect(color.getHex()).toBe(0xdaa520);
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
