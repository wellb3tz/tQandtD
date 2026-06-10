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
  type FoliagePlacementPlan,
  type TreePlacement,
  type TreeVariant,
} from './FoliagePlacementPlanner';
import { disposeGroup } from './ThreeDisposal';

export type FoliageLodLevel = 'near' | 'mid' | 'far';
export const FOLIAGE_LOD_LEVELS: readonly FoliageLodLevel[] = ['near', 'mid', 'far'];

export const FOLIAGE_LOD_DISTANCE_METERS = {
  mid: 720,
  far: 1500,
  hidden: 2700,
} as const;

const FOLIAGE_LOD_INSTANCE_FRACTION: Record<FoliageLodLevel, {
  trees: number;
  shrubs: number;
  terrainProps: number;
}> = {
  near: { trees: 1, shrubs: 1, terrainProps: 1 },
  mid: { trees: 0.62, shrubs: 0.42, terrainProps: 0.38 },
  far: { trees: 0.34, shrubs: 0.10, terrainProps: 0 },
};

const FOLIAGE_LOD_DETAIL: Record<FoliageLodLevel, FoliagePrototypeDetail> = {
  near: 'full',
  mid: 'simple',
  far: 'simple',
};

export interface FoliageLayerOptions {
  initialLod?: FoliageLodLevel;
}

export function createFoliageLayer(
  chunkX: number,
  chunkY: number,
  data: ChunkData,
  seaLevel: number,
  options: FoliageLayerOptions = {},
): THREE.Group | undefined {
  const plan = planFoliagePlacements(chunkX, chunkY, data, seaLevel, data.worldTemperatureOffset);
  if (!plan) return undefined;

  const { treePlacements, shrubPlacements, terrainPropPlacements, clearingCount, clearingSample } = plan;
  const initialLod = options.initialLod ?? 'near';
  const group = new THREE.Group();
  group.name = `foliage-${chunkX},${chunkY}`;
  group.userData.treeCount = treePlacements.length;
  group.userData.shrubCount = shrubPlacements.length;
  group.userData.terrainPropCount = terrainPropPlacements.length;
  group.userData.foliageCount = treePlacements.length + shrubPlacements.length + terrainPropPlacements.length;
  group.userData.clearingCount = clearingCount;
  group.userData.lodEnabled = true;
  group.userData.activeLod = initialLod;
  group.userData.foliagePlan = plan;
  group.userData.chunkCenterX = (chunkX * data.size + data.size * 0.5) * TERRAIN_TILE_SIZE_METERS;
  group.userData.chunkCenterZ = (chunkY * data.size + data.size * 0.5) * TERRAIN_TILE_SIZE_METERS;
  if (clearingSample) group.userData.clearingSample = clearingSample;

  ensureFoliageLodBuilt(group, initialLod);
  setBuiltFoliageLodVisibility(group, initialLod);

  return group;
}

export function ensureFoliageLodBuilt(group: THREE.Group, lod: FoliageLodLevel): THREE.Group | undefined {
  const existing = findFoliageLodGroup(group, lod);
  if (existing) return existing;

  const plan = group.userData.foliagePlan as FoliagePlacementPlan | undefined;
  if (!plan) return undefined;

  const lodGroup = buildFoliageLodGroup(group, plan, lod);
  group.add(lodGroup);
  if (lodGroup.userData.treeVariantCount !== undefined) {
    group.userData.treeVariantCount = lodGroup.userData.treeVariantCount;
  }
  return lodGroup;
}

export function setBuiltFoliageLodVisibility(group: THREE.Group, activeLod: FoliageLodLevel | undefined): void {
  for (const child of group.children) {
    child.visible = activeLod !== undefined && child.userData.foliageLod === activeLod;
  }
}

export function disposeInactiveFoliageLods(group: THREE.Group, activeLod: FoliageLodLevel | undefined): void {
  const inactive = group.children.filter(child => child.userData.foliageLod !== activeLod);
  for (const child of inactive) {
    group.remove(child);
    if (child instanceof THREE.Group) {
      disposeGroup(child);
    }
  }
}

function findFoliageLodGroup(group: THREE.Group, lod: FoliageLodLevel): THREE.Group | undefined {
  return group.children.find(
    child => child instanceof THREE.Group && child.userData.foliageLod === lod,
  ) as THREE.Group | undefined;
}

function buildFoliageLodGroup(
  owner: THREE.Group,
  plan: FoliagePlacementPlan,
  lod: FoliageLodLevel,
): THREE.Group {
  const lodGroup = new THREE.Group();
  lodGroup.name = `foliage-lod-${lod}`;
  lodGroup.userData.foliageLod = lod;
  lodGroup.visible = false;

  const fractions = FOLIAGE_LOD_INSTANCE_FRACTION[lod];
  const detail = FOLIAGE_LOD_DETAIL[lod];
  addTreeLayers(lodGroup, selectStableSubset(plan.treePlacements, fractions.trees), detail);
  addPlacementLayer(lodGroup, 'foliage-shrubs', 'shrub', selectStableSubset(plan.shrubPlacements, fractions.shrubs), false, detail);
  if (plan.terrainPropPlacements.length > 0) {
    addPlacementLayer(lodGroup, 'foliage-props-stumps', 'stump', selectStableSubset(plan.terrainPropPlacements, fractions.terrainProps), false, detail);
    owner.userData.terrainPropKindCount = 1;
  }

  lodGroup.userData.drawLayerCount = lodGroup.children.length;
  return lodGroup;
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
    { variant: 'palm', geometry: createFoliagePrototypeGeometry('palm', detail) },
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
