/**
 * @vitest-environment happy-dom
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  setupWorldScene,
} from './WorldSceneSetup';
import { SUN_DISTANCE } from './AtmosphereController';
import { TERRAIN_HEIGHT_SCALE_METERS } from '@engine/index';

describe('WorldSceneSetup', () => {
  it('configures renderer and adds world scene lighting objects', () => {
    const scene = new THREE.Scene();
    const renderer = createRendererStub();

    const objects = setupWorldScene(scene, renderer as THREE.WebGLRenderer);

    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(0.9);
    expect(scene.children).toContain(objects.ambientLight);
    expect(scene.children).toContain(objects.directionalLight);
    expect(objects.ambientLight.intensity).toBe(0.45);
    expect(objects.ambientLight.color.getHex()).toBe(0xb5cad6);
    expect(objects.directionalLight.intensity).toBeGreaterThanOrEqual(1.08);
    expect(objects.directionalLight.intensity).toBeLessThanOrEqual(1.16);
    expect(objects.directionalLight.color.getHex()).toBe(0xffe2b8);
    expect(objects.directionalLight.position.y).toBeGreaterThan(0);
    expect(objects.directionalLight.position.y).toBeGreaterThan(TERRAIN_HEIGHT_SCALE_METERS * 2);
    expect(objects.directionalLight.castShadow).toBe(true);
    expect(objects.directionalLight.shadow.camera.left).toBeLessThanOrEqual(-768);
    expect(objects.directionalLight.shadow.camera.right).toBeGreaterThanOrEqual(768);
    expect(objects.directionalLight.shadow.camera.far).toBeGreaterThanOrEqual(1800);
    expect(objects.directionalLight.shadow.camera.far).toBeGreaterThan(SUN_DISTANCE);
    expect(objects.directionalLight.shadow.mapSize.width).toBe(4096);
    expect(objects.directionalLight.shadow.camera.projectionMatrix.elements[0]).toBeCloseTo(1 / 3840);
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
