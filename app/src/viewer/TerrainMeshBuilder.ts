import * as THREE from 'three';
import type { ChunkData } from '../../../src/index';
import { MicroBiomeType } from '../../../src/world/enhanced-biome';
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
const MICRO_BIOME_TINT: Record<number, { r: number; g: number; b: number }> = {
  [MicroBiomeType.OASIS]: { r: 0.0, g: 0.25, b: 0.0 },
  [MicroBiomeType.CLEARING]: { r: 0.0, g: 0.20, b: 0.0 },
  [MicroBiomeType.POND]: { r: 0.0, g: 0.0, b: 0.30 },
  [MicroBiomeType.GROVE]: { r: 0.20, g: 0.20, b: 0.0 },
};

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
  const chunkSize = data.size;
  const chunkMicroBiomeCount = countMicroBiomes(data);
  const expectedHeightmapSize = (chunkSize + 1) * (chunkSize + 1);

  if (data.heightmap.length !== expectedHeightmapSize) {
    console.error(
      `Heightmap size mismatch! Expected ${expectedHeightmapSize} (${chunkSize + 1}x${chunkSize + 1}), ` +
      `got ${data.heightmap.length}. Chunk: (${chunkX}, ${chunkY})`
    );

    const fallbackHeightmap = new Float32Array(expectedHeightmapSize);
    const copySize = Math.min(data.heightmap.length, expectedHeightmapSize);
    for (let i = 0; i < copySize; i++) {
      fallbackHeightmap[i] = data.heightmap[i];
    }
    data = { ...data, heightmap: fallbackHeightmap };
  }

  const geometry = new THREE.BufferGeometry();
  const verticesPerSide = chunkSize + 1;
  const vertexCount = verticesPerSide * verticesPerSide;
  const triangleCount = chunkSize * chunkSize * 2;
  const indexCount = triangleCount * 3;
  const vertices = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const surfaceBlendA = new Float32Array(vertexCount * 4);
  const surfaceBlendB = new Float32Array(vertexCount * 4);
  const surfaceBlendC = new Float32Array(vertexCount * 4);
  const terrainDetailBlend = new Float32Array(vertexCount * 4);
  const indices = new Uint32Array(indexCount);
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
  const worldXBase = chunkX * chunkSize;
  const worldZBase = chunkY * chunkSize;

  for (let y = 0; y <= chunkSize; y++) {
    const worldZ = worldZBase + y;
    const rowOffset = y * verticesPerSide;

    for (let x = 0; x <= chunkSize; x++) {
      const index = rowOffset + x;
      const vertexIndex = index * 3;
      const uvIndex = index * 2;
      const blendIndex = index * 4;
      const height = data.heightmap ? data.heightmap[index] : 0;
      const worldX = worldXBase + x;

      vertices[vertexIndex] = worldX;
      vertices[vertexIndex + 1] = height * HEIGHT_SCALE;
      vertices[vertexIndex + 2] = worldZ;
      uvs[uvIndex] = worldX / chunkSize;
      uvs[uvIndex + 1] = worldZ / chunkSize;

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

  let indexOffset = 0;
  for (let y = 0; y < chunkSize; y++) {
    const rowStart = y * verticesPerSide;
    const nextRowStart = (y + 1) * verticesPerSide;

    for (let x = 0; x < chunkSize; x++) {
      const topLeft = rowStart + x;
      const topRight = topLeft + 1;
      const bottomLeft = nextRowStart + x;
      const bottomRight = bottomLeft + 1;
      indices[indexOffset++] = topLeft;
      indices[indexOffset++] = bottomLeft;
      indices[indexOffset++] = topRight;
      indices[indexOffset++] = topRight;
      indices[indexOffset++] = bottomLeft;
      indices[indexOffset++] = bottomRight;
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
  mesh.userData.microBiomeCount = chunkMicroBiomeCount;
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

  if (data.microBiomeMap && bmIndex < data.microBiomeMap.length) {
    const microBiome = data.microBiomeMap[bmIndex];
    const tint = microBiome !== 255 ? MICRO_BIOME_TINT[microBiome] : undefined;
    if (tint) {
      color = {
        r: Math.min(1.0, color.r + tint.r),
        g: Math.min(1.0, color.g + tint.g),
        b: Math.min(1.0, color.b + tint.b),
      };
    }
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

function countMicroBiomes(data: ChunkData): number {
  let count = 0;
  if (!data.microBiomeMap) return count;

  for (let i = 0; i < data.microBiomeMap.length; i++) {
    if (data.microBiomeMap[i] !== 255) count++;
  }
  return count;
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
