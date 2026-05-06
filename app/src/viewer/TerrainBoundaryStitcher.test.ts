import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ChunkData } from '@engine/index';
import {
  stitchBoundaryColors,
  stitchBoundaryDetailBlends,
  stitchBoundaryNormals,
  stitchBoundarySurfaceBlends,
  stitchLakeBoundaryPositions,
  type StitchableChunkMesh,
} from './TerrainBoundaryStitcher';

describe('TerrainBoundaryStitcher', () => {
  it('averages boundary normals, colors, surface blends, and detail blends', () => {
    const chunks = new Map<string, StitchableChunkMesh>([
      ['0,0', createChunk(1, [0, 0, 0, 0], [1, 0, 0])],
      ['1,0', createChunk(1, [0, 0, 0, 0], [0, 0, 1])],
    ]);

    stitchBoundaryNormals(chunks, 0, 0);
    stitchBoundaryColors(chunks, 0, 0);
    stitchBoundarySurfaceBlends(chunks, 0, 0);
    stitchBoundaryDetailBlends(chunks, 0, 0);

    const left = chunks.get('0,0')!.terrain.geometry as THREE.BufferGeometry;
    const right = chunks.get('1,0')!.terrain.geometry as THREE.BufferGeometry;
    const leftColor = left.getAttribute('color') as THREE.BufferAttribute;
    const rightColor = right.getAttribute('color') as THREE.BufferAttribute;
    const leftNormal = left.getAttribute('normal') as THREE.BufferAttribute;
    const rightNormal = right.getAttribute('normal') as THREE.BufferAttribute;
    const leftSurfaceA = left.getAttribute('surfaceBlendA') as THREE.BufferAttribute;
    const rightSurfaceA = right.getAttribute('surfaceBlendA') as THREE.BufferAttribute;
    const leftDetail = left.getAttribute('terrainDetailBlend') as THREE.BufferAttribute;
    const rightDetail = right.getAttribute('terrainDetailBlend') as THREE.BufferAttribute;

    expect(leftColor.getX(1)).toBeCloseTo(rightColor.getX(0));
    expect(leftColor.getZ(1)).toBeCloseTo(rightColor.getZ(0));
    expect(leftNormal.getX(1)).toBeCloseTo(rightNormal.getX(0));
    expect(leftSurfaceA.getX(1)).toBeCloseTo(rightSurfaceA.getX(0));
    expect(leftDetail.getW(1)).toBeCloseTo(rightDetail.getW(0));
  });

  it('stitches lake boundary position heights to the lower shared value', () => {
    const leftData = createChunkData(1);
    const rightData = createChunkData(1);
    leftData.lakes = [{ id: 'lake', tiles: new Set([0]), surfaceLevel: 0.2, centerX: 0, centerY: 0, radius: 1 } as any];
    const chunks = new Map<string, StitchableChunkMesh>([
      ['0,0', createChunk(1, [0, 3, 0, 3], [1, 1, 1], leftData)],
      ['1,0', createChunk(1, [1, 1, 1, 1], [1, 1, 1], rightData)],
    ]);

    stitchLakeBoundaryPositions(chunks, 0, 0);

    const left = chunks.get('0,0')!.terrain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const right = chunks.get('1,0')!.terrain.geometry.getAttribute('position') as THREE.BufferAttribute;

    expect(left.getY(1)).toBe(1);
    expect(right.getY(0)).toBe(1);
  });
});

function createChunk(
  size: number,
  heights: number[],
  color: [number, number, number],
  data: ChunkData = createChunkData(size),
): StitchableChunkMesh {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    0, heights[0], 0,
    1, heights[1], 0,
    0, heights[2], 1,
    1, heights[3], 1,
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([
    0, 1, 0,
    1, 0, 0,
    0, 1, 0,
    1, 0, 0,
  ]), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([
    ...color,
    ...color,
    ...color,
    ...color,
  ]), 3));
  geometry.setAttribute('surfaceBlendA', new THREE.BufferAttribute(new Float32Array([
    1, 0, 0, 0,
    1, 0, 0, 0,
    1, 0, 0, 0,
    1, 0, 0, 0,
  ]), 4));
  geometry.setAttribute('surfaceBlendB', new THREE.BufferAttribute(new Float32Array(16), 4));
  geometry.setAttribute('surfaceBlendC', new THREE.BufferAttribute(new Float32Array(16), 4));
  geometry.setAttribute('terrainDetailBlend', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0, 1,
    0, 0, 0, 1,
    0, 0, 0, 1,
    0, 0, 0, 1,
  ]), 4));

  const terrain = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  terrain.userData.chunkData = data;
  return { terrain };
}

function createChunkData(size: number): ChunkData {
  return {
    size,
    heightmap: new Float32Array((size + 1) * (size + 1)),
    biomeMap: new Uint8Array(size * size),
    resources: [],
    structures: [],
  } as unknown as ChunkData;
}
