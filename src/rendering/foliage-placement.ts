import { BiomeType, type ChunkData, getBiomeWeightForTile } from '../world/chunk';
import { getRiverChannelWidth, type RiverPoint } from '../gen/rivers';

const MAX_FOLIAGE_INSTANCES_PER_CHUNK = 512;
const MAX_SHRUB_INSTANCES_PER_CHUNK = 192;
const MAX_TERRAIN_PROP_INSTANCES_PER_CHUNK = 96;
const FOLIAGE_BANK_WIDTH = 2.4;
export const SHRUB_PROTOTYPE_MIN_Y = -0.30;
const CLEARING_CELL_SIZE = 25;

export type FoliageProfile = {
  density: number;
  height: number;
  radius: number;
  color: number;
  maxSlope: number;
};

export type FoliagePlacement = {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  rotation: number;
  color: number;
  rank: number;
};

export type TreeVariant = 'spire' | 'compact' | 'broad';

export type TreePlacement = FoliagePlacement & {
  variant: TreeVariant;
};

export type TerrainPropPlacement = FoliagePlacement & {
  kind: 'stumps';
};

type FoliageWaterInfluence = {
  inWater: boolean;
  bank: number;
};

type FoliageClearingInfluence = {
  strength: number;
  centerX: number;
  centerZ: number;
  coreRadius: number;
};

export type FoliagePlacementPlan = {
  treePlacements: TreePlacement[];
  shrubPlacements: FoliagePlacement[];
  terrainPropPlacements: TerrainPropPlacement[];
  clearingCount: number;
  clearingSample?: { x: number; z: number; radius: number };
};

export function planFoliagePlacements(
  chunkX: number,
  chunkY: number,
  data: ChunkData,
  seaLevel: number
): FoliagePlacementPlan | undefined {
  if (!data.biomeMap || !data.heightmap) return undefined;

  const chunkSize = data.size;
  const verticesPerSide = chunkSize + 1;
  const worldXBase = chunkX * chunkSize;
  const worldZBase = chunkY * chunkSize;
  const heightScale = 50;
  const treePlacements: TreePlacement[] = [];
  const shrubPlacements: FoliagePlacement[] = [];
  const terrainPropPlacements: TerrainPropPlacement[] = [];
  let clearingCount = 0;
  let clearingSample: { x: number; z: number; radius: number } | undefined;

  for (let tileY = 0; tileY < chunkSize; tileY++) {
    for (let tileX = 0; tileX < chunkSize; tileX++) {
      const tileIndex = tileY * chunkSize + tileX;
      const profile = getFoliageProfileForTile(data, tileIndex);
      if (!profile) continue;

      const heightIndex = tileY * verticesPerSide + tileX;
      const elevation = data.heightmap[heightIndex];
      if (elevation <= seaLevel + 0.035) continue;

      const right = data.heightmap[heightIndex + 1] ?? elevation;
      const down = data.heightmap[heightIndex + verticesPerSide] ?? elevation;
      const slope = Math.abs(right - elevation) + Math.abs(down - elevation);
      if (slope > profile.maxSlope) continue;

      const worldTileX = worldXBase + tileX;
      const worldTileZ = worldZBase + tileY;
      const jitterX = 0.08 + deterministic01(worldTileX, worldTileZ, 23) * 0.84;
      const jitterZ = 0.08 + deterministic01(worldTileX, worldTileZ, 31) * 0.84;
      const scaleJitter = 0.82 + deterministic01(worldTileX, worldTileZ, 43) * 0.46;
      const placementX = worldTileX + jitterX;
      const placementZ = worldTileZ + jitterZ;
      const waterInfluence = getFoliageWaterInfluence(data, tileIndex, placementX, placementZ, worldXBase, worldZBase);
      if (waterInfluence.inWater) continue;

      const clearingInfluence = getClearingInfluence(placementX, placementZ);
      if (clearingInfluence.strength > 0.82) {
        clearingCount++;
        clearingSample ??= {
          x: clearingInfluence.centerX,
          z: clearingInfluence.centerZ,
          radius: clearingInfluence.coreRadius,
        };
      }

      const chance = deterministic01(worldTileX, worldTileZ, 17);
      const clusterDensity = getForestClusterDensity(worldTileX, worldTileZ);
      const slopeStress = Math.min(1, slope / Math.max(profile.maxSlope, 0.001));
      const propChance = deterministic01(worldTileX, worldTileZ, 181);
      const propDensity = Math.min(0.18, 0.035 + clearingInfluence.strength * 0.055 + waterInfluence.bank * 0.024 + slopeStress * 0.045);
      if (propChance <= propDensity) {
        const propScale = 0.72 + deterministic01(worldTileX, worldTileZ, 193) * 0.56;
        const stumpHeight = 0.30;
        const stumpRadius = 0.25;
        terrainPropPlacements.push({
          x: placementX,
          y: elevation * heightScale + stumpHeight * propScale * 0.5,
          z: placementZ,
          radius: stumpRadius * propScale,
          height: stumpHeight * propScale,
          rotation: deterministic01(worldTileX, worldTileZ, 197) * Math.PI * 2,
          color: 0x6a4325,
          rank: deterministic01(worldTileX, worldTileZ, 199),
          kind: 'stumps',
        });
      }

      const slopeDensityScale = 1 - Math.max(0, slopeStress - 0.45) * 0.45;
      const bankTreeScale = 1 - waterInfluence.bank * 0.82;
      const clearingTreeScale = 1 - clearingInfluence.strength;
      const treeDensity = profile.density * clusterDensity * slopeDensityScale * bankTreeScale * clearingTreeScale;
      if (chance <= treeDensity) {
        const treeHeightScale = (1 - waterInfluence.bank * 0.28 - slopeStress * 0.12) * (1 - clearingInfluence.strength * 0.18);
        treePlacements.push({
          x: placementX,
          y: elevation * heightScale + profile.height * scaleJitter * treeHeightScale * 0.5,
          z: placementZ,
          radius: profile.radius * scaleJitter * Math.max(0.72, treeHeightScale),
          height: profile.height * scaleJitter * Math.max(0.68, treeHeightScale),
          rotation: deterministic01(worldTileX, worldTileZ, 59) * Math.PI * 2,
          color: profile.color,
          rank: deterministic01(worldTileX, worldTileZ, 101),
          variant: selectTreeVariant(profile, worldTileX, worldTileZ),
        });
      }

      if (waterInfluence.bank > 0.18 && clearingInfluence.strength < 0.72) {
        const shrubChance = deterministic01(worldTileX, worldTileZ, 131);
        const shrubDensity = Math.min(0.92, 0.18 + waterInfluence.bank * 0.74);
        if (shrubChance <= shrubDensity) {
          const shrubScale = 0.70 + deterministic01(worldTileX, worldTileZ, 137) * 0.48;
          const shrubHeight = (0.34 + waterInfluence.bank * 0.22) * shrubScale;
          shrubPlacements.push({
            x: placementX,
            y: elevation * heightScale - SHRUB_PROTOTYPE_MIN_Y * shrubHeight,
            z: placementZ,
            radius: (0.30 + waterInfluence.bank * 0.16) * shrubScale,
            height: shrubHeight,
            rotation: deterministic01(worldTileX, worldTileZ, 149) * Math.PI * 2,
            color: waterInfluence.bank > 0.6 ? 0x527a35 : 0x3d7130,
            rank: deterministic01(worldTileX, worldTileZ, 151),
          });
        }
      }
    }
  }

  if (treePlacements.length === 0 && shrubPlacements.length === 0 && terrainPropPlacements.length === 0) return undefined;

  capPlacements(treePlacements, MAX_FOLIAGE_INSTANCES_PER_CHUNK);
  capPlacements(shrubPlacements, MAX_SHRUB_INSTANCES_PER_CHUNK);
  capPlacements(terrainPropPlacements, MAX_TERRAIN_PROP_INSTANCES_PER_CHUNK);

  return {
    treePlacements,
    shrubPlacements,
    terrainPropPlacements,
    clearingCount,
    clearingSample,
  };
}

function capPlacements(placements: FoliagePlacement[], cap: number): void {
  if (placements.length <= cap) return;
  placements.sort((a, b) => a.rank - b.rank);
  placements.length = cap;
}

function getFoliageWaterInfluence(
  data: ChunkData,
  tileIndex: number,
  worldTileX: number,
  worldTileZ: number,
  worldXBase: number,
  worldZBase: number
): FoliageWaterInfluence {
  if (data.lakes?.some(lake => lake.tiles.has(tileIndex))) {
    return { inWater: true, bank: 1 };
  }

  const localX = worldTileX - worldXBase;
  const localZ = worldTileZ - worldZBase;
  const riverEdgeDistance = getRiverChannelEdgeDistance(data, localX, localZ);
  if (riverEdgeDistance !== undefined && riverEdgeDistance <= 0) {
    return { inWater: true, bank: 1 };
  }

  let bank = riverEdgeDistance !== undefined
    ? Math.max(0, 1 - riverEdgeDistance / FOLIAGE_BANK_WIDTH)
    : 0;
  bank = Math.max(bank, getLakeBankInfluence(data, localX, localZ));

  return { inWater: false, bank };
}

function getRiverChannelEdgeDistance(data: ChunkData, localX: number, localZ: number): number | undefined {
  const rivers = data.rivers ?? [];
  if (rivers.length === 0) return undefined;

  let closest: number | undefined;
  for (const river of rivers) {
    const points = river.points;
    if (points.length < 2) continue;

    for (let i = 0; i < points.length - 1; i++) {
      const sample = closestRiverRenderSample(localX, localZ, points[i], points[i + 1]);
      const channelRadius = Math.max(getRiverChannelWidth(sample) * 0.5, 0);
      if (channelRadius <= 0) continue;
      const edgeDistance = sample.distance - channelRadius;
      closest = closest === undefined ? edgeDistance : Math.min(closest, edgeDistance);
    }
  }

  return closest;
}

function getLakeBankInfluence(data: ChunkData, localX: number, localZ: number): number {
  const lakes = data.lakes ?? [];
  if (lakes.length === 0) return 0;

  let bank = 0;
  for (const lake of lakes) {
    for (const lakeTileIndex of lake.tiles) {
      const lakeTileX = lakeTileIndex % data.size;
      const lakeTileZ = Math.floor(lakeTileIndex / data.size);
      const edgeDistance = Math.hypot(localX - (lakeTileX + 0.5), localZ - (lakeTileZ + 0.5)) - 0.72;
      if (edgeDistance <= 0) continue;
      bank = Math.max(bank, 1 - edgeDistance / FOLIAGE_BANK_WIDTH);
    }
  }

  return Math.max(0, Math.min(1, bank));
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

function getFoliageProfile(biome: BiomeType): FoliageProfile | undefined {
  switch (biome) {
    case BiomeType.FOREST:
      return { density: 0.72, height: 1.35, radius: 0.48, color: 0x2f6f28, maxSlope: 0.16 };
    case BiomeType.RAINFOREST:
      return { density: 0.88, height: 1.55, radius: 0.56, color: 0x1d5f25, maxSlope: 0.18 };
    case BiomeType.TAIGA:
      return { density: 0.58, height: 1.75, radius: 0.44, color: 0x2a5a43, maxSlope: 0.14 };
    case BiomeType.SWAMP:
      return { density: 0.42, height: 1.10, radius: 0.50, color: 0x3f6230, maxSlope: 0.10 };
    default:
      return undefined;
  }
}

function getFoliageProfileForTile(data: ChunkData, tileIndex: number): FoliageProfile | undefined {
  if (data.sparseBiomeWeights && data.sparseBiomeWeights.length > 0 && data.sparseBiomeOffsets) {
    const weightedProfiles: Array<{ biome: BiomeType; weight: number }> = [
      { biome: BiomeType.FOREST, weight: getBiomeWeightForTile(data, tileIndex, BiomeType.FOREST) },
      { biome: BiomeType.RAINFOREST, weight: getBiomeWeightForTile(data, tileIndex, BiomeType.RAINFOREST) },
      { biome: BiomeType.TAIGA, weight: getBiomeWeightForTile(data, tileIndex, BiomeType.TAIGA) },
      { biome: BiomeType.SWAMP, weight: getBiomeWeightForTile(data, tileIndex, BiomeType.SWAMP) },
    ];
    let best = weightedProfiles[0];
    for (const candidate of weightedProfiles) {
      if (candidate.weight > best.weight) best = candidate;
    }

    if (best.weight >= 0.28) {
      const profile = getFoliageProfile(best.biome);
      return profile
        ? { ...profile, density: profile.density * Math.min(1, best.weight * 1.25) }
        : undefined;
    }
  }

  const biome = data.biomeMap?.[tileIndex] as BiomeType | undefined;
  return biome !== undefined ? getFoliageProfile(biome) : undefined;
}

function getForestClusterDensity(worldX: number, worldZ: number): number {
  const broadX = Math.floor(worldX / 7);
  const broadZ = Math.floor(worldZ / 7);
  const midX = Math.floor(worldX / 3);
  const midZ = Math.floor(worldZ / 3);
  const broad = deterministic01(broadX, broadZ, 211);
  const mid = deterministic01(midX, midZ, 223);
  return Math.max(0.28, Math.min(1.18, 0.30 + broad * 0.66 + mid * 0.22));
}

function selectTreeVariant(profile: FoliageProfile, worldX: number, worldZ: number): TreeVariant {
  const roll = deterministic01(worldX, worldZ, 167);
  if (profile.height >= 1.65) {
    return roll < 0.72 ? 'spire' : 'compact';
  }
  if (profile.radius >= 0.54) {
    if (roll < 0.58) return 'broad';
    return roll < 0.82 ? 'compact' : 'spire';
  }
  if (roll < 0.44) return 'spire';
  return roll < 0.76 ? 'compact' : 'broad';
}

function getClearingInfluence(worldX: number, worldZ: number): FoliageClearingInfluence {
  const cellX = Math.floor(worldX / CLEARING_CELL_SIZE);
  const cellZ = Math.floor(worldZ / CLEARING_CELL_SIZE);
  let strongest: FoliageClearingInfluence = {
    strength: 0,
    centerX: 0,
    centerZ: 0,
    coreRadius: 0,
  };

  for (let z = cellZ - 1; z <= cellZ + 1; z++) {
    for (let x = cellX - 1; x <= cellX + 1; x++) {
      const centerX = (x + 0.5) * CLEARING_CELL_SIZE + (deterministic01(x, z, 307) - 0.5) * 7.0;
      const centerZ = (z + 0.5) * CLEARING_CELL_SIZE + (deterministic01(x, z, 311) - 0.5) * 7.0;
      const radius = 4.8 + deterministic01(x, z, 313) * 3.4;
      const coreRadius = radius * 0.48;
      const distance = Math.hypot(worldX - centerX, worldZ - centerZ);
      if (distance >= radius) continue;

      const strength = distance <= coreRadius
        ? 1
        : 1 - (distance - coreRadius) / (radius - coreRadius);
      if (strength > strongest.strength) {
        strongest = { strength, centerX, centerZ, coreRadius };
      }
    }
  }

  return strongest;
}

function deterministic01(x: number, y: number, salt: number): number {
  let h = Math.imul(Math.trunc(x), 374761393) ^ Math.imul(Math.trunc(y), 668265263) ^ Math.imul(salt, 224682251);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
