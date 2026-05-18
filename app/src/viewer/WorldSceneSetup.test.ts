/**
 * @vitest-environment happy-dom
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
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
    expect(scene.children).toContain(objects.ambientLight);
    expect(scene.children).toContain(objects.directionalLight);
    expect(objects.ambientLight.intensity).toBeGreaterThanOrEqual(0.36);
    expect(objects.ambientLight.intensity).toBeLessThanOrEqual(0.37);
    expect(objects.ambientLight.color.getHex()).toBe(0x9fb6c8);
    expect(objects.directionalLight.intensity).toBeGreaterThanOrEqual(1.08);
    expect(objects.directionalLight.intensity).toBeLessThanOrEqual(1.16);
    expect(objects.directionalLight.color.getHex()).toBe(0xffe2b8);
    expect(objects.directionalLight.position.y).toBeGreaterThan(0);
    expect(objects.directionalLight.castShadow).toBe(true);
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
