import * as THREE from 'three';
import {
  createTerrainBlendMaterial,
  getCachedTerrainMaterial,
  toGrayscale,
  type BiomeColor,
  type TerrainSurfaceTextureLibrary,
} from './materials';
import type { ChunkData } from '@engine/index';

type WireframeMaterial = THREE.Material & { wireframe: boolean };

export interface TerrainMaterialOptions {
  terrainTextures: TerrainSurfaceTextureLibrary;
  terrainTexturesEnabled: boolean;
  wireframeMode: boolean;
  riverbedMaskTexture?: THREE.Texture;
}

export function createTerrainMaterial(options: TerrainMaterialOptions): THREE.MeshStandardMaterial {
  if (options.terrainTexturesEnabled && options.riverbedMaskTexture) {
    return createTerrainBlendMaterial(
      options.terrainTextures,
      options.wireframeMode,
      options.riverbedMaskTexture,
    );
  }

  return getCachedTerrainMaterial(
    options.terrainTexturesEnabled ? options.terrainTextures : null,
    options.wireframeMode,
  );
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

export function updateTerrainTemperatureColors(mesh: THREE.Mesh, showTemperature: boolean, chunkData: ChunkData | null): void {
  const geometry = mesh.geometry;
  const colors = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!colors) return;

  const colorArray = colors.array as Float32Array;

  if (showTemperature && chunkData?.temperatureMap) {
    if (!mesh.userData.originalColors) {
      mesh.userData.originalColors = new Float32Array(colorArray);
    }

    const temperatureMap = chunkData.temperatureMap;
    const chunkSize = chunkData.size;
    const verticesPerSide = chunkSize + 1;

    for (let vy = 0; vy <= chunkSize; vy++) {
      for (let vx = 0; vx <= chunkSize; vx++) {
        const vertexIndex = vy * verticesPerSide + vx;
        const colorIndex = vertexIndex * 3;

        const tileX = Math.min(vx, chunkSize - 1);
        const tileY = Math.min(vy, chunkSize - 1);
        const tileIndex = tileY * chunkSize + tileX;

        const temperature = tileIndex < temperatureMap.length ? temperatureMap[tileIndex] : 0;
        const tempColor = temperatureToColor(temperature);

        colorArray[colorIndex] = tempColor.r;
        colorArray[colorIndex + 1] = tempColor.g;
        colorArray[colorIndex + 2] = tempColor.b;
      }
    }
  } else {
    if (mesh.userData.originalColors) {
      for (let i = 0; i < colorArray.length; i++) {
        colorArray[i] = mesh.userData.originalColors[i];
      }
    }
  }

  colors.needsUpdate = true;
}

function temperatureToColor(temperature: number): BiomeColor {
  const t = (temperature + 1) * 0.5;

  if (t < 0.25) {
    const s = t / 0.25;
    return {
      r: 0.1 + s * 0.1,
      g: 0.1 + s * 0.2,
      b: 0.6 - s * 0.2,
    };
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return {
      r: 0.2 + s * 0.1,
      g: 0.3 + s * 0.4,
      b: 0.4 - s * 0.1,
    };
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return {
      r: 0.3 + s * 0.5,
      g: 0.7 - s * 0.1,
      b: 0.3 - s * 0.2,
    };
  } else {
    const s = (t - 0.75) / 0.25;
    return {
      r: 0.8 + s * 0.2,
      g: 0.6 - s * 0.4,
      b: 0.1 - s * 0.1,
    };
  }
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
    if (previousMaterial.userData.sharedTerrainMaterial !== true) {
      previousMaterial.dispose();
    }
  }

  mesh.material = nextMaterial;
}

function hasWireframe(material: THREE.Material): material is WireframeMaterial {
  return 'wireframe' in material;
}
