import {
  ResourceType,
  StructureType,
  type ChunkData,
} from '../world/chunk';

export interface ChunkBoundaryLineData {
  positions: number[];
}

export interface MarkerPlacementData {
  x: number;
  y: number;
  z: number;
  color: number;
}

export type StructureMarkerGeometryKind = 'box' | 'cylinder';

export interface StructureMarkerPlacementData extends MarkerPlacementData {
  geometryKind: StructureMarkerGeometryKind;
  width: number;
  height: number;
  depth: number;
  radialSegments?: number;
}

export interface ChunkOverlayOptions {
  heightScale: number;
  horizontalScale?: number;
}

export function buildChunkBoundaryLineData(
  chunkX: number,
  chunkY: number,
  data: ChunkData,
  options: ChunkOverlayOptions,
): ChunkBoundaryLineData {
  const chunkSize = data.size;
  const horizontalScale = options.horizontalScale ?? 1;
  const verticesPerSide = chunkSize + 1;
  const worldX = chunkX * chunkSize * horizontalScale;
  const worldZ = chunkY * chunkSize * horizontalScale;
  const scaledChunkSize = chunkSize * horizontalScale;
  const topLeft = data.heightmap[0] ?? 0;
  const topRight = data.heightmap[chunkSize] ?? topLeft;
  const bottomLeft = data.heightmap[chunkSize * verticesPerSide] ?? topLeft;

  return {
    positions: [
      worldX, topLeft * options.heightScale, worldZ,
      worldX + scaledChunkSize, topRight * options.heightScale, worldZ,
      worldX, topLeft * options.heightScale, worldZ,
      worldX, bottomLeft * options.heightScale, worldZ + scaledChunkSize,
    ],
  };
}

export function buildResourceMarkerPlacements(
  chunkX: number,
  chunkY: number,
  data: ChunkData,
  options: ChunkOverlayOptions,
): MarkerPlacementData[] {
  const resources = data.resources ?? [];
  if (resources.length === 0) return [];

  return resources.map(resource => {
    const horizontalScale = options.horizontalScale ?? 1;
    const worldX = (chunkX * data.size + resource.x) * horizontalScale;
    const worldZ = (chunkY * data.size + resource.y) * horizontalScale;
    const height = getMarkerTerrainHeight(data, resource.x, resource.y);

    return {
      x: worldX,
      y: height * options.heightScale + 1,
      z: worldZ,
      color: getResourceMarkerColor(resource.type),
    };
  });
}

export function buildStructureMarkerPlacements(
  chunkX: number,
  chunkY: number,
  data: ChunkData,
  options: ChunkOverlayOptions,
): StructureMarkerPlacementData[] {
  const structures = data.structures ?? [];
  if (structures.length === 0) return [];

  return structures.map(structure => {
    const horizontalScale = options.horizontalScale ?? 1;
    const worldX = (chunkX * data.size + structure.x) * horizontalScale;
    const worldZ = (chunkY * data.size + structure.y) * horizontalScale;
    const height = getMarkerTerrainHeight(data, structure.x, structure.y);
    const typeNum = toNumericType(structure.type);
    const geometry = getStructureMarkerGeometry(typeNum);

    return {
      x: worldX,
      y: height * options.heightScale + geometry.markerHeight,
      z: worldZ,
      color: getStructureMarkerColor(typeNum),
      ...geometry,
    };
  });
}

export function getResourceMarkerColor(type: string | number): number {
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

export function getStructureMarkerColor(type: string | number): number {
  const typeNum = toNumericType(type);
  const colors: Record<number, number> = {
    [StructureType.VILLAGE]: 0x8b4513,
    [StructureType.RUINS]: 0x708090,
    [StructureType.TOWER]: 0xdaa520,
  };

  return colors[typeNum] ?? 0xff00ff;
}

function getStructureMarkerGeometry(typeNum: number): Omit<StructureMarkerPlacementData, keyof MarkerPlacementData> & {
  markerHeight: number;
} {
  switch (typeNum) {
    case StructureType.VILLAGE:
      return { geometryKind: 'box', width: 3, height: 2, depth: 3, markerHeight: 1 };
    case StructureType.RUINS:
      return { geometryKind: 'cylinder', width: 1.5, height: 2.5, depth: 1.5, radialSegments: 8, markerHeight: 1.25 };
    case StructureType.TOWER:
      return { geometryKind: 'box', width: 1.5, height: 5, depth: 1.5, markerHeight: 2.5 };
    default:
      return { geometryKind: 'box', width: 2, height: 3, depth: 2, markerHeight: 1.5 };
  }
}

function getMarkerTerrainHeight(data: ChunkData, x: number, y: number): number {
  const verticesPerSide = data.size + 1;
  return data.heightmap?.[y * verticesPerSide + x] ?? 0;
}

function toNumericType(type: string | number): number {
  return typeof type === 'string' ? Number.parseInt(type, 10) : type;
}
