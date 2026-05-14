import * as THREE from 'three';
import type { ChunkData } from '@engine/index';
import type { TerrainSurfaceTextureLibrary } from './materials';
import type { WaterConfig } from './water/types';
import { createTerrainMaterial } from './TerrainAppearance';
import { getGeometryWorkerManager } from './GeometryWorkerManager';

const HEIGHT_SCALE = 50;

export interface TerrainMeshBuilderOptions {
  chunkX: number;
  chunkY: number;
  data: ChunkData;
  partial?: boolean;
  stage?: number;
  waterConfig: WaterConfig;
  terrainTextures: TerrainSurfaceTextureLibrary;
  terrainTexturesEnabled: boolean;
  wireframeMode: boolean;
}

export async function createTerrainMesh(options: TerrainMeshBuilderOptions): Promise<THREE.Mesh> {
  const {
    chunkX,
    chunkY,
    partial = false,
    stage,
    waterConfig,
    terrainTextures,
    terrainTexturesEnabled,
    wireframeMode,
  } = options;

  const manager = getGeometryWorkerManager();
  const buffers = await manager.buildGeometry(options.data, {
    chunkX,
    chunkY,
    heightScale: HEIGHT_SCALE,
    seaLevel: waterConfig.seaLevel,
    underwaterDarkenFactor: waterConfig.rendering.underwaterDarkenFactor,
    underwaterDesaturationFactor: waterConfig.rendering.underwaterDesaturationFactor,
    enableDepthGradient: waterConfig.rendering.enableDepthGradient,
    partial,
    stage,
  });

  if (buffers.heightmapSizeMismatch) {
    console.error(
      `Heightmap size mismatch! Expected ${buffers.expectedHeightmapSize} (${buffers.verticesPerSide}x${buffers.verticesPerSide}), ` +
      `got ${buffers.originalHeightmapSize}. Chunk: (${chunkX}, ${chunkY})`,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute('surfaceBlendA', new THREE.BufferAttribute(buffers.surfaceBlendA, 4));
  geometry.setAttribute('surfaceBlendB', new THREE.BufferAttribute(buffers.surfaceBlendB, 4));
  geometry.setAttribute('surfaceBlendC', new THREE.BufferAttribute(buffers.surfaceBlendC, 4));
  geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
  geometry.setAttribute('terrainDetailBlend', new THREE.BufferAttribute(buffers.terrainDetailBlend, 4));

  const { partialOpacity } = getPartialGenerationStyle(partial, stage);

  const material = createTerrainMaterial({ terrainTextures, terrainTexturesEnabled, wireframeMode });
  if (partial && partialOpacity < 1.0) {
    material.transparent = true;
    material.opacity = partialOpacity;
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `terrain-${chunkX},${chunkY}`;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  if (partial) {
    mesh.userData.partial = true;
    mesh.userData.stage = stage;
  }
  mesh.userData.chunkData = buffers.chunkData;
  return mesh;
}

function getPartialGenerationStyle(partial: boolean, stage: number | undefined): {
  partialTint: { r: number; g: number; b: number };
  partialOpacity: number;
} {
  let partialTint = { r: 1.0, g: 1.0, b: 1.0 };
  let partialOpacity = 1.0;

  if (partial && stage !== undefined) {
    if (stage === 0) {
      partialTint = { r: 0.6, g: 0.6, b: 0.6 };
      partialOpacity = 0.5;
    } else if (stage === 1) {
      partialTint = { r: 0.8, g: 0.8, b: 0.8 };
      partialOpacity = 0.7;
    } else if (stage < 4) {
      partialOpacity = 0.9;
    }
  }

  return { partialTint, partialOpacity };
}
