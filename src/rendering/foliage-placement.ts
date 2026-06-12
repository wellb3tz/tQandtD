import { BiomeType, type ChunkData, getBiomeWeightForTile } from '../world/chunk';
import { getRiverChannelWidth, type RiverPoint } from '../gen/rivers';
import { TERRAIN_HEIGHT_SCALE_METERS, TERRAIN_TILE_SIZE_METERS } from '../config/world-units';

const MAX_FOLIAGE_INSTANCES_PER_CHUNK = 2048;
const MAX_SHRUB_INSTANCES_PER_CHUNK = 1536;
const MAX_TERRAIN_PROP_INSTANCES_PER_CHUNK = 96;
const TREE_CANDIDATES_PER_TILE = 6;
const FOLIAGE_BANK_WIDTH = 2.4;
const TREE_AND_PROP_PROTOTYPE_MIN_Y = -0.50;
export const SHRUB_PROTOTYPE_MIN_Y = -0.30;
const CLEARING_CELL_SIZE = 25;
const TREE_HEIGHT_METERS_SCALE = 10;
const PROP_HEIGHT_METERS_SCALE = 1.8;

export type FoliageProfile = {
  density: number;
  height: number;
  radius: number;
  color: number;
  maxSlope: number;
  treeVariant?: TreeVariant;
  shrubVariant?: ShrubVariant;
  allowTrees?: boolean;
  allowShrubs?: boolean;
  allowTerrainProps?: boolean;
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

export type TreeVariant = 'spire' | 'compact' | 'broad' | 'palm';
export type ShrubVariant = 'procedural' | 'model';

export type TreePlacement = FoliagePlacement & {
  variant: TreeVariant;
};

export type ShrubPlacement = FoliagePlacement & {
  variant?: ShrubVariant;
};

export type TerrainPropPlacement = FoliagePlacement & {
  kind: 'stumps';
};

type FoliageWaterInfluence = {
  inWater: boolean;
  bank: number;
};

type LakeWaterInfluence = {
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
  shrubPlacements: ShrubPlacement[];
  terrainPropPlacements: TerrainPropPlacement[];
  clearingCount: number;
  clearingSample?: { x: number; z: number; radius: number };
};

export function planFoliagePlacements(
  chunkX: number,
  chunkY: number,
  data: ChunkData,
  seaLevel: number,
  worldTemperatureOffset?: number,
): FoliagePlacementPlan | undefined {
  if (!data.biomeMap || !data.heightmap) return undefined;

  const chunkSize = data.size;
  const verticesPerSide = chunkSize + 1;
  const worldXBase = chunkX * chunkSize;
  const worldZBase = chunkY * chunkSize;
  const heightScale = TERRAIN_HEIGHT_SCALE_METERS;
  const horizontalScale = TERRAIN_TILE_SIZE_METERS;
  const treePlacements: TreePlacement[] = [];
  const shrubPlacements: ShrubPlacement[] = [];
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

      const right = data.heightmap[heightIndex + 1] ?? elevation;
      const down = data.heightmap[heightIndex + verticesPerSide] ?? elevation;
      const slope = Math.abs(right - elevation) + Math.abs(down - elevation);
      if (slope > profile.maxSlope) continue;

      const worldTileX = worldXBase + tileX;
      const worldTileZ = worldZBase + tileY;
      const jitterX = 0.08 + deterministic01(worldTileX, worldTileZ, 23) * 0.84;
      const jitterZ = 0.08 + deterministic01(worldTileX, worldTileZ, 31) * 0.84;
      const placementX = worldTileX + jitterX;
      const placementZ = worldTileZ + jitterZ;
      const placementElevation = sampleTerrainElevationAtTilePoint(
        data.heightmap,
        verticesPerSide,
        tileX,
        tileY,
        jitterX,
        jitterZ
      );
      if (placementElevation <= seaLevel + 0.035) continue;

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

      const clusterDensity = getForestClusterDensity(worldTileX, worldTileZ);
      const slopeStress = Math.min(1, slope / Math.max(profile.maxSlope, 0.001));
      const slopeDensityScale = 1 - Math.max(0, slopeStress - 0.45) * 0.45;
      if (profile.allowShrubs !== false) {
        const shrubChance = deterministic01(worldTileX, worldTileZ, 139);
        const shrubDensity = Math.min(
          0.72,
          profile.density * clusterDensity * 0.36 * slopeDensityScale * Math.max(0, 1 - waterInfluence.bank * 1.15) * (1 - clearingInfluence.strength * 0.55),
        );
        if (shrubChance <= shrubDensity && shouldPlaceShrubs(slope, waterInfluence.bank)) {
          const shrubJitterX = 0.10 + deterministic01(worldTileX, worldTileZ, 149) * 0.80;
          const shrubJitterZ = 0.10 + deterministic01(worldTileX, worldTileZ, 151) * 0.80;
          const shrubElevation = sampleTerrainElevationAtTilePoint(
            data.heightmap,
            verticesPerSide,
            tileX,
            tileY,
            shrubJitterX,
            shrubJitterZ
          );
          const shrubScale = 0.62 + deterministic01(worldTileX, worldTileZ, 157) * 0.72;
          const shrubHeight = profile.height * 0.30 * shrubScale * TREE_HEIGHT_METERS_SCALE;
          const shrubRadius = profile.radius * 0.62 * shrubScale * TREE_HEIGHT_METERS_SCALE;
          shrubPlacements.push({
            x: (worldTileX + shrubJitterX) * horizontalScale,
            y: shrubElevation * heightScale - SHRUB_PROTOTYPE_MIN_Y * shrubHeight,
            z: (worldTileZ + shrubJitterZ) * horizontalScale,
            radius: shrubRadius,
            height: shrubHeight,
            rotation: deterministic01(worldTileX, worldTileZ, 163) * Math.PI * 2,
            color: modulateFoliageColor(profile.color, worldTemperatureOffset ?? 0),
            rank: deterministic01(worldTileX, worldTileZ, 173),
            variant: profile.shrubVariant,
          });
        }
      }

      if (profile.allowTerrainProps !== false) {
        const propChance = deterministic01(worldTileX, worldTileZ, 181);
        const propDensity = Math.min(0.18, 0.035 + clearingInfluence.strength * 0.055 + waterInfluence.bank * 0.024 + slopeStress * 0.045);
        if (propChance <= propDensity) {
          const propScale = 0.72 + deterministic01(worldTileX, worldTileZ, 193) * 0.56;
          const stumpHeight = 0.30 * propScale * PROP_HEIGHT_METERS_SCALE;
          const stumpRadius = 0.25 * propScale * PROP_HEIGHT_METERS_SCALE;
          terrainPropPlacements.push({
            x: placementX * horizontalScale,
            y: placementElevation * heightScale - TREE_AND_PROP_PROTOTYPE_MIN_Y * stumpHeight,
            z: placementZ * horizontalScale,
            radius: stumpRadius,
            height: stumpHeight,
            rotation: deterministic01(worldTileX, worldTileZ, 197) * Math.PI * 2,
            color: 0x6a4325,
            rank: deterministic01(worldTileX, worldTileZ, 199),
            kind: 'stumps',
          });
        }
      }

      if (profile.allowTrees === false) continue;

      for (let candidate = 0; candidate < TREE_CANDIDATES_PER_TILE; candidate++) {
        const localCellX = candidate % 3;
        const localCellZ = Math.floor(candidate / 3);
        const treeJitterX = (localCellX + 0.14 + deterministic01(worldTileX, worldTileZ, 23 + candidate * 11) * 0.72) / 3;
        const treeJitterZ = (localCellZ + 0.10 + deterministic01(worldTileX, worldTileZ, 31 + candidate * 11) * 0.80) * 0.5;
        const treeX = worldTileX + treeJitterX;
        const treeZ = worldTileZ + treeJitterZ;
        const treeElevation = sampleTerrainElevationAtTilePoint(
          data.heightmap,
          verticesPerSide,
          tileX,
          tileY,
          treeJitterX,
          treeJitterZ
        );
        if (treeElevation <= seaLevel + 0.035) continue;

        const treeWaterInfluence = getFoliageWaterInfluence(data, tileIndex, treeX, treeZ, worldXBase, worldZBase);
        if (treeWaterInfluence.inWater) continue;

        const treeClearingInfluence = getClearingInfluence(treeX, treeZ);
        const isDesertPalm = profile.treeVariant === 'palm';
        const clearingTreeScale = 1 - treeClearingInfluence.strength;
        const bankTreeScale = isDesertPalm
          ? Math.max(0.36, treeWaterInfluence.bank * 1.15)
          : Math.max(0, 1 - treeWaterInfluence.bank);
        const desertLowlandSignal = isDesertPalm
          ? getDesertLowlandSignal(
              data.heightmap,
              verticesPerSide,
              chunkSize,
              tileX,
              tileY,
              treeElevation,
              seaLevel,
            )
          : 0;
        const oasisClusterDensity = isDesertPalm ? getDesertOasisClusterDensity(worldTileX, worldTileZ) : 0;
        const oasisSignal = isDesertPalm
          ? Math.max(
              treeWaterInfluence.bank,
              desertLowlandSignal * (0.14 + oasisClusterDensity * 0.58),
            )
          : 1;
        if (isDesertPalm && oasisSignal <= 0.12) continue;

        const treeDensityBase = profile.density * clusterDensity * 1.22 * slopeDensityScale * bankTreeScale * clearingTreeScale;
        const treeDensity = isDesertPalm
          ? Math.min(0.24, treeDensityBase * (2.2 + oasisSignal * 5.0) * oasisSignal)
          : Math.min(1, treeDensityBase);
        if (deterministic01(worldTileX, worldTileZ, 17 + candidate * 11) > treeDensity) continue;

        const treeScaleJitter = 0.82 + deterministic01(worldTileX, worldTileZ, 43 + candidate * 11) * 0.46;
        const treeHeightScale = (1 - (isDesertPalm ? oasisSignal * 0.08 : treeWaterInfluence.bank * 0.28) - slopeStress * 0.12) * (1 - treeClearingInfluence.strength * 0.18);
        const treeHeight = profile.height * treeScaleJitter * Math.max(0.68, treeHeightScale) * TREE_HEIGHT_METERS_SCALE;
        const treeRadius = profile.radius * treeScaleJitter * Math.max(0.72, treeHeightScale) * TREE_HEIGHT_METERS_SCALE;
        treePlacements.push({
          x: treeX * horizontalScale,
          y: treeElevation * heightScale - TREE_AND_PROP_PROTOTYPE_MIN_Y * treeHeight,
          z: treeZ * horizontalScale,
          radius: treeRadius,
          height: treeHeight,
          rotation: deterministic01(worldTileX, worldTileZ, 59 + candidate * 11) * Math.PI * 2,
          color: modulateFoliageColor(profile.color, worldTemperatureOffset ?? 0),
          rank: deterministic01(worldTileX, worldTileZ, 101 + candidate * 11),
          variant: profile.treeVariant ?? selectTreeVariant(profile, worldTileX * TREE_CANDIDATES_PER_TILE + candidate, worldTileZ),
        });
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

function sampleTerrainElevationAtTilePoint(
  heightmap: Float32Array,
  verticesPerSide: number,
  tileX: number,
  tileY: number,
  localX: number,
  localZ: number
): number {
  const topLeftIndex = tileY * verticesPerSide + tileX;
  const h00 = heightmap[topLeftIndex] ?? 0;
  const h10 = heightmap[topLeftIndex + 1] ?? h00;
  const h01 = heightmap[topLeftIndex + verticesPerSide] ?? h00;
  const h11 = heightmap[topLeftIndex + verticesPerSide + 1] ?? h00;

  if (localX + localZ <= 1) {
    return h00 + localX * (h10 - h00) + localZ * (h01 - h00);
  }

  return h11 + (1 - localX) * (h01 - h11) + (1 - localZ) * (h10 - h11);
}

function capPlacements(placements: FoliagePlacement[], cap: number): void {
  if (placements.length <= cap) return;
  placements.sort((a, b) => a.rank - b.rank);
  placements.length = cap;
}

function shouldPlaceShrubs(slope: number, bankInfluence: number): boolean {
  if (bankInfluence > 0) return false;
  return slope < 0.001;
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
  const lakeInfluence = getLakeWaterInfluence(data, tileIndex, localX, localZ);
  if (lakeInfluence.inWater) {
    return { inWater: true, bank: 1 };
  }
  bank = Math.max(bank, lakeInfluence.bank);

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

function getLakeWaterInfluence(data: ChunkData, tileIndex: number, localX: number, localZ: number): LakeWaterInfluence {
  const lakes = data.lakes ?? [];
  if (lakes.length === 0) return { inWater: false, bank: 0 };

  const tileX = tileIndex % data.size;
  const tileZ = Math.floor(tileIndex / data.size);
  let bank = 0;
  for (const lake of lakes) {
    for (const lakeTileIndex of lake.tiles) {
      const lakeTileX = lakeTileIndex % data.size;
      const lakeTileZ = Math.floor(lakeTileIndex / data.size);
      // Treat tiles directly adjacent to a lake tile (including diagonals) as
      // lake walls, preventing all foliage there just like on the lake bottom.
      if (Math.abs(tileX - lakeTileX) <= 1 && Math.abs(tileZ - lakeTileZ) <= 1) {
        return { inWater: true, bank: 1 };
      }

      const dx = localX - lakeTileX;
      const dz = localZ - lakeTileZ;
      const edgeDistance = Math.hypot(dx, dz) - 0.72;
      if (edgeDistance <= 0) continue;
      bank = Math.max(bank, 1 - edgeDistance / FOLIAGE_BANK_WIDTH);
    }
  }

  return { inWater: false, bank: Math.max(0, Math.min(1, bank)) };
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
      return { density: 0.86, height: 1.42, radius: 0.50, color: 0x285f24, maxSlope: 0.18 };
    case BiomeType.DESERT:
      return {
        density: 0.011,
        height: 1.26,
        radius: 0.34,
        color: 0x8f9a56,
        maxSlope: 0.12,
        treeVariant: 'palm',
        allowShrubs: false,
        allowTerrainProps: false,
      };
    case BiomeType.DRY_FOREST:
      return { density: 0.42, height: 1.20, radius: 0.44, color: 0x586f2d, maxSlope: 0.16 };
    case BiomeType.RAINFOREST:
      return { density: 0.96, height: 1.62, radius: 0.58, color: 0x185623, maxSlope: 0.20 };
    case BiomeType.TAIGA:
      return { density: 0.72, height: 1.86, radius: 0.46, color: 0x254f3e, maxSlope: 0.17 };
    case BiomeType.SWAMP:
      return { density: 0.50, height: 1.14, radius: 0.52, color: 0x375a2b, maxSlope: 0.12 };
    case BiomeType.SAVANNA:
      return {
        density: 0.16,
        height: 0.64,
        radius: 0.36,
        color: 0x697735,
        maxSlope: 0.13,
        shrubVariant: 'model',
        allowTrees: false,
        allowShrubs: true,
        allowTerrainProps: false,
      };
    default:
      return undefined;
  }
}

function getFoliageProfileForTile(data: ChunkData, tileIndex: number): FoliageProfile | undefined {
  if (data.sparseBiomeWeights && data.sparseBiomeWeights.length > 0 && data.sparseBiomeOffsets) {
    const weightedProfiles: Array<{ biome: BiomeType; weight: number }> = [
      { biome: BiomeType.FOREST, weight: getBiomeWeightForTile(data, tileIndex, BiomeType.FOREST) },
      { biome: BiomeType.DESERT, weight: getBiomeWeightForTile(data, tileIndex, BiomeType.DESERT) },
      { biome: BiomeType.DRY_FOREST, weight: getBiomeWeightForTile(data, tileIndex, BiomeType.DRY_FOREST) },
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

function getDesertOasisClusterDensity(worldX: number, worldZ: number): number {
  const broadX = Math.floor(worldX / 13);
  const broadZ = Math.floor(worldZ / 13);
  const midX = Math.floor(worldX / 5);
  const midZ = Math.floor(worldZ / 5);
  const broad = deterministic01(broadX, broadZ, 229);
  const mid = deterministic01(midX, midZ, 233);
  return Math.max(0, Math.min(1, broad * 0.72 + mid * 0.34 - 0.36));
}

function getDesertLowlandSignal(
  heightmap: Float32Array,
  verticesPerSide: number,
  chunkSize: number,
  tileX: number,
  tileY: number,
  placementElevation: number,
  seaLevel: number,
): number {
  let neighborTotal = 0;
  let neighborCount = 0;
  let highestNeighbor = -Infinity;
  let lowestNeighbor = Infinity;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = tileX + dx;
      const ny = tileY + dy;
      if (nx < 0 || ny < 0 || nx >= chunkSize || ny >= chunkSize) continue;
      const neighborElevation = sampleTerrainElevationAtTilePoint(heightmap, verticesPerSide, nx, ny, 0.5, 0.5);
      neighborTotal += neighborElevation;
      neighborCount++;
      highestNeighbor = Math.max(highestNeighbor, neighborElevation);
      lowestNeighbor = Math.min(lowestNeighbor, neighborElevation);
    }
  }

  if (neighborCount === 0) {
    return 0;
  }

  const averageNeighbor = neighborTotal / neighborCount;
  const depression = averageNeighbor - placementElevation;
  const basinContrast = highestNeighbor - lowestNeighbor;
  const localBasin = smoothstep(0.012, 0.06, depression) * smoothstep(0.02, 0.11, basinContrast);
  const broadLowland = 1 - smoothstep(seaLevel + 0.18, seaLevel + 0.34, placementElevation);
  return Math.max(0, Math.min(1, Math.max(localBasin, broadLowland * 0.62)));
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

function modulateFoliageColor(baseColor: number, offset: number): number {
  if (Math.abs(offset) < 0.3) return baseColor;

  const r = ((baseColor >> 16) & 0xff) / 255;
  const g = ((baseColor >> 8) & 0xff) / 255;
  const b = (baseColor & 0xff) / 255;

  if (offset > 0.3) {
    // Hot / dry: yellow-brown shift
    const t = Math.min(1, (offset - 0.3) / 0.7);
    const nr = r + (0.55 - r) * t * 0.35;
    const ng = g + (0.50 - g) * t * 0.25;
    const nb = b + (0.18 - b) * t * 0.15;
    return (
      (Math.round(Math.min(1, nr) * 255) << 16) |
      (Math.round(Math.min(1, ng) * 255) << 8) |
      Math.round(Math.min(1, nb) * 255)
    );
  } else {
    // Cold: darker blue-green shift
    const t = Math.min(1, (-offset - 0.3) / 0.7);
    const nr = r + (0.12 - r) * t * 0.20;
    const ng = g + (0.25 - g) * t * 0.15;
    const nb = b + (0.18 - b) * t * 0.10;
    return (
      (Math.round(Math.min(1, nr) * 255) << 16) |
      (Math.round(Math.min(1, ng) * 255) << 8) |
      Math.round(Math.min(1, nb) * 255)
    );
  }
}

function deterministic01(x: number, y: number, salt: number): number {
  let h = Math.imul(Math.trunc(x), 374761393) ^ Math.imul(Math.trunc(y), 668265263) ^ Math.imul(salt, 224682251);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
