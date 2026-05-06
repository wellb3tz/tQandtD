import * as THREE from 'three';
import { type ChunkData, ResourceType, StructureType } from '../../../src/index';

const TERRAIN_HEIGHT_SCALE = 50;

export function createResourceMarkers(chunkX: number, chunkY: number, data: ChunkData): THREE.Group {
  const group = new THREE.Group();
  const resources = data.resources ?? [];
  if (resources.length === 0) return group;

  for (const resource of resources) {
    const worldX = chunkX * data.size + resource.x;
    const worldZ = chunkY * data.size + resource.y;
    const height = getMarkerTerrainHeight(data, resource.x, resource.y);
    const geometry = new THREE.SphereGeometry(0.5, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: getResourceColor(resource.type) });
    const marker = new THREE.Mesh(geometry, material);

    marker.position.set(worldX, height * TERRAIN_HEIGHT_SCALE + 1, worldZ);
    group.add(marker);
  }

  return group;
}

export function createStructureMarkers(chunkX: number, chunkY: number, data: ChunkData): THREE.Group {
  const group = new THREE.Group();
  const structures = data.structures ?? [];
  if (structures.length === 0) return group;

  for (const structure of structures) {
    const worldX = chunkX * data.size + structure.x;
    const worldZ = chunkY * data.size + structure.y;
    const height = getMarkerTerrainHeight(data, structure.x, structure.y);
    const typeNum = toNumericType(structure.type);
    const { geometry, markerHeight } = createStructureGeometry(typeNum);
    const material = new THREE.MeshLambertMaterial({ color: getStructureColor(typeNum) });
    const marker = new THREE.Mesh(geometry, material);

    marker.position.set(worldX, height * TERRAIN_HEIGHT_SCALE + markerHeight, worldZ);
    group.add(marker);
  }

  return group;
}

export function getResourceColor(type: string | number): number {
  const typeNum = toNumericType(type);
  const numericColors: Record<number, number> = {
    [ResourceType.IRON]: 0xc0c0c0,
    [ResourceType.GOLD]: 0xffd700,
    [ResourceType.COAL]: 0x000000,
    [ResourceType.STONE]: 0x808080,
    [ResourceType.WOOD]: 0x8b4513,
  };
  if (Number.isFinite(typeNum) && numericColors[typeNum] !== undefined) {
    return numericColors[typeNum];
  }

  const namedColors: Record<string, number> = {
    iron: 0xc0c0c0,
    gold: 0xffd700,
    coal: 0x000000,
    stone: 0x808080,
    wood: 0x8b4513,
  };
  return namedColors[String(type).toLowerCase()] ?? 0xff00ff;
}

export function getStructureColor(type: string | number): number {
  const typeNum = toNumericType(type);
  const colors: Record<number, number> = {
    [StructureType.VILLAGE]: 0x8b4513,
    [StructureType.RUINS]: 0x708090,
    [StructureType.TOWER]: 0xdaa520,
  };

  return colors[typeNum] ?? 0xff00ff;
}

function createStructureGeometry(typeNum: number): { geometry: THREE.BufferGeometry; markerHeight: number } {
  switch (typeNum) {
    case StructureType.VILLAGE:
      return { geometry: new THREE.BoxGeometry(3, 2, 3), markerHeight: 1 };
    case StructureType.RUINS:
      return { geometry: new THREE.CylinderGeometry(1.5, 1.5, 2.5, 8), markerHeight: 1.25 };
    case StructureType.TOWER:
      return { geometry: new THREE.BoxGeometry(1.5, 5, 1.5), markerHeight: 2.5 };
    default:
      return { geometry: new THREE.BoxGeometry(2, 3, 2), markerHeight: 1.5 };
  }
}

function getMarkerTerrainHeight(data: ChunkData, x: number, y: number): number {
  const verticesPerSide = data.size + 1;
  return data.heightmap?.[y * verticesPerSide + x] ?? 0;
}

function toNumericType(type: string | number): number {
  return typeof type === 'string' ? Number.parseInt(type, 10) : type;
}
