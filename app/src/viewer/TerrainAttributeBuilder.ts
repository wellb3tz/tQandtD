import * as THREE from 'three';
import {
  BiomeType,
  RIVER_TRENCH_DARKEN_STRENGTH,
  getRiverTrenchDarkening,
  type ChunkData,
} from '@engine/index';
import { selectTerrainSurfaceKey, type TerrainSurfaceKey } from './terrain-geometry-types';

export { RIVER_TRENCH_DARKEN_STRENGTH, getRiverTrenchDarkening } from '@engine/index';

export type TerrainSurfaceWeights = Record<TerrainSurfaceKey, number>;

export interface TerrainDetailModulationOptions {
  geometry: THREE.BufferGeometry;
  vertices: Float32Array;
  data: ChunkData;
  chunkSize: number;
  worldXBase: number;
  worldZBase: number;
  seaLevel: number;
  heightScale: number;
}

export function calculateVertexSurfaceWeights(data: ChunkData, vertexX: number, vertexY: number): TerrainSurfaceWeights {
  const chunkSize = data.size;
  const verticesPerSide = chunkSize + 1;
  const weights = createEmptySurfaceWeights();
  const lakeTiles = collectLakeTileIndices(data);

  const samples: Array<{ x: number; y: number }> = [
    { x: vertexX - 1, y: vertexY - 1 },
    { x: vertexX, y: vertexY - 1 },
    { x: vertexX - 1, y: vertexY },
    { x: vertexX, y: vertexY },
  ];

  let sampleCount = 0;
  for (const sample of samples) {
    if (sample.x < 0 || sample.y < 0 || sample.x >= chunkSize || sample.y >= chunkSize) {
      continue;
    }

    const tileIndex = sample.y * chunkSize + sample.x;
    const biome = data.biomeMap ? data.biomeMap[tileIndex] : BiomeType.PLAINS;
    const heightIndex = sample.y * verticesPerSide + sample.x;
    const elevation = data.heightmap ? data.heightmap[heightIndex] : 0;
    const right = data.heightmap ? data.heightmap[heightIndex + 1] : elevation;
    const down = data.heightmap ? data.heightmap[heightIndex + verticesPerSide] : elevation;
    const slope = Math.min(1, Math.abs(right - elevation) * 8 + Math.abs(down - elevation) * 8);
    const moisture = calculateTerrainMoisture(data, sample.x, sample.y, biome, elevation, slope, lakeTiles);
    const surfaceKey = getRiverTrenchDarkening(data, sample.x, sample.y) < 0.82
      ? 'riverbed'
      : selectTerrainSurfaceKey(biome, elevation, slope, moisture);
    weights[surfaceKey] += 1;
    sampleCount++;
  }

  if (sampleCount === 0) {
    weights.plains = 1;
    return weights;
  }

  for (const key of Object.keys(weights) as TerrainSurfaceKey[]) {
    weights[key] /= sampleCount;
  }
  return weights;
}

function calculateTerrainMoisture(
  data: ChunkData,
  vertexX: number,
  vertexY: number,
  biome: BiomeType,
  elevation: number,
  slope: number,
  lakeTiles: Set<number>,
): number {
  const riverInfluence = clamp01(
    (1 - getRiverTrenchDarkening(data, vertexX, vertexY)) / RIVER_TRENCH_DARKEN_STRENGTH
  );
  const lakeInfluence = calculateLakeWetness(data, vertexX, vertexY, lakeTiles);
  const lowlandInfluence = 1 - smoothstep(0.24, 0.62, elevation);
  const slopeRetention = 1 - Math.min(1, slope * 1.05);
  const biomeBias = getBiomeMoistureBias(biome);

  return clamp01(
    (riverInfluence * 0.42 +
      lakeInfluence * 0.30 +
      lowlandInfluence * 0.18 +
      biomeBias * 0.10) *
      (0.58 + slopeRetention * 0.42)
  );
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

function collectLakeTileIndices(data: ChunkData): Set<number> {
  const tiles = new Set<number>();

  for (const lake of data.lakes ?? []) {
    for (const tileIndex of lake.tiles) {
      tiles.add(tileIndex);
    }
  }

  return tiles;
}

function getBiomeMoistureBias(biome: BiomeType): number {
  switch (biome) {
    case BiomeType.SWAMP:
      return 1;
    case BiomeType.RAINFOREST:
      return 0.92;
    case BiomeType.FOREST:
      return 0.74;
    case BiomeType.TAIGA:
      return 0.66;
    case BiomeType.BEACH:
      return 0.62;
    case BiomeType.PLAINS:
      return 0.46;
    case BiomeType.SAVANNA:
      return 0.30;
    case BiomeType.TUNDRA:
      return 0.22;
    case BiomeType.MOUNTAIN:
      return 0.20;
    case BiomeType.GLACIER:
      return 0.16;
    case BiomeType.DESERT:
      return 0.06;
    case BiomeType.VOLCANIC:
      return 0.12;
    default:
      return 0.35;
  }
}

export function applyTerrainDetailAndColorModulation(options: TerrainDetailModulationOptions): Float32Array {
  const {
    geometry,
    vertices,
    data,
    chunkSize,
    worldXBase,
    worldZBase,
    seaLevel,
    heightScale,
  } = options;
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
  const terrainDetailBlend = new Float32Array(normals.count * 4);

  const rock = { r: 0.38, g: 0.36, b: 0.34 };
  const snow = { r: 0.92, g: 0.93, b: 0.95 };
  const lava = { r: 0.72, g: 0.12, b: 0.04 };
  const wetSand = { r: 0.55, g: 0.48, b: 0.32 };
  const coastalCliff = { r: 0.46, g: 0.42, b: 0.36 };
  const lakeTiles = collectLakeTileIndices(data);

  for (let i = 0; i < normals.count; i++) {
    const ny = normals.getY(i);
    const vi = i * 3;
    const rawHeight = vertices[vi + 1] / heightScale;

    const bvX = Math.min(Math.round(vertices[vi] - worldXBase), chunkSize - 1);
    const bvY = Math.min(Math.round(vertices[vi + 2] - worldZBase), chunkSize - 1);
    const bmIdx = Math.max(0, bvY) * chunkSize + Math.max(0, bvX);
    const vertexBiome = data.biomeMap ? data.biomeMap[Math.min(bmIdx, data.biomeMap.length - 1)] : -1;

    const slopeFactor = Math.max(0, 1.0 - ny * ny);
    const steepness = Math.pow(slopeFactor, 1.5);
    const cliffDetail = Math.max(0, Math.min(1, (steepness - 0.14) / 0.54));
    const altitudeBrightness = 0.92 + rawHeight * 0.12;

    let r = colorAttr.getX(i);
    let g = colorAttr.getY(i);
    let b = colorAttr.getZ(i);

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
      (1 - getRiverTrenchDarkening(data, bvX, bvY)) / RIVER_TRENCH_DARKEN_STRENGTH
    );
    const wetBand = clamp01(Math.max(shorelineWetness, lakeWetness * 0.92, riverWetness * 0.75));
    const snowDetail = (isMountain || isGlacier)
      ? Math.min(1, Math.max(0, (rawHeight - 0.73) / 0.14) * (1.0 - steepness * 0.35))
      : 0;
    const riverbedDetail = riverWetness;

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

      if ((isMountain || isGlacier) && rawHeight > 0.76) {
        const snowFactor = Math.min(1.0, (rawHeight - 0.76) / 0.10) * (1.0 - steepness * 0.7);
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

    colorAttr.setXYZ(
      i,
      Math.min(1.0, r * altitudeBrightness),
      Math.min(1.0, g * altitudeBrightness),
      Math.min(1.0, b * altitudeBrightness)
    );
    terrainDetailBlend[i * 4] = cliffDetail;
    terrainDetailBlend[i * 4 + 1] = snowDetail;
    terrainDetailBlend[i * 4 + 2] = wetBand;
    terrainDetailBlend[i * 4 + 3] = riverbedDetail;
  }
  colorAttr.needsUpdate = true;
  return terrainDetailBlend;
}

function createEmptySurfaceWeights(): TerrainSurfaceWeights {
  return {
    plains: 0,
    desert: 0,
    beach: 0,
    mountainRock: 0,
    snow: 0,
    forestFloor: 0,
    dryGrass: 0,
    swampMud: 0,
    volcanicRock: 0,
    ice: 0,
    riverbed: 0,
  };
}

function blend(from: number, to: number, factor: number): number {
  return from + (to - from) * factor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
