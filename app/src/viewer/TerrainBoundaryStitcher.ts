import * as THREE from 'three';
import type { ChunkData } from '@engine/index';

export interface StitchableChunkMesh {
  terrain: THREE.Mesh;
}

type ChunkMeshMap = Map<string, StitchableChunkMesh>;

const NEIGHBOURS: Array<{ dx: number; dz: number }> = [
  { dx: 1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: 1, dz: 1 },
];

export function stitchLakeBoundaryPositions(chunkMeshes: ChunkMeshMap, chunkX: number, chunkY: number): void {
  const mesh = chunkMeshes.get(getChunkKey(chunkX, chunkY));
  if (!mesh) return;

  const dataA = mesh.terrain.userData.chunkData as ChunkData | undefined;
  if (!dataA) return;

  const geomA = mesh.terrain.geometry as THREE.BufferGeometry;
  const posA = geomA.getAttribute('position') as THREE.BufferAttribute;
  const verticesPerSide = Math.round(Math.sqrt(posA.count));
  const chunkSize = verticesPerSide - 1;
  let changedA = false;

  for (const { dx, dz } of NEIGHBOURS) {
    const neighbourMesh = chunkMeshes.get(getChunkKey(chunkX + dx, chunkY + dz));
    if (!neighbourMesh) continue;

    const dataB = neighbourMesh.terrain.userData.chunkData as ChunkData | undefined;
    if (!dataB) continue;

    const geomB = neighbourMesh.terrain.geometry as THREE.BufferGeometry;
    const posB = geomB.getAttribute('position') as THREE.BufferAttribute;
    let changedB = false;

    if (dx === 1 && dz === 0) {
      for (let row = 0; row <= chunkSize; row++) {
        const idxA = row * verticesPerSide + chunkSize;
        const idxB = row * verticesPerSide;
        const touchesLake =
          vertexTouchesLake(dataA, chunkSize, row) ||
          vertexTouchesLake(dataB, 0, row);
        if (!touchesLake && !isLikelyLakeBoundaryHeightGap(posA, idxA, posB, idxB)) continue;

        const changed = stitchVertexHeightIfDifferent(posA, idxA, posB, idxB);
        changedA ||= changed;
        changedB ||= changed;
      }
    } else if (dx === 0 && dz === 1) {
      for (let col = 0; col <= chunkSize; col++) {
        const idxA = chunkSize * verticesPerSide + col;
        const idxB = col;
        const touchesLake =
          vertexTouchesLake(dataA, col, chunkSize) ||
          vertexTouchesLake(dataB, col, 0);
        if (!touchesLake && !isLikelyLakeBoundaryHeightGap(posA, idxA, posB, idxB)) continue;

        const changed = stitchVertexHeightIfDifferent(posA, idxA, posB, idxB);
        changedA ||= changed;
        changedB ||= changed;
      }
    } else {
      const touchesLake =
        vertexTouchesLake(dataA, chunkSize, chunkSize) ||
        vertexTouchesLake(dataB, 0, 0);
      const idxA = chunkSize * verticesPerSide + chunkSize;
      const idxB = 0;
      if (touchesLake || isLikelyLakeBoundaryHeightGap(posA, idxA, posB, idxB)) {
        const changed = stitchVertexHeightIfDifferent(posA, idxA, posB, idxB);
        changedA ||= changed;
        changedB ||= changed;
      }
    }

    if (changedB) {
      posB.needsUpdate = true;
      // NOTE: vertex normals and bounding volumes are intentionally NOT
      // recomputed here. Boundary normals are fixed by stitchBoundaryNormals,
      // and the bounding box computed at creation time is accurate enough
      // for frustum culling even after small lake-boundary height stitches.
    }
  }

  if (changedA) {
    posA.needsUpdate = true;
    // See note above — skip expensive computeVertexNormals / computeBoundingBox.
  }
}

export function stitchBoundaryNormals(chunkMeshes: ChunkMeshMap, chunkX: number, chunkY: number): void {
  const mesh = chunkMeshes.get(getChunkKey(chunkX, chunkY));
  if (!mesh) return;

  const geom = mesh.terrain.geometry as THREE.BufferGeometry;
  const normA = geom.getAttribute('normal') as THREE.BufferAttribute;
  const posA = geom.getAttribute('position') as THREE.BufferAttribute;
  const verticesPerSide = Math.round(Math.sqrt(posA.count));
  const chunkSize = verticesPerSide - 1;

  for (const { dx, dz } of NEIGHBOURS) {
    const neighbourMesh = chunkMeshes.get(getChunkKey(chunkX + dx, chunkY + dz));
    if (!neighbourMesh) continue;

    const geomB = neighbourMesh.terrain.geometry as THREE.BufferGeometry;
    const normB = geomB.getAttribute('normal') as THREE.BufferAttribute;

    if (dx === 1 && dz === 0) {
      for (let row = 0; row <= chunkSize; row++) {
        averageNormals(normA, row * verticesPerSide + chunkSize, normB, row * verticesPerSide);
      }
    } else if (dx === 0 && dz === 1) {
      for (let col = 0; col <= chunkSize; col++) {
        averageNormals(normA, chunkSize * verticesPerSide + col, normB, col);
      }
    } else {
      averageNormals(normA, chunkSize * verticesPerSide + chunkSize, normB, 0);
    }

    normB.needsUpdate = true;
  }

  normA.needsUpdate = true;
}

export function stitchBoundaryColors(chunkMeshes: ChunkMeshMap, chunkX: number, chunkY: number): void {
  const mesh = chunkMeshes.get(getChunkKey(chunkX, chunkY));
  if (!mesh) return;

  const geom = mesh.terrain.geometry as THREE.BufferGeometry;
  const colA = geom.getAttribute('color') as THREE.BufferAttribute;
  const posA = geom.getAttribute('position') as THREE.BufferAttribute;
  const verticesPerSide = Math.round(Math.sqrt(posA.count));
  const chunkSize = verticesPerSide - 1;

  for (const { dx, dz } of NEIGHBOURS) {
    const neighbourMesh = chunkMeshes.get(getChunkKey(chunkX + dx, chunkY + dz));
    if (!neighbourMesh) continue;

    const geomB = neighbourMesh.terrain.geometry as THREE.BufferGeometry;
    const colB = geomB.getAttribute('color') as THREE.BufferAttribute;

    if (dx === 1 && dz === 0) {
      for (let row = 0; row <= chunkSize; row++) {
        averageColors(colA, row * verticesPerSide + chunkSize, colB, row * verticesPerSide);
      }
    } else if (dx === 0 && dz === 1) {
      for (let col = 0; col <= chunkSize; col++) {
        averageColors(colA, chunkSize * verticesPerSide + col, colB, col);
      }
    } else {
      averageColors(colA, chunkSize * verticesPerSide + chunkSize, colB, 0);
    }

    colB.needsUpdate = true;
  }

  colA.needsUpdate = true;
}

export function stitchBoundarySurfaceBlends(chunkMeshes: ChunkMeshMap, chunkX: number, chunkY: number): void {
  const mesh = chunkMeshes.get(getChunkKey(chunkX, chunkY));
  if (!mesh) return;

  const geom = mesh.terrain.geometry as THREE.BufferGeometry;
  const blendAA = geom.getAttribute('surfaceBlendA') as THREE.BufferAttribute | undefined;
  const blendBA = geom.getAttribute('surfaceBlendB') as THREE.BufferAttribute | undefined;
  const blendCA = geom.getAttribute('surfaceBlendC') as THREE.BufferAttribute | undefined;
  const posA = geom.getAttribute('position') as THREE.BufferAttribute;

  if (!blendAA || !blendBA || !blendCA) return;

  const verticesPerSide = Math.round(Math.sqrt(posA.count));
  const chunkSize = verticesPerSide - 1;

  for (const { dx, dz } of NEIGHBOURS) {
    const neighbourMesh = chunkMeshes.get(getChunkKey(chunkX + dx, chunkY + dz));
    if (!neighbourMesh) continue;

    const geomB = neighbourMesh.terrain.geometry as THREE.BufferGeometry;
    const blendAB = geomB.getAttribute('surfaceBlendA') as THREE.BufferAttribute | undefined;
    const blendBB = geomB.getAttribute('surfaceBlendB') as THREE.BufferAttribute | undefined;
    const blendCB = geomB.getAttribute('surfaceBlendC') as THREE.BufferAttribute | undefined;

    if (!blendAB || !blendBB || !blendCB) continue;

    if (dx === 1 && dz === 0) {
      for (let row = 0; row <= chunkSize; row++) {
        averageSurfaceBlend(
          blendAA, blendBA, blendCA, row * verticesPerSide + chunkSize,
          blendAB, blendBB, blendCB, row * verticesPerSide,
        );
      }
    } else if (dx === 0 && dz === 1) {
      for (let col = 0; col <= chunkSize; col++) {
        averageSurfaceBlend(
          blendAA, blendBA, blendCA, chunkSize * verticesPerSide + col,
          blendAB, blendBB, blendCB, col,
        );
      }
    } else {
      averageSurfaceBlend(
        blendAA, blendBA, blendCA, chunkSize * verticesPerSide + chunkSize,
        blendAB, blendBB, blendCB, 0,
      );
    }

    blendAB.needsUpdate = true;
    blendBB.needsUpdate = true;
    blendCB.needsUpdate = true;
  }

  blendAA.needsUpdate = true;
  blendBA.needsUpdate = true;
  blendCA.needsUpdate = true;
}

export function stitchBoundaryDetailBlends(chunkMeshes: ChunkMeshMap, chunkX: number, chunkY: number): void {
  const mesh = chunkMeshes.get(getChunkKey(chunkX, chunkY));
  if (!mesh) return;

  const geom = mesh.terrain.geometry as THREE.BufferGeometry;
  const detailA = geom.getAttribute('terrainDetailBlend') as THREE.BufferAttribute | undefined;
  const posA = geom.getAttribute('position') as THREE.BufferAttribute;

  if (!detailA) return;

  const verticesPerSide = Math.round(Math.sqrt(posA.count));
  const chunkSize = verticesPerSide - 1;

  for (const { dx, dz } of NEIGHBOURS) {
    const neighbourMesh = chunkMeshes.get(getChunkKey(chunkX + dx, chunkY + dz));
    if (!neighbourMesh) continue;

    const geomB = neighbourMesh.terrain.geometry as THREE.BufferGeometry;
    const detailB = geomB.getAttribute('terrainDetailBlend') as THREE.BufferAttribute | undefined;

    if (!detailB) continue;

    if (dx === 1 && dz === 0) {
      for (let row = 0; row <= chunkSize; row++) {
        averageDetailBlend(detailA, row * verticesPerSide + chunkSize, detailB, row * verticesPerSide);
      }
    } else if (dx === 0 && dz === 1) {
      for (let col = 0; col <= chunkSize; col++) {
        averageDetailBlend(detailA, chunkSize * verticesPerSide + col, detailB, col);
      }
    } else {
      averageDetailBlend(detailA, chunkSize * verticesPerSide + chunkSize, detailB, 0);
    }

    detailB.needsUpdate = true;
  }

  detailA.needsUpdate = true;
}

function vertexTouchesLake(data: ChunkData, vx: number, vy: number): boolean {
  const size = data.size;
  const lakes = data.lakes ?? [];
  if (lakes.length === 0) return false;

  for (const lake of lakes) {
    if (
      lakeHasTile(lake.tiles, vx, vy, size) ||
      lakeHasTile(lake.tiles, vx - 1, vy, size) ||
      lakeHasTile(lake.tiles, vx, vy - 1, size) ||
      lakeHasTile(lake.tiles, vx - 1, vy - 1, size)
    ) {
      return true;
    }
  }

  return false;
}

function lakeHasTile(tiles: Set<number>, tx: number, ty: number, size: number): boolean {
  return tx >= 0 && ty >= 0 && tx < size && ty < size && tiles.has(ty * size + tx);
}

function isLikelyLakeBoundaryHeightGap(
  posA: THREE.BufferAttribute,
  idxA: number,
  posB: THREE.BufferAttribute,
  idxB: number,
): boolean {
  return Math.abs(posA.getY(idxA) - posB.getY(idxB)) > 0.25;
}

function stitchVertexHeightIfDifferent(
  posA: THREE.BufferAttribute,
  idxA: number,
  posB: THREE.BufferAttribute,
  idxB: number,
): boolean {
  const sharedY = Math.min(posA.getY(idxA), posB.getY(idxB));
  const changed = posA.getY(idxA) !== sharedY || posB.getY(idxB) !== sharedY;
  if (changed) {
    posA.setY(idxA, sharedY);
    posB.setY(idxB, sharedY);
  }
  return changed;
}

function averageNormals(
  normA: THREE.BufferAttribute,
  idxA: number,
  normB: THREE.BufferAttribute,
  idxB: number,
): void {
  const ax = normA.getX(idxA), ay = normA.getY(idxA), az = normA.getZ(idxA);
  const bx = normB.getX(idxB), by = normB.getY(idxB), bz = normB.getZ(idxB);
  let nx = ax + bx, ny = ay + by, nz = az + bz;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len > 0) { nx /= len; ny /= len; nz /= len; }
  normA.setXYZ(idxA, nx, ny, nz);
  normB.setXYZ(idxB, nx, ny, nz);
}

function averageColors(
  colA: THREE.BufferAttribute,
  idxA: number,
  colB: THREE.BufferAttribute,
  idxB: number,
): void {
  const r = (colA.getX(idxA) + colB.getX(idxB)) * 0.5;
  const g = (colA.getY(idxA) + colB.getY(idxB)) * 0.5;
  const b = (colA.getZ(idxA) + colB.getZ(idxB)) * 0.5;
  colA.setXYZ(idxA, r, g, b);
  colB.setXYZ(idxB, r, g, b);
}

function averageSurfaceBlend(
  blendAA: THREE.BufferAttribute,
  blendBA: THREE.BufferAttribute,
  blendCA: THREE.BufferAttribute,
  idxA: number,
  blendAB: THREE.BufferAttribute,
  blendBB: THREE.BufferAttribute,
  blendCB: THREE.BufferAttribute,
  idxB: number,
): void {
  const weights = [
    (blendAA.getX(idxA) + blendAB.getX(idxB)) * 0.5,
    (blendAA.getY(idxA) + blendAB.getY(idxB)) * 0.5,
    (blendAA.getZ(idxA) + blendAB.getZ(idxB)) * 0.5,
    (blendAA.getW(idxA) + blendAB.getW(idxB)) * 0.5,
    (blendBA.getX(idxA) + blendBB.getX(idxB)) * 0.5,
    (blendBA.getY(idxA) + blendBB.getY(idxB)) * 0.5,
    (blendBA.getZ(idxA) + blendBB.getZ(idxB)) * 0.5,
    (blendBA.getW(idxA) + blendBB.getW(idxB)) * 0.5,
    (blendCA.getX(idxA) + blendCB.getX(idxB)) * 0.5,
    (blendCA.getY(idxA) + blendCB.getY(idxB)) * 0.5,
    (blendCA.getZ(idxA) + blendCB.getZ(idxB)) * 0.5,
  ];
  const sum = weights.reduce((total, weight) => total + weight, 0) || 1;

  blendAA.setXYZW(idxA, weights[0] / sum, weights[1] / sum, weights[2] / sum, weights[3] / sum);
  blendBA.setXYZW(idxA, weights[4] / sum, weights[5] / sum, weights[6] / sum, weights[7] / sum);
  blendCA.setXYZW(idxA, weights[8] / sum, weights[9] / sum, weights[10] / sum, 0);
  blendAB.setXYZW(idxB, weights[0] / sum, weights[1] / sum, weights[2] / sum, weights[3] / sum);
  blendBB.setXYZW(idxB, weights[4] / sum, weights[5] / sum, weights[6] / sum, weights[7] / sum);
  blendCB.setXYZW(idxB, weights[8] / sum, weights[9] / sum, weights[10] / sum, 0);
}

function averageDetailBlend(
  detailA: THREE.BufferAttribute,
  idxA: number,
  detailB: THREE.BufferAttribute,
  idxB: number,
): void {
  const x = (detailA.getX(idxA) + detailB.getX(idxB)) * 0.5;
  const y = (detailA.getY(idxA) + detailB.getY(idxB)) * 0.5;
  const z = (detailA.getZ(idxA) + detailB.getZ(idxB)) * 0.5;
  const w = (detailA.getW(idxA) + detailB.getW(idxB)) * 0.5;
  detailA.setXYZW(idxA, x, y, z, w);
  detailB.setXYZW(idxB, x, y, z, w);
}

function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}
