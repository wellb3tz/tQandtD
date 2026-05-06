import * as THREE from 'three';
import { BiomeType, type ChunkData } from '../../../src/index';
import { getRiverChannelWidth, type RiverPoint } from '../../../src/gen/rivers';
import { selectTerrainSurfaceKey, type TerrainSurfaceKey } from './materials';

export const RIVER_TRENCH_DARKEN_STRENGTH = 0.35;

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

export function getRiverTrenchDarkening(data: ChunkData, x: number, y: number): number {
  const rivers = data.rivers ?? [];
  if (rivers.length === 0) return 1;

  let strongest = 0;
  for (const river of rivers) {
    const points = river.points;
    if (points.length < 2) continue;

    for (let i = 0; i < points.length - 1; i++) {
      const sample = closestRiverRenderSample(x, y, points[i], points[i + 1]);
      const channelRadius = Math.max(getRiverChannelWidth(sample) * 0.5, 0);
      if (channelRadius <= 0 || sample.distance > channelRadius) continue;

      const centerWeight = 1 - sample.distance / channelRadius;
      strongest = Math.max(strongest, centerWeight * centerWeight);
    }
  }

  return 1 - strongest * RIVER_TRENCH_DARKEN_STRENGTH;
}

export function calculateVertexSurfaceWeights(data: ChunkData, vertexX: number, vertexY: number): TerrainSurfaceWeights {
  const chunkSize = data.size;
  const verticesPerSide = chunkSize + 1;
  const weights = createEmptySurfaceWeights();

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
    const surfaceKey = getRiverTrenchDarkening(data, sample.x, sample.y) < 0.82
      ? 'riverbed'
      : selectTerrainSurfaceKey(biome, elevation, slope);
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
    const wetBand = rawHeight >= seaLevel - belowWaterBand && rawHeight <= seaLevel + aboveWaterBand
      ? rawHeight <= seaLevel
        ? 1.0 - Math.min(1, (seaLevel - rawHeight) / belowWaterBand)
        : 1.0 - Math.min(1, (rawHeight - seaLevel) / aboveWaterBand)
      : 0;
    const snowDetail = (isMountain || isGlacier)
      ? Math.min(1, Math.max(0, (rawHeight - 0.73) / 0.14) * (1.0 - steepness * 0.35))
      : 0;
    const riverbedDetail = Math.min(
      1,
      Math.max(0, (1 - getRiverTrenchDarkening(data, bvX, bvY)) / RIVER_TRENCH_DARKEN_STRENGTH)
    );

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

function closestRiverRenderSample(
  x: number,
  y: number,
  a: RiverPoint,
  b: RiverPoint
): RiverPoint & { distance: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / lenSq));
  const px = a.x + vx * t;
  const py = a.y + vy * t;
  const optional = (start: number | undefined, end: number | undefined): number | undefined => {
    if (!Number.isFinite(start) && !Number.isFinite(end)) return undefined;
    const from = Number.isFinite(start) ? (start as number) : (end as number);
    const to = Number.isFinite(end) ? (end as number) : from;
    return from + (to - from) * t;
  };

  return {
    ...a,
    x: px,
    y: py,
    height: a.height + (b.height - a.height) * t,
    surfaceLevel: a.surfaceLevel + (b.surfaceLevel - a.surfaceLevel) * t,
    width: a.width + (b.width - a.width) * t,
    depth: a.depth + (b.depth - a.depth) * t,
    flow: optional(a.flow, b.flow),
    channelWidth: optional(a.channelWidth, b.channelWidth),
    valleyWidth: optional(a.valleyWidth, b.valleyWidth),
    channelDepth: optional(a.channelDepth, b.channelDepth),
    valleyDepth: optional(a.valleyDepth, b.valleyDepth),
    flowX: a.flowX + (b.flowX - a.flowX) * t,
    flowY: a.flowY + (b.flowY - a.flowY) * t,
    distance: Math.hypot(x - px, y - py),
  };
}

function blend(from: number, to: number, factor: number): number {
  return from + (to - from) * factor;
}
