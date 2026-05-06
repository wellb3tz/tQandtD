import * as THREE from 'three';

export interface RenderStats {
  vertexCount: number;
  drawCalls: number;
}

export interface RenderStatsChunk {
  terrain: THREE.Mesh;
  foliage?: THREE.Group;
  resources?: THREE.Group;
  structures?: THREE.Group;
  boundaries?: THREE.LineSegments;
}

export function calculateRenderStats(chunks: Iterable<RenderStatsChunk>): RenderStats {
  let vertexCount = 0;
  let drawCalls = 0;

  for (const chunk of chunks) {
    if (chunk.terrain.visible) {
      const position = chunk.terrain.geometry.getAttribute('position');
      if (position) {
        vertexCount += position.count;
      }
      drawCalls++;
    }

    if (chunk.foliage?.visible) {
      drawCalls += chunk.foliage.children.length;
    }

    if (chunk.resources?.visible) {
      drawCalls += chunk.resources.children.length;
    }

    if (chunk.structures?.visible) {
      drawCalls += chunk.structures.children.length;
    }

    if (chunk.boundaries?.visible) {
      drawCalls++;
    }
  }

  return { vertexCount, drawCalls };
}

export function calculateMicroBiomeCount(chunks: Iterable<RenderStatsChunk>): number {
  let totalCount = 0;

  for (const chunk of chunks) {
    const count = chunk.terrain.userData.microBiomeCount;
    if (count !== undefined) {
      totalCount += count;
    }
  }

  return totalCount;
}
