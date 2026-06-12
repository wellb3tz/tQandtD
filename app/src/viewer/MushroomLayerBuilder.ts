import * as THREE from 'three';
import { BiomeType, TERRAIN_HEIGHT_SCALE_METERS, TERRAIN_TILE_SIZE_METERS, type ChunkData } from '@engine/index';
import { getMushroomModelPrototype, type MushroomModelPrototype } from './MushroomModels';

export interface MushroomPlacement {
  id: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  score: number;
}

export interface MushroomLayerData {
  prototype: MushroomModelPrototype;
  placements: MushroomPlacement[];
}

export const MUSHROOM_INTERACTION_DISTANCE_METERS = 4.5;
export const MUSHROOM_SPEED_BOOST_MULTIPLIER = 1.6;
export const MUSHROOM_SPEED_BOOST_DURATION_MS = 12000;

const MUSHROOM_FRACTION_PER_FOREST_TILE = 0.012;
const MUSHROOM_MAX_SLOPE = 0.16;
const FOREST_BIOMES = new Set<BiomeType>([
  BiomeType.FOREST,
  BiomeType.TAIGA,
  BiomeType.RAINFOREST,
  BiomeType.DRY_FOREST,
]);

export async function createMushroomLayerData(
  chunkX: number,
  chunkY: number,
  data: ChunkData,
  seaLevel: number,
): Promise<MushroomLayerData | undefined> {
  const placements = planMushroomPlacements(chunkX, chunkY, data, seaLevel);
  if (placements.length === 0) {
    return undefined;
  }

  return {
    prototype: await getMushroomModelPrototype(),
    placements,
  };
}

export function addMushroomLayer(owner: THREE.Group, parent: THREE.Group): THREE.Group | undefined {
  const layerData = owner.userData.mushroomLayerData as MushroomLayerData | undefined;
  if (!layerData) return undefined;

  const collectedIds = ensureCollectedMushroomIds(owner);
  const chunkX = Number(owner.userData.chunkX);
  const chunkY = Number(owner.userData.chunkY);
  const group = buildMushroomGroup(layerData, collectedIds, chunkX, chunkY);
  if (!group) {
    owner.userData.visibleMushroomCount = 0;
    return undefined;
  }

  parent.add(group);
  owner.userData.visibleMushroomCount = group.userData.mushroomCount;
  return group;
}

function buildMushroomGroup(
  layerData: MushroomLayerData,
  collectedIds: Set<string>,
  chunkX: number,
  chunkY: number,
): THREE.Group | undefined {
  const remainingPlacements = layerData.placements.filter(placement => !collectedIds.has(placement.id));
  if (remainingPlacements.length === 0) {
    return undefined;
  }

  const group = new THREE.Group();
  group.name = `foliage-mushrooms-${chunkX},${chunkY}`;
  group.userData.foliageLayer = 'mushrooms';
  group.userData.mushroomCount = remainingPlacements.length;

  group.add(createMushroomInstancedMesh(layerData.prototype, remainingPlacements, chunkX, chunkY));

  return group;
}

function createMushroomInstancedMesh(
  prototype: MushroomModelPrototype,
  placements: MushroomPlacement[],
  chunkX: number,
  chunkY: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(prototype.geometry, prototype.material, placements.length);
  mesh.name = `mushroom-${chunkX},${chunkY}-instances`;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.collectibleKind = 'mushroom';
  mesh.userData.mushroomIds = placements.map(placement => placement.id);
  mesh.userData.boostMultiplier = MUSHROOM_SPEED_BOOST_MULTIPLIER;
  mesh.userData.boostDurationMs = MUSHROOM_SPEED_BOOST_DURATION_MS;

  const transform = new THREE.Object3D();
  for (let index = 0; index < placements.length; index++) {
    const placement = placements[index];
    transform.position.set(
      placement.x,
      placement.y - prototype.baseMinY * placement.scale,
      placement.z,
    );
    transform.rotation.set(0, placement.rotation, 0);
    transform.scale.setScalar(placement.scale);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function ensureCollectedMushroomIds(owner: THREE.Group): Set<string> {
  let collectedIds = owner.userData.collectedMushroomIds as Set<string> | undefined;
  if (!collectedIds) {
    collectedIds = new Set<string>();
    owner.userData.collectedMushroomIds = collectedIds;
  }
  return collectedIds;
}

function planMushroomPlacements(
  chunkX: number,
  chunkY: number,
  data: ChunkData,
  seaLevel: number,
): MushroomPlacement[] {
  if (!data.biomeMap || !data.heightmap) return [];

  const chunkSize = data.size;
  const verticesPerSide = chunkSize + 1;
  const worldXBase = chunkX * chunkSize;
  const worldZBase = chunkY * chunkSize;
  const candidates: MushroomPlacement[] = [];
  let forestTileCount = 0;

  for (let tileY = 0; tileY < chunkSize; tileY++) {
    for (let tileX = 0; tileX < chunkSize; tileX++) {
      const tileIndex = tileY * chunkSize + tileX;
      const biome = data.biomeMap[tileIndex];
      if (!FOREST_BIOMES.has(biome)) continue;

      forestTileCount++;
      const heightIndex = tileY * verticesPerSide + tileX;
      const elevation = data.heightmap[heightIndex] ?? 0;
      const right = data.heightmap[heightIndex + 1] ?? elevation;
      const down = data.heightmap[heightIndex + verticesPerSide] ?? elevation;
      const slope = Math.abs(right - elevation) + Math.abs(down - elevation);
      if (slope > MUSHROOM_MAX_SLOPE) continue;
      if (elevation <= seaLevel + 0.03) continue;

      const worldTileX = worldXBase + tileX;
      const worldTileZ = worldZBase + tileY;
      const score = deterministic01(worldTileX, worldTileZ, 211) * 0.7 + (1 - Math.min(1, slope / MUSHROOM_MAX_SLOPE)) * 0.3;
      const jitterX = 0.22 + deterministic01(worldTileX, worldTileZ, 223) * 0.56;
      const jitterZ = 0.22 + deterministic01(worldTileX, worldTileZ, 227) * 0.56;
      const placementElevation = sampleTerrainElevationAtTilePoint(
        data.heightmap,
        verticesPerSide,
        tileX,
        tileY,
        jitterX,
        jitterZ,
      );

      candidates.push({
        id: `${chunkX}:${chunkY}:${tileX}:${tileY}`,
        x: (worldTileX + jitterX) * TERRAIN_TILE_SIZE_METERS,
        y: placementElevation * TERRAIN_HEIGHT_SCALE_METERS,
        z: (worldTileZ + jitterZ) * TERRAIN_TILE_SIZE_METERS,
        scale: 0.62 + deterministic01(worldTileX, worldTileZ, 229) * 0.42,
        rotation: deterministic01(worldTileX, worldTileZ, 233) * Math.PI * 2,
        score,
      });
    }
  }

  if (candidates.length === 0) return [];

  const targetCount = Math.max(1, Math.floor(forestTileCount * MUSHROOM_FRACTION_PER_FOREST_TILE));
  return candidates
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.min(targetCount, candidates.length));
}

function sampleTerrainElevationAtTilePoint(
  heightmap: Float32Array,
  verticesPerSide: number,
  tileX: number,
  tileY: number,
  localX: number,
  localZ: number,
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

function deterministic01(x: number, y: number, salt: number): number {
  let h = Math.imul(Math.trunc(x), 374761393) ^ Math.imul(Math.trunc(y), 668265263) ^ Math.imul(salt, 224682251);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
