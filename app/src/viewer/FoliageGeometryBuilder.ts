import * as THREE from 'three';
import type { FoliagePlacement } from './FoliagePlacementPlanner';

export type FoliagePrototypeKind = 'spire' | 'compact' | 'broad' | 'shrub' | 'stump';
export type FoliagePrototypeDetail = 'full' | 'simple';

const prototypeGeometryCache = new Map<string, THREE.BufferGeometry>();

const defaultFoliageMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.75, metalness: 0.0 });
defaultFoliageMaterial.userData.sharedFoliageResource = true;

export function createFoliageInstancedMesh(
  geometry: THREE.BufferGeometry,
  placements: FoliagePlacement[],
  material: THREE.Material = defaultFoliageMaterial,
): THREE.InstancedMesh {
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
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}

export function createFoliagePrototypeGeometry(
  kind: FoliagePrototypeKind,
  detail: FoliagePrototypeDetail = 'full',
): THREE.BufferGeometry {
  const cacheKey = `${kind}:${detail}`;
  const cached = prototypeGeometryCache.get(cacheKey);
  if (cached) return cached;

  let geometry: THREE.BufferGeometry;
  if (detail === 'simple') {
    geometry = createSimpleFoliagePrototypeGeometry(kind);
    prototypeGeometryCache.set(cacheKey, geometry);
    geometry.userData.sharedFoliageResource = true;
    return geometry;
  }

  switch (kind) {
    case 'spire':
      geometry = buildGeometry([
        ['prism', 0.12, -0.50, -0.10, 6, new THREE.Color(0.42, 0.24, 0.10)],
        ['cone', 0.58, -0.30, 0.28, 8, new THREE.Color(0.18, 0.48, 0.20)],
        ['cone', 0.45, 0.02, 0.58, 8, new THREE.Color(0.14, 0.52, 0.22)],
        ['cone', 0.30, 0.32, 0.90, 8, new THREE.Color(0.20, 0.58, 0.28)],
      ]);
      break;
    case 'compact':
      geometry = buildGeometry([
        ['prism', 0.14, -0.50, -0.02, 6, new THREE.Color(0.40, 0.22, 0.10)],
        ['cone', 0.64, -0.22, 0.26, 8, new THREE.Color(0.18, 0.50, 0.22)],
        ['cone', 0.48, 0.02, 0.50, 8, new THREE.Color(0.16, 0.56, 0.26)],
        ['cone', 0.30, 0.22, 0.72, 8, new THREE.Color(0.22, 0.60, 0.30)],
      ]);
      break;
    case 'broad':
      geometry = buildGeometry([
        ['prism', 0.16, -0.50, 0.10, 7, new THREE.Color(0.43, 0.25, 0.12)],
        ['cone', 0.76, -0.04, 0.38, 9, new THREE.Color(0.20, 0.52, 0.22)],
        ['cone', 0.62, 0.12, 0.58, 9, new THREE.Color(0.20, 0.58, 0.26)],
        ['cone', 0.42, 0.28, 0.78, 9, new THREE.Color(0.28, 0.66, 0.34)],
      ]);
      break;
    case 'shrub':
      geometry = buildGeometry([
        ['cone', 0.54, -0.30, 0.18, 7, new THREE.Color(0.28, 0.56, 0.24)],
        ['cone', 0.42, -0.12, 0.34, 7, new THREE.Color(0.34, 0.62, 0.28)],
        ['cone', 0.24, 0.08, 0.46, 7, new THREE.Color(0.42, 0.68, 0.34)],
      ]);
      break;
    case 'stump':
      geometry = buildGeometry([
        ['prism', 0.34, -0.50, 0.36, 7, new THREE.Color(0.40, 0.24, 0.12)],
        ['cone', 0.28, 0.28, 0.42, 7, new THREE.Color(0.60, 0.40, 0.20)],
      ]);
      break;
  }

  prototypeGeometryCache.set(cacheKey, geometry);
  geometry.userData.sharedFoliageResource = true;
  return geometry;
}

export function clearFoliageGeometryCache(): void {
  for (const geometry of prototypeGeometryCache.values()) {
    geometry.dispose();
  }
  prototypeGeometryCache.clear();
}

type LayerSpec =
  | ['prism', number, number, number, number, THREE.Color]
  | ['cone', number, number, number, number, THREE.Color];

function createSimpleFoliagePrototypeGeometry(kind: FoliagePrototypeKind): THREE.BufferGeometry {
  switch (kind) {
    case 'spire':
      return buildGeometry([
        ['prism', 0.10, -0.50, -0.04, 5, new THREE.Color(0.40, 0.23, 0.10)],
        ['cone', 0.52, -0.20, 0.86, 5, new THREE.Color(0.18, 0.46, 0.22)],
      ]);
    case 'compact':
      return buildGeometry([
        ['prism', 0.12, -0.50, -0.02, 5, new THREE.Color(0.40, 0.22, 0.10)],
        ['cone', 0.56, -0.18, 0.70, 5, new THREE.Color(0.16, 0.48, 0.22)],
      ]);
    case 'broad':
      return buildGeometry([
        ['prism', 0.13, -0.50, 0.08, 5, new THREE.Color(0.43, 0.25, 0.12)],
        ['cone', 0.68, -0.02, 0.76, 5, new THREE.Color(0.20, 0.52, 0.24)],
      ]);
    case 'shrub':
      return buildGeometry([
        ['cone', 0.46, -0.30, 0.42, 5, new THREE.Color(0.32, 0.56, 0.26)],
      ]);
    case 'stump':
      return buildGeometry([
        ['prism', 0.30, -0.50, 0.36, 5, new THREE.Color(0.42, 0.26, 0.13)],
      ]);
  }
}

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
