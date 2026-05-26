import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BiomeType, TERRAIN_TILE_SIZE_METERS, type ChunkData, type RiverData } from '@engine/index';
import { HEIGHT_SCALE } from './config';
import { buildRiverGeometry, createRiverMaterial } from './RiverMeshGenerator';
import { WATER_NORMAL_SCALE } from './WaterMaterialFactory';

function river(points: RiverData['points'], state?: RiverData['state']): RiverData {
  return {
    riverId: 'river_1',
    pathId: 'river_1:main',
    isTributary: false,
    state,
    points,
    bounds: { minX: 0, maxX: 4, minY: 1, maxY: 1 },
  };
}

function chunk(size = 4, heightAt: (x: number, y: number) => number = () => 0.5): ChunkData {
  const vertexSize = size + 1;
  const heightmap = new Float32Array(vertexSize * vertexSize);

  for (let y = 0; y <= size; y++) {
    for (let x = 0; x <= size; x++) {
      heightmap[y * vertexSize + x] = heightAt(x, y);
    }
  }

  return {
    x: 0,
    y: 0,
    size,
    heightmap,
    biomeMap: new Uint8Array(size * size).fill(BiomeType.PLAINS),
    sparseBiomeTypes: new Uint8Array(0),
    sparseBiomeWeights: new Float32Array(0),
    sparseBiomeOffsets: new Uint16Array(size * size + 1),
    resources: [],
    structures: [],
  };
}

const twoPointRiver = river([
  { x: 0, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
  { x: 4, y: 1, height: 0.35, surfaceLevel: 0.36, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
]);

describe('RiverMeshGenerator', () => {
  it('builds a smooth terrain-draped river ribbon', () => {
    const geometry = buildRiverGeometry([twoPointRiver], chunk());

    expect(geometry).not.toBeNull();
    expect(geometry!.getAttribute('position').count).toBe(2048);
    expect(geometry!.getIndex()?.count).toBe(3072);
  });

  it('returns null for empty river data', () => {
    expect(buildRiverGeometry([], chunk())).toBeNull();
  });

  it('samples terrain height under each smooth ribbon vertex', () => {
    const data = chunk(4, (x, y) => 0.4 + x * 0.01 + y * 0.02);
    const geometry = buildRiverGeometry([twoPointRiver], data)!;
    const positions = geometry.getAttribute('position');

    const centerVertexIndex = Array.from({ length: positions.count }, (_, index) => index)
      .find(index => positions.getX(index) === 0 && positions.getZ(index) === TERRAIN_TILE_SIZE_METERS);

    expect(centerVertexIndex).toBeDefined();
    expect(positions.getY(centerVertexIndex!)).toBeCloseTo(0.42 * HEIGHT_SCALE + 0.5, 4);
  });

  it('uses sub-tile lateral vertices so the outline is not pixel stepped', () => {
    const geometry = buildRiverGeometry([twoPointRiver], chunk())!;
    const positions = geometry.getAttribute('position');
    const localZValues = Array.from({ length: positions.count }, (_, index) => positions.getZ(index) / TERRAIN_TILE_SIZE_METERS);

    expect(localZValues.some(z => Math.abs(z - Math.round(z)) > 0.001)).toBe(true);
  });

  it('does not render river overlay cells below ocean level', () => {
    const lowChunk = chunk(4, () => 0.2);

    expect(buildRiverGeometry([twoPointRiver], lowChunk, 0.3)).toBeNull();
  });

  it('clips overscanned river spans to the current chunk', () => {
    const geometry = buildRiverGeometry([river([
      { x: -4, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: -1, y: 1, height: 0.45, surfaceLevel: 0.46, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
    ])], chunk());

    expect(geometry).toBeNull();
  });

  it('keeps only the in-chunk section of a river span crossing the boundary', () => {
    const geometry = buildRiverGeometry([river([
      { x: -1, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 2, y: 1, height: 0.45, surfaceLevel: 0.46, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
    ])], chunk())!;
    const positions = geometry.getAttribute('position');

    for (let i = 0; i < positions.count; i++) {
      expect(positions.getX(i)).toBeGreaterThanOrEqual(0);
    }
  });

  it('adds boundary vertices where a river span enters the chunk', () => {
    const geometry = buildRiverGeometry([river([
      { x: -1, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 2, y: 1, height: 0.45, surfaceLevel: 0.46, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
    ])], chunk())!;
    const positions = geometry.getAttribute('position');

    const hasBoundaryCenterVertex = Array.from({ length: positions.count }, (_, index) => index)
      .some(index => (
        Math.abs(positions.getX(index)) < 1e-5 &&
        Math.abs(positions.getZ(index) - TERRAIN_TILE_SIZE_METERS) < 1e-5
      ));

    expect(hasBoundaryCenterVertex).toBe(true);
  });

  it('uses the dark ocean vertex color for flowing river overlays', () => {
    const geometry = buildRiverGeometry([twoPointRiver], chunk())!;
    const colors = geometry.getAttribute('color').array;
    const expected = [0.04, 0.1, 0.23];

    for (let channel = 0; channel < expected.length; channel++) {
      expect(colors[channel]).toBeCloseTo(expected[channel], 5);
    }
  });

  it('uses an icy vertex color for frozen river overlays', () => {
    const geometry = buildRiverGeometry([river(twoPointRiver.points, 'frozen')], chunk())!;
    const color = geometry.getAttribute('color') as THREE.BufferAttribute;

    expect(color.getZ(0)).toBeGreaterThan(0.9);
  });

  it('applies river normal maps for small flow ripples', () => {
    const normalMap = new THREE.Texture();
    const material = createRiverMaterial({
      enabled: true,
      color: 0x0d4f66,
      opacity: 0.66,
      shininess: 95,
      normalMap,
    });

    expect(material.normalMap).toBe(normalMap);
    expect(material.normalScale.x).toBeCloseTo(WATER_NORMAL_SCALE.x);
    expect(material.normalScale.y).toBeCloseTo(WATER_NORMAL_SCALE.y);
    expect(material.vertexColors).toBe(true);
  });
});
