import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { calculateMicroBiomeCount, calculateRenderStats, type RenderStatsChunk } from './RenderStatsCalculator';

describe('RenderStatsCalculator', () => {
  it('counts visible terrain vertices and layer draw calls', () => {
    const chunk = createChunk();
    chunk.foliage = new THREE.Group();
    chunk.foliage.add(new THREE.Mesh(), new THREE.Mesh());
    chunk.resources = new THREE.Group();
    chunk.resources.add(new THREE.Mesh());
    chunk.structures = new THREE.Group();
    chunk.structures.visible = false;
    chunk.structures.add(new THREE.Mesh());
    chunk.boundaries = new THREE.LineSegments();

    const stats = calculateRenderStats([chunk]);

    expect(stats.vertexCount).toBe(4);
    expect(stats.drawCalls).toBe(5);
  });

  it('ignores hidden terrain vertices and hidden layer draw calls', () => {
    const chunk = createChunk();
    chunk.terrain.visible = false;
    chunk.resources = new THREE.Group();
    chunk.resources.visible = false;
    chunk.resources.add(new THREE.Mesh());

    expect(calculateRenderStats([chunk])).toEqual({ vertexCount: 0, drawCalls: 0 });
  });

  it('sums micro-biome counts stored on terrain user data', () => {
    const first = createChunk();
    const second = createChunk();
    first.terrain.userData.microBiomeCount = 2;
    second.terrain.userData.microBiomeCount = 3;

    expect(calculateMicroBiomeCount([first, second])).toBe(5);
  });
});

function createChunk(): RenderStatsChunk {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  return {
    terrain: new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()),
  };
}
