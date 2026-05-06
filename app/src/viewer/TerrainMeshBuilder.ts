import * as THREE from 'three';
import {
  buildTerrainGridGeometryData,
  type ChunkData,
} from '@engine/index';
import {
  getBiomeColor,
  type BiomeColor,
  type TerrainSurfaceTextureLibrary,
} from './materials';
import { adjustUnderwaterColors } from './water/UnderwaterTerrainProcessor';
import type { WaterConfig } from './water/types';
import {
  applyTerrainDetailAndColorModulation,
  calculateVertexSurfaceWeights,
  getRiverTrenchDarkening,
} from './TerrainAttributeBuilder';
import { createTerrainMaterial } from './TerrainAppearance';

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

export function createTerrainMesh(options: TerrainMeshBuilderOptions): THREE.Mesh {
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
  let { data } = options;
  const terrainGrid = buildTerrainGridGeometryData(data, chunkX, chunkY, {
    heightScale: HEIGHT_SCALE,
  });

  if (terrainGrid.heightmapSizeMismatch) {
    console.error(
      `Heightmap size mismatch! Expected ${terrainGrid.expectedHeightmapSize} (${terrainGrid.verticesPerSide}x${terrainGrid.verticesPerSide}), ` +
      `got ${terrainGrid.originalHeightmapSize}. Chunk: (${chunkX}, ${chunkY})`
    );
  }

  data = terrainGrid.chunkData;
  const geometry = new THREE.BufferGeometry();
  const { chunkSize, verticesPerSide, vertexCount, positions: vertices, uvs, indices, worldXBase, worldZBase } = terrainGrid;
  const colors = new Float32Array(vertexCount * 3);
  const surfaceBlendA = new Float32Array(vertexCount * 4);
  const surfaceBlendB = new Float32Array(vertexCount * 4);
  const surfaceBlendC = new Float32Array(vertexCount * 4);
  const terrainDetailBlend = new Float32Array(vertexCount * 4);
  const hasBlendWeights = data.sparseBiomeWeights && data.sparseBiomeWeights.length > 0;
  const underwaterColors = data.heightmap && hasBlendWeights
    ? adjustUnderwaterColors(data.heightmap, data, chunkSize, {
      seaLevel: waterConfig.seaLevel,
      darkenFactor: waterConfig.rendering.underwaterDarkenFactor,
      desaturationFactor: waterConfig.rendering.underwaterDesaturationFactor,
      enableDepthGradient: waterConfig.rendering.enableDepthGradient,
    })
    : null;
  const { partialTint, partialOpacity } = getPartialGenerationStyle(partial, stage);

  for (let y = 0; y <= chunkSize; y++) {
    const rowOffset = y * verticesPerSide;

    for (let x = 0; x <= chunkSize; x++) {
      const index = rowOffset + x;
      const vertexIndex = index * 3;
      const blendIndex = index * 4;

      const bmX = Math.min(x, chunkSize - 1);
      const bmY = Math.min(y, chunkSize - 1);
      const bmIndex = bmY * chunkSize + bmX;
      let color = calculateTerrainVertexColor(data, bmIndex, x, y, underwaterColors, hasBlendWeights);

      colors[vertexIndex] = color.r * partialTint.r;
      colors[vertexIndex + 1] = color.g * partialTint.g;
      colors[vertexIndex + 2] = color.b * partialTint.b;

      const surfaceWeights = calculateVertexSurfaceWeights(data, x, y);
      surfaceBlendA[blendIndex] = surfaceWeights.plains;
      surfaceBlendA[blendIndex + 1] = surfaceWeights.desert;
      surfaceBlendA[blendIndex + 2] = surfaceWeights.beach;
      surfaceBlendA[blendIndex + 3] = surfaceWeights.mountainRock;
      surfaceBlendB[blendIndex] = surfaceWeights.snow;
      surfaceBlendB[blendIndex + 1] = surfaceWeights.forestFloor;
      surfaceBlendB[blendIndex + 2] = surfaceWeights.dryGrass;
      surfaceBlendB[blendIndex + 3] = surfaceWeights.swampMud;
      surfaceBlendC[blendIndex] = surfaceWeights.volcanicRock;
      surfaceBlendC[blendIndex + 1] = surfaceWeights.ice;
      surfaceBlendC[blendIndex + 2] = surfaceWeights.riverbed;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('surfaceBlendA', new THREE.BufferAttribute(surfaceBlendA, 4));
  geometry.setAttribute('surfaceBlendB', new THREE.BufferAttribute(surfaceBlendB, 4));
  geometry.setAttribute('surfaceBlendC', new THREE.BufferAttribute(surfaceBlendC, 4));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  terrainDetailBlend.set(applyTerrainDetailAndColorModulation({
    geometry,
    vertices,
    data,
    chunkSize,
    worldXBase,
    worldZBase,
    seaLevel: waterConfig.seaLevel,
    heightScale: HEIGHT_SCALE,
  }));
  geometry.setAttribute('terrainDetailBlend', new THREE.BufferAttribute(terrainDetailBlend, 4));

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
  mesh.userData.chunkData = data;
  return mesh;
}

function calculateTerrainVertexColor(
  data: ChunkData,
  bmIndex: number,
  vertexX: number,
  vertexY: number,
  underwaterColors: (BiomeColor | null)[] | null,
  hasBlendWeights: boolean | 0 | undefined,
): BiomeColor {
  let color: BiomeColor;

  if (underwaterColors && bmIndex < underwaterColors.length && underwaterColors[bmIndex] !== null) {
    color = underwaterColors[bmIndex]!;
  } else if (hasBlendWeights && data.biomeMap) {
    color = calculateBlendedColorFromSparse(data, bmIndex);
  } else if (data.biomeMap) {
    color = getBiomeColor(data.biomeMap[bmIndex]);
  } else {
    color = { r: 0.5, g: 0.5, b: 0.5 };
  }

  const riverTrenchDarken = getRiverTrenchDarkening(data, vertexX, vertexY);
  return {
    r: color.r * riverTrenchDarken,
    g: color.g * riverTrenchDarken,
    b: color.b * riverTrenchDarken,
  };
}

function calculateBlendedColorFromSparse(data: ChunkData, tileIndex: number): BiomeColor {
  const start = data.sparseBiomeOffsets[tileIndex];
  const end = data.sparseBiomeOffsets[tileIndex + 1];

  if (start === end && data.biomeMap) {
    return getBiomeColor(data.biomeMap[tileIndex]);
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let totalWeight = 0;

  for (let i = start; i < end; i++) {
    const biomeType = data.sparseBiomeTypes[i];
    const weight = data.sparseBiomeWeights[i];
    const color = getBiomeColor(biomeType);
    r += color.r * weight;
    g += color.g * weight;
    b += color.b * weight;
    totalWeight += weight;
  }

  if (totalWeight > 0) {
    return { r: r / totalWeight, g: g / totalWeight, b: b / totalWeight };
  }

  return data.biomeMap ? getBiomeColor(data.biomeMap[tileIndex]) : { r: 0.5, g: 0.5, b: 0.5 };
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
