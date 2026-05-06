import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BiomeType, type ChunkData } from '@engine/index';
import type { TerrainSurfaceTextureLibrary } from './materials';
import { createTerrainMesh } from './TerrainMeshBuilder';
import { DEFAULT_WATER_CONFIG } from './water/config';

describe('TerrainMeshBuilder', () => {
  it('creates indexed terrain geometry with surface and detail attributes', () => {
    const data = createChunkData({
      microBiomeMap: new Uint8Array([255, 1, 255, 2]),
    });

    const mesh = createTerrainMesh({
      chunkX: 2,
      chunkY: 3,
      data,
      waterConfig: DEFAULT_WATER_CONFIG,
      terrainTextures: createEmptyTerrainTextures(),
      terrainTexturesEnabled: false,
      wireframeMode: false,
    });
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    const surfaceBlendA = geometry.getAttribute('surfaceBlendA') as THREE.BufferAttribute;
    const surfaceBlendB = geometry.getAttribute('surfaceBlendB') as THREE.BufferAttribute;
    const surfaceBlendC = geometry.getAttribute('surfaceBlendC') as THREE.BufferAttribute;
    const terrainDetailBlend = geometry.getAttribute('terrainDetailBlend') as THREE.BufferAttribute;

    expect(position.count).toBe(9);
    expect(uv.count).toBe(position.count);
    expect(surfaceBlendA.itemSize).toBe(4);
    expect(surfaceBlendB.itemSize).toBe(4);
    expect(surfaceBlendC.itemSize).toBe(4);
    expect(terrainDetailBlend.itemSize).toBe(4);
    expect(geometry.getIndex()?.count).toBe(24);
    expect(mesh.name).toBe('terrain-2,3');
    expect(mesh.userData.chunkData).toBe(data);
    expect(mesh.userData.microBiomeCount).toBe(2);
  });

  it('marks early partial chunks as transparent preview meshes', () => {
    const mesh = createTerrainMesh({
      chunkX: 0,
      chunkY: 0,
      data: createChunkData(),
      partial: true,
      stage: 0,
      waterConfig: DEFAULT_WATER_CONFIG,
      terrainTextures: createEmptyTerrainTextures(),
      terrainTexturesEnabled: false,
      wireframeMode: true,
    });
    const material = mesh.material as THREE.MeshLambertMaterial;

    expect(mesh.userData.partial).toBe(true);
    expect(mesh.userData.stage).toBe(0);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.5);
    expect(material.wireframe).toBe(true);
  });
});

function createChunkData(overrides: Partial<ChunkData> = {}): ChunkData {
  return {
    size: 2,
    heightmap: new Float32Array([
      0.2, 0.3, 0.4,
      0.3, 0.5, 0.6,
      0.4, 0.6, 0.8,
    ]),
    biomeMap: new Uint8Array([
      BiomeType.PLAINS,
      BiomeType.FOREST,
      BiomeType.DESERT,
      BiomeType.MOUNTAIN,
    ]),
    resources: [],
    structures: [],
    ...overrides,
  } as unknown as ChunkData;
}

function createEmptyTerrainTextures(): TerrainSurfaceTextureLibrary {
  return {} as TerrainSurfaceTextureLibrary;
}
