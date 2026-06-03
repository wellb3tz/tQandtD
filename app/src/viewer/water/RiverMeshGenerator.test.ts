import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BiomeType, TERRAIN_TILE_SIZE_METERS, type ChunkData, type LakeData, type RiverData } from '@engine/index';
import { HEIGHT_SCALE } from './config';
import {
  RIVER_SURFACE_SHADER_KEY,
  buildRiverGeometry,
  createRiverMaterial,
  updateRiverMaterialFlow,
} from './RiverMeshGenerator';
import { RIVER_WATER_NORMAL_SCALE } from './WaterMaterialFactory';

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

function chunk(
  size = 4,
  heightAt: (x: number, y: number) => number = () => 0.5,
  lakes?: ChunkData['lakes'],
): ChunkData {
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
    lakes,
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

  it('uses the freshwater lake surface color for flowing river overlays', () => {
    const geometry = buildRiverGeometry([twoPointRiver], chunk())!;
    const colors = geometry.getAttribute('color').array;
    const expected = [0.31, 0.76, 0.83];

    for (let channel = 0; channel < expected.length; channel++) {
      expect(colors[channel]).toBeCloseTo(expected[channel], 5);
    }
  });

  it('preserves narrow sources and gradual downstream widening', () => {
    const wideningRiver = river([
      { x: 0, y: 1, height: 0.5, surfaceLevel: 0.51, width: 0.2, depth: 0.03, channelWidth: 0.2, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 4, y: 1, height: 0.45, surfaceLevel: 0.46, width: 1.6, depth: 0.03, channelWidth: 1.6, channelDepth: 0.04, flowX: 1, flowY: 0 },
    ]);
    const geometry = buildRiverGeometry([wideningRiver], chunk())!;
    const positions = geometry.getAttribute('position');
    const widthAt = (x: number): number => {
      const values = Array.from({ length: positions.count }, (_, index) => index)
        .filter(index => Math.abs(positions.getX(index) / TERRAIN_TILE_SIZE_METERS - x) < 0.001)
        .map(index => positions.getZ(index) / TERRAIN_TILE_SIZE_METERS);
      return Math.max(...values) - Math.min(...values);
    };

    expect(widthAt(0)).toBeCloseTo(0.2, 3);
    expect(widthAt(4)).toBeCloseTo(1.6, 3);
    expect(widthAt(0)).toBeLessThan(widthAt(4));
  });

  it('uses an icy vertex color for frozen river overlays', () => {
    const geometry = buildRiverGeometry([river(twoPointRiver.points, 'frozen')], chunk())!;
    const color = geometry.getAttribute('color') as THREE.BufferAttribute;

    expect(color.getZ(0)).toBeGreaterThan(0.9);
  });

  it('keeps tributary width through the confluence instead of tapering it', () => {
    const tributary = {
      ...river([
        { x: 0, y: 1, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
        { x: 4, y: 1, height: 0.45, surfaceLevel: 0.46, width: 1, depth: 0.03, channelWidth: 1.4, channelDepth: 0.04, flowX: 1, flowY: 0 },
      ]),
      isTributary: true,
      pathId: 'river_1:tributary',
    };
    const geometry = buildRiverGeometry([tributary], chunk())!;
    const positions = geometry.getAttribute('position');
    const maxX = Array.from({ length: positions.count }, (_, index) => positions.getX(index))
      .reduce((max, value) => Math.max(max, value), -Infinity);

    expect(maxX).toBeCloseTo(4 * TERRAIN_TILE_SIZE_METERS, 4);
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
    expect(material.normalScale.x).toBeCloseTo(RIVER_WATER_NORMAL_SCALE.x);
    expect(material.normalScale.y).toBeCloseTo(RIVER_WATER_NORMAL_SCALE.y);
    expect(material.vertexColors).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.depthFunc).toBe(THREE.LessDepth);
  });

  it('injects close-up river surface shading with soft edges and flow streaks', () => {
    const material = createRiverMaterial({
      enabled: true,
      color: 0x0d4f66,
      opacity: 0.66,
      shininess: 95,
      normalMap: new THREE.Texture(),
    });
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main() {\n#include <uv_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\nvec4 diffuseColor = vec4(1.0);\n#include <color_fragment>\n#include <roughnessmap_fragment>\n}',
    } as unknown as THREE.Shader;

    material.onBeforeCompile(shader);
    updateRiverMaterialFlow(material, 12);

    expect(material.customProgramCacheKey()).toBe(`${RIVER_SURFACE_SHADER_KEY}:flowing`);
    expect(shader.uniforms.uRiverFlowTime.value).toBe(12);
    expect(shader.vertexShader).toContain('varying vec2 vRiverSurfaceUv');
    expect(shader.fragmentShader).toContain('riverEdgeFade');
    expect(shader.fragmentShader).toContain('riverBrokenStreaks');
    expect(shader.fragmentShader).toContain('diffuseColor.a *= mix(0.36, 1.0, riverEdgeFade)');
    expect(shader.fragmentShader).toContain('roughnessFactor = mix(0.34, 0.10');
  });

  it('clips river mesh to lake shape', () => {
    const size = 8;
    const lakeTiles = new Set<number>();
    for (let y = 4; y < size; y++) {
      for (let x = 0; x < size; x++) {
        lakeTiles.add(y * size + x);
      }
    }
    const lakes: LakeData[] = [{
      waterLevel: 0.55,
      tiles: lakeTiles,
      maxDepth: 0.15,
      minTerrainHeight: 0.35,
    }];
    const data = chunk(size, () => 0.5, lakes);
    const verticalRiver = river([
      { x: 2, y: 0, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 0, flowY: 1 },
      { x: 2, y: 7, height: 0.5, surfaceLevel: 0.51, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 0, flowY: 1 },
    ]);
    const geometry = buildRiverGeometry([verticalRiver], data, 0.3);

    expect(geometry).not.toBeNull();
    const positions = geometry!.getAttribute('position');
    const localZValues: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      localZValues.push(positions.getZ(i) / TERRAIN_TILE_SIZE_METERS);
    }
    const maxLocalZ = Math.max(...localZValues);
    // The river should be clipped before it reaches the lake tiles (y >= 4)
    expect(maxLocalZ).toBeLessThan(4.2);
  });

  it('hides river completely inside a lake', () => {
    const size = 4;
    const lakeTiles = new Set<number>();
    for (let i = 0; i < size * size; i++) {
      lakeTiles.add(i);
    }
    const lakes: LakeData[] = [{
      waterLevel: 0.55,
      tiles: lakeTiles,
      maxDepth: 0.15,
      minTerrainHeight: 0.35,
    }];
    const data = chunk(size, () => 0.4, lakes);
    const fullLakeRiver = river([
      { x: 0, y: 2, height: 0.4, surfaceLevel: 0.41, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
      { x: 4, y: 2, height: 0.4, surfaceLevel: 0.41, width: 1, depth: 0.03, channelWidth: 1, channelDepth: 0.04, flowX: 1, flowY: 0 },
    ]);
    const geometry = buildRiverGeometry([fullLakeRiver], data, 0.3);

    expect(geometry).toBeNull();
  });
});
