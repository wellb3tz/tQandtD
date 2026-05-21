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

    // Sky is always active - background is a dark colour so the Sky dome is visible
    const defaultBackground = scene.background as THREE.Color;
    expect(defaultBackground).toBeInstanceOf(THREE.Color);
    expect(defaultBackground.getHex()).toBe(0x050810);
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);

    camera.position.set(320, 80, -240);
    atmosphere.updateSunAndShadowFocus(camera);

    // Target should be projected near the camera XZ, then snapped to the shadow texel grid.
    expect(directionalLight.target.position.x).toBeCloseTo(320);
    expect(directionalLight.target.position.z).toBeCloseTo(-240);

    // Light position should be derived from default elevation (30 deg) and azimuth (0 deg)
    const offset = new THREE.Vector3().subVectors(
      directionalLight.position,
      directionalLight.target.position
    );
    expect(offset.length()).toBeCloseTo(SUN_DISTANCE);

    // Default elevation = 30 deg => sun is lower, Y offset is moderate
    expect(offset.y).toBeGreaterThan(80);
    expect(offset.y).toBeLessThan(120);

    // Default azimuth = 0 deg => sun is toward North (0 deg)
    expect(Math.abs(offset.x)).toBeLessThan(1);
    expect(offset.z).toBeGreaterThan(150);

    atmosphere.dispose();
  });

  it('snaps the moving shadow focus to texels so small camera moves do not shimmer shadows', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const ambientLight = new THREE.AmbientLight(0x9fb6c8, 0.365);
    const directionalLight = new THREE.DirectionalLight(0xffe2b8, 1.12);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -200;
    directionalLight.shadow.camera.right = 200;
    directionalLight.shadow.camera.top = 200;
    directionalLight.shadow.camera.bottom = -200;
    directionalLight.shadow.mapSize.set(2048, 2048);

    scene.add(ambientLight);
    scene.add(directionalLight);

    const atmosphere = new AtmosphereController(scene, ambientLight, directionalLight);

    camera.position.set(11.95, 50, -20);
    atmosphere.updateSunAndShadowFocus(camera);
    const stableTarget = directionalLight.target.position.clone();

    camera.position.set(11.955, 50, -19.995);
    atmosphere.updateSunAndShadowFocus(camera);

    expect(directionalLight.target.position.x).toBeCloseTo(stableTarget.x);
    expect(directionalLight.target.position.z).toBeCloseTo(stableTarget.z);

    camera.position.x += 0.4;
    atmosphere.updateSunAndShadowFocus(camera);

    expect(directionalLight.target.position.x).not.toBeCloseTo(stableTarget.x);

    atmosphere.dispose();
  });

  it('updates directional light position when sky params change', () => {
    const scene = new THREE.Scene();
    const ambientLight = new THREE.AmbientLight(0x9fb6c8, 0.365);
    const directionalLight = new THREE.DirectionalLight(0xffe2b8, 1.12);
    scene.add(ambientLight);
    scene.add(directionalLight);

    const atmosphere = new AtmosphereController(scene, ambientLight, directionalLight);

    // Move sun to zenith (elevation 90 deg)
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
