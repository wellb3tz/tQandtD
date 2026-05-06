/**
 * @vitest-environment happy-dom
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  setBackgroundOceanMode,
  setupWorldScene,
} from './WorldSceneSetup';

describe('WorldSceneSetup', () => {
  it('configures renderer and adds world scene lighting objects', () => {
    const scene = new THREE.Scene();
    const renderer = createRendererStub();

    const objects = setupWorldScene(scene, renderer as THREE.WebGLRenderer);

    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(0.81);
    expect(scene.children).toContain(objects.backgroundOceanMesh);
    expect(scene.children).toContain(objects.ambientLight);
    expect(scene.children).toContain(objects.directionalLight);
    expect(objects.backgroundOceanMesh.name).toBe('background-ocean');
    expect(objects.backgroundOceanMesh.visible).toBe(false);
    expect(objects.ambientLight.intensity).toBeGreaterThanOrEqual(0.36);
    expect(objects.ambientLight.intensity).toBeLessThanOrEqual(0.37);
    expect(objects.ambientLight.color.getHex()).toBe(0x9fb6c8);
    expect(objects.directionalLight.intensity).toBeGreaterThanOrEqual(1.08);
    expect(objects.directionalLight.intensity).toBeLessThanOrEqual(1.16);
    expect(objects.directionalLight.color.getHex()).toBe(0xffe2b8);
    expect(objects.directionalLight.position.x).toBeGreaterThan(0);
    expect(objects.directionalLight.position.y).toBeGreaterThanOrEqual(132);
    expect(objects.directionalLight.position.z).toBeGreaterThan(0);
  });

  it('updates background ocean material for legacy and atmospheric modes', () => {
    const scene = new THREE.Scene();
    const renderer = createRendererStub();
    const { backgroundOceanMesh } = setupWorldScene(scene, renderer as THREE.WebGLRenderer);
    const material = backgroundOceanMesh.material as THREE.MeshPhongMaterial;

    setBackgroundOceanMode(backgroundOceanMesh, true);
    expect(material.shininess).toBe(18);

    setBackgroundOceanMode(backgroundOceanMesh, false);
    expect(material.shininess).toBe(22);
    expect(backgroundOceanMesh.visible).toBe(false);
  });
});

function createRendererStub(): Pick<THREE.WebGLRenderer, 'shadowMap' | 'toneMapping' | 'toneMappingExposure'> {
  return {
    shadowMap: {
      enabled: false,
      type: undefined,
    },
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
  } as Pick<THREE.WebGLRenderer, 'shadowMap' | 'toneMapping' | 'toneMappingExposure'>;
}
