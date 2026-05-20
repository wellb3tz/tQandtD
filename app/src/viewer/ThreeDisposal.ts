import * as THREE from 'three';

function isSharedResource(resource: { userData?: Record<string, unknown> }): boolean {
  return resource.userData?.sharedFoliageResource === true;
}

export function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach(item => {
      if (!isSharedResource(item)) {
        item.dispose();
      }
    });
    return;
  }

  if (isSharedResource(material)) return;
  material.dispose();
}

export function disposeMesh(mesh: THREE.Mesh | THREE.LineSegments): void {
  if (!isSharedResource(mesh.geometry)) {
    mesh.geometry.dispose();
  }
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
