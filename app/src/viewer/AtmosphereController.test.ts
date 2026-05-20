import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AtmosphereController, SUN_DISTANCE } from './AtmosphereController';

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

    // Target should be projected to ground at camera XZ
    expect(directionalLight.target.position.x).toBeCloseTo(320);
    expect(directionalLight.target.position.z).toBeCloseTo(-240);

    // Light position should be derived from default elevation (30°) and azimuth (0°)
    const offset = new THREE.Vector3().subVectors(
      directionalLight.position,
      directionalLight.target.position
    );
    expect(offset.length()).toBeCloseTo(SUN_DISTANCE);

    // Default elevation = 30° => sun is lower, Y offset is moderate
    expect(offset.y).toBeGreaterThan(80);
    expect(offset.y).toBeLessThan(120);

    // Default azimuth = 0° => sun is toward North (0°)
    expect(Math.abs(offset.x)).toBeLessThan(1);
    expect(offset.z).toBeGreaterThan(150);

    atmosphere.dispose();
  });

  it('updates directional light position when sky params change', () => {
    const scene = new THREE.Scene();
    const ambientLight = new THREE.AmbientLight(0x9fb6c8, 0.365);
    const directionalLight = new THREE.DirectionalLight(0xffe2b8, 1.12);
    scene.add(ambientLight);
    scene.add(directionalLight);

    const atmosphere = new AtmosphereController(scene, ambientLight, directionalLight);

    // Move sun to zenith (elevation 90°)
    atmosphere.setSkyParams({ elevation: 90 });

    const offset = new THREE.Vector3().subVectors(
      directionalLight.position,
      directionalLight.target.position
    );

    // At zenith, sun should be almost directly above target
    expect(offset.y).toBeCloseTo(SUN_DISTANCE, 0);
    expect(Math.abs(offset.x)).toBeLessThan(1);
    expect(Math.abs(offset.z)).toBeLessThan(1);

    atmosphere.dispose();
  });
});
