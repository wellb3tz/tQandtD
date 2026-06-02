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
    expect(renderer.toneMappingExposure).toBe(1.16);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(scene.children).toContain(objects.ambientLight);
    expect(scene.children).toContain(objects.directionalLight);
    expect(objects.ambientLight.intensity).toBe(0.66);
    expect(objects.ambientLight.color.getHex()).toBe(0xc6d7df);
    expect(objects.directionalLight.intensity).toBe(1.14);
    expect(objects.directionalLight.color.getHex()).toBe(0xffdfad);
    expect(scene.children.some(child => child instanceof THREE.HemisphereLight)).toBe(true);
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

function createRendererStub(): Pick<THREE.WebGLRenderer, 'shadowMap' | 'toneMapping' | 'toneMappingExposure' | 'outputColorSpace'> {
  return {
    shadowMap: {
      enabled: false,
      type: undefined,
    },
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: THREE.NoColorSpace,
  } as Pick<THREE.WebGLRenderer, 'shadowMap' | 'toneMapping' | 'toneMappingExposure' | 'outputColorSpace'>;
}
