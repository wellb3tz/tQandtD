import {
  BiomeType,
  calculateRiverBankInfluence,
  getRiverbedDarkening,
  getRiverTrenchDarkening,
  calculateFrozenRiverInfluence,
  RIVER_TRENCH_DARKEN_STRENGTH,
  type ChunkData,
} from '@engine/index';
import {
  buildTerrainGridGeometryData,
  type TerrainGridGeometryData,
} from '@engine/index';
import { getBiomeColor, type BiomeColor } from './materials';
import { adjustUnderwaterColors } from './water/UnderwaterTerrainProcessor';
import { calculateVertexSurfaceWeights } from './TerrainAttributeBuilder';
import { clamp01 } from './terrain-geometry-types';

export interface TerrainGeometryBuffers {
  positions: Float32Array;
  colors: Float32Array;
  uvs: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  surfaceBlendA: Float32Array;
  surfaceBlendB: Float32Array;
  surfaceBlendC: Float32Array;
  terrainDetailBlend: Float32Array;
  chunkData: ChunkData;
  chunkSize: number;
  verticesPerSide: number;
  vertexCount: number;
  worldXBase: number;
  worldZBase: number;
  expectedHeightmapSize: number;
  originalHeightmapSize: number;
  heightmapSizeMismatch: boolean;
}

export interface TerrainGeometryOptions {
  chunkX: number;
  chunkY: number;
  heightScale: number;
  horizontalScale?: number;
  seaLevel: number;
  underwaterDarkenFactor: number;
  underwaterDesaturationFactor: number;
  enableDepthGradient: boolean;
  /** Dynamic snow-line elevation from the chunk's climate [0-1]. Defaults to 0.76. */
  climateSnowLine?: number;
  partial?: boolean;
  stage?: number;
}

export function buildTerrainGeometryBuffers(
  data: ChunkData,
  options: TerrainGeometryOptions,
): TerrainGeometryBuffers {
  const {
    chunkX,
    chunkY,
    heightScale,
    horizontalScale = 1,
    seaLevel,
    underwaterDarkenFactor,
    underwaterDesaturationFactor,
    enableDepthGradient,
    partial = false,
    stage,
  } = options;

  const terrainGrid = buildTerrainGridGeometryData(data, chunkX, chunkY, {
    heightScale,
    horizontalScale,
  });

  const normalizedData = terrainGrid.chunkData;
  const {
    chunkSize,
    verticesPerSide,
    vertexCount,
    positions,
    uvs,
    indices,
    worldXBase,
    worldZBase,
  } = terrainGrid;

  const colors = new Float32Array(vertexCount * 3);
  const surfaceBlendA = new Float32Array(vertexCount * 4);
  const surfaceBlendB = new Float32Array(vertexCount * 4);
  const surfaceBlendC = new Float32Array(vertexCount * 4);
  const terrainDetailBlend = new Float32Array(vertexCount * 4);
  const hasBlendWeights = normalizedData.sparseBiomeWeights && normalizedData.sparseBiomeWeights.length > 0;

  const underwaterColors = normalizedData.heightmap && hasBlendWeights
    ? adjustUnderwaterColors(normalizedData.heightmap, normalizedData, chunkSize, {
      seaLevel,
      darkenFactor: underwaterDarkenFactor,
      desaturationFactor: underwaterDesaturationFactor,
      enableDepthGradient,
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
      let color = calculateTerrainVertexColor(normalizedData, bmIndex, x, y, underwaterColors, hasBlendWeights);

      colors[vertexIndex] = color.r * partialTint.r;
      colors[vertexIndex + 1] = color.g * partialTint.g;
      colors[vertexIndex + 2] = color.b * partialTint.b;

      const surfaceWeights = calculateVertexSurfaceWeights(normalizedData, x, y);
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

  const normals = computeVertexNormals(positions, indices);

  terrainDetailBlend.set(applyTerrainDetailAndColorModulationRaw({
    normals,
    colors,
    positions,
    data: normalizedData,
    chunkSize,
    worldXBase,
    worldZBase,
    seaLevel,
    heightScale,
    horizontalScale,
    climateSnowLine: options.climateSnowLine,
  }));

  return {
    positions,
    colors,
    uvs,
    normals,
    indices,
    surfaceBlendA,
    surfaceBlendB,
    surfaceBlendC,
    terrainDetailBlend,
    chunkData: normalizedData,
    chunkSize,
    verticesPerSide,
    vertexCount,
    worldXBase,
    worldZBase,
    expectedHeightmapSize: terrainGrid.expectedHeightmapSize,
    originalHeightmapSize: terrainGrid.originalHeightmapSize,
    heightmapSizeMismatch: terrainGrid.heightmapSizeMismatch,
  };
}

function computeVertexNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const count = positions.length / 3;
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const x0 = positions[i0 * 3];
    const y0 = positions[i0 * 3 + 1];
    const z0 = positions[i0 * 3 + 2];
    const x1 = positions[i1 * 3];
    const y1 = positions[i1 * 3 + 1];
    const z1 = positions[i1 * 3 + 2];
    const x2 = positions[i2 * 3];
    const y2 = positions[i2 * 3 + 1];
    const z2 = positions[i2 * 3 + 2];

    const dx1 = x1 - x0;
    const dy1 = y1 - y0;
    const dz1 = z1 - z0;
    const dx2 = x2 - x0;
    const dy2 = y2 - y0;
    const dz2 = z2 - z0;

    const nx = dy1 * dz2 - dz1 * dy2;
    const ny = dz1 * dx2 - dx1 * dz2;
    const nz = dx1 * dy2 - dy1 * dx2;

    normals[i0 * 3] += nx;
    normals[i0 * 3 + 1] += ny;
    normals[i0 * 3 + 2] += nz;
    normals[i1 * 3] += nx;
    normals[i1 * 3 + 1] += ny;
    normals[i1 * 3 + 2] += nz;
    normals[i2 * 3] += nx;
    normals[i2 * 3 + 1] += ny;
    normals[i2 * 3 + 2] += nz;
  }

  for (let i = 0; i < count; i++) {
    let nx = normals[i * 3];
    let ny = normals[i * 3 + 1];
    let nz = normals[i * 3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;
    }
  }

  return normals;
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

interface DetailModulationOptions {
  normals: Float32Array;
  colors: Float32Array;
  positions: Float32Array;
  data: ChunkData;
  chunkSize: number;
  worldXBase: number;
  worldZBase: number;
  seaLevel: number;
  heightScale: number;
  horizontalScale: number;
  climateSnowLine?: number;
}

function applyTerrainDetailAndColorModulationRaw(options: DetailModulationOptions): Float32Array {
  const {
    normals,
    colors,
    positions,
    data,
    chunkSize,
    worldXBase,
    worldZBase,
    seaLevel,
    heightScale,
    horizontalScale,
    climateSnowLine: rawSnowLine,
  } = options;
  const snowLine = rawSnowLine ?? 0.76;
  const count = normals.length / 3;
  const terrainDetailBlend = new Float32Array(count * 4);

  const rock = { r: 0.38, g: 0.36, b: 0.34 };
  const snow = { r: 0.92, g: 0.93, b: 0.95 };
  const lava = { r: 0.72, g: 0.12, b: 0.04 };
  const wetSand = { r: 0.55, g: 0.48, b: 0.32 };
  const coastalCliff = { r: 0.46, g: 0.42, b: 0.36 };
  const lakeTiles = collectLakeTileIndices(data);

  for (let i = 0; i < count; i++) {
    const ny = normals[i * 3 + 1];
    const vi = i * 3;
    const rawHeight = positions[vi + 1] / heightScale;

    const bvX = Math.min(Math.round((positions[vi] - worldXBase) / horizontalScale), chunkSize - 1);
    const bvY = Math.min(Math.round((positions[vi + 2] - worldZBase) / horizontalScale), chunkSize - 1);
    const bmIdx = Math.max(0, bvY) * chunkSize + Math.max(0, bvX);
    const vertexBiome = data.biomeMap ? data.biomeMap[Math.min(bmIdx, data.biomeMap.length - 1)] : -1;

    const slopeFactor = Math.max(0, 1.0 - ny * ny);
    const steepness = Math.pow(slopeFactor, 1.5);
    const cliffDetail = Math.max(0, Math.min(1, (steepness - 0.14) / 0.54));
    const altitudeBrightness = 0.92 + rawHeight * 0.12;

    let r = colors[i * 3];
    let g = colors[i * 3 + 1];
    let b = colors[i * 3 + 2];

    const isVolcanic = vertexBiome === BiomeType.VOLCANIC;
    const isMountain = vertexBiome === BiomeType.MOUNTAIN;
    const isGlacier = vertexBiome === BiomeType.GLACIER;
    const isBeach = vertexBiome === BiomeType.BEACH;
    const isOcean = vertexBiome === BiomeType.OCEAN;
    const belowWaterBand = 0.05;
    const aboveWaterBand = 0.20;
    const shorelineWetness = rawHeight >= seaLevel - belowWaterBand && rawHeight <= seaLevel + aboveWaterBand
      ? rawHeight <= seaLevel
        ? 1.0 - Math.min(1, (seaLevel - rawHeight) / belowWaterBand)
        : 1.0 - Math.min(1, (rawHeight - seaLevel) / aboveWaterBand)
      : 0;
    const lakeWetness = calculateLakeWetness(data, bvX, bvY, lakeTiles);
    const riverWetness = clamp01(
      (1 - getRiverTrenchDarkening(data, bvX, bvY)) / RIVER_TRENCH_DARKEN_STRENGTH,
    );
    const riverBankWetness = calculateRiverBankInfluence(data, bvX, bvY);
    const riverbedInfluence = clamp01(
      (1 - getRiverbedDarkening(data, bvX, bvY)) / RIVER_TRENCH_DARKEN_STRENGTH,
    );
    const frozenBand = clamp01(calculateFrozenRiverInfluence(data, bvX, bvY));
    const wetBand = clamp01(Math.max(shorelineWetness, lakeWetness * 0.92, riverWetness * 0.75, riverBankWetness * 0.86));

    // Local temperature suppresses snow on hot mountain peaks.
    // At or below 0 (neutral/cold) snow is full; above 0.5 (hot desert climate) snow vanishes.
    const tileTemperature = data.temperatureMap && bmIdx < data.temperatureMap.length
      ? data.temperatureMap[bmIdx]
      : 0;
    const temperatureFactor = Math.max(0, Math.min(1, 1 - tileTemperature / 0.5));

    const snowDetail = (isMountain || isGlacier)
      ? Math.min(1, Math.max(0, (rawHeight - snowLine) / 0.14) * (1.0 - steepness * 0.35)) * temperatureFactor
      : 0;
    const riverbedDetail = riverbedInfluence;

    if (isOcean) {
      // Ocean floor keeps the biome color and only receives altitude brightness.
    } else if (isBeach) {
      if (steepness > 0.5) {
        const cliffFactor = (steepness - 0.5) / 0.5;
        r = blend(r, coastalCliff.r, cliffFactor);
        g = blend(g, coastalCliff.g, cliffFactor);
        b = blend(b, coastalCliff.b, cliffFactor);
      } else if (steepness > 0.15) {
        const wetFactor = (steepness - 0.15) / 0.35;
        r = blend(r, wetSand.r, wetFactor);
        g = blend(g, wetSand.g, wetFactor);
        b = blend(b, wetSand.b, wetFactor);
      }
    } else if (isVolcanic) {
      r = blend(r, rock.r, steepness * 0.6);
      g = blend(g, rock.g, steepness * 0.6);
      b = blend(b, rock.b, steepness * 0.6);

      const lavaFactor = Math.pow(steepness, 2.5) * 0.5;
      if (lavaFactor > 0) {
        r = blend(r, lava.r, lavaFactor);
        g = blend(g, lava.g, lavaFactor);
        b = blend(b, lava.b, lavaFactor);
      }
    } else {
      r = blend(r, rock.r, steepness);
      g = blend(g, rock.g, steepness);
      b = blend(b, rock.b, steepness);

      if ((isMountain || isGlacier) && rawHeight > snowLine) {
        const snowFactor = Math.min(1.0, (rawHeight - snowLine) / 0.10) * (1.0 - steepness * 0.7) * temperatureFactor;
        if (snowFactor > 0) {
          r = blend(r, snow.r, snowFactor);
          g = blend(g, snow.g, snowFactor);
          b = blend(b, snow.b, snowFactor);
        }
      }
    }

    if (wetBand > 0) {
      const wetShade = 1.0 - wetBand * 0.14;
      const wetSaturation = 1.0 + wetBand * 0.06;
      r = Math.min(1.0, r * wetShade * (1.0 - wetBand * 0.03));
      g = Math.min(1.0, g * wetShade * wetSaturation);
      b = Math.min(1.0, b * wetShade * (1.0 + wetBand * 0.01));
    }

    if (riverBankWetness > 0) {
      const silt = isBeach || vertexBiome === BiomeType.DESERT || vertexBiome === BiomeType.SAVANNA
        ? { r: 0.68, g: 0.57, b: 0.34 }
        : { r: 0.30, g: 0.39, b: 0.25 };
      const bankTint = riverBankWetness * 0.34;
      r = blend(r, silt.r, bankTint);
      g = blend(g, silt.g, bankTint);
      b = blend(b, silt.b, bankTint);
    }

    if (frozenBand > 0) {
      // Icy blue tint for frozen river beds
      const iceR = 0.72;
      const iceG = 0.82;
      const iceB = 0.92;
      r = blend(r, iceR, frozenBand * 0.45);
      g = blend(g, iceG, frozenBand * 0.35);
      b = blend(b, iceB, frozenBand * 0.25);
    }

    colors[i * 3] = Math.min(1.0, r * altitudeBrightness);
    colors[i * 3 + 1] = Math.min(1.0, g * altitudeBrightness);
    colors[i * 3 + 2] = Math.min(1.0, b * altitudeBrightness);
    terrainDetailBlend[i * 4] = cliffDetail;
    terrainDetailBlend[i * 4 + 1] = snowDetail;
    terrainDetailBlend[i * 4 + 2] = wetBand;
    terrainDetailBlend[i * 4 + 3] = riverbedDetail;
  }

  return terrainDetailBlend;
}

function collectLakeTileIndices(data: ChunkData): Set<number> {
  const tiles = new Set<number>();
  for (const lake of data.lakes ?? []) {
    // Skip dry lakes
    if (lake.state === 'dry') continue;
    for (const tileIndex of lake.tiles) {
      tiles.add(tileIndex);
    }
  }
  return tiles;
}

function calculateLakeWetness(
  data: ChunkData,
  vertexX: number,
  vertexY: number,
  lakeTiles: Set<number>,
): number {
  if (lakeTiles.size === 0) {
    return 0;
  }

  const minTileX = Math.max(0, Math.floor(vertexX) - 2);
  const maxTileX = Math.min(data.size - 1, Math.floor(vertexX) + 1);
  const minTileY = Math.max(0, Math.floor(vertexY) - 2);
  const maxTileY = Math.min(data.size - 1, Math.floor(vertexY) + 1);

  let strongest = 0;

  for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
      const tileIndex = tileY * data.size + tileX;
      if (!lakeTiles.has(tileIndex)) continue;

      const centerX = tileX + 0.5;
      const centerY = tileY + 0.5;
      const distance = Math.hypot(vertexX - centerX, vertexY - centerY);

      const wetness = distance <= 0.75
        ? 1
        : distance <= 1.45
          ? 0.68
          : distance <= 2.2
            ? 0.34
            : 0;

      strongest = Math.max(strongest, wetness);
      if (strongest >= 1) {
        return 1;
      }
    }
  }

  return strongest;
}

function blend(from: number, to: number, factor: number): number {
  return from + (to - from) * factor;
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
