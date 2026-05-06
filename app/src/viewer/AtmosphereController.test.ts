import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AtmosphereController } from './AtmosphereController';

describe('AtmosphereController', () => {
  it('owns background mode, sun focus, and disposable atmosphere resources', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const ambientLight = new THREE.AmbientLight(0x9fb6c8, 0.365);
    const directionalLight = new THREE.DirectionalLight(0xffe2b8, 1.12);

    scene.add(ambientLight);
    scene.add(directionalLight);

    const atmosphere = new AtmosphereController(scene, ambientLight, directionalLight);

    const defaultBackground = scene.background as THREE.Color;
    expect(defaultBackground).toBeInstanceOf(THREE.Color);
    expect(defaultBackground.getHex()).toBe(0x87ceeb);
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);

    atmosphere.setBackgroundMode(true);

    const skyBackground = scene.background as THREE.DataTexture;
    expect(skyBackground).toBeInstanceOf(THREE.DataTexture);
    expect(skyBackground.userData.backgroundMode).toBe('sky');
    expect(skyBackground.image.width).toBe(96);
    expect(skyBackground.image.height).toBe(64);
    expect((scene.fog as THREE.FogExp2).color.getHex()).toBe(0x1d3433);

    camera.position.set(320, 80, -240);
    atmosphere.updateSunAndShadowFocus(camera);

    expect(directionalLight.target.position.x).toBeCloseTo(320);
    expect(directionalLight.target.position.z).toBeCloseTo(-240);
    expect(directionalLight.position.x - directionalLight.target.position.x).toBeCloseTo(90);
    expect(directionalLight.position.y - directionalLight.target.position.y).toBeCloseTo(138);
    expect(directionalLight.position.z - directionalLight.target.position.z).toBeCloseTo(56);
    expect(atmosphere.sunSprite).toBeInstanceOf(THREE.Sprite);
    expect(atmosphere.sunSprite?.castShadow).toBe(false);
    expect(atmosphere.sunSprite?.receiveShadow).toBe(false);
    expect((atmosphere.sunSprite?.material as THREE.SpriteMaterial).depthWrite).toBe(false);
    expect((atmosphere.sunSprite?.material as THREE.SpriteMaterial).opacity).toBeLessThanOrEqual(0.82);
    expect(atmosphere.sunSprite?.scale.x).toBeGreaterThanOrEqual(72);
    expect(atmosphere.sunSprite?.scale.x).toBeLessThanOrEqual(96);

    const sunDirection = atmosphere.sunSprite!.position.clone().sub(directionalLight.target.position).normalize();
    const lightDirection = directionalLight.position.clone().sub(directionalLight.target.position).normalize();
    expect(sunDirection.distanceTo(lightDirection)).toBeLessThan(0.0001);

    atmosphere.dispose();

    expect(atmosphere.sunSprite).toBeNull();
  });
});
