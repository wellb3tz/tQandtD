import * as THREE from 'three';
import type { ChunkMesh } from './ChunkMesh';
import {
  disposeInactiveFoliageLods,
  ensureFoliageLodBuilt,
  FOLIAGE_LOD_DISTANCE_METERS,
  setBuiltFoliageLodVisibility,
  type FoliageLodLevel,
} from './FoliageLayerBuilder';
import { isRenderLayerVisible, RenderLayer, type RenderLayerVisibilityState } from './RenderLayerVisibility';

const LOD_UPDATE_EPSILON_METERS = 8;

export interface FoliageLodStats {
  near: number;
  mid: number;
  far: number;
  hidden: number;
}

export function updateFoliageLodForChunks(
  chunks: Iterable<ChunkMesh>,
  cameraPosition: THREE.Vector3,
  layerVisibility: RenderLayerVisibilityState,
): FoliageLodStats {
  const stats: FoliageLodStats = { near: 0, mid: 0, far: 0, hidden: 0 };
  const foliageLayerVisible = isRenderLayerVisible(layerVisibility, RenderLayer.FOLIAGE);

  for (const chunk of chunks) {
    const foliage = chunk.foliage;
    if (!foliage?.userData.lodEnabled) continue;

    if (!foliageLayerVisible) {
      setFoliageLodVisibility(foliage, undefined);
      stats.hidden++;
      continue;
    }

    if (chunk.visible === false || foliage.visible === false) {
      stats.hidden++;
      continue;
    }

    const distance = getHorizontalDistanceToFoliage(foliage, cameraPosition);
    const level = selectFoliageLodLevel(distance);
    if (!level) {
      setFoliageLodVisibility(foliage, undefined);
      stats.hidden++;
      continue;
    }

    setFoliageLodVisibility(foliage, level);
    stats[level]++;
  }

  return stats;
}

export function selectFoliageLodLevel(distanceMeters: number): FoliageLodLevel | undefined {
  if (distanceMeters >= FOLIAGE_LOD_DISTANCE_METERS.hidden) return undefined;
  if (distanceMeters >= FOLIAGE_LOD_DISTANCE_METERS.far) return 'far';
  if (distanceMeters >= FOLIAGE_LOD_DISTANCE_METERS.mid) return 'mid';
  return 'near';
}

function getHorizontalDistanceToFoliage(foliage: THREE.Group, cameraPosition: THREE.Vector3): number {
  const centerX = Number(foliage.userData.chunkCenterX);
  const centerZ = Number(foliage.userData.chunkCenterZ);
  if (!Number.isFinite(centerX) || !Number.isFinite(centerZ)) {
    return 0;
  }

  return Math.hypot(cameraPosition.x - centerX, cameraPosition.z - centerZ);
}

function setFoliageLodVisibility(foliage: THREE.Group, level: FoliageLodLevel | undefined): void {
  const previousLevel = foliage.userData.activeLod as FoliageLodLevel | undefined;
  if (previousLevel === level) {
    if (level) {
      ensureFoliageLodBuilt(foliage, level);
    }
    setBuiltFoliageLodVisibility(foliage, level);
    return;
  }

  if (level) {
    ensureFoliageLodBuilt(foliage, level);
  }

  foliage.userData.activeLod = level;
  setBuiltFoliageLodVisibility(foliage, level);
  disposeInactiveFoliageLods(foliage, level);
}

export function shouldUpdateFoliageLod(
  lastCameraPosition: THREE.Vector3 | undefined,
  cameraPosition: THREE.Vector3,
): boolean {
  if (!lastCameraPosition) return true;
  const dx = cameraPosition.x - lastCameraPosition.x;
  const dz = cameraPosition.z - lastCameraPosition.z;
  return dx * dx + dz * dz >= LOD_UPDATE_EPSILON_METERS * LOD_UPDATE_EPSILON_METERS;
}
