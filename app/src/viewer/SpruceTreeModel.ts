import * as THREE from 'three';

export interface SpruceTreePrototype {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

let spruceTreePrototype: SpruceTreePrototype | undefined;
let spruceTreePrototypePromise: Promise<SpruceTreePrototype> | undefined;

const SPRUCE_TREE_MODEL_PATH = `${import.meta.env.BASE_URL}models/spruce.glb`;
const SPRUCE_TREE_MODEL_URL = new URL(SPRUCE_TREE_MODEL_PATH, getAssetBaseUrl()).href;

export async function getSpruceTreePrototype(): Promise<SpruceTreePrototype> {
  if (spruceTreePrototype) return spruceTreePrototype;
  spruceTreePrototypePromise ??= loadSpruceTreePrototype();
  spruceTreePrototype = await spruceTreePrototypePromise;
  return spruceTreePrototype;
}

export function clearSpruceTreeModelCache(): void {
  if (spruceTreePrototype) {
    spruceTreePrototype.geometry.dispose();
    disposeMaterialTextures(spruceTreePrototype.material);
    spruceTreePrototype.material.dispose();
  }

  spruceTreePrototype = undefined;
  spruceTreePrototypePromise = undefined;
}

async function loadSpruceTreePrototype(): Promise<SpruceTreePrototype> {
  ensureSelfGlobal();
  const [gltfModule, meshoptModule] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);
  const { GLTFLoader } = gltfModule;
  const { MeshoptDecoder } = meshoptModule as unknown as {
    MeshoptDecoder: Parameters<InstanceType<typeof GLTFLoader>['setMeshoptDecoder']>[0];
  };

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const gltf = await loader.loadAsync(SPRUCE_TREE_MODEL_URL);
  const mesh = findFirstMesh(gltf.scene);
  if (!mesh) {
    throw new Error('spruce.glb did not contain a mesh for foliage rendering');
  }

  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry;
  if (!mesh.matrixWorld.equals(new THREE.Matrix4())) {
    geometry.applyMatrix4(mesh.matrixWorld);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.sharedFoliageResource = true;

  const material = getMeshStandardMaterial(mesh.material);
  material.vertexColors = true;
  material.roughness = Math.max(material.roughness, 0.78);
  material.userData.sharedFoliageResource = true;
  material.needsUpdate = true;

  return { geometry, material };
}

function findFirstMesh(root: THREE.Object3D): THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> | undefined {
  let mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> | undefined;
  root.traverse((object) => {
    if (!mesh && object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry) {
      mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    }
  });
  return mesh;
}

function getMeshStandardMaterial(material: THREE.Material | THREE.Material[]): THREE.MeshStandardMaterial {
  const selected = Array.isArray(material) ? material[0] : material;
  if (selected instanceof THREE.MeshStandardMaterial) {
    return selected;
  }

  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0,
  });
}

function ensureSelfGlobal(): void {
  const globalScope = globalThis as unknown as { self?: unknown };
  globalScope.self ??= globalScope;
}

function getAssetBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }
  if (typeof location !== 'undefined' && location.href) {
    return location.href;
  }
  return 'http://localhost/';
}

function disposeMaterialTextures(material: THREE.Material): void {
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
}
