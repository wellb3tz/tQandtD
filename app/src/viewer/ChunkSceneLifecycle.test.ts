import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BiomeType, ResourceType, StructureType, type ChunkData } from '@engine/index';
import type { TerrainSurfaceTextureLibrary } from './materials';
import { addChunkToScene, removeChunkFromScene } from './ChunkSceneLifecycle';
import type { ChunkMesh } from './ChunkMesh';
import { FogOfWarManager } from './FogOfWarManager';
import type { RenderLayer } from './RenderLayerVisibility';
import { DEFAULT_WATER_CONFIG } from './water/config';
import { WaterLayerManager } from './water/WaterLayerManager';

describe('ChunkSceneLifecycle', () => {
  it('adds and removes terrain chunk scene objects', async () => {
    const scene = new THREE.Scene();
    const chunkMeshes = new Map<string, ChunkMesh>();
    const options = createOptions(scene, chunkMeshes, createChunkData());

    expect(await addChunkToScene(options)).toBe(true);
    const chunkMesh = chunkMeshes.get('0,0');

    expect(chunkMesh).toBeDefined();
    expect(chunkMesh.terrain).toBeInstanceOf(THREE.Mesh);
    expect(chunkMesh.resources).toBeInstanceOf(THREE.Group);
    expect(chunkMesh.structures).toBeInstanceOf(THREE.Group);
    expect(chunkMesh.boundaries).toBeInstanceOf(THREE.LineSegments);
    expect(scene.children).toContain(chunkMesh.terrain);

    expect(removeChunkFromScene({ ...options, keepFogOfWar: false })).toBe(true);
    expect(chunkMeshes.has('0,0')).toBe(false);
    expect(scene.children).not.toContain(chunkMesh.terrain);
  });

  it('skips complete overlay layers for early partial chunks', async () => {
    const scene = new THREE.Scene();
    const chunkMeshes = new Map<string, ChunkMesh>();

    await addChunkToScene({
      ...createOptions(scene, chunkMeshes, createChunkData()),
      partial: true,
      stage: 1,
    });

    const chunkMesh = chunkMeshes.get('0,0');
    expect(chunkMesh.resources).toBeUndefined();
    expect(chunkMesh.structures).toBeUndefined();
    expect(chunkMesh.boundaries).toBeInstanceOf(THREE.LineSegments);
  });
});

function createOptions(scene: THREE.Scene, chunkMeshes: Map<string, ChunkMesh>, data: ChunkData) {
  return {
    chunkX: 0,
    chunkY: 0,
    data,
    scene,
    chunkMeshes,
    layerVisibility: new Map<RenderLayer, boolean>(),
    waterLayerManager: new WaterLayerManager(),
    waterConfig: { ...DEFAULT_WATER_CONFIG, enabled: false },
    fogOfWarManager: new FogOfWarManager(),
    terrainTextures: {} as TerrainSurfaceTextureLibrary,
    terrainTexturesEnabled: false,
    wireframeMode: false,
  };
}

function createChunkData(): ChunkData {
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
    resources: [{ x: 0, y: 0, type: ResourceType.WOOD, amount: 1 }],
    structures: [{ x: 1, y: 1, type: StructureType.VILLAGE }],
  } as unknown as ChunkData;
}
