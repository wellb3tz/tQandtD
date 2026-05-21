import * as THREE from 'three';
import {
  buildResourceMarkerPlacements,
  buildStructureMarkerPlacements,
  getResourceMarkerColor,
  getStructureMarkerColor,
  TERRAIN_HEIGHT_SCALE_METERS,
  type ChunkData,
  type StructureMarkerPlacementData,
} from '@engine/index';

const TERRAIN_HEIGHT_SCALE = TERRAIN_HEIGHT_SCALE_METERS;
const RESOURCE_SPHERE_RADIUS = 0.5;
const RESOURCE_SPHERE_DETAIL = 8;

export function createResourceMarkers(chunkX: number, chunkY: number, data: ChunkData): THREE.Group {
  const group = new THREE.Group();
  const placements = buildResourceMarkerPlacements(chunkX, chunkY, data, {
    heightScale: TERRAIN_HEIGHT_SCALE,
  });

  if (placements.length === 0) {
    return group;
  }

  const geometry = new THREE.SphereGeometry(RESOURCE_SPHERE_RADIUS, RESOURCE_SPHERE_DETAIL, RESOURCE_SPHERE_DETAIL);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.setHex(p.color));
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  group.add(mesh);
  return group;
}

export function createStructureMarkers(chunkX: number, chunkY: number, data: ChunkData): THREE.Group {
  const group = new THREE.Group();
  const placements = buildStructureMarkerPlacements(chunkX, chunkY, data, {
    heightScale: TERRAIN_HEIGHT_SCALE,
  });

  if (placements.length === 0) {
    return group;
  }

  const boxPlacements = placements.filter(p => p.geometryKind === 'box');
  const cylinderPlacements = placements.filter(p => p.geometryKind === 'cylinder');

  if (boxPlacements.length > 0) {
    const boxMesh = createStructureInstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      boxPlacements,
    );
    group.add(boxMesh);
  }

  if (cylinderPlacements.length > 0) {
    const cylinderMesh = createStructureInstancedMesh(
      new THREE.CylinderGeometry(1, 1, 1, 8),
      cylinderPlacements,
    );
    group.add(cylinderMesh);
  }

  return group;
}

function createStructureInstancedMesh(
  baseGeometry: THREE.BufferGeometry,
  placements: StructureMarkerPlacementData[],
): THREE.InstancedMesh {
  const material = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(baseGeometry, material, placements.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.set(p.width, p.height, p.depth);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.setHex(p.color));
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  return mesh;
}

export function getResourceColor(type: string | number): number {
  return getResourceMarkerColor(type);
}

export function getStructureColor(type: string | number): number {
  return getStructureMarkerColor(type);
}
