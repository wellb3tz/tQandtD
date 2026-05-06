import * as THREE from 'three';
import type { ChunkData } from '@engine/index';
import {
  createFoliageInstancedMesh,
  createFoliagePrototypeGeometry,
  type FoliagePrototypeKind,
} from './FoliageGeometryBuilder';
import {
  planFoliagePlacements,
  type FoliagePlacement,
  type TreePlacement,
  type TreeVariant,
} from './FoliagePlacementPlanner';

export function createFoliageLayer(
  chunkX: number,
  chunkY: number,
  data: ChunkData,
  seaLevel: number,
): THREE.Group | undefined {
  const plan = planFoliagePlacements(chunkX, chunkY, data, seaLevel);
  if (!plan) return undefined;

  const { treePlacements, shrubPlacements, terrainPropPlacements, clearingCount, clearingSample } = plan;
  const group = new THREE.Group();
  group.name = `foliage-${chunkX},${chunkY}`;
  group.userData.treeCount = treePlacements.length;
  group.userData.shrubCount = shrubPlacements.length;
  group.userData.terrainPropCount = terrainPropPlacements.length;
  group.userData.foliageCount = treePlacements.length + shrubPlacements.length + terrainPropPlacements.length;
  group.userData.clearingCount = clearingCount;
  if (clearingSample) group.userData.clearingSample = clearingSample;

  addTreeLayers(group, treePlacements);
  addPlacementLayer(group, 'foliage-shrubs', 'shrub', shrubPlacements, false);
  if (terrainPropPlacements.length > 0) {
    addPlacementLayer(group, 'foliage-props-stumps', 'stump', terrainPropPlacements, false);
    group.userData.terrainPropKindCount = 1;
  }

  return group;
}

function addTreeLayers(
  group: THREE.Group,
  treePlacements: TreePlacement[],
): void {
  if (treePlacements.length === 0) return;

  const treeVariants: Array<{ variant: TreeVariant; geometry: THREE.BufferGeometry }> = [
    { variant: 'spire', geometry: createFoliagePrototypeGeometry('spire') },
    { variant: 'compact', geometry: createFoliagePrototypeGeometry('compact') },
    { variant: 'broad', geometry: createFoliagePrototypeGeometry('broad') },
  ];

  let treeVariantCount = 0;
  for (const { variant, geometry } of treeVariants) {
    const variantPlacements = treePlacements.filter(placement => placement.variant === variant);
    if (variantPlacements.length === 0) {
      geometry.dispose();
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
): void {
  if (placements.length === 0) return;

  const mesh = createFoliageInstancedMesh(createFoliagePrototypeGeometry(prototype), placements);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
}
