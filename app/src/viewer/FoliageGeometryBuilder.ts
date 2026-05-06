import * as THREE from 'three';
import type { FoliagePlacement } from './FoliagePlacementPlanner';

export type FoliagePrototypeKind = 'spire' | 'compact' | 'broad' | 'shrub' | 'stump';

export function createFoliageInstancedMesh(
  geometry: THREE.BufferGeometry,
  placements: FoliagePlacement[],
): THREE.InstancedMesh {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Euler();

  placements.forEach((placement, index) => {
    position.set(placement.x, placement.y, placement.z);
    rotation.set(0, placement.rotation, 0);
    quaternion.setFromEuler(rotation);
    scale.set(placement.radius, placement.height, placement.radius);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function createFoliagePrototypeGeometry(kind: FoliagePrototypeKind): THREE.BufferGeometry {
  switch (kind) {
    case 'spire':
      return buildGeometry([
        ['prism', 0.12, -0.50, -0.10, 6, new THREE.Color(0.42, 0.24, 0.10)],
        ['cone', 0.58, -0.30, 0.28, 8, new THREE.Color(0.10, 0.34, 0.12)],
        ['cone', 0.45, 0.02, 0.58, 8, new THREE.Color(0.08, 0.40, 0.14)],
        ['cone', 0.30, 0.32, 0.90, 8, new THREE.Color(0.12, 0.48, 0.18)],
      ]);
    case 'compact':
      return buildGeometry([
        ['prism', 0.14, -0.50, -0.02, 6, new THREE.Color(0.40, 0.22, 0.10)],
        ['cone', 0.64, -0.22, 0.26, 8, new THREE.Color(0.11, 0.36, 0.13)],
        ['cone', 0.48, 0.02, 0.50, 8, new THREE.Color(0.10, 0.43, 0.16)],
        ['cone', 0.30, 0.22, 0.72, 8, new THREE.Color(0.15, 0.50, 0.20)],
      ]);
    case 'broad':
      return buildGeometry([
        ['prism', 0.16, -0.50, 0.10, 7, new THREE.Color(0.43, 0.25, 0.12)],
        ['cone', 0.76, -0.04, 0.38, 9, new THREE.Color(0.13, 0.38, 0.13)],
        ['cone', 0.62, 0.12, 0.58, 9, new THREE.Color(0.14, 0.48, 0.17)],
        ['cone', 0.42, 0.28, 0.78, 9, new THREE.Color(0.20, 0.56, 0.22)],
      ]);
    case 'shrub':
      return buildGeometry([
        ['cone', 0.54, -0.30, 0.18, 7, new THREE.Color(0.20, 0.43, 0.16)],
        ['cone', 0.42, -0.12, 0.34, 7, new THREE.Color(0.26, 0.52, 0.20)],
        ['cone', 0.24, 0.08, 0.46, 7, new THREE.Color(0.34, 0.58, 0.24)],
      ]);
    case 'stump':
      return buildGeometry([
        ['prism', 0.34, -0.50, 0.36, 7, new THREE.Color(0.40, 0.24, 0.12)],
        ['cone', 0.28, 0.28, 0.42, 7, new THREE.Color(0.55, 0.34, 0.17)],
      ]);
  }
}

type LayerSpec =
  | ['prism', number, number, number, number, THREE.Color]
  | ['cone', number, number, number, number, THREE.Color];

function buildGeometry(layers: LayerSpec[]): THREE.BufferGeometry {
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (const [shape, radius, yBase, yTop, sides, color] of layers) {
    if (shape === 'prism') {
      addPrism(vertices, colors, indices, radius, yBase, yTop, sides, color);
    } else {
      addConeLayer(vertices, colors, indices, radius, yBase, yTop, sides, color);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addPrism(
  vertices: number[],
  colors: number[],
  indices: number[],
  radius: number,
  yBottom: number,
  yTop: number,
  sides: number,
  color: THREE.Color,
): void {
  for (let side = 0; side < sides; side++) {
    const a0 = (side / sides) * Math.PI * 2;
    const a1 = ((side + 1) / sides) * Math.PI * 2;
    const baseIndex = vertices.length / 3;
    vertices.push(
      Math.cos(a0) * radius, yBottom, Math.sin(a0) * radius,
      Math.cos(a1) * radius, yBottom, Math.sin(a1) * radius,
      Math.cos(a1) * radius * 0.82, yTop, Math.sin(a1) * radius * 0.82,
      Math.cos(a0) * radius * 0.82, yTop, Math.sin(a0) * radius * 0.82,
    );
    for (let i = 0; i < 4; i++) {
      colors.push(color.r, color.g, color.b);
    }
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
  }
}

function addConeLayer(
  vertices: number[],
  colors: number[],
  indices: number[],
  radius: number,
  yBase: number,
  yTip: number,
  sides: number,
  color: THREE.Color,
): void {
  for (let side = 0; side < sides; side++) {
    const a0 = (side / sides) * Math.PI * 2;
    const a1 = ((side + 1) / sides) * Math.PI * 2;
    const baseIndex = vertices.length / 3;
    vertices.push(
      Math.cos(a0) * radius, yBase, Math.sin(a0) * radius,
      Math.cos(a1) * radius, yBase, Math.sin(a1) * radius,
      0, yTip, 0,
    );
    for (let i = 0; i < 3; i++) {
      colors.push(color.r, color.g, color.b);
    }
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
  }
}
