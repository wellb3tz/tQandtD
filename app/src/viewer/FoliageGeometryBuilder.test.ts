import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { createFoliageInstancedMesh, createFoliagePrototypeGeometry, clearFoliageGeometryCache } from './FoliageGeometryBuilder';
import type { FoliagePlacement } from './FoliagePlacementPlanner';

afterEach(() => {
  clearFoliageGeometryCache();
});

describe('FoliageGeometryBuilder', () => {
  it('creates colored prototype geometry for every foliage kind', () => {
    for (const kind of ['spire', 'compact', 'broad', 'shrub', 'stump'] as const) {
      const geometry = createFoliagePrototypeGeometry(kind);
      const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
      const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
      const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;

      expect(positions.count).toBeGreaterThan(0);
      expect(colors.count).toBe(positions.count);
      expect(normals.count).toBe(positions.count);
      expect(geometry.index?.count).toBeGreaterThan(0);
    }
  });

  it('reuses cached geometry instances across calls', () => {
    const first = createFoliagePrototypeGeometry('spire');
    const second = createFoliagePrototypeGeometry('spire');
    expect(second).toBe(first);
  });

  it('keeps shrub geometry anchored low enough for shoreline placement checks', () => {
    const geometry = createFoliagePrototypeGeometry('shrub');
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    let minY = Infinity;

    for (let i = 0; i < positions.count; i++) {
      minY = Math.min(minY, positions.getY(i));
    }

    expect(minY).toBeCloseTo(-0.3);
  });

  it('creates instanced foliage meshes from placement transforms', () => {
    const geometry = createFoliagePrototypeGeometry('stump');
    const placements: FoliagePlacement[] = [
      { x: 2, y: 3, z: 4, radius: 0.5, height: 0.8, rotation: Math.PI / 2 },
    ];

    const mesh = createFoliageInstancedMesh(geometry, placements);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    mesh.getMatrixAt(0, matrix);
    matrix.decompose(position, quaternion, scale);

    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBe(1);
    expect(position.toArray()).toEqual([2, 3, 4]);
    expect(scale.x).toBeGreaterThan(0.43);
    expect(scale.x).toBeLessThan(0.57);
    expect(scale.y).toBeCloseTo(0.8);
    expect(scale.z).toBeGreaterThan(0.44);
    expect(scale.z).toBeLessThan(0.56);
    expect(mesh.instanceColor).toBeDefined();
    expect(mesh.boundingBox).not.toBeNull();
    expect(mesh.boundingSphere).not.toBeNull();
    expect((mesh.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
  });
});
