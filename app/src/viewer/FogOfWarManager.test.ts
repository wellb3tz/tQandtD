import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FogOfWarManager } from './FogOfWarManager';

describe('FogOfWarManager', () => {
  it('creates fog planes at chunk centers using average terrain height', () => {
    const manager = new FogOfWarManager();
    const scene = new THREE.Scene();
    const terrain = createTerrain([0, 2, 4, 6]);

    manager.createFogPlane(2, 3, terrain, scene);

    const plane = scene.children[0] as THREE.Mesh;
    expect(manager.size).toBe(1);
    expect(plane).toBeInstanceOf(THREE.Mesh);
    expect(plane.position.x).toBe(2.5);
    expect(plane.position.y).toBe(3);
    expect(plane.position.z).toBe(3.5);
    expect((plane.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.3);
  });

  it('replaces existing fog planes for the same chunk', () => {
    const manager = new FogOfWarManager();
    const scene = new THREE.Scene();

    manager.createFogPlane(0, 0, createTerrain([0, 0, 0, 0]), scene);
    manager.createFogPlane(0, 0, createTerrain([1, 1, 1, 1]), scene);

    expect(manager.size).toBe(1);
    expect(scene.children).toHaveLength(1);
    expect(scene.children[0].position.y).toBe(1);
  });

  it('toggles visibility and clears fog planes', () => {
    const manager = new FogOfWarManager();
    const scene = new THREE.Scene();
    manager.createFogPlane(0, 0, createTerrain([0, 0, 0, 0]), scene);

    manager.setVisible(false);
    expect(scene.children[0].visible).toBe(false);

    manager.clear(scene);
    expect(manager.size).toBe(0);
    expect(scene.children).toHaveLength(0);
  });
});

function createTerrain(heights: number[]): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, heights[0], 0,
    1, heights[1], 0,
    0, heights[2], 1,
    1, heights[3], 1,
  ]), 3));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
}
