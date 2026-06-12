import * as THREE from 'three';

export interface MushroomModelPrototype {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  baseHeight: number;
  baseMinY: number;
}

const mushroomModelCache = new Map<string, MushroomModelPrototype>();
const mushroomModelPromiseCache = new Map<string, Promise<MushroomModelPrototype>>();
const MUSHROOM_MODEL_FILE = 'mushroom.glb';
const MUSHROOM_UPRIGHT_ROTATION_X = -Math.PI / 2;

export async function getMushroomModelPrototype(): Promise<MushroomModelPrototype> {
  const cached = mushroomModelCache.get(MUSHROOM_MODEL_FILE);
  if (cached) return cached;

  let promise = mushroomModelPromiseCache.get(MUSHROOM_MODEL_FILE);
  if (!promise) {
    promise = loadMushroomModelPrototype();
    mushroomModelPromiseCache.set(MUSHROOM_MODEL_FILE, promise);
  }

  const prototype = await promise;
  mushroomModelCache.set(MUSHROOM_MODEL_FILE, prototype);
  return prototype;
}

export function clearMushroomModelCache(): void {
  for (const prototype of mushroomModelCache.values()) {
    prototype.geometry.dispose();
    disposeMaterialTextures(prototype.material);
    prototype.material.dispose();
  }

  mushroomModelCache.clear();
  mushroomModelPromiseCache.clear();
}

async function loadMushroomModelPrototype(): Promise<MushroomModelPrototype> {
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

  const gltf = await loader.loadAsync(getMushroomModelUrl());
  const mesh = findFirstMesh(gltf.scene);
  if (!mesh) {
    throw new Error(`${MUSHROOM_MODEL_FILE} did not contain a mesh for foliage rendering`);
  }

  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry;
  if (!mesh.matrixWorld.equals(new THREE.Matrix4())) {
    geometry.applyMatrix4(mesh.matrixWorld);
  }
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(MUSHROOM_UPRIGHT_ROTATION_X));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.sharedFoliageResource = true;

  const material = getMeshStandardMaterial(mesh.material);
  material.roughness = Math.max(material.roughness, 0.82);
  material.userData.sharedFoliageResource = true;
  material.needsUpdate = true;

  const boundingBox = geometry.boundingBox ?? new THREE.Box3().setFromBufferAttribute(
    geometry.getAttribute('position') as THREE.BufferAttribute,
  );
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  return {
    geometry,
    material,
    baseHeight: Math.max(size.y, 0.001),
    baseMinY: boundingBox.min.y,
  };
}

function getMushroomModelUrl(): string {
  const modelPath = `${import.meta.env.BASE_URL}models/${MUSHROOM_MODEL_FILE}`;
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
    roughness: 0.86,
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
