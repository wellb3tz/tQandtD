import * as THREE from 'three';

export function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach(item => item.dispose());
    return;
  }

  material.dispose();
}

export function disposeMesh(mesh: THREE.Mesh | THREE.LineSegments): void {
  mesh.geometry.dispose();
  disposeMaterial(mesh.material);
  if (mesh instanceof THREE.InstancedMesh) {
    mesh.dispose();
  }
}

export function disposeGroup(group: THREE.Group): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      disposeMesh(object);
    }
  });
}
