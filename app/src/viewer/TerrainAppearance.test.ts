import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyTerrainColorMode,
  createTerrainMaterial,
  replaceTerrainMaterial,
  setTerrainWireframe,
  updateTerrainBiomeColors,
} from './TerrainAppearance';
import { clearTerrainMaterialCache, type TerrainSurfaceTextureLibrary } from './materials';

describe('TerrainAppearance', () => {
  afterEach(() => {
    clearTerrainMaterialCache();
  });

  it('switches terrain materials between textured and biome-color modes', () => {
    const terrainTextures = createTestTerrainTextures();

    const textured = createTerrainMaterial({
      terrainTextures,
      terrainTexturesEnabled: true,
      wireframeMode: false,
    });
    const colorOnly = createTerrainMaterial({
      terrainTextures,
      terrainTexturesEnabled: false,
      wireframeMode: true,
    });

    expect(textured.userData.terrainTexturesEnabled).toBe(true);
    expect(textured.map).toBeTruthy();
    expect(colorOnly.userData.terrainTexturesEnabled).toBe(false);
    expect(colorOnly.map).toBeNull();
    expect(colorOnly.wireframe).toBe(true);
  });

  it('converts terrain colors to grayscale and restores original biome colors', () => {
    const mesh = createColorMesh(new Float32Array([
      1.0, 0.0, 0.0,
      0.0, 1.0, 0.0,
    ]));
    const colors = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;

    updateTerrainBiomeColors(mesh, false);

    expect(colors.getX(0)).toBeCloseTo(colors.getY(0));
    expect(colors.getY(0)).toBeCloseTo(colors.getZ(0));
    expect(mesh.userData.originalColors).toBeInstanceOf(Float32Array);

    updateTerrainBiomeColors(mesh, true);

    expect(colors.getX(0)).toBeCloseTo(1);
    expect(colors.getY(0)).toBeCloseTo(0);
    expect(colors.getZ(0)).toBeCloseTo(0);
    expect(colors.getX(1)).toBeCloseTo(0);
    expect(colors.getY(1)).toBeCloseTo(1);
    expect(colors.getZ(1)).toBeCloseTo(0);
  });

  it('keeps biome colors hidden when the temperature overlay is off', () => {
    const mesh = createColorMesh(new Float32Array([
      1.0, 0.0, 0.0,
      0.0, 1.0, 0.0,
      0.0, 0.0, 1.0,
      1.0, 1.0, 0.0,
    ]));
    const colors = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;

    applyTerrainColorMode(mesh, {
      showBiomes: false,
      showTemperature: false,
      chunkData: {
        size: 1,
        temperatureMap: new Float32Array([0.5]),
      } as any,
    });

    expect(colors.getX(0)).toBeCloseTo(colors.getY(0));
    expect(colors.getY(0)).toBeCloseTo(colors.getZ(0));
    expect(colors.getX(1)).toBeCloseTo(colors.getY(1));
    expect(colors.getY(1)).toBeCloseTo(colors.getZ(1));
  });

  it('updates wireframe and preserves opacity when replacing material', () => {
    const mesh = createColorMesh(new Float32Array([1, 1, 1]));
    const previous = mesh.material as THREE.MeshStandardMaterial;
    previous.transparent = true;
    previous.opacity = 0.5;
    previous.userData.sharedTerrainMaterial = true;
    previous.dispose = vi.fn();

    setTerrainWireframe(mesh, true);
    expect(previous.wireframe).toBe(true);

    const next = new THREE.MeshStandardMaterial();
    replaceTerrainMaterial(mesh, next);

    // NOTE: previous material is NOT disposed here because terrain
    // materials are shared across chunks via getCachedTerrainMaterial().
    expect(previous.dispose).not.toHaveBeenCalled();
    expect(next.transparent).toBe(true);
    expect(next.opacity).toBe(0.5);
    expect(mesh.material).toBe(next);
  });

  it('disposes per-chunk terrain materials when replacing them', () => {
    const mesh = createColorMesh(new Float32Array([1, 1, 1]));
    const previous = mesh.material as THREE.MeshStandardMaterial;
    previous.userData.sharedTerrainMaterial = false;
    previous.dispose = vi.fn();

    replaceTerrainMaterial(mesh, new THREE.MeshStandardMaterial());

    expect(previous.dispose).toHaveBeenCalledOnce();
  });
});

function createColorMesh(colors: Float32Array): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(colors.length), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true }));
}

function createTestTerrainTextures(): TerrainSurfaceTextureLibrary {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  texture.needsUpdate = true;

  return {
    albedoAtlas: texture,
    plains: {
      albedo: texture,
      normal: texture,
      roughness: texture,
    },
  } as TerrainSurfaceTextureLibrary;
}
