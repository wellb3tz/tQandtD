export interface IndexedGeometryData {
  positions: number[];
  normals: number[];
  colors: number[];
  uvs: number[];
  indices: number[];
}

export function createIndexedGeometryData(): IndexedGeometryData {
  return {
    positions: [],
    normals: [],
    colors: [],
    uvs: [],
    indices: [],
  };
}

export function getIndexedGeometryVertexCount(data: IndexedGeometryData): number {
  return data.positions.length / 3;
}
