import * as THREE from 'three';
import { TERRAIN_TILE_SIZE_METERS, type ChunkData } from '@engine/index';
import {
  createFoliageInstancedMesh,
  createFoliagePrototypeGeometry,
  type FoliagePrototypeDetail,
  type FoliagePrototypeKind,
} from './FoliageGeometryBuilder';
import {
  planFoliagePlacements,
  type FoliagePlacement,
  type TreePlacement,
  type TreeVariant,
} from './FoliagePlacementPlanner';

export type FoliageLodLevel = 'near' | 'mid' | 'far';

export const FOLIAGE_LOD_DISTANCE_METERS = {
  mid: 540,
  far: 1080,
  hidden: 1860,
} as const;

const FOLIAGE_LOD_INSTANCE_FRACTION: Record<FoliageLodLevel, {
  trees: number;
  shrubs: number;
  terrainProps: number;
}> = {
  near: { trees: 1, shrubs: 1, terrainProps: 1 },
  mid: { trees: 0.46, shrubs: 0.28, terrainProps: 0.35 },
  far: { trees: 0.16, shrubs: 0, terrainProps: 0 },
};

const FOLIAGE_LOD_DETAIL: Record<FoliageLodLevel, FoliagePrototypeDetail> = {
  near: 'full',
  mid: 'simple',
  far: 'simple',
};

export function createFoliageLayer(
  chunkX: number,
  chunkY: number,
  data: ChunkData,
  seaLevel: number,
): THREE.Group | undefined {
  const plan = planFoliagePlacements(chunkX, chunkY, data, seaLevel, data.worldTemperatureOffset);
  if (!plan) return undefined;

  const { treePlacements, shrubPlacements, terrainPropPlacements, clearingCount, clearingSample } = plan;
  const group = new THREE.Group();
  group.name = `foliage-${chunkX},${chunkY}`;
  group.userData.treeCount = treePlacements.length;
  group.userData.shrubCount = shrubPlacements.length;
  group.userData.terrainPropCount = terrainPropPlacements.length;
  group.userData.foliageCount = treePlacements.length + shrubPlacements.length + terrainPropPlacements.length;
  group.userData.clearingCount = clearingCount;
  group.userData.lodEnabled = true;
  group.userData.activeLod = 'near';
  group.userData.chunkCenterX = (chunkX * data.size + data.size * 0.5) * TERRAIN_TILE_SIZE_METERS;
  group.userData.chunkCenterZ = (chunkY * data.size + data.size * 0.5) * TERRAIN_TILE_SIZE_METERS;
  if (clearingSample) group.userData.clearingSample = clearingSample;

  for (const lod of ['near', 'mid', 'far'] as const) {
    const lodGroup = new THREE.Group();
    lodGroup.name = `foliage-lod-${lod}`;
    lodGroup.userData.foliageLod = lod;
    lodGroup.visible = lod === 'near';

    const fractions = FOLIAGE_LOD_INSTANCE_FRACTION[lod];
    const detail = FOLIAGE_LOD_DETAIL[lod];
    addTreeLayers(lodGroup, selectStableSubset(treePlacements, fractions.trees), detail);
    addPlacementLayer(lodGroup, 'foliage-shrubs', 'shrub', selectStableSubset(shrubPlacements, fractions.shrubs), false, detail);
    if (terrainPropPlacements.length > 0) {
      addPlacementLayer(lodGroup, 'foliage-props-stumps', 'stump', selectStableSubset(terrainPropPlacements, fractions.terrainProps), false, detail);
      group.userData.terrainPropKindCount = 1;
    }

    lodGroup.userData.drawLayerCount = lodGroup.children.length;
    group.add(lodGroup);
  }

  return group;
}

function addTreeLayers(
  group: THREE.Group,
  treePlacements: TreePlacement[],
  detail: FoliagePrototypeDetail,
): void {
  if (treePlacements.length === 0) return;

  const treeVariants: Array<{ variant: TreeVariant; geometry: THREE.BufferGeometry }> = [
    { variant: 'spire', geometry: createFoliagePrototypeGeometry('spire', detail) },
    { variant: 'compact', geometry: createFoliagePrototypeGeometry('compact', detail) },
    { variant: 'broad', geometry: createFoliagePrototypeGeometry('broad', detail) },
  ];

  let treeVariantCount = 0;
  for (const { variant, geometry } of treeVariants) {
    const variantPlacements = treePlacements.filter(placement => placement.variant === variant);
    if (variantPlacements.length === 0) {
      continue;
    }

    const treeMesh = createFoliageInstancedMesh(geometry, variantPlacements);
    treeMesh.name = `foliage-trees-${variant}`;
    treeMesh.castShadow = true;
    treeMesh.receiveShadow = true;
    group.add(treeMesh);
    treeVariantCount++;
  }
  group.userData.treeVariantCount = treeVariantCount;
}

function addPlacementLayer(
  group: THREE.Group,
  name: string,
  prototype: FoliagePrototypeKind,
  placements: FoliagePlacement[],
  castShadow: boolean,
  detail: FoliagePrototypeDetail,
): void {
  if (placements.length === 0) return;

  const mesh = createFoliageInstancedMesh(createFoliagePrototypeGeometry(prototype, detail), placements);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function selectStableSubset<T extends FoliagePlacement>(placements: T[], fraction: number): T[] {
  if (fraction >= 1) return placements;
  if (fraction <= 0 || placements.length === 0) return [];

  const targetCount = Math.max(1, Math.floor(placements.length * fraction));
  if (targetCount >= placements.length) return placements;

  return placements
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, targetCount);
}
