import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AtmosphereController } from './AtmosphereController';

describe('AtmosphereController', () => {
  it('starts with Sky background, updates sun focus, and cleans up on dispose', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const ambientLight = new THREE.AmbientLight(0x9fb6c8, 0.365);
    const directionalLight = new THREE.DirectionalLight(0xffe2b8, 1.12);

    scene.add(ambientLight);
    scene.add(directionalLight);

    const atmosphere = new AtmosphereController(scene, ambientLight, directionalLight);

    // Sky is always active — background is a dark colour so the Sky dome is visible
    const defaultBackground = scene.background as THREE.Color;
    expect(defaultBackground).toBeInstanceOf(THREE.Color);
    expect(defaultBackground.getHex()).toBe(0x050810);
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);

    camera.position.set(320, 80, -240);
    atmosphere.updateSunAndShadowFocus(camera);

    expect(directionalLight.target.position.x).toBeCloseTo(320);
    expect(directionalLight.target.position.z).toBeCloseTo(-240);
    expect(directionalLight.position.x - directionalLight.target.position.x).toBeCloseTo(90);
    expect(directionalLight.position.y - directionalLight.target.position.y).toBeCloseTo(138);
    expect(directionalLight.position.z - directionalLight.target.position.z).toBeCloseTo(56);

    atmosphere.dispose();
  });
});
