import * as THREE from 'three';

export type FoliageTreeModelKind = 'spruce' | 'palm';

export interface FoliageTreeModelPrototype {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

const treeModelCache = new Map<FoliageTreeModelKind, FoliageTreeModelPrototype>();
const treeModelPromiseCache = new Map<FoliageTreeModelKind, Promise<FoliageTreeModelPrototype>>();

const FOLIAGE_TREE_MODEL_FILES: Record<FoliageTreeModelKind, string> = {
  spruce: 'spruce.glb',
  palm: 'palm.glb',
};

export async function getFoliageTreeModelPrototype(kind: FoliageTreeModelKind): Promise<FoliageTreeModelPrototype> {
  const cached = treeModelCache.get(kind);
  if (cached) return cached;

  let promise = treeModelPromiseCache.get(kind);
  if (!promise) {
    promise = loadFoliageTreeModelPrototype(kind);
    treeModelPromiseCache.set(kind, promise);
  }

  const prototype = await promise;
  treeModelCache.set(kind, prototype);
  return prototype;
}

export function clearFoliageTreeModelCache(): void {
  for (const prototype of treeModelCache.values()) {
    prototype.geometry.dispose();
    disposeMaterialTextures(prototype.material);
    prototype.material.dispose();
  }

  treeModelCache.clear();
  treeModelPromiseCache.clear();
}

async function loadFoliageTreeModelPrototype(kind: FoliageTreeModelKind): Promise<FoliageTreeModelPrototype> {
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

  const gltf = await loader.loadAsync(getFoliageTreeModelUrl(kind));
  const mesh = findFirstMesh(gltf.scene);
  if (!mesh) {
    throw new Error(`${FOLIAGE_TREE_MODEL_FILES[kind]} did not contain a mesh for foliage rendering`);
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

function getFoliageTreeModelUrl(kind: FoliageTreeModelKind): string {
  const modelPath = `${import.meta.env.BASE_URL}models/${FOLIAGE_TREE_MODEL_FILES[kind]}`;
  return new URL(modelPath, getAssetBaseUrl()).href;
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
