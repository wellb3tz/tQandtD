import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BiomeType, TERRAIN_TILE_SIZE_METERS, type ChunkData, type LakeData } from '@engine/index';
import type { LakeTile } from './types';
import {
  LAKE_SURFACE_SHADER_KEY,
  LAKE_SURFACE_UV_SCALE,
  buildLakeGeometry,
  createLakeMaterialForState,
  updateLakeMaterialSurface,
} from './LakeMeshGenerator';
import { LAKE_WATER_NORMAL_SCALE } from './WaterMaterialFactory';

function createChunk(size = 4): ChunkData {
  const vertexSize = size + 1;
  const heightmap = new Float32Array(vertexSize * vertexSize).fill(0.7);
  const biomeMap = new Uint8Array(size * size).fill(BiomeType.PLAINS);
  const biomeWeights = new Float32Array(size * size * 13);

  return {
    x: 0,
    y: 0,
    size,
    heightmap,
    biomeMap,
    biomeWeights,
    resources: [],
    structures: [],
  };
}

function lowerTileCorners(chunk: ChunkData, tx: number, ty: number, height = 0.35): void {
  const vertexSize = chunk.size + 1;
  chunk.heightmap[ty * vertexSize + tx] = height;
  chunk.heightmap[ty * vertexSize + tx + 1] = height;
  chunk.heightmap[(ty + 1) * vertexSize + tx] = height;
  chunk.heightmap[(ty + 1) * vertexSize + tx + 1] = height;
}

function createLake(tileIndices: number[]): LakeData {
  return {
    waterLevel: 0.5,
    tiles: new Set(tileIndices),
    maxDepth: 0.15,
    minTerrainHeight: 0.35,
  };
}

function buildGeometry(lake: LakeData, chunk: ChunkData) {
  const lakeTiles: LakeTile[] = [{ index: 0, terrainHeight: 0.35, waterElevation: 0.5, underwaterDepth: 0.15 }];
  const geometry = buildLakeGeometry(lakeTiles, [lake], chunk);
  expect(geometry).not.toBeNull();
  return geometry!;
}

function buildBounds(lake: LakeData, chunk: ChunkData): { minX: number; maxX: number } {
  const geometry = buildGeometry(lake, chunk);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  return { minX: box.min.x, maxX: box.max.x };
}

describe('LakeMeshGenerator contour mesh', () => {
  it('clips the shoreline to the terrain water-level contour', () => {
    const chunk = createChunk();
    lowerTileCorners(chunk, 1, 1);

    const lake = createLake([1 * chunk.size + 1]);
    const bounds = buildBounds(lake, chunk);

    expect(bounds.minX).toBeLessThan(1 * TERRAIN_TILE_SIZE_METERS);
    expect(bounds.maxX).toBeGreaterThan(2 * TERRAIN_TILE_SIZE_METERS);
    expect(bounds.minX).toBeGreaterThan(0);
    expect(bounds.maxX).toBeLessThan(3 * TERRAIN_TILE_SIZE_METERS);
  });

  it('generates shoreline polygons instead of only square tile quads', () => {
    const chunk = createChunk();
    lowerTileCorners(chunk, 1, 1);

    const lake = createLake([1 * chunk.size + 1]);
    const geometry = buildGeometry(lake, chunk);
    const position = geometry.getAttribute('position');

    expect(position.count).toBeGreaterThan(4);
  });

  it('darkens deeper lake vertices while keeping the gradient in vertex colors', () => {
    const chunk = createChunk(1);
    lowerTileCorners(chunk, 0, 0);

    const lake = createLake([0]);
    const geometry = buildGeometry(lake, chunk);
    const colors = geometry.getAttribute('color');

    expect(colors.getX(0)).toBeLessThanOrEqual(0.08);
    expect(colors.getY(0)).toBeLessThanOrEqual(0.30);
    expect(colors.getZ(0)).toBeLessThanOrEqual(0.38);
  });

  it('colors frozen lake surfaces as pale ice', () => {
    const chunk = createChunk(1);
    lowerTileCorners(chunk, 0, 0);

    const lake = { ...createLake([0]), state: 'frozen' as const };
    const geometry = buildGeometry(lake, chunk);
    const colors = geometry.getAttribute('color');

    expect(colors.getX(0)).toBeGreaterThan(0.68);
    expect(colors.getY(0)).toBeGreaterThan(0.84);
    expect(colors.getZ(0)).toBeGreaterThan(0.96);
  });

  it('creates a distinct material for frozen lakes', () => {
    const material = createLakeMaterialForState({ enabled: true, color: 0x4fc3d4, opacity: 0.8, shininess: 60 }, 'frozen');

    expect(material.userData.lakeState).toBe('frozen');
    expect(material.opacity).toBeGreaterThanOrEqual(0.88);
    expect(material.shininess).toBeGreaterThanOrEqual(82);
  });

  it('applies calm lake normal maps and shader surface glints', () => {
    const normalMap = new THREE.Texture();
    const material = createLakeMaterialForState({
      enabled: true,
      color: 0x4fc3d4,
      opacity: 0.8,
      shininess: 60,
      normalMap,
    });
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main() {\n#include <uv_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\nvec4 diffuseColor = vec4(1.0);\n#include <color_fragment>\n}',
    } as unknown as THREE.Shader;

    material.onBeforeCompile(shader);
    updateLakeMaterialSurface(material, 8);

    expect(material.normalMap).toBe(normalMap);
    expect(material.normalScale.x).toBeCloseTo(LAKE_WATER_NORMAL_SCALE.x);
    expect(material.normalScale.y).toBeCloseTo(LAKE_WATER_NORMAL_SCALE.y);
    expect(material.customProgramCacheKey()).toBe(`${LAKE_SURFACE_SHADER_KEY}:filled`);
    expect(shader.uniforms.uLakeSurfaceTime.value).toBe(8);
    expect(shader.vertexShader).toContain('varying vec2 vLakeSurfaceUv');
    expect(shader.fragmentShader).toContain('lakeGlint');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58, 0.88, 0.88)');
  });

  it('uses world-space lake UVs so normal maps continue across chunks', () => {
    const chunk = createChunk(1);
    chunk.x = 3;
    chunk.y = -2;
    lowerTileCorners(chunk, 0, 0);

    const lake = createLake([0]);
    const geometry = buildGeometry(lake, chunk);
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');

    expect(uv.count).toBe(position.count);
    for (let i = 0; i < position.count; i++) {
      expect(uv.getX(i)).toBeCloseTo(position.getX(i) * LAKE_SURFACE_UV_SCALE);
      expect(uv.getY(i)).toBeCloseTo(position.getZ(i) * LAKE_SURFACE_UV_SCALE);
    }
  });
});
