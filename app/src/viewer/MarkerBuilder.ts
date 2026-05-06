import * as THREE from 'three';
import {
  buildResourceMarkerPlacements,
  buildStructureMarkerPlacements,
  getResourceMarkerColor,
  getStructureMarkerColor,
  type ChunkData,
  type StructureMarkerPlacementData,
} from '@engine/index';

const TERRAIN_HEIGHT_SCALE = 50;

export function createResourceMarkers(chunkX: number, chunkY: number, data: ChunkData): THREE.Group {
  const group = new THREE.Group();
  const placements = buildResourceMarkerPlacements(chunkX, chunkY, data, {
    heightScale: TERRAIN_HEIGHT_SCALE,
  });

  for (const placement of placements) {
    const geometry = new THREE.SphereGeometry(0.5, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: placement.color });
    const marker = new THREE.Mesh(geometry, material);

    marker.position.set(placement.x, placement.y, placement.z);
    group.add(marker);
  }

  return group;
}

export function createStructureMarkers(chunkX: number, chunkY: number, data: ChunkData): THREE.Group {
  const group = new THREE.Group();
  const placements = buildStructureMarkerPlacements(chunkX, chunkY, data, {
    heightScale: TERRAIN_HEIGHT_SCALE,
  });

  for (const placement of placements) {
    const geometry = createStructureGeometry(placement);
    const material = new THREE.MeshLambertMaterial({ color: placement.color });
    const marker = new THREE.Mesh(geometry, material);

    marker.position.set(placement.x, placement.y, placement.z);
    group.add(marker);
  }

  return group;
}

export function getResourceColor(type: string | number): number {
  return getResourceMarkerColor(type);
}

export function getStructureColor(type: string | number): number {
  return getStructureMarkerColor(type);
}

function createStructureGeometry(placement: StructureMarkerPlacementData): THREE.BufferGeometry {
  switch (placement.geometryKind) {
    case 'cylinder':
      return new THREE.CylinderGeometry(
        placement.width,
        placement.depth,
        placement.height,
        placement.radialSegments ?? 8,
      );
    case 'box':
    default:
      return new THREE.BoxGeometry(placement.width, placement.height, placement.depth);
  }
}
