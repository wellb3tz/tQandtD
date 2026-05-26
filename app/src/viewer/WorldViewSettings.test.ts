import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TerrainSurfaceTextureLibrary } from './materials';
import type { ChunkMesh } from './ChunkMesh';
import { RenderLayer } from './RenderLayerVisibility';
import { WorldViewSettings } from './WorldViewSettings';
import { DEFAULT_WATER_CONFIG } from './water/config';
import type { WaterLayerManager } from './water/WaterLayerManager';

describe('WorldViewSettings', () => {
  it('updates layer visibility and preserves biome color toggling', () => {
    const terrain = createTerrainMesh();
    const foliage = new THREE.Group();
    const resources = new THREE.Group();
    const chunkMeshes = new Map<string, ChunkMesh>([
      ['0,0', { terrain, foliage, resources, visible: true }],
    ]);
    const settings = createSettings(chunkMeshes);

    settings.setVisibility(RenderLayer.RESOURCES, false);
    expect(resources.visible).toBe(false);

    settings.setVisibility(RenderLayer.FOLIAGE, false);
    expect(foliage.visible).toBe(false);
    expect(terrain.visible).toBe(true);

    settings.setVisibility(RenderLayer.BIOMES, false);
    const colors = terrain.geometry.getAttribute('color') as THREE.BufferAttribute;
    expect(colors.getX(0)).toBeCloseTo(colors.getY(0));
    expect(terrain.userData.originalColors).toBeInstanceOf(Float32Array);
  });

  it('toggles wireframe and replaces terrain materials when texture mode changes', () => {
    const terrain = createTerrainMesh();
    const chunkMeshes = new Map<string, ChunkMesh>([
      ['0,0', { terrain, visible: true }],
    ]);
    const settings = createSettings(chunkMeshes);

    settings.setWireframeMode(true);
    expect((terrain.material as THREE.MeshStandardMaterial).wireframe).toBe(true);

    settings.setTerrainTexturesEnabled(false);
    expect(settings.areTerrainTexturesEnabled()).toBe(false);
    expect((terrain.material as THREE.MeshStandardMaterial).userData.terrainTexturesEnabled).toBe(false);
    expect((terrain.material as THREE.MeshStandardMaterial).wireframe).toBe(true);
  });

  it('stores water config and delegates water visibility', () => {
    const waterLayerManager = { toggleWaterVisibility: vi.fn() } as unknown as WaterLayerManager;
    const settings = createSettings(new Map(), waterLayerManager);

    settings.setWaterConfig({ enabled: false });
    settings.setWaterVisibility(false);

    expect(settings.getWaterConfig().enabled).toBe(false);
    expect(waterLayerManager.toggleWaterVisibility).toHaveBeenCalledWith(false);
  });
});

function createSettings(
  chunkMeshes: Map<string, ChunkMesh>,
  waterLayerManager: WaterLayerManager = { toggleWaterVisibility: vi.fn() } as unknown as WaterLayerManager,
): WorldViewSettings {
  return new WorldViewSettings({
    chunkMeshes,
    waterLayerManager,
    waterConfig: DEFAULT_WATER_CONFIG,
    terrainTextures: createTestTerrainTextures(),
  });
}

function createTerrainMesh(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 0, 0]), 3));
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true }));
}

function createTestTerrainTextures(): TerrainSurfaceTextureLibrary {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  texture.needsUpdate = true;
  return {
    albedoAtlas: texture,
    plains: {
      albedo: texture,
      normal: texture,
      roughness: texture,
    },
  } as TerrainSurfaceTextureLibrary;
}
