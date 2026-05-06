import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeGroup, disposeMaterial, disposeMesh } from './ThreeDisposal';

describe('ThreeDisposal', () => {
  it('disposes single and array materials', () => {
    const first = new THREE.MeshBasicMaterial();
    const second = new THREE.MeshBasicMaterial();
    first.dispose = vi.fn();
    second.dispose = vi.fn();

    disposeMaterial(first);
    disposeMaterial([second]);

    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).toHaveBeenCalledOnce();
  });

  it('disposes mesh geometry and material', () => {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    geometry.dispose = vi.fn();
    material.dispose = vi.fn();

    disposeMesh(mesh);

    expect(geometry.dispose).toHaveBeenCalledOnce();
    expect(material.dispose).toHaveBeenCalledOnce();
  });

  it('disposes meshes and line segments inside a group', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    const line = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
    mesh.geometry.dispose = vi.fn();
    (mesh.material as THREE.Material).dispose = vi.fn();
    line.geometry.dispose = vi.fn();
    (line.material as THREE.Material).dispose = vi.fn();
    group.add(mesh, line);

    disposeGroup(group);

    expect(mesh.geometry.dispose).toHaveBeenCalledOnce();
    expect((mesh.material as THREE.Material).dispose).toHaveBeenCalledOnce();
    expect(line.geometry.dispose).toHaveBeenCalledOnce();
    expect((line.material as THREE.Material).dispose).toHaveBeenCalledOnce();
  });
});
