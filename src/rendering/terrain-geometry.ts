import type { ChunkData } from '../world/chunk';

export interface TerrainGridGeometryOptions {
  heightScale: number;
  horizontalScale?: number;
}

export interface TerrainGridGeometryData {
  chunkData: ChunkData;
  chunkSize: number;
  verticesPerSide: number;
  vertexCount: number;
  worldXBase: number;
  worldZBase: number;
  expectedHeightmapSize: number;
  originalHeightmapSize: number;
  heightmapSizeMismatch: boolean;
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export function buildTerrainGridGeometryData(
  chunkData: ChunkData,
  chunkX: number,
  chunkY: number,
  options: TerrainGridGeometryOptions,
): TerrainGridGeometryData {
  const chunkSize = chunkData.size;
  const verticesPerSide = chunkSize + 1;
  const vertexCount = verticesPerSide * verticesPerSide;
  const expectedHeightmapSize = vertexCount;
  const originalHeightmapSize = chunkData.heightmap.length;
  const heightmapSizeMismatch = originalHeightmapSize !== expectedHeightmapSize;
  const normalizedHeightmap = heightmapSizeMismatch
    ? normalizeHeightmap(chunkData.heightmap, expectedHeightmapSize)
    : chunkData.heightmap;
  const normalizedChunkData = heightmapSizeMismatch
    ? { ...chunkData, heightmap: normalizedHeightmap }
    : chunkData;
  const triangleCount = chunkSize * chunkSize * 2;
  const indexCount = triangleCount * 3;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(indexCount);
  const worldXBase = chunkX * chunkSize;
  const worldZBase = chunkY * chunkSize;
  const horizontalScale = options.horizontalScale ?? 1;
  const scaledWorldXBase = worldXBase * horizontalScale;
  const scaledWorldZBase = worldZBase * horizontalScale;

  for (let y = 0; y <= chunkSize; y++) {
    const worldZ = scaledWorldZBase + y * horizontalScale;
    const rowOffset = y * verticesPerSide;

    for (let x = 0; x <= chunkSize; x++) {
      const index = rowOffset + x;
      const vertexIndex = index * 3;
      const uvIndex = index * 2;
      const height = normalizedHeightmap[index] ?? 0;
      const worldX = scaledWorldXBase + x * horizontalScale;

      positions[vertexIndex] = worldX;
      positions[vertexIndex + 1] = height * options.heightScale;
      positions[vertexIndex + 2] = worldZ;
      uvs[uvIndex] = (worldXBase + x) / chunkSize;
      uvs[uvIndex + 1] = (worldZBase + y) / chunkSize;
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

  return {
    chunkData: normalizedChunkData,
    chunkSize,
    verticesPerSide,
    vertexCount,
    worldXBase: scaledWorldXBase,
    worldZBase: scaledWorldZBase,
    expectedHeightmapSize,
    originalHeightmapSize,
    heightmapSizeMismatch,
    positions,
    uvs,
    indices,
  };
}

function normalizeHeightmap(heightmap: Float32Array, expectedSize: number): Float32Array {
  const fallbackHeightmap = new Float32Array(expectedSize);
  const copySize = Math.min(heightmap.length, expectedSize);
  for (let i = 0; i < copySize; i++) {
    fallbackHeightmap[i] = heightmap[i];
  }

  return fallbackHeightmap;
}
