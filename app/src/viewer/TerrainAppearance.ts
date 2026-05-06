import * as THREE from 'three';
import {
  createBiomeColorTerrainMaterial,
  createTerrainBlendMaterial,
  toGrayscale,
  type BiomeColor,
  type TerrainSurfaceTextureLibrary,
} from './materials';

type WireframeMaterial = THREE.Material & { wireframe: boolean };

export interface TerrainMaterialOptions {
  terrainTextures: TerrainSurfaceTextureLibrary;
  terrainTexturesEnabled: boolean;
  wireframeMode: boolean;
}

export function createTerrainMaterial(options: TerrainMaterialOptions): THREE.MeshStandardMaterial {
  return options.terrainTexturesEnabled
    ? createTerrainBlendMaterial(options.terrainTextures, options.wireframeMode)
    : createBiomeColorTerrainMaterial(options.wireframeMode);
}

export function updateTerrainBiomeColors(mesh: THREE.Mesh, showBiomes: boolean): void {
  const geometry = mesh.geometry;
  const colors = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!colors) return;

  const colorArray = colors.array as Float32Array;

  if (showBiomes) {
    if (mesh.userData.originalColors) {
      for (let i = 0; i < colorArray.length; i++) {
        colorArray[i] = mesh.userData.originalColors[i];
      }
    }
  } else {
    if (!mesh.userData.originalColors) {
      mesh.userData.originalColors = new Float32Array(colorArray);
    }

    for (let i = 0; i < colorArray.length; i += 3) {
      const color: BiomeColor = {
        r: colorArray[i],
        g: colorArray[i + 1],
        b: colorArray[i + 2],
      };
      const gray = toGrayscale(color);
      colorArray[i] = gray.r;
      colorArray[i + 1] = gray.g;
      colorArray[i + 2] = gray.b;
    }
  }

  colors.needsUpdate = true;
}

export function setTerrainWireframe(mesh: THREE.Mesh, enabled: boolean): void {
  const material = mesh.material;
  if (Array.isArray(material)) {
    for (const item of material) {
      if (hasWireframe(item)) item.wireframe = enabled;
    }
    return;
  }

  if (hasWireframe(material)) material.wireframe = enabled;
}

export function replaceTerrainMaterial(mesh: THREE.Mesh, nextMaterial: THREE.MeshStandardMaterial): void {
  const previousMaterial = mesh.material;

  if (!Array.isArray(previousMaterial)) {
    nextMaterial.transparent = previousMaterial.transparent;
    nextMaterial.opacity = previousMaterial.opacity;
    previousMaterial.dispose();
  }

  mesh.material = nextMaterial;
}

function hasWireframe(material: THREE.Material): material is WireframeMaterial {
  return 'wireframe' in material;
}
